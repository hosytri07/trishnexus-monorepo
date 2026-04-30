/**
 * PATCH /api/drive/share/{token}/manage — Phase 22.7e
 * Body: { owner_uid, action: 'revoke' | 'extend', expires_hours?: number }
 * Owner chỉ thao tác share của chính mình (cross-check owner_uid).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

interface ManageBody {
  owner_uid: string;
  action: 'revoke' | 'extend' | 'unrevoke';
  expires_hours?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!adminReady()) {
      return NextResponse.json({ error: 'Admin SDK chưa cấu hình' }, { status: 501 });
    }
    const body = (await req.json()) as ManageBody;
    if (!body.owner_uid || !body.action) {
      return NextResponse.json({ error: 'Missing owner_uid / action' }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.collection('trishdrive').doc('_').collection('shares').doc(token);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Share không tồn tại' }, { status: 404 });
    const data = doc.data() as Record<string, unknown>;
    if (data.owner_uid !== body.owner_uid) {
      return NextResponse.json({ error: 'Không có quyền (owner_uid mismatch)' }, { status: 403 });
    }

    if (body.action === 'revoke') {
      await ref.update({ revoked: true, revoked_at: Date.now() });
    } else if (body.action === 'unrevoke') {
      await ref.update({ revoked: false });
    } else if (body.action === 'extend') {
      if (!body.expires_hours || body.expires_hours <= 0) {
        return NextResponse.json({ error: 'expires_hours phải > 0' }, { status: 400 });
      }
      const newExpires = Date.now() + body.expires_hours * 3600 * 1000;
      await ref.update({ expires_at: newExpires });
    } else {
      return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[share/manage]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
