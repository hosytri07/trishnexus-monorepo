/**
 * POST /api/admin/seed-apps — Phase 19.22.
 *
 * Import 9-10 app từ public/apps-registry.json vào Firestore /apps_meta/{appId}.
 * Mặc định overwrite=false — chỉ thêm app chưa có. overwrite=true để force.
 *
 * Body: { appId?: string, overwrite?: boolean }
 *   - Nếu thiếu appId → seed tất cả
 *
 * Header: Authorization: Bearer <ID token admin>
 */
import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, adminDb, adminReady } from '@/lib/firebase-admin';
import registry from '@/public/apps-registry.json';
import { APP_META } from '@/data/apps-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegistryEntry {
  id: string;
  name: string;
  tagline: string;
  logo_url?: string;
  version: string;
  size_bytes: number;
  status: string;
  release_at?: string;
  login_required: string;
  platforms: string[];
  screenshots?: string[];
  changelog_url?: string;
  download?: Record<string, { url?: string; sha256?: string }>;
}

const REGISTRY = registry as { apps: RegistryEntry[] };

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

export async function POST(req: NextRequest) {
  if (!adminReady()) {
    return NextResponse.json({ error: 'Admin SDK chưa cấu hình.' }, { status: 501 });
  }
  const caller = await verifyAdmin(req);
  if ('error' in caller) {
    return NextResponse.json({ error: caller.error }, { status: caller.status });
  }

  let body: { appId?: string; overwrite?: boolean };
  try {
    body = (await req.json()) as { appId?: string; overwrite?: boolean };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const overwrite = !!body.overwrite;
  const targets = body.appId
    ? REGISTRY.apps.filter((a) => a.id === body.appId)
    : REGISTRY.apps;

  if (targets.length === 0) {
    return NextResponse.json({ error: 'app_not_found' }, { status: 404 });
  }

  const db = adminDb();
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const entry of targets) {
    const meta = APP_META[entry.id] ?? {};
    const ref = db.collection('apps_meta').doc(entry.id);
    const snap = await ref.get();
    if (snap.exists && !overwrite) {
      skipped++;
      continue;
    }
    const payload = {
      // Registry data
      id: entry.id,
      name: entry.name,
      tagline: entry.tagline,
      version: entry.version,
      size_bytes: entry.size_bytes,
      status: entry.status,
      release_at: entry.release_at ?? null,
      login_required: entry.login_required,
      platforms: entry.platforms,
      changelog_url: entry.changelog_url ?? '',
      download: entry.download ?? {},
      // Website meta
      features: (meta as { features?: string[] }).features ?? [],
      accent: (meta as { accent?: string }).accent ?? '#667EEA',
      icon_fallback: (meta as { icon_fallback?: string }).icon_fallback ?? 'Package',
      logo_path: (meta as { logo_path?: string }).logo_path ?? entry.logo_url ?? '',
      screenshots: entry.screenshots ?? [],
      // Audit
      _seeded_at: Date.now(),
      _seeded_by: caller.decoded.uid,
    };
    await ref.set(payload, { merge: !overwrite });
    if (snap.exists) updated++;
    else created++;
  }

  return NextResponse.json({
    ok: true,
    overwrite,
    total: targets.length,
    created,
    skipped,
    updated,
  });
}
