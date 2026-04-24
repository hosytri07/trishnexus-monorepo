import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: '10 ứng dụng — TrishTEAM',
  description: 'Danh sách 10 app desktop: TrishFont, TrishDesign, TrishNote, TrishCheck, TrishLaunch và 5 app khác.',
};

export default function AppsPage() {
  return (
    <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
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
        10 ứng dụng
      </h1>
      <p className="text-lg mb-12" style={{ color: 'var(--color-text-secondary)' }}>
        Grid 10 app với logo + description + tags sẽ wire ở{' '}
        <span style={{ color: 'var(--color-accent-primary)' }}>Phase 11.1</span> —
        đọc từ <code>shared/apps.json</code> registry.
      </p>

      <div
        className="border rounded-lg p-8 text-center"
        style={{
          borderColor: 'var(--color-border-subtle)',
          background: 'var(--color-surface-card)',
          color: 'var(--color-text-muted)',
        }}
      >
        <p className="text-sm">🚧 Coming soon — Phase 11.1 landing đầy đủ.</p>
      </div>
    </main>
  );
}
