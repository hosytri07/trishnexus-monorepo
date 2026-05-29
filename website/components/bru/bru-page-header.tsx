/**
 * BruPageHeader — Phase 78.8 page hero + back button reusable.
 * Standardize page top: eyebrow + heading + sub + back link + actions.
 */
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface BruPageHeaderProps {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  subtitle?: string;
  /** Path back (default /) */
  backHref?: string;
  /** Label cho back link (default "Trang chủ") */
  backLabel?: string;
  /** Icon đầu title */
  icon?: LucideIcon;
  iconColor?: string;
  /** Custom right actions */
  actions?: ReactNode;
}

export function BruPageHeader({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  backHref = '/',
  backLabel = 'Trang chủ',
  icon: Icon,
  iconColor = 'var(--bru-accent)',
  actions,
}: BruPageHeaderProps) {
  return (
    <section
      style={{
        paddingTop: 'clamp(16px, 2vw, 32px)',
        paddingBottom: 'clamp(10px, 1.5vw, 16px)',
        paddingLeft: 'var(--bru-page-px)',
        paddingRight: 'var(--bru-page-px)',
      }}
    >
      <div className="bru-container">
        {/* Back link + eyebrow inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
          <Link
            href={backHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--bru-fg-muted)',
              textDecoration: 'none',
              fontSize: 10,
              fontFamily: 'var(--font-family-mono), monospace',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
              transition: 'color 120ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bru-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bru-fg-muted)')}
          >
            <ArrowLeft size={10} strokeWidth={2.5} />
            {backLabel}
          </Link>
          {eyebrow && (
            <>
              <span style={{ color: 'var(--bru-fg-faint)', fontSize: 10 }}>·</span>
              <span className="bru-eyebrow" style={{ fontSize: 10 }}>
                {eyebrow}
              </span>
            </>
          )}
        </div>

        {/* Header row: title + actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {Icon && <Icon size={22} strokeWidth={1.75} style={{ color: iconColor, flexShrink: 0 }} />}
            <h1
              style={{
                fontSize: 'clamp(18px, 2.4vw, 28px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {title}
              {titleAccent && (
                <>
                  {' '}
                  <span className="bru-accent">{titleAccent}</span>
                </>
              )}
            </h1>
            {subtitle && (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--bru-fg-muted)',
                  marginLeft: 8,
                }}
              >
                {subtitle}
              </span>
            )}
          </div>
          {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      </div>
    </section>
  );
}
