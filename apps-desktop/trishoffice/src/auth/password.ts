/**
 * TrishOffice Auth — Password hash util (Phase 38.7).
 *
 * Local app, ko cần bcrypt heavy. Dùng SubtleCrypto SHA-256 với salt 16-byte
 * random là đủ chống password leak qua localStorage dump.
 *
 * Pattern:
 *   const salt = generateSalt();
 *   const hash = await hashPassword('mypassword', salt);
 *   // lưu user.password_hash = hash, user.password_salt = salt
 *
 *   // verify:
 *   const ok = await verifyPassword('mypassword', user.password_hash, user.password_salt);
 */

/** Tạo salt 16 byte random hex (32 chars) */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback (yếu hơn nhưng vẫn chấp nhận được cho local app)
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash password = SHA-256(salt || password) → hex */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verify password */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  // constant-time compare (ngắn gọn)
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validate password đáp ứng yêu cầu tối thiểu.
 * Trả về null nếu OK, hoặc message lỗi.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Password tối thiểu 6 ký tự';
  if (password.length > 64) return 'Password tối đa 64 ký tự';
  if (!/[a-zA-Z]/.test(password)) return 'Password phải có ít nhất 1 chữ cái';
  return null;
}

/**
 * Validate username.
 */
export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username tối thiểu 3 ký tự';
  if (username.length > 32) return 'Username tối đa 32 ký tự';
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return 'Username chỉ chứa chữ, số, dấu . _ -';
  }
  return null;
}
