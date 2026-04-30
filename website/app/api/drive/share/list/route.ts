/**
 * GET /api/drive/share/list?owner_uid={uid} — Phase 22.7e
 * List shares của 1 user. Admin SDK query Firestore.
 * KHÔNG return encrypted credentials (chỉ metadata public).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    if (!adminReady()) {
      return NextResponse.json({ error: 'Admin SDK chưa cấu hình' }, { status: 501 });
    }
    const ownerUid = req.nextUrl.searchParams.get('owner_uid');
    if (!ownerUid) {
      return NextResponse.json({ error: 'Missing owner_uid' }, { status: 400 });
    }
    const db = adminDb();
    const snap = await db.collection('trishdrive').doc('_').collection('shares')
      .where('owner_uid', '==', ownerUid)
      .orderBy('created_at', 'desc')
      .limit(200)
      .get();

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trishteam.io.vn';
    const shares = snap.docs.map(d => {
      const data = d.data();
      return {
        token: d.id,
        file_id: data.file_id,
        file_name: data.file_name,
        file_size_bytes: data.file_size_bytes,
        created_at: data.created_at,
        expires_at: data.expires_at ?? null,
        max_downloads: data.max_downloads ?? null,
        download_count: data.download_count ?? 0,
        revoked: data.revoked ?? false,
        url: `${baseUrl}/drive/share/${d.id}`,
      };
    });
    return NextResponse.json({ shares });
  } catch (e) {
    console.error('[share/list]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
