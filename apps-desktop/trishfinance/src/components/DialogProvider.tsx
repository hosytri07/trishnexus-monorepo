/**
 * DialogProvider — Phase 23.8.A.
 *
 * Replace native confirm()/alert() bằng custom Modal đẹp theme app.
 * Usage:
 *   const { confirm, alert: alertDialog } = useDialog();
 *   const ok = await confirm('Xoá phòng?', { variant: 'danger' });
 *   if (!ok) return;
 *   await alertDialog('Đã xoá thành công');
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, X, AlertTriangle, Info, AlertCircle } from 'lucide-react';

type DialogVariant = 'info' | 'success' | 'danger' | 'warning';

interface ConfirmOptions {
  title?: string;
  variant?: DialogVariant;
  okLabel?: string;
  cancelLabel?: string;
}

interface AlertOptions {
  title?: string;
  variant?: DialogVariant;
  okLabel?: string;
}

interface DialogState {
  open: boolean;
  type: 'confirm' | 'alert';
  message: string;
  title?: string;
  variant: DialogVariant;
  okLabel: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

interface DialogCtx {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  alert: (message: string, options?: AlertOptions) => Promise<void>;
}

const Ctx = createContext<DialogCtx | null>(null);

export function useDialog(): DialogCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDialog must be inside DialogProvider');
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>(resolve => {
      setState({
        open: true,
        type: 'confirm',
        message,
        title: options.title,
        variant: options.variant ?? 'info',
        okLabel: options.okLabel ?? 'Xác nhận',
        cancelLabel: options.cancelLabel ?? 'Huỷ',
        resolve,
      });
    });
  }, []);

  const alert = useCallback((message: string, options: AlertOptions = {}) => {
    return new Promise<void>(resolve => {
      setState({
        open: true,
        type: 'alert',
        message,
        title: options.title,
        variant: options.variant ?? 'info',
        okLabel: options.okLabel ?? 'OK',
        resolve: () => resolve(),
      });
    });
  }, []);

  function close(value: boolean) {
    if (state) state.resolve(value);
    setState(null);
  }

  const variantStyle: Record<DialogVariant, { icon: any; bg: string; color: string; btn: string }> = {
    info:    { icon: Info,            bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6', btn: 'btn-primary' },
    success: { icon: CheckCircle2,    bg: 'rgba(16,185,129,0.12)',  color: '#10b981', btn: 'btn-primary' },
    danger:  { icon: AlertCircle,     bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', btn: 'btn-danger' },
    warning: { icon: AlertTriangle,   bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', btn: 'btn-primary' },
  };

  return (
    <Ctx.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn 150ms' }}
          onClick={() => state.type === 'alert' && close(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: '100%', padding: 24, border: '1px solid var(--color-border-subtle)' }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const v = variantStyle[state.variant];
              const Icon = v.icon;
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: v.bg, color: v.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 22, height: 22 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {state.title && <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{state.title}</h2>}
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: 0, marginTop: state.title ? 6 : 0, whiteSpace: 'pre-wrap' }}>{state.message}</p>
                    </div>
                    <button className="icon-btn" onClick={() => close(false)} style={{ flexShrink: 0 }}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    {state.type === 'confirm' && (
                      <button className="btn-secondary" onClick={() => close(false)} style={{ minWidth: 80 }}>{state.cancelLabel}</button>
                    )}
                    <button className={v.btn} onClick={() => close(true)} style={{ minWidth: 100 }} autoFocus>
                      {state.okLabel}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
