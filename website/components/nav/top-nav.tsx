'use client';

/**
 * TopNav — Phase 19.17.
 *
 * Layout:
 *   Left:  [Hamburger mobile] [Logo] [Tải về] [Blog] [Ủng hộ]
 *   Right: [Search] [Notif] [⚙] [User panel] [Theme]
 *
 * Phase 19.17: bỏ Blog/Tải về/Ủng hộ/Cài đặt khỏi sidebar, chuyển thành button trên TopNav.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Download, Newspaper, Heart, Menu, Settings as SettingsIcon, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavPanels } from './nav-panels';
import { MobileDrawer } from './mobile-drawer';
import { useAuth } from '@/lib/auth-context';

export function TopNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isAdmin } = useAuth();

  return (
    <>
      <header
        className="sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: 'var(--color-surface-bg_elevated)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <div className="mx-auto px-4 lg:px-6 h-16 flex items-center gap-2 lg:gap-3">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0 transition-colors hover:bg-[var(--color-surface-muted)]"
            aria-label="Mở menu"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Menu size={18} />
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Sparkles
              size={20}
              strokeWidth={2}
              style={{ color: 'var(--color-accent-primary)' }}
            />
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Trish<span style={{ color: 'var(--color-accent-primary)' }}>TEAM</span>
            </span>
          </Link>

          {/* Quick action buttons — md+ */}
          <div className="hidden md:flex items-center gap-1.5">
            <NavCta href="/downloads" icon={<Download size={14} strokeWidth={2.25} />} label="Tải về" primary />
            <NavCta href="/blog" icon={<Newspaper size={14} strokeWidth={2.25} />} label="Blog" />
            <NavCta href="/ung-ho" icon={<Heart size={14} strokeWidth={2.25} />} label="Ủng hộ tôi" accent="#EC4899" />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right cluster: Search · Notif · Settings · User panel · Theme */}
          <div className="flex items-center gap-1 lg:gap-1.5">
            <NavPanels />
            {/* Phase 19.18 — Admin Panel (chỉ admin) */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md text-xs font-bold transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
                  color: '#ffffff',
                }}
                title="Admin Panel"
              >
                <Shield size={13} strokeWidth={2.25} />
                Admin
              </Link>
            )}
            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-[var(--color-surface-muted)]"
              aria-label="Cài đặt"
              style={{ color: 'var(--color-text-secondary)' }}
              title="Cài đặt"
            >
              <SettingsIcon size={16} strokeWidth={1.9} />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function NavCta({
  href,
  icon,
  label,
  primary = false,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  accent?: string;
}) {
  if (primary) {
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'var(--color-accent-gradient)',
          color: '#ffffff',
        }}
        title={label}
      >
        {icon}
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-semibold transition-colors"
      style={{
        background: 'transparent',
        color: accent ?? 'var(--color-text-secondary)',
        border: `1px solid ${accent ? accent + '55' : 'var(--color-border-subtle)'}`,
      }}
      title={label}
    >
      {icon}
      {label}
    </Link>
  );
}
