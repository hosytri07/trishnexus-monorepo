import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchAppsServer } from '@/lib/apps-server';
import { DownloadCards } from './DownloadCards';
import { OtherAppsSection } from './OtherAppsSection';
import { DownloadsSidebar } from './DownloadsSidebar';

/**
 * Phase 19.22 — /downloads page với fetch Firestore /apps_meta server-side.
 *
 * Server component async fetch app metadata 1 lần, pass props xuống
 * client components → tránh duplicate fetch + đảm bảo data nhất quán.
 *
 * Khi admin sửa qua /admin/apps → reload trang là thấy ngay.
 */

export const metadata = {
  title: 'Tải về — TrishTEAM',
  description:
    'Tải TrishLauncher và các ứng dụng TrishTEAM. Miễn phí, không cần đăng nhập.',
};

// Disable static generation — luôn fetch fresh data từ Firestore
export const dynamic = 'force-dynamic';

export default async function DownloadsPage() {
  const apps = await fetchAppsServer();
  const launcher = apps.find((a) => a.id === 'trishlauncher') ?? null;

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
        <DownloadsSidebar apps={apps} />

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
            chạy 6 ứng dụng desktop trong một giao diện. Dưới là các app đã
            phát hành riêng. Miễn phí, không cần đăng nhập.
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Phiên bản hiện tại còn alpha — chưa code-sign, Windows Defender /
            SmartScreen có thể cảnh báo. Click <em>More info → Run anyway</em>{' '}
            để tiếp tục.
          </p>

          {/* TrishLauncher section */}
          {launcher ? (
            <section id="trishlauncher" className="mb-12 scroll-mt-20">
              <div className="flex items-baseline justify-between mb-4">
                <h2
                  className="text-xl font-bold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  🚀 TrishLauncher
                </h2>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  v{launcher.version} · Khuyên dùng
                </span>
              </div>
              <DownloadCards launcher={launcher} />
            </section>
          ) : null}

          {/* Apps đã phát hành section */}
          <section>
            <h2
              className="text-xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Apps đã phát hành
            </h2>
            <OtherAppsSection apps={apps} />
          </section>
        </div>
      </div>
    </main>
  );
}
