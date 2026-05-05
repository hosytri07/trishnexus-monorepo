/**
 * POST /api/admin/seed-apps-meta — Phase 39.2.
 *
 * Bulk import apps-registry.json → Firestore /apps_meta. Chỉ admin được phép gọi.
 *
 * Header: Authorization: Bearer <Firebase ID token of admin>
 *
 * Response: { ok: true, added, updated, skipped, total }
 *
 * Cách trigger:
 *   curl.exe -X POST https://trishteam.io.vn/api/admin/seed-apps-meta `
 *     -H "Authorization: Bearer <ID_TOKEN>"
 *
 * Lấy ID_TOKEN: vào https://trishteam.io.vn/profile, F12 console:
 *   firebase.auth().currentUser.getIdToken().then(t => navigator.clipboard.writeText(t))
 */
import { NextResponse, type NextRequest } from 'next/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegistryApp {
  id: string;
  name: string;
  tagline: string;
  logo_url: string;
  version: string;
  size_bytes: number;
  status: string;
  release_at?: string;
  login_required: string;
  requires_key?: boolean;
  key_type?: string;
  platforms: string[];
  screenshots: string[];
  changelog_url: string;
  download: Record<string, { url: string; sha256: string; installer_args: string[] }>;
}

interface Registry {
  schema_version: number;
  updated_at: string;
  apps: RegistryApp[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Verify admin
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'unauthenticated', message: 'Cần Authorization: Bearer <ID_TOKEN>' },
      { status: 401 },
    );
  }
  const idToken = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid-token', detail: (err as Error).message },
      { status: 401 },
    );
  }

  // Check admin role
  const db = adminDb();
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Chỉ admin được phép gọi endpoint này.' },
      { status: 403 },
    );
  }

  // Read registry
  const registryPath = path.join(process.cwd(), 'public', 'apps-registry.json');
  if (!fs.existsSync(registryPath)) {
    return NextResponse.json(
      { error: 'registry-not-found', path: registryPath },
      { status: 500 },
    );
  }
  let registry: Registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    return NextResponse.json(
      { error: 'parse-error', detail: (err as Error).message },
      { status: 500 },
    );
  }

  // Bulk import
  const { FieldValue } = await import('firebase-admin/firestore');
  const log: string[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const app of registry.apps) {
    if (app.status === 'deprecated') {
      log.push(`⏭ Skip deprecated: ${app.id}`);
      skipped += 1;
      continue;
    }
    const ref = db.collection('apps_meta').doc(app.id);
    const existing = await ref.get();
    const data = {
      id: app.id,
      name: app.name,
      tagline: app.tagline,
      logo_url: app.logo_url,
      version: app.version,
      size_bytes: app.size_bytes,
      status: app.status,
      release_at: app.release_at ?? null,
      login_required: app.login_required,
      requires_key: app.requires_key ?? false,
      key_type: app.key_type ?? null,
      platforms: app.platforms,
      screenshots: app.screenshots,
      changelog_url: app.changelog_url,
      download: app.download,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
      await ref.update(data);
      log.push(`✓ Updated: ${app.id}`);
      updated += 1;
    } else {
      await ref.set({
        ...data,
        created_at: FieldValue.serverTimestamp(),
      });
      log.push(`➕ Created: ${app.id}`);
      added += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    schema_version: registry.schema_version,
    total_apps: registry.apps.length,
    added,
    updated,
    skipped,
    log,
  });
}
