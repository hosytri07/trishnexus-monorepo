/**
 * GET /api/drive/library/comments-admin — Phase 26.5.D.2
 *
 * Admin list all comments cross-files. Stats: avg rating per file + total count.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['hosytri77@gmail.com', 'trishteam.official@gmail.com'];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface AdminComment {
  id: string;
  file_token: string;
  file_name: string;
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
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json({ error: `Token không hợp lệ: ${(e as Error).message}` }, { status: 401, headers: CORS_HEADERS });
    }
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
      return NextResponse.json({ error: 'Chỉ admin được xem' }, { status: 403, headers: CORS_HEADERS });
    }

    const db = adminDb();
    const snap = await db
      .collection('trishdrive').doc('_').collection('file_comments')
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();

    const items: AdminComment[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        id: doc.id,
        file_token: d.file_token,
        file_name: d.file_name || '',
        user_uid: d.user_uid,
        user_email: d.user_email ?? null,
        user_name: d.user_name ?? null,
        text: d.text,
        rating: d.rating ?? null,
        created_at: d.created_at,
      });
    });

    // Stats per file
    const statsMap = new Map<string, { count: number; totalRating: number; ratingCount: number; file_name: string }>();
    items.forEach((c) => {
      const s = statsMap.get(c.file_token) || { count: 0, totalRating: 0, ratingCount: 0, file_name: c.file_name };
      s.count += 1;
      if (typeof c.rating === 'number') {
        s.totalRating += c.rating;
        s.ratingCount += 1;
      }
      statsMap.set(c.file_token, s);
    });
    const stats = Array.from(statsMap.entries()).map(([token, s]) => ({
      file_token: token,
      file_name: s.file_name,
      count: s.count,
      avg_rating: s.ratingCount > 0 ? s.totalRating / s.ratingCount : null,
    }));

    return NextResponse.json({ items, stats }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[library/comments-admin]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
