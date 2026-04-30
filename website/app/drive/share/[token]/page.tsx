'use client';

/**
 * /drive/share/{token} — Phase 22.7b
 *
 * Recipient flow:
 *   1. Fetch /info → metadata + encrypted creds
 *   2. Form nhập password → derive AES key (PBKDF2)
 *   3. Decrypt bot_token + master_key client-side
 *   4. Loop chunks: POST /proxy (server fetch Telegram) → encrypted bytes
 *   5. Decrypt bytes với master_key → concat → save file
 *   6. Verify SHA256 cuối cùng
 *
 * Zero-knowledge: server không có password, không decrypt được content.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface ShareInfo {
  token: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256_hex: string;
  total_chunks: number;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
  encrypted_bot_token_hex: string;
  encrypted_master_key_hex: string;
  /** Phase 26.0 — pipeline 'botapi' | 'mtproto'. Default 'botapi'. */
  pipeline?: 'botapi' | 'mtproto';
  chunks: Array<{
    idx: number;
    byte_size: number;
    nonce_hex: string;
    /** Bot API path */
    tg_file_id?: string;
    /** MTProto path (Phase 26.0) */
    pipeline?: 'botapi' | 'mtproto';
    tg_message_id?: number;
    channel_id?: number;
  }>;
}

export default function SharePage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [autoKey, setAutoKey] = useState<string | null>(null); // từ URL fragment #k=...

  useEffect(() => {
    void load();
    // Phase 23.5: đọc URL fragment để extract auto-key (nếu link share không-password)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const k = hashParams.get('k');
      if (k && k.length >= 16) {
        setAutoKey(k);
        setPassword(k); // dùng key như password — encryption schema giống nhau
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-trigger download khi có auto-key + đã load info
  useEffect(() => {
    if (autoKey && info && !downloading && !progress) {
      void doDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, info]);

  async function load() {
    try {
      const res = await fetch(`/api/drive/share/${token}/info`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ShareInfo;
      setInfo(data);
    } catch (e) {
      setLoadErr((e as Error).message);
    }
  }

  async function doDownload() {
    if (!info) return;
    setDownloading(true);
    setErr(null);
    setProgress('Decrypt credentials với password...');
    try {
      // 1. Decrypt bot_token + master_key với password
      const botToken = await decryptWithPassword(info.encrypted_bot_token_hex, password);
      const masterKeyHex = await decryptWithPassword(info.encrypted_master_key_hex, password);

      // 2. Loop chunks: POST /proxy → decrypt → concat
      const parts: Uint8Array[] = [];
      for (let i = 0; i < info.chunks.length; i++) {
        const ch = info.chunks[i];
        setProgress(`Tải chunk ${i + 1}/${info.chunks.length}...`);
        // Phase 26.0 — route /proxy theo pipeline của chunk (mỗi chunk có thể khác,
        // dù thông thường cả file 1 pipeline). MTProto gửi tg_message_id + channel_id,
        // server sẽ forwardMessage qua log channel + getFile Bot API.
        const chunkPipeline = ch.pipeline ?? info.pipeline ?? 'botapi';
        const proxyBody = chunkPipeline === 'mtproto'
          ? {
              bot_token: botToken,
              pipeline: 'mtproto' as const,
              tg_message_id: ch.tg_message_id,
              channel_id: ch.channel_id,
              is_first_chunk: i === 0,
            }
          : {
              bot_token: botToken,
              pipeline: 'botapi' as const,
              tg_file_id: ch.tg_file_id,
              is_first_chunk: i === 0,
            };
        const proxyResp = await fetch(`/api/drive/share/${token}/proxy`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(proxyBody),
        });
        if (!proxyResp.ok) {
          const j = await proxyResp.json().catch(() => ({}));
          throw new Error(j.error || `Proxy HTTP ${proxyResp.status}`);
        }
        const encryptedBytes = new Uint8Array(await proxyResp.arrayBuffer());

        setProgress(`Decrypt chunk ${i + 1}/${info.chunks.length}...`);
        const plaintext = await aesGcmDecrypt(masterKeyHex, encryptedBytes);
        parts.push(plaintext);
      }

      // 3. Concat all chunks
      setProgress('Ghép file + verify SHA256...');
      const totalLen = parts.reduce((s, p) => s + p.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const p of parts) {
        merged.set(p, offset);
        offset += p.length;
      }

      // 4. Verify SHA256
      const hashBuf = await crypto.subtle.digest('SHA-256', merged);
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      if (hashHex !== info.file_sha256_hex) {
        throw new Error(`SHA256 mismatch: expected ${info.file_sha256_hex.slice(0, 12)} got ${hashHex.slice(0, 12)}. File corrupt.`);
      }

      // 5. Save file
      setProgress('Lưu file...');
      const blob = new Blob([new Uint8Array(merged)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.file_name;
      a.click();
      URL.revokeObjectURL(url);
      setProgress('✅ Tải xong!');
    } catch (e) {
      setErr((e as Error).message);
      setProgress('');
    } finally {
      setDownloading(false);
    }
  }

  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">⚠️ Lỗi</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{loadErr}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: 'var(--color-text-muted)' }}>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl">📦</div>
          <h1 className="text-2xl font-bold mt-3">{info.file_name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {formatBytes(info.file_size_bytes)} · {info.total_chunks} chunk{info.total_chunks > 1 ? 's' : ''}
          </p>
          {info.expires_at && (
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              Hết hạn: {new Date(info.expires_at).toLocaleString('vi-VN')}
            </p>
          )}
          {info.max_downloads && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Lượt tải: {info.download_count}/{info.max_downloads}
            </p>
          )}
        </div>

        <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 16, padding: 24 }}>
          {autoKey ? (
            <>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                🔐 Link share dạng tự-mở-khoá — key nằm trong URL fragment (không gửi server). Tự động tải khi load trang.
              </p>
            </>
          ) : (
            <>
              <label className="text-sm font-semibold">Password share</label>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Người gửi đã đặt password riêng cho file này. Bạn cần biết password để tải.
              </p>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm"
                style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}
                onKeyDown={e => e.key === 'Enter' && password.length >= 8 && doDownload()}
                autoFocus
              />
            </>
          )}

          <button
            className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--color-accent-gradient)', opacity: downloading || (!autoKey && password.length < 8) ? 0.5 : 1 }}
            onClick={doDownload}
            disabled={downloading || (!autoKey && password.length < 8)}
          >
            {downloading ? progress || 'Đang tải...' : '⬇ Tải về'}
          </button>

          {err && (
            <p className="text-xs mt-3" style={{ color: '#ef4444' }}>❌ {err}</p>
          )}

          <div className="text-xs mt-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
            🔒 File được mã hoá AES-256-GCM. Server không decrypt được nếu không có password.
          </div>
        </div>

        <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
          Powered by <a href="/" style={{ color: 'var(--color-text-link)' }}>TrishDrive</a> · TrishTEAM ecosystem
        </p>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ============================================================
// Crypto helpers — match Rust crypto.rs (AES-256-GCM + PBKDF2-SHA256)
// ============================================================

const PBKDF2_ITER = 100_000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

async function decryptWithPassword(payloadHex: string, password: string): Promise<string> {
  const payload = hexToBytes(payloadHex);
  // Format: salt(16) | nonce(12) | ciphertext+tag
  const salt = payload.slice(0, 16);
  const nonce = payload.slice(16, 28);
  const ciphertext = payload.slice(28);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    new Uint8Array(ciphertext)
  );
  return new TextDecoder().decode(plain);
}

async function aesGcmDecrypt(keyHex: string, payload: Uint8Array): Promise<Uint8Array> {
  // Format: nonce(12) | ciphertext+tag
  const keyBytes = hexToBytes(keyHex);
  const nonce = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    new Uint8Array(ciphertext)
  );
  return new Uint8Array(plain);
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
