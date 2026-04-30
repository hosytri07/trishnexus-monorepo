/**
 * GET /api/drive/library/comments?file_token=xxx — Phase 26.5.D
 *
 * List comments per file. Public read (require Bearer auth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface Comment {
  id: string;
  file_token: string;
  user_uid: string;
  user_email: string | null;
  user_name: string | null;
  text: string;
  rating: number | null;
  created_at: number;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501, headers: CORS_HEADERS });
    }

    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json({ error: 'Thiếu Bearer token' }, { status: 401, headers: CORS_HEADERS });
    }
    try {
      await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json({ error: `Token không hợp lệ: ${(e as Error).message}` }, { status: 401, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const fileToken = url.searchParams.get('file_token');
    if (!fileToken) {
      return NextResponse.json({ error: 'Thiếu file_token query param' }, { status: 400, headers: CORS_HEADERS });
    }

    const db = adminDb();
    const snap = await db
      .collection('trishdrive').doc('_').collection('file_comments')
      .where('file_token', '==', fileToken)
      .orderBy('created_at', 'desc')
      .limit(200)
      .get();

    const items: Comment[] = [];
    let totalRating = 0;
    let ratingCount = 0;
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        id: doc.id,
        file_token: d.file_token,
        user_uid: d.user_uid,
        user_email: d.user_email ?? null,
        user_name: d.user_name ?? null,
        text: d.text,
        rating: d.rating ?? null,
        created_at: d.created_at,
      });
      if (typeof d.rating === 'number') {
        totalRating += d.rating;
        ratingCount += 1;
      }
    });

    const avgRating = ratingCount > 0 ? totalRating / ratingCount : null;

    return NextResponse.json(
      { items, count: items.length, avg_rating: avgRating, rating_count: ratingCount },
      { headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error('[library/comments]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
