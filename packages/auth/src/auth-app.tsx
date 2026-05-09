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

import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from './react.js';
import { LoginScreen } from './login-screen.js';
import { TierGate } from './tier-gate.js';

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
