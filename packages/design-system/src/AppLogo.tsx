/**
 * Phase 44.1 + 44.10 — AppLogo: logo PNG đẹp (gradient metallic) cho 4 app TrishTEAM.
 *
 * Logo PNG nằm trong `./assets/logo-{appId}.png`.
 * Trí save 4 file PNG thật vào folder đó để override placeholder 1x1 transparent.
 * Nếu PNG là placeholder, SVG flat fallback sẽ hiển thị.
 *
 * Dùng:
 *   <AppLogo appId="work" size={64} />
 *   <AppLogo appId="utilities" size={32} bgTransparent />
 */

import type { CSSProperties } from 'react';
import logoWork      from './assets/logo-work.png';
import logoUtilities from './assets/logo-utilities.png';
import logoFinance   from './assets/logo-finance.png';
import logoAdmin     from './assets/logo-admin.png';

export type AppShellId = 'work' | 'utilities' | 'finance' | 'admin';

const APP_LOGO_PNG: Record<AppShellId, string> = {
  work:      logoWork,
  utilities: logoUtilities,
  finance:   logoFinance,
  admin:     logoAdmin,
};

const APP_LOGO_COLORS: Record<AppShellId, string> = {
  work:      '#34D399',
  utilities: '#FBBF24',
  finance:   '#2563EB',
  admin:     '#F87171',
};

const APP_BG = '#0E1A1A';

export interface AppLogoProps {
  appId: AppShellId;
  size?: number;          // px, default 48
  bgTransparent?: boolean; // bỏ nền tối
  rounded?: boolean;       // bo góc — default true
  style?: CSSProperties;
  className?: string;
}

export function AppLogo({
  appId,
  size = 48,
  bgTransparent = false,
  rounded = true,
  style,
  className,
}: AppLogoProps): JSX.Element {
  const fg = APP_LOGO_COLORS[appId];
  const pngSrc = APP_LOGO_PNG[appId];
  const bg = bgTransparent ? 'transparent' : APP_BG;
  const radius = rounded ? Math.round(size * 0.22) : 0;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        background: bg,
        borderRadius: radius,
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
      aria-label={`Trish${appId.charAt(0).toUpperCase() + appId.slice(1)} logo`}
      role="img"
    >
      {/* Fallback SVG flat (chữ T + swoosh) — render trước, ẩn dưới PNG. */}
      <svg
        viewBox="0 0 64 64"
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, margin: 'auto' }}
      >
        <path
          d="M16 14 L48 14 L48 22 L36 22 L36 50 L28 50 L28 22 L16 22 Z"
          fill={fg}
        />
        <path
          d="M40 30 Q48 36 54 50"
          stroke={fg}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {/* PNG đè lên SVG. Khi PNG là 1x1 placeholder → ảnh trong suốt, SVG hiển thị.
          Khi PNG thật → ảnh đẹp che SVG. */}
      <img
        src={pngSrc}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          position: 'relative',
          zIndex: 2,
        }}
        aria-hidden="true"
      />
    </span>
  );
}

/** Lấy mã màu accent (light theme) của 1 app — dùng cho inline style. */
export function getAppAccentColor(appId: AppShellId): string {
  return APP_LOGO_COLORS[appId];
}
