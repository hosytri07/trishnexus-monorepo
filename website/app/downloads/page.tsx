import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DownloadCards } from './DownloadCards';
import { OtherAppsSection } from './OtherAppsSection';
import { DownloadsSidebar } from './DownloadsSidebar';

/**
 * Phase 15.0.q/r — /downloads page với sticky sidebar TOC.
 *
 * Layout 2-column:
 *   - Sidebar (lg≥1024): list apps đã phát hành, anchor link nhảy section
 *   - Main: TrishLauncher (primary OS-detect) + Apps đã phát hành (dynamic
 *     từ registry — TrishCheck v1, future apps)
 *
 * Mobile (<lg): sidebar thành scroll-x list ngang ở top.
 *
 * Source data: website/public/apps-registry.json (qua lib/apps.ts).
 * Khi admin push app mới với status='released' → page tự cập nhật, không
 * cần deploy code lại.
 */

export const metadata = {
  title: 'Tải về — TrishTEAM',
  description:
    'Tải TrishLauncher và các ứng dụng TrishTEAM đã phát hành. Miễn phí, không cần đăng nhập.',
};

export default function DownloadsPage() {
  return (
    <main className="min-h-screen px-4 sm:px-8 py-12 max-w-6xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-8 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={16} />
        Quay lại
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8">
        {/* Sidebar */}
        <DownloadsSidebar />

        {/* Main content */}
        <div className="min-w-0">
          <h1
            className="font-extrabold uppercase mb-4"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              letterSpacing: '-0.015em',
              color: 'var(--color-text-primary)',
            }}
          >
            Tải về TrishTEAM
          </h1>
          <p
            className="text-lg mb-4"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            TrishLauncher là cổng vào hệ sinh thái — cài đặt + cập nhật + khởi
            chạy 9 ứng dụng desktop trong một giao diện. Dưới là các app đã
            phát hành riêng. Miễn phí, không cần đăng nhập.
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Phiên bản hiện tại còn alpha — chưa code-sign, Windows Defender /
            SmartScreen có thể cảnh báo. Click <em>More info → Run anyway</em>{' '}
            để tiếp tục.
          </p>

          {/* TrishLauncher section — anchor target */}
          <section id="trishlauncher" className="mb-12 scroll-mt-20">
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                🚀 TrishLauncher
              </h2>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                v2.0.1 · Khuyên dùng
              </span>
            </div>
            <DownloadCards />
          </section>

          {/* Apps đã phát hành section — mỗi app có id riêng */}
          <section>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Apps đã phát hành
            </h2>
            <OtherAppsSection />
          </section>
        </div>
      </div>
    </main>
  );
}
