/**
 * Phase 24.1 — Dashboard panel with ecosystem analytics.
 *
 * Realtime stats cards + Recharts visualizations:
 * - Users growth (30 ngày)
 * - Keys usage (stacked bar, 30 ngày)
 * - Top apps by installs
 * - Activity heatmap (peak login hours)
 * - Audit feed (last 10 actions)
 * - Role breakdown
 */

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  fetchStats,
  listUsers,
  listKeys,
  listAudit,
  listAlerts,
  type AdminStats,
  type AuditEntry,
} from '../lib/firestore-admin.js';
import type { TrishUser, ActivationKey, SecurityAlert } from '@trishteam/data';

// Phase 24.2 — Giảm chiều cao chart để dashboard compact, đỡ chiếm screen
const CHART_HEIGHT = 180;

export function DashboardPanel(): JSX.Element {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<TrishUser[]>([]);
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [s, u, k, a, al] = await Promise.all([
        fetchStats(),
        listUsers(1000),
        listKeys(1000),
        listAudit(100),
        listAlerts(50, false).catch(() => [] as SecurityAlert[]),
      ]);
      setStats(s);
      setUsers(u);
      setKeys(k);
      setAudits(a);
      setAlerts(al);
      setLastFetch(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // ============================================================
  // Users growth — 30 ngày gần nhất (by day)
  // ============================================================
  const usersGrowthData = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const dailySignups: Record<string, number> = {};

    users.forEach((u) => {
      if (u.created_at >= thirtyDaysAgo) {
        const d = new Date(u.created_at);
        const dateStr = d.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
        dailySignups[dateStr] = (dailySignups[dateStr] ?? 0) + 1;
      }
    });

    const sorted = Object.entries(dailySignups)
      .map(([date, count]) => ({ date, signups: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return sorted;
  }, [users]);

  // ============================================================
  // Keys usage — 30 ngày stacked (active + used per day)
  // ============================================================
  const keysUsageData = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const dailyStats: Record<string, { generated: number; activated: number }> = {};

    keys.forEach((k) => {
      if (k.created_at >= thirtyDaysAgo) {
        const d = new Date(k.created_at);
        const dateStr = d.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' });
        if (!dailyStats[dateStr]) dailyStats[dateStr] = { generated: 0, activated: 0 };
        dailyStats[dateStr].generated++;
        if (k.status === 'used') dailyStats[dateStr].activated++;
      }
    });

    return Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [keys]);

  // ============================================================
  // Top apps by installs (count from keys' app_id)
  // ============================================================
  const topAppsData = useMemo(() => {
    const appCounts: Record<string, number> = {};
    keys.forEach((k) => {
      const appId = String(k.app_id ?? 'unknown');
      appCounts[appId] = (appCounts[appId] ?? 0) + 1;
    });

    const APP_LABELS: Record<string, string> = {
      trishlibrary: 'TrishLibrary',
      trishdrive: 'TrishDrive',
      trishoffice: 'TrishOffice',
      trishdesign: 'TrishDesign',
      trishfinance: 'TrishFinance',
      trishiso: 'TrishISO',
      trishshortcut: 'TrishShortcut',
      trishcheck: 'TrishCheck',
      trishclean: 'TrishClean',
      trishfont: 'TrishFont',
      all: 'Bundle',
    };

    return Object.entries(appCounts)
      .map(([appId, count]) => ({
        app: APP_LABELS[appId] ?? appId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [keys]);

  // ============================================================
  // Activity heatmap — peak login hours (last 7 days)
  // ============================================================
  const activityHeatmap = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const hourCounts = new Array(24).fill(0);

    users.forEach((u) => {
      if (u.last_login_at && u.last_login_at >= sevenDaysAgo) {
        const hour = new Date(u.last_login_at).getHours();
        hourCounts[hour]++;
      }
    });

    return hourCounts.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      logins: count,
    }));
  }, [users]);

  // ============================================================
  // Audit feed — last 10 entries
  // ============================================================
  const auditFeed = audits.slice(0, 10);

  const getTextColor = () => 'var(--color-text-primary, #111827)';
  const getMutedColor = () => 'var(--color-text-muted, #6B7280)';
  const getAccentColor = () => 'var(--color-accent-primary, #10B981)';
  const getBorderColor = () => 'var(--color-border-subtle, #E5E7EB)';

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>📊 Dashboard Analytics</h1>
          <p className="muted small">
            Tổng quan hệ sinh thái TrishTEAM. Số liệu realtime từ Firestore.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? '⏳ Đang tải…' : '🔄 Refresh'}
        </button>
      </header>

      {error && (
        <div className="error-banner">
          ⚠ Lỗi: {error}
          <p className="muted small" style={{ marginTop: 4 }}>
            Có thể Firestore Security Rules đang chặn — kiểm tra rule cho admin role.
          </p>
        </div>
      )}

      {!stats && loading && (
        <div className="loading-block">
          <div className="spinner" />
          <p>Đang tải số liệu…</p>
        </div>
      )}

      {/* Phase 24.3 — Security alerts banner */}
      {alerts.length > 0 && (
        <div
          style={{
            margin: '12px 0',
            padding: '12px 16px',
            background:
              alerts.some((a) => a.severity === 'critical')
                ? 'rgba(220,38,38,0.1)'
                : 'rgba(245,158,11,0.1)',
            border:
              alerts.some((a) => a.severity === 'critical')
                ? '1px solid rgba(220,38,38,0.3)'
                : '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>
            {alerts.some((a) => a.severity === 'critical') ? '🚨' : '⚠️'}
          </span>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{alerts.length} security alerts chưa xử lý</strong>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              {alerts.filter((a) => a.severity === 'critical').length} critical,{' '}
              {alerts.filter((a) => a.severity === 'warning').length} warning,{' '}
              {alerts.filter((a) => a.severity === 'info').length} info — vào tab "Security Alerts" để xử lý.
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div style={{ paddingBottom: 24 }}>
          {/* Counters row */}
          <section className="stats-grid">
            <StatCard icon="👥" label="Tổng users" value={stats.totalUsers} accent="blue" />
            <StatCard icon="🆕" label="Đăng ký 7 ngày" value={stats.signups7d} accent="green" />
            <StatCard
              icon="🔑"
              label="Keys active"
              value={stats.activeKeys}
              accent="purple"
              hint={`${stats.usedKeys} used · ${stats.revokedKeys} revoked`}
            />
            <StatCard
              icon="📢"
              label="Broadcasts active"
              value={stats.activeBroadcasts}
              accent="orange"
            />
          </section>

          {/* Charts grid — 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
            {/* Users growth chart */}
            <div
              style={{
                background: 'var(--color-surface-card, #fff)',
                border: `1px solid ${getBorderColor()}`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: getTextColor() }}>
                👥 User Signups (30 ngày)
              </h3>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <LineChart data={usersGrowthData}>
                  <CartesianGrid stroke={getBorderColor()} />
                  <XAxis dataKey="date" stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <YAxis stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-bg, #f9fafb)' }} />
                  <Line
                    type="monotone"
                    dataKey="signups"
                    stroke={getAccentColor()}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Keys usage chart */}
            <div
              style={{
                background: 'var(--color-surface-card, #fff)',
                border: `1px solid ${getBorderColor()}`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: getTextColor() }}>
                🔑 Key Generation (30 ngày)
              </h3>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={keysUsageData}>
                  <CartesianGrid stroke={getBorderColor()} />
                  <XAxis dataKey="date" stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <YAxis stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-bg, #f9fafb)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="generated" stackId="a" fill="#3b82f6" name="Sinh keys" />
                  <Bar dataKey="activated" stackId="a" fill="#22c55e" name="Đã kích hoạt" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top apps chart */}
            <div
              style={{
                background: 'var(--color-surface-card, #fff)',
                border: `1px solid ${getBorderColor()}`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: getTextColor() }}>
                📦 Top Apps (by key count)
              </h3>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart
                  data={topAppsData}
                  layout="vertical"
                  margin={{ left: 120, right: 16, top: 5, bottom: 5 }}
                >
                  <CartesianGrid stroke={getBorderColor()} />
                  <XAxis type="number" stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <YAxis dataKey="app" type="category" stroke={getMutedColor()} style={{ fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-bg, #f9fafb)' }} />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Activity heatmap */}
            <div
              style={{
                background: 'var(--color-surface-card, #fff)',
                border: `1px solid ${getBorderColor()}`,
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: getTextColor() }}>
                ⏰ Peak Login Hours (7 ngày)
              </h3>
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={activityHeatmap}>
                  <CartesianGrid stroke={getBorderColor()} />
                  <XAxis dataKey="hour" stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <YAxis stroke={getMutedColor()} style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface-bg, #f9fafb)' }} />
                  <Bar dataKey="logins" fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Role breakdown */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>Phân loại user theo role</h2>
            <div className="role-bars">
              <RoleBar
                label="🛡 Admin"
                count={stats.byRole.admin}
                total={stats.totalUsers}
                color="#a855f7"
              />
              <RoleBar
                label="✅ User (paid)"
                count={stats.byRole.user}
                total={stats.totalUsers}
                color="#22c55e"
              />
              <RoleBar
                label="✨ Trial"
                count={stats.byRole.trial}
                total={stats.totalUsers}
                color="#f59e0b"
              />
            </div>
          </section>

          {/* Audit feed */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>📋 Lịch sử admin (10 action gần nhất)</h2>
            <div
              style={{
                background: 'var(--color-surface-card, #fff)',
                border: `1px solid ${getBorderColor()}`,
                borderRadius: 8,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {auditFeed.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: getMutedColor(), fontSize: 12 }}>
                  (Chưa có audit log)
                </div>
              ) : (
                <div>
                  {auditFeed.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${getBorderColor()}`,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: getTextColor() }}>
                          {entry.action}
                        </span>
                        <span style={{ color: getMutedColor() }}>
                          {new Date(entry.created_at).toLocaleTimeString('vi-VN')}
                        </span>
                      </div>
                      <div style={{ color: getMutedColor() }}>
                        {entry.actor_email && <strong>{entry.actor_email}</strong>}
                        {entry.target_label && (
                          <>
                            {' → '}
                            <code style={{ fontSize: 11 }}>{entry.target_label.slice(0, 30)}</code>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <footer style={{ marginTop: 24, textAlign: 'right', fontSize: 11, color: getMutedColor() }}>
            Cập nhật lần cuối: {new Date(lastFetch).toLocaleTimeString('vi-VN')}
          </footer>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  accent: 'blue' | 'green' | 'purple' | 'orange';
  hint?: string;
}

function StatCard({ icon, label, value, accent, hint }: StatCardProps): JSX.Element {
  return (
    <div className={`stat-card stat-card-${accent}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-content">
        <strong className="stat-value">{value.toLocaleString()}</strong>
        <span className="stat-label">{label}</span>
        {hint && <span className="muted small stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

interface RoleBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function RoleBar({ label, count, total, color }: RoleBarProps): JSX.Element {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="role-bar">
      <div className="role-bar-head">
        <span>{label}</span>
        <strong>
          {count.toLocaleString()} <span className="muted small">({pct}%)</span>
        </strong>
      </div>
      <div className="role-bar-track">
        <div
          className="role-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
