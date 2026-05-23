/**
 * Phase 44.2 — AuthGate (replace KeyGate cũ).
 *
 * Gate component cho 4 app mới (TrishWork / TrishUtilities / TrishFinance / TrishAdmin).
 *
 * Khác KeyGate cũ:
 * - Không có input "Nhập mã key" trong app. User KHÔNG nhập key tay.
 * - Chỉ check Firebase Auth + role + app_keys[appId] có binding chưa.
 * - Trial user (vừa signup) thấy màn "Liên hệ admin cấp quyền".
 * - Admin cấp quyền qua TrishAdmin panel → Firestore `/users/{uid}.app_keys[appId]`
 *   được set → user mở lại app vào bình thường.
 *
 * Flow:
 *   - chưa login → render <LoginScreen> (Google + email/pwd)
 *   - profile loading → render spinner
 *   - role='admin' → BYPASS toàn bộ check → render children
 *   - có app_keys[appId] còn hạn → render children
 *   - thiếu hoặc hết hạn → render <NoAccessScreen> ("Liên hệ admin")
 *
 * Dùng:
 *   import { AuthGate } from '@trishteam/auth/react';
 *
 *   <AuthGate appId="trishwork" appName="TrishWork">
 *     <AppShell ... />
 *   </AuthGate>
 */

import { type ReactNode } from 'react';
import { type AppId, type TrishUser, userHasAppAccess } from '@trishteam/data';
import { useAuth } from './react.js';
import { LoginScreen } from './login-screen.js';

export interface AuthGateProps {
  /** Data.AppId — vd 'trishwork', 'trishutilities', 'trishfinance', 'trishadmin'. */
  appId: AppId;
  /** Phase 44 — AppShellId cho LoginScreen render AppLogo SVG (work/utilities/finance/admin). */
  appShellId?: 'work' | 'utilities' | 'finance' | 'admin';
  /** Tên hiển thị app cho login / no-access screen. */
  appName: string;
  /** Tagline ngắn — vd "Kỹ sư · Thư viện · ISO". */
  appTagline?: string;
  /** Children render khi user có quyền. */
  children: ReactNode;
  /** Override màn no-access (hiếm dùng). */
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

  // 1. Auth chưa ready → spinner
  if (loading) {
    return <GateLoading message="Đang khởi động..." />;
  }

  // 2. Chưa login → LoginScreen (đã có sẵn — Google + email/pwd)
  if (!firebaseUser) {
    return <LoginScreen appName={appName} tagline={appTagline} appShellId={appShellId} />;
  }

  // 3. Profile load lỗi (network / rules deny)
  if (profileError && !profile) {
    return (
      <GateError
        title="Không tải được hồ sơ"
        message={profileError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 4. Self-heal đã tạo trial profile synthetic — luôn có profile sau loading
  if (!profile) {
    return <GateLoading message="Đang khởi tạo hồ sơ..." />;
  }

  // 5. Admin bypass tất cả check
  if (profile.role === 'admin') {
    return <>{children}</>;
  }

  // 6. Có app access binding (active + còn hạn)
  if (userHasAppAccess(profile, appId)) {
    return <>{children}</>;
  }

  // 7. Không có quyền → màn liên hệ admin (hoặc fallback custom)
  if (noAccessFallback) return <>{noAccessFallback(profile)}</>;
  return (
    <NoAccessScreen
      appName={appName}
      reason={profile.role}
      user={profile}
      email={firebaseUser.email}
      onSignOut={() => void signOut()}
    />
  );
}

// ============================================================
// Internal screens
// ============================================================

function GateLoading({ message }: { message: string }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-surface-bg, #f4f3f0)',
        color: 'var(--color-text-muted, #6b6877)',
        fontSize: 14,
      }}
    >
      <span style={{ marginRight: 10 }}>⏳</span> {message}
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-surface-bg, #f4f3f0)',
        color: 'var(--color-text-primary, #1c1b22)',
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>⚠ {title}</h1>
      <p style={{ color: 'var(--color-text-muted, #6b6877)', marginBottom: 16, maxWidth: 480 }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: '10px 18px',
          background: 'var(--color-accent-primary, #059669)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Tải lại
      </button>
    </div>
  );
}

function NoAccessScreen({
  appName,
  reason,
  user,
  email,
  onSignOut,
}: {
  appName: string;
  reason: string;
  user: TrishUser | null;
  email: string | null;
  onSignOut: () => void;
}): JSX.Element {
  const reasonText: Record<string, string> = {
    trial: 'Tài khoản của bạn đang ở chế độ Dùng thử. Liên hệ quản trị viên để được cấp quyền truy cập.',
    demo:  'Tài khoản Demo của bạn đã hết hạn hoặc chưa được kích hoạt cho ứng dụng này.',
    user:  'Bạn chưa có quyền dùng ứng dụng này. Vui lòng liên hệ quản trị viên.',
    admin: 'Lỗi nội bộ: admin thì luôn có quyền, sao lại vào màn này?',
  };
  const note = reasonText[reason] ?? reasonText.user;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-surface-bg, #f4f3f0)',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--color-surface-card, #ffffff)',
          padding: '40px 48px',
          borderRadius: 14,
          border: '1px solid var(--color-border-subtle, rgba(0,0,0,0.08))',
          maxWidth: 480,
          boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            marginBottom: 8,
            color: 'var(--color-text-primary, #1c1b22)',
          }}
        >
          🔒 Cần cấp quyền
        </h1>
        <p
          style={{
            color: 'var(--color-text-muted, #6b6877)',
            fontSize: 14,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {note}
        </p>

        <div
          style={{
            background: 'var(--color-surface-muted, #ebe9e3)',
            padding: '14px 16px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--color-text-secondary, #3f3d4a)',
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Ứng dụng:</strong> {appName}
          </div>
          <div style={{ marginBottom: 4 }}>
            <strong>Email:</strong> {email ?? '(unknown)'}
          </div>
          <div>
            <strong>Vai trò:</strong> {user?.role ?? 'trial'}
          </div>
        </div>

        <p
          style={{
            color: 'var(--color-text-muted, #6b6877)',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Liên hệ quản trị viên qua email: <strong>trishteam.official@gmail.com</strong>
        </p>

        <button
          type="button"
          onClick={onSignOut}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            color: 'var(--color-text-secondary, #3f3d4a)',
            border: '1px solid var(--color-border-default, rgba(0,0,0,0.12))',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );
}
