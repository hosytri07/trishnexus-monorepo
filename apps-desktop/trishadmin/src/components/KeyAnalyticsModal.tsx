/**
 * Phase 24.3 — KeyAnalyticsModal.
 *
 * Mở từ KeysPanel khi click 📊 trên 1 row. Load session_history theo key_id,
 * compute stats:
 *   - Total sessions, total hours, avg duration
 *   - Unique users, unique IPs, unique machines
 *   - End reason breakdown (pie chart)
 *   - Daily sessions chart (7d)
 *   - Top 10 IPs
 *   - Top 5 countries (nếu có geo data)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { listSessionHistory } from '../lib/firestore-admin.js';
import type { ActivationKey, SessionHistoryEntry } from '@trishteam/data';

interface Props {
  keyDoc: ActivationKey;
  onClose: () => void;
}

const REASON_COLOR: Record<string, string> = {
  logout: '#10B981',
  kick: '#DC2626',
  expire: '#F59E0B',
  replaced: '#6366F1',
  unknown: '#9CA3AF',
};

const REASON_LABEL: Record<string, string> = {
  logout: '👋 Logout',
  kick: '🚪 Kicked',
  expire: '⏰ Expired',
  replaced: '🔄 Replaced',
  unknown: '❓ Unknown',
};

export function KeyAnalyticsModal({ keyDoc, onClose }: Props): JSX.Element {
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await listSessionHistory(1000, { key_id: keyDoc.id });
        if (!cancelled) setHistory(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [keyDoc.id]);

  const stats = useMemo(() => {
    const total = history.length;
    const totalMs = history.reduce((s, e) => s + (e.duration_ms ?? 0), 0);
    const totalHours = Math.round((totalMs / 3600000) * 10) / 10;
    const avgMin = total > 0 ? Math.round(totalMs / total / 60000) : 0;
    const uniqueUsers = new Set(history.map((e) => e.uid).filter(Boolean)).size;
    const uniqueIps = new Set(history.map((e) => e.ip_address).filter(Boolean)).size;
    const uniqueMachines = new Set(history.map((e) => e.machine_id).filter(Boolean)).size;
    return { total, totalHours, avgMin, uniqueUsers, uniqueIps, uniqueMachines };
  }, [history]);

  const reasonData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of history) {
      map[e.end_reason] = (map[e.end_reason] ?? 0) + 1;
    }
    return Object.entries(map).map(([reason, count]) => ({
      name: REASON_LABEL[reason] ?? reason,
      value: count,
      color: REASON_COLOR[reason] ?? '#9CA3AF',
    }));
  }, [history]);

  const dailyData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      buckets[key] = 0;
    }
    for (const e of history) {
      if (e.ended_at < sevenDaysAgo) continue;
      const d = new Date(e.ended_at);
      const key = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }, [history]);

  const topIps = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of history) {
      if (!e.ip_address) continue;
      map[e.ip_address] = (map[e.ip_address] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [history]);

  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <header className="modal-head">
          <h2>📊 Analytics — <code>{keyDoc.code}</code></h2>
          <button className="mini" onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#6B7280' }}>
              ⏳ Đang load history…
            </div>
          ) : error ? (
            <div className="error-banner">⚠ {error}</div>
          ) : history.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: '#6B7280',
                background: 'var(--bg-soft)',
                borderRadius: 8,
              }}
            >
              📭 Key này chưa có session history nào.
              <br />
              <span style={{ fontSize: 11 }}>
                Sessions được ghi khi user logout / admin kick / sweep expired.
              </span>
            </div>
          ) : (
            <>
              {/* Stat grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Stat label="Total sessions" value={stats.total} />
                <Stat label="Total hours" value={stats.totalHours} />
                <Stat label="Avg duration" value={`${stats.avgMin}m`} />
                <Stat label="Unique users" value={stats.uniqueUsers} />
                <Stat label="Unique IPs" value={stats.uniqueIps} />
                <Stat label="Unique máy" value={stats.uniqueMachines} />
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Pie chart end reasons */}
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-soft)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    Lý do kết thúc
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie
                        data={reasonData}
                        cx="50%"
                        cy="50%"
                        outerRadius={50}
                        dataKey="value"
                        label={(entry) => `${entry.value}`}
                      >
                        {reasonData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Bar chart 7 ngày */}
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-soft)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    Sessions 7 ngày qua
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 10 IPs */}
              <div
                style={{
                  padding: 12,
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  Top 10 IPs
                </div>
                <table style={{ width: '100%', fontSize: 12 }}>
                  <tbody>
                    {topIps.map((row) => (
                      <tr key={row.ip} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <code>{row.ip}</code>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6B7280' }}>
                          {row.count} sessions
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
