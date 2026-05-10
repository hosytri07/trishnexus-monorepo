/**
 * /huong-dan/[slug] — Hướng dẫn chi tiết 1 app (Phase 39.1, theme sync 38).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { APP_GUIDES, findGuideBySlug } from '@/lib/huong-dan-content';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams(): { slug: string }[] {
  return APP_GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const guide = findGuideBySlug(params.slug);
  if (!guide) return { title: 'Không tìm thấy — TrishTEAM' };
  return {
    title: `Hướng dẫn ${guide.title} — TrishTEAM`,
    description: guide.shortDesc,
  };
}

const KEY_TYPE_INFO: Record<
  'free' | 'standalone' | 'account',
  { label: string; emoji: string; color: string; desc: string }
> = {
  free: {
    label: 'Miễn phí',
    emoji: '🆓',
    color: '#10B981',
    desc: 'App dùng được ngay, không cần đăng nhập.',
  },
  standalone: {
    label: 'Cần đăng nhập',
    emoji: '👤',
    color: '#F59E0B',
    desc: 'Cần đăng nhập tài khoản TrishTEAM (email/Google). Admin cấp role để dùng full feature.',
  },
  account: {
    label: 'Cần đăng nhập',
    emoji: '👤',
    color: '#F59E0B',
    desc: 'Cần đăng nhập tài khoản TrishTEAM (email/Google). Admin cấp role để dùng full feature.',
  },
};

export default function HuongDanDetailPage({ params }: PageProps): JSX.Element {
  const guide = findGuideBySlug(params.slug);
  if (!guide) notFound();

  const keyInfo = KEY_TYPE_INFO[guide.keyType];

  return (
    <article className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <Link
          href="/huong-dan"
          className="inline-flex items-center gap-1 text-sm hover:underline"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={14} /> Tất cả hướng dẫn
        </Link>
      </div>

      <header
        className="mb-8 pb-6 border-b"
        style={{ borderColor: 'var(--color-border-default)' }}
      >
        <div className="flex items-start gap-4">
          {/* Logo PNG (fallback emoji nếu không có logo_path) */}
          {guide.logo_path ? (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: '#ffffff',
                borderRadius: 14,
                padding: 6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={guide.logo_path}
                alt={`${guide.title} logo`}
                width={60}
                height={60}
                style={{ objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div className="text-5xl">{guide.icon}</div>
          )}
          <div className="flex-1">
            <h1
              className="text-3xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {guide.title}
            </h1>
            <p
              className="mt-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {guide.shortDesc}
            </p>
            <div className="mt-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
                style={{
                  background: `${keyInfo.color}15`,
                  color: keyInfo.color,
                }}
              >
                {keyInfo.emoji} {keyInfo.label}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 flex-wrap">
          {guide.downloadUrl && (
            <a
              href={guide.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'var(--color-accent-primary)',
                color: '#ffffff',
              }}
            >
              <Download size={14} /> Tải về (Windows x64)
            </a>
          )}
          {guide.webUrl && (
            <a
              href={guide.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-surface-card)',
              }}
            >
              <ExternalLink size={14} /> Mở web app
            </a>
          )}
        </div>
      </header>

      {/* Intro */}
      <section className="mb-8">
        <p
          className="text-base leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {guide.intro}
        </p>
      </section>

      {/* Key info */}
      <aside
        className="mb-8 p-4 rounded-lg border"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <div
          className="font-semibold mb-1 flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {keyInfo.emoji} {keyInfo.label}
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {keyInfo.desc}
        </p>
      </aside>

      {/* Features */}
      <section className="mb-8">
        <h2
          className="text-xl font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          ✨ Tính năng nổi bật
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {guide.features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 p-3 rounded-md border text-sm"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span
                className="flex-shrink-0"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                ✓
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sections */}
      {guide.sections.map((section, i) => (
        <section key={i} className="mb-8">
          <h2
            className="text-xl font-bold mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {section.heading}
          </h2>
          <p
            className="leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {section.body}
          </p>
        </section>
      ))}

      {/* Footer */}
      <footer
        className="mt-10 pt-6 border-t"
        style={{ borderColor: 'var(--color-border-default)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Cần thêm trợ giúp? Liên hệ admin qua{' '}
          <Link
            href="/feedback"
            className="hover:underline"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            Feedback
          </Link>{' '}
          hoặc xem các app khác ở{' '}
          <Link
            href="/huong-dan"
            className="hover:underline"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            danh mục hướng dẫn
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
