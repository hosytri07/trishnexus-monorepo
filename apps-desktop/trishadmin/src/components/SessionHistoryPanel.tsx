/**
 * Phase 24.3 — SessionHistoryPanel.
 *
 * Hiển thị history các session đã kết thúc (kick / expire / logout / replaced):
 *   - Filter theo time range (24h / 7d / 30d)
 *   - Filter theo key / uid / app
 *   - Recharts AreaChart sessions per hour (24h) hoặc per day (7d/30d)
 *   - Stat cards: tổng sessions, avg duration, top apps, top countries
 *   - Table list chi tiết
 *   - Sweep button → quét manually expired sessions từ /sessions sang /session_history
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ActorContext,
  formatRelative,
  formatTimestamp,
  listSessionHistory,
  sweepExpiredSessions,
} from '../lib/firestore-admin.js';
import type { SessionHistoryEntry } from '@trishteam/data';

interface Props {
  adminUid: string;
}

type RangeKey = '24h' | '7d' | '30d';
const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const REASON_LABEL: Record<SessionHistoryEntry['end_reason'], string> = {
  logout: '👋 Logout',
  kick: '🚪 Kicked',
  expire: '⏰ Expired',
  replaced: '🔄 Replaced',
  unknown: '❓ Unknown',
};

const REASON_COLOR: Record<SessionHistoryEntry['end_reason'], string> = {
  logout: '#10B981',
  kick: '#DC2626',
  expire: '#F59E0B',
  replaced: '#6366F1',
  unknown: '#9CA3AF',
};

export function SessionHistoryPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [entries, setEntries] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('24h');
  const [appFilter, setAppFilter] = useState('all');
  const [search, setSearch] = useState('');

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const sinceMs = Date.now() - RANGE_MS[range];
      const list = await listSessionHistory(1000, { sinceMs });
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [range]);

  async function handleSweep(): Promise<void> {
    if (
      !window.confirm(
        'Sweep expired sessions?\n\nQuét tất cả sessions có expires_at < now hoặc heartbeat > 15 phút, move sang history. An toàn để chạy bất kỳ lúc nào.',
      )
    )
      return;
    try {
      const res = await sweepExpiredSessions(actor);
      setActionMsg(
        `✓ Đã sweep ${res.swept} sessions${res.failed > 0 ? ` (${res.failed} fail)` : ''}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (appFilter !== 'all' && e.app_id !== appFilter) return false;
      if (!q) return true;
      return (
        e.key_id?.toLowerCase().includes(q) ||
        e.uid?.toLowerCase().includes(q) ||
        e.machine_id?.toLowerCase().includes(q) ||
        e.ip_address?.toLowerCase().includes(q) ||
        e.hostname?.toLowerCase().includes(q)
      );
    });
  }, [entries, appFilter, search]);

  const uniqueApps = useMemo(
    () => Array.from(new Set(entries.map((e) => e.app_id))).sort(),
    [entries],
  );

  // Chart data: bucket sessions by time interval
  const chartData = useMemo(() => {
    const bucketMs =
      range === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1h vs 1d
    const numBuckets = Math.ceil(RANGE_MS[range] / bucketMs);
    const now = Date.now();
    const buckets: { ts: number; logout: number; kick: number; expire: number; replaced: number; unknown: number }[] = [];
    for (let i = numBuckets - 1; i >= 0; i--) {
      buckets.push({
        ts: now - i * bucketMs,
        logout: 0,
        kick: 0,
        expire: 0,
        replaced: 0,
        unknown: 0,
      });
    }
    for (const e of filtered) {
      const idx = numBuckets - 1 - Math.floor((now - e.ended_at) / bucketMs);
      if (idx < 0 || idx >= buckets.length) continue;
      const reason = e.end_reason ?? 'unknown';
      buckets[idx][reason]++;
    }
    return buckets.map((b) => ({
      label:
        range === '24h'
          ? new Date(b.ts).toLocaleTimeString('vi-VN', { hour: '2-digit' })
          : new Date(b.ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      ...b,
    }));
  }, [filtered, range]);

  // Stat cards
  const stats = useMemo(() => {
    const total = filtered.length;
    const totalDuration = filtered.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0);
    const avgDurationMin =
      total > 0 ? Math.round(totalDuration / total / 60000) : 0;
    const reasonCount: Record<string, number> = {};
    for (const e of filtered) {
      reasonCount[e.end_reason] = (reasonCount[e.end_reason] ?? 0) + 1;
    }
    const uniqueUsers = new Set(filtered.map((e) => e.uid).filter(Boolean)).size;
    const uniqueIps = new Set(filtered.map((e) => e.ip_address).filter(Boolean)).size;
    return { total, avgDurationMin, reasonCount, uniqueUsers, uniqueIps };
  }, [filtered]);

  function exportCsv(): void {
    if (filtered.length === 0) {
      window.alert('Không có entry');
      return;
    }
    const rows = [
      ['Session ID', 'Key ID', 'App', 'UID', 'Machine', 'IP', 'Hostname', 'Started', 'Ended', 'Duration (min)', 'Reason'],
      ...filtered.map((e) => [
        e.session_id,
        e.key_id,
        e.app_id,
        e.uid ?? '',
        e.machine_id,
        e.ip_address,
        e.hostname ?? '',
        new Date(e.started_at).toISOString(),
        new Date(e.ended_at).toISOString(),
        Math.round(e.duration_ms / 60000).toString(),
        e.end_reason,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trishteam-session-history-${range}-${ts}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setActionMsg(`✓ Đã export ${filtered.length} entries`);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            📜 Session History ({filtered.length})
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
            Audit trail các session đã kết thúc. Tự động ghi khi admin kick hoặc admin sweep expired.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleSweep()}
            title="Sweep expired sessions sang history"
          >
            🧹 Sweep
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportCsv}>
            📊 CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </div>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['24h', '7d', '30d'] as RangeKey[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            style={{
              padding: '6px 14px',
              background: range === r ? '#10B981' : 'transparent',
              color: range === r ? '#fff' : 'var(--fg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: range === r ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {r === '24h' ? '24 giờ' : r === '7d' ? '7 ngày' : '30 ngày'}
          </button>
        ))}
        <input
          type="search"
          className="td-input"
          placeholder="🔍 Tìm key / uid / IP / machine…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        {uniqueApps.length > 0 && (
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="td-select"
            style={{ minWidth: 140 }}
          >
            <option value="all">Tất cả apps</option>
            {uniqueApps.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 12 }}>⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)} style={{ marginBottom: 12 }}>
          {actionMsg}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Tổng sessions" value={stats.total} />
        <StatCard label="Avg duration" value={`${stats.avgDurationMin} phút`} />
        <StatCard label="Unique users" value={stats.uniqueUsers} />
        <StatCard label="Unique IPs" value={stats.uniqueIps} />
        {Object.entries(stats.reasonCount).map(([reason, count]) => (
          <StatCard
            key={reason}
            label={REASON_LABEL[reason as SessionHistoryEntry['end_reason']] ?? reason}
            value={count}
            color={REASON_COLOR[reason as SessionHistoryEntry['end_reason']]}
          />
        ))}
      </div>

      {/* Timeline chart */}
      <div
        style={{
          padding: 16,
          background: 'var(--bg-soft)',
          borderRadius: 8,
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
          📈 Sessions theo {range === '24h' ? 'giờ (24h)' : range === '7d' ? 'ngày (7 ngày)' : 'ngày (30 ngày)'}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData}>
            <defs>
              {(['logout', 'kick', 'expire', 'replaced', 'unknown'] as const).map((reason) => (
                <linearGradient key={reason} id={`grad-${reason}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={REASON_COLOR[reason]} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={REASON_COLOR[reason]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {(['logout', 'kick', 'expire', 'replaced', 'unknown'] as const).map((reason) => (
              <Area
                key={reason}
                type="monotone"
                dataKey={reason}
                stackId="1"
                stroke={REASON_COLOR[reason]}
                fill={`url(#grad-${reason})`}
                name={REASON_LABEL[reason]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-soft)' }}>
              <th style={cellHead}>App</th>
              <th style={cellHead}>UID / Machine</th>
              <th style={cellHead}>IP</th>
              <th style={cellHead}>Started</th>
              <th style={cellHead}>Duration</th>
              <th style={cellHead}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
                  {loading ? 'Đang tải…' : '(Không có entry)'}
                </td>
              </tr>
            ) : (
              filtered.slice(0, 200).map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={cell}>{e.app_id}</td>
                  <td style={cell}>
                    {e.uid ? (
                      <code>👤 {e.uid.slice(0, 12)}…</code>
                    ) : (
                      <code>🔒 {e.machine_id?.slice(0, 8)}…</code>
                    )}
                  </td>
                  <td style={cell}><code>{e.ip_address}</code></td>
                  <td style={cell} title={formatTimestamp(e.started_at)}>
                    {formatRelative(e.started_at)}
                  </td>
                  <td style={cell}>
                    {Math.round((e.duration_ms ?? 0) / 60000)} phút
                  </td>
                  <td style={cell}>
                    <span
                      style={{
                        color: REASON_COLOR[e.end_reason] ?? '#6B7280',
                        fontWeight: 600,
                      }}
                    >
                      {REASON_LABEL[e.end_reason] ?? e.end_reason}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 200 && (
          <div style={{ padding: 12, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
            Hiển thị 200/{filtered.length} entries — dùng filter để thu hẹp
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--fg)' }}>{value}</div>
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
