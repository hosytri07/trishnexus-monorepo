/**
 * Phase 50.3 — AppSettingsModal: modal Cài đặt TỔNG cho mỗi app.
 *
 * Hiển thị:
 *   - App info (tên, version)
 *   - Theme picker (Light / Dark)
 *   - User info (display_name, email, role)
 *   - Nút Đăng xuất
 *   - Slot `extras` cho cài đặt riêng từng app (vd: language, retention days)
 *
 * Khác với module settings — đây là cài đặt APP-WIDE, không phải module-level.
 *
 * Usage:
 *
 *   const [showSettings, setShowSettings] = useState(false);
 *
 *   <AppShell topbarRight={<AppTopbar onSettings={() => setShowSettings(true)} ... />}>
 *     ...
 *   </AppShell>
 *
 *   {showSettings && (
 *     <AppSettingsModal
 *       appName="TrishWork"
 *       version="2.0.0"
 *       theme={theme}
 *       onThemeChange={setTheme}
 *       onClose={() => setShowSettings(false)}
 *     />
 *   )}
 */

import { type ReactNode, useEffect } from 'react';
import { useAuth } from './react.js';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
  demo: 'Demo',
  trial: 'Trial',
  guest: 'Khách',
};

export interface AppSettingsModalProps {
  appName: string;
  version?: string;
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
  onClose: () => void;
  /** Slot cho cài đặt riêng từng app */
  extras?: ReactNode;
}

export function AppSettingsModal({
  appName,
  version = 'dev',
  theme,
  onThemeChange,
  onClose,
  extras,
}: AppSettingsModalProps): JSX.Element {
  const { firebaseUser, profile, role, signOut } = useAuth();

  // Esc → close
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const display = profile?.display_name || firebaseUser?.email || '';
  const email = firebaseUser?.email ?? '';
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,14,12,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '60px 20px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Cài đặt
            </h2>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {appName} · v{version}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 7,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Theme picker */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Giao diện
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ThemeOption active={theme === 'light'} label="Sáng" icon="☀" onClick={() => onThemeChange('light')} />
            <ThemeOption active={theme === 'dark'} label="Tối" icon="🌙" onClick={() => onThemeChange('dark')} />
          </div>
        </div>

        {/* Slot extras */}
        {extras && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            {extras}
          </div>
        )}

        {/* User info */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            Tài khoản
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Tên hiển thị</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{display}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Email</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Vai trò</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{roleLabel}</span>
          </div>
        </div>

        {/* Action: Sign out */}
        <div style={{ padding: 14 }}>
          <button
            type="button"
            onClick={() => { onClose(); void signOut(); }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 9,
              color: '#ef4444',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            🚪 Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px 12px',
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
        borderRadius: 9,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}
