/**
 * app/robots.ts — Phase 16.1.
 *
 * Next.js App Router convention: return MetadataRoute.Robots → Next
 * generate `/robots.txt` tự động.
 *
 * Policy:
 *   - Allow: mọi route public.
 *   - Disallow: `/admin/*` (cần auth), `/api/*` (internal), `/offline`
 *     (PWA fallback — không cần Google index), `/_next/*` (build assets).
 *   - Sitemap: trỏ về `/sitemap.xml` cùng host.
 *
 * Google, Bing, DuckDuckGo đều tuân robots.txt. Một số crawler không
 * tuân (Common Crawl, GPTBot, ...) — nếu muốn block thêm, mở rộng rules
 * theo user-agent tại đây.
 */
import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://trishteam.io.vn';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/offline', '/_next/'],
      },
      // Opt-out khỏi AI training crawler (policy — tôn trọng dữ liệu user).
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'ClaudeBot', disallow: '/' },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
