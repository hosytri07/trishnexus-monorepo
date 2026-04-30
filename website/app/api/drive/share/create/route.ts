/**
 * POST /api/drive/share/create — Phase 22.7b
 *
 * Owner (TrishDrive desktop) tạo share link.
 * Lưu Firestore /trishdrive/_/shares/{token} với metadata + encrypted credentials.
 * Server KHÔNG có password → KHÔNG decrypt được bot_token/master_key.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

interface ShareChunkPayload {
  idx: number;
  byte_size: number;
  nonce_hex: string;
  // Bot API path
  tg_file_id?: string;
  // MTProto path (Phase 26.0)
  pipeline?: 'botapi' | 'mtproto';
  tg_message_id?: number;
  channel_id?: number;
}

interface CreatePayload {
  owner_uid: string;
  file_id: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256_hex: string;
  /** Pipeline mặc định 'botapi' nếu không set. Phase 26.0 thêm 'mtproto'. */
  pipeline?: 'botapi' | 'mtproto';
  chunks: ShareChunkPayload[];
  encrypted_bot_token_hex: string;
  encrypted_master_key_hex: string;
  expires_at: number | null;
  max_downloads: number | null;
  /** Phase 26.1.E.1 — admin toggle: hiển thị trong "Thư viện TrishTEAM" tab.
   *  Default false (private). User app TrishDrive sẽ list shares với is_public=true. */
  is_public?: boolean;
  /** Optional folder name để group trong Library UI (vd: "App", "Tài liệu", "Form"). */
  folder_label?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình trên server' }, { status: 501 });
    }
    const body = (await req.json()) as CreatePayload;

    if (!body.owner_uid || !body.file_id || !body.encrypted_bot_token_hex || !body.encrypted_master_key_hex) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
      return NextResponse.json({ error: 'Empty chunks' }, { status: 400 });
    }

    const token = randomBytes(16).toString('base64url');
    const db = adminDb();
    const now = Date.now();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trishteam.io.vn';
    const longUrl = `${baseUrl}/drive/share/${token}`;

    // Phase 23.4: tạo short_link /s/{code} song song với share record
    // Reuse same shortener bảng `short_links` (đã có sẵn từ Phase 19.22)
    const shortCode = await createShortLink(db, longUrl);
    const shortUrl = shortCode ? `${baseUrl}/s/${shortCode}` : longUrl;

    await db.collection('trishdrive').doc('_').collection('shares').doc(token).set({
      token,
      owner_uid: body.owner_uid,
      file_id: body.file_id,
      file_name: body.file_name,
      file_size_bytes: body.file_size_bytes,
      file_sha256_hex: body.file_sha256_hex,
      pipeline: body.pipeline ?? 'botapi',
      // Phase 26.1.E.1 — public toggle cho Thư viện TrishTEAM
      is_public: body.is_public === true,
      folder_label: body.folder_label ?? null,
      chunks: body.chunks,
      encrypted_bot_token_hex: body.encrypted_bot_token_hex,
      encrypted_master_key_hex: body.encrypted_master_key_hex,
      expires_at: body.expires_at,
      max_downloads: body.max_downloads,
      download_count: 0,
      revoked: false,
      created_at: now,
      short_code: shortCode,
      short_url: shortUrl,
    });

    return NextResponse.json({
      token,
      url: longUrl,
      short_url: shortUrl,
      short_code: shortCode,
    });
  } catch (e) {
    console.error('[share/create]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Tạo short code 6 ký tự bằng cùng schema như /api/shorten
const SHORT_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
const SHORT_LEN = 6;
const MAX_RETRIES = 5;

function genShortCode(): string {
  let out = '';
  for (let i = 0; i < SHORT_LEN; i++) {
    out += SHORT_CHARS[Math.floor(Math.random() * SHORT_CHARS.length)];
  }
  return out;
}

async function createShortLink(
  db: ReturnType<typeof adminDb>,
  longUrl: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = genShortCode();
    const ref = db.collection('short_links').doc(candidate);
    const snap = await ref.get();
    if (!snap.exists) {
      try {
        await ref.set({
          code: candidate,
          original_url: longUrl,
          created_at: Date.now(),
          created_by_uid: null,
          click_count: 0,
          source: 'drive_share',
        });
        return candidate;
      } catch (e) {
        console.error('[share/create] shortener fail:', e);
        return null; // fallback long URL
      }
    }
  }
  return null;
}
