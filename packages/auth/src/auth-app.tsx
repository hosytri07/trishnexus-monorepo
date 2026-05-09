/**
 * AuthApp — wrapper one-shot cho desktop apps.
 *
 * Gói gọn:
 *   1. <AuthProvider> — Firebase auth state
 *   2. <LoginScreen> — khi chưa login (firebaseUser=null)
 *   3. <TierGate> — block trial / demo expired, pass user/admin/demo còn hạn
 *   4. children — render app thật
 *
 * Usage:
 *   <AuthApp appName="TrishCheck" tagline="Kiểm tra máy" logoUrl={logoUrl}>
 *     <App />
 *   </AuthApp>
 */

import { useEffect, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './react.js';
import { LoginScreen } from './login-screen.js';
import { TierGate } from './tier-gate.js';

/**
 * Apply saved theme từ localStorage `trishteam:theme` (light/dark/system) → set
 * `data-theme` attribute trên :root. Đảm bảo LoginScreen + TierGate respect
 * theme dark/light đồng bộ với app sau khi login.
 */
function applyThemeFromStorage(): void {
  if (typeof window === 'undefined') return;
  let theme: 'light' | 'dark' | 'system' = 'system';
  try {
    const saved = localStorage.getItem('trishteam:theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      theme = saved;
    }
  } catch {
    /* ignore */
  }
  const effective: 'light' | 'dark' =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', effective);
}

export interface AuthAppProps {
  appName: string;
  tagline?: string;
  logoUrl?: string;
  children: ReactNode;
  /** Custom block screen khi trial/demo-expired */
  blockScreen?: (reason: 'trial-blocked' | 'demo-expired') => ReactNode;
}

export function AuthApp({
  appName,
  tagline,
  logoUrl,
  children,
  blockScreen,
}: AuthAppProps): JSX.Element {
  return (
    <AuthProvider>
      <AuthAppInner
        appName={appName}
        tagline={tagline}
        logoUrl={logoUrl}
        blockScreen={blockScreen}
      >
        {children}
      </AuthAppInner>
    </AuthProvider>
  );
}

function AuthAppInner({
  appName,
  tagline,
  logoUrl,
  blockScreen,
  children,
}: AuthAppProps): JSX.Element {
  const { firebaseUser, loading } = useAuth();

  // Apply theme dark/light đồng bộ với saved settings (đảm bảo LoginScreen
  // + block screen respect theme system của app, không bị flash white).
  useEffect(() => {
    applyThemeFromStorage();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          color: '#6B7280',
        }}
      >
        Đang tải…
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginScreen appName={appName} tagline={tagline} logoUrl={logoUrl} />;
  }

  return (
    <TierGate appName={appName} blockScreen={blockScreen}>
      {children}
    </TierGate>
  );
}
