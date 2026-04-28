/**
 * Phase 18.8.a — Audit log viewer.
 *
 * Read-only list audit/{id}. Filter by action type + date.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  type AuditEntry,
  formatRelative,
  formatTimestamp,
  listAudit,
} from '../lib/firestore-admin.js';

const ACTION_LABEL: Record<string, { label: string; color: string }> = {
  'user.set_role': { label: 'Đổi role', color: '#a855f7' },
  'user.reset_trial': { label: 'Reset trial', color: '#f59e0b' },
  'user.delete_doc': { label: 'Xóa user', color: '#ef4444' },
  'key.create_batch': { label: 'Sinh keys', color: '#22c55e' },
  'key.revoke': { label: 'Revoke key', color: '#f59e0b' },
  'key.delete': { label: 'Xóa key', color: '#ef4444' },
  'broadcast.create': { label: 'Tạo broadcast', color: '#3b82f6' },
  'broadcast.activate': { label: 'Bật broadcast', color: '#22c55e' },
  'broadcast.deactivate': { label: 'Tắt broadcast', color: '#9aa0b4' },
  'broadcast.delete': { label: 'Xóa broadcast', color: '#ef4444' },
};

function actionMeta(action: string): { label: string; color: string } {
  return ACTION_LABEL[action] ?? { label: action, color: '#9aa0b4' };
}

export function AuditPanel(): JSX.Element {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listAudit(500);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const allActions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.action));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (!q) return true;
      return (
        e.action.toLowerCase().includes(q) ||
        (e.actor_email ?? '').toLowerCase().includes(q) ||
        (e.target_label ?? '').toLowerCase().includes(q) ||
        (e.target_id ?? '').toLowerCase().includes(q)
      );
    });
  }, [entries, actionFilter, search]);

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>Audit log</h1>
          <p className="muted small">
            Lịch sử {entries.length} action admin trong hệ sinh thái. Read-only.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '⏳' : '🔄'} Refresh
        </button>
      </header>

      <div className="filter-row">
        <input
          type="search"
          placeholder="🔍 Tìm action / actor / target…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input"
        >
          <option value="all">Tất cả action</option>
          {allActions.map((a) => (
            <option key={a} value={a}>
              {actionMeta(a).label} ({a})
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Khi</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted small" style={{ textAlign: 'center', padding: 24 }}>
                  {loading ? 'Đang tải…' : '(Không có entry)'}
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const meta = actionMeta(e.action);
                return (
                  <tr key={e.id}>
                    <td title={formatTimestamp(e.created_at)}>
                      <span className="muted small">{formatRelative(e.created_at)}</span>
                    </td>
                    <td>
                      <span
                        className="audit-badge"
                        style={{
                          background: `${meta.color}1a`,
                          color: meta.color,
                          border: `1px solid ${meta.color}40`,
                        }}
                      >
                        {meta.label}
                      </span>
                      <span className="muted small" style={{ display: 'block', fontSize: 10 }}>
                        {e.action}
                      </span>
                    </td>
                    <td>
                      <strong className="small">{e.actor_email ?? '—'}</strong>
                      <span className="muted small" style={{ display: 'block' }}>
                        <code>{(e.actor_uid ?? '').slice(0, 10)}…</code>
                      </span>
                    </td>
                    <td>
                      {e.target_label ? (
                        <strong className="small">{e.target_label}</strong>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                      {e.target_type && (
                        <span className="muted small" style={{ display: 'block' }}>
                          {e.target_type}
                          {e.target_id && ` · ${e.target_id.slice(0, 10)}…`}
                        </span>
                      )}
                    </td>
                    <td>
                      {e.details ? (
                        <code className="audit-details">
                          {JSON.stringify(e.details, null, 0).slice(0, 80)}
                          {JSON.stringify(e.details).length > 80 && '…'}
                        </code>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
