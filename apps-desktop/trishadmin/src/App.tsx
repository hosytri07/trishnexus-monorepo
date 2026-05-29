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
import { AppAccessPanel } from './components/AppAccessPanel.js';
// Phase 46.3 — AppShellSidebar layout chung topbar + sidebar
// Phase 78.12 — Dùng AdminSidebar local (collapsible + searchable) thay vì AppSidebar
import { AppShellSidebar, AppButton } from '@trishteam/design-system';
import { AdminSidebar, type AdminSidebarGroup } from './components/AdminSidebar.js';
import { KeysPanel } from './components/KeysPanel.js';
import { PromoCodesPanel } from './components/PromoCodesPanel.js';
import { ActiveSessionsPanel } from './components/ActiveSessionsPanel.js';
import { SessionHistoryPanel } from './components/SessionHistoryPanel.js';
import { AlertsPanel } from './components/AlertsPanel.js';
import { BroadcastsPanel } from './components/BroadcastsPanel.js';
import { RegistryPanel } from './components/RegistryPanel.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { ApiKeysPanel } from './components/ApiKeysPanel.js';
import { LispLibraryPanel } from './components/LispLibraryPanel.js';
import { AtgtBlocksPanel } from './components/AtgtBlocksPanel.js';
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
import { AppCatalogPanel } from './components/AppCatalogPanel.js';
import { OfficeAdminPanel } from './components/OfficeAdminPanel.js';
import { ISOAdminPanel } from './components/ISOAdminPanel.js';
import { FinanceAdminPanel } from './components/FinanceAdminPanel.js';
import { SchedulesPanel } from './components/SchedulesPanel.js';
import { DevicesPanel } from './components/DevicesPanel.js';
import { FontPacksPanel } from './components/FontPacksPanel.js';
import { getAppVersion } from './tauri-bridge.js';
import logoUrl from './assets/logo.png';

type Panel =
  | 'dashboard'
  | 'users'
  | 'app_access'
  | 'keys'
  | 'promo_codes'
  | 'sessions'
  | 'session_history'
  | 'alerts'
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
  | 'atgt_blocks'
  | 'app_catalog'
  | 'office_admin'
  | 'iso_admin'
  | 'finance_admin'
  | 'schedules'
  | 'devices'
  | 'fontpacks'
  | 'settings';

