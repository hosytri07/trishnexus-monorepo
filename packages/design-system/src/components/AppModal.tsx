/**
 * Phase 45.4 — AppModal: modal overlay với header + body + footer.
 *
 * Dùng:
 *   <AppModal open={open} onClose={() => setOpen(false)} title="Sửa user">
 *     <p>Body content</p>
 *   </AppModal>
 *
 *   <AppModal
 *     open={open}
 *     title="Xóa user?"
 *     onClose={...}
 *     footer={
 *       <>
 *         <AppButton variant="ghost" onClick={...}>Hủy</AppButton>
 *         <AppButton variant="danger" onClick={...}>Xóa</AppButton>
 *       </>
 *     }
 *   >
 *     ...
 *   </AppModal>
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react';

export interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Footer area — buttons */
  footer?: ReactNode;
  /** Width: sm (380) | md (520 default) | lg (720) | xl (960) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Close khi click backdrop (default true) */
  closeOnBackdrop?: boolean;
  /** Hiện nút × góc phải (default true) */
  showCloseButton?: boolean;
  children: ReactNode;
}

const SIZE_MAP = { sm: 380, md: 520, lg: 720, xl: 960 } as const;

export function AppModal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  showCloseButton = true,
  children,
}: AppModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,14,12,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 400,
    animation: 'app-modal-fade 150ms ease',
  };

  const modalStyle: CSSProperties = {
    background: 'var(--color-surface-card)',
    borderRadius: 14,
    width: '100%',
    maxWidth: SIZE_MAP[size],
    maxHeight: 'calc(100vh - 40px)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    border: '1px solid var(--color-border-subtle)',
  };

  return (
    <div
      style={backdropStyle}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {(title || showCloseButton) && (
          <header
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    margin: 0,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: 'var(--color-text-muted)',
                    margin: '4px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  padding: '0 4px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
              >
                ×
              </button>
            )}
          </header>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>{children}</div>
        {footer && (
          <footer
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              padding: '14px 20px',
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-surface-muted)',
              flexShrink: 0,
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
