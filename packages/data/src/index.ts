/**
 * @trishteam/data — Firebase collection paths + type-safe types.
 *
 * Phase 14.0 scaffold. Phase 16.1.c (2026-04-25) extend cho 4 roles +
 * TrishLibrary sync + activation keys + TrishTEAM curated library.
 *
 * Path strings hardcoded ở nhiều chỗ trong website hiện tại — centralize ở
 * đây để tránh drift khi thêm collection mới hoặc đổi schema.
 */

/**
 * Path helpers — chỉ trả string, dùng được ở server (Admin SDK), client
 * (Web SDK), hoặc Zalo (Firebase Web SDK).
 */
export const paths = {
  // Users
  user: (uid: string) => `users/${uid}`,
  users: () => 'users',

  // User events (audit trail per user)
  userEvent: (uid: string, eventId: string) =>
    `users/${uid}/events/${eventId}`,
  userEvents: (uid: string) => `users/${uid}/events`,

  // User notes (legacy + Phase 11.7)
  userNote: (uid: string, noteId: string) =>
    `users/${uid}/notes/${noteId}`,
  userNotes: (uid: string) => `users/${uid}/notes`,

  // Phase 16.2 — TrishLibrary per-user sync
  // 3 docs cố định: 'files', 'online_folders', 'trishteam_cache'
  // Mỗi doc chứa `items: Array` (cap ~5MB Firestore doc limit; nếu vượt
  // chia subcollection items/{itemId}).
  userTrishlibrary: (uid: string, kind: 'files' | 'online_folders') =>
    `users/${uid}/trishlibrary/${kind}`,
  userTrishlibraryItem: (
    uid: string,
    kind: 'files' | 'online_folders',
    itemId: string,
  ) => `users/${uid}/trishlibrary/${kind}/items/${itemId}`,
  userTrishlibraryItems: (uid: string, kind: 'files' | 'online_folders') =>
    `users/${uid}/trishlibrary/${kind}/items`,

  // Announcements
  announcement: (id: string) => `announcements/${id}`,
  announcements: () => 'announcements',

  // Phase 16.1.c — Activation keys (admin-managed)
  key: (keyId: string) => `keys/${keyId}`,
  keys: () => 'keys',

  // Phase 24.3 — Session history (audit trail các session đã kết thúc)
  sessionHistory: () => 'session_history',
  sessionHistoryEntry: (id: string) => `session_history/${id}`,

  // Phase 24.3 — Security alerts (suspicious activity)
  alerts: () => 'alerts',
  alert: (id: string) => `alerts/${id}`,

  // Phase 24.3 — IP geo cache (IP → country/city/ISP/proxy)
  ipGeoCache: () => 'ip_geo',
  ipGeo: (ip: string) => `ip_geo/${ip.replace(/[^a-zA-Z0-9.:_-]/g, '_')}`,

  // Phase 15.2/16.2 — TrishTEAM curated library (admin write, all read).
  // Top-level collection để satisfy Firestore odd/even segments rule.
  trishteamLibraryFolder: (folderId: string) =>
    `trishteam_library/${folderId}`,
  trishteamLibraryFolders: () => 'trishteam_library',
  trishteamLibraryLink: (folderId: string, linkId: string) =>
    `trishteam_library/${folderId}/links/${linkId}`,
  trishteamLibraryLinks: (folderId: string) =>
    `trishteam_library/${folderId}/links`,

  // Telemetry (admin only)
  vitalsSample: (env: string, id: string) => `vitals/${env}/samples/${id}`,
  vitalsSamples: (env: string) => `vitals/${env}/samples`,
  errorSample: (env: string, id: string) => `errors/${env}/samples/${id}`,
  errorSamples: (env: string) => `errors/${env}/samples`,

  // Semantic search index
  semanticDoc: (kind: string, id: string) => `semantic/${kind}/items/${id}`,
} as const;

export type Env = 'prod' | 'dev' | 'preview';

// ============================================================
// Phase 16.1.c — Auth roles + user shape
// ============================================================

