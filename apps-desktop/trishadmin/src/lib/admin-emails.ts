/**
 * Phase 18.7.a — Hardcoded admin email allowlist.
 *
 * TrishAdmin app CHỈ cho phép các email trong list này login.
 * Nếu sau này cần thêm admin: edit list này → rebuild → cài tay.
 *
 * UID admin chính (từ Firebase): YiJa3yRtQmM5sSK8vqgTC4Zfzex2
 */
export const ADMIN_EMAILS: ReadonlyArray<string> = [
  'trishteam.official@gmail.com',
  'hosytri77@gmail.com',
  'hosytri@trishteam.io.vn',
];

/** Normalize email cho compare (lowercase + trim). */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Check 1 email có nằm trong allowlist không. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  return ADMIN_EMAILS.some((a) => a.toLowerCase() === e);
}
