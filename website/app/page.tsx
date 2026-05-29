/**
 * Homepage — Phase 78.4 Single-page Brutalist Landing.
 *
 * - 1 hero viewport duy nhất (giống hình 1 Trí gửi)
 * - Marquee dock bottom hero
 * - 1 mini section: About author (trái) + Feedback (phải) compact
 * - App info / Downloads / Blog → topnav labels
 */
'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Download,
  LogIn,
  UserPlus,
  Mail,
  Phone,
  Facebook,
  MessageCircle,
} from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';
import { FeedbackWidget } from '@/components/widgets/feedback-widget';
import { useAuth } from '@/lib/auth-context';

const STATS = [
  { num: '3', label: 'Desktop apps' },
  { num: '11', label: 'Modules' },
  { num: '100%', label: 'Vietnamese' },
  { num: 'v1.0', label: 'Stable' },
];

const AUTHOR_LINKS = [
  { label: 'Facebook · /hosytri07', href: 'https://fb.com/hosytri07', icon: Facebook, brand: '#1877f2' },
  { label: 'Zalo · 0969.580.657', href: 'https://zalo.me/0969580657', icon: Phone, brand: '#0068FF' },
  { label: 'trishteam.official@gmail.com', href: 'mailto:trishteam.official@gmail.com', icon: Mail, brand: '#EA4335' },
  { label: 'Telegram', href: 'https://t.me/+_f_Gqw2iy9M3Mjg1', icon: MessageCircle, brand: '#229ED9' },
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="bru">
      {/* ============== HERO (full viewport) ============== */}
      <section
        className="bru-spotlight"
        style={{
          paddingTop: 'clamp(48px, 7vw, 96px)',
          paddingLeft: 'var(--bru-page-px)',
          paddingRight: 'var(--bru-page-px)',
          minHeight: 'calc(100vh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div className="bru-container" style={{ width: '100%' }}>
          <div className="bru-tag bru-tag-accent bru-fade-up" style={{ marginBottom: 24 }}>
            <span className="bru-blink">●</span> v1.0 · 2026
          </div>

          <h1
            className="bru-display-xxl bru-fade-up bru-fade-up-delay-1"
            style={{ marginBottom: 48, lineHeight: 1.15 }}
          >
            HỆ SINH THÁI
            <br />
            <span className="bru-accent">DESKTOP</span> CHO
            <br />
            KỸ SƯ VIỆT.
          </h1>

          <div
            className="bru-fade-up bru-fade-up-delay-3"
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <Link href="/downloads" className="bru-btn bru-btn-primary bru-btn-lg">
              <Download size={18} strokeWidth={2.5} />
              Tải miễn phí
            </Link>
            {!isAuthenticated ? (
              <Link href="/login?mode=signup" className="bru-btn bru-btn-lg">
                <UserPlus size={18} strokeWidth={2.5} />
                Tạo tài khoản
              </Link>
            ) : (
              <Link href="/dashboard" className="bru-btn bru-btn-lg">
                Vào Dashboard
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
            )}
            <Link href="/apps" className="bru-btn bru-btn-ghost bru-btn-lg">
              Xem ứng dụng
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Marquee dock at bottom of hero */}
        <div
          style={{
            marginTop: 'auto',
            padding: '20px 0',
            borderTop: '2px solid var(--bru-border)',
            background: 'var(--bru-bg-deep)',
            overflow: 'hidden',
            marginLeft: 'calc(var(--bru-page-px) * -1)',
            marginRight: 'calc(var(--bru-page-px) * -1)',
          }}
        >
          <div className="bru-marquee">
            {[...STATS, ...STATS, ...STATS].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span
                  style={{
                    fontSize: 'clamp(28px, 3vw, 44px)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    color: 'var(--bru-accent)',
                    lineHeight: 1,
                  }}
                >
                  {s.num}
                </span>
                <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)' }}>
                  {s.label}
                </span>
                <span style={{ color: 'var(--bru-fg-faint)', fontSize: 24 }}>—</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== ABOUT + FEEDBACK COMPACT (1 section duy nhất) ============== */}
      <section className="bru-section bru-section-sm" style={{ background: 'var(--bru-bg-elevated)' }}>
        <div className="bru-container">
          <div className="bru-grid-2" style={{ gap: 'clamp(32px, 4vw, 64px)', alignItems: 'start' }}>
            {/* TÁC GIẢ */}
            <div>
              <div className="bru-eyebrow" style={{ marginBottom: 12 }}>
                // Về tác giả
              </div>
              <h2 className="bru-display-sm" style={{ marginBottom: 16 }}>
                Built by Trí <span className="bru-accent">(TrishTEAM).</span>
              </h2>
              <p className="bru-body" style={{ marginBottom: 20, maxWidth: 480 }}>
                Xây dựng hệ sinh thái công cụ tiếng Việt cho kỹ sư, sinh viên, học sinh — chia sẻ miễn phí.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {AUTHOR_LINKS.map((l) => {
                  const Icon = l.icon;
                  return (
                    <a
                      key={l.label}
                      href={l.href}
                      target={l.href.startsWith('http') ? '_blank' : undefined}
                      rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 20px',
                        border: '2px solid var(--bru-border)',
                        borderRadius: 4,
                        color: 'var(--bru-fg)',
                        textDecoration: 'none',
                        transition: 'all 120ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = l.brand;
                        e.currentTarget.style.borderColor = l.brand;
                        e.currentTarget.style.transform = 'translate(-2px, -2px)';
                        e.currentTarget.style.boxShadow = `4px 4px 0 var(--bru-accent)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'var(--bru-border)';
                        e.currentTarget.style.transform = 'translate(0,0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <Icon size={20} strokeWidth={2} />
                      <span className="bru-mono" style={{ fontSize: 14, fontWeight: 600 }}>
                        {l.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* GÓP Ý */}
            <div>
              <div className="bru-eyebrow" style={{ marginBottom: 12 }}>
                // Góp ý
              </div>
              <h2 className="bru-display-sm" style={{ marginBottom: 16 }}>
                Có gợi ý? <span className="bru-accent">Gửi nhé.</span>
              </h2>
              <p className="bru-body" style={{ marginBottom: 20 }}>
                Bug, feature request, lời khen — tin nhắn gửi thẳng Telegram bot.
              </p>
              <FeedbackWidget />
            </div>
          </div>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
