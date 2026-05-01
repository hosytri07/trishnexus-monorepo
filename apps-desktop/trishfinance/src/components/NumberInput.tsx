/**
 * NumberInput — Phase 23.8.D.
 *
 * Money input với format `1.000.000` realtime khi user typing.
 * Dùng controlled mode: `value` là raw number, `onChange` callback ra raw number.
 *
 * Usage:
 *   <NumberInput value={form.rentPrice} onChange={n => setForm({...form, rentPrice: n})} placeholder="0" />
 */

import { useEffect, useState, type CSSProperties, type ChangeEvent } from 'react';

interface NumberInputProps {
  value: number | undefined | null;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  suffix?: string;        // VD: 'đ', 'kWh', 'm³'
  disabled?: boolean;
  autoFocus?: boolean;
  min?: number;
  max?: number;
}

function formatVN(n: number): string {
  if (!n && n !== 0) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

function parseVN(s: string): number {
  if (!s) return 0;
  // Strip mọi ký tự không phải digit (vi-VN dùng "." làm thousand separator)
  const cleaned = s.replace(/[^\d-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function NumberInput({
  value,
  onChange,
  placeholder = '0',
  className,
  style,
  suffix,
  disabled,
  autoFocus,
  min,
  max,
}: NumberInputProps): JSX.Element {
  const [text, setText] = useState<string>(value ? formatVN(value) : '');

  // Sync text khi value prop change từ ngoài
  useEffect(() => {
    const current = parseVN(text);
    if (current !== (value ?? 0)) {
      setText(value ? formatVN(value) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const n = parseVN(raw);
    let clamped = n;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    setText(clamped ? formatVN(clamped) : raw === '-' ? '-' : '');
    onChange(clamped);
  }

  if (suffix) {
    return (
      <div style={{ position: 'relative', ...style }}>
        <input
          type="text"
          inputMode="numeric"
          className={className ?? 'input'}
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          style={{ paddingRight: 36, width: '100%' }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>{suffix}</span>
      </div>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className ?? 'input'}
      value={text}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      style={style}
    />
  );
}
