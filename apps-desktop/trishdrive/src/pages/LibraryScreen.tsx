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
import { getFirebaseAuth } from '@trishteam/auth';
import {
  BookOpen, Download, Folder, FileText, Search, RefreshCw,
  AlertCircle, FileQuestion, Loader2, CheckCircle2,
} from 'lucide-react';

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
  const [downloadedToken, setDownloadedToken] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

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
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items: LibraryItem[] };
      setItems(data.items || []);
    } catch (e) {
      setErr(String(e));
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

  return (
    <div className="space-y-4" style={{ maxWidth: 1100, margin: '0 auto' }}>
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
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
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
                downloaded={downloadedToken === item.token}
                onDownload={() => void downloadItem(item)}
              />
            ))}
          </div>
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
  item, busy, downloaded, onDownload,
}: {
  item: LibraryItem;
  busy: boolean;
  downloaded: boolean;
  onDownload: () => void;
}): JSX.Element {
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

      <button
        className={downloaded ? 'btn-secondary' : 'btn-primary'}
        onClick={onDownload}
        disabled={busy}
        style={{ width: '100%' }}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
          </>
        ) : downloaded ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Đã tải
          </>
        ) : (
          <>
            <Download className="h-4 w-4" /> Tải về
          </>
        )}
      </button>
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
