/**
 * Phase 18.8.b — Mask helpers cho thông tin nhạy cảm.
 *
 * Partial mask: giữ ký tự đầu/cuối, thay phần giữa bằng *.
 * Các panel (Users / Keys / Audit / Feedback) dùng cùng bộ helper này
 * + hook useReveal để toggle ẩn/hiện.
 */

const DASH = '—';

function pad(len: number, ch = '*'): string {
  return ch.repeat(Math.max(3, Math.min(len, 8)));
}

/**
 * Email: t****@gmail.com (giữ ký tự đầu local + domain).
 * Local rất ngắn (≤2): "a***@gmail.com".
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return DASH;
  const at = email.indexOf('@');
  if (at < 0) return maskName(email);
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? ''}${pad(3)}${domain}`;
  return `${local[0]}${pad(local.length - 2)}${local.slice(-1)}${domain}`;
}

/**
 * Display name: T****í (giữ chữ đầu + cuối).
 */
export function maskName(name: string | null | undefined): string {
  if (!name) return DASH;
  if (name.length <= 2) return `${name[0] ?? ''}${pad(3)}`;
  return `${name[0]}${pad(name.length - 2)}${name.slice(-1)}`;
}

/**
 * UID: dOio**** (giữ 4 ký tự đầu).
 */
export function maskUid(uid: string | null | undefined): string {
  if (!uid) return DASH;
  if (uid.length <= 6) return `${uid.slice(0, 2)}${pad(4)}`;
  return `${uid.slice(0, 4)}${pad(4)}`;
}

/**
 * Activation key:
 * - Có dấu `-`: TRISH-****-****-XXXX (giữ first + last group).
 * - Không có: PVPY********YYKF (giữ 4 đầu + 4 cuối).
 */
export function maskKey(code: string | null | undefined): string {
  if (!code) return DASH;
  if (code.includes('-')) {
    const parts = code.split('-');
    if (parts.length <= 2) {
      return `${parts[0]}${parts.length === 2 ? '-****' : ''}`;
    }
    return parts
      .map((p, i) => (i === 0 || i === parts.length - 1 ? p : '****'))
      .join('-');
  }
  if (code.length <= 8) return `${code.slice(0, 2)}${pad(4)}`;
  return `${code.slice(0, 4)}${pad(code.length - 8)}${code.slice(-4)}`;
}

/**
 * Áp mask theo trạng thái revealed.
 */
export function applyMask(
  value: string | null | undefined,
  revealed: boolean,
  masker: (v: string | null | undefined) => string,
): string {
  if (revealed) return value ?? DASH;
  return masker(value);
}
