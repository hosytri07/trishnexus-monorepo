/**
 * POST /api/drive/library/comment — Phase 26.5.D
 *
 * User post comment + rating (1-5) cho file public Library.
 * Lưu Firestore /trishdrive/_/file_comments/{auto_id}.
 *
 * Body: { file_token: string, text: string, rating?: number (1-5) }
 * Auth: Bearer Firebase ID token.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface CommentBody {
  file_token: string;
  text: string;
  rating?: number;
}

export async function POST(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501, headers: CORS_HEADERS });
    }

    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json({ error: 'Thiếu Bearer token' }, { status: 401, headers: CORS_HEADERS });
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json({ error: `Token không hợp lệ: ${(e as Error).message}` }, { status: 401, headers: CORS_HEADERS });
    }

    const body = (await req.json()) as CommentBody;
    if (!body.file_token?.trim()) {
      return NextResponse.json({ error: 'file_token bắt buộc' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'text bắt buộc' }, { status: 400, headers: CORS_HEADERS });
    }
    if (body.text.length > 2000) {
      return NextResponse.json({ error: 'Comment quá dài (max 2000 ký tự)' }, { status: 400, headers: CORS_HEADERS });
    }
    const rating = body.rating;
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating phải 1-5' }, { status: 400, headers: CORS_HEADERS });
    }

    const db = adminDb();

    // Verify file_token tồn tại + is_public=true (chỉ comment được file public)
    const shareDoc = await db.collection('trishdrive').doc('_').collection('shares').doc(body.file_token).get();
    if (!shareDoc.exists) {
      return NextResponse.json({ error: 'File không tồn tại' }, { status: 404, headers: CORS_HEADERS });
    }
    const shareData = shareDoc.data();
    if (!shareData?.is_public) {
      return NextResponse.json({ error: 'File không public, không thể comment' }, { status: 403, headers: CORS_HEADERS });
    }

    const docRef = await db
      .collection('trishdrive')
      .doc('_')
      .collection('file_comments')
      .add({
        file_token: body.file_token,
        file_name: shareData.file_name || '',
        user_uid: decoded.uid,
        user_email: decoded.email || null,
        user_name: decoded.name || null,
        text: body.text.trim(),
        rating: rating ?? null,
        created_at: Date.now(),
      });

    return NextResponse.json({ ok: true, comment_id: docRef.id }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[library/comment]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
