/**
 * DownloadScreen — Phase 26.1.D + 26.1.G polish.
 *
 * Paste URL share → tải file. Phase 26.1.G bonus:
 *   - Progress bar real-time (% + speed MB/s + ETA) listen 'drive-progress' event
 *   - Drag & drop link từ browser → auto paste vào URL field
 *   - Copy SHA256 + Mở folder chứa sau khi tải xong
 *   - Auto-detect filename từ URL info trước khi tải
 */

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  Download, Link as LinkIcon, Lock, FolderOpen,
  AlertCircle, CheckCircle2, Loader2, Copy, FolderTree,
  ListPlus, FileText, X,
} from 'lucide-react';

interface HistoryRow {
  id: string;
  file_name: string;
  size_bytes: number;
  sha256_hex: string;
  source_url: string;
  dest_path: string | null;
  downloaded_at: number;
}

interface ProgressEvent {
  current_chunk: number;
  total_chunks: number;
  bytes_done: number;
  total_bytes: number;
  file_name: string;
  phase: 'downloading' | 'decrypting' | 'verifying' | 'done' | 'error';
}

interface QueueEvent {
  queue_index: number;
  queue_total: number;
  url: string;
  file_name: string | null;
  status: 'queued' | 'downloading' | 'done' | 'error' | 'skipped';
  error: string | null;
}

interface QueueResult {
  total: number;
  success: number;
  failed: number;
  history_ids: string[];
}

type Mode = 'single' | 'multi';

