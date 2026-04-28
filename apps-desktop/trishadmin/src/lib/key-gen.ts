/**
 * Phase 18.7.a — Activation key generator.
 *
 * Format: TRISH-XXXX-XXXX-XXXX (TRISH prefix + 12 hex chars chia thành 3 nhóm 4)
 * Generate qua Web Crypto getRandomValues (cryptographically secure).
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

export function generateActivationKey(): string {
  return `TRISH-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
}

export function isValidKeyFormat(code: string): boolean {
  return /^TRISH-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code);
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
