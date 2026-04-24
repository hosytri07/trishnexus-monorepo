/**
 * lib/apps.ts — API đọc apps-registry.json + merge với website meta.
 *
 * Phase 14.0 (2026-04-23): refactor để import types + helper từ
 * `@trishteam/core/apps` — shared với desktop launcher + Zalo Mini App.
 * Callsite cũ (`getAppsForWebsite`, `statusLabel`, `formatSize`) giữ
 * nguyên API; chỉ đổi implementation.
 */

import registry from '@/data/apps-registry.json';
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

/** Merge registry + website meta. Apps không có meta → fallback rỗng. */
export function getAppsForWebsite(): AppForWebsite[] {
  return mergeRegistry(REGISTRY, APP_META);
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
