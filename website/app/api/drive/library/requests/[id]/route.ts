/**
 * PATCH /api/drive/library/requests/[id] — Phase 26.5.E.2
 *
 * Admin update file_request: status + admin_reply.
 * Body: { status: 'approved' | 'rejected' | 'uploaded' | 'pending', admin_reply?: string }
 *
 * Auth: Bearer + admin email allowlist.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminAuth, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const ADMIN_EMAILS = ['hosytri77@gmail.com', 'trishteam.official@gmail.com'];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

interface PatchBody {
  status?: 'pending' | 'approved' | 'rejected' | 'uploaded';
  admin_reply?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      return NextResponse.json({ error: 'Chỉ admin được update' }, { status: 403, headers: CORS_HEADERS });
    }

    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const update: Record<string, unknown> = {
      updated_at: Date.now(),
      reviewed_by: decoded.email,
    };
    if (body.status && ['pending', 'approved', 'rejected', 'uploaded'].includes(body.status)) {
      update.status = body.status;
    }
    if (typeof body.admin_reply === 'string') {
      update.admin_reply = body.admin_reply.slice(0, 2000) || null;
    }

    const db = adminDb();
    const ref = db.collection('trishdrive').doc('_').collection('file_requests').doc(id);
    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Request không tồn tại' }, { status: 404, headers: CORS_HEADERS });
    }
    await ref.update(update);

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[library/requests/[id]/patch]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: CORS_HEADERS });
  }
}
