/**
 * TrishOffice — Top Header bar (Phase 38.8).
 *
 * Layout: [logo + tên app] ··· [theme toggle · settings · user info · logout]
 *
 * Đồng bộ với @trishteam/design-system (Plus Jakarta Sans, emerald, light/dark).
 */

import { Sun, Moon, Settings as SettingsIcon, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/types';
import { NotificationBell } from './NotificationBell';
import logoUrl from '../assets/logo.png';
import type { ModuleKey } from '../auth/types';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onNavigate?: (page: ModuleKey) => void;
  /** App version (từ Tauri) */
  appVersion?: string;
}

export function Header({
  theme,
  onToggleTheme,
  onOpenSettings,
  onNavigate,
  appVersion,
}: HeaderProps): JSX.Element {
  const auth = useAuth();
  const me = auth.currentUser;

  return (
    <header className="app-topbar">
      <div className="app-topbar-left">
        <img src={logoUrl} alt="TrishOffice" className="app-topbar-logo" />
        <span>TrishOffice</span>
        {appVersion && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted, #9ca3af)',
              fontWeight: 500,
              marginLeft: 4,
            }}
          >
            v{appVersion}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted, #9ca3af)',
            fontWeight: 500,
            marginLeft: 8,
            padding: '2px 8px',
            background: 'var(--color-surface-row, #f3f4f6)',
            borderRadius: 4,
          }}
        >
          HRM/ERP-light
        </span>
      </div>

      <div className="app-topbar-actions">
        <button
          type="button"
          className="app-topbar-icon-btn"
          onClick={onToggleTheme}
          title={theme === 'light' ? 'Chuyển sang dark mode' : 'Chuyển sang light mode'}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <NotificationBell onNavigate={onNavigate} />

        <button
          type="button"
          className="app-topbar-icon-btn"
          onClick={onOpenSettings}
          title="Cài đặt cá nhân"
        >
          <SettingsIcon size={15} />
        </button>

        {me && (
          <div className="app-topbar-user">
            <div className="app-topbar-avatar">
              {(me.display_name || me.username).charAt(0).toUpperCase()}
            </div>
            <div className="app-topbar-user-info">
              <span className="app-topbar-user-name">{me.display_name}</span>
              <span className="app-topbar-user-role">
                <Shield size={9} style={{ display: 'inline', verticalAlign: -1 }} />{' '}
                {ROLES[me.role].label}
              </span>
            </div>
          </div>
        )}

        {me && (
          <button
            type="button"
            className="app-topbar-icon-btn"
            onClick={() => {
              if (confirm('Đăng xuất khỏi TrishOffice?')) auth.logout();
            }}
            title="Đăng xuất"
            style={{ color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  );
}
