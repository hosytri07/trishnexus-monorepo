/**
 * Phase 45.3 — AppBadge + AppPill + AppTag: 3 visual tag chuẩn.
 *
 *   <AppBadge tone="success">Active</AppBadge>      // status pill
 *   <AppBadge tone="warning" dot>3 chưa đọc</AppBadge>
 *   <AppPill>v2.0.0</AppPill>                       // monospace neutral
 *   <AppTag onClose={() => ...}>Filter: Admin</AppTag>  // dismissible
 */

import type { CSSProperties, ReactNode } from 'react';

export type AppBadgeTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger';

const TONE_MAP: Record<AppBadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: {
    bg: 'var(--color-surface-muted)',
    fg: 'var(--color-text-secondary)',
    border: 'var(--color-border-default)',
  },
  accent: {
    bg: 'var(--color-accent-soft)',
    fg: 'var(--color-accent-primary)',
    border: 'var(--color-accent-primary)',
  },
  info: {
    bg: 'rgba(59,130,246,0.10)',
    fg: '#1e40af',
    border: '#3b82f6',
  },
  success: {
    bg: 'rgba(16,185,129,0.10)',
    fg: '#047857',
    border: '#10b981',
  },
  warning: {
    bg: 'rgba(245,158,11,0.10)',
    fg: '#b45309',
    border: '#f59e0b',
  },
  danger: {
    bg: 'rgba(239,68,68,0.10)',
    fg: '#b91c1c',
    border: '#ef4444',
  },
};

export interface AppBadgeProps {
  tone?: AppBadgeTone;
  /** Hiển thị chấm chấm trước text */
  dot?: boolean;
  /** Variant: solid (filled) | outline (border) | soft (default) */
  variant?: 'solid' | 'outline' | 'soft';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function AppBadge({
  tone = 'neutral',
  dot = false,
  variant = 'soft',
  size = 'md',
  children,
}: AppBadgeProps): JSX.Element {
  const c = TONE_MAP[tone];
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: size === 'sm' ? '2px 7px' : '3px 10px',
    fontSize: size === 'sm' ? 10.5 : 11.5,
    fontWeight: 600,
    borderRadius: 999,
    letterSpacing: 0,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
  let variantStyle: CSSProperties;
  if (variant === 'solid') {
    variantStyle = { background: c.border, color: 'white', border: '1px solid transparent' };
  } else if (variant === 'outline') {
    variantStyle = { background: 'transparent', color: c.fg, border: `1px solid ${c.border}` };
  } else {
    variantStyle = { background: c.bg, color: c.fg, border: '1px solid transparent' };
  }
  return (
    <span style={{ ...baseStyle, ...variantStyle }}>
      {dot && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: variant === 'solid' ? 'rgba(255,255,255,0.85)' : c.border,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ============ Pill (monospace neutral) ============
export interface AppPillProps {
  children: ReactNode;
  mono?: boolean;
  size?: 'sm' | 'md';
}

export function AppPill({ children, mono = false, size = 'md' }: AppPillProps): JSX.Element {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: size === 'sm' ? '1px 6px' : '2px 8px',
        fontSize: size === 'sm' ? 10.5 : 11.5,
        fontWeight: 500,
        fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
        background: 'var(--color-surface-muted)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 4,
        letterSpacing: mono ? 0.3 : 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ============ Tag (dismissible) ============
export interface AppTagProps {
  children: ReactNode;
  tone?: AppBadgeTone;
  onClose?: () => void;
}

export function AppTag({ children, tone = 'neutral', onClose }: AppTagProps): JSX.Element {
  const c = TONE_MAP[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: onClose ? '3px 4px 3px 10px' : '3px 10px',
        fontSize: 11.5,
        fontWeight: 500,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '0 4px',
            margin: 0,
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            color: 'inherit',
            opacity: 0.7,
            borderRadius: 3,
          }}
          aria-label="Bỏ"
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
