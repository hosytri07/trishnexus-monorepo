/**
 * CTA label logic — primary button state.
 *
 * State priority (cao → thấp):
 *   1. installed + version cũ < registry → "⬆ Cập nhật v1.x.x" (download new)
 *   2. installed                         → "Mở"             (launch local)
 *   3. deprecated        → "Đã gộp vào …"   (disabled — app cũ đã merge)
 *   4. coming_soon       → "Sắp ra mắt"     (disabled)
 *   5. scheduled chưa tới release_at → "Còn N ngày" (disabled)
 *   6. scheduled đã qua release_at hoặc released + có download → "Tải về"
 *   7. không support platform → "Chưa hỗ trợ máy này" (disabled)
 *
 * Phase 14.5.5.c — 2026-04-24 (initial).
 * Phase 20.2 — 2026-04-29 (handle 'scheduled' + 'deprecated').
 * Phase 38 — version-aware update button khi installed_version < registry.
 */
import type { AppForUi, Platform } from '@trishteam/core/apps';
import type { InstallDetection } from './install-types.js';

export interface CtaState {
  label: string;
  disabled: boolean;
  /** Phase 38 — true khi user cần download lại để update version cao hơn */
  needsUpdate?: boolean;
}

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  if (isNaN(target)) return 0;
  const diff = target - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/**
 * So sánh 2 semver string ("1.0.0" vs "1.0.1") theo numeric component.
 *   Returns -1 nếu a < b, 0 nếu equal, 1 nếu a > b.
 *   Tolerant: trailing components missing coi = 0 ("1.0" = "1.0.0").
 *   Strip non-digit suffix ("1.0.0-beta" → "1.0.0").
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const parse = (v: string): number[] =>
    v
      .replace(/[^\d.]/g, '')
      .split('.')
      .map((s) => parseInt(s, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

export function resolveCta(
  app: AppForUi,
  platform: Platform,
  detect: InstallDetection | null,
): CtaState {
  if (detect && detect.state === 'installed') {
    // Phase 38 — Check version. Nếu PE FileVersion < registry → "Cập nhật"
    if (detect.installed_version && app.version) {
      const cmp = compareSemver(detect.installed_version, app.version);
      if (cmp < 0 && app.download[platform]?.url) {
        return {
          label: `⬆ Cập nhật v${app.version}`,
          disabled: false,
          needsUpdate: true,
        };
      }
    }
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
  // Phase 41.2 — External apps (đối tác/3rd party) — click → mở trang chủ trong browser
  if (app.category === 'external') {
    return { label: '🌐 Mở trang chủ', disabled: false };
  }
  if (app.category === 'utility') {
    return { label: '⬇ Tải tiện ích', disabled: false };
  }
  return { label: 'Tải về', disabled: false };
}
