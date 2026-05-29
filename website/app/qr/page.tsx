/**
 * /qr — Phase 78 QR Code Generator standalone (moved từ /cong-cu/qr-code).
 * Brutalist redesign — hero big typo + tool widget.
 */
import { QrCode } from 'lucide-react';
import { QrGeneratorWidget } from '@/components/widgets/qr-generator-widget';
import { BruFooter } from '@/components/bru/bru-footer';

export const metadata = {
  title: 'QR Code — TrishTEAM',
  description:
    'Tạo QR code từ URL hoặc text — auto-convert Google Drive / Docs / Sheets / Dropbox / YouTube.',
};

export default function QrPage() {
  return (
    <main className="bru">
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container-narrow">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Công cụ
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <QrCode size={64} strokeWidth={1.5} style={{ color: 'var(--bru-accent)', flexShrink: 0 }} />
            <h1 className="bru-display-lg" style={{ margin: 0 }}>
              QR <span className="bru-accent">CODE</span>
            </h1>
          </div>
          <p className="bru-body-lg" style={{ marginBottom: 48 }}>
            Tạo QR code từ URL hoặc text bất kỳ. Tự động chuyển link Drive / Docs / Sheets / Dropbox / YouTube
            sang dạng <strong style={{ color: 'var(--bru-fg)' }}>tải trực tiếp</strong> khi quét.
          </p>

          {/* Widget wrapper với brutalist border */}
          <div
            style={{
              border: '2px solid var(--bru-border-strong)',
              padding: 'clamp(20px, 4vw, 40px)',
              background: 'var(--bru-bg-elevated)',
            }}
          >
            <QrGeneratorWidget />
          </div>

          <div className="bru-grid-3" style={{ marginTop: 64 }}>
            {[
              { title: 'URL', text: 'Paste link → quét điện thoại mở ngay trên Chrome/Safari.' },
              { title: 'Drive / Docs', text: 'Auto-convert sang URL tải trực tiếp, bỏ qua preview.' },
              { title: 'Text', text: 'Bất kỳ chuỗi text nào — note, mã, tin nhắn, contact info.' },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  borderLeft: '2px solid var(--bru-accent)',
                  paddingLeft: 16,
                }}
              >
                <h3 className="bru-mono" style={{ color: 'var(--bru-accent)', marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p className="bru-body-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
