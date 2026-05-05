/**
 * Phase 39.2 — Bulk import apps-registry.json → Firestore /apps_meta.
 *
 * Chạy 1 lần (hoặc khi update registry) để /downloads page hiển thị 11 apps.
 *
 * Cách chạy:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="./secrets/service-account.json"
 *   npx ts-node scripts/seed-apps-meta.ts
 *
 * Hoặc dùng Firebase CLI:
 *   firebase login
 *   npx ts-node scripts/seed-apps-meta.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as admin from 'firebase-admin';

const REGISTRY_PATH = path.join(
  __dirname,
  '..',
  'website',
  'public',
  'apps-registry.json',
);

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

async function main(): Promise<void> {
  // Init Firebase Admin
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'trishteam-17c2d',
    });
  }
  const db = admin.firestore();

  // Read registry
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`✗ Registry không tồn tại: ${REGISTRY_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const registry = JSON.parse(raw) as Registry;

  console.log(
    `Loading ${registry.apps.length} apps từ registry (schema v${registry.schema_version})…`,
  );

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const app of registry.apps) {
    if (app.status === 'deprecated') {
      console.log(`  ⏭  Skip deprecated: ${app.id}`);
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
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (existing.exists) {
      await ref.update(data);
      console.log(`  ✓ Updated: ${app.id}`);
      updated += 1;
    } else {
      await ref.set({
        ...data,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ➕ Created: ${app.id}`);
      added += 1;
    }
  }

  console.log(
    `\n✅ DONE: ${added} created, ${updated} updated, ${skipped} skipped (deprecated).`,
  );
  console.log(`   Tổng active = ${added + updated} apps trong /apps_meta.`);
  console.log(`   /downloads page sẽ tự hiển thị sau ~5 phút (Vercel CDN cache).`);
}

main().catch((err) => {
  console.error('✗ Lỗi:', err);
  process.exit(1);
});
