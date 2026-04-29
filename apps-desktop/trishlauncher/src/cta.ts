/**
 * CTA label logic — primary button state.
 *
 * State priority (cao → thấp):
 *   1. installed         → "Mở"             (launch local)
 *   2. deprecated        → "Đã gộp vào …"   (disabled — app cũ đã merge)
 *   3. coming_soon       → "Sắp ra mắt"     (disabled)
 *   4. scheduled chưa tới release_at → "Còn N ngày" (disabled)
 *   5. scheduled đã qua release_at hoặc released + có download → "Tải về"
 *   6. không support platform → "Chưa hỗ trợ máy này" (disabled)
 *
 * Phase 14.5.5.c — 2026-04-24 (initial).
 * Phase 20.2 — 2026-04-29 (handle 'scheduled' + 'deprecated').
 */
import type { AppForUi, Platform } from '@trishteam/core/apps';
import type { InstallDetection } from './install-types.js';

export interface CtaState {
  label: string;
  disabled: boolean;
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  if (isNaN(target)) return 0;
  const diff = target - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function resolveCta(
  app: AppForUi,
  platform: Platform,
  detect: InstallDetection | null,
): CtaState {
  if (detect && detect.state === 'installed') {
    return { label: 'Mở', disabled: false };
  }
  if (app.status === 'deprecated') {
    return { label: 'Đã gộp vào TrishLibrary', disabled: true };
  }
  if (app.status === 'coming_soon') {
    return { label: 'Sắp ra mắt', disabled: true };
  }
  if (app.status === 'scheduled' && app.release_at) {
    const days = daysUntil(app.release_at);
    if (days > 0) {
      return { label: `Còn ${days} ngày`, disabled: true };
    }
    // Đã qua thời điểm release → fallthrough sang download check
  }
  const hasDownload = Boolean(app.download[platform]?.url);
  if (!hasDownload) {
    return { label: 'Chưa hỗ trợ máy này', disabled: true };
  }
  return { label: 'Tải về', disabled: false };
}
