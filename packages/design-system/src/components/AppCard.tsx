/**
 * Phase 45.1 — AppCard: container card chuẩn cho mọi panel.
 *
 * Dùng:
 *   <AppCard title="Dự án" subtitle="3 dự án đang mở" actions={<button>+</button>}>
 *     <p>Content</p>
 *   </AppCard>
 *
 *   <AppCard variant="ghost" padding="lg">...</AppCard>
 */

import type { CSSProperties, ReactNode } from 'react';

export interface AppCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Top-right actions (buttons, icons) */
  actions?: ReactNode;
  /** Icon bên trái title (emoji hoặc <i className="ti...">) */
  icon?: ReactNode;
  /** Variant: solid (default border + shadow) | ghost (no border) | flat (no shadow) */
  variant?: 'solid' | 'ghost' | 'flat';
  /** Padding: sm (12px) | md (16px default) | lg (24px) */
  padding?: 'sm' | 'md' | 'lg';
  /** Footer area dưới children */
  footer?: ReactNode;
  /** Trạng thái loading hoặc no-data */
  empty?: boolean;
  /** Hover effect — card click được */
  hoverable?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const PADDING_MAP = { sm: '12px', md: '18px', lg: '24px' } as const;

export function AppCard({
  title,
  subtitle,
  actions,
  icon,
  variant = 'solid',
  padding = 'md',
  footer,
  empty = false,
  hoverable = false,
  onClick,
  children,
  style,
  className,
}: AppCardProps): JSX.Element {
  const baseStyle: CSSProperties = {
    background: variant === 'ghost' ? 'transparent' : 'var(--color-surface-card)',
    border: variant === 'ghost' ? 'none' : '1px solid var(--color-border-subtle)',
    borderRadius: 12,
    padding: PADDING_MAP[padding],
    boxShadow: variant === 'flat' || variant === 'ghost' ? 'none' : 'var(--shadow-xs)',
    cursor: hoverable || onClick ? 'pointer' : 'default',
    transition: 'border-color 150ms, box-shadow 150ms',
    ...style,
  };

  const hasHeader = title || subtitle || actions || icon;

  return (
    <div
      className={`app-card ${className ?? ''}`}
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent-primary)';
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border-subtle)';
      } : undefined}
    >
      {hasHeader && (
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: children ? 14 : 0,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0, flex: 1 }}>
            {icon && (
              <span
                style={{
                  fontSize: 20,
                  flexShrink: 0,
                  color: 'var(--color-accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {icon}
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.35,
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                    lineHeight: 1.45,
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
        </header>
      )}

      {empty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}
        >
          {children ?? 'Chưa có dữ liệu'}
        </div>
      ) : (
        children
      )}

      {footer && (
        <footer
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border-subtle)',
            fontSize: 12,
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
