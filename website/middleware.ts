import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Phase 35 — Maintenance / Coming Soon mode.
 *
 * Mục đích: che TOÀN BỘ website tới 09:00 sáng 07/05/2026 (giờ VN), sau
 * mốc đó TỰ ĐỘNG MỞ KHOÁ — không cần redeploy hay đổi env.
 *
 * Logic unlock:
 *  - `UNLOCK_TS` = 2026-05-07 09:00 +07:00. Mỗi request middleware so sánh
 *    `Date.now()` với mốc này. >= mốc → website hoạt động bình thường.
 *  - Edge middleware chạy lại mọi request (không cache) → unlock chính xác.
 *  - Sau khi unlock, nếu user còn URL `/coming-soon` → redirect về `/`.
 *
 * Override tay (nếu cần thay đổi mốc):
 *  - Set env `MAINTENANCE_MODE=false` trên Vercel → tắt ngay lập tức (không
 *    chờ tới mốc), redeploy.
 *  - Set env `MAINTENANCE_UNLOCK_TS=2026-05-08T09:00:00+07:00` → đổi mốc.
 *  - Xoá file `middleware.ts` để bỏ hẳn cơ chế.
 *
 * Bypass tạm thời (cho admin/test trước mốc unlock):
 *  - Mở URL có query `?preview=trishteam-2026` → set cookie `trish_preview=1`
 *    (7 ngày) → các request sau bypass landing.
 *  - Tắt cookie bypass: mở URL có `?preview=off`.
 *
 * Pattern allow (không bao giờ rewrite):
 *  - /_next/* (build assets)
 *  - /api/* (API routes — desktop apps cần /api/apps-registry)
 *  - File tĩnh có extension (favicon.ico, .png, .json, manifest, sitemap, robots…)
 */

const DEFAULT_UNLOCK_ISO = '2026-05-11T09:00:00+07:00';
const UNLOCK_TS = new Date(
  process.env.MAINTENANCE_UNLOCK_TS || DEFAULT_UNLOCK_ISO
).getTime();
const MAINTENANCE_ENABLED = process.env.MAINTENANCE_MODE !== 'false';
const PREVIEW_TOKEN = 'trishteam-2026';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow build assets, API, static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    /\.[\w]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Tính trạng thái lock realtime
  const now = Date.now();
  const isLocked = MAINTENANCE_ENABLED && now < UNLOCK_TS;

  // Toggle preview cookie (luôn xử lý kể cả sau khi unlock — để Trí xoá cookie cũ)
  const previewParam = searchParams.get('preview');
  if (previewParam === PREVIEW_TOKEN) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('preview');
    const res = NextResponse.redirect(url);
    res.cookies.set('trish_preview', '1', {
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  }
  if (previewParam === 'off') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('preview');
    const res = NextResponse.redirect(url);
    res.cookies.delete('trish_preview');
    return res;
  }

  // Đã unlock hoặc maintenance OFF → website bình thường
  if (!isLocked) {
    // Sau unlock, nếu còn URL /coming-soon → redirect về trang chủ
    if (pathname === '/coming-soon') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Còn lock + có cookie bypass → cho qua như user thường
  if (request.cookies.get('trish_preview')?.value === '1') {
    return NextResponse.next();
  }

  // /coming-soon truy cập trực tiếp khi đang lock: set header để layout skip nav
  if (pathname === '/coming-soon') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-maintenance', '1');
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Cache-Control', 'no-store, must-revalidate');
    return res;
  }

  // Rewrite về landing — URL gốc giữ nguyên trong browser
  const url = request.nextUrl.clone();
  url.pathname = '/coming-soon';
  url.search = '';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-maintenance', '1');

  // Cache-Control no-store để CDN/browser không phục vụ landing cũ sau khi
  // đã qua mốc unlock (đảm bảo refresh là thấy website mở ngay)
  const res = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  res.headers.set('Cache-Control', 'no-store, must-revalidate');
  return res;
}

export const config = {
  matcher: '/((?!_next/static|_next/image).*)',
};
