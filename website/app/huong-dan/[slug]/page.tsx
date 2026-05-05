/**
 * /huong-dan/[slug] — Hướng dẫn chi tiết 1 app (Phase 39.1).
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
    desc: 'App dùng được ngay, không cần key.',
  },
  standalone: {
    label: 'Key máy (Standalone)',
    emoji: '🔒',
    color: '#F59E0B',
    desc: 'Cần nhập key 16 ký tự admin cấp — bind vào máy này, không cần đăng nhập.',
  },
  account: {
    label: 'Key tài khoản (Account)',
    emoji: '🗝',
    color: '#DC2626',
    desc: 'Cần đăng nhập Firebase (email/Google) + nhập key — bind vào tài khoản.',
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
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} /> Tất cả hướng dẫn
        </Link>
      </div>

      <header className="mb-8 pb-6 border-b border-slate-200">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{guide.icon}</div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{guide.title}</h1>
            <p className="text-slate-600 mt-2">{guide.shortDesc}</p>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <Download size={14} /> Tải về (Windows x64)
            </a>
          )}
          {guide.webUrl && (
            <a
              href={guide.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 text-sm font-semibold"
            >
              <ExternalLink size={14} /> Mở web app
            </a>
          )}
        </div>
      </header>

      {/* Intro */}
      <section className="mb-8">
        <p className="text-base text-slate-700 leading-relaxed">{guide.intro}</p>
      </section>

      {/* Key info */}
      <aside className="mb-8 p-4 rounded-lg bg-slate-50 border border-slate-200">
        <div className="font-semibold mb-1 flex items-center gap-2">
          {keyInfo.emoji} {keyInfo.label}
        </div>
        <p className="text-sm text-slate-600">{keyInfo.desc}</p>
      </aside>

      {/* Features */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3">✨ Tính năng nổi bật</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {guide.features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 p-3 rounded-md bg-white border border-slate-200 text-sm"
            >
              <span className="text-emerald-500 flex-shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sections */}
      {guide.sections.map((section, i) => (
        <section key={i} className="mb-8">
          <h2 className="text-xl font-bold mb-3">{section.heading}</h2>
          <p className="text-slate-700 leading-relaxed">{section.body}</p>
        </section>
      ))}

      {/* Footer */}
      <footer className="mt-10 pt-6 border-t border-slate-200">
        <p className="text-sm text-slate-500">
          Cần thêm trợ giúp? Liên hệ admin qua{' '}
          <Link href="/feedback" className="text-emerald-600 hover:underline">
            Feedback
          </Link>{' '}
          hoặc xem các app khác ở{' '}
          <Link href="/huong-dan" className="text-emerald-600 hover:underline">
            danh mục hướng dẫn
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
