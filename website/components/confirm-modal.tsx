'use client';

/**
 * ConfirmModal — Phase 19.18.4 — Custom confirm dialog (thay window.confirm).
 *
 * Pattern: hook useConfirm() trả về [Modal, askConfirm] tuple.
 *   const [ConfirmDialog, ask] = useConfirm();
 *   <ConfirmDialog />
 *   const ok = await ask({ title, message, danger });
 *
 * Hỗ trợ: title, message, OK label custom, danger style (đỏ thay primary).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  /** style nút OK = đỏ (cho destructive actions) */
  danger?: boolean;
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setOpts(null);
  }, []);

  // ESC = cancel
  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose(false);
      else if (e.key === 'Enter') handleClose(true);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [opts, handleClose]);

  const Dialog = useCallback(() => {
    if (!opts) return null;
    return (
      <div
        onClick={() => handleClose(false)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-md w-full rounded-xl border p-6 animate-in"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: opts.danger ? '#EF4444' : 'var(--color-accent-primary)',
            borderWidth: 2,
          }}
        >
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
            aria-label="Đóng"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3 mb-4">
            <div
              className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full"
              style={{
                background: opts.danger ? 'rgba(239,68,68,0.15)' : 'var(--color-accent-soft)',
              }}
            >
              <AlertTriangle
                size={22}
                strokeWidth={2}
                style={{ color: opts.danger ? '#EF4444' : 'var(--color-accent-primary)' }}
              />
            </div>
            <div className="flex-1 pt-1">
              <h3
                className="text-lg font-bold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {opts.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {opts.message}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="px-4 h-10 rounded-md text-sm font-semibold transition-colors"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              {opts.cancelLabel ?? 'Huỷ'}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => handleClose(true)}
              className="px-5 h-10 rounded-md text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: opts.danger
                  ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                  : 'var(--color-accent-gradient)',
                color: '#ffffff',
              }}
            >
              {opts.okLabel ?? 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [opts, handleClose]);

  return [Dialog, ask] as const;
}
