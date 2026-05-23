/**
 * Phase 38.2.0 — Reusable alert/confirm modal (thay window.alert + window.confirm).
 *
 * Variants:
 *  - alert: 1 button OK
 *  - confirm: 2 button OK + Cancel (with optional danger styling)
 */

import { useEffect } from 'react';

export type MessageVariant = 'info' | 'warning' | 'danger' | 'success';

export interface MessageModalProps {
  title: string;
  message: string | JSX.Element;
  /** Icon emoji ở góc trái title */
  icon?: string;
  /** 'alert' = chỉ 1 nút OK; 'confirm' = OK + Cancel */
  mode: 'alert' | 'confirm';
  /** Variant ảnh hưởng màu sắc title + icon mặc định */
  variant?: MessageVariant;
  okLabel?: string;
  cancelLabel?: string;
  /** Bấm OK */
  onConfirm: () => void;
  /** Bấm Cancel hoặc Esc hoặc click backdrop. KHÔNG gọi khi alert mode. */
  onCancel?: () => void;
}

const VARIANT_COLORS: Record<MessageVariant, { color: string; defaultIcon: string }> = {
  info: { color: '#3B82F6', defaultIcon: 'ℹ' },
  warning: { color: '#F59E0B', defaultIcon: '⚠' },
  danger: { color: '#EF4444', defaultIcon: '⚠' },
  success: { color: '#10B981', defaultIcon: '✓' },
};

export function MessageModal({
  title,
  message,
  icon,
  mode,
  variant = 'info',
  okLabel = 'OK',
  cancelLabel = 'Huỷ',
  onConfirm,
  onCancel,
}: MessageModalProps): JSX.Element {
  const v = VARIANT_COLORS[variant];
  const displayIcon = icon ?? v.defaultIcon;

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (mode === 'alert') onConfirm();
        else if (onCancel) onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onConfirm, onCancel]);

  function handleBackdrop(): void {
    if (mode === 'alert') onConfirm();
    else if (onCancel) onCancel();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <header className="modal-head">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: v.color, fontSize: 20 }}>{displayIcon}</span>
            <span>{title}</span>
          </h2>
          {mode === 'confirm' && onCancel && (
            <button className="mini" onClick={onCancel} aria-label="Đóng">
              ×
            </button>
          )}
        </header>

        <div className="modal-body">
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{message}</div>
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            ⌨ Enter = OK
            {mode === 'confirm' && ' · Esc = Huỷ'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'confirm' && onCancel && (
              <button className="btn btn-ghost" onClick={onCancel}>
                {cancelLabel}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              autoFocus
              style={
                variant === 'danger'
                  ? { background: '#EF4444', borderColor: '#DC2626' }
                  : undefined
              }
            >
              {variant === 'success' ? '✓' : ''} {okLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
