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
  /** Timestamp ms khi user kích hoạt key (Trial → User). 0 = chưa */
  key_activated_at: number;
  /** Mã key đã kích hoạt (admin reference) */
  activated_key_id?: string;
  created_at: number;
  /** Last login timestamp ms */
  last_login_at?: number;
}

/** Activation key document trong /keys/{keyId} */
export interface ActivationKey {
  id: string;
  /** Mã key dạng "TRISH-XXXX-XXXX-XXXX" */
  code: string;
  /** Trạng thái */
  status: 'active' | 'used' | 'revoked';
  /** Note admin (vd "Cấp cho khách hàng X") */
  note?: string;
  /** UID user dùng key này (sau khi used) */
  used_by_uid?: string;
  used_at?: number;
  /** Timestamp expire (0 = không expire) */
  expires_at: number;
  created_at: number;
  /** Admin UID tạo key */
  created_by_uid: string;
}

export const DATA_VERSION = '0.2.0';
