'use client';

/**
 * SideNav — sticky left sidebar với icon + label nav.
 *
 * Collapsible: trạng thái lưu localStorage `trishteam:sidebar:collapsed`.
 * Khi collapsed → chỉ hiện icon 56px wide; khi expanded → icon + label 224px.
 * Trên mobile (< lg) → ẩn toàn bộ, user dùng TopNav links thay.
 *
 * Items: Dashboard + 6 feature pages + Góp ý + Liên hệ.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Car,
  FileBadge,
  Home,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Signpost,
  UserCircle2,
  Waypoints,
} from 'lucide-react';

type SideItem = {
  label: string;
  href: string;
  icon: typeof Home;
  /** Section tag để group (hiện khi expanded). */
  section?: 'main' | 'feature' | 'foot';
};

const ITEMS: SideItem[] = [
  { label: 'Dashboard', href: '/', icon: Home, section: 'main' },
  { label: 'Ôn thi lái xe', href: '/driving-test', icon: Car, section: 'feature' },
  { label: 'Chứng chỉ XD', href: '/certificates', icon: FileBadge, section: 'feature' },
  { label: 'Biển báo', href: '/traffic-signs', icon: Signpost, section: 'feature' },
  { label: 'Cầu VN', href: '/bridges', icon: Waypoints, section: 'feature' },
  { label: 'Bảng tin', href: '/posts', icon: Newspaper, section: 'feature' },
  { label: 'Góp ý', href: '/#feedback', icon: MessageSquare, section: 'foot' },
  { label: 'Liên hệ tác giả', href: '/#author', icon: UserCircle2, section: 'foot' },
];

const STORAGE_KEY = 'trishteam:sidebar:collapsed';

export function SideNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate collapsed state client-side — tránh server/client mismatch.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const width = collapsed ? 64 : 224;

  // Nhóm items để vẽ section break giữa feature vs foot
  const featureItems = ITEMS.filter((i) => i.section !== 'foot');
  const footItems = ITEMS.filter((i) => i.section === 'foot');

  const renderItem = (item: SideItem) => {
    const Icon = item.icon;
    const active =
      item.href === '/'
        ? pathname === '/'
        : pathname?.startsWith(item.href.split('#')[0] ?? item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className="group flex items-center gap-3 px-3 h-10 rounded-md transition-colors"
        style={{
          color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          background: active ? 'var(--color-surface-muted)' : 'transparent',
          borderLeft: active
            ? `3px solid var(--color-accent-primary)`
            : '3px solid transparent',
        }}
      >
        <Icon size={18} strokeWidth={2} className="shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 sticky top-16 self-start transition-all"
      aria-label="Menu điều hướng phụ"
      style={{
        width,
        height: 'calc(100vh - 4rem)',
        background: 'var(--color-surface-bg_elevated)',
        borderRight: '1px solid var(--color-border-default)',
        transition: hydrated ? 'width 200ms ease' : 'none',
      }}
    >
      {/* Toggle */}
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 mx-3 mt-3 h-9 rounded-md text-sm"
        style={{
          color: 'var(--color-text-muted)',
          background: 'transparent',
          border: '1px solid var(--color-border-subtle)',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 12,
        }}
        aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <PanelLeftOpen size={16} strokeWidth={2} />
        ) : (
          <>
            <PanelLeftClose size={16} strokeWidth={2} />
            <span className="font-medium">Thu gọn</span>
          </>
        )}
      </button>

      {/* Main nav */}
      <nav className="flex-1 px-2 pt-4 space-y-0.5 overflow-y-auto">
        {featureItems.map(renderItem)}
      </nav>

      {/* Foot */}
      <div
        className="px-2 py-3 space-y-0.5 border-t"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        {footItems.map(renderItem)}
      </div>
    </aside>
  );
}
