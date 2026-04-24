/**
 * WidgetCard — khung chung cho các dashboard widget.
 * Gradient accent top border + header title + body padding.
 *
 * Title dùng text-primary (không phải secondary) để ở light mode đậm hơn.
 * Card có var(--shadow-sm) cho elevation — quan trọng ở light mode khi bg card
 * và page gần nhau.
 */
import { type ReactNode } from 'react';

export type WidgetCardProps = {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Gradient accent color cho top border. Default accent-primary. */
  accent?: string;
  /** padding body. Default 'md' (px-5 py-4). 'sm' = px-4 py-3, 'none' = no padding (widget tự handle). */
  pad?: 'sm' | 'md' | 'none';
};

export function WidgetCard({
  title,
  icon,
  action,
  children,
  className = '',
  accent,
  pad = 'md',
}: WidgetCardProps) {
  const topBorder = accent
    ? `linear-gradient(90deg, ${accent} 0%, var(--color-accent-secondary) 100%)`
    : 'var(--color-accent-gradient)';

  const bodyPad = pad === 'none' ? '' : pad === 'sm' ? 'px-4 py-3' : 'px-5 py-4';

  return (
    <section
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Gradient top border */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: topBorder, opacity: 0.85 }}
      />

      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 border-b"
        style={{ borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span
              aria-hidden="true"
              className="inline-flex"
              style={{ color: 'var(--color-accent-primary)' }}
            >
              {icon}
            </span>
          )}
          <h3
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '0.05em' }}
          >
            {title}
          </h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={bodyPad}>{children}</div>
    </section>
  );
}
