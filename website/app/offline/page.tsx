/**
 * /offline — Phase 78 Brutalist PWA offline fallback.
 */
'use client';

import Link from 'next/link';
import { WifiOff, ArrowRight } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="bru">
      <section
        className="bru-section"
        style={{
          paddingTop: 'clamp(80px, 12vw, 200px)',
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="bru-container-narrow" style={{ textAlign: 'center', margin: '0 auto' }}>
          <WifiOff
            size={80}
            strokeWidth={1.5}
            style={{ color: 'var(--bru-accent)', margin: '0 auto 32px' }}
          />
          <h1 className="bru-display-xl" style={{ marginBottom: 32 }}>
            BẠN ĐANG <span className="bru-accent">OFFLINE.</span>
          </h1>
          <p className="bru-body-lg" style={{ marginBottom: 48, maxWidth: 520, marginInline: 'auto' }}>
            Không kết nối được internet. Kiểm tra Wi-Fi / mobile data, rồi reload trang.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bru-btn bru-btn-primary bru-btn-lg"
            >
              Thử lại
              <ArrowRight size={18} strokeWidth={2.5} />
            </button>
            <Link href="/" className="bru-btn bru-btn-lg">
              Trang chủ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
