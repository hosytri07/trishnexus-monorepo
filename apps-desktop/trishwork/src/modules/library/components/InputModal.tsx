/**
 * Phase 18.1.a — Reusable input modal (thay window.prompt).
 *
 * Hỗ trợ:
 *  - Single-line text input (URL, name, hex color)
 *  - Multi-line textarea
 *  - Custom validate function
 *  - Phím tắt: Enter = Submit, Esc = Cancel
 *  - Auto-focus + select-all
 */

import { useEffect, useRef, useState } from 'react';

export type InputType = 'text' | 'url' | 'color' | 'textarea';

export interface InputModalProps {
  title: string;
  /** Icon emoji ở góc trái title */
  icon?: string;
  /** Subtext nhỏ giải thích */
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: InputType;
  submitLabel?: string;
  cancelLabel?: string;
  /** Validate trả message lỗi nếu invalid, null nếu OK */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({
  title,
  icon,
  description,
  label,
  placeholder,
  defaultValue = '',
  type = 'text',
  submitLabel = 'OK',
  cancelLabel = 'Huỷ',
  validate,
  onSubmit,
  onCancel,
}: InputModalProps): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current && 'select' in inputRef.current) {
        inputRef.current.select();
      }
    }, 30);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(): void {
    const trimmed = type === 'textarea' ? value : value.trim();
    if (validate) {
      const errMsg = validate(trimmed);
      if (errMsg) {
        setError(errMsg);
        return;
      }
    }
    onSubmit(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && type === 'textarea' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal input-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <header className="modal-head">
          <h2>
            {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
            {title}
          </h2>
          <button className="mini" onClick={onCancel}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {description && (
            <p className="muted small" style={{ marginTop: 0, marginBottom: 10 }}>
              {description}
            </p>
          )}
          {label && (
            <label
              className="muted small"
              style={{ display: 'block', marginBottom: 4 }}
            >
              {label}
            </label>
          )}
          {type === 'textarea' ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={5}
              className="input-modal-textarea"
            />
          ) : type === 'color' ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder ?? '#ec4899'}
                className="input-modal-input"
                style={{ flex: 1 }}
              />
              <input
                type="color"
                value={value || '#000000'}
                onChange={(e) => setValue(e.target.value)}
                style={{
                  width: 40,
                  height: 32,
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type === 'url' ? 'url' : 'text'}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="input-modal-input"
            />
          )}
          {error && (
            <p
              className="small"
              style={{ color: 'var(--danger)', marginTop: 6 }}
            >
              ⚠ {error}
            </p>
          )}
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            {type === 'textarea' ? '⌨ Ctrl+Enter để lưu' : '⌨ Enter để lưu · Esc để huỷ'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              ✓ {submitLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Imperative helper: open input modal as Promise.
 *
 * Vẫn phải mount React tree — caller cần render <InputModal /> conditional
 * trong component. Helper này chỉ là pattern hint.
 *
 * Use:
 *   const [modal, setModal] = useState<InputModalProps | null>(null);
 *   ...
 *   {modal && <InputModal {...modal} />}
 */
export function makeInputModalPromise(
  show: (props: InputModalProps) => void,
): (config: Omit<InputModalProps, 'onSubmit' | 'onCancel'>) => Promise<string | null> {
  return (config) =>
    new Promise<string | null>((resolve) => {
      show({
        ...config,
        onSubmit: (v) => resolve(v),
        onCancel: () => resolve(null),
      });
    });
}
