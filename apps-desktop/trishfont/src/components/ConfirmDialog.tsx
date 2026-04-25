import { useEffect } from 'react';

/** Phase 15.1.e — Custom confirm dialog (thay browser native). */
interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  okLabel = 'OK',
  cancelLabel = 'Hủy',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="alertdialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="modal-dialog modal-dialog-confirm"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <header className="modal-head">
            <h2>{title}</h2>
          </header>
        )}
        <section className="modal-body">
          <p className="confirm-message">{message}</p>
        </section>
        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'btn btn-danger-solid' : 'btn btn-primary'}
            onClick={onConfirm}
            autoFocus
          >
            {okLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
