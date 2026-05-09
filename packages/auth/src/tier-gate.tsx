/**
 * TierGate — Replace cho KeyGate (Phase post-key-system).
 *
 * Check user role → render children (admin/user/demo còn hạn) hoặc
 * block screen (trial / demo expired). Yêu cầu user đã login Firebase.
 *
 * Roles:
 *   admin / user — pass
 *   demo (chưa hết hạn) — pass + hiển thị banner còn X ngày
 *   demo (hết hạn) — block "Hết hạn demo, liên hệ admin"
 *   trial — block "Liên hệ admin để được upgrade"
 *
 * Usage:
 *   <AuthProvider>
 *     <TierGate appName="TrishLibrary">
 *       <App />
 *     </TierGate>
 *   </AuthProvider>
 */

import { useMemo, type ReactNode } from 'react';
import { useAuth } from './react.js';
import { canAccessApp } from '@trishteam/data';

export interface TierGateProps {
  /** Tên app hiển thị trong block screen */
  appName: string;
  /** Children render khi user pass tier check */
  children: ReactNode;
  /** Custom block screen (override default) */
  blockScreen?: (reason: 'trial-blocked' | 'demo-expired') => ReactNode;
  /** Custom loading fallback */
  loadingFallback?: ReactNode;
  /** Custom no-user (chưa login) — default: render children để app tự xử lý LoginScreen */
  noUserFallback?: ReactNode;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function TierGate({
  appName,
  children,
  blockScreen,
  loadingFallback,
  noUserFallback,
}: TierGateProps): JSX.Element {
  const { firebaseUser, profile, loading, signOut } = useAuth();

  const accessCheck = useMemo(() => {
    if (!firebaseUser || !profile) return null;
    return canAccessApp(profile);
  }, [firebaseUser, profile]);

  const daysLeft = useMemo(() => {
    if (profile?.role !== 'demo' || !profile.demo_expires_at) return null;
    const ms = profile.demo_expires_at - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / DAY_MS);
  }, [profile]);

  if (loading) {
    return (
      <>
        {loadingFallback ?? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              color: '#6B7280',
            }}
          >
            Đang tải…
          </div>
        )}
      </>
    );
  }

  // Chưa login → để app tự xử lý LoginScreen
  if (!firebaseUser || !profile) {
    return <>{noUserFallback ?? children}</>;
  }

  // Pass → render app + (optional) demo banner
  if (accessCheck?.allowed) {
    return (
      <>
        {profile.role === 'demo' && daysLeft !== null && daysLeft > 0 && (
          <DemoBanner daysLeft={daysLeft} />
        )}
        {children}
      </>
    );
  }

  // Block screen
  const reason = accessCheck?.reason;
  if (reason === 'trial-blocked' || reason === 'demo-expired') {
    if (blockScreen) return <>{blockScreen(reason)}</>;
    return (
      <DefaultBlockScreen
        reason={reason}
        appName={appName}
        userEmail={firebaseUser.email ?? ''}
        onSignOut={async () => {
          if (signOut) await signOut();
        }}
      />
    );
  }

  return <>{children}</>;
}

function DemoBanner({ daysLeft }: { daysLeft: number }): JSX.Element {
  const urgent = daysLeft <= 3;
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '6px 16px',
        background: urgent
          ? 'linear-gradient(90deg, #FEF3C7, #FDE68A)'
          : 'linear-gradient(90deg, #DBEAFE, #BFDBFE)',
        color: urgent ? '#92400E' : '#1E40AF',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        borderBottom: `1px solid ${urgent ? '#F59E0B' : '#3B82F6'}`,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      🎁 Bản dùng thử (Demo) — còn {daysLeft} ngày. Liên hệ admin để chuyển sang
      bản chính thức (User).
    </div>
  );
}

function DefaultBlockScreen({
  reason,
  appName,
  userEmail,
  onSignOut,
}: {
  reason: 'trial-blocked' | 'demo-expired';
  appName: string;
  userEmail: string;
  onSignOut: () => Promise<void>;
}): JSX.Element {
  const title =
    reason === 'demo-expired' ? '⏰ Hết hạn dùng thử' : '🔒 Tài khoản chưa được kích hoạt';
  const message =
    reason === 'demo-expired'
      ? `Bản dùng thử (Demo) của tài khoản ${userEmail} đã hết hạn. Liên hệ admin để gia hạn hoặc chuyển sang bản chính thức.`
      : `Tài khoản ${userEmail} đang ở chế độ Trial — chưa được kích hoạt. Liên hệ admin TrishTEAM để được upgrade lên Demo (dùng thử có hạn) hoặc User (chính thức).`;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: 'var(--bg, #fafafa)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          padding: 32,
          background: 'var(--bg-elev, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 22, marginTop: 0, color: '#DC2626' }}>{title}</h1>
        <p style={{ marginTop: 16, lineHeight: 1.6, color: '#374151', fontSize: 14 }}>
          {message}
        </p>
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: 'rgba(0,0,0,0.04)',
            borderRadius: 6,
            fontSize: 12,
            color: '#6B7280',
          }}
        >
          📩 Liên hệ admin: <strong>hosytri77@gmail.com</strong>
          <br />
          Hoặc qua website <strong>trishteam.io.vn</strong>
        </div>
        <button
          type="button"
          onClick={() => void onSignOut()}
          style={{
            marginTop: 20,
            padding: '8px 20px',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--fg, #1a1a1a)',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Đăng xuất + đăng nhập tài khoản khác
        </button>
        <p style={{ marginTop: 16, fontSize: 11, color: '#9CA3AF' }}>
          App: <code>{appName}</code>
        </p>
      </div>
    </div>
  );
}
