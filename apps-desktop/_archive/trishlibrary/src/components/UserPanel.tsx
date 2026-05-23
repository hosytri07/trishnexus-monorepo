/**
 * Phase 16.2.a — UserPanel với Firebase Auth + role badge.
 *
 * Hiện avatar + name + role chip ở topbar. Click → dropdown với:
 *   - Email
 *   - Role badge (Admin/User/Trial)
 *   - Activate key (nếu Trial) → mở web profile
 *   - Sign out
 */

import { useState, useEffect, useRef } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuth } from '@trishteam/auth/react';

interface UserPanelProps {
  trKey: (key: string, vars?: Record<string, string | number>) => string;
}

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  admin: { label: '🛡 Admin', bg: 'rgba(168, 85, 247, 0.15)', color: 'rgb(196, 124, 255)' },
  user: { label: '✨ User', bg: 'rgba(74, 222, 128, 0.15)', color: 'rgb(74, 222, 128)' },
  trial: { label: '⏳ Trial', bg: 'rgba(251, 191, 36, 0.15)', color: 'rgb(252, 211, 77)' },
  guest: { label: '👤 Khách', bg: 'rgba(148, 163, 184, 0.15)', color: 'rgb(148, 163, 184)' },
};

export function UserPanel({ trKey: _tr }: UserPanelProps): JSX.Element {
  const { profile, role, isTrial, isAdmin, signOut, loading } = useAuth();
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
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  async function handleOpenProfile(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/profile');
    } catch (err) {
      console.warn('[trishlibrary] open profile fail', err);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (!confirm('Đăng xuất khỏi TrishLibrary?')) return;
    setOpen(false);
    await signOut();
  }

  if (loading) {
    return (
      <div className="user-panel user-panel-loading">
        <span className="muted small">…</span>
      </div>
    );
  }

  return (
    <div className="user-panel" ref={wrapRef}>
      <button
        type="button"
        className="user-panel-btn"
        onClick={() => setOpen((o) => !o)}
        title={profile?.email ?? ''}
      >
        {profile?.photo_url ? (
          <img src={profile.photo_url} alt="" className="user-avatar-img" />
        ) : (
          <span className="user-avatar">{initials || '?'}</span>
        )}
        <span className="user-label">{displayName}</span>
        <span
          className="user-role-pill"
          style={{ background: config.bg, color: config.color }}
        >
          {config.label}
        </span>
        <span className="user-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="user-panel-menu">
          <div className="user-panel-row">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="user-avatar-img-large" />
            ) : (
              <span className="user-avatar-large">{initials || '?'}</span>
            )}
            <div>
              <strong>{displayName}</strong>
              <div className="muted small">{profile?.email ?? ''}</div>
              <span
                className="user-role-pill"
                style={{
                  background: config.bg,
                  color: config.color,
                  marginTop: 4,
                  display: 'inline-block',
                }}
              >
                {config.label}
              </span>
            </div>
          </div>

          <hr className="user-panel-divider" />

          {isTrial && (
            <button
              type="button"
              className="user-menu-item user-menu-item-primary"
              onClick={() => void handleOpenProfile()}
            >
              🔑 Kích hoạt key (mở Profile web)
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="user-menu-item"
              onClick={() => void openUrl('https://trishteam.io.vn/admin')}
            >
              🛡 Admin Panel (mở web)
            </button>
          )}

          <button
            type="button"
            className="user-menu-item"
            onClick={() => void handleOpenProfile()}
          >
            👤 Profile của tôi
          </button>

          <hr className="user-panel-divider" />

          <button
            type="button"
            className="user-menu-item user-menu-item-danger"
            onClick={() => void handleSignOut()}
          >
            🚪 Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
