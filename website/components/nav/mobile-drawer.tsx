'use client';

/**
 * MobileDrawer — Phase 19.10 — slide-out drawer cho mobile (< lg).
 *
 * Dùng cùng NAV_GROUPS với SideNav để consistent. Trigger qua hamburger
 * trong TopNav. Backdrop click để đóng. Auto-close khi user click 1 link.
 *
 * UX:
 *   - Click hamburger → drawer slide từ trái với backdrop fade-in
 *   - Esc key → close
 *   - Body scroll lock khi mở
 *   - Auto-close khi route đổi (qua pathname dependency)
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';
import { NAV_GROUPS, NavStatusBadge, type NavItem } from '@/lib/nav-data';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: Props) {
  const pathname = usePathname();

  // Esc key + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Auto-close khi route đổi
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
        onClick={onClose}
        className="flex items-center gap-3 px-3 h-11 rounded-md transition-colors"
        style={{
          color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          background: active ? 'var(--color-surface-muted)' : 'transparent',
          borderLeft: active
            ? '3px solid var(--color-accent-primary)'
            : '3px solid transparent',
        }}
      >
        <Icon size={18} strokeWidth={1.9} className="shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{item.label}</span>
        {item.status && <NavStatusBadge status={item.status} />}
      </Link>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="lg:hidden fixed inset-0 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <aside
        className="lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-200 ease-out"
        aria-label="Menu di động"
        aria-hidden={!open}
        style={{
          width: 280,
          maxWidth: '85vw',
          background: 'var(--color-surface-bg_elevated)',
          borderRight: '1px solid var(--color-border-default)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-4 h-16 border-b"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <Sparkles
              size={18}
              strokeWidth={2}
              style={{ color: 'var(--color-accent-primary)' }}
            />
            <span
              className="text-base font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Trish<span style={{ color: 'var(--color-accent-primary)' }}>TEAM</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-surface-muted)]"
            aria-label="Đóng menu"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
          {NAV_GROUPS.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {group.heading && (
                <div
                  className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                >
                  {group.heading}
                </div>
              )}
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        {/* Footer hint */}
        <footer
          className="px-4 py-3 border-t text-xs text-center"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          v0.19 · TrishTEAM Ecosystem
        </footer>
      </aside>
    </>
  );
}
