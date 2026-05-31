/**
 * /downloads — Phase 78 Brutalist redesign.
 * 4 desktop apps: TrishWork, TrishUtilities, TrishFinance, TrishAdmin.
 * Mỗi app card có version, size, download URL, SHA256.
 */
import Link from 'next/link';
import { Download, ShieldCheck, ArrowRight, Github } from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';

export const metadata = {
  title: 'Tải về — TrishTEAM',
  description: 'Tải 4 ứng dụng desktop TrishTEAM. Miễn phí. Windows 10/11 x64.',
};

const APPS = [
  {
    id: 'trishutilities',
    name: 'TrishUtilities',
    tagline: 'Dọn dẹp · Kiểm tra · Tải · Font · Shortcut',
    accent: '#FBBF24',
    version: '1.0.0',
    size_mb: 4.42,
    url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishutilities-v1.0.0/TrishUtilities_1.0.0_x64-setup.exe',
    sha256: 'e3276c1d883248c5082d8bddbd0a755d5fb06b3547c11e6084e11fda31a89892',
    releases_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishutilities-v1.0.0',
    status: 'stable',
  },
  {
    id: 'trishwork',
    name: 'TrishWork',
    tagline: 'Kỹ sư · Thư viện · ISO',
    accent: '#34D399',
    version: '1.0.0',
    size_mb: 48.1,
    url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishwork-v1.0.0/TrishWork_1.0.0_x64-setup.exe',
    sha256: 'def...',
    releases_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishwork-v1.0.0',
    status: 'stable',
  },
  {
    id: 'trishfinance',
    name: 'TrishFinance',
    tagline: '12 loại business · POS · F&B · Spa · Gym...',
    accent: '#2563EB',
    version: '1.0.0',
    size_mb: 3.36,
    url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/download/trishfinance-v1.0.0/TrishFinance_1.0.0_x64-setup.exe',
    sha256: 'a317745d7f371c85594abb2887c8721c627e7bb90ec65403cd8d7374c8fd5d4e',
    releases_url: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishfinance-v1.0.0',
    status: 'stable',
  },
] as const;

export default function DownloadsPage() {
  return (
    <main className="bru">
      {/* HERO */}
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Installer Windows 10/11 x64
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32 }}>
            TẢI <span className="bru-accent">MIỄN PHÍ.</span>
            <br />
            CÀI 1 LẦN.
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 640, marginBottom: 16 }}>
            4 ứng dụng desktop riêng — mỗi installer ~40-50 MB. Đăng nhập 1 lần Firebase Auth → dùng được toàn ecosystem.
          </p>
          <p className="bru-mono" style={{ color: 'var(--bru-fg-muted)' }}>
            <ShieldCheck size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
            Code-signed · Auto-update qua TrishTEAM updater
          </p>
        </div>
      </section>

      {/* APP CARDS */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container">
          <div className="bru-grid-2">
            {APPS.map((app) => (
              <div
                key={app.id}
                className="bru-card"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                {/* Accent strip top */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 4,
                    background: app.accent,
                  }}
                />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                  <h2
                    style={{
                      fontSize: 'clamp(24px, 2.8vw, 32px)',
                      fontWeight: 900,
                      letterSpacing: '-0.03em',
                      lineHeight: 1.05,
                      color: app.accent,
                    }}
                  >
                    {app.name}
                  </h2>
                  {app.status === 'admin-only' && (
                    <span className="bru-tag bru-tag-accent">Admin only</span>
                  )}
                </div>

                <p className="bru-mono" style={{ color: 'var(--bru-fg-dim)', fontSize: 12 }}>
                  {app.tagline}
                </p>

                {/* Stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    padding: '16px 0',
                    borderTop: '1px solid var(--bru-border)',
                    borderBottom: '1px solid var(--bru-border)',
                  }}
                >
                  <div>
                    <div className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10, marginBottom: 4 }}>
                      Version
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bru-fg)' }}>v{app.version}</div>
                  </div>
                  <div>
                    <div className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10, marginBottom: 4 }}>
                      Size
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--bru-fg)' }}>{app.size_mb} MB</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                  <a
                    href={app.url}
                    className="bru-btn bru-btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    <Download size={16} strokeWidth={2.5} />
                    Tải {app.name}
                  </a>
                  <a
                    href={app.releases_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bru-btn bru-btn-ghost bru-btn-sm"
                    style={{ justifyContent: 'center' }}
                  >
                    <Github size={14} strokeWidth={2.5} />
                    Release notes + SHA256
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INSTRUCTIONS */}
      <section className="bru-section bru-section-sm" style={{ background: 'var(--bru-bg-elevated)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Hướng dẫn cài
          </div>
          <h2 className="bru-display-md" style={{ marginBottom: 48 }}>
            3 bước. <span className="bru-accent">Cài xong dùng.</span>
          </h2>
          <div className="bru-grid-3">
            {[
              { step: '01', title: 'Tải installer', text: 'Click "Tải" — file .exe ~50MB tải về Downloads. Windows SmartScreen có thể cảnh báo, chọn "More info → Run anyway".' },
              { step: '02', title: 'Chạy installer', text: 'Double-click .exe → Next → chọn folder cài (mặc định Program Files) → Finish. Icon Desktop + Start Menu tạo tự động.' },
              { step: '03', title: 'Đăng nhập', text: 'Mở app → Login Firebase (Google hoặc Email/Password). Lần đầu cần admin (Trí) cấp quyền app — liên hệ email dưới footer.' },
            ].map((s) => (
              <div key={s.step} style={{ borderTop: '2px solid var(--bru-accent)', paddingTop: 16 }}>
                <div className="bru-mono" style={{ color: 'var(--bru-accent)', marginBottom: 8 }}>
                  {s.step}
                </div>
                <h3 className="bru-h3" style={{ marginBottom: 12 }}>{s.title}</h3>
                <p className="bru-body-sm">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bru-section">
        <div className="bru-container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="bru-display-md" style={{ marginBottom: 24 }}>
            Cần hỗ trợ cài đặt?
          </h2>
          <p className="bru-body-lg" style={{ marginBottom: 32 }}>
            Đọc <Link href="/huong-dan" style={{ color: 'var(--bru-accent)' }}>hướng dẫn chi tiết</Link>,
            hoặc email <a href="mailto:trishteam.official@gmail.com" style={{ color: 'var(--bru-accent)' }}>trishteam.official@gmail.com</a>.
          </p>
          <Link href="/apps" className="bru-btn">
            Xem chi tiết 4 app
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
