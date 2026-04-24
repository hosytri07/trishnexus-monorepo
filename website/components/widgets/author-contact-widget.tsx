'use client';

/**
 * AuthorContactWidget — thông tin liên hệ tác giả + social links.
 *
 * Social buttons dùng kiểu "expanding on hover" port từ FEZ
 * social-expanding-links (style scoped — không global).
 * Icon: Facebook (lucide), Mail, Phone, Telegram (custom SVG vì lucide không có),
 * Zalo (custom SVG).
 *
 * Khi hover: button nở ra + show label, rotate icon 360°, glow accent của brand.
 */
import { Facebook, Mail, Phone } from 'lucide-react';
import { WidgetCard } from './widget-card';

type SocialLink = {
  key: string;
  href: string;
  label: string;
  brand: string; // màu chính brand (background khi hover)
  border: string;
  glow: string;
  icon: React.ReactNode;
};

const ICON_SIZE = 18;

function TelegramIcon() {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function ZaloIcon() {
  // Logo Zalo — wordmark "Z" stylized
  return (
    <svg
      width={ICON_SIZE + 4}
      height={ICON_SIZE + 4}
      viewBox="0 0 48 48"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M15.56 17.13h4.59v1.29h-2.78v1.08h2.52v1.29h-2.52v1.23h2.89v1.3H15.56v-6.19zm6.48 0h1.83v4.88h2.83v1.31h-4.66v-6.19zm6.25 0h1.8l2.57 6.19H30.7l-.44-1.12h-2.42l-.43 1.12h-1.92l2.8-6.19zm1.72 3.84l-.74-2.04-.74 2.04h1.48zm3.83-3.84h5.2v1.3h-3.14l3.31 3.8v1.08h-5.55v-1.3h3.4l-3.22-3.75v-1.13z" />
      <path d="M38.13 9.45H9.87c-1.55 0-2.82 1.27-2.82 2.82v20.27c0 1.55 1.27 2.82 2.82 2.82h16.25l5.83 4.9c.27.22.67.03.67-.32v-4.58h5.51c1.55 0 2.82-1.27 2.82-2.82V12.27c0-1.55-1.27-2.82-2.82-2.82zm.91 23.1c0 .5-.41.91-.91.91H27.28v4.23l-5.04-4.23H9.87c-.5 0-.91-.41-.91-.91V12.27c0-.5.41-.91.91-.91h28.26c.5 0 .91.41.91.91v20.27z" />
    </svg>
  );
}

const AUTHOR = {
  name: 'TrishTEAM',
  role: 'Tác giả · Nhà phát triển',
  bio: 'Xây dựng hệ sinh thái công cụ tiếng Việt cho kỹ sư, sinh viên, học sinh — chia sẻ miễn phí.',
  phone: '0969.580.657',
  email: 'trishteam.official@gmail.com',
};

const LINKS: SocialLink[] = [
  {
    key: 'facebook',
    href: 'https://fb.com/hosytri07',
    label: 'Facebook',
    brand: '#1877f2',
    border: '#1877f2',
    glow: 'rgba(24,119,242,0.45)',
    icon: <Facebook size={ICON_SIZE} strokeWidth={2.25} />,
  },
  {
    key: 'zalo',
    href: 'https://zalo.me/0969580657',
    label: 'Zalo',
    brand: '#0068FF',
    border: '#0068FF',
    glow: 'rgba(0,104,255,0.45)',
    icon: <ZaloIcon />,
  },
  {
    key: 'telegram',
    href: 'https://t.me/+_f_Gqw2iy9M3Mjg1',
    label: 'Telegram',
    brand: '#229ED9',
    border: '#229ED9',
    glow: 'rgba(34,158,217,0.45)',
    icon: <TelegramIcon />,
  },
  {
    key: 'email',
    href: `mailto:${AUTHOR.email}`,
    label: 'Email',
    brand: '#EA4335',
    border: '#EA4335',
    glow: 'rgba(234,67,53,0.45)',
    icon: <Mail size={ICON_SIZE} strokeWidth={2.25} />,
  },
  {
    key: 'phone',
    href: `tel:+84${AUTHOR.phone.replace(/\D/g, '').replace(/^0/, '')}`,
    label: AUTHOR.phone,
    brand: '#10B981',
    border: '#10B981',
    glow: 'rgba(16,185,129,0.45)',
    icon: <Phone size={ICON_SIZE} strokeWidth={2.25} />,
  },
];

/**
 * ExpandingSocialButton — port từ FEZ social-expanding-links.
 * Khi hover: nở từ 48px → 160px, show label, icon xoay 360°, glow theo brand.
 */
function ExpandingSocialButton({ link }: { link: SocialLink }) {
  return (
    <a
      href={link.href}
      target={link.href.startsWith('http') ? '_blank' : undefined}
      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
      aria-label={link.label}
      className="tt-social-btn"
      style={
        {
          '--brand-bg': link.brand,
          '--brand-border': link.border,
          '--brand-glow': link.glow,
        } as React.CSSProperties
      }
    >
      <span className="tt-social-btn__icon">{link.icon}</span>
      <span className="tt-social-btn__text">{link.label}</span>

      {/* Style scoped — chỉ áp dụng trong widget này */}
      <style jsx>{`
        .tt-social-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          height: 48px;
          width: 48px;
          padding: 0 14px;
          border-radius: 999px;
          text-decoration: none;
          color: var(--color-text-primary);
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-default);
          overflow: hidden;
          transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
          flex-shrink: 0;
        }
        .tt-social-btn:hover {
          width: 160px;
          color: #ffffff;
          background: var(--brand-bg);
          border-color: var(--brand-border);
          box-shadow:
            0 10px 20px rgba(0, 0, 0, 0.25),
            0 0 15px var(--brand-glow);
          transform: translateY(-3px);
        }
        .tt-social-btn__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          z-index: 2;
          transition:
            color 0.3s ease,
            transform 0.5s ease;
        }
        .tt-social-btn:hover .tt-social-btn__icon {
          transform: rotate(360deg);
        }
        .tt-social-btn__text {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          margin-left: 10px;
          opacity: 0;
          z-index: 2;
          transform: translateX(-12px);
          transition: all 0.4s ease;
          letter-spacing: 0.02em;
        }
        .tt-social-btn:hover .tt-social-btn__text {
          opacity: 1;
          transform: translateX(0);
        }
      `}</style>
    </a>
  );
}

export function AuthorContactWidget() {
  return (
    <WidgetCard
      title="Liên hệ tác giả"
      icon={<Mail size={16} strokeWidth={2} />}
    >
      <div className="flex flex-col gap-5" id="author">
        {/* Author header */}
        <div className="flex items-start gap-4">
          {/* Avatar: logo chính thức TrishTEAM (Phase 11.5.20) — ảnh Trí gửi,
              đã trim whitespace + resize 512. object-fit:contain + bg sáng
              để nổi logo xanh-dương trên dark theme. */}
          <div
            className="flex items-center justify-center shrink-0 rounded-2xl overflow-hidden"
            style={{
              width: 72,
              height: 72,
              background: '#ffffff',
              boxShadow: 'var(--shadow-sm), 0 0 0 1px var(--color-border-subtle)',
            }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/trishteam-logo.png"
              alt="TrishTEAM logo"
              width={72}
              height={72}
              style={{
                display: 'block',
                width: '86%',
                height: '86%',
                objectFit: 'contain',
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-lg font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {AUTHOR.name}
            </div>
            <div
              className="text-xs uppercase tracking-wide mt-0.5"
              style={{ color: 'var(--color-accent-primary)', letterSpacing: '0.05em' }}
            >
              {AUTHOR.role}
            </div>
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {AUTHOR.bio}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm py-3 border-y"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <a
            href={`tel:+84${AUTHOR.phone.replace(/\D/g, '').replace(/^0/, '')}`}
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Phone size={14} strokeWidth={2} style={{ color: '#10B981' }} />
            <span className="tabular-nums">{AUTHOR.phone}</span>
          </a>
          <a
            href={`mailto:${AUTHOR.email}`}
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Mail size={14} strokeWidth={2} style={{ color: '#EA4335' }} />
            <span className="truncate">{AUTHOR.email}</span>
          </a>
        </div>

        {/* Social expanding buttons */}
        <div>
          <div
            className="text-[11px] uppercase tracking-wide font-medium mb-2.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Kết nối qua mạng xã hội
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {LINKS.map((l) => (
              <ExpandingSocialButton key={l.key} link={l} />
            ))}
          </div>
          <p
            className="text-[10px] mt-3 italic"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Di chuột vào biểu tượng để hiện nhãn — click để mở liên kết.
          </p>
        </div>
      </div>
    </WidgetCard>
  );
}
