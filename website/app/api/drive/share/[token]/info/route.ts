/**
 * GET /api/drive/share/{token}/info — Phase 22.7b
 * Recipient mở share page → fetch metadata (file name, size, expires) + encrypted creds.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501 });
    }
    const db = adminDb();
    const doc = await db.collection('trishdrive').doc('_').collection('shares').doc(token).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Share không tồn tại hoặc đã bị xoá' }, { status: 404 });
    }
    const data = doc.data() as Record<string, unknown>;
    if (data.revoked === true) {
      return NextResponse.json({ error: 'Share đã bị thu hồi' }, { status: 410 });
    }
    if (typeof data.expires_at === 'number' && data.expires_at < Date.now()) {
      return NextResponse.json({ error: 'Share đã hết hạn' }, { status: 410 });
    }
    if (typeof data.max_downloads === 'number' && typeof data.download_count === 'number'
        && data.download_count >= data.max_downloads) {
      return NextResponse.json({ error: 'Share đã đạt giới hạn lượt tải' }, { status: 410 });
    }

    return NextResponse.json({
      token,
      file_name: data.file_name,
      file_size_bytes: data.file_size_bytes,
      file_sha256_hex: data.file_sha256_hex,
      total_chunks: Array.isArray(data.chunks) ? data.chunks.length : 0,
      expires_at: data.expires_at ?? null,
      max_downloads: data.max_downloads ?? null,
      download_count: data.download_count ?? 0,
      encrypted_bot_token_hex: data.encrypted_bot_token_hex,
      encrypted_master_key_hex: data.encrypted_master_key_hex,
      chunks: data.chunks,
    });
  } catch (e) {
    console.error('[share/info]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
