/**
 * app/sitemap.ts — Phase 19.20 (cập nhật full routes Phase 19.20).
 *
 * Routes priority matrix:
 *   - 1.0  : `/`
 *   - 0.9  : `/downloads`, `/blog`
 *   - 0.8  : `/thu-vien`, `/ghi-chu`, `/tai-lieu` (apps đồng bộ)
 *   - 0.75 : `/bien-bao`, `/cau-vn`, `/duong-vn`, `/quy-chuan`, `/dinh-muc`, `/vat-lieu` (database SEO cao)
 *   - 0.7  : `/on-thi-lai-xe`, `/on-thi-chung-chi`, `/tin-hoc-vp`, `/tieng-anh` (học tập)
 *   - 0.65 : `/ung-ho`
 *   - 0.6  : `/cong-cu/*` (tools)
 *   - 0.5  : `/login`, `/profile`, `/settings`
 *   - 0.4  : `/search`
 *
 * Không index: `/admin/*`, `/api/*`, `/offline`, `/anh` (chỉ desktop) → xử lý ở robots.ts.
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

  const make = (
    path: string,
    priority: number,
    changeFrequency: 'daily' | 'weekly' | 'monthly' = weekly,
  ) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    make('/', 1.0, daily),
    make('/downloads', 0.9),
    make('/blog', 0.9, daily),

    // Apps đồng bộ với desktop
    make('/thu-vien', 0.8),
    make('/ghi-chu', 0.8),
    make('/tai-lieu', 0.8),

    // Database (content pages có giá trị SEO cao)
    make('/bien-bao', 0.75, monthly),
    make('/cau-vn', 0.75, monthly),
    make('/duong-vn', 0.75, monthly),
    make('/quy-chuan', 0.75, monthly),
    make('/dinh-muc', 0.75, monthly),
    make('/vat-lieu', 0.75, monthly),

    // Học tập
    make('/on-thi-lai-xe', 0.7),
    make('/on-thi-chung-chi', 0.7),
    make('/tin-hoc-vp', 0.7),
    make('/tieng-anh', 0.7),

    // Cộng đồng
    make('/ung-ho', 0.65, monthly),

    // Công cụ
    make('/cong-cu/pomodoro', 0.6, monthly),
    make('/cong-cu/may-tinh-tai-chinh', 0.6, monthly),
    make('/cong-cu/qr-code', 0.6, monthly),
    make('/cong-cu/thoi-tiet', 0.6, monthly),
    make('/cong-cu/lich', 0.6, monthly),
    make('/cong-cu/ghi-chu-nhanh', 0.6, monthly),
    make('/cong-cu/don-vi', 0.6, monthly),
    make('/cong-cu/tinh-ngay', 0.6, monthly),
    make('/cong-cu/bmi', 0.6, monthly),
    make('/cong-cu/rut-gon-link', 0.6, monthly),
    make('/cong-cu/mat-khau', 0.6, monthly),
    make('/cong-cu/base64', 0.6, monthly),
    make('/cong-cu/hash', 0.6, monthly),
    make('/cong-cu/vn2000', 0.6, monthly),

    // Tài khoản + tìm kiếm
    make('/login', 0.5, monthly),
    make('/profile', 0.5, monthly),
    make('/settings', 0.5, monthly),
    make('/search', 0.4, monthly),
  ];
}
