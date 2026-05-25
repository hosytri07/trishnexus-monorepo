/**
 * GoogleDriveDownloadScreen — Wave 73.2.
 *
 * Tab "Google Drive" — paste nhiều link Drive (1 link / dòng) → tải hàng loạt.
 *
 * Reuse yt-dlp backend: yt-dlp có extractor `googledrive` built-in, hỗ trợ
 * cả file và folder public. Mỗi link gọi `download_social_media` riêng để
 * UI có queue + progress per file giống tab "Tải video MXH".
 *
 * Hỗ trợ:
 *   - https://drive.google.com/file/d/FILE_ID/view
 *   - https://drive.google.com/open?id=FILE_ID
 *   - https://drive.google.com/uc?id=FILE_ID
 *   - https://drive.google.com/drive/folders/FOLDER_ID (folder public)
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { documentDir, join } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  Download as DownloadIcon,
  FolderOpen,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Files,
  Plus,
} from 'lucide-react';

interface GdQueueItem {
  id: string;
  url: string;
  fileId: string | null;
  /** Wave 74.1 — true nếu là folder URL, sẽ expand trước khi tải */
  isFolder: boolean;
  /** Tên folder gốc (cho group display) hoặc undefined cho file đơn */
  folderName?: string;
  status: 'pending' | 'expanding' | 'downloading' | 'done' | 'error';
  title?: string;
  percent?: string;
  speed?: string;
  eta?: string;
  outPath?: string;
  error?: string;
}

interface GDriveItem {
  id: string;
  title: string;
  url: string;
}

interface ToastMsg {
  msg: string;
  kind: 'ok' | 'err';
}

const FILE_ID_REGEX =
  /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|drive\/folders\/))([a-zA-Z0-9_-]{10,})/;

function extractFileId(url: string): string | null {
  const m = url.match(FILE_ID_REGEX);
  return m?.[1] ?? null;
}

function isFolderUrl(url: string): boolean {
  return /drive\.google\.com\/drive\/folders\//.test(url);
}

function parseLinks(text: string): string[] {
  return text
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => /^https?:\/\//.test(s));
}

