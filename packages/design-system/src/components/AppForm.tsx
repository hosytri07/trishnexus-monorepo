/**
 * Phase 45.2 — Form primitives: AppLabel, AppInput, AppSelect, AppTextarea,
 * AppCheckbox, AppFormGroup, AppFieldset.
 *
 * Dùng:
 *   <AppFormGroup label="Email" required hint="Email công ty">
 *     <AppInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
 *   </AppFormGroup>
 *
 *   <AppFormGroup label="Vai trò">
 *     <AppSelect value={role} onChange={(e) => setRole(e.target.value)}>
 *       <option value="admin">Admin</option>
 *       <option value="user">User</option>
 *     </AppSelect>
 *   </AppFormGroup>
 *
 *   <AppCheckbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
 *     Ghi nhớ tài khoản
 *   </AppCheckbox>
 */

import type {
  CSSProperties,
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// ============ Label ============
export interface AppLabelProps {
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

export function AppLabel({ required, htmlFor, children }: AppLabelProps): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        marginBottom: 5,
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--semantic-danger, #ef4444)', marginLeft: 3 }}>*</span>}
    </label>
  );
}

// ============ Input ============
const baseFieldStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: 'var(--color-surface-card)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
};

export type AppInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export function AppInput({ invalid, iconLeft, iconRight, style, ...rest }: AppInputProps): JSX.Element {
  const wrapper: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };
  const fieldStyle: CSSProperties = {
    ...baseFieldStyle,
    paddingLeft: iconLeft ? 34 : 12,
    paddingRight: iconRight ? 34 : 12,
    borderColor: invalid ? 'var(--semantic-danger, #ef4444)' : 'var(--color-border-default)',
    ...style,
  };
  return (
    <div style={wrapper}>
      {iconLeft && (
        <span
          style={{
            position: 'absolute',
            left: 10,
            color: 'var(--color-text-muted)',
            fontSize: 14,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {iconLeft}
        </span>
      )}
      <input
        style={fieldStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = invalid
            ? 'var(--semantic-danger, #ef4444)'
            : 'var(--color-accent-primary)';
          e.currentTarget.style.boxShadow = `0 0 0 3px ${invalid ? 'rgba(239,68,68,0.12)' : 'var(--color-accent-soft)'}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = invalid
            ? 'var(--semantic-danger, #ef4444)'
            : 'var(--color-border-default)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...rest}
      />
      {iconRight && (
        <span
          style={{
            position: 'absolute',
            right: 10,
            color: 'var(--color-text-muted)',
            fontSize: 14,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {iconRight}
        </span>
      )}
    </div>
  );
}

// ============ Select ============
export type AppSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function AppSelect({ invalid, style, children, ...rest }: AppSelectProps): JSX.Element {
  const fieldStyle: CSSProperties = {
    ...baseFieldStyle,
    paddingRight: 30,
    appearance: 'none',
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 14 14\'%3E%3Cpath fill=\'%236b6877\' d=\'M3 5l4 4 4-4\' stroke=\'%236b6877\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    borderColor: invalid ? 'var(--semantic-danger, #ef4444)' : 'var(--color-border-default)',
    cursor: 'pointer',
    ...style,
  };
  return (
    <select
      style={fieldStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        e.currentTarget.style.boxShadow = `0 0 0 3px var(--color-accent-soft)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid
          ? 'var(--semantic-danger, #ef4444)'
          : 'var(--color-border-default)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

// ============ Textarea ============
export type AppTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function AppTextarea({ invalid, style, rows = 4, ...rest }: AppTextareaProps): JSX.Element {
  const fieldStyle: CSSProperties = {
    ...baseFieldStyle,
    resize: 'vertical',
    minHeight: 80,
    lineHeight: 1.5,
    borderColor: invalid ? 'var(--semantic-danger, #ef4444)' : 'var(--color-border-default)',
    ...style,
  };
  return (
    <textarea
      rows={rows}
      style={fieldStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        e.currentTarget.style.boxShadow = `0 0 0 3px var(--color-accent-soft)`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid
          ? 'var(--semantic-danger, #ef4444)'
          : 'var(--color-border-default)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...rest}
    />
  );
}

// ============ Checkbox ============
export type AppCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
};

export function AppCheckbox({ children, style, ...rest }: AppCheckboxProps): JSX.Element {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        color: 'var(--color-text-primary)',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        style={{
          width: 16,
          height: 16,
          accentColor: 'var(--color-accent-primary)',
          cursor: 'inherit',
          ...style,
        }}
        {...rest}
      />
      {children && <span>{children}</span>}
    </label>
  );
}

// ============ FormGroup ============
export interface AppFormGroupProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  /** Layout: vertical (default — label trên field) | horizontal (label trái) */
  layout?: 'vertical' | 'horizontal';
  children: ReactNode;
  /** Width của label khi layout=horizontal */
  labelWidth?: number;
}

export function AppFormGroup({
  label,
  required,
  hint,
  error,
  layout = 'vertical',
  children,
  labelWidth = 120,
}: AppFormGroupProps): JSX.Element {
  if (layout === 'horizontal') {
    return (
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        {label && (
          <div style={{ width: labelWidth, paddingTop: 9, flexShrink: 0 }}>
            <AppLabel required={required}>{label}</AppLabel>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
          {(hint || error) && (
            <div style={{ marginTop: 4, fontSize: 11 }}>
              {error ? (
                <span style={{ color: 'var(--semantic-danger, #ef4444)' }}>⚠ {error}</span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>{hint}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <AppLabel required={required}>{label}</AppLabel>}
      {children}
      {(hint || error) && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          {error ? (
            <span style={{ color: 'var(--semantic-danger, #ef4444)' }}>⚠ {error}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>{hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Fieldset ============
export interface AppFieldsetProps {
  legend: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function AppFieldset({ legend, description, children }: AppFieldsetProps): JSX.Element {
  return (
    <fieldset
      style={{
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        padding: '14px 18px 18px',
        margin: '0 0 14px',
      }}
    >
      <legend
        style={{
          padding: '0 8px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}
      >
        {legend}
      </legend>
      {description && (
        <p
          style={{
            fontSize: 11.5,
            color: 'var(--color-text-muted)',
            margin: '0 0 12px',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {children}
    </fieldset>
  );
}
