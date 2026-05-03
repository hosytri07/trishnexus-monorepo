/**
 * Toggle — Phase 32.12
 *
 * Animated slide switch (iOS-style). Replace native checkbox để UI đẹp hơn.
 * 2 size: 'sm' (compact) hoặc 'md' (default).
 */

import { CSSProperties } from 'react';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Màu khi bật. Mặc định emerald accent. */
  accentColor?: string;
}

export function Toggle({
  checked, onChange, disabled = false, size = 'md', accentColor = 'var(--color-accent-primary)',
}: Props): JSX.Element {
  const dims = size === 'sm'
    ? { width: 32, height: 18, knob: 14, padding: 2 }
    : { width: 40, height: 22, knob: 18, padding: 2 };

  const trackStyle: CSSProperties = {
    width: dims.width,
    height: dims.height,
    background: checked ? accentColor : 'var(--color-border-strong)',
    borderRadius: dims.height / 2,
    position: 'relative',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 200ms ease-out',
    flexShrink: 0,
    opacity: disabled ? 0.5 : 1,
  };

  const knobStyle: CSSProperties = {
    position: 'absolute',
    top: dims.padding,
    left: dims.padding,
    width: dims.knob,
    height: dims.knob,
    background: '#ffffff',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.20)',
    transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    transform: checked
      ? `translateX(${dims.width - dims.knob - dims.padding * 2}px)`
      : 'translateX(0)',
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={trackStyle}
      tabIndex={disabled ? -1 : 0}
    >
      <span style={knobStyle} aria-hidden="true" />
    </button>
  );
}
