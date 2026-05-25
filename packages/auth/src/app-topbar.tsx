/**
 * Phase 47.2 — AppTopbar: panel actions chuẩn cho topbar 4 app.
 *
 * Hiển thị (từ trái qua phải):
 *   [extras (slot)] [Theme toggle] [Settings] [User panel: avatar + name + role badge] [Đăng xuất]
 *
 * Khác `<UserMenu />` — UserMenu chỉ là avatar tròn + dropdown.
 * AppTopbar render FULL panel luôn hiển thị (avatar + name + role badge + actions).
 *
 * Usage:
 *
 *   <AppShell topbarRight={
 *     <AppTopbar
 *       theme={theme}
 *       onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
 *       onSettings={() => setShowSettings(true)}
 *     />
 *   }>
 */

import { type ReactNode } from 'react';
import { useAuth } from './react.js';
import type { UserRole } from '@trishteam/data';

const ROLE_LABEL: Record<UserRole | 'guest', string> = {
  admin: 'Admin',
  user: 'User',
  demo: 'Demo',
  trial: 'Trial',
  guest: 'Khách',
};

const ROLE_BG: Record<UserRole | 'guest', string> = {
  admin: 'rgba(239,68,68,0.15)',
  user: 'var(--color-accent-soft)',
  demo: 'rgba(245,158,11,0.15)',
  trial: 'rgba(156,163,175,0.18)',
  guest: 'rgba(156,163,175,0.18)',
};

const ROLE_COLOR: Record<UserRole | 'guest', string> = {
  admin: '#dc2626',
  user: 'var(--color-accent-primary)',
  demo: '#d97706',
  trial: '#6b7280',
  guest: '#6b7280',
};

export interface AppTopbarProps {
  /** Slot trước Theme toggle — ví dụ chuông thông báo */
  extras?: ReactNode;
  /** Theme hiện tại — nếu undefined thì không render nút theme */
  theme?: 'light' | 'dark';
  /** Handler khi click theme toggle */
  onThemeToggle?: () => void;
  /** Handler khi click Cài đặt — nếu undefined thì không render nút Cài đặt */
  onSettings?: () => void;
  /** Có hiển thị nút Đăng xuất không (default true) */
  showSignOut?: boolean;
}

export function AppTopbar({
  extras,
  theme,
  onThemeToggle,
  onSettings,
  showSignOut = true,
}: AppTopbarProps): JSX.Element | null {
  const { firebaseUser, profile, role, signOut } = useAuth();
  if (!firebaseUser) return null;

  const display = profile?.display_name || firebaseUser.email || '?';
  const initial = display.charAt(0).toUpperCase();
  const email = firebaseUser.email ?? '';
  const roleBg = ROLE_BG[role];
  const roleColor = ROLE_COLOR[role];
  const roleLabel = ROLE_LABEL[role];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {extras}

      {theme && onThemeToggle && (
        <button
          type="button"
          onClick={onThemeToggle}
          title="Đổi giao diện"
          aria-label="Đổi giao diện"
          style={iconBtnStyle}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      )}

      {onSettings && (
        <button
          type="button"
          onClick={onSettings}
          title="Cài đặt"
          aria-label="Cài đặt"
          style={iconBtnStyle}
        >
          <CogIcon />
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 9,
          padding: '4px 10px 4px 5px',
        }}
        title={email}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'var(--color-accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 140,
            }}
          >
            {display}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              background: roleBg,
              color: roleColor,
              flexShrink: 0,
            }}
            title={`Vai trò: ${roleLabel}`}
          >
            {roleLabel}
          </span>
        </div>
      </div>

      {showSignOut && (
        <button
          type="button"
          onClick={() => void signOut()}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          style={{
            ...iconBtnStyle,
            color: '#ef4444',
            borderColor: 'rgba(239,68,68,0.4)',
          }}
        >
          <LogoutIcon />
        </button>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: 7,
  color: 'var(--color-text-secondary, #4b5563)',
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  transition: 'background 120ms, border-color 120ms, color 120ms',
};

function MoonIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function CogIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
