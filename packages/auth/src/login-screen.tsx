/**
 * Phase 45.5 — LoginScreen refactor: dùng AppCard + AppButton + AppInput + AppFormGroup.
 * Đồng bộ 4 app TrishTEAM (Work / Utilities / Finance / Admin) — chỉ khác accent.
 *
 * Email/Password + Google OAuth. Sau khi login → AuthProvider auto fire,
 * parent app render UI thật.
 *
 * Usage:
 *   <LoginScreen appName="TrishWork" appShellId="work" tagline="Kỹ sư · Thư viện · ISO" />
 */

import { useState, useEffect, type FormEvent } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendResetPassword,
  signInWithGoogleRedirect,
} from './sign-in.js';

type Mode = 'signin' | 'signup' | 'forgot';

// Phase 44 — AppLogo SVG inline (chữ T + swoosh). Không import design-system
// để tránh circular dep (design-system import auth, không ngược lại).
const APP_LOGO_COLORS = {
  work:      '#34D399',
  utilities: '#FBBF24',
  finance:   '#2563EB',
  admin:     '#F87171',
} as const;

function AppLogoInline({ appShellId, size = 72 }: { appShellId: keyof typeof APP_LOGO_COLORS; size?: number }): JSX.Element {
  const fg = APP_LOGO_COLORS[appShellId];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: '#0E1A1A',
        borderRadius: Math.round(size * 0.22),
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
      role="img"
    >
      <svg
        viewBox="0 0 64 64"
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        aria-hidden="true"
      >
        <path d="M16 14 L48 14 L48 22 L36 22 L36 50 L28 50 L28 22 L16 22 Z" fill={fg} />
        <path d="M40 30 Q48 36 54 50" stroke={fg} strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

interface LoginScreenProps {
  appName: string;
  logoUrl?: string;
  appShellId?: 'work' | 'utilities' | 'finance' | 'admin';
  tagline?: string;
}

export function LoginScreen({
  appName,
  logoUrl,
  appShellId,
  tagline,
}: LoginScreenProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const REMEMBER_KEY = `trishteam:remember_email`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, [REMEMBER_KEY]);

  function persistEmail(value: string): void {
    try {
      if (remember && value.trim()) {
        localStorage.setItem(REMEMBER_KEY, value.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        persistEmail(email);
      } else if (mode === 'signup') {
        await signUpWithEmail({
          email: email.trim(),
          password,
          displayName: displayName.trim() || email.trim().split('@')[0]!,
        });
        persistEmail(email);
      } else {
        await sendResetPassword(email.trim());
        setInfo(`Đã gửi link đặt lại mật khẩu đến ${email}. Vui lòng kiểm tra email.`);
      }
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      setError(translateAuthError(err));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--color-surface-bg)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 16,
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          padding: '32px 36px',
        }}
      >
        {/* Header — Logo + Title + Tagline */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {appShellId ? (
            <div style={{ display: 'inline-flex', marginBottom: 16 }}>
              <AppLogoInline appShellId={appShellId} size={72} />
            </div>
          ) : logoUrl && (
            <div
              style={{
                display: 'inline-flex',
                width: 64,
                height: 64,
                borderRadius: 14,
                marginBottom: 16,
                background: '#0E1A1A',
                padding: 6,
              }}
            >
              <img src={logoUrl} alt={appName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            {appName}
          </h1>
          {tagline && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                margin: '6px 0 0',
                lineHeight: 1.5,
              }}
            >
              {tagline}
            </p>
          )}
        </div>

        {/* Mode title */}
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            marginTop: 0,
            marginBottom: 18,
            color: 'var(--color-text-primary)',
          }}
        >
          {mode === 'signin'
            ? '🔑 Đăng nhập'
            : mode === 'signup'
              ? '📝 Tạo tài khoản mới'
              : '✉ Đặt lại mật khẩu'}
        </h2>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          {mode === 'signup' && (
            <FormField label="Tên hiển thị">
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
              />
            </FormField>
          )}

          <FormField label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              autoComplete="email"
              autoFocus={mode === 'signin'}
            />
          </FormField>

          {mode !== 'forgot' && (
            <FormField label="Mật khẩu" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </FormField>
          )}

          {mode === 'signin' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 18 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                />
                Ghi nhớ email
              </label>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(null); setInfo(null); }}
                style={linkBtnStyle}
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          {error && (
            <div style={alertStyle('danger')}>
              <strong>⚠</strong> {error}
            </div>
          )}
          {info && (
            <div style={alertStyle('info')}>
              <strong>ℹ</strong> {info}
            </div>
          )}

          <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
            {busy ? '⏳ Đang xử lý...' : mode === 'signin' ? '🔑 Đăng nhập' : mode === 'signup' ? '📝 Tạo tài khoản' : '✉ Gửi link đặt lại'}
          </button>
        </form>

        {/* Divider */}
        {mode !== 'forgot' && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '20px 0',
                color: 'var(--color-text-muted)',
                fontSize: 11.5,
              }}
            >
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
              <span>hoặc</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
            </div>

            <button type="button" onClick={() => void handleGoogleSignIn()} disabled={busy} style={googleBtnStyle(busy)}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5C13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.5 0 19.4-7.7 19.4-19.5c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8c1.8-4.4 6-7.5 11.1-7.5c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4.5 24 4.5c-7.5 0-14 4.2-17.7 10.2z"/>
                <path fill="#4CAF50" d="M24 43.5c5.3 0 10.1-2 13.7-5.3l-6.3-5.3c-2 1.4-4.5 2.2-7.4 2.2c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.9 39.3 16.4 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.3 5.3c4.4-4 7.4-10.1 7.4-17.4c0-1.2-.1-2.4-.4-3.5z"/>
              </svg>
              Đăng nhập bằng Google
            </button>
          </>
        )}

        {/* Footer links */}
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12 }}>
          {mode === 'signin' && (
            <button type="button" onClick={() => { setMode('signup'); setError(null); setInfo(null); }} style={linkBtnStyle}>
              Tạo tài khoản mới
            </button>
          )}
          {mode === 'signup' && (
            <button type="button" onClick={() => { setMode('signin'); setError(null); setInfo(null); }} style={linkBtnStyle}>
              ← Đã có tài khoản? Đăng nhập
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => { setMode('signin'); setError(null); setInfo(null); }} style={linkBtnStyle}>
              ← Quay lại đăng nhập
            </button>
          )}
        </div>

        {/* Trial notice */}
        <p
          style={{
            marginTop: 24,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          ⚠ Tài khoản mới mặc định ở chế độ <strong>Trial (chưa kích hoạt)</strong>.<br/>
          Liên hệ admin để được cấp quyền truy cập ứng dụng.
        </p>
      </div>
    </div>
  );
}

