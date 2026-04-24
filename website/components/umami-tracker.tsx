'use client';

/**
 * UmamiTracker — Phase 16.6.
 *
 * Inject script Umami khi cả hai env bất kỳ đều set:
 *   NEXT_PUBLIC_UMAMI_SRC          (ví dụ https://analytics.trishteam.io.vn/script.js)
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID   (UUID lấy từ Umami dashboard)
 *
 * Nếu chưa set → render null, không gửi request ngoài. An toàn cho dev.
 *
 * Dùng `next/script` với strategy `afterInteractive` để không chặn LCP.
 * Umami script tự phát hiện SPA navigation (App Router) nên không cần
 * hook `usePathname` manual.
 *
 * Privacy:
 *   - Cookie-less, không GDPR modal cần thiết.
 *   - IP anonymize, không share với bên thứ 3.
 *   - Tôn trọng `navigator.doNotTrack`: Umami script có cấu hình
 *     `data-do-not-track="true"` bỏ event khi DNT=1.
 */
import Script from 'next/script';

export function UmamiTracker() {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!src || !websiteId) return null;

  // Domain whitelist tuỳ chọn: mặc định track mọi host (production +
  // preview). Nếu muốn chỉ track prod, set NEXT_PUBLIC_UMAMI_DOMAINS.
  const domains = process.env.NEXT_PUBLIC_UMAMI_DOMAINS;

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      data-do-not-track="true"
      data-domains={domains || undefined}
      strategy="afterInteractive"
      // Async là mặc định trong Script — không chặn render.
    />
  );
}