export function DownloadScreen({ onDone }: { onDone: (row: HistoryRow) => void }): JSX.Element {
  const [mode, setMode] = useState<Mode>('single');

  // Single-mode state
  const [url, setUrl] = useState('');
  const [password, setPassword] = useState('');
  const [destPath, setDestPath] = useState('');
  const [success, setSuccess] = useState<HistoryRow | null>(null);
  const [copied, setCopied] = useState(false);

  // Multi-mode state
  const [multiUrls, setMultiUrls] = useState('');
  const [destFolder, setDestFolder] = useState('');
  const [queue, setQueue] = useState<QueueEvent[]>([]);
  const [queueResult, setQueueResult] = useState<QueueResult | null>(null);

  // Shared
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  const startTimeRef = useRef<number>(0);
  const lastBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const speedBpsRef = useRef<number>(0);

  const hasAutoKey = url.includes('#k=');

  // Listen Rust drive-queue event (multi-link mode)
  useEffect(() => {
    const unlisten = listen<QueueEvent>('drive-queue', (e) => {
      setQueue(prev => {
        const next = [...prev];
        const idx = next.findIndex(q => q.queue_index === e.payload.queue_index);
        if (idx >= 0) next[idx] = e.payload;
        else next.push(e.payload);
        return next.sort((a, b) => a.queue_index - b.queue_index);
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen Rust drive-progress event
  useEffect(() => {
    const unlisten = listen<ProgressEvent>('drive-progress', (e) => {
      setProgress(e.payload);

      // Calculate speed (smooth EMA)
      const now = Date.now();
      if (lastTimeRef.current > 0 && e.payload.bytes_done > lastBytesRef.current) {
        const dt = (now - lastTimeRef.current) / 1000;
        const dbytes = e.payload.bytes_done - lastBytesRef.current;
        if (dt > 0.1) {
          const instantBps = dbytes / dt;
          // EMA smooth (alpha 0.3)
          speedBpsRef.current = speedBpsRef.current * 0.7 + instantBps * 0.3;
          lastBytesRef.current = e.payload.bytes_done;
          lastTimeRef.current = now;
        }
      } else {
        lastBytesRef.current = e.payload.bytes_done;
        lastTimeRef.current = now;
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Drag & drop URL
  useEffect(() => {
    function onDragOver(e: DragEvent) { e.preventDefault(); }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      const text = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list') || '';
      if (text && (text.includes('trishteam.io.vn') || text.includes('/drive/share/'))) {
        setUrl(text.trim());
      }
    }
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  async function pickDest() {
    try {
      // Suggest filename từ token
      const token = url.match(/\/drive\/share\/([^?#]+)/)?.[1] || '';
      const suggestedName = token ? `share-${token.slice(0, 8)}.bin` : 'download.bin';
      const sel = await saveDialog({ defaultPath: suggestedName, title: 'Lưu file tại...' });
      if (typeof sel === 'string') setDestPath(sel);
    } catch (e) { setErr(String(e)); }
  }

  async function doDownload() {
    if (!url.trim()) {
      setErr('Paste URL share trước');
      return;
    }
    if (!destPath.trim()) {
      setErr('Chọn thư mục lưu file');
      return;
    }
    setBusy(true);
    setErr(null);
    setSuccess(null);
    setProgress(null);
    startTimeRef.current = Date.now();
    lastBytesRef.current = 0;
    lastTimeRef.current = 0;
    speedBpsRef.current = 0;

    try {
      const row = await invoke<HistoryRow>('share_paste_and_download', {
        url: url.trim(),
        password: password.trim() || null,
        destPath: destPath.trim(),
      });
      setSuccess(row);
      onDone(row);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copySha() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.sha256_hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function openFolder() {
    if (!success?.dest_path) return;
    try {
      const folder = success.dest_path.replace(/[\\/][^\\/]+$/, '');
      await openPath(folder);
    } catch (e) { setErr(String(e)); }
  }

  async function pickDestFolder() {
    try {
      const sel = await openDialog({ directory: true, multiple: false, title: 'Chọn folder lưu file...' });
      if (typeof sel === 'string') setDestFolder(sel);
    } catch (e) { setErr(String(e)); }
  }

  async function doMultiDownload() {
    const urls = multiUrls.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) {
      setErr('Paste ít nhất 1 URL');
      return;
    }
    if (!destFolder.trim()) {
      setErr('Chọn folder lưu file');
      return;
    }
    setBusy(true);
    setErr(null);
    setQueue(urls.map((u, i) => ({
      queue_index: i, queue_total: urls.length,
      url: u, file_name: null, status: 'queued' as const, error: null,
    })));
    setQueueResult(null);
    try {
      const r = await invoke<QueueResult>('share_queue_download', {
        urls, destFolder: destFolder.trim(),
      });
      setQueueResult(r);
      // Trigger history refresh sau khi xong
      r.history_ids.forEach(() => onDone({ id: '_queue_', file_name: '', size_bytes: 0, sha256_hex: '', source_url: '', dest_path: null, downloaded_at: 0 }));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  function clearQueue() {
    setQueue([]);
    setQueueResult(null);
    setMultiUrls('');
  }

  // Progress UI calc
  const pct = progress ? Math.round((progress.bytes_done / Math.max(1, progress.total_bytes)) * 100) : 0;
  const speedMb = (speedBpsRef.current / 1_048_576).toFixed(2);
  const remainingBytes = progress ? progress.total_bytes - progress.bytes_done : 0;
  const etaSec = speedBpsRef.current > 0 ? remainingBytes / speedBpsRef.current : 0;
  const phaseLabel: Record<ProgressEvent['phase'], string> = {
    downloading: 'Đang tải',
    decrypting: 'Đang giải mã',
    verifying: 'Verify SHA256...',
    done: 'Hoàn tất',
    error: 'Lỗi',
  };

  return (
    <div className="space-y-4" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Tải file qua share link</h2>
            <p className="card-subtitle">
              Paste URL từ admin — app sẽ tự decrypt + tải về máy. Có thể kéo-thả URL từ browser hoặc paste nhiều link cùng lúc.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--color-surface-row)', borderRadius: 10 }}>
            <button
              onClick={() => setMode('single')}
              disabled={busy}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                background: mode === 'single' ? 'var(--color-surface-card)' : 'transparent',
                color: mode === 'single' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                border: 'none', cursor: 'pointer',
                boxShadow: mode === 'single' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <FileText className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> 1 file
            </button>
            <button
              onClick={() => setMode('multi')}
              disabled={busy}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 7,
                background: mode === 'multi' ? 'var(--color-surface-card)' : 'transparent',
                color: mode === 'multi' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
                border: 'none', cursor: 'pointer',
                boxShadow: mode === 'multi' ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <ListPlus className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> Nhiều file
            </button>
          </div>
        </div>

        {/* MULTI mode UI */}
        {mode === 'multi' && (
          <div className="space-y-3 mt-4">
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkIcon className="h-3.5 w-3.5" /> URLs (1 link / dòng)
              </label>
              <textarea
                className="input-field"
                style={{ marginTop: 4, minHeight: 120, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                placeholder={'https://trishteam.io.vn/drive/share/abc...#k=...\nhttps://trishteam.io.vn/drive/share/def...#k=...\n...'}
                value={multiUrls}
                onChange={e => setMultiUrls(e.target.value)}
                disabled={busy}
              />
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {multiUrls.split('\n').filter(u => u.trim()).length} link(s) · App tải tuần tự (1 lúc 1 file để không nghẽn mạng).
                Chỉ support link auto-key (#k=...) — link có password riêng phải dùng mode "1 file".
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FolderOpen className="h-3.5 w-3.5" /> Folder lưu (filename auto-derive từ admin)
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  className="input-field"
                  style={{ flex: 1 }}
                  placeholder="Chọn folder..."
                  value={destFolder}
                  onChange={e => setDestFolder(e.target.value)}
                  disabled={busy}
                />
                <button className="btn-secondary" onClick={pickDestFolder} disabled={busy}>
                  Chọn folder...
                </button>
              </div>
            </div>

            {/* Queue list */}
            {queue.length > 0 && (
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 6 }}>
                {queue.map(q => (
                  <div key={q.queue_index} className="flex items-center gap-2 p-2" style={{ borderRadius: 6, fontSize: 12 }}>
                    <span style={{
                      width: 70, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textAlign: 'center',
                      background: q.status === 'done' ? 'rgba(16,185,129,0.15)' :
                                 q.status === 'error' ? 'rgba(239,68,68,0.15)' :
                                 q.status === 'downloading' ? 'rgba(16,185,129,0.08)' :
                                 q.status === 'skipped' ? 'rgba(245,158,11,0.15)' :
                                 'var(--color-surface-muted)',
                      color: q.status === 'done' ? 'var(--color-accent-primary)' :
                             q.status === 'error' ? '#dc2626' :
                             q.status === 'downloading' ? 'var(--color-accent-primary)' :
                             q.status === 'skipped' ? '#b45309' :
                             'var(--color-text-muted)',
                    }}>
                      {q.status === 'queued' ? 'Chờ' :
                       q.status === 'downloading' ? 'Đang tải' :
                       q.status === 'done' ? '✓ Xong' :
                       q.status === 'skipped' ? 'Skip' : '✕ Lỗi'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
                        {q.file_name || q.url}
                      </div>
                      {q.error && (
                        <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{q.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {queueResult && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                  ✓ Hoàn tất: {queueResult.success}/{queueResult.total} thành công
                  {queueResult.failed > 0 && <span style={{ color: '#dc2626' }}> · {queueResult.failed} lỗi</span>}
                </div>
              </div>
            )}

            {err && (
              <div className="flex gap-2 items-start p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-3">
              {queue.length > 0 && (
                <button className="btn-secondary" onClick={clearQueue} disabled={busy}>
                  <X className="h-4 w-4" /> Xoá danh sách
                </button>
              )}
              <button
                className="btn-primary"
                onClick={doMultiDownload}
                disabled={busy || !multiUrls.trim() || !destFolder.trim()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {busy ? `Đang tải ${queue.filter(q => q.status === 'done').length}/${queue.length}...` : `Tải ${multiUrls.split('\n').filter(u => u.trim()).length} file`}
              </button>
            </div>
          </div>
        )}

        {/* SINGLE mode UI */}
        {mode === 'single' && (
        <div className="space-y-3 mt-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <LinkIcon className="h-3.5 w-3.5" /> Share URL
            </label>
            <input
              type="url"
              className="input-field"
              style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              placeholder="https://trishteam.io.vn/drive/share/abc123...#k=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
              disabled={busy}
            />
            {hasAutoKey && (
              <div style={{ fontSize: 11, color: 'var(--color-accent-primary)', marginTop: 4 }}>
                ✓ URL có #k=... — không cần nhập password
              </div>
            )}
          </div>

          {!hasAutoKey && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock className="h-3.5 w-3.5" /> Password share
                <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>— admin gửi riêng</span>
              </label>
              <input
                type="password"
                className="input-field"
                style={{ marginTop: 4 }}
                placeholder="Nhập password share file này"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderOpen className="h-3.5 w-3.5" /> Lưu vào
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                className="input-field"
                style={{ flex: 1 }}
                placeholder="Chọn thư mục + tên file..."
                value={destPath}
                onChange={e => setDestPath(e.target.value)}
                disabled={busy}
              />
              <button className="btn-secondary" onClick={pickDest} disabled={busy}>
                Chọn...
              </button>
            </div>
          </div>

        {/* Progress bar */}
        {busy && progress && (
          <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex justify-between items-baseline mb-2">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                {phaseLabel[progress.phase]} · chunk {progress.current_chunk}/{progress.total_chunks}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{pct}%</div>
            </div>
            <div style={{ height: 8, background: 'var(--color-surface-muted)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: 'var(--color-accent-gradient)',
                transition: 'width 250ms cubic-bezier(0.2, 0, 0, 1)',
              }} />
            </div>
            <div className="flex justify-between mt-2" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>{formatBytes(progress.bytes_done)} / {formatBytes(progress.total_bytes)}</span>
              <span>
                {speedBpsRef.current > 0 && `${speedMb} MB/s`}
                {etaSec > 0 && etaSec < 3600 && ` · ETA ${formatEta(etaSec)}`}
              </span>
            </div>
          </div>
        )}

        {err && (
          <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex gap-2 items-start">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                  Tải thành công!
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {success.file_name} · {formatBytes(success.size_bytes)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                  SHA {success.sha256_hex.slice(0, 16)}... ✓ verified
                </div>
                <div className="flex gap-2 mt-3">
                  <button className="btn-secondary" onClick={openFolder} style={{ fontSize: 11, padding: '6px 10px' }}>
                    <FolderTree className="h-3.5 w-3.5" /> Mở folder
                  </button>
                  <button className="btn-secondary" onClick={copySha} style={{ fontSize: 11, padding: '6px 10px' }}>
                    {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Đã copy SHA256' : 'Copy SHA256'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button
            className="btn-primary"
            onClick={doDownload}
            disabled={busy || !url || !destPath || (!hasAutoKey && !password)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Đang tải...' : 'Tải file'}
          </button>
        </div>
        </div>
        )}
      </div>

      <div className="card" style={{ background: 'var(--color-surface-row)' }}>
        <div className="card-title" style={{ fontSize: 13 }}>💡 Mẹo nhanh</div>
        <ul style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7, paddingLeft: 18, marginTop: 6 }}>
          <li><strong>Drag & drop</strong>: kéo URL từ browser thả vào đây → tự fill ô URL</li>
          <li>URL có <code>#k=...</code> → không cần password (auto-key)</li>
          <li>URL không có fragment → admin gửi password riêng (Zalo / SMS)</li>
          <li>App tự verify SHA256 → đảm bảo file không bị corrupt</li>
          <li>File đã tải lưu vào tab "Lịch sử" — bookmark / tag để dễ tìm</li>
        </ul>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
