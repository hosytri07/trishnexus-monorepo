/**
 * @trishteam/design-system - Phase 24.3 + 44.1 + 44.2.
 *
 * Side-effect: import font + theme.css. Re-exports AppShell, AppLogo, helpers.
 *
 * Phase 44.1 per-app accent overrides via <html data-app="...">:
 *   work -> #34D399 (xanh la), utilities -> #FBBF24 (vang),
 *   finance -> #2563EB (xanh duong), admin -> #F87171 (do)
 *
 * Theme: <html data-theme="light"|"dark">.
 */

import './fonts';
import './theme.css';
import './app-overlay.css';

export { AppShell, loadActiveModule } from './AppShell.js';
export { AppShellSidebar } from './AppShellSidebar.js';
export type { AppShellSidebarProps } from './AppShellSidebar.js';
export type { AppShellProps, ModuleDef } from './AppShell.js';
export { AppLogo, getAppAccentColor } from './AppLogo.js';
export type { AppShellId, AppLogoProps } from './AppLogo.js';
export { APP_LOGO_PNG_URLS } from './logos.js';
export {
  applyAppAccent,
  getCurrentAppAccent,
  APP_DISPLAY_NAMES,
  APP_TAGLINES,
  SHELL_TO_LICENSE_APP_ID,
  shellToLicenseAppId,
} from './applyAppAccent.js';

export type ThemeMode = 'light' | 'dark';

export function applyTheme(mode: ThemeMode, persistKey?: string): void {
  document.documentElement.setAttribute('data-theme', mode);
  if (persistKey) {
    try { localStorage.setItem(persistKey, mode); } catch { /* ignore */ }
  }
}

export function loadTheme(persistKey: string): ThemeMode {
  try {
    const v = localStorage.getItem(persistKey);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* ignore */ }
  return 'light';
}

// Phase 45 — Component library
export * from './components/index.js';

