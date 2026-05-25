/**
 * Phase 46.3 — AppShellSidebar: layout chuẩn cho app có sidebar trái nhiều module.
 *
 * Khác AppShell (top-tabs) — pattern này cho app có > 5 module:
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [logo] AppName v1.0           [actions...] [user]        │  ← topbar (56px)
 *   ├──────────┬───────────────────────────────────────────────┤
 *   │ sidebar  │                                               │
 *   │ (groups) │            children (active module)           │
 *   │          │                                               │
 *   └──────────┴───────────────────────────────────────────────┘
 *
 * Dùng cho TrishAdmin (20+ panel) + TrishFinance (12+ module).
 *
 *   <AppShellSidebar
 *     appId="admin"
 *     version="2.0.0"
 *     sidebar={
 *       <AppSidebar
 *         groups={NAV_GROUPS}
 *         activeId={active}
 *         onSelect={setActive}
 *       />
 *     }
 *     topbarRight={<UserMenu />}
 *   >
 *     {active === 'users' && <UsersPanel />}
 *     ...
 *   </AppShellSidebar>
 */

import { useEffect, type ReactNode } from 'react';
import { AppLogo, type AppShellId } from './AppLogo.js';
import { APP_DISPLAY_NAMES, applyAppAccent } from './applyAppAccent.js';

export interface AppShellSidebarProps {
  appId: AppShellId;
  version?: string;
  appName?: string;
  /** Sidebar component — thường là <AppSidebar /> hoặc custom sidebar */
  sidebar: ReactNode;
  /** Right-side topbar — UserMenu, theme toggle, settings */
  topbarRight?: ReactNode;
  /** Content area — render active module/panel */
  children: ReactNode;
  /** Auto-apply data-app attribute on mount (default true) */
  autoApplyAccent?: boolean;
}

export function AppShellSidebar({
  appId,
  version = 'dev',
  appName,
  sidebar,
  topbarRight,
  children,
  autoApplyAccent = true,
}: AppShellSidebarProps): JSX.Element {
  const displayName = appName ?? APP_DISPLAY_NAMES[appId];

  useEffect(() => {
    if (autoApplyAccent) applyAppAccent(appId);
  }, [appId, autoApplyAccent]);

  return (
    <div className="app-shell-sidebar ts-app">
      <nav className="module-nav">
        <div className="module-nav-brand">
          <AppLogo appId={appId} size={32} />
          <strong style={{ marginLeft: 10 }}>{displayName}</strong>
          <span className="module-nav-version" style={{ marginLeft: 6, opacity: 0.6, fontSize: 12 }}>
            v{version}
          </span>
        </div>
        <div className="module-nav-spacer" />
        {topbarRight && <div className="module-nav-actions">{topbarRight}</div>}
      </nav>

      <div className="app-shell-body">
        <div className="app-shell-sidebar-col">{sidebar}</div>
        <main className="app-shell-content">{children}</main>
      </div>
    </div>
  );
}