// ============ Internal mini components ============
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 5 }}>
        {label}
        {required && <span style={{ color: 'var(--semantic-danger, #ef4444)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 13.5,
        background: 'var(--color-surface-card)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 8,
        outline: 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
        e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-soft)';
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-default)';
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
    />
  );
}

// ============ Styles ============
function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    background: busy ? '#9CA3AF' : 'var(--color-accent-gradient, var(--color-accent-primary))',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? 'wait' : 'pointer',
    marginTop: 4,
    transition: 'filter 150ms',
  };
}

function googleBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--color-surface-card)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: busy ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 150ms, border-color 150ms',
  };
}

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-accent-primary)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

function alertStyle(tone: 'danger' | 'info'): React.CSSProperties {
  const bg = tone === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)';
  const fg = tone === 'danger' ? '#b91c1c' : '#1e40af';
  const border = tone === 'danger' ? '#ef4444' : '#3b82f6';
  return {
    background: bg,
    color: fg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12.5,
    marginBottom: 14,
    lineHeight: 1.5,
  };
}

// Phase 52.5 — Translate Firebase auth error codes sang tiếng Việt rõ ràng
function translateAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code ?? '';
  // Firebase trả message dạng "Firebase: Error (auth/invalid-credential)." — extract code
  const match = /auth\/[a-z-]+/.exec(e?.message ?? '');
  const realCode = code || match?.[0] || '';
  switch (realCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng. Có thể tài khoản chưa đăng ký — bấm "Đăng ký" để tạo mới.';
    case 'auth/invalid-email':
      return 'Email không hợp lệ. Vui lòng kiểm tra lại.';
    case 'auth/email-already-in-use':
      return 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.';
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).';
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.';
    case 'auth/network-request-failed':
      return 'Mất kết nối mạng. Kiểm tra Internet rồi thử lại.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị khóa. Liên hệ admin để được mở.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Đã hủy đăng nhập.';
    case 'auth/popup-blocked':
      return 'Trình duyệt chặn popup. Vui lòng cho phép popup rồi thử lại.';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập này chưa được bật.';
    case 'auth/account-exists-with-different-credential':
      return 'Email đã đăng ký bằng phương thức khác (Google/Email). Hãy thử cách đó.';
    default:
      // Fallback: nếu vẫn là Firebase Error message, lọc bỏ tiền tố "Firebase: "
      if (e?.message?.startsWith('Firebase:')) {
        return 'Lỗi đăng nhập. Vui lòng thử lại hoặc liên hệ admin.';
      }
      return e?.message ?? realCode ?? 'Lỗi không xác định.';
  }
}
