import Link from 'next/link';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';

/**
 * Phase 38 — Slim /downloads page chỉ Launcher.
 *
 * Hardcode launcher info để tránh hoàn toàn mọi runtime error:
 *   - Không gọi getAppById/Firestore/registry import
 *   - Không phụ thuộc TS type AppForWebsite (đã làm fail SSR trong production)
 *   - Update version + URL khi release Launcher mới (4-5 lần/năm)
 */

export const metadata = {
  title: 'Tải TrishLauncher — TrishTEAM',
  description:
    'Tải TrishLauncher — cổng vào hệ sinh thái TrishTEAM. Miễn phí, không cần đăng nhập.',
};

const LAUNCHER = {
  version: '1.0.0',
  size_mb: 4.7,
  url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishlauncher-v1.0.0/TrishLauncher_1.0.0_x64-setup.exe',
  sha256: '5f878ebf32e6aba0a13e254c72f558f0d9c0471c94be28a526ba2c05b76c2b80',
  releases_url:
    'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlauncher-v1.0.0',
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

        <section id="trishlauncher" className="mb-12">
          <div
            className="border rounded-lg p-6 flex flex-col items-center text-center"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-accent-primary)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {/* Logo */}
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 text-5xl"
              style={{ background: '#ffffff' }}
            >
              🚀
            </div>

            {/* Title + version */}
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              TrishLauncher
            </h2>
            <div
              className="text-sm mb-4"
              style={{ color: 'var(--color-text-muted)' }}
            >
              v{LAUNCHER.version} · {LAUNCHER.size_mb} MB · Windows x64
            </div>

            {/* Download button */}
            <a
              href={LAUNCHER.url}
              download
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-base transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-accent-primary)',
                color: '#ffffff',
              }}
            >
              <Download size={18} strokeWidth={2.25} />
              Tải về Windows
            </a>

            {/* Release notes link */}
            <a
              href={LAUNCHER.releases_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-xs underline"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Xem release notes trên GitHub →
            </a>
          </div>

          {/* Verify checksum */}
          <details
            className="mt-4 border rounded-lg p-4"
            style={{
              borderColor: 'var(--color-border-default)',
              background: 'var(--color-surface-card)',
            }}
          >
            <summary
              className="cursor-pointer text-sm font-semibold flex items-center gap-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <ShieldCheck size={14} />
              Verify SHA256 (khuyến khích)
            </summary>
            <p
              className="text-sm mt-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Sau khi tải, mở PowerShell tại folder chứa file và chạy:
            </p>
            <pre
              className="font-mono text-xs p-3 rounded mt-2 overflow-x-auto"
              style={{
                background: 'var(--color-surface-bg-elevated)',
                color: 'var(--color-text-primary)',
              }}
            >
              {`Get-FileHash .\\TrishLauncher_${LAUNCHER.version}_x64-setup.exe -Algorithm SHA256`}
            </pre>
            <p
              className="text-xs mt-2 break-all"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Hash đúng: <code>{LAUNCHER.sha256}</code>
            </p>
          </details>
        </section>

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
