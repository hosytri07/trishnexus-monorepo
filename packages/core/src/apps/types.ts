/**
 * Domain types cho TrishTEAM app catalog.
 *
 * Shape này CROSS-PLATFORM — dùng ở website, desktop launcher, Zalo Mini App.
 * Registry JSON (apps-registry.json) là single source of truth, đồng bộ với
 * repo trishnexus-launcher-registry.
 *
 * Phase 14.0 (2026-04-23): tách khỏi website/lib/apps.ts.
 */

export type AppStatus = 'released' | 'coming_soon' | 'beta';

/**
 * Mức auth cần để tải/chạy app.
 * - 'none'  = public, ai cũng tải được
 * - 'user'  = phải login account TrishTEAM
 * - 'admin' = chỉ admin (TrishAdmin)
 * - 'dev'   = chỉ dev nội bộ
 */
export type LoginRequired = 'none' | 'user' | 'admin' | 'dev';

export type Platform =
  | 'windows_x64'
  | 'windows_arm64'
  | 'macos_x64'
  | 'macos_arm64'
  | 'linux_x64'
  | 'web'
  | 'zalo_mini';

export type DownloadTarget = {
  url: string;
  sha256: string;
  installer_args: string[];
};

export type AppRegistryEntry = {
  id: string;
  name: string;
  tagline: string;
  logo_url: string;
  version: string;
  size_bytes: number;
  status: AppStatus;
  login_required: LoginRequired;
  platforms: Platform[];
  screenshots: string[];
  changelog_url: string;
  download: Partial<Record<Platform, DownloadTarget>>;
};

/**
 * Metadata bổ sung — chỉ dùng ở UI (website/zalo).
 * Desktop launcher KHÔNG cần trường này, nên giữ riêng khỏi registry.
 */
export type AppMeta = {
  release_date: string | null;
  features: string[];
  accent: string;
  icon_fallback: string;
  logo_path: string;
};

/** Entry đã merge cho UI consumption. */
export type AppForUi = AppRegistryEntry & AppMeta;

export type EcosystemInfo = {
  name: string;
  tagline: string;
  logo_url: string;
  website: string;
};

export type AppRegistry = {
  schema_version: number;
  updated_at: string;
  ecosystem: EcosystemInfo;
  apps: AppRegistryEntry[];
};
