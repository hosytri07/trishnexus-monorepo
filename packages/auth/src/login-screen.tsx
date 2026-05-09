/**
 * LoginScreen — shared login screen cho mọi desktop app TrishTEAM.
 *
 * Email/password + Google OAuth. Sau khi login → AuthProvider auto fire,
 * parent app render UI thật.
 *
 * Usage: import { LoginScreen } from '@trishteam/auth/react';
 *        <LoginScreen appName="TrishLibrary" logoUrl={logoUrl} />
 */

import { useState, useEffect, type FormEvent } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendResetPassword,
  signInWithGoogleRedirect,
} from './sign-in.js';

type Mode = 'signin' | 'signup' | 'forgot';

interface LoginScreenProps {
  appName: string;
  /** Logo URL (PNG/SVG asset) */
  logoUrl?: string;
  /** Subtitle dưới appName, vd "Quản lý font Windows" */
  tagline?: string;
}

export function LoginScreen({
  appName,
  logoUrl,
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
    } catch {
      /* ignore */
    }
  }, [REMEMBER_KEY]);

  function persistEmail(value: string): void {
    try {
      if (remember && value.trim()) {
        localStorage.setItem(REMEMBER_KEY, value.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      /* ignore */
    }
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
        setInfo(`Đã gửi link reset đến ${email}. Kiểm tra email.`);
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.message ?? e.code ?? 'Lỗi không xác định');
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
      const e = err as { message?: string };
      setError(e.message ?? 'Google login fail');
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
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: 'var(--color-surface-bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt={appName}
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                marginBottom: 12,
              }}
            />
          )}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: 'var(--color-text-primary)',
            }}
          >
            {appName}
          </h1>
          {tagline && (
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                marginTop: 6,
              }}
            >
              {tagline}
            </p>
          )}
        </div>

        <h2 style={{ fontSize: 16, marginTop: 0, marginBottom: 16, color: 'var(--color-text-primary)' }}>
          {mode === 'signin'
            ? '🔑 Đăng nhập'
            : mode === 'signup'
              ? '📝 Tạo tài khoản'
              : '✉ Quên mật khẩu'}
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {mode === 'signup' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Tên hiển thị</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                style={inputStyle}
                disabled={busy}
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              style={inputStyle}
              disabled={busy}
              autoFocus
            />
          </div>
          {mode !== 'forgot' && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
                disabled={busy}
              />
            </div>
          )}
          {mode === 'signin' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Ghi nhớ email
            </label>
          )}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6,
                color: '#DC2626',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              ⚠ {error}
            </div>
          )}
          {info && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 6,
                color: '#059669',
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              ✓ {info}
            </div>
          )}
          <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
            {busy
              ? '⏳ Đang xử lý…'
              : mode === 'signin'
                ? 'Đăng nhập'
                : mode === 'signup'
                  ? 'Tạo tài khoản'
                  : 'Gửi link reset'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <>
            <div style={{ textAlign: 'center', margin: '16px 0', color: '#9CA3AF', fontSize: 11 }}>
              hoặc
            </div>
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              disabled={busy}
              style={googleBtnStyle(busy)}
            >
              <span>🔍</span>
              <span>Đăng nhập với Google</span>
            </button>
          </>
        )}

        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => setMode('signup')} style={linkBtnStyle}>
                Tạo tài khoản mới
              </button>
              <button type="button" onClick={() => setMode('forgot')} style={linkBtnStyle}>
                Quên mật khẩu?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" onClick={() => setMode('signin')} style={linkBtnStyle}>
              ← Đã có tài khoản? Đăng nhập
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => setMode('signin')} style={linkBtnStyle}>
              ← Quay lại đăng nhập
            </button>
          )}
        </div>

        <p
          style={{
            marginTop: 24,
            fontSize: 11,
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          ⚠ Tài khoản mới mặc định ở chế độ{' '}
          <strong>Trial (chưa kích hoạt)</strong>. Liên hệ admin để được upgrade
          sang Demo (dùng thử có hạn) hoặc User (chính thức).
          <br />
          📩 Admin: <strong>hosytri77@gmail.com</strong>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: 'var(--color-text-primary)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  background: 'var(--color-surface-bg)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    background: '#10B981',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
    fontFamily: 'inherit',
  };
}

function googleBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 16px',
    background: 'transparent',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: busy ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontFamily: 'inherit',
  };
}

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-accent-primary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  fontFamily: 'inherit',
};
