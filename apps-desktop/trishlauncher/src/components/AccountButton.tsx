/**
 * Phase 38.9.D — AccountButton + AccountModal cho TrishLauncher.
 *
 * Button nhỏ trong topbar hiện trạng thái tài khoản (chưa login / trial / demo / user / admin).
 * Click → mở modal có form login compact + form Promo/Key (tùy chọn).
 *
 * KHÁC với các app standalone (Library/Check/...): KHÔNG gate Launcher — user dùng được
 * Launcher mà không cần login. Modal này chỉ là cách tùy chọn để kích hoạt tài khoản.
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  activatePromoCode,
  activateKey,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendResetPassword,
} from '@trishteam/auth';

interface RoleInfo {
  label: string;
  emoji: string;
  color: string;
  bg: string;
}

const ROLE_INFO: Record<string, RoleInfo> = {
  trial: {
    label: 'Trial',
    emoji: '✨',
    color: '#92400E',
    bg: 'rgba(245, 158, 11, 0.18)',
  },
  demo: {
    label: 'Demo',
    emoji: '⏳',
    color: '#92400E',
    bg: 'rgba(245, 158, 11, 0.18)',
  },
  user: {
    label: 'User',
    emoji: '✅',
    color: '#065F46',
    bg: 'rgba(16, 185, 129, 0.18)',
  },
  admin: {
    label: 'Admin',
    emoji: '🛡',
    color: '#1E40AF',
    bg: 'rgba(59, 130, 246, 0.18)',
  },
};

const DAY_MS = 86_400_000;

export function AccountButton(): JSX.Element {
  const { firebaseUser, profile, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const role = profile?.role ?? null;
  const info = role ? ROLE_INFO[role] : null;

  // Demo days left (chỉ khi role=demo)
  let demoLabel: string | null = null;
  if (role === 'demo' && profile?.demo_expires_at) {
    const ms = profile.demo_expires_at - Date.now();
    if (ms <= 0) {
      demoLabel = 'expired';
    } else {
      const days = Math.ceil(ms / DAY_MS);
      demoLabel = `${days}d`;
    }
  }

  // Compact label — tiết kiệm chỗ trên topbar
  let buttonLabel: string;
  let buttonStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  };
  if (loading) {
    buttonLabel = '⏳';
  } else if (!firebaseUser) {
    buttonLabel = '🔑';
    buttonStyle.width = 32;
    buttonStyle.padding = '6px';
    buttonStyle.justifyContent = 'center';
  } else if (info) {
    buttonLabel = demoLabel ? `${info.emoji} ${demoLabel}` : info.emoji;
    if (!demoLabel) {
      buttonStyle.width = 32;
      buttonStyle.padding = '6px';
      buttonStyle.justifyContent = 'center';
    }
    buttonStyle.background = info.bg;
    buttonStyle.color = info.color;
  } else {
    buttonLabel = '👤';
    buttonStyle.width = 32;
    buttonStyle.padding = '6px';
    buttonStyle.justifyContent = 'center';
  }

  const tooltip = !firebaseUser
    ? 'Đăng nhập / kích hoạt tài khoản TrishTEAM'
    : info
      ? `${info.emoji} ${info.label}${demoLabel ? ` (còn ${demoLabel})` : ''} — click để quản lý`
      : 'Tài khoản TrishTEAM';

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        title={tooltip}
        style={buttonStyle}
      >
        {buttonLabel}
      </button>
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* ────────────── Account modal ────────────── */

function AccountModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { firebaseUser, profile } = useAuth();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 14,
          padding: 24,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          color: 'var(--color-text-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            🔑 Tài khoản TrishTEAM
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 22,
              lineHeight: 1,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {!firebaseUser ? (
          <LoginCompact onClose={onClose} />
        ) : (
          <AccountInfo onClose={onClose} firebaseUser={firebaseUser} profile={profile} />
        )}
      </div>
    </div>
  );
}

/* ────────────── Compact login form ────────────── */

