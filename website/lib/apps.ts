/**
 * lib/apps.ts — API đọc apps-registry.json + merge với website meta.
 *
 * Phase 14.0 (2026-04-23): refactor để import types + helper từ
 * `@trishteam/core/apps` — shared với desktop launcher + Zalo Mini App.
 *
 * Phase 15.0.p (2026-04-25): import từ `public/apps-registry.json` thay
 * `data/apps-registry.json` — single source of truth. Public file phục vụ
 * cả 2 mục đích:
 *   1. CDN serve tại `https://trishteam.io.vn/apps-registry.json` cho
 *      TrishLauncher desktop fetch runtime
 *   2. Build-time bundle vào website homepage qua TS import
 * Đảm bảo data luôn đồng bộ giữa launcher + website. Admin chỉ edit 1 file.
 */

import registry from '@/public/apps-registry.json';
import { APP_META } from '@/data/apps-meta';
import {
  findAppById,
  formatSize as coreFormatSize,
  getEcosystemInfo as coreGetEcosystemInfo,
  mergeRegistry,
  statusLabel as coreStatusLabel,
  type AppForUi,
  type AppRegistry,
  type AppStatus,
  type EcosystemInfo,
  type LoginRequired,
  type AppRegistryEntry as CoreAppRegistryEntry,
} from '@trishteam/core/apps';

// Re-export types để caller website cũ không phải đổi import path.
export type { AppStatus, LoginRequired, EcosystemInfo };
export type AppRegistryEntry = CoreAppRegistryEntry;
export type AppForWebsite = AppForUi & { release_at?: string };

const REGISTRY = registry as unknown as AppRegistry;

/**
 * Phase 19.22 — Update workflow:
 *   - TrishLauncher giờ ĐÃ có trong public/apps-registry.json (cùng các app khác)
 *     không cần prepend hardcode nữa.
 *   - Status mới `scheduled`: app code đã xong, release_at đặt ngày 04/05/2026.
 *     Trước thời điểm đó UI hiện countdown, sau đó tự "release" (cho tải).
 */
export function getAppsForWebsite(): AppForWebsite[] {
  const merged = mergeRegistry(REGISTRY, APP_META);
  return merged.filter((a) => a.status !== 'deprecated');
}

export function getAllAppsIncludingDeprecated(): AppForWebsite[] {
  return mergeRegistry(REGISTRY, APP_META);
}

/**
 * Check app có thể tải được chưa.
 *   - `released` → luôn available
 *   - `scheduled` → check release_at đã đến chưa
 *   - khác → false
 */
export function isReleaseAvailable(app: AppForWebsite): boolean {
  if (app.status === 'released') return true;
  if ((app.status as string) === 'scheduled') {
    const releaseAt = (app as { release_at?: string }).release_at;
    if (!releaseAt) return false;
    return Date.now() >= new Date(releaseAt).getTime();
  }
  return false;
}

/** Format thời gian còn lại đến release_at. Vd "Còn 5 ngày 12 giờ". */
export function formatCountdown(releaseAt: string | undefined | null): string {
  if (!releaseAt) return '';
  const now = Date.now();
  const target = new Date(releaseAt).getTime();
  if (isNaN(target)) return '';
  const diff = target - now;
  if (diff <= 0) return 'Đã phát hành';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `Còn ${days} ngày ${hours} giờ`;
  if (hours > 0) return `Còn ${hours} giờ ${mins} phút`;
  return `Còn ${mins} phút`;
}

/** Lấy release_at (ISO string) từ app entry. */
export function getReleaseAt(app: AppForWebsite): string | null {
  return (app as { release_at?: string }).release_at ?? null;
}

export function getAppById(id: string): AppForWebsite | null {
  return findAppById(getAllAppsIncludingDeprecated(), id);
}

export function getEcosystemInfo(): EcosystemInfo {
  return coreGetEcosystemInfo(REGISTRY);
}

/** Human-readable status label (tiếng Việt). */
export function statusLabel(status: AppStatus): string {
  return coreStatusLabel(status);
}

/** Format size bytes → MB, GB string. */
export function formatSize(bytes: number): string {
  return coreFormatSize(bytes);
}

/**
 * Format ISO date (YYYY-MM-DD) → dd/MM/yyyy tiếng Việt. null → "—".
 * Website-specific vì dùng Intl locale — không đưa vào core (core chạy
 * được cả ở Node cũ không full ICU).
 */
export function formatReleaseDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
