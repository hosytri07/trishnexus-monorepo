/**
 * Phase 18.7.a — Dashboard panel.
 *
 * Stats cards + quick actions. Refresh tự động khi mount + có nút manual.
 */

import { useEffect, useState } from 'react';
import { fetchStats, type AdminStats } from '../lib/firestore-admin.js';

export function DashboardPanel(): JSX.Element {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchStats();
      setStats(s);
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

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>📊 Dashboard</h1>
          <p className="muted small">
            Tổng quan hệ sinh thái TrishTEAM. Số liệu lấy realtime từ Firestore.
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
            Có thể Firestore Security Rules đang chặn — kiểm tra rule cho admin role
            hoặc tài khoản chưa có role admin trong Firestore.
          </p>
        </div>
      )}

      {!stats && loading && (
        <div className="loading-block">
          <div className="spinner" />
          <p>Đang tải số liệu…</p>
        </div>
      )}

      {stats && (
        <>
          <section className="stats-grid">
            <StatCard icon="👥" label="Tổng users" value={stats.totalUsers} accent="blue" />
            <StatCard icon="🆕" label="Đăng ký 7 ngày" value={stats.signups7d} accent="green" />
            <StatCard
              icon="🔑"
              label="Keys active"
              value={stats.activeKeys}
              accent="purple"
              hint={`${stats.usedKeys} đã dùng · ${stats.revokedKeys} revoke`}
            />
            <StatCard
              icon="📢"
              label="Broadcasts active"
              value={stats.activeBroadcasts}
              accent="orange"
            />
          </section>

          <section className="role-breakdown">
            <h2>Phân loại user theo role</h2>
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

          <footer className="panel-foot muted small">
            Cập nhật lần cuối: {new Date(lastFetch).toLocaleTimeString('vi-VN')}
          </footer>
        </>
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
