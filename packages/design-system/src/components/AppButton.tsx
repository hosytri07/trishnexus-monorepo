/**
 * Phase 45.1 — AppButton: button chuẩn 4 variant + 3 size.
 *
 * Dùng:
 *   <AppButton onClick={...}>Lưu</AppButton>                  // primary md (default)
 *   <AppButton variant="secondary" size="sm">Hủy</AppButton>
 *   <AppButton variant="danger" loading={busy}>Xóa</AppButton>
 *   <AppButton variant="ghost" icon="🔍">Tìm</AppButton>
 *   <AppButton fullWidth>Đăng nhập</AppButton>
 */

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

const SIZE_MAP: Record<AppButtonSize, CSSProperties> = {
  sm: { fontSize: 12, padding: '6px 10px', borderRadius: 6, gap: 5 },
  md: { fontSize: 13, padding: '8px 14px', borderRadius: 8, gap: 6 },
  lg: { fontSize: 15, padding: '11px 18px', borderRadius: 10, gap: 8 },
};

function getVariantStyle(variant: AppButtonVariant, busy: boolean): CSSProperties {
  if (busy) {
    return {
      background: '#9CA3AF',
      color: 'white',
      border: '1px solid #9CA3AF',
    };
  }
  switch (variant) {
    case 'primary':
      return {
        background: 'var(--color-accent-gradient, var(--color-accent-primary))',
        color: 'white',
        border: '1px solid transparent',
      };
    case 'secondary':
      return {
        background: 'var(--color-surface-card)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-default)',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: 'var(--color-text-secondary)',
        border: '1px solid transparent',
      };
    case 'danger':
      return {
        background: 'var(--semantic-danger, #ef4444)',
        color: 'white',
        border: '1px solid transparent',
      };
  }
}

export function AppButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  children,
  disabled,
  style,
  ...rest
}: AppButtonProps): JSX.Element {
  const sizeStyle = SIZE_MAP[size];
  const variantStyle = getVariantStyle(variant, loading);
  const busy = loading || disabled === true;

  const combinedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: busy ? 'wait' : 'pointer',
    transition: 'filter 150ms, background 150ms, border-color 150ms',
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    opacity: disabled && !loading ? 0.5 : 1,
    ...sizeStyle,
    ...variantStyle,
    ...style,
  };

  return (
    <button
      type="button"
      disabled={busy}
      style={combinedStyle}
      onMouseEnter={(e) => {
        if (busy) return;
        if (variant === 'primary' || variant === 'danger') {
          (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.08)';
        } else if (variant === 'secondary') {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-muted)';
        } else if (variant === 'ghost') {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-muted)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.filter = '';
        if (variant === 'secondary') {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-card)';
        } else if (variant === 'ghost') {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }
      }}
      {...rest}
    >
      {loading ? <Spinner size={size} /> : icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

function Spinner({ size }: { size: AppButtonSize }): JSX.Element {
  const px = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  return (
    <span
      style={{
        display: 'inline-block',
        width: px,
        height: px,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'app-spin 0.7s linear infinite',
      }}
      aria-hidden="true"
    />
  );
}
