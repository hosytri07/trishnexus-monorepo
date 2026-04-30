/**
 * TrishteamModule — Phase 24.2
 *
 * Public view "Thư viện TrishTEAM" trong TrishLibrary 3.0.
 * Fetch /api/drive/library/list (Bearer Firebase ID token) + render grid.
 * Click file → openUrl browser tới `trishteam.io.vn/s/{code}` — browser auto-tải
 * qua share page (decrypt + verify SHA256 client-side, hoặc TrishDrive User app
 * standalone nếu user đã cài).
 */

import { useEffect, useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getFirebaseAuth } from '@trishteam/auth';

const SHARE_API_BASE = 'https://trishteam.io.vn';

interface LibraryItem {
  token: string;
  file_name: string;
  file_size_bytes: number;
  folder_label: string | null;
  created_at: number;
  url: string;
  short_url: string | null;
}

export function TrishteamModule(): JSX.Element {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần đăng nhập Firebase');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        if (text.trim().startsWith('<')) {
          throw new Error('Endpoint chưa deploy lên Vercel — admin cần git push.');
        }
        try {
          const j = JSON.parse(text);
          throw new Error(j.error || `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}`);
        }
      }
      const data = (await res.json()) as { items: LibraryItem[] };
      setItems(data.items || []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const folders = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      const k = i.folder_label || '_root';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [items]);

  const filtered = useMemo(() => {
    let f = items;
    if (activeFolder === '_root') f = f.filter(i => !i.folder_label);
    else if (activeFolder) f = f.filter(i => i.folder_label === activeFolder);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(i => i.file_name.toLowerCase().includes(q));
    }
    return f;
  }, [items, search, activeFolder]);

  async function openFile(item: LibraryItem) {
    try {
      // Open share URL in browser → browser xử lý decrypt + tải qua share page
      const url = item.short_url || item.url;
      await openUrl(url);
    } catch (e) {
      setErr(`Mở browser fail: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>📚 Thư viện TrishTEAM</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
          {items.length} file public do admin TrishTEAM curate (TCVN, định mức, biểu mẫu, tài liệu kỹ thuật).
          Click file → mở browser tự tải. Cài TrishDrive User app để tải native.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Tìm file theo tên..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-soft)',
            color: 'var(--fg)', fontSize: 13,
          }}
        />
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-soft)',
            color: 'var(--fg)', fontSize: 13, cursor: 'pointer',
          }}
        >
          {loading ? 'Đang tải...' : '🔄 Reload'}
        </button>
      </div>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <FolderTab label="📂 Tất cả" count={items.length} active={!activeFolder} onClick={() => setActiveFolder('')} />
          {folders.map(([id, count]) => (
            <FolderTab
              key={id}
              label={id === '_root' ? '📁 Chưa phân loại' : `📁 ${id}`}
              count={count}
              active={activeFolder === id}
              onClick={() => setActiveFolder(id)}
            />
          ))}
        </div>
      )}

      {err && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#dc2626', fontSize: 13,
        }}>
          ⚠ {err}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
          {search || activeFolder ? 'Không tìm thấy' : 'Thư viện trống — admin chưa public file nào'}
        </div>
      ) : (
        <div style={{
          display: 'grid', gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}>
          {filtered.map(item => <FileCard key={item.token} item={item} onOpen={() => openFile(item)} />)}
        </div>
      )}
    </div>
  );
}

function FolderTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        background: active ? 'var(--accent-soft)' : 'var(--bg-soft)',
        color: active ? 'var(--accent)' : 'var(--fg-muted)',
        border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label} ({count})
    </button>
  );
}

function FileCard({ item, onOpen }: { item: LibraryItem; onOpen: () => void }): JSX.Element {
  return (
    <div style={{
      padding: 14, borderRadius: 12, background: 'var(--bg-panel)',
      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>📄</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--fg)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={item.file_name}>
            {item.file_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            {formatBytes(item.file_size_bytes)} · {formatDate(item.created_at)}
          </div>
          {item.folder_label && (
            <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>
              📁 {item.folder_label}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onOpen}
        style={{
          padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: 'var(--accent)', color: 'white', border: 'none',
          cursor: 'pointer', width: '100%',
        }}
      >
        🔗 Mở browser tải file
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
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString('vi-VN');
}