function LoginCompact({ onClose }: { onClose: () => void }): JSX.Element {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleEmailSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResetSent(false);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else if (mode === 'signup') {
        await signUpWithEmail({
          email: email.trim(),
          password,
          displayName: displayName.trim() || email.trim(),
        });
      } else if (mode === 'reset') {
        await sendResetPassword(email.trim());
        setResetSent(true);
      }
      // signIn / signUp success → AuthProvider tự update, modal re-render thành AccountInfo
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(): Promise<void> {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--color-border-default)',
    borderRadius: 8,
    fontSize: 13,
    background: 'var(--color-surface-bg)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div>
      <p
        style={{
          margin: '0 0 14px 0',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          lineHeight: 1.5,
        }}
      >
        Đăng nhập để kích hoạt tài khoản TrishTEAM — mở khóa các app Library / Check /
        Clean / Font / Shortcut. Launcher hoạt động bình thường mà không cần login.
      </p>

      <form onSubmit={handleEmailSubmit}>
        {mode === 'signup' && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Tên hiển thị</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nguyễn Văn A"
              disabled={loading}
              style={inputStyle}
            />
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            required
            disabled={loading}
            style={inputStyle}
            autoComplete="email"
          />
        </div>
        {mode !== 'reset' && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Tối thiểu 6 ký tự' : '••••••••'}
              required
              minLength={6}
              disabled={loading}
              style={inputStyle}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: '#991B1B',
            }}
          >
            ⚠ {error}
          </div>
        )}
        {resetSent && (
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: '#065F46',
            }}
          >
            ✅ Đã gửi email khôi phục đến <strong>{email}</strong>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: loading
              ? 'var(--color-border-default)'
              : 'var(--color-accent-primary, #10B981)',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: 10,
          }}
        >
          {loading
            ? '⏳ Đang xử lý…'
            : mode === 'signin'
              ? 'Đăng nhập'
              : mode === 'signup'
                ? 'Tạo tài khoản'
                : 'Gửi email khôi phục'}
        </button>
      </form>

      {mode !== 'reset' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              margin: '6px 0 10px',
              color: 'var(--color-text-muted)',
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
            HOẶC
            <div style={{ flex: 1, height: 1, background: 'var(--color-border-default)' }} />
          </div>
          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={loading}
            style={{
              width: '100%',
              padding: '9px',
              background: 'var(--color-surface-bg)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Đăng nhập với Google
          </button>
        </>
      )}

      {/* Mode switcher */}
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
        }}
      >
        {mode === 'signin' && (
          <>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              style={linkStyle}
            >
              Tạo tài khoản mới
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError(null);
              }}
              style={linkStyle}
            >
              Quên mật khẩu?
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            style={linkStyle}
          >
            ← Đã có tài khoản? Đăng nhập
          </button>
        )}
        {mode === 'reset' && (
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
              setResetSent(false);
            }}
            style={linkStyle}
          >
            ← Quay lại đăng nhập
          </button>
        )}
      </div>

      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Bỏ qua — dùng Launcher không cần đăng nhập
        </button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-accent-primary, #10B981)',
  cursor: 'pointer',
  padding: 0,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};

/* ────────────── Account info + activate forms ────────────── */

interface AccountInfoProps {
  onClose: () => void;
  firebaseUser: { uid: string; email: string | null; displayName?: string | null };
  profile: { role?: string; demo_expires_at?: number; display_name?: string } | null;
}

function AccountInfo({ onClose, firebaseUser, profile }: AccountInfoProps): JSX.Element {
  const { signOut } = useAuth();
  const role = profile?.role ?? 'trial';
  const info = ROLE_INFO[role] ?? ROLE_INFO.trial;
  const needsActivation =
    role === 'trial' ||
    (role === 'demo' && (profile?.demo_expires_at ?? 0) <= Date.now());

  let demoDays = 0;
  let demoExpired = false;
  if (role === 'demo' && profile?.demo_expires_at) {
    const ms = profile.demo_expires_at - Date.now();
    if (ms <= 0) {
      demoExpired = true;
    } else {
      demoDays = Math.ceil(ms / DAY_MS);
    }
  }

  return (
    <div>
      {/* User info card */}
      <div
        style={{
          padding: 14,
          background: 'var(--color-surface-elevated, rgba(0,0,0,0.03))',
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2 }}>
          Đang đăng nhập:
        </div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{firebaseUser.email}</div>
        {firebaseUser.displayName && (
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {firebaseUser.displayName}
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              background: info.bg,
              color: info.color,
            }}
          >
            {info.emoji} {info.label}
          </span>
          {role === 'demo' && !demoExpired && (
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              ⏰ Còn <strong>{demoDays}</strong> ngày
            </span>
          )}
          {demoExpired && (
            <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
              ⚠ Demo đã hết hạn
            </span>
          )}
        </div>
      </div>

      {needsActivation && (
        <>
          <div
            style={{
              padding: 10,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 12,
              color: '#92400E',
              lineHeight: 1.5,
            }}
          >
            💡 Tài khoản chưa kích hoạt — không mở được các app TrishTEAM. Nhập mã bên dưới:
          </div>
          <PromoForm />
          <KeyForm uid={firebaseUser.uid} />
        </>
      )}

      {!needsActivation && (
        <div
          style={{
            padding: 10,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 12,
            color: '#065F46',
          }}
        >
          ✅ Tài khoản đã kích hoạt — mở các app TrishTEAM được bình thường.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            onClose();
          }}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 8,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Đăng xuất
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 14px',
            background: 'var(--color-accent-primary, #10B981)',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  );
}

