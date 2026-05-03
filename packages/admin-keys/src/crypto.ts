/**
 * @trishteam/admin-keys — AES-GCM encrypt/decrypt qua Web Crypto API.
 *
 * Phase 28.8 (2026-05-03).
 *
 * Threat model: API key (Groq, Claude) lưu Firestore. Firestore Security
 * Rules đã chặn write/read cho non-admin/non-paid-user, nhưng nếu Firestore
 * bị leak (export, breach) thì cipher vẫn an toàn nếu master key chưa lộ.
 *
 * Master key: 32 bytes hardcoded trong source (obfuscated, không phải secret
 * tuyệt đối). Đây KHÔNG phải HSM-grade — chỉ là 1 layer nữa để giảm rủi ro
 * khi cipher ciphertext bị export ngoài ý muốn.
 *
 * Format ciphertext: base64( iv (12 bytes) || ciphertext+tag )
 */
const MASTER_KEY_RAW = 'TRISHTEAM_AES_GCM_KEY_2026_v1.0X'; // 32 bytes
const IV_LENGTH = 12;

let cachedKey: CryptoKey | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const enc = new TextEncoder();
  const raw = enc.encode(MASTER_KEY_RAW);
  if (raw.length !== 32) {
    throw new Error(
      `[admin-keys] Master key phải 32 bytes, hiện ${raw.length}. Fix MASTER_KEY_RAW.`,
    );
  }
  cachedKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  return cachedKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Encrypt plaintext (API key) thành base64 string lưu Firestore.
 * Empty input → empty output (không encrypt).
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  const cipher = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return bytesToBase64(combined);
}

/**
 * Decrypt base64 ciphertext về plaintext.
 * Empty input → empty output. Lỗi decrypt → throw.
 */
export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  const key = await getMasterKey();
  const combined = base64ToBytes(ciphertext);
  if (combined.length <= IV_LENGTH) {
    throw new Error('[admin-keys] Ciphertext quá ngắn');
  }
  const iv = combined.slice(0, IV_LENGTH);
  const cipher = combined.slice(IV_LENGTH);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher,
  );
  return new TextDecoder().decode(plainBuf);
}
