/**
 * Phase 14.4.7 — UserPanel cho TrishDesign sidebar.
 *
 * Hiển thị info user + role badge + dropdown menu (logout, activate key).
 * Đặt cuối sidebar trước footer version.
 */

import { useEffect, useRef, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuth } from '@trishteam/auth/react';

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  admin: { label: '🛡 Admin', bg: 'rgba(168, 85, 247, 0.18)', color: '#c4b5fd' },
  user: { label: '✨ User', bg: 'rgba(74, 222, 128, 0.18)', color: '#86efac' },
  trial: { label: '⏳ Trial', bg: 'rgba(251, 191, 36, 0.18)', color: '#fcd34d' },
  guest: { label: '👤 Guest', bg: 'rgba(148, 163, 184, 0.18)', color: '#94a3b8' },
};

interface Props {
  collapsed?: boolean;
}

export function UserPanel({ collapsed = false }: Props): JSX.Element {
  const { profile, role, isTrial, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.guest!;
  const displayName = profile?.display_name ?? profile?.email?.split('@')[0] ?? 'User';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  async function handleOpenProfile(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/profile');
    } catch (err) {
      console.warn('[trishdesign] open profile fail', err);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (!confirm('Đăng xuất khỏi TrishDesign?')) return;
    setOpen(false);
    await signOut();
  }

  if (loading) {
    return (
      <div className="td-user-panel td-user-panel-loading">
        <span className="muted small">…</span>
      </div>
    );
  }

  return (
    <div className="td-user-panel" ref={wrapRef}>
      <button
        type="button"
        className="td-user-btn"
        onClick={() => setOpen((o) => !o)}
        title={profile?.email ?? ''}
      >
        <span className="td-user-avatar">{initials || '?'}</span>
        {!collapsed && (
          <>
            <span className="td-user-info">
              <span className="td-user-name">{displayName}</span>
              <span
                className="td-user-role"
                style={{ background: config.bg, color: config.color }}
              >
                {config.label}
              </span>
            </span>
            <span className="td-user-chevron" aria-hidden="true">
              {open ? '▾' : '▴'}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="td-user-menu">
          <div className="td-user-menu-info">
            <strong>{displayName}</strong>
            <span className="muted small">{profile?.email ?? '—'}</span>
            <span
              className="td-user-role"
              style={{ background: config.bg, color: config.color, marginTop: 6 }}
            >
              {config.label}
            </span>
          </div>
          <hr className="td-user-menu-divider" />
          {isTrial && (
            <button
              type="button"
              className="td-user-menu-item td-user-menu-primary"
              onClick={() => void handleOpenProfile()}
            >
              🔑 Kích hoạt key
            </button>
          )}
          <button
            type="button"
            className="td-user-menu-item"
            onClick={() => void handleOpenProfile()}
          >
            👤 Trang profile (web)
          </button>
          <button
            type="button"
            className="td-user-menu-item td-user-menu-danger"
            onClick={() => void handleSignOut()}
          >
            ↩ Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
