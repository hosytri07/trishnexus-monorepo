'use client';

/**
 * ExternalAppsWidget — Link nhanh đến các công cụ/dịch vụ bên ngoài mà
 * user TT thường dùng song song với hệ sinh thái TrishTEAM.
 *
 * Khác QuickAccessWidget (là link vào /feature-page nội bộ), widget này
 * là bridge ra ngoài: Gmail, Drive, Figma, Zalo, GitHub, Notion…
 *
 * Icon từ lib/brand-icons — có thể thay bằng @thesvg/react sau này.
 *
 * Persistence (localStorage):
 *   trishteam:external_apps:order — thứ tự user đã sắp xếp (future drag-n-drop)
 *   trishteam:external_apps:hidden — slug đã ẩn
 */
import { ExternalLink, Globe2 } from 'lucide-react';
import { BRANDS, type BrandSlug } from '@/lib/brand-icons';
import { WidgetCard } from './widget-card';

type ExternalApp = {
  slug: BrandSlug;
  label: string;
  href: string;
  category: string;
};

const APPS: ExternalApp[] = [
  { slug: 'gmail', label: 'Gmail', href: 'https://mail.google.com', category: 'Email' },
  { slug: 'googledrive', label: 'Drive', href: 'https://drive.google.com', category: 'Cloud' },
  { slug: 'dropbox', label: 'Dropbox', href: 'https://www.dropbox.com/home', category: 'Cloud' },
  { slug: 'notion', label: 'Notion', href: 'https://www.notion.so', category: 'Docs' },
  { slug: 'figma', label: 'Figma', href: 'https://www.figma.com/files', category: 'Design' },
  { slug: 'github', label: 'GitHub', href: 'https://github.com', category: 'Dev' },
  { slug: 'vscode', label: 'VS Code Web', href: 'https://vscode.dev', category: 'Dev' },
  { slug: 'zalo', label: 'Zalo Web', href: 'https://chat.zalo.me', category: 'Chat' },
  { slug: 'slack', label: 'Slack', href: 'https://slack.com/signin', category: 'Chat' },
  { slug: 'chatgpt', label: 'ChatGPT', href: 'https://chat.openai.com', category: 'AI' },
  { slug: 'chrome', label: 'Chrome', href: 'https://www.google.com/chrome', category: 'Browser' },
  { slug: 'youtube', label: 'YouTube', href: 'https://youtube.com', category: 'Media' },
];

export function ExternalAppsWidget() {
  return (
    <WidgetCard
      title="Dịch vụ bên ngoài"
      icon={<Globe2 size={16} strokeWidth={2} />}
      action={
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ExternalLink size={10} />
          {APPS.length} shortcut
        </span>
      }
    >
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {APPS.map((app) => {
          const Icon = BRANDS[app.slug];
          return (
            <a
              key={app.slug}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              title={`${app.label} · ${app.category}`}
              className="group flex flex-col items-center justify-center gap-1.5 py-3 rounded-md transition-all"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div className="transition-transform group-hover:scale-110 group-hover:-translate-y-0.5">
                {Icon ? <Icon size={28} /> : null}
              </div>
              <span
                className="text-[11px] font-medium leading-none"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {app.label}
              </span>
            </a>
          );
        })}
      </div>

      <p
        className="text-[10px] italic mt-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Mở trong tab mới · Shortcut chỉ là link, không lưu dữ liệu.
      </p>
    </WidgetCard>
  );
}