/**
 * 4 roles trong hệ sinh thái TrishTEAM.
 *
 * - admin: toàn quyền (manual set qua Firebase Console)
 * - user:  đã kích hoạt key, dùng đầy đủ tính năng
 * - trial: chưa kích hoạt key, default khi register
 * - guest: chưa login (không có doc Firestore)
 */
export type UserRole = 'admin' | 'user' | 'trial';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  trial: 1,
  user: 2,
  admin: 3,
};

/** TRUE nếu role A >= role B. */
export function hasRoleAtLeast(have: UserRole, need: UserRole): boolean {
  return ROLE_HIERARCHY[have] >= ROLE_HIERARCHY[need];
}

/**
 * App ID enum — Phase 36.1.
 * 'all' = key đặc biệt unlock tất cả apps trả phí.
 */
export type AppId =
  | 'trishlauncher'
  | 'trishlibrary'
  | 'trishdrive'
  | 'trishdesign'
  | 'trishfinance'
  | 'trishiso'
  | 'trishoffice'
  | 'trishshortcut'
  | 'trishcheck'
  | 'trishclean'
  | 'trishfont'
  | 'trishadmin'
  | 'all';

/** Phase 36.1 — Per-app key activation entry trong TrishUser */
export interface AppKeyBinding {
  key_id: string;
  activated_at: number;
  expires_at: number; // copy từ key.expires_at tại thời điểm activate (cache local)
}

/** TrishUser document trong /users/{uid} */
export interface TrishUser {
  /** UID = doc ID, lặp lại trong field cho query */
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  /** Avatar URL (Google sign-in tự fill, optional) */
  photo_url?: string;
  /** Provider: 'password' | 'google.com' */
  provider?: string;
  /** Timestamp ms khi user kích hoạt key đầu tiên (Trial → User). 0 = chưa */
  key_activated_at: number;
  /** Mã key đã kích hoạt (legacy — Phase 36+ dùng app_keys) */
  activated_key_id?: string;
  created_at: number;
  /** Last login timestamp ms */
  last_login_at?: number;

  /**
   * 🆕 Phase 36.1 — Per-app key activation map.
   * User có thể activate Library Key + Finance Key nhưng KHÔNG có ISO Key.
   * Mỗi app gate riêng dựa trên field này.
   * Migration: legacy `iso_admin=true` → `app_keys.trishiso` set bởi admin.
   */
  app_keys?: Partial<Record<AppId, AppKeyBinding>>;

  /** @deprecated Phase 36 — dùng app_keys.trishiso thay thế. Giữ cho migration. */
  iso_admin?: boolean;
  iso_admin_updated_at?: number;
  /** @deprecated Phase 36 — dùng app_keys.trishfinance thay thế. Giữ cho migration. */
  finance_user?: boolean;
  finance_user_updated_at?: number;
}

/**
 * Activation key document trong /keys/{keyId}.
 *
 * Phase 36.1: schema mở rộng với type + app_id + max_concurrent + bound fields.
 * Backward-compat: keys cũ (không có type/app_id) treat như { type:'account', app_id:'all' }.
 */
export interface ActivationKey {
  id: string;
  /**
   * Mã key dạng "XXXX-XXXX-XXXX-XXXX" (16 chars alphanumeric, không prefix).
   * Lưu uppercase, no dashes internally để query nhanh.
   */
  code: string;

  /**
   * 🆕 Phase 36.1 — Loại key:
   * - 'account': bind vào user.uid (apps có login)
   * - 'standalone': bind vào device.machine_id (apps no-login)
   * Backward-compat: keys cũ default 'account'.
   */
  type?: 'account' | 'standalone';

  /**
   * 🆕 Phase 36.1 — App được unlock bởi key này.
   * 'all' = unlock TẤT CẢ apps trả phí của user (admin cấp special).
   * Backward-compat: keys cũ default 'all'.
   */
  app_id?: AppId;

