/**
 * POST /api/admin/seed-databases — Phase 19.22.
 *
 * Seed 4 collection từ TS data hardcode lên Firestore (1 lần khi setup):
 *   - /standards/{id}     (19 QCVN/TCVN/Thông tư...)
 *   - /dinh_muc/{id}      (17 mã QĐ 1776)
 *   - /vat_lieu/{id}      (25 vật liệu)
 *   - /roads_vn/{id}      (25 tuyến đường)
 *
 * Body JSON: { collection: 'standards' | 'dinh_muc' | 'vat_lieu' | 'roads_vn' | 'all', overwrite?: boolean }
 * Header: Authorization: Bearer <ID token>
 *
 * Mặc định overwrite=false: skip doc đã tồn tại. Pass overwrite=true để
 * force ghi đè (cẩn thận — mất chỉnh sửa thủ công của admin).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import { STANDARDS } from '@/data/standards-vn';
import { CONSTRUCTION_NORMS } from '@/data/dinh-muc';
import { MATERIALS } from '@/data/materials';
import { ROADS as VIETNAM_ROADS } from '@/data/roads-vn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifyAdmin(req: NextRequest) {
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return { error: 'missing_token', status: 401 } as const;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.admin === true) return { decoded } as const;
    const snap = await adminDb().collection('users').doc(decoded.uid).get();
    if (snap.exists && (snap.data() as { role?: string }).role === 'admin') {
      return { decoded } as const;
    }
    return { error: 'not_admin', status: 403 } as const;
  } catch {
    return { error: 'invalid_token', status: 401 } as const;
  }
}

const SEEDS: Record<string, { data: Array<{ id: string; [k: string]: unknown }>; collection: string }> = {
  standards: { data: STANDARDS as never, collection: 'standards' },
  dinh_muc: { data: CONSTRUCTION_NORMS as never, collection: 'dinh_muc' },
  vat_lieu: { data: MATERIALS as never, collection: 'vat_lieu' },
  roads_vn: { data: VIETNAM_ROADS as never, collection: 'roads_vn' },
};

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json({ error: 'Admin SDK chưa cấu hình.' }, { status: 501 });
  }
  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  let body: { collection?: string; overwrite?: boolean };
  try {
    body = (await req.json()) as { collection?: string; overwrite?: boolean };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const which = body.collection ?? 'all';
  const overwrite = !!body.overwrite;

  const targets =
    which === 'all'
      ? Object.keys(SEEDS)
      : SEEDS[which]
        ? [which]
        : [];
  if (targets.length === 0) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 });
  }

  const db = adminDb();
  const report: Record<string, { total: number; created: number; skipped: number; updated: number }> = {};

  for (const key of targets) {
    const seed = SEEDS[key]!;
    const coll = db.collection(seed.collection);
    let created = 0;
    let skipped = 0;
    let updated = 0;
    for (const item of seed.data) {
      const id = item.id;
      const ref = coll.doc(id);
      const snap = await ref.get();
      if (snap.exists && !overwrite) {
        skipped++;
        continue;
      }
      const payload = {
        ...item,
        _seeded_at: Date.now(),
        _seeded_by: caller.decoded.uid,
      };
      await ref.set(payload, { merge: !overwrite });
      if (snap.exists) updated++;
      else created++;
    }
    report[key] = { total: seed.data.length, created, skipped, updated };
  }

  return NextResponse.json({ ok: true, overwrite, report });
}
