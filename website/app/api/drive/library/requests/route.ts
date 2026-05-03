/**
 * GET /api/drive/library/requests — Phase 26.5.E.2
 *
 * Admin list file requests do user gửi qua POST /api/drive/library/request.
 * Filter: ?status=pending|approved|rejected|uploaded|all (default 'all').
 *
 * Auth: Bearer Firebase ID token + check email trong allowlist admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin allowlist — email được phép xem requests. Sync với /admin allowlist trên web.
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

interface RequestItem {
  id: string;
  user_uid: string;
  user_email: string | null;
  user_name: string | null;
  file_name: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'uploaded';
  admin_reply: string | null;
  created_at: number;
  updated_at?: number | null;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json({ error: 'Firebase Admin SDK chưa cấu hình' }, { status: 501, headers: CORS_HEADERS });
    }

    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return NextResponse.json({ error: 'Thiếu Authorization Bearer token' }, { status: 401, headers: CORS_HEADERS });
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(match[1]);
    } catch (e) {
      return NextResponse.json({ error: `Token không hợp lệ: ${(e as Error).message}` }, { status: 401, headers: CORS_HEADERS });
    }
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
      return NextResponse.json({ error: 'Chỉ admin được xem requests' }, { status: 403, headers: CORS_HEADERS });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status') || 'all';

    const db = adminDb();
    let q = db.collection('trishdrive').doc('_').collection('file_requests')
      .orderBy('created_at', 'desc')
      .limit(500);

    if (statusFilter !== 'all') {
      q = db.collection('trishdrive').doc('_').collection('file_requests')
        .where('status', '==', statusFilter)
        .orderBy('created_at', 'desc')
        .limit(500);
    }

    const snap = await q.get();
    const items: RequestItem[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        id: doc.id,
        user_uid: d.user_uid,
        user_email: d.user_email ?? null,
        user_name: d.user_name ?? null,
        file_name: d.file_name,
        description: d.description ?? null,
        status: d.status ?? 'pending',
        admin_reply: d.admin_reply ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at ?? null,
      });
    });

    return NextResponse.json({ items }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[library/requests/list]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
