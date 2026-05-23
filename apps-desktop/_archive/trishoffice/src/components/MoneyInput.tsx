/**
 * TrishOffice — MoneyInput component (Phase 38.23).
 *
 * Input số tiền VND với format dấu chấm phân tách hàng nghìn.
 *   value = 1000000  →  display "1.000.000"
 *   user nhập "1.500.000.000" → value = 1500000000
 *
 * Dùng thay cho `<input type="number">` ở mọi field tiền:
 *   - Lương cơ bản, phụ cấp
 *   - Giá trị hợp đồng, VAT, tiền thanh toán
 *   - Số tiền chi phí
 */

import { useState, useRef, useEffect } from 'react';

interface MoneyInputProps {
  value: number;
  onChange: (newValue: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Giá trị max (vd 999_999_999_999 = 999 tỷ) — default Number.MAX_SAFE_INTEGER */
  max?: number;
  /** Allow âm */
  allowNegative?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

const formatter = new Intl.NumberFormat('vi-VN');

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
  style,
  max = Number.MAX_SAFE_INTEGER,
  allowNegative = false,
  disabled,
  autoFocus,
}: MoneyInputProps): JSX.Element {
  // Internal display state cho phép typing thoải mái
  const [display, setDisplay] = useState<string>(() =>
    value === 0 ? '' : formatter.format(value),
  );
  const lastValueRef = useRef<number>(value);

  // Sync display khi value bên ngoài thay đổi (vd reset form)
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setDisplay(value === 0 ? '' : formatter.format(value));
      lastValueRef.current = value;
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = e.target.value;
    // Cho phép dấu trừ ở đầu nếu allowNegative
    const isNegative = allowNegative && raw.trim().startsWith('-');
    // Strip mọi ký tự không phải số
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      setDisplay('');
      lastValueRef.current = 0;
      onChange(0);
      return;
    }
    let n = Number(digits);
    if (isNegative) n = -n;
    if (n > max) n = max;
    if (!allowNegative && n < 0) n = 0;
    const formatted = formatter.format(n);
    setDisplay(isNegative && n < 0 ? formatted : formatted);
    lastValueRef.current = n;
    onChange(n);
  }

  function handleBlur(): void {
    // Format clean lúc blur (xóa số 0 đầu, fix display)
    if (lastValueRef.current === 0) {
      setDisplay('');
    } else {
      setDisplay(formatter.format(lastValueRef.current));
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder ?? '0'}
      className={className}
      style={style}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}
