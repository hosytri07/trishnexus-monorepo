/**
 * Phase 45.4 — AppTabs: tabs ngang/dọc với pill style + underline.
 *
 *   <AppTabs
 *     items={[
 *       { id: 'all',     label: 'Tất cả', count: 24 },
 *       { id: 'active',  label: 'Đang hoạt động', count: 18 },
 *       { id: 'pending', label: 'Chờ duyệt', count: 6 },
 *     ]}
 *     activeId={tab}
 *     onChange={setTab}
 *     variant="pill"
 *   />
 */

import type { CSSProperties, ReactNode } from 'react';

export interface AppTabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  count?: number | string;
  disabled?: boolean;
}

export interface AppTabsProps {
  items: ReadonlyArray<AppTabItem>;
  activeId: string;
  onChange: (id: string) => void;
  /** pill (rounded bg) | underline (line at bottom) | minimal (text only) */
  variant?: 'pill' | 'underline' | 'minimal';
  /** Size: sm | md (default) | lg */
  size?: 'sm' | 'md' | 'lg';
  /** Layout: horizontal (default) | vertical */
  orientation?: 'horizontal' | 'vertical';
}

const SIZE_MAP = {
  sm: { fontSize: 12, padding: '5px 10px', countSize: 10 },
  md: { fontSize: 13, padding: '7px 14px', countSize: 11 },
  lg: { fontSize: 14, padding: '9px 18px', countSize: 12 },
} as const;

export function AppTabs({
  items,
  activeId,
  onChange,
  variant = 'underline',
  size = 'md',
  orientation = 'horizontal',
}: AppTabsProps): JSX.Element {
  const s = SIZE_MAP[size];

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: variant === 'pill' ? 4 : 0,
        borderBottom:
          variant === 'underline' && orientation === 'horizontal'
            ? '1px solid var(--color-border-subtle)'
            : undefined,
      }}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        let style: CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: s.padding,
          fontSize: s.fontSize,
          fontWeight: isActive ? 600 : 500,
          fontFamily: 'inherit',
          background: 'transparent',
          border: 'none',
          color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
          cursor: item.disabled ? 'not-allowed' : 'pointer',
          opacity: item.disabled ? 0.4 : 1,
          transition: 'all 120ms',
          position: 'relative',
        };

        if (variant === 'pill') {
          style = {
            ...style,
            borderRadius: 8,
            background: isActive ? 'var(--color-accent-soft)' : 'transparent',
          };
        } else if (variant === 'underline') {
          style = {
            ...style,
            borderBottom: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            marginBottom: -1,
          };
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
            style={style}
            onMouseEnter={(e) => {
              if (!item.disabled && !isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
                if (variant === 'pill') {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-muted)';
                }
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
                if (variant === 'pill') {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }
              }
            }}
          >
            {item.icon && <span style={{ fontSize: s.fontSize + 2, lineHeight: 1 }}>{item.icon}</span>}
            <span>{item.label}</span>
            {item.count != null && (
              <span
                style={{
                  fontSize: s.countSize,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isActive ? 'var(--color-accent-primary)' : 'var(--color-surface-muted)',
                  color: isActive ? 'white' : 'var(--color-text-muted)',
                  fontWeight: 600,
                  marginLeft: 2,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
