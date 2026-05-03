/**
 * GET /api/drive/library/list — Phase 26.1.E + 26.1.G
 *
 * List shares public (is_public=true) cho TrishDrive User app render Thư viện
 * TrishTEAM tab. Server-side filter qua Admin SDK (rules vẫn deny client direct).
 *
 * Return: [{ token, file_name, file_size_bytes, folder_label, created_at, url,
 *           short_url, expires_at, max_downloads, download_count, sha256_hex }]
 *
 * KHÔNG return encrypted_bot_token / encrypted_master_key (sensitive — chỉ
 * /info trả khi user có URL trực tiếp).
 *
 * Auth: yêu cầu Authorization: Bearer <Firebase ID token>.
 *
 * Phase 26.1.G — CORS: TrishDrive User app standalone (Tauri WebView, origin
 * `https://tauri.localhost`) gọi cross-origin → cần CORS headers + OPTIONS
 * preflight handler. Auth qua Bearer token nên Allow-Origin '*' an toàn.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface LibraryItem {
  token: string;
  file_name: string;
  file_size_bytes: number;
  file_sha256_hex: string;
  folder_label: string | null;
  created_at: number;
  url: string;
  short_url: string | null;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
  /** Phase 25.1.G — Public no-password shares: server lưu key plaintext.
   *  Client app TrishDrive embed key này vào URL fragment để decrypt mà không cần
   *  user nhập password. Chỉ trả về cho authenticated user qua Library API. */
  library_password_hex?: string;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK chưa cấu hình' },
        { status: 501, headers: CORS_HEADERS },
      );
    }

    // Verify Firebase ID token
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json(
        { error: 'Thiếu Authorization Bearer token' },
        { status: 401, headers: CORS_HEADERS },
      );
    }
    try {
      await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json(
        { error: `Token không hợp lệ: ${(e as Error).message}` },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const db = adminDb();
    const snap = await db
      .collection('trishdrive')
      .doc('_')
      .collection('shares')
      .where('is_public', '==', true)
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();

    const now = Date.now();
    const items: LibraryItem[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.revoked === true) return;
      if (typeof d.expires_at === 'number' && d.expires_at < now) return;
      if (typeof d.max_downloads === 'number' && typeof d.download_count === 'number'
          && d.download_count >= d.max_downloads) return;
      items.push({
        token: d.token,
        file_name: d.file_name,
        file_size_bytes: d.file_size_bytes,
        file_sha256_hex: d.file_sha256_hex,
        folder_label: d.folder_label ?? null,
        created_at: d.created_at,
        url: d.url ?? `https://trishteam.io.vn/drive/share/${d.token}`,
        short_url: d.short_url ?? null,
        expires_at: d.expires_at ?? null,
        max_downloads: d.max_downloads ?? null,
        download_count: d.download_count ?? 0,
        ...(typeof d.library_password_hex === 'string'
          ? { library_password_hex: d.library_password_hex }
          : {}),
      });
    });

    return NextResponse.json({ items }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[library/list]', e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