  /** Trạng thái */
  status: 'active' | 'used' | 'revoked';
  /** Note admin nội bộ (vd "Cấp cho tester X") */
  note?: string;
  /** 🆕 Phase 36.1 — Tên người nhận key (audit, không bắt buộc) */
  recipient?: string;

  /** UID user dùng key này (sau khi used) — chỉ valid khi type='account' */
  used_by_uid?: string;
  /** 🆕 Phase 36.1 — alias rõ ràng hơn cho used_by_uid */
  bound_uid?: string;
  /** 🆕 Phase 36.1 — Machine ID khi type='standalone' */
  bound_machine_id?: string;
  used_at?: number;
  activated_at?: number;

  /**
   * Timestamp expire (0 = không expire, mặc định = activated_at + 365 ngày).
   * Admin có thể override bất kỳ giá trị nào khi tạo key.
   */
  expires_at: number;

  /**
   * 🆕 Phase 36.1 — Số session đồng thời tối đa (default 1, max 99).
   * Backward-compat: keys cũ default 1.
   */
  max_concurrent?: number;

  /**
   * 🆕 Phase 24.3 — Policy khi user thứ N+1 cố activate vượt max_concurrent.
   * - 'reject' (default): chặn user mới, báo "Key đang dùng bởi máy khác"
   * - 'kick_oldest': kick session cũ nhất + cho user mới vào
   */
  concurrent_policy?: 'reject' | 'kick_oldest';

  /**
   * 🆕 Phase 24.3 — IP whitelist (CIDR vd "192.168.1.0/24" hoặc plain "1.2.3.4").
   * Empty hoặc undefined = cho phép mọi IP. Nếu có ≥1 entry → CHỈ IP khớp mới activate được.
   */
  ip_whitelist?: string[];

  /**
   * 🆕 Phase 24.3 — IP blacklist (CIDR/plain). Bất kỳ IP khớp đều bị chặn dù có whitelist.
   */
  ip_blacklist?: string[];

  /**
   * 🆕 Phase 24.3 — Nếu true → chặn IP được flag là VPN/Tor/proxy bởi ipapi.
   */
  block_proxy?: boolean;

  /**
   * 🆕 Phase 24.3 — Tags để phân loại key (vd "team-alpha", "beta-tester", "gt-danang").
   * Filter/group được trong KeysPanel.
   */
  tags?: string[];

  created_at: number;
  /** Admin UID tạo key */
  created_by_uid: string;
}

// ============================================================
// 🆕 Phase 24.3 — Session history, security alerts, IP geo cache
// ============================================================

/**
 * Phase 24.3 — Session history. Khi 1 session kết thúc (logout / kick / expire) →
 * write entry vào /session_history/{id} để admin xem timeline + analytics.
 * Retain 30 ngày qua TTL field hoặc cron cleanup.
 */
export interface SessionHistoryEntry {
  id: string;
  session_id: string;
  key_id: string;
  app_id: AppId;
  uid?: string;
  machine_id: string;
  ip_address: string;
  ip_country?: string;
  ip_city?: string;
  hostname?: string;
  os?: string;
  started_at: number;
  ended_at: number;
  duration_ms: number;
  /** Lý do kết thúc */
  end_reason: 'logout' | 'kick' | 'expire' | 'replaced' | 'unknown';
  /** Nếu end_reason='kick' — admin nào kick */
  kicked_by_uid?: string;
}

/**
 * Phase 24.3 — Security alert (suspicious activity).
 * Detector tạo alert khi: 1 key có >2 IP active trong 5 phút, IP ngoài whitelist,
 * hoặc IP flag VPN/Tor.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'multi_ip_concurrent'
  | 'ip_outside_whitelist'
  | 'ip_in_blacklist'
  | 'proxy_detected'
  | 'rapid_country_change'
  | 'unusual_concurrent';

export interface SecurityAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  /** Thông điệp ngắn gọn cho admin */
  message: string;
  key_id?: string;
  key_code?: string;
  uid?: string;
  app_id?: AppId;
  /** Chi tiết: list IPs, sessions, country... */
  details?: Record<string, unknown>;
  /** Đã được admin acknowledge chưa */
  acknowledged: boolean;
  acknowledged_by_uid?: string;
  acknowledged_at?: number;
  created_at: number;
}

