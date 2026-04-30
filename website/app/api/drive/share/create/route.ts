/**
 * POST /api/drive/share/create — Phase 22.7b
 *
 * Owner (TrishDrive desktop) tạo share link.
 * Body: { owner_uid, file_id, file_name, file_size_bytes, file_sha256_hex, chunks,
 *         encrypted_bot_token_hex, encrypted_master_key_hex, expires_at, max_downloads }
 * Response: { token, url }
 *
 * Lưu Firestore /trishdrive/_/shares/{token} với metadata + encrypted credentials.
 * Server KHÔNG có password → KHÔNG decrypt được bot_token/master_key (zero-knowledge).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

interface CreatePayload {
  owner_uid: string;
  file_id: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256_hex: string;
  chunks: Array<{ idx: number; tg_file_id: string; byte_size: number; nonce_hex: string }>;
  encrypted_bot_token_hex: string;
  encrypted_master_key_hex: string;
  expires_at: number | null;
  max_downloads: number | null;
}

export async function POST(req: NextRequest) {
  try {
    initAdminApp();
    const body = (await req.json()) as CreatePayload;

    // Sanity validate
    if (!body.owner_uid || !body.file_id || !body.encrypted_bot_token_hex || !body.encrypted_master_key_hex) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Array.isArray(body.chunks) || body.chunks.length === 0) {
      return NextResponse.json({ error: 'Empty chunks' }, { status: 400 });
    }

    // Generate random URL-safe token (16 bytes → ~22 chars base64url)
    const token = randomBytes(16).toString('base64url');

    const db = getFirestore();
    const now = Date.now();
    await db.collection('trishdrive').doc('_').collection('shares').doc(token).set({
      token,
      owner_uid: body.owner_uid,
      file_id: body.file_id,
      file_name: body.file_name,
      file_size_bytes: body.file_size_bytes,
      file_sha256_hex: body.file_sha256_hex,
      chunks: body.chunks,
      encrypted_bot_token_hex: body.encrypted_bot_token_hex,
      encrypted_master_key_hex: body.encrypted_master_key_hex,
      expires_at: body.expires_at,
      max_downloads: body.max_downloads,
      download_count: 0,
      revoked: false,
      created_at: now,
    });

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trishteam.io.vn';
    return NextResponse.json({ token, url: `${baseUrl}/drive/share/${token}` });
  } catch (e) {
    console.error('[share/create]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
