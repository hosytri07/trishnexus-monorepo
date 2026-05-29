/**
 * BruFooter — Phase 78.6 Brutalist footer reusable.
 * Build by Tri (TrishTEAM) + author contact + nav links + newsletter.
 */
import Link from 'next/link';
import { Facebook, Mail, Phone, MessageCircle } from 'lucide-react';
import { BruNewsletter } from './bru-newsletter';

export function BruFooter() {
  return (
    <footer
      className="bru-section bru-section-sm"
      style={{ borderTop: '2px solid var(--bru-border)' }}
    >
      <div className="bru-container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 32,
            alignItems: 'start',
          }}
          className="md-footer-grid"
        >
          {/* About */}
          <div>
            <h3 className="bru-display-sm" style={{ marginBottom: 16 }}>
              TRISH<span className="bru-accent">TEAM</span>
            </h3>
            <p className="bru-body-sm" style={{ marginBottom: 16, maxWidth: 320 }}>
              Built by Trí (TrishTEAM). Hệ sinh thái công cụ tiếng Việt cho kỹ sư, sinh viên, học sinh — chia sẻ miễn phí.
            </p>
            <p className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10 }}>
              3 desktop apps · 11 modules · 100% Tiếng Việt · Offline-first
            </p>
          </div>

          {/* Navigate */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="bru-eyebrow" style={{ marginBottom: 4 }}>
              // Đi tới
            </span>
            <Link href="/apps" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Ứng dụng</Link>
            <Link href="/downloads" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Tải về</Link>
            <Link href="/blog" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Blog</Link>
            <Link href="/huong-dan" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Hướng dẫn</Link>
            <Link href="/qr" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ QR Code</Link>
            <Link href="/changelog" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Changelog</Link>
            <Link href="/roadmap" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Roadmap</Link>
            <Link href="/status" className="bru-mono" style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11 }}>→ Status</Link>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="bru-eyebrow" style={{ marginBottom: 4 }}>
              // Liên hệ
            </span>
            <a
              href="https://fb.com/hosytri07"
              target="_blank"
              rel="noopener noreferrer"
              className="bru-mono"
              style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Facebook size={12} /> Facebook
            </a>
            <a
              href="https://zalo.me/0969580657"
              target="_blank"
              rel="noopener noreferrer"
              className="bru-mono"
              style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Phone size={12} /> Zalo · 0969.580.657
            </a>
            <a
              href="https://t.me/+_f_Gqw2iy9M3Mjg1"
              target="_blank"
              rel="noopener noreferrer"
              className="bru-mono"
              style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <MessageCircle size={12} /> Telegram
            </a>
            <a
              href="mailto:trishteam.official@gmail.com"
              className="bru-mono"
              style={{ color: 'var(--bru-fg-dim)', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Mail size={12} /> trishteam.official@gmail.com
            </a>
          </div>

          {/* Newsletter */}
          <div>
            <BruNewsletter />
          </div>
        </div>

        <style>{`
          @media (min-width: 800px) {
            .md-footer-grid {
              grid-template-columns: 1.4fr 1fr 1.2fr 1.4fr !important;
            }
          }
        `}</style>

        <hr className="bru-divider" style={{ marginTop: 56 }} />
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10 }}>
            © 2026 TrishTEAM · v1.0
          </span>
          <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10 }}>
            trishteam.io.vn
          </span>
        </div>
      </div>
    </footer>
  );
}
