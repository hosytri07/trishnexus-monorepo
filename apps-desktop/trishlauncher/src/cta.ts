/**
 * CTA label logic — 3 state primary button:
 * - installed: "Mở" (launch app local)
 * - coming_soon: "Sắp ra mắt" (disabled)
 * - released + có download: "Tải về" (mở URL)
 * - released nhưng không support platform: "Chưa hỗ trợ máy này" (disabled)
 *
 * Tách ra file riêng để AppCard + AppDetailModal reuse, tránh circular
 * import (AppDetailModal nằm trong components/ mà App.tsx là parent).
 *
 * Phase 14.5.5.c — 2026-04-24.
 */
import type { AppForUi, Platform } from '@trishteam/core/apps';
import type { InstallDetection } from './install-types.js';

export interface CtaState {
  label: string;
  disabled: boolean;
}

export function resolveCta(
  app: AppForUi,
  platform: Platform,
  detect: InstallDetection | null,
): CtaState {
  if (detect && detect.state === 'installed') {
    return { label: 'Mở', disabled: false };
  }
  if (app.status === 'coming_soon') {
    return { label: 'Sắp ra mắt', disabled: true };
  }
  const hasDownload = Boolean(app.download[platform]?.url);
  if (!hasDownload) {
    return { label: 'Chưa hỗ trợ máy này', disabled: true };
  }
  return { label: 'Tải về', disabled: false };
}
