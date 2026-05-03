/**
 * InlineDialog — reusable modal cho confirm/prompt/alert (Phase 25.0.E).
 *
 * Replace native window.confirm/prompt/alert (popup browser xấu) bằng modal
 * styled theo theme. API async/await:
 *
 *   const { confirmAsync, promptAsync, alertAsync, DialogElement } = useDialog();
 *
 *   if (!await confirmAsync('Xoá file?')) return;
 *   const name = await promptAsync('Tên folder mới:');
 *   if (!name) return;
 *   await alertAsync('Lỗi: ...');
 *
 *   return <>...{DialogElement}</>;
 */

import { useState, useEffect, useRef } from 'react';

type DialogState =
  | null
  | {
      kind: 'confirm';
      title?: string;
      message: string;
      danger?: boolean;
      okLabel?: string;
      cancelLabel?: string;
      resolve: (ok: boolean) => void;
    }
  | {
      kind: 'prompt';
      title?: string;
      message: string;
      value: string;
      placeholder?: string;
      multiline?: boolean;
      okLabel?: string;
      resolve: (val: string | null) => void;
    }
  | {
      kind: 'alert';
      title?: string;
      message: string;
      kindStyle?: 'info' | 'error' | 'success';
      resolve: () => void;
    };

export function useDialog(): {
  confirmAsync: (
    message: string,
    opts?: { title?: string; danger?: boolean; okLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>;
  promptAsync: (
    message: string,
    defaultValue?: string,
    opts?: { title?: string; placeholder?: string; multiline?: boolean; okLabel?: string }
  ) => Promise<string | null>;
  alertAsync: (
    message: string,
    opts?: { title?: string; kindStyle?: 'info' | 'error' | 'success' }
  ) => Promise<void>;
  DialogElement: JSX.Element;
} {
  const [state, setState] = useState<DialogState>(null);

  function confirmAsync(message: string, opts?: { title?: string; danger?: boolean; okLabel?: string; cancelLabel?: string }) {
    return new Promise<boolean>((resolve) => {
      setState({
        kind: 'confirm',
        message,
        title: opts?.title,
        danger: opts?.danger,
        okLabel: opts?.okLabel,
        cancelLabel: opts?.cancelLabel,
        resolve: (ok) => { setState(null); resolve(ok); },
      });
    });
  }
  function promptAsync(message: string, defaultValue?: string, opts?: { title?: string; placeholder?: string; multiline?: boolean; okLabel?: string }) {
    return new Promise<string | null>((resolve) => {
      setState({
        kind: 'prompt',
        message,
        value: defaultValue ?? '',
        title: opts?.title,
        placeholder: opts?.placeholder,
        multiline: opts?.multiline,
        okLabel: opts?.okLabel,
        resolve: (val) => { setState(null); resolve(val); },
      });
    });
  }
  function alertAsync(message: string, opts?: { title?: string; kindStyle?: 'info' | 'error' | 'success' }) {
    return new Promise<void>((resolve) => {
      setState({
        kind: 'alert',
        message,
        title: opts?.title,
        kindStyle: opts?.kindStyle,
        resolve: () => { setState(null); resolve(); },
      });
    });
  }

  return {
    confirmAsync,
    promptAsync,
    alertAsync,
    DialogElement: <DialogModal state={state} />,
  };
}

function DialogModal({ state }: { state: DialogState }): JSX.Element {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state?.kind === 'prompt') {
      setInput(state.value);
      // Focus + select sau khi mount
      setTimeout(() => {
        inputRef.current?.focus();
        if (inputRef.current && 'select' in inputRef.current) inputRef.current.select();
      }, 50);
    }
  }, [state]);

  if (!state) return <></>;

  function close(): void {
    if (!state) return;
    if (state.kind === 'confirm') state.resolve(false);
    else if (state.kind === 'prompt') state.resolve(null);
    else if (state.kind === 'alert') state.resolve();
  }

  function submit(): void {
    if (!state) return;
    if (state.kind === 'confirm') state.resolve(true);
    else if (state.kind === 'prompt') state.resolve(input);
    else if (state.kind === 'alert') state.resolve();
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (state?.kind === 'prompt' && state.multiline) return;
      e.preventDefault(); submit();
    }
  }

  const isDanger = state.kind === 'confirm' && state.danger;
  const headerColor = state.kind === 'alert' && state.kindStyle === 'error'
    ? 'var(--danger)'
    : state.kind === 'alert' && state.kindStyle === 'success'
    ? 'var(--ok)'
    : 'var(--fg)';

  return (
    <div
      onClick={close}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, minWidth: 400, maxWidth: 560,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          color: 'var(--fg)',
        }}
      >
        {state.title && (
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: headerColor }}>
            {state.title}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--fg)', marginBottom: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {state.message}
        </div>

        {state.kind === 'prompt' && (
          state.multiline ? (
            <textarea
              ref={(r) => { inputRef.current = r; }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={state.placeholder}
              onKeyDown={onKeyDown}
              style={{
                width: '100%', minHeight: 80, padding: '10px 12px',
                background: 'var(--bg-soft)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13, fontFamily: 'inherit',
                resize: 'vertical', marginBottom: 12, boxSizing: 'border-box',
              }}
            />
          ) : (
            <input
              ref={(r) => { inputRef.current = r; }}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={state.placeholder}
              onKeyDown={onKeyDown}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--bg-soft)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13,
                marginBottom: 12, boxSizing: 'border-box',
              }}
            />
          )
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {state.kind !== 'alert' && (
            <button
              onClick={close}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'transparent', color: 'var(--fg)',
                border: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {state.kind === 'confirm' ? (state.cancelLabel ?? 'Huỷ') : 'Huỷ'}
            </button>
          )}
          <button
            onClick={submit}
            autoFocus={state.kind !== 'prompt'}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: isDanger ? 'var(--danger)' : 'var(--accent)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {state.kind === 'confirm'
              ? (state.okLabel ?? (isDanger ? 'Xoá' : 'OK'))
              : state.kind === 'prompt'
              ? (state.okLabel ?? 'Lưu')
              : 'Đóng'}
          </button>
        </div>
      </div>
    </div>
  );
}
