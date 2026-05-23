/**
 * Phase 44.1 — applyAppAccent: set `<html data-app="..." data-theme="...">`.
 *
 * Mỗi app desktop (TrishWork / TrishUtilities / TrishFinance / TrishAdmin)
 * gọi `applyAppAccent(appId)` ở main.tsx trước khi render. CSS rules trong
 * theme.css với selector `:root[data-app="..."]` sẽ override `--color-accent-*`
 * để app có accent riêng (xanh lá / tím / vàng / đỏ).
 *
 * Theme (light/dark) vẫn quản qua `data-theme` riêng — gọi `applyTheme()`.
 */

import type { AppShellId } from './AppLogo.js';

/** Set data-app attribute on <html> để CSS apply accent đúng app. */
export function applyAppAccent(appId: AppShellId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-app', appId);
}

/** Đọc data-app hiện tại (hữu ích cho debug / fallback). */
export function getCurrentAppAccent(): AppShellId | null {
  if (typeof document === 'undefined') return null;
  const v = document.documentElement.getAttribute('data-app');
  if (v === 'work' || v === 'utilities' || v === 'finance' || v === 'admin') return v;
  return null;
}

/** Tên tiếng Việt của app — dùng cho topbar/title bar. */
export const APP_DISPLAY_NAMES: Record<AppShellId, string> = {
  work:      'TrishWork',
  utilities: 'TrishUtilities',
  finance:   'TrishFinance',
  admin:     'TrishAdmin',
};

/** Mô tả ngắn từng app — dùng cho login screen / about. */
export const APP_TAGLINES: Record<AppShellId, string> = {
  work:      'Kỹ sư · Thư viện · ISO',
  utilities: 'Tiện ích · Cloud · Font',
  finance:   'Trọ · Cá nhân · Bán hàng',
  admin:     'Quản trị hệ sinh thái',
};

/**
 * Map AppShellId (UI namespace) → AppId license string (data namespace).
 * Dùng khi pass appId cho AuthGate / userHasAppAccess.
 *
 *   shellToLicenseAppId('work') === 'trishwork'
 */
export const SHELL_TO_LICENSE_APP_ID: Record<AppShellId, string> = {
  work:      'trishwork',
  utilities: 'trishutilities',
  finance:   'trishfinance',
  admin:     'trishadmin',
};

export function shellToLicenseAppId(shellId: AppShellId): string {
  return SHELL_TO_LICENSE_APP_ID[shellId];
}
