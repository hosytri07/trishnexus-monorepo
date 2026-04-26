/**
 * TrishSearch — OCR Queue Manager (Stage 4b).
 *
 * Singleton queue xử lý bulk OCR sequentially:
 *  - User pick danh sách file → enqueue
 *  - Loop từng file: read bytes → OCR → updateFileOcr → next
 *  - Subscribers (UI) nhận state updates qua observer pattern
 *  - Có thể abort giữa chừng
 *
 * Note: Sequential vì Tesseract.js worker chỉ xử lý 1 task tại 1 thời điểm.
 * Parallel chỉ làm khi nhiều worker → tốn nhiều RAM (mỗi worker ~200MB).
 */

import {
  getOcrEngine,
  type OcrLanguage,
  type OcrProgress,
} from './ocr-engine.js';
import {
  readFileBytes,
  updateFileOcr,
  type IndexedFile,
} from './tauri-bridge.js';

export type QueueItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'skipped';

export interface QueueItem {
  file: IndexedFile;
  status: QueueItemStatus;
  error?: string;
  textLength?: number;
  /** Per-file completion timestamp (ms) cho ETA. */
  completedAt?: number;
}

export type QueueRunState = 'idle' | 'running' | 'aborting';

export interface QueueState {
  items: QueueItem[];
  status: QueueRunState;
  currentIndex: number;
  currentProgress: OcrProgress | null;
  startedAt: number | null;
}

type Listener = (state: QueueState) => void;

class OcrQueue {
  private items: QueueItem[] = [];
  private currentIndex = 0;
  private runStatus: QueueRunState = 'idle';
  private currentProgress: OcrProgress | null = null;
  private startedAt: number | null = null;
  private listeners = new Set<Listener>();
  private abortRequested = false;

  /** Bắt đầu queue. Nếu đang chạy → throw. */
  async start(files: IndexedFile[], lang: OcrLanguage): Promise<void> {
    if (this.runStatus !== 'idle') {
      throw new Error('OCR queue đang chạy, dừng trước khi start mới.');
    }
    if (files.length === 0) return;

    this.items = files.map((f) => ({ file: f, status: 'pending' as const }));
    this.currentIndex = 0;
    this.runStatus = 'running';
    this.startedAt = Date.now();
    this.abortRequested = false;
    this.notify();

    const engine = getOcrEngine();

    while (this.currentIndex < this.items.length) {
      if (this.abortRequested) {
        this.runStatus = 'idle';
        this.notify();
        return;
      }

      const item = this.items[this.currentIndex];
      item.status = 'processing';
      this.currentProgress = null;
      this.notify();

      try {
        const bytes = await readFileBytes(item.file.path);

        let text: string;
        if (item.file.ext === 'pdf') {
          text = await engine.ocrPdf(bytes, lang, (p) => {
            this.currentProgress = p;
            this.notify();
          });
        } else {
          text = await engine.ocrImage(bytes, lang, (p) => {
            this.currentProgress = p;
            this.notify();
          });
        }

        const trimmed = text.trim();
        if (trimmed.length === 0) {
          item.status = 'skipped';
          item.error = 'Không tìm thấy text';
        } else {
          await updateFileOcr(item.file.path, text);
          item.status = 'done';
          item.textLength = trimmed.length;
        }
      } catch (err) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : String(err);
      }

      item.completedAt = Date.now();
      this.currentProgress = null;
      this.currentIndex++;
      this.notify();
    }

    this.runStatus = 'idle';
    this.notify();
  }

  /** Yêu cầu dừng — file hiện tại sẽ chạy nốt rồi dừng. */
  abort(): void {
    if (this.runStatus === 'running') {
      this.abortRequested = true;
      this.runStatus = 'aborting';
      this.notify();
    }
  }

  /** Reset queue (sau khi user đóng UI) — chỉ work khi idle. */
  reset(): void {
    if (this.runStatus !== 'idle') return;
    this.items = [];
    this.currentIndex = 0;
    this.startedAt = null;
    this.notify();
  }

  getState(): QueueState {
    return {
      items: [...this.items],
      status: this.runStatus,
      currentIndex: this.currentIndex,
      currentProgress: this.currentProgress,
      startedAt: this.startedAt,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const l of this.listeners) {
      try {
        l(state);
      } catch (err) {
        console.warn('[ocr-queue] listener error:', err);
      }
    }
  }
}

let _instance: OcrQueue | null = null;

export function getOcrQueue(): OcrQueue {
  if (!_instance) _instance = new OcrQueue();
  return _instance;
}

/**
 * Estimate thời gian OCR còn lại dựa trên trung bình các file đã xong.
 * Trả về giây.
 */
export function estimateRemainingSec(state: QueueState): number {
  if (state.status === 'idle') return 0;
  const completed = state.items.filter(
    (i) => i.completedAt && (i.status === 'done' || i.status === 'error' || i.status === 'skipped'),
  );
  const remaining = state.items.length - state.currentIndex;
  if (completed.length === 0 || !state.startedAt) {
    // Fallback heuristic: 30s/PDF, 10s/image
    return state.items
      .slice(state.currentIndex)
      .reduce((sum, i) => sum + (i.file.ext === 'pdf' ? 30 : 10), 0);
  }
  const elapsed = (Date.now() - state.startedAt) / 1000;
  const avgPerFile = elapsed / completed.length;
  return Math.round(remaining * avgPerFile);
}

export function formatDurationSec(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return s > 0 ? `${min}p ${s}s` : `${min}p`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}g ${m}p` : `${h}g`;
}
