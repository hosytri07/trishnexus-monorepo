/**
 * Phase 44.2 + 45.6 — AuthGate (refactor dùng components mới).
 *
 * Gate component cho 4 app mới. Flow:
 *   - Đang load auth → spinner
 *   - Chưa login → <LoginScreen>
 *   - Có lỗi load profile → màn lỗi với nút Tải lại
 *   - Role admin → BYPASS, render children
 *   - Có app_keys[appId] → render children
 *   - Thiếu/hết hạn → màn "Cần cấp quyền" với info chi tiết + nút Liên hệ admin/Đăng xuất
 */

import { type ReactNode } from 'react';
import { type AppId, type TrishUser, userHasAppAccess } from '@trishteam/data';
import { useAuth } from './react.js';
import { LoginScreen } from './login-screen.js';

export interface AuthGateProps {
  appId: AppId;
  appShellId?: 'work' | 'utilities' | 'finance' | 'admin';
  appName: string;
  appTagline?: string;
  children: ReactNode;
  noAccessFallback?: (user: TrishUser) => ReactNode;
}

export function AuthGate({
  appId,
  appShellId,
  appName,
  appTagline,
  children,
  noAccessFallback,
}: AuthGateProps): JSX.Element {
  const { loading, firebaseUser, profile, profileError, signOut } = useAuth();

  if (loading) {
    return <GateLoading message="Đang khởi động..." />;
  }
  if (!firebaseUser) {
    return <LoginScreen appName={appName} tagline={appTagline} appShellId={appShellId} />;
  }
  if (profileError && !profile) {
    return (
      <GateError
        title="Không tải được hồ sơ"
        message={profileError}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!profile) {
    return <GateLoading message="Đang khởi tạo hồ sơ..." />;
  }
  if (profile.role === 'admin') {
    return <>{children}</>;
  }
  if (userHasAppAccess(profile, appId)) {
    return <>{children}</>;
  }
  if (noAccessFallback) return <>{noAccessFallback(profile)}</>;
  return (
    <NoAccessScreen
      appName={appName}
      role={profile.role}
      user={profile}
      email={firebaseUser.email}
      onSignOut={() => void signOut()}
    />
  );
}

// ============================================================
// Internal screens (dùng inline styles — tránh circular dep với design-system)
// ============================================================

function GateLoading({ message }: { message: string }): JSX.Element {
  return (
    <div style={centerScreenStyle}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
        <div
          style={{
            display: 'inline-block',
            width: 24,
            height: 24,
            border: '3px solid var(--color-border-default)',
            borderTopColor: 'var(--color-accent-primary)',
            borderRadius: '50%',
            animation: 'app-spin 0.7s linear infinite',
            marginBottom: 12,
          }}
          aria-hidden="true"
        />
        <div>{message}</div>
      </div>
    </div>
  );
}

function GateError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div style={centerScreenStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>⚠</div>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: 'center', color: 'var(--color-text-primary)' }}>
          {title}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 1.6 }}>
          {message}
        </p>
        <button type="button" onClick={onRetry} style={primaryBtnStyle}>
          🔄 Tải lại
        </button>
      </div>
    </div>
  );
}

function NoAccessScreen({
  appName,
  role,
  user,
  email,
  onSignOut,
}: {
  appName: string;
  role: string;
  user: TrishUser | null;
  email: string | null;
  onSignOut: () => void;
}): JSX.Element {
  const reasonText: Record<string, string> = {
    trial: 'Tài khoản của bạn đang ở chế độ Dùng thử. Liên hệ quản trị viên để được cấp quyền truy cập.',
    demo:  'Tài khoản Demo đã hết hạn hoặc chưa được kích hoạt cho ứng dụng này.',
    user:  'Bạn chưa có quyền dùng ứng dụng này. Vui lòng liên hệ quản trị viên.',
  };
  const roleLabel: Record<string, { label: string; bg: string; fg: string }> = {
    trial: { label: '✨ Trial', bg: 'rgba(245,158,11,0.12)', fg: '#b45309' },
    demo:  { label: '⏳ Demo', bg: 'rgba(59,130,246,0.12)', fg: '#1e40af' },
    user:  { label: '✅ User', bg: 'rgba(16,185,129,0.12)', fg: '#047857' },
    admin: { label: '🛡 Admin', bg: 'rgba(239,68,68,0.12)', fg: '#b91c1c' },
  };
  const note = reasonText[role] ?? reasonText.user;
  const roleBadge = roleLabel[role] ?? roleLabel.user;

  return (
    <div style={centerScreenStyle}>
      <div style={{ ...cardStyle, maxWidth: 460 }}>
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>🔒</div>

        {/* Title */}
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
          Cần cấp quyền truy cập
        </h1>

        {/* Description */}
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5, textAlign: 'center', marginBottom: 22, lineHeight: 1.65 }}>
          {note}
        </p>

        {/* Info card */}
        <div
          style={{
            background: 'var(--color-surface-muted)',
            borderRadius: 10,
            padding: '14px 16px',
            marginBottom: 20,
            fontSize: 12.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          <InfoRow label="📱 Ứng dụng" value={<strong style={{ color: 'var(--color-text-primary)' }}>{appName}</strong>} />
          <InfoRow label="📧 Email" value={email ?? '(unknown)'} />
          <InfoRow
            label="👤 Vai trò"
            value={
              <span
                style={{
                  display: 'inline-flex',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: roleBadge.bg,
                  color: roleBadge.fg,
                }}
              >
                {roleBadge.label}
              </span>
            }
          />
        </div>

        {/* Admin contact */}
        <div
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent-primary)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 18,
            fontSize: 12,
            color: 'var(--color-accent-primary)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          📞 Liên hệ admin để xin cấp quyền:<br/>
          <strong>trishteam.official@gmail.com</strong>
        </div>

        {/* Sign out button */}
        <button type="button" onClick={onSignOut} style={secondaryBtnStyle}>
          ← Đăng xuất
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ============ Styles ============
const centerScreenStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--color-surface-bg)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 16,
  boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
  padding: '32px 36px',
};

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 18px',
  background: 'var(--color-accent-gradient, var(--color-accent-primary))',
  color: 'white',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  background: 'transparent',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 150ms',
};
