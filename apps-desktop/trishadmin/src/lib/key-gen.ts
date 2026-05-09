/**
 * Activation key generator.
 *
 * Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric + 3 dashes, NO prefix)
 * Alphabet 32 chars bỏ I, O, 0, 1 cho dễ đọc.
 * Đồng bộ với /admin/keys web (xem website/app/admin/keys/page.tsx).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ I, O, 0, 1 cho dễ đọc

function randomChunk(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[arr[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Generate canonical key: 16 chars liền, KHÔNG dashes.
 * Lý do: server `normalizeKeyCode` strip dashes trước khi query DB →
 * nếu lưu có dashes sẽ mismatch với input đã normalize.
 * UI hiển thị thêm dashes qua `formatKeyForDisplay`.
 */
export function generateActivationKey(): string {
  return `${randomChunk(4)}${randomChunk(4)}${randomChunk(4)}${randomChunk(4)}`;
}

/** Format 16 chars → "XXXX-XXXX-XXXX-XXXX" cho display. */
export function formatKeyForDisplay(code: string): string {
  const clean = code.replace(/-/g, '');
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}

/**
 * Accept multiple formats khi user paste:
 *   - 16 chars no dash (canonical)
 *   - XXXX-XXXX-XXXX-XXXX (4 nhóm 4 dashes)
 *   - TRISH-XXXX-XXXX-XXXX (legacy, deprecated)
 */
export function isValidKeyFormat(code: string): boolean {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // After strip non-alphanumeric: 16 chars (canonical) hoặc 17 chars (TRISH + 12)
  if (clean.length === 16 && /^[A-Z2-9]{16}$/.test(clean)) return true;
  if (clean.length === 17 && /^TRISH[A-Z2-9]{12}$/.test(clean)) return true;
  return false;
}

export function generateKeyId(): string {
  // Sử dụng làm Firestore doc ID — 16 hex chars + timestamp prefix
  const ts = Date.now().toString(36);
  const rnd = randomChunk(8).toLowerCase();
  return `k${ts}${rnd}`;
}

export function generateBroadcastId(): string {
  const ts = Date.now().toString(36);
  const rnd = randomChunk(6).toLowerCase();
  return `b${ts}${rnd}`;
}
