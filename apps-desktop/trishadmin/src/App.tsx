/**
 * Phase 18.7.a — TrishAdmin App shell.
 *
 * Layout: sidebar trái + main content phải.
 * Sidebar nav: 5 panels.
 *   📊 Dashboard
 *   👥 Users
 *   🔑 Keys
 *   📢 Broadcasts
 *   📦 Apps Registry
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { signOut } from '@trishteam/auth';
import { DashboardPanel } from './components/DashboardPanel.js';
import { UsersPanel } from './components/UsersPanel.js';
import { KeysPanel } from './components/KeysPanel.js';
import { BroadcastsPanel } from './components/BroadcastsPanel.js';
import { RegistryPanel } from './components/RegistryPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { ApiKeysPanel } from './components/ApiKeysPanel.js';
import { LispLibraryPanel } from './components/LispLibraryPanel.js';
import { LibraryCuratorPanel } from './components/LibraryCuratorPanel.js';
import { FeedbackPanel } from './components/FeedbackPanel.js';
import { AuditPanel } from './components/AuditPanel.js';
import { PostsPanel } from './components/PostsPanel.js';
import { BackupPanel } from './components/BackupPanel.js';
import { DatabaseVnPanel } from './components/DatabaseVnPanel.js';
import { BulkImportPanel } from './components/BulkImportPanel.js';
import { StoragePanel } from './components/StoragePanel.js';
import { ErrorsPanel } from './components/ErrorsPanel.js';
import { VitalsPanel } from './components/VitalsPanel.js';
import { TrishDrivePanel } from './components/drive/DriveContainer.js';
import { getAppVersion } from './tauri-bridge.js';
import logoUrl from './assets/logo.png';

type Panel =
  | 'dashboard'
  | 'users'
  | 'keys'
  | 'library_curator'
  | 'posts'
  | 'broadcasts'
  | 'feedback'
  | 'audit'
  | 'errors'
  | 'vitals'
  | 'registry'
  | 'database_vn'
  | 'bulk_import'
  | 'backup'
  | 'storage'
  | 'drive'
  | 'api_keys'
  | 'lisp_library'
  | 'settings';

interface NavGroup {
  label: string;
  items: Array<{ id: Panel; label: string }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [{ id: 'dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Người dùng',
    items: [
      { id: 'users', label: 'Users' },
      { id: 'keys', label: 'Keys' },
    ],
  },
  {
    label: 'Nội dung',
    items: [
      { id: 'library_curator', label: 'TrishTEAM Library' },
      { id: 'posts', label: 'Posts / News' },
      { id: 'broadcasts', label: 'Broadcasts' },
      { id: 'database_vn', label: '🇻🇳 Database VN' },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { id: 'feedback', label: 'Feedback' },
      { id: 'audit', label: 'Audit log' },
    ],
  },
  {
    label: 'Quan sát',
    items: [
      { id: 'errors', label: '🐞 Errors' },
      { id: 'vitals', label: '📊 Vitals' },
    ],
  },
  {
    label: 'Cloud',
    items: [
      { id: 'drive', label: '☁ Drive Cloud Telegram' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { id: 'registry', label: 'Apps Registry' },
      { id: 'bulk_import', label: '📥 Bulk Import' },
      { id: 'storage', label: '☁ Storage' },
      { id: 'backup', label: '💾 Backup / Restore' },
      { id: 'api_keys', label: '🔐 API Keys' },
      { id: 'lisp_library', label: '🧩 AutoLISP Library' },
      { id: 'settings', label: 'Cài đặt' },
    ],
  },
];

const ALL_NAV_ITEMS: Array<{ id: Panel; label: string }> = NAV_GROUPS.flatMap(
  (g) => g.items,
);

const STORAGE_KEY = 'trishadmin.active_panel';

function loadActivePanel(): Panel {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && ALL_NAV_ITEMS.some((n) => n.id === v)) return v as Panel;
  } catch {
    /* ignore */
  }
  return 'dashboard';
}

export function App(): JSX.Element {
  const { firebaseUser, profile } = useAuth();
  const [active, setActive] = useState<Panel>(() => loadActivePanel());
  const [version, setVersion] = useState('dev');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* ignore */
    }
  }, [active]);

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  // Phase 24.1 — KHÔNG đổi html data-theme khi vào Drive. Drive panel có vars riêng
  // (--color-surface-bg light cream) hardcoded ở :root drive-theme.css, hiển thị
  // light tự nhiên. TrishAdmin sidebar GIỮ dark (vars --bg dùng :root[data-theme='dark']).
  // Đây là behavior Trí muốn: sidebar luôn dark, chỉ main panel Drive light.

  // Ctrl+1..9 quick switch (theo thứ tự ALL_NAV_ITEMS)
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (inField) return;
      const num = parseInt(e.key, 10);
      if (Number.isFinite(num) && num >= 1 && num <= ALL_NAV_ITEMS.length) {
        e.preventDefault();
        setActive(ALL_NAV_ITEMS[num - 1].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src={logoUrl} alt="TrishAdmin" className="admin-brand-logo" />
          <div>
            <strong>TrishAdmin</strong>
            <span className="muted small">v{version}</span>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <div className="admin-nav-group-label">{group.label}</div>
              {group.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`admin-nav-item ${active === n.id ? 'active' : ''}`}
                  onClick={() => setActive(n.id)}
                >
                  <span>{n.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-user">
            <div className="admin-user-avatar">
              {(profile?.display_name ?? firebaseUser?.email ?? '?')
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="admin-user-info">
              <strong>{profile?.display_name ?? 'Admin'}</strong>
              <span className="muted small">{firebaseUser?.email}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void signOut()}
            title="Đăng xuất"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {active === 'dashboard' && <DashboardPanel />}
        {active === 'users' && <UsersPanel />}
        {active === 'keys' && (
          <KeysPanel adminUid={firebaseUser?.uid ?? ''} />
        )}
        {active === 'library_curator' && <LibraryCuratorPanel />}
        {active === 'posts' && <PostsPanel />}
        {active === 'broadcasts' && (
          <BroadcastsPanel adminUid={firebaseUser?.uid ?? ''} />
        )}
        {active === 'feedback' && <FeedbackPanel />}
        {active === 'audit' && <AuditPanel />}
        {active === 'errors' && <ErrorsPanel />}
        {active === 'vitals' && <VitalsPanel />}
        {active === 'registry' && <RegistryPanel />}
        {active === 'database_vn' && <DatabaseVnPanel />}
        {active === 'bulk_import' && <BulkImportPanel />}
        {active === 'storage' && <StoragePanel />}
        {active === 'drive' && <TrishDrivePanel />}
        {active === 'backup' && <BackupPanel />}
        {active === 'api_keys' && <ApiKeysPanel />}
        {active === 'lisp_library' && <LispLibraryPanel />}
        {active === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}
