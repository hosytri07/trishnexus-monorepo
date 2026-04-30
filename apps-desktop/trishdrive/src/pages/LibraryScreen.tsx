/**
 * LibraryScreen — Phase 26.1.E.2
 *
 * Browse Thư viện TrishTEAM (file public do admin curate).
 * Server-side fetch qua /api/drive/library/list (server filter is_public=true,
 * Firestore rules vẫn deny direct client read cho an toàn).
 *
 * Click file → save dialog chọn dest → share_paste_and_download (Rust handle
 * decrypt + verify SHA256 + insert history).
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { openPath } from '@tauri-apps/plugin-opener';
import { getFirebaseAuth } from '@trishteam/auth';
import {
  BookOpen, Download, Folder, FileText, Search, RefreshCw,
  AlertCircle, FileQuestion, Loader2, CheckCircle2, Eye, Send, X, Bell, MessageSquare,
} from 'lucide-react';
import { loadSubscribedFolders } from './SettingsModal';
import { CommentModal } from './CommentModal';

const KEY_KNOWN_FOLDERS = 'trishdrive_known_folders';

interface LibraryItem {
  token: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256_hex: string;
  folder_label: string | null;
  created_at: number;
  url: string;
  short_url: string | null;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
}

const SHARE_API_BASE = 'https://trishteam.io.vn';

export function LibraryScreen(): JSX.Element {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>(''); // '' = all
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [downloadedToken, setDownloadedToken] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [commentItem, setCommentItem] = useState<LibraryItem | null>(null);

  useEffect(() => { void load(); }, []);

  // Phase 26.6 — auto-refresh mỗi 60s, toast khi có file mới
  const [lastSeenCount, setLastSeenCount] = useState<number | null>(null);
  const [toastNewCount, setToastNewCount] = useState<number>(0);
  // Phase 26.4.A — toast highlight nếu folder mới khớp subscribed
  const [toastFolderHits, setToastFolderHits] = useState<string[]>([]);
  const [lastTokens, setLastTokens] = useState<Set<string> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadSilent();
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSilent() {
    // Refresh nhẹ không show loading spinner. Diff item tokens để detect file mới.
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { items: LibraryItem[] };
      const newItems = data.items || [];
      const newTokens = new Set(newItems.map(i => i.token));

      if (lastTokens && newItems.length > 0) {
        // Phase 26.4.A — detect file mới + check subscribed folder
        const subscribed = loadSubscribedFolders();
        const newlyAdded = newItems.filter(i => !lastTokens.has(i.token));
        if (newlyAdded.length > 0) {
          setToastNewCount(prev => prev + newlyAdded.length);
          // Highlight folder hits
          const folderHits = newlyAdded
            .map(i => i.folder_label)
            .filter((f): f is string => !!f && subscribed.includes(f));
          if (folderHits.length > 0) {
            setToastFolderHits(Array.from(new Set(folderHits)));
          }
          setTimeout(() => { setToastNewCount(0); setToastFolderHits([]); }, 10000);

          // Phase 26.6.A — System notification (Windows toast / macOS banner)
          if ('Notification' in window && Notification.permission === 'granted') {
            const isSubscribed = folderHits.length > 0;
            const title = isSubscribed
              ? `🔔 ${newlyAdded.length} file mới trong folder bạn theo dõi!`
              : `📚 ${newlyAdded.length} file mới trong Thư viện TrishTEAM`;
            const body = isSubscribed
              ? `Folder: ${folderHits.join(', ')}\n${newlyAdded.slice(0, 3).map(i => `• ${i.file_name}`).join('\n')}`
              : `${newlyAdded.slice(0, 3).map(i => `• ${i.file_name}`).join('\n')}${newlyAdded.length > 3 ? `\n+ ${newlyAdded.length - 3} file khác` : ''}`;
            try {
              const notif = new Notification(title, {
                body,
                tag: 'trishdrive-library-update',
                requireInteraction: isSubscribed, // folder subscribed: giữ notif tới khi user click
                silent: false,
              });
              notif.onclick = () => {
                // Focus app window + scroll Library top
                window.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setToastNewCount(0);
                setToastFolderHits([]);
                notif.close();
              };
            } catch { /* notification API có thể fail trên 1 số platform */ }
          }
        }
      }
      setLastTokens(newTokens);
      setLastSeenCount(newItems.length);
      setItems(newItems);

      // Update known folders cho Settings modal
      const folders = Array.from(new Set(newItems.map(i => i.folder_label).filter((f): f is string => !!f)));
      try { localStorage.setItem(KEY_KNOWN_FOLDERS, JSON.stringify(folders)); } catch { /* */ }
    } catch { /* silent fail polling */ }
  }

  // Init lastSeenCount sau load đầu tiên
  useEffect(() => {
    if (lastSeenCount === null && items.length > 0) {
      setLastSeenCount(items.length);
    }
  }, [items.length, lastSeenCount]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Cần đăng nhập Firebase để load Thư viện');
      }
      const token = await user.getIdToken();
      let res: Response;
      try {
        res = await fetch(`${SHARE_API_BASE}/api/drive/library/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (netErr) {
        // Network/CORS fail (Tauri WebView2 → trishteam.io.vn)
        throw new Error(
          `Không kết nối được ${SHARE_API_BASE}. Kiểm tra: ` +
          `(1) mạng có online không, ` +
          `(2) admin đã \`git push origin main\` để Vercel deploy /api/drive/library/list chưa? ` +
          `Chi tiết: ${(netErr as Error).message}`
        );
      }
      if (!res.ok) {
        // Detect HTML response (Vercel 404 page) vs JSON error
        const text = await res.text();
        const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
        if (res.status === 404 || isHtml) {
          throw new Error(
            `Endpoint /api/drive/library/list chưa deploy lên Vercel (HTTP ${res.status}). ` +
            `Admin cần \`git push origin main\` để Vercel build bản mới.`
          );
        }
        if (res.status === 401) {
          throw new Error('Token Firebase không hợp lệ — đăng nhập lại.');
        }
        try {
          const j = JSON.parse(text);
          throw new Error(j.error || `HTTP ${res.status}: ${text.slice(0, 200)}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
      }
      const data = JSON.parse(await res.text()) as { items: LibraryItem[] };
      const newItems = data.items || [];
      setItems(newItems);
      setLastTokens(new Set(newItems.map(i => i.token)));
      // Update known folders cho Settings modal
      const folders = Array.from(new Set(newItems.map(i => i.folder_label).filter((f): f is string => !!f)));
      try { localStorage.setItem(KEY_KNOWN_FOLDERS, JSON.stringify(folders)); } catch { /* */ }
    } catch (e) {
      setErr((e as Error).message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Folder list (group + count)
  const folders = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const key = it.folder_label || '_root';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({ id, count }));
  }, [items]);

  // Filter
  const filtered = useMemo(() => {
    let f = items;
    if (activeFolder === '_root') f = f.filter(i => !i.folder_label);
    else if (activeFolder) f = f.filter(i => i.folder_label === activeFolder);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(i => i.file_name.toLowerCase().includes(q));
    }
    return f;
  }, [items, activeFolder, search]);

  async function downloadItem(item: LibraryItem) {
    setErr(null);
    setBusyToken(item.token);
    try {
      const dest = await saveDialog({ defaultPath: item.file_name, title: `Lưu ${item.file_name}` });
      if (typeof dest !== 'string') {
        setBusyToken(null);
        return;
      }
      // share_paste_and_download Rust tự parse URL + extract key from #k=... fragment
      // Item URL có thể có fragment hoặc không (tùy admin tạo public/private password).
      await invoke('share_paste_and_download', {
        url: item.url,
        password: null,
        destPath: dest,
      });
      setDownloadedToken(item.token);
      setTimeout(() => setDownloadedToken(null), 3000);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusyToken(null);
    }
  }

  /**
   * Phase 26.3.B — Preview file qua %TEMP%/trishdrive-preview/ + OS viewer.
   * Tải file vào temp folder, sau đó gọi openPath để OS mở default viewer
   * (PDF → Edge/Acrobat, image → Photos, text → Notepad, etc.).
   * KHÔNG insert vào history (chỉ preview tạm). Auto-cleanup > 24h khi app start.
   */
  async function previewItem(item: LibraryItem) {
    setErr(null);
    setPreviewToken(item.token);
    try {
      const tempDir = await invoke<string>('get_preview_temp_dir');
      const safeName = item.file_name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200) || 'preview.bin';
      const tempPath = `${tempDir}\\${Date.now()}_${safeName}`;
      await invoke('share_paste_and_download', {
        url: item.url,
        password: null,
        destPath: tempPath,
      });
      // Mở OS default viewer
      await openPath(tempPath);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPreviewToken(null);
    }
  }

  return (
    <div className="space-y-4" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Phase 26.6 + 26.4.A — toast notification file mới (highlight nếu folder subscribed) */}
      {toastNewCount > 0 && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            padding: '12px 18px',
            background: toastFolderHits.length > 0 ? 'linear-gradient(135deg, #f59e0b, #dc2626)' : 'var(--color-accent-gradient)',
            color: 'white',
            borderRadius: 12,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer',
            animation: 'ts-spin 0.4s ease-out',
            maxWidth: 380,
          }}
          onClick={() => { setToastNewCount(0); setToastFolderHits([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          {toastFolderHits.length > 0 ? <Bell className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {toastFolderHits.length > 0
                ? `🔔 ${toastNewCount} file mới trong folder bạn theo dõi!`
                : `${toastNewCount} file mới trong Thư viện`}
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
              {toastFolderHits.length > 0
                ? `Folder: ${toastFolderHits.join(', ')} · click xem`
                : 'Click để xem · admin vừa upload'}
            </div>
          </div>
        </div>
      )}

      {showRequestModal && <RequestModal onClose={() => setShowRequestModal(false)} />}
      {commentItem && (
        <CommentModal
          fileToken={commentItem.token}
          fileName={commentItem.file_name}
          onClose={() => setCommentItem(null)}
        />
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Thư viện TrishTEAM
            </h2>
            <p className="card-subtitle">
              {items.length} file public do admin TrishTEAM curate. Click file → tải về máy (auto-decrypt + verify SHA256).
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowRequestModal(true)} title="Yêu cầu admin upload file mới">
              <Send className="h-3.5 w-3.5" /> Yêu cầu file
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
          </div>
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3" style={{ top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)' }} />
          <input
            type="search"
            placeholder="Tìm theo tên file..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Folder tabs */}
        {folders.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            <FolderTab label="📂 Tất cả" count={items.length} active={activeFolder === ''} onClick={() => setActiveFolder('')} />
            {folders.map(f => (
              <FolderTab
                key={f.id}
                label={f.id === '_root' ? '📁 Chưa phân loại' : `📁 ${f.id}`}
                count={f.count}
                active={activeFolder === f.id}
                onClick={() => setActiveFolder(f.id)}
              />
            ))}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 className="h-8 w-8 mx-auto animate-spin" />
            <div style={{ fontSize: 13, marginTop: 8 }}>Đang load Thư viện TrishTEAM...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <FileQuestion className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
              {search || activeFolder ? 'Không tìm thấy file' : 'Thư viện trống'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {search || activeFolder ? 'Đổi từ khoá hoặc bỏ filter folder' : 'Admin chưa public file nào. Liên hệ admin để được chia sẻ.'}
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {filtered.map(item => (
              <FileCard
                key={item.token}
                item={item}
                busy={busyToken === item.token}
                previewing={previewToken === item.token}
                downloaded={downloadedToken === item.token}
                onDownload={() => void downloadItem(item)}
                onPreview={() => void previewItem(item)}
                onComment={() => setCommentItem(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Phase 26.5.E.1 — Request file modal. User gửi request admin upload file mới.
 * POST /api/drive/library/request → Firestore /trishdrive/_/file_requests.
 */
function RequestModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (!fileName.trim()) {
      setErr('Tên file bắt buộc');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần đăng nhập');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/request`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: fileName.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setTimeout(onClose, 2500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--color-surface-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <Send className="h-5 w-5" /> Yêu cầu admin upload file
            </h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>
              Admin sẽ xem xét và upload nếu phù hợp. Có thể mất vài ngày.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {success ? (
          <div className="flex gap-2 items-start mt-4 p-4 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                ✓ Đã gửi yêu cầu!
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Admin sẽ liên hệ qua email khi xử lý xong. Cảm ơn bạn!
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 mt-4">
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Tên file / tài liệu cần *
                </label>
                <input
                  className="input-field"
                  style={{ marginTop: 4 }}
                  placeholder="VD: TCVN 4054:2005 Đường ô tô — Yêu cầu thiết kế"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  maxLength={200}
                  autoFocus
                  disabled={busy}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  Mô tả thêm (tùy chọn)
                </label>
                <textarea
                  className="input-field"
                  style={{ marginTop: 4, minHeight: 100, resize: 'vertical' }}
                  placeholder="Nguồn / phiên bản / lý do cần file này..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={1000}
                  disabled={busy}
                />
              </div>
            </div>

            {err && (
              <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
              <button className="btn-primary" onClick={submit} disabled={busy || !fileName.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FolderTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: '1px solid ' + (active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
        borderRadius: 8,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{count}</span>
    </button>
  );
}

function FileCard({
  item, busy, previewing, downloaded, onDownload, onPreview, onComment,
}: {
  item: LibraryItem;
  busy: boolean;
  previewing: boolean;
  downloaded: boolean;
  onDownload: () => void;
  onPreview: () => void;
  onComment: () => void;
}): JSX.Element {
  const anyBusy = busy || previewing;
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="flex items-start gap-3">
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText className="h-5 w-5" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.file_name}>
            {item.file_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {formatBytes(item.file_size_bytes)} · {formatDate(item.created_at)}
          </div>
          {item.folder_label && (
            <div style={{ fontSize: 10, color: 'var(--color-accent-primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Folder className="h-3 w-3" /> {item.folder_label}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="btn-secondary"
          onClick={onPreview}
          disabled={anyBusy}
          style={{ flex: 1, fontSize: 12, padding: '7px 10px' }}
          title="Xem trước (OS default viewer)"
        >
          {previewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          {previewing ? 'Mở...' : 'Xem'}
        </button>
        <button
          className="btn-secondary"
          onClick={onComment}
          disabled={anyBusy}
          style={{ flex: 0.7, fontSize: 12, padding: '7px 8px' }}
          title="Bình luận + đánh giá file"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        <button
          className={downloaded ? 'btn-secondary' : 'btn-primary'}
          onClick={onDownload}
          disabled={anyBusy}
          style={{ flex: 1.5, fontSize: 12, padding: '7px 10px' }}
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải...
            </>
          ) : downloaded ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã tải
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" /> Tải về
            </>
          )}
        </button>
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

function formatDate(ms: number): string {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString('vi-VN');
}
