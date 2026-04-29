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
import { fetchAppByIdServer } from '@/lib/apps-server';

export async function GET(
  request: Request,
  { params }: { params: { appId: string } },
): Promise<Response> {
  const appId = params.appId.toLowerCase();
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') ?? 'windows_x64';

  // Phase 19.22 — fetch từ Firestore /apps_meta/{id} (admin có thể sửa qua /admin/apps).
  // Fallback registry.json nếu Firestore trống/lỗi.
  const app = await fetchAppByIdServer(appId);
  if (!app) {
    return NextResponse.json(
      { error: `App "${appId}" not found` },
      { status: 404 },
    );
  }

  if (app.status === 'deprecated') {
    return NextResponse.json(
      {
        error: `App "${appId}" đã deprecated. Đã gộp vào TrishLibrary.`,
        suggested: '/dl/trishlibrary',
      },
      { status: 410 },
    );
  }

  // Phase 19.22 — scheduled: kiểm tra release_at
  if (app.status === 'scheduled') {
    const releaseAt = (app as { release_at?: string }).release_at;
    if (!releaseAt) {
      return NextResponse.json(
        { error: `App "${appId}" chưa có ngày phát hành.` },
        { status: 503 },
      );
    }
    const target = new Date(releaseAt).getTime();
    if (Date.now() < target) {
      const formatted = new Date(releaseAt).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return NextResponse.json(
        {
          error: `App "${appId}" sẽ phát hành lúc ${formatted}. Hiện chưa cho phép tải.`,
          release_at: releaseAt,
        },
        { status: 423 },
      );
    }
    // Đã qua release_at → cho phép tải
  } else if (app.status !== 'released') {
    return NextResponse.json(
      { error: `App "${appId}" chưa release. Status: ${app.status}` },
      { status: 503 },
    );
  }

  const dl = app.download?.[platform as keyof typeof app.download];
  if (!dl?.url) {
    return NextResponse.json(
      { error: `App "${appId}" không có bản tải cho platform "${platform}"` },
      { status: 404 },
    );
  }

  // 302 redirect → browser bắt đầu download trực tiếp
  return NextResponse.redirect(dl.url, 302);
}
