import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';

export const metadata = {
  title: 'Tải TrishLauncher — TrishTEAM',
  description: 'Tải TrishLauncher để cài + update 10 ứng dụng desktop của TrishTEAM.',
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
      <p className="text-lg mb-12" style={{ color: 'var(--color-text-secondary)' }}>
        TrishLauncher là app chính — cài, update và mở 10 app còn lại. Link GitHub Release sẽ wire ở{' '}
        <span style={{ color: 'var(--color-accent-primary)' }}>Phase 11.2</span>.
      </p>

      <div
        className="border rounded-lg p-8 text-center"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-surface-card)',
          color: 'var(--color-text-muted)',
        }}
      >
        <Download size={32} className="mx-auto mb-3" style={{ opacity: 0.5 }} />
        <p className="text-sm">🚧 Chưa có release. Phase 11.2 sẽ link tới GitHub Release mới nhất.</p>
      </div>
    </main>
  );
}
