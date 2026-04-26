/**
 * Phase 17.2 — UserPanel dropdown.
 * Click avatar/name → dropdown menu Profile + Sign Out.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { openExternal } from '../tauri-bridge.js';

export function UserPanel(): JSX.Element {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside để đóng
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
    return undefined;
  }, [open]);

  const role = profile?.role ?? 'guest';
  const initials =
    (profile?.display_name ?? profile?.email ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?';

  async function handleSignOut(): Promise<void> {
    setOpen(false);
    if (!confirm('Đăng xuất?')) return;
    await signOut();
  }

  return (
    <div className="user-panel-wrap" ref={ref}>
      <button
        type="button"
        className="user-panel-trigger"
        onClick={() => setOpen((v) => !v)}
        title={profile?.email ?? ''}
      >
        <span className="user-avatar">{initials}</span>
        <span className="user-name">{profile?.display_name ?? profile?.email ?? '—'}</span>
        <span className={`user-role-badge role-${role}`}>
          {role === 'admin' ? 'Admin' : role === 'user' ? 'User' : 'Trial'}
        </span>
        <span className="chevron">▾</span>
      </button>

      {open && (
        <div className="user-panel-dropdown">
          <div className="user-panel-header">
            <div className="user-avatar-big">{initials}</div>
            <div>
              <div className="user-panel-name">{profile?.display_name ?? '—'}</div>
              <div className="user-panel-email muted small">{profile?.email}</div>
            </div>
          </div>

          <div className="user-panel-divider" />

          <button
            className="user-panel-item"
            onClick={() => {
              setOpen(false);
              void openExternal('https://trishteam.io.vn/profile');
            }}
          >
            <span>👤</span>
            <span>Hồ sơ trên web</span>
            <span className="muted small" style={{ marginLeft: 'auto' }}>↗</span>
          </button>

          <button
            className="user-panel-item"
            onClick={() => {
              setOpen(false);
              void openExternal('https://trishteam.io.vn/#feedback');
            }}
          >
            <span>💬</span>
            <span>Gửi góp ý</span>
            <span className="muted small" style={{ marginLeft: 'auto' }}>↗</span>
          </button>

          <div className="user-panel-divider" />

          <button
            className="user-panel-item user-panel-item-danger"
            onClick={() => void handleSignOut()}
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );
}
