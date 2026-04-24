/**
 * NewsWidget — "Bảng tin mới nhất".
 * Hiện preview posts (stub) đến khi Phase 11.2e có CMS thật
 * (Firestore collection `posts` hoặc MDX collection).
 *
 * Vị trí trên dashboard: cột trái dưới Holidays, để cân height
 * với Ecosystem 10-app grid bên phải.
 */
import Link from 'next/link';
import { FileText, ArrowRight } from 'lucide-react';
import { WidgetCard } from './widget-card';

type Post = {
  id: string;
  title: string;
  excerpt: string;
  published_at: string;
  category: string;
  pinned?: boolean;
};

// Preview stubs — sẽ thay bằng CMS ở Phase 11.2e
const STUB_POSTS: Post[] = [
  {
    id: 'phase-11-5',
    title: 'Phase 11.5 — Dashboard mở rộng, navbar mới, panel user/admin',
    excerpt:
      'Release note: tách Giá (Xăng / Vàng / Ngoại tệ) thành 3 card, thêm banner admin, port navbar FEZ với panel user + admin + notifications.',
    published_at: '2026-04-23T00:00:00Z',
    category: 'Release',
    pinned: true,
  },
  {
    id: 'coming-cms',
    title: 'Phase 11.6 — Firebase Auth + CMS Firestore (đang build)',
    excerpt:
      'User login qua Google / Email, role-based (user vs admin), quản lý posts/announcements qua /admin. Dự kiến cuối tháng 5/2026.',
    published_at: '2026-04-20T00:00:00Z',
    category: 'Roadmap',
  },
  {
    id: 'signs-db',
    title: 'Kế hoạch "Biển báo VN" — 500+ biển báo GTĐB có tìm kiếm',
    excerpt:
      'Database biển báo giao thông đường bộ Việt Nam 2020 (QCVN 41:2019), kèm hình, ý nghĩa, hiệu lực, vị trí đặt. Tìm theo tên, nhóm, màu sắc.',
    published_at: '2026-04-15T00:00:00Z',
    category: 'Feature',
  },
  {
    id: 'cau-vn',
    title: 'Dữ liệu "Cầu Việt Nam" — 200+ cầu lớn có tọa độ + thông số',
    excerpt:
      'Danh mục các cầu lớn trên QL/Tỉnh lộ kèm kết cấu (dầm, vòm, dây văng), tải trọng thiết kế, đơn vị thi công, năm hoàn thành, hình ảnh.',
    published_at: '2026-04-10T00:00:00Z',
    category: 'Feature',
  },
  {
    id: 'exam-prep',
    title: 'Ôn thi chứng chỉ Xây dựng — đề tổng hợp + câu hỏi trắc nghiệm',
    excerpt:
      'Bộ đề ôn thi kỹ sư định giá, giám sát, an toàn lao động. Chia theo chương, có giải thích đáp án và lịch sử làm bài.',
    published_at: '2026-04-05T00:00:00Z',
    category: 'Hướng dẫn',
  },
  {
    id: 'trishfont-beta',
    title: 'TrishFont v0.9 beta mở đăng ký — quản lý font tiếng Việt',
    excerpt:
      'Scan toàn bộ font Windows, preview trực quan, lọc theo họ font/Việt hóa, export danh sách .csv. Đang tuyển 20 tester nội bộ.',
    published_at: '2026-03-28T00:00:00Z',
    category: 'App',
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function NewsWidget() {
  const hasPosts = STUB_POSTS.length > 0;

  return (
    <WidgetCard
      title="Bảng tin mới nhất"
      icon={<FileText size={16} strokeWidth={2} />}
      action={
        <Link
          href="/posts"
          className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--color-text-link)' }}
        >
          Xem tất cả
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      }
    >
      {hasPosts ? (
        <ul className="space-y-3">
          {STUB_POSTS.map((p) => (
            <li key={p.id} className="group">
              <Link
                href={`/posts/${p.id}`}
                className="block p-3 -mx-3 rounded-md transition-colors hover:bg-[var(--color-surface-muted)]"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {p.pinned && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245,158,11,0.30)',
                      }}
                      aria-label="Ghim"
                    >
                      PIN
                    </span>
                  )}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-accent-primary)',
                    }}
                  >
                    {p.category}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {formatDate(p.published_at)}
                  </span>
                </div>
                <h4
                  className="font-semibold text-sm mb-1 group-hover:underline leading-snug"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {p.title}
                </h4>
                <p
                  className="text-xs line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {p.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="text-sm py-6 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Chưa có bài viết nào. Phase 11.2e sẽ có CMS + posts đầu tiên.
        </div>
      )}
    </WidgetCard>
  );
}
