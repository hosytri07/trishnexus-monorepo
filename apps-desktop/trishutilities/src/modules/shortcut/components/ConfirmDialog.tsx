/**
 * ConfirmDialog — Phase 32.2
 * Inline modal confirm (thay native confirm()).
 */

import { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title, message, okLabel = 'Xác nhận', cancelLabel = 'Huỷ', danger, onConfirm, onCancel,
}: Props): JSX.Element {
  useEffect(() => {
    function esc(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onCancel, onConfirm]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 150, padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          maxWidth: 420, width: '100%',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14, padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: danger ? 'rgba(239,68,68,0.10)' : 'var(--color-accent-soft)',
              color: danger ? '#ef4444' : 'var(--color-accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {title}
              </h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {message}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onCancel}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button
            className="btn"
            style={{
              background: danger ? '#ef4444' : 'var(--color-accent-primary)',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
            onClick={onConfirm}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
