/**
 * Domain types cho TrishTEAM app catalog.
 *
 * Shape này CROSS-PLATFORM — dùng ở website, desktop launcher, Zalo Mini App.
 * Registry JSON (apps-registry.json) là single source of truth, đồng bộ với
 * repo trishnexus-launcher-registry.
 *
 * Phase 14.0 (2026-04-23): tách khỏi website/lib/apps.ts.
 */

/**
 * Phase 19.22 — thêm 'scheduled' (đã code, chờ release_at) + 'deprecated'
 * (app gộp vào TrishLibrary, không còn release riêng).
 */
export type AppStatus =
  | 'released'
  | 'coming_soon'
  | 'beta'
  | 'scheduled'
  | 'deprecated';

/**
 * Mức auth cần để tải/chạy app.
 * - 'none'  = utility free, không cần login (TrishCheck, TrishFont, TrishLauncher,
 *             TrishClean, TrishSearch, TrishDesign — ai cũng tải/dùng được)
 * - 'trial' = login OK với role 'trial' cũng dùng được limited features
 *             (TrishLibrary — trial xem demo content, key kích hoạt mở full)
 * - 'paid'  = phải có key đã activate (TrishNote, TrishImage, TrishType — sync
 *             cloud yêu cầu user role)
 * - 'user'  = (deprecated, dùng 'paid')
 * - 'admin' = chỉ admin (TrishAdmin tools)
 * - 'dev'   = chỉ dev nội bộ
 */
export type LoginRequired =
  | 'none'
  | 'trial'
  | 'paid'
  | 'user'
  | 'admin'
  | 'dev';

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
  /** Phase 19.22 — ISO timestamp (with timezone). Chỉ status='scheduled' mới dùng. */
  release_at?: string;
  login_required: LoginRequired;
  platforms: Platform[];
  screenshots: string[];
  changelog_url: string;
  download: Partial<Record<Platform, DownloadTarget>>;

  // Phase 36.1 — Key activation metadata
  /**
   * App có cần kích hoạt key không. Default false (free).
   * Khi true, user phải nhập key 16 chars (admin cấp) để dùng.
   */
  requires_key?: boolean;
  /**
   * Loại key cần thiết:
   * - 'account':    bind vào user.uid (apps có login: Library/Drive/Design/Finance/ISO/Office)
   * - 'standalone': bind vào machine_id (apps no-login: Shortcut/Check/Clean/Font)
   * - undefined nếu requires_key = false
   */
  key_type?: 'account' | 'standalone';
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
  /**
   * Phase 19.22 / 20.2 — Default release timestamp khi entry không tự set
   * `release_at`. UI có thể fallback sang đây cho countdown chung.
   */
  release_at_default?: string;
};
