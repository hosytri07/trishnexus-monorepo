/**
 * GET /dl/[appId] — Phase 19.17 — URL cloak cho download links.
 *
 * User click "Tải về" trên website thấy URL `https://trishteam.io.vn/dl/trishlauncher`
 * thay vì URL trực tiếp `https://github.com/hosytri07/trishnexus-monorepo/releases/...`.
 * → Repo gốc bị che, người dùng không thấy structure ecosystem.
 *
 * Implementation:
 *   - Server-side fetch /apps-registry.json để lấy URL thật
 *   - Trả 302 redirect về URL đó (browser tự download)
 *   - Hỗ trợ optional ?platform=windows_x64 để chọn platform
 *
 * Bonus: track download count qua Firestore /downloads_log/{ts} (tùy chọn,
 * MVP chưa enable để giữ rules đơn giản).
 */
import { NextResponse } from 'next/server';
import registry from '@/public/apps-registry.json';

interface AppEntry {
  id: string;
  status: string;
  download?: Record<string, { url?: string }>;
}

const REGISTRY = registry as { apps: AppEntry[] };

const TRISHLAUNCHER_FALLBACK = {
  url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/launcher-v2.0.1/TrishLauncher_2.0.1_x64-setup.exe',
};

export async function GET(
  request: Request,
  { params }: { params: { appId: string } },
): Promise<Response> {
  const appId = params.appId.toLowerCase();
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') ?? 'windows_x64';

  // Special case: trishlauncher (không có trong registry, hardcode trong lib/apps.ts)
  if (appId === 'trishlauncher') {
    return NextResponse.redirect(TRISHLAUNCHER_FALLBACK.url, 302);
  }

  // Lookup app trong registry
  const app = REGISTRY.apps.find((a) => a.id === appId);
  if (!app) {
    return NextResponse.json(
      { error: `App "${appId}" not found` },
      { status: 404 },
    );
  }

  if (app.status === 'deprecated') {
    return NextResponse.json(
      {
        error: `App "${appId}" đã deprecated. Đã gộp vào TrishLibrary 3.0.`,
        suggested: '/dl/trishlibrary',
      },
      { status: 410 },
    );
  }

  if (app.status !== 'released') {
    return NextResponse.json(
      { error: `App "${appId}" chưa release. Status: ${app.status}` },
      { status: 503 },
    );
  }

  const dl = app.download?.[platform];
  if (!dl?.url) {
    return NextResponse.json(
      { error: `App "${appId}" không có bản tải cho platform "${platform}"` },
      { status: 404 },
    );
  }

  // 302 redirect → browser bắt đầu download trực tiếp
  return NextResponse.redirect(dl.url, 302);
}