/* ────────────── Promo Code form ────────────── */

function PromoForm(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    | { kind: 'success'; days: number }
    | { kind: 'error'; message: string }
    | null
  >(null);

  async function handleSubmit(): Promise<void> {
    if (loading || !firebaseUser) return;
    setLoading(true);
    setResult(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await activatePromoCode(code, token);
      if (res.ok) {
        setResult({ kind: 'success', days: res.duration_days });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResult({ kind: 'error', message: res.message });
      }
    } catch (e) {
      setResult({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 10,
        padding: 10,
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid #10B981',
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: '#065F46' }}>
        🎟 Mã khuyến mãi
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
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
            padding: '7px 10px',
            border: '1px solid var(--color-border-default)',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            letterSpacing: 1,
            textTransform: 'uppercase',
            background: 'var(--color-surface-bg)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !code.trim() || result?.kind === 'success'}
          style={{
            padding: '7px 12px',
            background:
              loading || !code.trim() || result?.kind === 'success'
                ? 'var(--color-border-default)'
                : '#10B981',
            color: '#FFF',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳' : 'Kích hoạt'}
        </button>
      </div>
      {result?.kind === 'success' && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#065F46' }}>
          ✅ {result.days} ngày demo — đang tải lại…
        </div>
      )}
      {result?.kind === 'error' && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#991B1B' }}>
          ⚠ {result.message}
        </div>
      )}
    </div>
  );
}

/* ────────────── Key 16-char form ────────────── */

function KeyForm({ uid }: { uid: string }): JSX.Element {
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
    if (trimmed.length !== 16) {
      setResult({ kind: 'error', message: `Key phải đúng 16 ký tự (đang có ${trimmed.length})` });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await activateKey(uid, code);
      if (res.success) {
        setResult({ kind: 'success' });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setResult({ kind: 'error', message: res.message ?? `Lỗi: ${res.error}` });
      }
    } catch (e) {
      setResult({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }

  function fmt(raw: string): string {
    const clean = raw.replace(/[^A-Z0-9]/g, '');
    return clean.match(/.{1,4}/g)?.join('-') ?? clean;
  }

  return (
    <div
      style={{
        padding: 10,
        background: 'rgba(59, 130, 246, 0.05)',
        border: '1px solid #3B82F6',
        borderRadius: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: '#1E40AF' }}>
        🔑 Key kích hoạt (16 ký tự)
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={fmt(code)}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSubmit();
          }}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={19}
          disabled={loading || result?.kind === 'success'}
          style={{
            flex: 1,
            padding: '7px 10px',
            border: '1px solid var(--color-border-default)',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            letterSpacing: 1,
            textTransform: 'uppercase',
            background: 'var(--color-surface-bg)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !code.trim() || result?.kind === 'success'}
          style={{
            padding: '7px 12px',
            background:
              loading || !code.trim() || result?.kind === 'success'
                ? 'var(--color-border-default)'
                : '#3B82F6',
            color: '#FFF',
            border: 'none',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '⏳' : 'Kích hoạt'}
        </button>
      </div>
      {result?.kind === 'success' && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#065F46' }}>
          ✅ Đã upgrade User vĩnh viễn — đang tải lại…
        </div>
      )}
      {result?.kind === 'error' && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#991B1B' }}>
          ⚠ {result.message}
        </div>
      )}
    </div>
  );
}
