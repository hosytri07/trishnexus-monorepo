'use client';

/**
 * TopNav — sticky top bar.
 * Phase 11.5: thay Login button + ô search tĩnh bằng NavPanels (FEZ-port):
 *   - Search panel (dropdown)
 *   - Notifications panel (bell + dot + dropdown)
 *   - User/Admin panel (avatar + dropdown) — hoặc Login button nếu guest
 *   - Role switcher mock (Guest/User/Admin) để preview trước khi có auth thật
 */
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NavPanels } from './nav-panels';

export function TopNav() {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: 'var(--color-surface-bg_elevated)',
        borderBottom: '1px solid var(--color-border-default)',
      }}
    >
      <div className="mx-auto px-6 h-16 flex items-center gap-4">
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right cluster: Search · Notif · User panel · Theme */}
        <div className="flex items-center gap-2">
          <NavPanels />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