/**
 * Phase 24.3 — IP geo cache. Cache result của ip-api.com để khỏi gọi lại.
 * TTL khuyến nghị 7 ngày (IP geo ít đổi).
 */
export interface IpGeoCache {
  ip: string;
  country?: string;
  country_code?: string; // 2-letter ISO (vd "VN", "US")
  region?: string;
  city?: string;
  isp?: string;
  org?: string;
  as_number?: string;
  /** ip-api flag: proxy/VPN/Tor */
  is_proxy?: boolean;
  is_hosting?: boolean;
  is_mobile?: boolean;
  lat?: number;
  lon?: number;
  cached_at: number;
}

/**
 * 🆕 Phase 36.1 — Active session document trong /keys/{keyId}/sessions/{sessionId}.
 * Dùng để track concurrent control + cho admin xem ai đang dùng key.
 */
export interface KeySession {
  session_id: string;
  key_id: string;
  app_id: AppId;
  /** Hash hostname + MAC + Windows GUID, 16 hex chars */
  machine_id: string;
  /** Public IP detect qua ipify.org, fallback 'unknown' */
  ip_address: string;
  ip_country?: string;
  /** UID nếu type='account', null nếu standalone */
  uid?: string;
  user_agent?: string;
  /** OS + version (vd "Windows 11 Pro") */
  os?: string;
  hostname?: string;
  started_at: number;
  /** Update mỗi 5min qua heartbeat. Nếu now() - last > 15min → expired. */
  last_heartbeat: number;
  expires_at: number;
}

/**
 * 🆕 Phase 36.1 — Device activation document trong /device_activations/{compositeId}.
 * Composite ID = "{machine_id}_{app_id}" để 1 máy có thể activate nhiều apps no-login.
 * Dùng cho TrishShortcut/Check/Clean/Font (apps không cần login).
 */
export interface DeviceActivation {
  composite_id: string; // "{machine_id}_{app_id}"
  machine_id: string;
  app_id: AppId;
  key_id: string;
  activated_at: number;
  /** Copy từ key.expires_at tại thời điểm activate */
  expires_at: number;
  hostname?: string;
  os?: string;
  ip_first_seen?: string;
}

/**
 * 🆕 Phase 36.1 — Audit log document trong /audit_logs/{logId}.
 * Mọi hành động liên quan key/session/permission được log để admin trace.
 */
export type AuditLogType =
  | 'key_created'
  | 'key_revoked'
  | 'key_deleted'
  | 'key_activated'
  | 'key_used'
  | 'key_expired'
  | 'key_extended'
  | 'key_binding_reset'
  | 'session_start'
  | 'session_kicked'
  | 'session_blocked'
  | 'session_expired'
  | 'permission_change'
  | 'role_change';

export interface AuditLog {
  id: string;
  type: AuditLogType;
  /** Đối tượng bị tác động */
  key_id?: string;
  uid?: string;
  machine_id?: string;
  ip?: string;
  app_id?: AppId;
  /** Ai thực hiện (admin force kick, user activate...) */
  actor_uid?: string;
  /** Chi tiết tự do (vd { from_role: 'trial', to_role: 'user' }) */
  details?: Record<string, unknown>;
  timestamp: number;
}

// ============================================================
// Phase 36.1 — Defaults
// ============================================================
export const KEY_DEFAULT_EXPIRY_DAYS = 365;
export const KEY_DEFAULT_MAX_CONCURRENT = 1;
export const SESSION_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 phút
export const SESSION_EXPIRY_AFTER_LAST_HEARTBEAT_MS = 15 * 60 * 1000; // 15 phút
export const KICK_GRACE_PERIOD_MS = 5 * 1000; // 5 giây toast trước khi auto logout

/** Helper: tính expires_at default cho key mới */
export function defaultKeyExpiresAt(now: number = Date.now()): number {
  return now + KEY_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
}

