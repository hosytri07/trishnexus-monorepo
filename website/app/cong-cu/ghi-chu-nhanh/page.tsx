import Link from 'next/link';
import { ArrowLeft, StickyNote } from 'lucide-react';
import { QuickNotesWidget } from '@/components/widgets/notes-widget';

export const metadata = {
  title: 'Ghi chú nhanh — TrishTEAM',
  description: 'Ghi chú ngắn local + sync với TrishLibrary 3.0 module Ghi chú khi đăng nhập.',
};

export default function QuickNotesPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <StickyNote size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Ghi chú nhanh</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Ghi chú ngắn lưu local trong trình duyệt. Khi đăng nhập, sẽ sync với module Ghi chú trong TrishLibrary 3.0 desktop.
        </p>
      </header>

      <QuickNotesWidget />
    </main>
  );
}
