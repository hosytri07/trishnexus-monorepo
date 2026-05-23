/**
 * Phase 45.1 — AppPageHeader: header chuẩn trên cùng panel/page.
 *
 * Dùng:
 *   <AppPageHeader
 *     title="Quản lý người dùng"
 *     subtitle="Cấp quyền + xem session active"
 *     breadcrumb={['Admin', 'Users']}
 *     actions={<AppButton>+ Thêm user</AppButton>}
 *   />
 */

import type { ReactNode } from 'react';

export interface AppPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: Array<string | { label: string; href?: string }>;
  /** Right-side actions: buttons, filter dropdowns... */
  actions?: ReactNode;
  /** Tabs phía dưới header */
  tabs?: ReactNode;
  /** Padding top/bottom — default 'md' */
  density?: 'sm' | 'md' | 'lg';
}

const DENSITY_MAP = {
  sm: { padding: '12px 18px', titleSize: 16 },
  md: { padding: '18px 24px', titleSize: 20 },
  lg: { padding: '24px 28px', titleSize: 24 },
} as const;

export function AppPageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  tabs,
  density = 'md',
}: AppPageHeaderProps): JSX.Element {
  const d = DENSITY_MAP[density];

  return (
    <header
      style={{
        background: 'var(--color-surface-card)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: d.padding,
      }}
    >
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            marginBottom: 6,
          }}
        >
          {breadcrumb.map((crumb, i) => {
            const label = typeof crumb === 'string' ? crumb : crumb.label;
            const isLast = i === breadcrumb.length - 1;
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span style={{ opacity: 0.5 }}>›</span>}
                <span style={{ color: isLast ? 'var(--color-text-secondary)' : 'inherit' }}>
                  {label}
                </span>
              </span>
            );
          })}
        </nav>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: subtitle ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h1
            style={{
              fontSize: d.titleSize,
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                marginTop: 4,
                lineHeight: 1.45,
                margin: '4px 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {tabs && (
        <div
          style={{
            marginTop: 14,
            marginBottom: -1,
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          {tabs}
        </div>
      )}
    </header>
  );
}
