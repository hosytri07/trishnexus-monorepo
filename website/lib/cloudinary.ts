/**
 * lib/cloudinary.ts — Phase 19.12 — Cloudinary helpers (server + client).
 *
 * Architecture:
 *   1. Admin/User chọn file ở browser
 *   2. Client gọi /api/cloudinary/sign để lấy signed params
 *   3. Client POST trực tiếp tới Cloudinary upload endpoint với signature
 *   4. Cloudinary trả về secure_url + public_id
 *   5. Client lưu public_id vào Firestore (nhỏ gọn, ổn định hơn full URL)
 *   6. UI dùng buildImageUrl(publicId, preset) để render với transformation
 *
 * Server module dùng `cloudinary.v2` để verify signature.
 * Client module chỉ build URL transformation (không cần API key).
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';

export const cloudinaryReady = Boolean(CLOUD_NAME);

// ============================================================
// PRESET — transformation cho từng use case
// ============================================================
export type CloudinaryPreset =
  | 'avatar-32'   // sidebar/comment small
  | 'avatar-64'   // navbar
  | 'avatar-128'  // profile card
  | 'avatar-256'  // profile hero
  | 'sign-thumb'  // 200×200 cho card biển báo
  | 'sign-detail' // 400×400 cho modal detail
  | 'bridge-card' // 600×400 cho card cầu
  | 'bridge-hero' // 1200×800 cho modal hero
  | 'post-hero'   // 1200×630 cho hero blog (16:9.5 OG)
  | 'post-inline' // max 1200 width inline blog body
  | 'original';   // raw, no transform — dùng cho download

const PRESET_TRANSFORMATIONS: Record<CloudinaryPreset, string> = {
  'avatar-32': 'w_32,h_32,c_fill,g_face,f_auto,q_auto,r_max',
  'avatar-64': 'w_64,h_64,c_fill,g_face,f_auto,q_auto,r_max',
  'avatar-128': 'w_128,h_128,c_fill,g_face,f_auto,q_auto,r_max',
  'avatar-256': 'w_256,h_256,c_fill,g_face,f_auto,q_auto,r_max',
  'sign-thumb': 'w_200,h_200,c_fit,f_auto,q_auto,b_white',
  'sign-detail': 'w_400,h_400,c_fit,f_auto,q_auto,b_white',
  'bridge-card': 'w_600,h_400,c_fill,f_auto,q_auto',
  'bridge-hero': 'w_1200,h_800,c_fill,f_auto,q_auto',
  'post-hero': 'w_1200,h_630,c_fill,f_auto,q_auto',
  'post-inline': 'w_1200,c_limit,f_auto,q_auto',
  original: 'f_auto,q_auto',
};

/**
 * Build URL có transformation từ publicId.
 *
 * Pattern Cloudinary URL:
 *   https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{publicId}.{ext}
 *
 * Bỏ extension cho phép Cloudinary tự chọn format theo `f_auto`.
 */
export function buildImageUrl(
  publicId: string,
  preset: CloudinaryPreset = 'original',
): string {
  if (!CLOUD_NAME) {
    console.warn('[cloudinary] CLOUD_NAME missing — return raw publicId');
    return publicId;
  }
  if (!publicId) return '';
  // Nếu publicId đã là URL đầy đủ (legacy data) → return as-is
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }
  const transform = PRESET_TRANSFORMATIONS[preset];
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}

// ============================================================
// FOLDER convention — group asset theo loại
// ============================================================
export const CLOUDINARY_FOLDERS = {
  avatar: 'trishteam/avatars',
  sign: 'trishteam/signs',
  bridge: 'trishteam/bridges',
  post: 'trishteam/posts',
  temp: 'trishteam/temp',
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;
