import Link from 'next/link';
import { ArrowLeft, QrCode } from 'lucide-react';
import { QrGeneratorWidget } from '@/components/widgets/qr-generator-widget';

export const metadata = {
  title: 'QR Code Generator — TrishTEAM',
  description: 'Tạo QR code từ URL hoặc text — auto-convert Google Drive / Docs / Sheets / Dropbox / YouTube.',
};

export default function QrCodePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <QrCode size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>QR Code Generator</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tạo QR code từ URL hoặc text bất kỳ. Tự động chuyển link Drive / Docs / Sheets / Dropbox / YouTube sang dạng tải trực tiếp khi quét.
        </p>
      </header>

      <QrGeneratorWidget />
    </main>
  );
}
