/**
 * ComingSoonPage — placeholder dùng chung cho các route đang phát triển.
 *
 * Phase 19.1: tạo lúc rebuild sidebar — các page chưa code thực thì
 * render component này để không 404. Khi nào bắt đầu Phase tương ứng,
 * chỉ việc thay component thật vào thôi.
 *
 * Props:
 *   - title:        Tên page hiển thị to (h1)
 *   - description:  Đoạn mô tả ngắn dưới title
 *   - icon:         Lucide icon component (optional)
 *   - status:       'coming' | 'wip' | 'desktop' — đổi badge
 *   - features:     List feature dự kiến (string[]) — tick checkbox
 *   - relatedApp:   { name, downloadUrl } — nếu có app desktop tương ứng
 */
import Link from 'next/link';
import { ArrowLeft, Check, Download, type LucideIcon } from 'lucide-react';

export type ComingStatus = 'coming' | 'wip' | 'desktop';

const STATUS_META: Record<ComingStatus, { label: string; bg: string; fg: string }> = {
  coming: {
    label: 'SẮP RA MẮT',
    bg: 'rgba(245,158,11,0.14)',
    fg: '#F59E0B',
  },
  wip: {
    label: 'ĐANG XÂY DỰNG',
    bg: 'rgba(244,114,49,0.14)',
    fg: '#F47231',
  },
  desktop: {
    label: 'CHỈ DESKTOP',
    bg: 'rgba(56,189,248,0.14)',
    fg: '#38BDF8',
  },
};

interface Props {
  title: string;
  description: string;
  icon?: LucideIcon;
  status: ComingStatus;
  features?: string[];
  relatedApp?: { name: string; downloadUrl: string };
}

export function ComingSoonPage({
  title,
  description,
  icon: Icon,
  status,
  features = [],
  relatedApp,
}: Props) {
  const statusMeta = STATUS_META[status];

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-8 text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={16} />
        Quay lại Dashboard
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          {Icon && (
            <div
              className="shrink-0 inline-flex items-center justify-center rounded-xl"
              style={{
                width: 56,
                height: 56,
                background: 'var(--color-accent-soft)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <Icon
                size={28}
                strokeWidth={1.75}
                style={{ color: 'var(--color-accent-primary)' }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span
              className="inline-block mb-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: statusMeta.bg, color: statusMeta.fg }}
            >
              {statusMeta.label}
            </span>
            <h1
              className="text-3xl md:text-4xl font-bold mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h1>
            <p
              className="text-base md:text-lg"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Features list */}
      {features.length > 0 && (
        <section className="mb-8">
          <h2
            className="text-sm font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Tính năng dự kiến
          </h2>
          <ul className="space-y-2.5">
            {features.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm md:text-base"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <span
                  className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded"
                  style={{
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Related desktop app CTA */}
      {relatedApp && (
        <section
          className="rounded-xl p-5 mb-8"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Đã có sẵn trên desktop
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Trong khi web còn đang xây dựng, anh có thể tải app{' '}
                <strong style={{ color: 'var(--color-accent-primary)' }}>
                  {relatedApp.name}
                </strong>{' '}
                để dùng đầy đủ tính năng ngay bây giờ.
              </p>
            </div>
            <Link
              href={relatedApp.downloadUrl}
              className="shrink-0 inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-accent-gradient)',
                color: '#ffffff',
              }}
            >
              <Download size={15} strokeWidth={2.25} />
              Tải về
            </Link>
          </div>
        </section>
      )}

      {/* Footer note */}
      <p
        className="text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Bạn đang xem trang đang trong giai đoạn phát triển. Theo dõi cập nhật
        ở{' '}
        <Link
          href="/blog"
          className="underline hover:no-underline"
          style={{ color: 'var(--color-accent-primary)' }}
        >
          Blog TrishTEAM
        </Link>
        .
      </p>
    </main>
  );
}
