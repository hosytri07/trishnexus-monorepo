/**
 * Pure selector functions cho app catalog.
 *
 * Không side effect, không I/O — caller cung cấp registry + meta từ bên
 * ngoài (website đọc JSON qua import, desktop launcher qua fetch).
 * Phase 14.0 (2026-04-23).
 */

import type {
  AppForUi,
  AppMeta,
  AppRegistry,
  AppRegistryEntry,
  AppStatus,
  EcosystemInfo,
  LoginRequired,
  Platform,
} from './types.js';

const FALLBACK_META: AppMeta = {
  release_date: null,
  features: [],
  accent: '#667EEA',
  icon_fallback: 'Box',
  logo_path: '',
};

/**
 * Merge registry entry + UI meta. Entry không có meta → fallback rỗng (UI
 * vẫn render được, chỉ thiếu features/accent).
 */
export function mergeApp(
  entry: AppRegistryEntry,
  meta: AppMeta | undefined,
): AppForUi {
  return { ...entry, ...(meta ?? FALLBACK_META) };
}

/** Merge nguyên registry. */
export function mergeRegistry(
  registry: AppRegistry,
  metaMap: Record<string, AppMeta>,
): AppForUi[] {
  return registry.apps.map((entry) => mergeApp(entry, metaMap[entry.id]));
}

export function getEcosystemInfo(registry: AppRegistry): EcosystemInfo {
  return registry.ecosystem;
}

export function findAppById(
  apps: AppForUi[],
  id: string,
): AppForUi | null {
  return apps.find((a) => a.id === id) ?? null;
}

/** Lọc app theo status. Mặc định giữ tất cả. */
export function filterByStatus(
  apps: AppForUi[],
  statuses: AppStatus[] = ['released', 'beta', 'coming_soon'],
): AppForUi[] {
  const set = new Set(statuses);
  return apps.filter((a) => set.has(a.status));
}

/** Lọc app cài được trên platform cụ thể. */
export function filterByPlatform(
  apps: AppForUi[],
  platform: Platform,
): AppForUi[] {
  return apps.filter((a) => a.platforms.includes(platform));
}

/** Lọc app public (không cần login). */
export function filterPublic(apps: AppForUi[]): AppForUi[] {
  return apps.filter((a) => a.login_required === 'none');
}

/**
 * Label tiếng Việt cho status — centralize để website/desktop/zalo dùng
 * chung, tránh drift.
 */
export function statusLabel(status: AppStatus): string {
  switch (status) {
    case 'released':
      return 'Đã phát hành';
    case 'beta':
      return 'Beta';
    case 'coming_soon':
      return 'Sắp ra mắt';
    case 'scheduled':
      return 'Đặt lịch';
    case 'deprecated':
      return 'Đã gộp';
    default:
      return status;
  }
}

/** Label tiếng Việt cho login tier. */
export function loginRequiredLabel(kind: LoginRequired): string {
  switch (kind) {
    case 'none':
      return 'Miễn phí — không cần đăng nhập';
    case 'trial':
      return 'Cần đăng nhập TrishTEAM (trial chặn, kích hoạt key để mở full)';
    case 'paid':
      return 'Cần kích hoạt key';
    case 'user':
      return 'Cần đăng nhập';
    case 'admin':
      return 'Chỉ quản trị viên';
    case 'dev':
      return 'Chỉ nội bộ phát triển';
    default:
      return kind;
  }
}

/**
 * Compact badge cho card grid: emoji + 1-2 từ.
 * Phase 16.4 — UI badge nhỏ ở góc app card.
 *
 * Chỉ 2 nhóm: 'none' = Free, 'trial' = Cần đăng nhập (block trial).
 * Các value còn lại (paid/user/admin/dev) giữ trong type cho future
 * nhưng hiện tại không dùng trong app catalog.
 */
export function loginRequiredBadge(kind: LoginRequired): {
  emoji: string;
  label: string;
  color: 'green' | 'orange' | 'red' | 'purple' | 'gray';
} {
  switch (kind) {
    case 'none':
      return { emoji: '🆓', label: 'Miễn phí', color: 'green' };
    case 'trial':
      return { emoji: '🔑', label: 'Cần đăng nhập', color: 'orange' };
    case 'paid':
      return { emoji: '💎', label: 'Cần kích hoạt key', color: 'red' };
    case 'user':
      return { emoji: '👤', label: 'Cần đăng nhập', color: 'orange' };
    case 'admin':
      return { emoji: '👑', label: 'Quản trị viên', color: 'purple' };
    case 'dev':
      return { emoji: '🛠', label: 'Nội bộ', color: 'gray' };
    default:
      return { emoji: '❓', label: kind, color: 'gray' };
  }
}

/** Format file size "25 MB" / "1.2 GB". */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Lấy download target đầu tiên phù hợp platform hiện tại (ưu tiên list). */
export function pickDownload(
  entry: AppRegistryEntry,
  preferred: Platform[],
): { platform: Platform; target: import('./types.js').DownloadTarget } | null {
  for (const p of preferred) {
    const t = entry.download[p];
    if (t) return { platform: p, target: t };
  }
  return null;
}