export function GoogleDriveDownloadScreen(): JSX.Element {
  const [bulkInput, setBulkInput] = useState('');
  const [queue, setQueue] = useState<GdQueueItem[]>([]);
  const [outputDir, setOutputDir] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null);

  // Wave 74.3 — Listen progress events từ Rust backend
  useEffect(() => {
    void invoke<boolean>('check_ytdlp_available')
      .then(setYtdlpAvailable)
      .catch(() => setYtdlpAvailable(false));
    void documentDir()
      .then((dir) => join(dir, 'TrishDrive', 'GoogleDrive'))
      .then(setOutputDir);

    // Wave 74.3 — Subscribe progress event
    let unlistenFn: UnlistenFn | null = null;
    void listen<{
      item_id: string;
      percent: string;
      downloaded: number;
      total: number;
      speed: string;
      eta: string;
    }>('gdrive:progress', (event) => {
      const p = event.payload;
      setQueue((prev) =>
        prev.map((x) =>
          x.id === p.item_id
            ? { ...x, percent: p.percent, speed: p.speed, eta: p.eta }
            : x,
        ),
      );
    }).then((fn) => {
      unlistenFn = fn;
    });

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleAddBulk(): Promise<void> {
    const links = parseLinks(bulkInput);
    if (links.length === 0) {
      setToast({ msg: 'Không phát hiện link nào — paste link Google Drive 1 link/dòng', kind: 'err' });
      return;
    }

    // Wave 74.1 — Tách folder và file riêng. Folder cần expand qua yt-dlp
    // --flat-playlist để lấy list file con; file paste trực tiếp vào queue.
    const folders = links.filter(isFolderUrl);
    const files = links.filter((u) => !isFolderUrl(u));

    // 1. Add file đơn lẻ vào queue ngay
    const now = Date.now();
    const fileItems: GdQueueItem[] = files.map((url, i) => ({
      id: `${now}-f${i}`,
      url,
      fileId: extractFileId(url),
      isFolder: false,
      status: 'pending',
    }));
    if (fileItems.length > 0) {
      setQueue((prev) => [...prev, ...fileItems]);
    }
    setBulkInput('');

    if (folders.length === 0) {
      setToast({ msg: `✅ Đã thêm ${fileItems.length} file vào hàng đợi`, kind: 'ok' });
      return;
    }

    // Wave 74.2 — Folder scan giờ dùng embeddedfolderview (Rust scraper),
    // không cần yt-dlp. yt-dlp chỉ cần khi DOWNLOAD file con.
    setToast({
      msg: `⏳ Đang quét ${folders.length} folder để lấy danh sách file...`,
      kind: 'ok',
    });

    let totalExpanded = 0;
    let totalFailed = 0;
    for (let fi = 0; fi < folders.length; fi++) {
      const folderUrl = folders[fi] ?? '';
      const folderId = extractFileId(folderUrl) ?? `folder-${fi}`;
      try {
        const items = await invoke<GDriveItem[]>('list_gdrive_folder_items', {
          url: folderUrl,
        });
        const folderName = `Folder ${folderId.slice(0, 8)} (${items.length} file)`;
        const expandedItems: GdQueueItem[] = items.map((it, i) => ({
          id: `${now}-fo${fi}-${i}`,
          url: it.url,
          fileId: it.id,
          isFolder: false,
          folderName,
          title: it.title,
          status: 'pending',
        }));
        setQueue((prev) => [...prev, ...expandedItems]);
        totalExpanded += items.length;
      } catch (e) {
        // Fallback: thêm folder URL như item lỗi để user thấy
        const msg = e instanceof Error ? e.message : String(e);
        const errItem: GdQueueItem = {
          id: `${now}-fo${fi}-err`,
          url: folderUrl,
          fileId: folderId,
          isFolder: true,
          folderName: `Folder ${folderId.slice(0, 8)}`,
          status: 'error',
          error: `Không quét được folder: ${msg.slice(0, 120)}`,
        };
        setQueue((prev) => [...prev, errItem]);
        totalFailed += 1;
      }
    }

    const msgs: string[] = [];
    if (fileItems.length > 0) msgs.push(`${fileItems.length} file`);
    if (totalExpanded > 0) msgs.push(`${totalExpanded} file từ ${folders.length - totalFailed} folder`);
    if (totalFailed > 0) msgs.push(`${totalFailed} folder lỗi`);
    setToast({
      msg: `✅ Đã thêm ${msgs.join(' + ')} vào hàng đợi`,
      kind: totalFailed === folders.length && fileItems.length === 0 ? 'err' : 'ok',
    });
  }

  function handleRemove(id: string): void {
    setQueue((prev) => prev.filter((it) => it.id !== id));
  }
  function handleClearDone(): void {
    setQueue((prev) => prev.filter((it) => it.status !== 'done'));
  }
  function handleClearAll(): void {
    if (downloading) return;
    setQueue([]);
  }

  async function handleDownloadAll(): Promise<void> {
    if (downloading) return;
    const pendings = queue.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pendings.length === 0) {
      setToast({ msg: 'Không có link nào chờ tải', kind: 'err' });
      return;
    }
    setDownloading(true);
    // Tuần tự cho ổn định
    for (const it of pendings) {
      if (!it.fileId) {
        setQueue((prev) =>
          prev.map((x) =>
            x.id === it.id
              ? { ...x, status: 'error', error: 'Không xác định được file ID' }
              : x,
          ),
        );
        continue;
      }
      setQueue((prev) =>
        prev.map((x) => (x.id === it.id ? { ...x, status: 'downloading', percent: '0%' } : x)),
      );
      try {
        // Wave 74.3 — Tải trực tiếp qua drive.usercontent.google.com (không cần yt-dlp).
        // Backend emit `gdrive:progress` event để cập nhật UI realtime.
        const result = await invoke<{ ok: boolean; output_path?: string; stdout: string; stderr: string }>(
          'download_gdrive_file',
          {
            itemId: it.id,
            fileId: it.fileId,
            outputDir,
            suggestedName: it.title ?? null,
          },
        );
        if (result.ok) {
          const title = result.output_path
            ? result.output_path.split(/[\\/]/).pop() ?? undefined
            : it.title;
          setQueue((prev) =>
            prev.map((x) =>
              x.id === it.id
                ? { ...x, status: 'done', percent: '100%', outPath: result.output_path, title }
                : x,
            ),
          );
        } else {
          setQueue((prev) =>
            prev.map((x) =>
              x.id === it.id
                ? { ...x, status: 'error', error: (result.stderr ?? '').slice(0, 200) || 'Tải fail' }
                : x,
            ),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setQueue((prev) =>
          prev.map((x) => (x.id === it.id ? { ...x, status: 'error', error: msg } : x)),
        );
      }
    }
    setDownloading(false);
    const doneCount = queue.filter((it) => it.status === 'done').length + pendings.length;
    setToast({ msg: `🎉 Hoàn thành! ${doneCount} file đã tải`, kind: 'ok' });
  }

  const stats = {
    total: queue.length,
    pending: queue.filter((it) => it.status === 'pending').length,
    downloading: queue.filter((it) => it.status === 'downloading').length,
    done: queue.filter((it) => it.status === 'done').length,
    error: queue.filter((it) => it.status === 'error').length,
  };

  return (
    <div className="gd-screen">
      {/* Header */}
      <div className="gd-header">
        <div>
          <h2 className="gd-title">
            <span className="gd-title-icon">📁</span> Google Drive — Tải hàng loạt
          </h2>
          <p className="gd-subtitle">
            Paste 1 link / dòng (hoặc cách nhau bằng dấu phẩy / space) → bấm Thêm → bấm Tải tất cả.
            Hỗ trợ file public, folder public, link share.
          </p>
          {outputDir && (
            <div className="gd-output-path">
              <span className="gd-output-path-label">📂 Lưu vào:</span>
              <code className="gd-output-path-value" title={outputDir}>{outputDir}</code>
              <button
                type="button"
                className="gd-output-path-open"
                onClick={() => void openPath(outputDir)}
                title="Mở thư mục trong Explorer"
              >
                Mở
              </button>
            </div>
          )}
        </div>
        {/* Wave 74.3 — Không còn cần yt-dlp cho Google Drive — dùng direct
        download. Banner chỉ hiển thị info nếu offline. */}
      </div>

      {/* Input section */}
      <div className="gd-input-section">
        <label className="gd-label">
          <Files style={{ width: 14, height: 14 }} /> Danh sách link Google Drive
        </label>
        <textarea
          className="gd-textarea"
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          placeholder={`Ví dụ (mỗi link 1 dòng):\nhttps://drive.google.com/file/d/1abc.../view\nhttps://drive.google.com/file/d/2xyz.../view\nhttps://drive.google.com/drive/folders/3def...`}
          rows={5}
          spellCheck={false}
        />
        <div className="gd-input-actions">
          <button
            type="button"
            className="btn-primary gd-add-btn"
            onClick={() => void handleAddBulk()}
            disabled={!bulkInput.trim()}
          >
            <Plus style={{ width: 14, height: 14 }} /> Thêm vào hàng đợi
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setBulkInput('')}
            disabled={!bulkInput.trim()}
          >
            Xoá nội dung
          </button>
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="gd-queue-section">
          <div className="gd-queue-head">
            <div className="gd-queue-title">
              <strong>{stats.total}</strong> file trong hàng đợi
              {stats.done > 0 && <span className="gd-stat-pill gd-stat-ok">✓ {stats.done} xong</span>}
              {stats.error > 0 && <span className="gd-stat-pill gd-stat-err">✗ {stats.error} lỗi</span>}
              {stats.downloading > 0 && (
                <span className="gd-stat-pill gd-stat-load">⏳ {stats.downloading} đang tải</span>
              )}
            </div>
            <div className="gd-queue-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleDownloadAll()}
                disabled={downloading || stats.pending + stats.error === 0}
              >
                {downloading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Đang tải...
                  </>
                ) : (
                  <>
                    <DownloadIcon style={{ width: 14, height: 14 }} /> Tải tất cả ({stats.pending + stats.error})
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearDone}
                disabled={stats.done === 0 || downloading}
              >
                Dọn file xong
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClearAll}
                disabled={downloading}
              >
                <Trash2 style={{ width: 13, height: 13 }} /> Xoá tất cả
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void openPath(outputDir)}
                title={outputDir}
              >
                <FolderOpen style={{ width: 13, height: 13 }} /> Thư mục
              </button>
            </div>
          </div>

          <div className="gd-queue-list">
            {queue.map((it, idx) => (
              <div key={it.id} className={`gd-queue-item gd-queue-item-${it.status}`}>
                <div className="gd-queue-num">{idx + 1}</div>
                <div className="gd-queue-info">
                  <div className="gd-queue-name" title={it.url}>
                    {it.title || it.url}
                  </div>
                  <div className="gd-queue-meta">
                    {it.folderName && (
                      <span className="gd-queue-folder" title={it.folderName}>📁 {it.folderName}</span>
                    )}
                    {it.fileId ? (
                      <code className="gd-queue-id">📎 {it.fileId.slice(0, 12)}...</code>
                    ) : (
                      <span className="gd-queue-warn">⚠ Không phát hiện file ID</span>
                    )}
                    {it.status === 'downloading' && it.percent && (
                      <span className="gd-queue-progress">
                        {it.percent} {it.speed && `· ${it.speed}`} {it.eta && `· ETA ${it.eta}`}
                      </span>
                    )}
                    {it.status === 'done' && it.outPath && (
                      <code className="gd-queue-out" title={it.outPath}>
                        💾 {it.outPath.split(/[\\/]/).slice(-2).join('/')}
                      </code>
                    )}
                    {it.status === 'error' && it.error && (
                      <span className="gd-queue-err">✗ {it.error}</span>
                    )}
                  </div>
                  {it.status === 'downloading' && (
                    <div className="gd-queue-bar">
                      <div
                        className="gd-queue-bar-fill"
                        style={{ width: it.percent ?? '0%' }}
                      />
                    </div>
                  )}
                </div>
                <div className="gd-queue-status">
                  {it.status === 'pending' && <span className="gd-pill gd-pill-pending">Chờ</span>}
                  {it.status === 'downloading' && (
                    <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: '#7c3aed' }} />
                  )}
                  {it.status === 'done' && (
                    <CheckCircle2 style={{ width: 16, height: 16, color: '#10b981' }} />
                  )}
                  {it.status === 'error' && (
                    <AlertCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                  )}
                </div>
                <button
                  type="button"
                  className="gd-queue-remove"
                  onClick={() => handleRemove(it.id)}
                  disabled={it.status === 'downloading'}
                  title="Xoá khỏi hàng đợi"
                >
                  <Trash2 style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <div className="gd-empty">
          <div className="gd-empty-icon">📭</div>
          <div className="gd-empty-title">Hàng đợi trống</div>
          <div className="gd-empty-sub">Paste link Google Drive ở trên rồi bấm "Thêm vào hàng đợi".</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`gd-toast gd-toast-${toast.kind}`}>{toast.msg}</div>
      )}
    </div>
  );
}
