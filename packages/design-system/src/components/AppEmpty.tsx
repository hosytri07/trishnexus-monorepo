/**
 * Phase 45.1 — AppEmpty: empty state với icon + message + CTA.
 *
 * Dùng:
 *   <AppEmpty
 *     icon="📂"
 *     title="Chưa có hồ sơ nào"
 *     description="Tạo hồ sơ đầu tiên để bắt đầu khảo sát."
 *     action={<AppButton onClick={...}>+ Tạo hồ sơ</AppButton>}
 *   />
 *
 *   <AppEmpty size="sm" title="Không có kết quả" />
 */

import type { ReactNode } from 'react';

export interface AppEmptyProps {
  /** Emoji, SVG, hoặc text 1-2 ký tự */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call-to-action: button hoặc link */
  action?: ReactNode;
  /** Size: sm (compact) | md (default) | lg (full page) */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { iconSize: 28, titleSize: 13, descSize: 11, padding: '20px 16px' },
  md: { iconSize: 44, titleSize: 15, descSize: 13, padding: '40px 24px' },
  lg: { iconSize: 64, titleSize: 18, descSize: 14, padding: '60px 32px' },
} as const;

export function AppEmpty({
  icon,
  title,
  description,
  action,
  size = 'md',
}: AppEmptyProps): JSX.Element {
  const s = SIZE_MAP[size];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: s.padding,
        gap: 8,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: s.iconSize,
            opacity: 0.6,
            lineHeight: 1,
            marginBottom: 4,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: s.titleSize,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: s.descSize,
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            maxWidth: 360,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
