'use client';

/**
 * Phase 15.0.r — Sidebar TOC cho /downloads page.
 *
 * List apps đã phát hành (TrishLauncher đầu + child apps released từ
 * registry). Mỗi item là anchor link `#<app-id>` nhảy đến section app.
 *
 * Sticky position trên desktop (≥lg). Mobile: scroll-x list ngang ở top.
 *
 * Tự cập nhật khi admin set app status='released' trong registry.
 */

import { useEffect, useState } from 'react';
import { Rocket, Activity, Trash2, Image as ImageIcon, NotebookPen, Type, FileText, Library, Search, Compass } from 'lucide-react';
import { getAppsForWebsite, type AppForWebsite } from '@/lib/apps';

const ICON_MAP: Record<string, typeof Rocket> = {
  Rocket, Activity, Trash2, Image: ImageIcon, NotebookPen, Type, FileText, Library, Search, Compass,
};

function getIcon(name: string) {
  return ICON_MAP[name] ?? Rocket;
}

export function DownloadsSidebar() {
  const [activeId, setActiveId] = useState<string>('trishlauncher');

  // Released apps (launcher + child apps), sorted: launcher first
  const apps = getAppsForWebsite();
  const released = apps.filter(
    (a) => a.status === 'released' && Boolean(a.download?.windows_x64?.url),
  );
  // Đảm bảo trishlauncher đứng đầu nếu có
  const launcher = released.find((a) => a.id === 'trishlauncher');
  const others = released.filter((a) => a.id !== 'trishlauncher');
  const ordered = launcher ? [launcher, ...others] : others;

  // Highlight active section dựa scroll position (IntersectionObserver)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0,
      },
    );

    for (const app of ordered) {
      const el = document.getElementById(app.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ordered]);

  if (ordered.length === 0) {
    return null;
  }

  return (
    <aside
      className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto"
      aria-label="Danh sách apps tải về"
    >
      <div
        className="text-xs uppercase font-bold mb-3 px-3"
        style={{
          color: 'var(--color-text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        Apps ({ordered.length})
      </div>

      {/* Mobile: scroll horizontal. Desktop: vertical list */}
      <nav
        className="
          flex lg:flex-col gap-1
          overflow-x-auto lg:overflow-x-visible
          pb-2 lg:pb-0
          -mx-4 px-4 lg:mx-0 lg:px-0
        "
      >
        {ordered.map((app) => (
          <SidebarLink
            key={app.id}
            app={app}
            active={activeId === app.id}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({
  app,
  active,
}: {
  app: AppForWebsite;
  active: boolean;
}) {
  const Icon = getIcon(app.icon_fallback);

  return (
    <a
      href={`#${app.id}`}
      className="
        flex items-center gap-2.5 px-3 py-2 rounded-md text-sm
        transition-colors shrink-0
        whitespace-nowrap lg:whitespace-normal
      "
      style={{
        background: active
          ? 'var(--color-surface-card)'
          : 'transparent',
        color: active
          ? 'var(--color-text-primary)'
          : 'var(--color-text-muted)',
        borderLeft: `3px solid ${active ? app.accent : 'transparent'}`,
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon
        size={14}
        strokeWidth={2}
        style={{ color: active ? app.accent : 'inherit', flexShrink: 0 }}
      />
      <span className="flex-1 min-w-0 truncate">{app.name}</span>
      <span
        className="text-xs tabular-nums shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        v{app.version}
      </span>
    </a>
  );
}
