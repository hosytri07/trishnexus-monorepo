/**
 * Phase 38.2.0 — DialogProvider + useDialogs() hook.
 *
 * Promise-based API thay window.alert/confirm/prompt.
 *
 * Usage:
 *   // Wrap App tree:
 *   <DialogProvider><App /></DialogProvider>
 *
 *   // Trong component:
 *   const { alert, confirm, prompt } = useDialogs();
 *   await alert({ title: 'Lỗi', message: 'File không tồn tại' });
 *   const ok = await confirm({ title: 'Xoá file?', message: 'Không thể hoàn tác.' });
 *   const name = await prompt({ title: 'Đặt tên', label: 'Tên mới' });
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { InputModal, type InputModalProps } from '../InputModal.js';
import { MessageModal, type MessageModalProps, type MessageVariant } from './MessageModal.js';

export interface AlertOptions {
  title: string;
  message: string | JSX.Element;
  icon?: string;
  variant?: MessageVariant;
  okLabel?: string;
}

export interface ConfirmOptions extends AlertOptions {
  cancelLabel?: string;
}

export type PromptOptions = Omit<InputModalProps, 'onSubmit' | 'onCancel'>;

interface DialogsApi {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsApi | null>(null);

interface QueueItem {
  id: number;
  kind: 'alert' | 'confirm' | 'prompt';
  payload: MessageModalProps | InputModalProps;
}

let nextId = 1;

export function DialogProvider({ children }: { children: React.ReactNode }): JSX.Element {
  // Queue: cho phép 1 lúc nhiều dialog xếp hàng (ít gặp nhưng an toàn)
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const dequeue = useCallback((id: number) => {
    setQueue((q) => q.filter((it) => it.id !== id));
  }, []);

  const alert = useCallback(
    (opts: AlertOptions): Promise<void> =>
      new Promise<void>((resolve) => {
        const id = nextId++;
        const payload: MessageModalProps = {
          title: opts.title,
          message: opts.message,
          icon: opts.icon,
          mode: 'alert',
          variant: opts.variant ?? 'info',
          okLabel: opts.okLabel ?? 'OK',
          onConfirm: () => {
            dequeue(id);
            resolve();
          },
        };
        setQueue((q) => [...q, { id, kind: 'alert', payload }]);
      }),
    [dequeue],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        const id = nextId++;
        const payload: MessageModalProps = {
          title: opts.title,
          message: opts.message,
          icon: opts.icon,
          mode: 'confirm',
          variant: opts.variant ?? 'info',
          okLabel: opts.okLabel ?? 'OK',
          cancelLabel: opts.cancelLabel ?? 'Huỷ',
          onConfirm: () => {
            dequeue(id);
            resolve(true);
          },
          onCancel: () => {
            dequeue(id);
            resolve(false);
          },
        };
        setQueue((q) => [...q, { id, kind: 'confirm', payload }]);
      }),
    [dequeue],
  );

  const prompt = useCallback(
    (opts: PromptOptions): Promise<string | null> =>
      new Promise<string | null>((resolve) => {
        const id = nextId++;
        const payload: InputModalProps = {
          ...opts,
          onSubmit: (v: string) => {
            dequeue(id);
            resolve(v);
          },
          onCancel: () => {
            dequeue(id);
            resolve(null);
          },
        };
        setQueue((q) => [...q, { id, kind: 'prompt', payload }]);
      }),
    [dequeue],
  );

  const api = useMemo<DialogsApi>(() => ({ alert, confirm, prompt }), [alert, confirm, prompt]);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {queue.map((it) =>
        it.kind === 'prompt' ? (
          <InputModal key={it.id} {...(it.payload as InputModalProps)} />
        ) : (
          <MessageModal key={it.id} {...(it.payload as MessageModalProps)} />
        ),
      )}
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) {
    throw new Error('useDialogs() phải nằm trong <DialogProvider>');
  }
  return ctx;
}
