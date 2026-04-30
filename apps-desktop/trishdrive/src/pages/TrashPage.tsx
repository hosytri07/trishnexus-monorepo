/**
 * TrashPage — Phase 22.7f
 * Thùng rác: file đã soft-delete, restore được trong 30 ngày.
 * Auto-purge file > 30 ngày khi load.
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Trash2, RotateCcw, AlertCircle, Loader2, RefreshCw, Trash } from 'lucide-react';

interface FileRow {
  id: string;
  name: string;
  size_bytes: number;
  total_chunks: number;
  deleted_at?: number | null;
  note?: string | null;
}

const RETENTION_DAYS = 30;

export function TrashPage({ uid }: { uid: string }): JSX.Element {
  const [items, setItems] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [purgedCount, setPurgedCount] = useState<number | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // Auto-purge file > 30 ngày trong trash
      const purged = await invoke<number>('file_purge_old_trash', { uid });
      if (purged > 0) setPurgedCount(purged);
      const list = await invoke<FileRow[]>('db_files_list_trashed');
      setItems(list);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  async function restore(file: FileRow) {
    setBusyId(file.id);
    try {
      await invoke('file_restore', { fileId: file.id });
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusyId(null); }
  }

  async function purge(file: FileRow) {
    if (!confirm(`Xoá VĨNH VIỄN "${file.name}"? Telegram messages + index sẽ bị xoá. KHÔNG khôi phục được.`)) return;
    setBusyId(file.id);
    try {
      await invoke('file_purge', { uid, fileId: file.id });
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusyId(null); }
  }

  async function emptyTrash() {
    if (items.length === 0) return;
    if (!confirm(`Xoá VĨNH VIỄN ${items.length} file trong thùng rác? KHÔNG khôi phục được.`)) return;
    setBulkBusy(true);
    try {
      for (const f of items) {
        await invoke('file_purge', { uid, fileId: f.id });
      }
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBulkBusy(false); }
  }

  const totalSize = useMemo(() => items.reduce((s, f) => s + f.size_bytes, 0), [items]);

  function daysUntilPurge(deletedAt: number | null | undefined): number {
    if (!deletedAt) return RETENTION_DAYS;
    const elapsed = (Date.now() - deletedAt) / (24 * 3600 * 1000);
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title flex items-center gap-2">
            <Trash className="h-5 w-5" /> Thùng rác ({items.length})
          </h2>
          <p className="card-subtitle">
            File ở đây {RETENTION_DAYS} ngày trước khi xoá vĩnh viễn. Tổng dung lượng: {formatBytes(totalSize)}.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
          {items.length > 0 && (
            <button className="btn-secondary" onClick={emptyTrash} disabled={bulkBusy} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Đổ thùng rác
            </button>
          )}
        </div>
      </div>

      {purgedCount !== null && purgedCount > 0 && (
        <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-primary)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
          <div style={{ fontSize: 12, color: 'var(--color-accent-primary)' }}>
            Đã tự động xoá vĩnh viễn {purgedCount} file đã ở thùng rác hơn {RETENTION_DAYS} ngày.
          </div>
        </div>
      )}

      {err && (
        <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          <div style={{ fontSize: 13, marginTop: 8 }}>Đang tải...</div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Trash className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
            Thùng rác trống
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            File xoá sẽ ở đây {RETENTION_DAYS} ngày trước khi xoá vĩnh viễn.
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-auto mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Đã xoá</th>
                <th>Auto-purge sau</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(f => {
                const days = daysUntilPurge(f.deleted_at);
                const urgent = days <= 3;
                return (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{f.name}</div>
                      {f.note && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>📝 {f.note}</div>}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{f.total_chunks} chunk{f.total_chunks > 1 ? 's' : ''}</div>
                    </td>
                    <td>{formatBytes(f.size_bytes)}</td>
                    <td>{f.deleted_at ? formatRelative(f.deleted_at) : '—'}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, color: urgent ? '#ef4444' : 'var(--color-text-secondary)' }}>
                        {days} ngày
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-1.5 justify-end">
                        <button className="icon-btn" title="Khôi phục" onClick={() => restore(f)} disabled={busyId === f.id}>
                          {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        </button>
                        <button className="icon-btn-danger" title="Xoá vĩnh viễn" onClick={() => purge(f)} disabled={busyId === f.id}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}
