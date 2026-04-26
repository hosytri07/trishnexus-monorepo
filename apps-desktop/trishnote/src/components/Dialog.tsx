/**
 * Phase 17.2 — Custom Dialog (replace browser prompt/confirm).
 * Provider + hook pattern: useDialog() trả về promise-based prompt/confirm.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  okLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
}

interface ConfirmOptions {
  title: string;
  message: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface DialogState {
  type: 'prompt' | 'confirm';
  resolve: (value: string | null | boolean) => void;
  promptOpts?: PromptOptions;
  confirmOpts?: ConfirmOptions;
}

interface DialogApi {
  prompt: (opts: PromptOptions) => Promise<string | null>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, setState] = useState<DialogState | null>(null);
  const [inputValue, setInputValue] = useState('');

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setInputValue(opts.defaultValue ?? '');
      setState({
        type: 'prompt',
        resolve: (v) => resolve(typeof v === 'string' || v === null ? v : null),
        promptOpts: opts,
      });
    });
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({
        type: 'confirm',
        resolve: (v) => resolve(v === true),
        confirmOpts: opts,
      });
    });
  }, []);

  const close = useCallback((value: string | null | boolean) => {
    if (state) state.resolve(value);
    setState(null);
    setInputValue('');
  }, [state]);

  // ESC để close
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(state?.type === 'prompt' ? null : false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, close]);

  const api: DialogApi = { prompt, confirm };

  return (
    <Ctx.Provider value={api}>
      {children}
      {state && (
        <div className="dlg-backdrop" onClick={() => close(state.type === 'prompt' ? null : false)}>
          <div className="dlg-card" onClick={(e) => e.stopPropagation()}>
            {state.type === 'prompt' && state.promptOpts && (
              <PromptInner
                opts={state.promptOpts}
                value={inputValue}
                onChange={setInputValue}
                onOk={() => close(inputValue)}
                onCancel={() => close(null)}
              />
            )}
            {state.type === 'confirm' && state.confirmOpts && (
              <ConfirmInner
                opts={state.confirmOpts}
                onOk={() => close(true)}
                onCancel={() => close(false)}
              />
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDialog(): DialogApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDialog must be used within DialogProvider');
  return v;
}

function PromptInner({
  opts,
  value,
  onChange,
  onOk,
  onCancel,
}: {
  opts: PromptOptions;
  value: string;
  onChange: (v: string) => void;
  onOk: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <>
      <header className="dlg-head">
        <h3>{opts.title}</h3>
      </header>
      <div className="dlg-body">
        {opts.message && <p className="dlg-message">{opts.message}</p>}
        {opts.multiline ? (
          <textarea
            autoFocus
            className="dlg-input"
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onOk();
            }}
          />
        ) : (
          <input
            autoFocus
            type="text"
            className="dlg-input"
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOk();
            }}
          />
        )}
      </div>
      <footer className="dlg-foot">
        <button className="btn btn-ghost" onClick={onCancel}>
          {opts.cancelLabel ?? 'Huỷ'}
        </button>
        <button className="btn btn-primary" onClick={onOk}>
          {opts.okLabel ?? 'OK'}
        </button>
      </footer>
    </>
  );
}

function ConfirmInner({
  opts,
  onOk,
  onCancel,
}: {
  opts: ConfirmOptions;
  onOk: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <>
      <header className="dlg-head">
        <h3>{opts.title}</h3>
      </header>
      <div className="dlg-body">
        <p className="dlg-message" style={{ whiteSpace: 'pre-wrap' }}>
          {opts.message}
        </p>
      </div>
      <footer className="dlg-foot">
        <button className="btn btn-ghost" onClick={onCancel}>
          {opts.cancelLabel ?? 'Huỷ'}
        </button>
        <button
          className={`btn ${opts.danger ? 'btn-danger-solid' : 'btn-primary'}`}
          onClick={onOk}
        >
          {opts.okLabel ?? 'OK'}
        </button>
      </footer>
    </>
  );
}