/** Helper: backward-compat cho keys cũ (không có type/app_id field) */
export function normalizeActivationKey(key: ActivationKey): Required<Pick<ActivationKey, 'type' | 'app_id' | 'max_concurrent' | 'concurrent_policy'>> & ActivationKey {
  return {
    ...key,
    type: key.type ?? 'account',
    app_id: key.app_id ?? 'all',
    max_concurrent: key.max_concurrent ?? KEY_DEFAULT_MAX_CONCURRENT,
    concurrent_policy: key.concurrent_policy ?? 'reject',
  };
}

/**
 * Phase 24.3 — Check IP có khớp 1 entry CIDR/plain không.
 * Hỗ trợ IPv4 + IPv6 plain, IPv4 CIDR (vd "192.168.1.0/24").
 * IPv6 CIDR support đơn giản: chỉ check prefix exact (đủ dùng cho whitelist).
 */
export function ipMatches(ip: string, rule: string): boolean {
  if (!ip || !rule) return false;
  const trimmed = rule.trim();
  if (trimmed === ip) return true;
  if (trimmed === '*' || trimmed === '0.0.0.0/0') return true;
  // CIDR IPv4
  const cidrMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (cidrMatch) {
    const subnet = cidrMatch[1];
    const prefix = parseInt(cidrMatch[2], 10);
    if (prefix < 0 || prefix > 32) return false;
    const ipNum = ipv4ToNumber(ip);
    const subnetNum = ipv4ToNumber(subnet);
    if (ipNum === null || subnetNum === null) return false;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (subnetNum & mask);
  }
  // Wildcard prefix (vd "192.168.1.*")
  if (trimmed.includes('*')) {
    const regex = new RegExp(
      '^' + trimmed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
    );
    return regex.test(ip);
  }
  return false;
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const x = parseInt(p, 10);
    if (isNaN(x) || x < 0 || x > 255) return null;
    n = (n << 8) | x;
  }
  return n >>> 0;
}

/**
 * Phase 24.3 — Check IP có vi phạm whitelist/blacklist của 1 key không.
 * Returns: { allowed: bool, reason: string }
 *
 * Logic:
 *   - Nếu có ≥1 blacklist entry và IP khớp → BLOCK
 *   - Nếu có ≥1 whitelist entry và IP KHÔNG khớp entry nào → BLOCK
 *   - Còn lại → ALLOW
 */
export function checkKeyIpRules(
  key: ActivationKey,
  ip: string,
): { allowed: boolean; reason: string } {
  if (!ip || ip === 'unknown') {
    return { allowed: true, reason: 'IP unknown — bypass' };
  }
  // Blacklist priority
  const blacklist = key.ip_blacklist ?? [];
  for (const rule of blacklist) {
    if (ipMatches(ip, rule)) {
      return { allowed: false, reason: `IP ${ip} match blacklist rule "${rule}"` };
    }
  }
  // Whitelist (nếu có entries)
  const whitelist = key.ip_whitelist ?? [];
  if (whitelist.length > 0) {
    const matched = whitelist.some((r) => ipMatches(ip, r));
    if (!matched) {
      return {
        allowed: false,
        reason: `IP ${ip} không nằm trong whitelist (${whitelist.length} rules)`,
      };
    }
  }
  return { allowed: true, reason: 'OK' };
}

/** Helper: check key còn hiệu lực không */
export function isKeyValid(key: ActivationKey, now: number = Date.now()): boolean {
  if (key.status === 'revoked') return false;
  if (key.expires_at > 0 && now >= key.expires_at) return false;
  return true;
}

/** Helper: check user có quyền dùng app không */
export function userHasAppAccess(
  user: TrishUser | null,
  appId: AppId,
  now: number = Date.now(),
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const binding = user.app_keys?.[appId] ?? user.app_keys?.all;
  if (!binding) return false;
  if (binding.expires_at > 0 && now >= binding.expires_at) return false;
  return true;
}

export const DATA_VERSION = '0.4.0'; // bump cho Phase 24.3 — IP rules + alerts + session history
