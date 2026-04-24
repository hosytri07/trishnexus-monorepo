import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DownloadCards } from './DownloadCards';

export const metadata = {
  title: 'Tải TrishLauncher — TrishTEAM',
  description:
    'Tải TrishLauncher (miễn phí) để cài, cập nhật và khởi chạy 10 ứng dụng desktop của TrishTEAM. Hỗ trợ Windows, macOS, Linux.',
};

export default function DownloadsPage() {
  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-8 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={16} />
        Quay lại
      </Link>

      <h1
        className="font-extrabold uppercase mb-4"
        style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          letterSpacing: '-0.015em',
          color: 'var(--color-text-primary)',
        }}
      >
        Tải TrishLauncher
      </h1>
      <p className="text-lg mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        TrishLauncher là cổng vào hệ sinh thái TrishTEAM — cài đặt, cập nhật và khởi chạy 10
        ứng dụng desktop chỉ trong một giao diện. Miễn phí, không cần đăng nhập.
      </p>
      <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
        Phiên bản hiện tại:{' '}
        <strong style={{ color: 'var(--color-text-primary)' }}>v2.0.0-1 (alpha)</strong> — chưa
        code-sign, Windows Defender / SmartScreen có thể cảnh báo. Click{' '}
        <em>More info → Run anyway</em> để tiếp tục.
      </p>

      <DownloadCards />
    </main>
  );
}
