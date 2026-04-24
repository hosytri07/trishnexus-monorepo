'use client';

/**
 * Modal — primitive accessible dùng chung cho app detail, confirm, v.v.
 * - Backdrop blur + click ngoài để close
 * - Esc để close
 * - Focus trap tối thiểu (không bẫy đầy đủ, đủ UX)
 * - Portal vào document.body để tránh z-index hell
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max width class. Default max-w-2xl. */
  maxWidth?: string;
};

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  if (!open) return null;
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--zIndex-modal)' }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'var(--color-surface-overlay)' }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} rounded-xl shadow-2xl outline-none`}
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          maxHeight: 'calc(100vh - 4rem)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <h2
              id="modal-title"
              className="text-xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors hover:opacity-80"
              style={{
                background: 'var(--color-surface-muted)',
                color: 'var(--color-text-primary)',
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        )}

        <div
          className="overflow-y-auto p-6"
          style={{ maxHeight: title ? 'calc(100vh - 10rem)' : 'calc(100vh - 4rem)' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
