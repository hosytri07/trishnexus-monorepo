/**
 * GET /api/apps-registry — Phase 20.2.
 *
 * Trả AppRegistry shape (tương thích `apps-registry.json` static) đọc thẳng
 * từ Firestore `/apps_meta/{appId}`. Mục đích: TrishLauncher fetch endpoint
 * này thay vì static JSON → admin sửa qua /admin/apps thì launcher next-fetch
 * sẽ thấy ngay (không cần redeploy web).
 *
 * Header: Cache-Control public 60s — Firestore đủ nhanh, cache giảm spike.
 *
 * Fallback: nếu Admin SDK chưa cấu hình hoặc Firestore lỗi → trả 503 để
 * launcher fall back về seed built-in (đã handle ở registry-loader.ts).
 */
import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCHEMA_VERSION = 3;
const RELEASE_AT_DEFAULT = '2026-05-04T09:00:00+07:00';

interface AppMetaDoc {
  name?: string;
  tagline?: string;
  logo_url?: string;
  version?: string;
  size_bytes?: number;
  status?: string;
  release_at?: string | null;
  login_required?: string;
  platforms?: string[];
  screenshots?: string[];
  changelog_url?: string;
  download?: Record<
    string,
    { url?: string; sha256?: string; installer_args?: string[] } | undefined
  >;
}

export async function GET() {
  if (!adminReady()) {
    return NextResponse.json(
      { error: 'Admin SDK chưa cấu hình' },
      { status: 503 },
    );
  }
  try {
    const db = adminDb();
    const snap = await db.collection('apps_meta').get();
    const apps = snap.docs
      .map((d) => {
        const data = d.data() as AppMetaDoc;
        return {
          id: d.id,
          name: data.name ?? d.id,
          tagline: data.tagline ?? '',
          logo_url:
            data.logo_url ?? `https://trishteam.io.vn/logos/${d.id}.png`,
          version: data.version ?? '1.0.0',
          size_bytes: data.size_bytes ?? 0,
          status: data.status ?? 'scheduled',
          ...(data.release_at ? { release_at: data.release_at } : {}),
          login_required: data.login_required ?? 'none',
          platforms: data.platforms ?? ['windows_x64'],
          screenshots: data.screenshots ?? [],
          changelog_url: data.changelog_url ?? '',
          download: data.download ?? {
            windows_x64: { url: '', sha256: '', installer_args: [] },
          },
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    const registry = {
      schema_version: SCHEMA_VERSION,
      updated_at: new Date().toISOString(),
      ecosystem: {
        name: 'TrishTEAM',
        tagline: 'Hệ sinh thái năng suất cá nhân',
        logo_url: 'https://trishteam.io.vn/logo.svg',
        website: 'https://trishteam.io.vn',
      },
      release_at_default: RELEASE_AT_DEFAULT,
      apps,
    };

    return NextResponse.json(registry, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[api/apps-registry] fail:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
