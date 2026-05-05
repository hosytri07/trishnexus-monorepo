/**
 * Phase 37.6 — ActiveSessionsPanel.
 *
 * Hiển thị tất cả session đang active của 11 apps (collectionGroup query).
 * Admin có thể force kick từng session — client sẽ detect mất doc qua
 * onSnapshot listener → auto logout máy đó.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActiveSessionRow,
  type ActorContext,
  kickSession,
  listActiveSessions,
} from '../lib/firestore-admin.js';
import { formatRelative, formatTimestamp } from '../lib/firestore-admin.js';

interface Props {
  adminUid: string;
}

export function ActiveSessionsPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listActiveSessions(500);
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Auto-refresh mỗi 30s để admin thấy gần real-time
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (appFilter !== 'all' && s.app_id !== appFilter) return false;
      if (!q) return true;
      return (
        s.uid?.toLowerCase().includes(q) ||
        s.machine_id?.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.key_id?.toLowerCase().includes(q) ||
        s.hostname?.toLowerCase().includes(q)
      );
    });
  }, [sessions, appFilter, search]);

  async function handleKick(s: ActiveSessionRow): Promise<void> {
    if (
      !window.confirm(
        `Force kick session?\n\nApp: ${s.app_id}\nUser: ${s.uid ?? '(standalone)'}\nMáy: ${s.machine_id}\nIP: ${s.ip_address}\n\nClient sẽ tự logout sau ~5 giây.`,
      )
    ) {
      return;
    }
    try {
      await kickSession(s.key_id, s.session_id, actor);
      setActionMsg(`✓ Đã kick session ${s.session_id.slice(0, 8)}…`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const uniqueApps = useMemo(() => {
    return Array.from(new Set(sessions.map((s) => s.app_id))).sort();
  }, [sessions]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
          🔌 Active Sessions ({filtered.length}
          {filtered.length !== sessions.length ? ` / ${sessions.length}` : ''})
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
          Phiên đang chạy của 11 apps. Auto-refresh mỗi 30 giây. Admin có thể force kick.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Search uid / machine / IP / key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 13,
          }}
        />
        <select
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 6,
            fontSize: 13,
            minWidth: 160,
          }}
        >
          <option value="all">Tất cả apps</option>
          {uniqueApps.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: '8px 16px',
            background: '#10B981',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {loading ? '⏳ Đang tải…' : '🔄 Refresh'}
        </button>
      </div>

      {actionMsg && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: 6,
            fontSize: 13,
            color: '#059669',
          }}
        >
          {actionMsg}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 10,
            marginBottom: 12,
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 6,
            fontSize: 13,
            color: '#DC2626',
          }}
        >
          ⚠ {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle, #E5E7EB)', borderRadius: 8 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-muted, #F3F4F6)' }}>
              <th style={cellHead}>App</th>
              <th style={cellHead}>User / Machine</th>
              <th style={cellHead}>IP</th>
              <th style={cellHead}>Hostname / OS</th>
              <th style={cellHead}>Bắt đầu</th>
              <th style={cellHead}>Heartbeat cuối</th>
              <th style={cellHead}>Hết hạn</th>
              <th style={cellHead}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
                  {loading ? 'Đang tải…' : 'Không có session active.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.session_id} style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}>
                  <td style={cell}>
                    <strong>{s.app_id}</strong>
                  </td>
                  <td style={cell}>
                    {s.uid ? (
                      <>
                        👤 <code>{s.uid.slice(0, 12)}…</code>
                      </>
                    ) : (
                      <>
                        🔒 <code>{s.machine_id.slice(0, 8)}…</code> (standalone)
                      </>
                    )}
                  </td>
                  <td style={cell}>
                    <code>{s.ip_address}</code>
                  </td>
                  <td style={cell}>
                    {s.hostname || '—'}
                    {s.os && (
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.os}</div>
                    )}
                  </td>
                  <td style={cell}>{formatRelative(s.started_at)}</td>
                  <td style={cell}>{formatRelative(s.last_heartbeat)}</td>
                  <td style={cell}>{formatTimestamp(s.expires_at)}</td>
                  <td style={cell}>
                    <button
                      type="button"
                      onClick={() => void handleKick(s)}
                      style={{
                        padding: '4px 10px',
                        background: '#DC2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Force kick session — client sẽ tự logout"
                    >
                      🚪 Kick
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellHead: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6B7280',
};

const cell: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  verticalAlign: 'middle',
};
