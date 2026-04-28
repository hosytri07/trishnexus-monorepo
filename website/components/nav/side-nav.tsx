'use client';

/**
 * SideNav — Phase 19.10 (refactored to use shared nav-data).
 *
 * Sticky left sidebar (lg+ only). Mobile (< lg) ẩn → user dùng MobileDrawer.
 * Collapsible: localStorage `trishteam:sidebar:collapsed`.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS, NavStatusBadge, type NavItem } from '@/lib/nav-data';
import { useAuth } from '@/lib/auth-context';

const STORAGE_KEY = 'trishteam:sidebar:collapsed';

export function SideNav() {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

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

  // Phase 19.16 — Ẩn sidebar khi guest (chưa đăng nhập)
  // Tránh flash khi đang load auth state
  if (!loading && !isAuthenticated) {
    return null;
  }

  const width = collapsed ? 64 : 260;

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const hrefBase = item.href.split('#')[0] ?? item.href;
    const active =
      hrefBase === '/'
        ? pathname === '/'
        : pathname?.startsWith(hrefBase);

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className="group flex items-center gap-3 px-3 h-9 rounded-md transition-colors"
        style={{
          color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          background: active ? 'var(--color-surface-muted)' : 'transparent',
          borderLeft: active
            ? '3px solid var(--color-accent-primary)'
            : '3px solid transparent',
        }}
      >
        <Icon size={17} strokeWidth={1.9} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="text-[13px] font-medium truncate flex-1">
              {item.label}
            </span>
            {item.status && <NavStatusBadge status={item.status} />}
          </>
        )}
        {collapsed && item.status && <NavStatusBadge status={item.status} compact />}
      </Link>
    );
  };

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 sticky top-16 self-start transition-all"
      aria-label="Menu chính"
      style={{
        width,
        height: 'calc(100vh - 4rem)',
        background: 'var(--color-surface-bg_elevated)',
        borderRight: '1px solid var(--color-border-default)',
        transition: hydrated ? 'width 200ms ease' : 'none',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 mx-3 mt-3 h-9 rounded-md text-sm shrink-0"
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
          <PanelLeftOpen size={15} strokeWidth={2} />
        ) : (
          <>
            <PanelLeftClose size={15} strokeWidth={2} />
            <span className="font-medium">Thu gọn</span>
          </>
        )}
      </button>

      <nav className="flex-1 px-2 pt-3 pb-3 space-y-3 overflow-y-auto">
        {NAV_GROUPS.map((group, idx) => (
          <div key={idx} className="space-y-0.5">
            {!collapsed && group.heading && (
              <div
                className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
              >
                {group.heading}
              </div>
            )}
            {collapsed && group.heading && idx > 0 && (
              <div
                className="mx-3 my-1 border-t"
                style={{ borderColor: 'var(--color-border-subtle)' }}
                aria-hidden
              />
            )}
            {group.items.map(renderItem)}
          </div>
        ))}
      </nav>
    </aside>
  );
}
