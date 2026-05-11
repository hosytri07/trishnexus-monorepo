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

import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './react.js';
import { canAccessApp } from '@trishteam/data';
import { activatePromoCode } from './promo-client.js';
import { activateKey } from './profile.js';

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
        uid={firebaseUser.uid}
        getIdToken={() => firebaseUser.getIdToken()}
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
  uid,
  getIdToken,
  onSignOut,
}: {
  reason: 'trial-blocked' | 'demo-expired';
  appName: string;
  userEmail: string;
  uid: string;
  getIdToken: () => Promise<string>;
  onSignOut: () => Promise<void>;
}): JSX.Element {
  const title =
    reason === 'demo-expired' ? '⏰ Hết hạn dùng thử' : '🔒 Tài khoản chưa được kích hoạt';
  const message =
    reason === 'demo-expired'
      ? `Bản dùng thử (Demo) của tài khoản ${userEmail} đã hết hạn. Liên hệ admin để gia hạn hoặc nhập mã khuyến mãi mới (nếu có).`
      : `Tài khoản ${userEmail} đang ở chế độ Trial — chưa được kích hoạt. Nhập mã khuyến mãi (nếu có) hoặc liên hệ admin TrishTEAM.`;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: 'var(--color-surface-bg)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          padding: 32,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 22, marginTop: 0, color: '#DC2626' }}>{title}</h1>
        <p style={{ marginTop: 16, lineHeight: 1.6, color: '#374151', fontSize: 14 }}>
          {message}
        </p>

        <PromoCodeForm getIdToken={getIdToken} />

        <ActivationKeyForm uid={uid} />

        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: 'rgba(0,0,0,0.04)',
            borderRadius: 8,
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
            border: '1px solid var(--color-border-default)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--color-text-primary)',
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

/* ────────────── Promo code form (Phase 38.8) ────────────── */

function PromoCodeForm({
  getIdToken,
}: {
  getIdToken: () => Promise<string>;
}): JSX.Element {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'success'; durationDays: number; expiresAt: number }
    | { kind: 'error'; message: string }
    | null
  >(null);

  async function handleSubmit(): Promise<void> {
    if (loading) return;
    if (!code.trim()) {
      setResult({ kind: 'error', message: 'Vui lòng nhập mã.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const token = await getIdToken();
      const res = await activatePromoCode(code, token);
      if (res.ok) {
        setResult({
          kind: 'success',
          durationDays: res.duration_days,
          expiresAt: res.demo_expires_at,
        });
        // Reload sau 2s để TierGate fetch lại profile mới (role=demo)
        setTimeout(() => {
          if (typeof window !== 'undefined') window.location.reload();
        }, 2000);
      } else {
        setResult({ kind: 'error', message: res.message });
      }
    } catch (e) {
      setResult({
        kind: 'error',
        message: `Lỗi: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        background: 'var(--color-surface-elevated, rgba(16, 185, 129, 0.05))',
        border: '1px solid var(--color-accent-primary, #10B981)',
        borderRadius: 14,
        textAlign: 'left',
      }}
    >
      <label
        htmlFor="promo-code-input"
        style={{
          display: 'block',
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 8,
          color: 'var(--color-text-primary, #111827)',
        }}
      >
        🎟 Mã khuyến mãi / dùng thử
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="promo-code-input"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
          placeholder="VD: TRIAL2026"
          maxLength={32}
          disabled={loading || result?.kind === 'success'}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'monospace',
            letterSpacing: 1,
            textTransform: 'uppercase',
            background: 'var(--color-surface-bg, #FFF)',
            color: 'var(--color-text-primary, #111827)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !code.trim() || result?.kind === 'success'}
          style={{
            padding: '10px 16px',
            background:
              loading || !code.trim() || result?.kind === 'success'
                ? 'var(--color-border-default, #D1D5DB)'
                : 'var(--color-accent-primary, #10B981)',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor:
              loading || !code.trim() || result?.kind === 'success'
                ? 'not-allowed'
                : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '⏳ Đang xử lý…' : '🎟 Kích hoạt'}
        </button>
      </div>

      {result?.kind === 'success' && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10B981',
            borderRadius: 8,
            fontSize: 13,
            color: '#065F46',
          }}
        >
          ✅ Kích hoạt thành công! Bạn có <strong>{result.durationDays} ngày</strong> dùng
          thử, hết hạn <strong>{new Date(result.expiresAt).toLocaleString('vi-VN')}</strong>.
          <div style={{ marginTop: 6, color: '#047857' }}>
            🔄 Đang tải lại trang…
          </div>
        </div>
      )}
      {result?.kind === 'error' && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid #DC2626',
            borderRadius: 8,
            fontSize: 13,
            color: '#991B1B',
          }}
        >
          ⚠ {result.message}
        </div>
      )}
    </div>
  );
}

/* ────────────── Activation key 16-char form (Phase 38.9) ────────────── */

function ActivationKeyForm({ uid }: { uid: string }): JSX.Element {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'success' }
    | { kind: 'error'; message: string }
    | null
  >(null);

  async function handleSubmit(): Promise<void> {
    if (loading) return;
    const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!trimmed) {
      setResult({ kind: 'error', message: 'Vui lòng nhập mã key.' });
      return;
    }
    if (trimmed.length !== 16) {
      setResult({
        kind: 'error',
        message: `Mã key phải đúng 16 ký tự (đang có ${trimmed.length}).`,
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await activateKey(uid, code);
      if (res.success) {
        setResult({ kind: 'success' });
        setTimeout(() => {
          if (typeof window !== 'undefined') window.location.reload();
        }, 2000);
      } else {
        setResult({
          kind: 'error',
          message: res.message ?? `Lỗi: ${res.error}`,
        });
      }
    } catch (e) {
      setResult({
        kind: 'error',
        message: `Lỗi: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  // Format display: XXXX-XXXX-XXXX-XXXX
  function formatDisplay(raw: string): string {
    const clean = raw.replace(/[^A-Z0-9]/g, '');
    return clean.match(/.{1,4}/g)?.join('-') ?? clean;
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        background: 'var(--color-surface-elevated, rgba(59, 130, 246, 0.05))',
        border: '1px solid var(--color-info, #3B82F6)',
        borderRadius: 14,
        textAlign: 'left',
      }}
    >
      <label
        htmlFor="activation-key-input"
        style={{
          display: 'block',
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 8,
          color: 'var(--color-text-primary, #111827)',
        }}
      >
        🔑 Mã kích hoạt (key admin cấp)
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="activation-key-input"
          type="text"
          value={formatDisplay(code)}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={19} // 16 + 3 dashes
          disabled={loading || result?.kind === 'success'}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'monospace',
            letterSpacing: 1,
            textTransform: 'uppercase',
            background: 'var(--color-surface-bg, #FFF)',
            color: 'var(--color-text-primary, #111827)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !code.trim() || result?.kind === 'success'}
          style={{
            padding: '10px 16px',
            background:
              loading || !code.trim() || result?.kind === 'success'
                ? 'var(--color-border-default, #D1D5DB)'
                : 'var(--color-info, #3B82F6)',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor:
              loading || !code.trim() || result?.kind === 'success'
                ? 'not-allowed'
                : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '⏳ Đang xử lý…' : '🔑 Kích hoạt'}
        </button>
      </div>

      {result?.kind === 'success' && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10B981',
            borderRadius: 8,
            fontSize: 13,
            color: '#065F46',
          }}
        >
          ✅ Kích hoạt thành công! Bạn đã được upgrade lên <strong>User</strong> (vĩnh viễn).
          <div style={{ marginTop: 6, color: '#047857' }}>🔄 Đang tải lại trang…</div>
        </div>
      )}
      {result?.kind === 'error' && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid #DC2626',
            borderRadius: 8,
            fontSize: 13,
            color: '#991B1B',
          }}
        >
          ⚠ {result.message}
        </div>
      )}
    </div>
  );
}
