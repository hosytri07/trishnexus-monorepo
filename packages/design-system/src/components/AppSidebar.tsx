/**
 * Phase 45.4 — AppSidebar: vertical nav với section groups + icons.
 *
 * Dùng:
 *   <AppSidebar
 *     activeId={active}
 *     onSelect={setActive}
 *     groups={[
 *       { label: 'Tổng quan', items: [
 *         { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
 *       ] },
 *       { label: 'Người dùng', items: [
 *         { id: 'users', icon: '👥', label: 'Users', badge: '12' },
 *         { id: 'keys',  icon: '🔑', label: 'Keys' },
 *       ] },
 *     ]}
 *   />
 */

import type { CSSProperties, ReactNode } from 'react';

export interface AppSidebarItem {
  id: string;
  icon?: ReactNode;
  label: ReactNode;
  /** Badge bên phải item — count hoặc dot */
  badge?: ReactNode;
  /** Disable click */
  disabled?: boolean;
}

export interface AppSidebarGroup {
  label?: ReactNode;
  items: AppSidebarItem[];
}

export interface AppSidebarProps {
  groups: ReadonlyArray<AppSidebarGroup>;
  activeId: string;
  onSelect: (id: string) => void;
  /** Width — default 220px */
  width?: number;
  /** Collapsed mode — chỉ hiện icon */
  collapsed?: boolean;
  /** Header phía trên sidebar (logo, app name) */
  header?: ReactNode;
  /** Footer dưới sidebar (user, settings) */
  footer?: ReactNode;
}

export function AppSidebar({
  groups,
  activeId,
  onSelect,
  width = 220,
  collapsed = false,
  header,
  footer,
}: AppSidebarProps): JSX.Element {
  const effectiveWidth = collapsed ? 56 : width;
  return (
    <aside
      style={{
        width: effectiveWidth,
        background: 'var(--color-surface-card)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
        transition: 'width 200ms',
      }}
    >
      {header && (
        <div
          style={{
            padding: collapsed ? '12px 8px' : '14px 16px',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {header}
        </div>
      )}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {groups.map((group, gIdx) => (
          <div key={gIdx} style={{ marginBottom: 12 }}>
            {group.label && !collapsed && (
              <div
                style={{
                  padding: '6px 16px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  color: 'var(--color-text-muted)',
                }}
              >
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = item.id === activeId;
              const baseStyle: CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: collapsed ? '8px 0' : '8px 16px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
                border: 'none',
                borderLeft: isActive
                  ? '3px solid var(--color-accent-primary)'
                  : '3px solid transparent',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'inherit',
                textAlign: 'left',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.4 : 1,
                transition: 'background 100ms',
              };
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => !item.disabled && onSelect(item.id)}
                  style={baseStyle}
                  title={collapsed && typeof item.label === 'string' ? item.label : undefined}
                  onMouseEnter={(e) => {
                    if (!item.disabled && !isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-muted)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }
                  }}
                >
                  {item.icon && (
                    <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                  )}
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.label}
                      </span>
                      {item.badge != null && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 999,
                            background: isActive
                              ? 'var(--color-accent-primary)'
                              : 'var(--color-surface-muted)',
                            color: isActive ? 'white' : 'var(--color-text-muted)',
                            flexShrink: 0,
                            minWidth: 18,
                            textAlign: 'center',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      {footer && (
        <div
          style={{
            padding: collapsed ? '12px 8px' : '12px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}
