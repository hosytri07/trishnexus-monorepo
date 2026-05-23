/**
 * Dashboard — Phase 32.13
 *
 * Top widget hiển thị khi tab "Tất cả": stats tổng + top 5 dùng nhiều + last launched.
 * Concept lấy từ BrewStation (Trí gửi tham khảo).
 */

import { useMemo } from 'react';
import { Star, Zap, Clock, TrendingUp } from 'lucide-react';
import type { Shortcut, Workspace } from '../types';
import { iconUrl } from '../tauri-bridge';

interface Props {
  shortcuts: Shortcut[];
  workspaces: Workspace[];
  onLaunchShortcut: (sc: Shortcut) => void;
  onLaunchWorkspace: (ws: Workspace) => void;
}

export function Dashboard({ shortcuts, workspaces, onLaunchShortcut, onLaunchWorkspace }: Props): JSX.Element {
  const stats = useMemo(() => {
    const totalLaunches = shortcuts.reduce((sum, s) => sum + s.click_count, 0);
    const favoriteCount = shortcuts.filter((s) => s.favorite).length;
    const lastLaunched = shortcuts
      .filter((s) => s.last_used_at)
      .sort((a, b) => (b.last_used_at ?? 0) - (a.last_used_at ?? 0))[0];
    const top5 = [...shortcuts]
      .filter((s) => s.click_count > 0)
      .sort((a, b) => b.click_count - a.click_count)
      .slice(0, 5);
    return { totalLaunches, favoriteCount, lastLaunched, top5 };
  }, [shortcuts]);

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Tổng shortcut"
          value={String(shortcuts.length)}
          accent="var(--color-accent-primary)"
        />
        <StatCard
          icon={<Star size={18} fill="#f59e0b" color="#f59e0b" />}
          label="Yêu thích"
          value={String(stats.favoriteCount)}
          accent="#f59e0b"
        />
        <StatCard
          icon={<Zap size={18} fill="#a855f7" color="#a855f7" />}
          label="Workspace"
          value={String(workspaces.length)}
          accent="#a855f7"
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Tổng lượt mở"
          value={String(stats.totalLaunches)}
          accent="#3b82f6"
        />
      </div>

      {/* Top 5 dùng nhiều + last launched */}
      {(stats.top5.length > 0 || workspaces.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {stats.top5.length > 0 && (
            <div style={{
              padding: 14,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={14} style={{ color: 'var(--color-accent-primary)' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Dùng nhiều nhất
                </div>
              </div>
              {stats.top5.map((sc, idx) => (
                <div
                  key={sc.id}
                  onClick={() => onLaunchShortcut(sc)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6,
                    cursor: 'pointer', fontSize: 12,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 18, color: 'var(--color-text-muted)', fontSize: 11 }}>
                    {idx + 1}.
                  </span>
                  {sc.icon_path ? (
                    <img src={iconUrl(sc.icon_path) ?? ''} alt="" style={{ width: 18, height: 18 }} />
                  ) : (
                    <span>📱</span>
                  )}
                  <span style={{ flex: 1, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sc.name}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                    {sc.click_count} lượt
                  </span>
                </div>
              ))}
            </div>
          )}

          {workspaces.length > 0 && (
            <div style={{
              padding: 14,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Zap size={14} fill="#f59e0b" color="#f59e0b" />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Workspace launchers
                </div>
              </div>
              {workspaces.slice(0, 5).map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => onLaunchWorkspace(ws)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6,
                    cursor: 'pointer', fontSize: 12,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Zap size={14} fill="#f59e0b" color="#f59e0b" />
                  <span style={{ flex: 1, color: 'var(--color-text-primary)', fontWeight: 500 }}>
                    {ws.name}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                    {ws.shortcut_ids.length} app
                  </span>
                  {ws.global_hotkey && (
                    <kbd style={{ fontSize: 10, padding: '1px 5px', background: 'var(--color-surface-row)', borderRadius: 3, fontFamily: 'monospace' }}>
                      {ws.global_hotkey}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stats.lastLaunched && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'var(--color-surface-row)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Clock size={12} />
          <span>Lần mở gần nhất:</span>
          <strong style={{ color: 'var(--color-text-primary)' }}>{stats.lastLaunched.name}</strong>
          <span>·</span>
          <span>{formatRelativeTime(stats.lastLaunched.last_used_at!)}</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }): JSX.Element {
  return (
    <div style={{
      padding: 14,
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-border-subtle)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.04 }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s trước`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} giờ trước`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}
