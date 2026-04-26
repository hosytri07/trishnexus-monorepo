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
export type AppForWebsite = AppForUi;

const REGISTRY = registry as unknown as AppRegistry;

/**
 * TrishLauncher KHÔNG có trong public/apps-registry.json (registry là
 * catalog 9 child apps mà launcher quản lý — không bao gồm chính nó).
 * Website homepage cần show launcher như 1 card → prepend entry này
 * trước 9 apps khác để mergeRegistry kết hợp với APP_META.
 *
 * URL + SHA256 sync với GitHub Release `launcher-v2.0.1`. Khi bump
 * launcher version → update 3 field: version, url, sha256.
 */
const TRISHLAUNCHER_ENTRY = {
  id: 'trishlauncher',
  name: 'TrishLauncher',
  tagline: 'Hệ sinh thái năng suất cá nhân — cài đặt và quản lý 9 ứng dụng TrishTEAM qua 1 entry',
  logo_url: 'https://trishteam.io.vn/logos/TrishLauncher/icon-256.png',
  version: '2.0.1',
  size_bytes: 5_500_000,
  status: 'released' as const,
  login_required: 'none' as const,
  platforms: ['windows_x64' as const],
  screenshots: [],
  changelog_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/launcher-v2.0.1',
  download: {
    windows_x64: {
      url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/launcher-v2.0.1/TrishLauncher_2.0.1_x64-setup.exe',
      sha256: '16657ef916ba7ad6eedf1c0ef036069e4abb1ad4a6216e60a1e145d05cf586a9',
      installer_args: [],
    },
  },
};

/** Merge registry + website meta. Apps không có meta → fallback rỗng.
 * Prepend TrishLauncher để homepage hiện đầy đủ 10 cards (launcher + 9 child apps). */
export function getAppsForWebsite(): AppForWebsite[] {
  const augmented: AppRegistry = {
    ...REGISTRY,
    apps: [TRISHLAUNCHER_ENTRY as CoreAppRegistryEntry, ...REGISTRY.apps],
  };
  return mergeRegistry(augmented, APP_META);
}

export function getAppById(id: string): AppForWebsite | null {
  return findAppById(getAppsForWebsite(), id);
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