interface NavGroup {
  id: string;
  label: string;
  items: Array<{ id: Panel; label: string; keywords?: string[] }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    items: [{ id: 'dashboard', label: 'Dashboard', keywords: ['home', 'overview', 'thống kê'] }],
  },
  {
    id: 'users',
    label: 'Người dùng',
    items: [
      { id: 'users', label: 'Users', keywords: ['account', 'tài khoản'] },
      { id: 'app_access', label: '🔑 Cấp quyền App', keywords: ['permission', 'role', 'phase 44'] },
      { id: 'keys', label: 'Keys (legacy)', keywords: ['license'] },
      { id: 'promo_codes', label: '🎟 Promo Codes', keywords: ['discount', 'voucher'] },
      { id: 'sessions', label: 'Active Sessions', keywords: ['login', 'device'] },
      { id: 'session_history', label: '📜 Session History', keywords: ['log', 'lịch sử'] },
      { id: 'devices', label: '🖥 Synced Devices', keywords: ['device', 'config', 'sync', 'máy'] },
      { id: 'alerts', label: '🚨 Security Alerts', keywords: ['bảo mật', 'cảnh báo'] },
    ],
  },
  {
    id: 'content',
    label: 'Nội dung',
    items: [
      { id: 'library_curator', label: 'TrishTEAM Library', keywords: ['thư viện'] },
      { id: 'posts', label: 'Posts / News', keywords: ['bài viết', 'tin tức'] },
      { id: 'broadcasts', label: 'Broadcasts', keywords: ['thông báo', 'announcement'] },
      { id: 'database_vn', label: '🇻🇳 Database VN', keywords: ['địa danh', 'vietnam'] },
      { id: 'fontpacks', label: '🔤 Font Packs', keywords: ['font', 'pack', 'manifest', 'utilities'] },
    ],
  },
  {
    id: 'inbox',
    label: 'Inbox',
    items: [
      { id: 'feedback', label: 'Feedback', keywords: ['góp ý', 'phản hồi'] },
      { id: 'audit', label: 'Audit log', keywords: ['nhật ký'] },
    ],
  },
  {
    id: 'observe',
    label: 'Quan sát',
    items: [
      { id: 'errors', label: '🐞 Errors', keywords: ['bug', 'lỗi'] },
      { id: 'vitals', label: '📊 Vitals', keywords: ['metrics', 'performance'] },
    ],
  },
  {
    id: 'cloud',
    label: 'Cloud',
    items: [
      { id: 'drive', label: '☁ Drive Cloud Telegram', keywords: ['storage', 'lưu trữ'] },
    ],
  },
  {
    id: 'apps_manage',
    label: 'Apps quản lý',
    items: [
      { id: 'app_catalog', label: '📦 App Catalog', keywords: ['firestore', 'registry app'] },
      { id: 'office_admin', label: '🏢 Office Multi-tenant', keywords: ['tổ chức', 'tenant'] },
      { id: 'iso_admin', label: '📋 ISO Projects', keywords: ['hồ sơ', 'dự án'] },
      { id: 'finance_admin', label: '💵 Finance Telemetry', keywords: ['tài chính'] },
    ],
  },
  {
    id: 'system',
    label: 'Hệ thống',
    items: [
      { id: 'registry', label: 'Apps Registry', keywords: ['phiên bản', 'version'] },
      { id: 'bulk_import', label: '📥 Bulk Import', keywords: ['nhập', 'import'] },
      { id: 'storage', label: '☁ Storage', keywords: ['lưu trữ', 'firebase'] },
      { id: 'backup', label: '💾 Backup / Restore', keywords: ['sao lưu', 'khôi phục'] },
      { id: 'schedules', label: '⏰ Schedule Manager', keywords: ['lịch', 'cron', 'tự động', 'scheduled'] },
      { id: 'api_keys', label: '🔐 API Keys', keywords: ['token', 'secret'] },
      { id: 'lisp_library', label: '🧩 AutoLISP Library', keywords: ['autocad', 'script'] },
      { id: 'atgt_blocks', label: '🚸 ATGT Blocks', keywords: ['biển báo', 'an toàn giao thông'] },
      { id: 'settings', label: 'Cài đặt', keywords: ['config'] },
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

const THEME_KEY = 'trishadmin.theme';

function loadTheme(): 'light' | 'dark' {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function App(): JSX.Element {
  const { firebaseUser, profile } = useAuth();
  const [active, setActive] = useState<Panel>(() => loadActivePanel());
  const [version, setVersion] = useState('dev');
  // Phase 78.13.8 — theme toggle với localStorage persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = loadTheme();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', t);
    }
    return t;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

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

  // Phase 78.12 — Convert NAV_GROUPS sang AdminSidebarGroup format
  const sidebarGroups: AdminSidebarGroup[] = NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    items: g.items.map((it) => ({ id: it.id, label: it.label, keywords: it.keywords })),
  }));

  const sidebarFooter = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {(profile?.display_name ?? firebaseUser?.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.display_name ?? 'Admin'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {firebaseUser?.email}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={`Chuyển sang ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          style={{
            flex: '0 0 auto',
            padding: '6px 10px',
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 4,
            color: 'var(--color-text-primary)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <AppButton variant="ghost" size="sm" fullWidth onClick={() => void signOut()}>
          🚪 Đăng xuất
        </AppButton>
      </div>
    </div>
  );

  return (
    <AppShellSidebar
      appId="admin"
      version={version}
      sidebar={
        <AdminSidebar
          groups={sidebarGroups}
          activeId={active}
          onSelect={(id) => setActive(id as Panel)}
          width={240}
          footer={sidebarFooter}
        />
      }
    >
      <main className="admin-main">
        {active === 'dashboard' && <DashboardPanel />}
        {active === 'users' && <UsersPanel />}
        {active === 'app_access' && <AppAccessPanel />}
        {active === 'keys' && (
          <KeysPanel adminUid={firebaseUser?.uid ?? ''} />
        )}
        {active === 'promo_codes' && <PromoCodesPanel />}
        {active === 'sessions' && (
          <ActiveSessionsPanel adminUid={firebaseUser?.uid ?? ''} />
        )}
        {active === 'session_history' && (
          <SessionHistoryPanel adminUid={firebaseUser?.uid ?? ''} />
        )}
        {active === 'alerts' && (
          <AlertsPanel adminUid={firebaseUser?.uid ?? ''} />
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
        {active === 'atgt_blocks' && <AtgtBlocksPanel />}
        {active === 'app_catalog' && <AppCatalogPanel />}
        {active === 'office_admin' && <OfficeAdminPanel />}
        {active === 'iso_admin' && <ISOAdminPanel />}
        {active === 'finance_admin' && <FinanceAdminPanel />}
        {active === 'schedules' && <SchedulesPanel />}
        {active === 'devices' && <DevicesPanel />}
        {active === 'fontpacks' && <FontPacksPanel />}
        {active === 'settings' && <SettingsPanel />}
      </main>
    </AppShellSidebar>
  );
}
