/**
 * Phase 44.1 — AppShell: shell layout chung cho 4 app TrishTEAM (Work/Utilities/Finance/Admin).
 *
 * Extract từ `apps-desktop/trishlibrary/src/AppShell.tsx` (Phase 18.1.a) — generic
 * hóa: nhận module list qua props, không hardcode tên module/icon trong shell.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [logo] AppName  [mod1][mod2][mod3]   [actions...] [⚙]    │  ← module-nav (topbar)
 *   ├──────────────────────────────────────────────────────────┤
 *   │                                                          │
 *   │                    children (active module)              │  ← module-content
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Mỗi app dùng:
 *   import { AppShell, applyAppAccent } from '@trishteam/design-system';
 *   applyAppAccent('work');
 *
 *   <AppShell
 *     appId="work"
 *     version="2.0.0"
 *     modules={[
 *       { id: 'design',  icon: '✏', label: 'Thiết kế',  shortcut: 'Ctrl+1' },
 *       { id: 'library', icon: '📚', label: 'Thư viện',  shortcut: 'Ctrl+2' },
 *       { id: 'iso',     icon: '📋', label: 'Hồ sơ ISO', shortcut: 'Ctrl+3' },
 *     ]}
 *     active={active}
 *     onActiveChange={setActive}
 *     topbarRight={<UserMenu />}
 *   >
 *     {active === 'design' && <DesignModule />}
 *     ...
 *   </AppShell>
 *
 * Keyboard shortcuts (Ctrl+1..9) auto-bind theo module index — không cần handler riêng.
 *
 * CSS classes giữ nguyên tên cũ `.module-nav` / `.module-content` để mỗi app có thể
 * override style chi tiết qua theme/styles.css riêng (vd TrishLibrary đã có sẵn).
 */

import { useEffect, type ReactNode } from 'react';
import { AppLogo, type AppShellId } from './AppLogo.js';
import { APP_DISPLAY_NAMES, applyAppAccent } from './applyAppAccent.js';

export interface ModuleDef<TId extends string = string> {
  id: TId;
  icon: string;       // emoji hoặc text 1 ký tự
  label: string;      // tiếng Việt
  shortcut?: string;  // hint hiển thị tooltip — vd 'Ctrl+1'
}

export interface AppShellProps<TId extends string = string> {
  appId: AppShellId;
  version?: string;
  /** Override tên hiển thị topbar — default: APP_DISPLAY_NAMES[appId] */
  appName?: string;
  modules: ReadonlyArray<ModuleDef<TId>>;
  active: TId;
  onActiveChange: (next: TId) => void;
  /** Khu vực bên phải topbar — đặt UserMenu, theme toggle, settings button… */
  topbarRight?: ReactNode;
  /** Module content (active module) */
  children: ReactNode;
  /** Auto-apply data-app attribute on mount (default true). */
  autoApplyAccent?: boolean;
}

const STORAGE_KEY_PREFIX = 'trishteam:appshell:active_module:';

export function AppShell<TId extends string = string>({
  appId,
  version = 'dev',
  appName,
  modules,
  active,
  onActiveChange,
  topbarRight,
  children,
  autoApplyAccent = true,
}: AppShellProps<TId>): JSX.Element {
  const displayName = appName ?? APP_DISPLAY_NAMES[appId];
  const storageKey = `${STORAGE_KEY_PREFIX}${appId}`;

  // Apply data-app accent on mount
  useEffect(() => {
    if (autoApplyAccent) applyAppAccent(appId);
  }, [appId, autoApplyAccent]);

  // Persist active module per app
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(active));
    } catch {
      /* ignore */
    }
  }, [active, storageKey]);

  // Ctrl+1..9 keyboard shortcuts (auto-bind theo index)
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (inField) return;

      // '1'..'9' → modules[0..8]
      const code = e.key;
      const idx = /^[1-9]$/.test(code) ? parseInt(code, 10) - 1 : -1;
      if (idx >= 0 && idx < modules.length) {
        e.preventDefault();
        onActiveChange(modules[idx].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modules, onActiveChange]);

  return (
    <div className="app-shell ts-app">
      <nav className="module-nav">
        <div className="module-nav-brand">
          <AppLogo appId={appId} size={32} />
          <strong style={{ marginLeft: 10 }}>{displayName}</strong>
          <span className="module-nav-version" style={{ marginLeft: 6, opacity: 0.6, fontSize: 12 }}>
            v{version}
          </span>
        </div>

        <div className="module-nav-tabs">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`module-nav-tab ${active === m.id ? 'active' : ''}`}
              onClick={() => onActiveChange(m.id)}
              title={m.shortcut ?? ''}
            >
              <span className="module-nav-icon">{m.icon}</span>
              <span className="module-nav-label">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="module-nav-spacer" />

        {topbarRight && <div className="module-nav-actions">{topbarRight}</div>}
      </nav>

      <main className="module-content">{children}</main>
    </div>
  );
}

/** Đọc active module đã lưu cho 1 app — gọi ở useState initial. */
export function loadActiveModule<TId extends string>(appId: AppShellId, fallback: TId): TId {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${appId}`);
    if (v) return v as TId;
  } catch {
    /* ignore */
  }
  return fallback;
}
