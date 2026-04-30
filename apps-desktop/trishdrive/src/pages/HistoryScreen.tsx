/**
 * HistoryScreen — Phase 26.1.D + 26.1.F
 *
 * List file user đã tải. Search + filter + bookmark + tag + note.
 * Action: Mở folder chứa, copy SHA256, xoá khỏi history (KHÔNG xoá file disk).
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  Files, Search, Trash2, Star, Edit3, Copy, FolderOpen,
  RefreshCw, Loader2, AlertCircle, FileQuestion,
} from 'lucide-react';

interface HistoryRow {
  id: string;
  file_name: string;
  size_bytes: number;
  sha256_hex: string;
  source_url: string;
  dest_path: string | null;
  downloaded_at: number;
  tag: string | null;
  note: string | null;
  bookmarked: boolean;
}

export function HistoryScreen({ refreshTick }: { refreshTick: number }): JSX.Element {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [editing, setEditing] = useState<HistoryRow | null>(null);

  useEffect(() => { void load(); }, [refreshTick]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await invoke<HistoryRow[]>('history_list');
      setRows(r);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    let f = rows;
    if (filterBookmarked) f = f.filter(r => r.bookmarked);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(r => r.file_name.toLowerCase().includes(q)
        || (r.tag || '').toLowerCase().includes(q)
        || (r.note || '').toLowerCase().includes(q));
    }
    return f;
  }, [rows, search, filterBookmarked]);

  async function toggleBookmark(row: HistoryRow) {
    try {
      await invoke('history_update_meta', { id: row.id, bookmarked: !row.bookmarked });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  async function clearOne(row: HistoryRow) {
    if (!confirm(`Xoá "${row.file_name}" khỏi lịch sử? File trên đĩa KHÔNG bị xoá.`)) return;
    try {
      await invoke('history_clear', { id: row.id });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  async function openFolder(row: HistoryRow) {
    if (!row.dest_path) return;
    try {
      // Lấy folder từ dest_path
      const folder = row.dest_path.replace(/[\\/][^\\/]+$/, '');
      await openPath(folder);
    } catch (e) { setErr(String(e)); }
  }

  async function copySha(row: HistoryRow) {
    try {
      await navigator.clipboard.writeText(row.sha256_hex);
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Lịch sử tải ({filtered.length}/{rows.length})</h2>
            <p className="card-subtitle">File đã tải qua share link. Bookmark + tag + note để dễ tìm lại.</p>
          </div>
          <div className="flex gap-2">
            <button
              className={filterBookmarked ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFilterBookmarked(!filterBookmarked)}
              title="Chỉ hiện bookmark"
            >
              <Star className="h-3.5 w-3.5" /> {filterBookmarked ? 'Bookmark' : 'Tất cả'}
            </button>
            <button className="btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3" style={{ top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)' }} />
          <input
            type="search"
            placeholder="Tìm theo tên, tag, note..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <FileQuestion className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
              {search || filterBookmarked ? 'Không tìm thấy' : 'Chưa có file nào'}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {search || filterBookmarked ? 'Đổi từ khoá hoặc bỏ filter' : 'Vào tab "Tải" để tải file đầu tiên'}
            </div>
          </div>
        ) : (
          <div className="overflow-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Tên file</th>
                  <th>Size</th>
                  <th>Tải lúc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => void toggleBookmark(r)}
                        title={r.bookmarked ? 'Bỏ bookmark' : 'Bookmark'}
                      >
                        <Star
                          className="h-4 w-4"
                          style={{
                            fill: r.bookmarked ? 'var(--semantic-warning)' : 'transparent',
                            color: r.bookmarked ? 'var(--semantic-warning)' : 'var(--color-text-muted)',
                          }}
                        />
                      </button>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.file_name}</div>
                      {r.tag && (
                        <span className="badge badge-blue" style={{ marginTop: 2 }}>{r.tag}</span>
                      )}
                      {r.note && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>📝 {r.note}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>SHA {r.sha256_hex.slice(0, 8)}...</div>
                    </td>
                    <td>{formatBytes(r.size_bytes)}</td>
                    <td>{formatDate(r.downloaded_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-1.5 justify-end">
                        {r.dest_path && (
                          <button className="icon-btn" title="Mở folder chứa file" onClick={() => void openFolder(r)}>
                            <FolderOpen className="h-4 w-4" />
                          </button>
                        )}
                        <button className="icon-btn" title="Sửa tag/note" onClick={() => setEditing(r)}>
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button className="icon-btn" title="Copy SHA256" onClick={() => void copySha(r)}>
                          <Copy className="h-4 w-4" />
                        </button>
                        <button className="icon-btn-danger" title="Xoá khỏi lịch sử" onClick={() => void clearOne(r)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EditModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

function EditModal({ row, onClose, onSaved }: { row: HistoryRow; onClose: () => void; onSaved: () => void }): JSX.Element {
  const [tag, setTag] = useState(row.tag || '');
  const [note, setNote] = useState(row.note || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await invoke('history_update_meta', {
        id: row.id,
        tag: tag.trim() || null,
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) {
      alert(String(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--color-surface-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
        <h2 className="card-title">Sửa thông tin: {row.file_name}</h2>
        <div className="space-y-3 mt-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Tag</label>
            <input className="input-field" style={{ marginTop: 4 }} value={tag} onChange={e => setTag(e.target.value)} placeholder="VD: TCVN, định mức, dự án X" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Ghi chú</label>
            <textarea className="input-field" style={{ marginTop: 4, minHeight: 80, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder="VD: dùng cho báo cáo Q1..." />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Files className="h-4 w-4" />} Lưu
          </button>
        </div>
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
