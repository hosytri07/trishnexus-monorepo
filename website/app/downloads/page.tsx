import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DownloadCards } from './DownloadCards';
import { getAppById } from '@/lib/apps';
import type { AppForWebsite } from '@/lib/apps';

/**
 * Phase 38 — Slim /downloads page chỉ Launcher.
 * Đọc thẳng static apps-registry.json (build-time bundle) thay vì Firestore
 * server-side fetch — tránh runtime error khi Firestore admin SDK fail.
 */

export const metadata = {
  title: 'Tải TrishLauncher — TrishTEAM',
  description:
    'Tải TrishLauncher — cổng vào hệ sinh thái TrishTEAM. Miễn phí, không cần đăng nhập.',
};

export default function DownloadsPage() {
  const launcher: AppForWebsite | null = getAppById('trishlauncher');

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

      <div className="max-w-3xl mx-auto">
        <h1
          className="font-extrabold uppercase mb-4 text-center"
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            letterSpacing: '-0.015em',
            color: 'var(--color-text-primary)',
          }}
        >
          Tải TrishLauncher
        </h1>
        <p
          className="text-lg mb-4 text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          TrishLauncher là cổng vào hệ sinh thái TrishTEAM — cài đặt, cập nhật
          và khởi chạy toàn bộ ứng dụng desktop trong một giao diện duy nhất.
        </p>
        <p
          className="text-sm mb-10 text-center"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Phiên bản hiện tại còn alpha — chưa code-sign, Windows Defender /
          SmartScreen có thể cảnh báo. Click <em>More info → Run anyway</em> để
          tiếp tục cài.
        </p>

        {launcher ? (
          <section id="trishlauncher" className="mb-12">
            <div className="flex items-baseline justify-between mb-4">
              <h2
                className="text-xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                🚀 TrishLauncher
              </h2>
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                v{launcher.version}
              </span>
            </div>
            <DownloadCards launcher={launcher} />
          </section>
        ) : (
          <p
            className="text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Không tải được thông tin Launcher. Thử lại sau.
          </p>
        )}

        <section
          className="mt-12 p-6 rounded-lg"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          <h3
            className="text-base font-bold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            📦 Các ứng dụng khác
          </h3>
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            TrishCheck · TrishFont · TrishClean · TrishShortcut · TrishLibrary ·
            TrishDrive · TrishFinance · TrishISO · TrishDesign · TrishOffice
          </p>
          <p
            className="text-sm mt-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Tất cả ứng dụng được cài đặt + cập nhật qua TrishLauncher. Tải
            Launcher ở trên → mở app → chọn ứng dụng cần cài.
          </p>
        </section>
      </div>
    </main>
  );
}
