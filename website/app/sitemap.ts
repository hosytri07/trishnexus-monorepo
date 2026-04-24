/**
 * app/sitemap.ts — Phase 16.1.
 *
 * Next.js App Router convention: return MetadataRoute.Sitemap → Next tự
 * generate `/sitemap.xml` tại build time (hoặc runtime nếu dynamic).
 *
 * Site URL lấy từ `NEXT_PUBLIC_SITE_URL` (set ở Vercel). Fallback
 * `https://trishteam.io.vn` để local dev vẫn hợp lệ.
 *
 * Priority matrix:
 *   - 1.0  : landing `/`
 *   - 0.8  : `/apps`, `/downloads`
 *   - 0.7  : `/search`
 *   - 0.5  : `/login`, `/register` (entry points)
 *   - Không index: `/admin/*`, `/api/*`, `/offline` (xử lý ở robots.ts).
 *
 * Lưu ý: khi có dynamic routes (vd `/apps/[id]`), bổ sung vòng lặp đọc
 * từ app registry — hiện registry chưa expose public URL per-app nên
 * tạm giữ static.
 */
import type { MetadataRoute } from 'next';

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
  'https://trishteam.io.vn';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const daily = 'daily' as const;
  const weekly = 'weekly' as const;
  const monthly = 'monthly' as const;

  return [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: daily,
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/apps`,
      lastModified: now,
      changeFrequency: weekly,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/downloads`,
      lastModified: now,
      changeFrequency: weekly,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: now,
      changeFrequency: monthly,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: monthly,
      priority: 0.5,
    },
  ];
}
