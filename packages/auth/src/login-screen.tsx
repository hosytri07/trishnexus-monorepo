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

// Phase 44 — AppLogo SVG inline (chữ T + swoosh) — không import từ design-system
// để tránh circular dep (design-system import auth, không ngược lại).
const APP_LOGO_COLORS = {
  work:      '#34D399',
  utilities: '#FBBF24',
  finance:   '#2563EB',
  admin:     '#F87171',
} as const;

// PNG paths — import qua entry chính của design-system (workspace package).
import { APP_LOGO_PNG_URLS as APP_LOGO_PNG_URL } from '@trishteam/design-system';

function AppLogoInline({ appShellId, size = 72 }: { appShellId: keyof typeof APP_LOGO_COLORS; size?: number }): JSX.Element {
  const fg = APP_LOGO_COLORS[appShellId];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: size,
        height: size,
        background: '#0E1A1A',
        borderRadius: Math.round(size * 0.22),
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      }}
      role="img"
    >
      {/* SVG fallback nằm dưới */}
      <svg
        viewBox="0 0 64 64"
        width={Math.round(size * 0.75)}
        height={Math.round(size * 0.75)}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, margin: 'auto' }}
      >
        <path d="M16 14 L48 14 L48 22 L36 22 L36 50 L28 50 L28 22 L16 22 Z" fill={fg} />
        <path
          d="M40 30 Q48 36 54 50"
          stroke={fg}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      {/* PNG đè lên — khi là placeholder 1x1 transparent, SVG hiển thị */}
      <img
        src={APP_LOGO_PNG_URL[appShellId]}
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

interface LoginScreenProps {
  appName: string;
  /** Logo URL (PNG/SVG asset) — legacy, dùng cho 1 app dùng PNG riêng */
  logoUrl?: string;
  /** Phase 44 — appShellId để render <AppLogo /> SVG đồng bộ 4 app. Có ưu tiên cao hơn logoUrl. */
  appShellId?: 'work' | 'utilities' | 'finance' | 'admin';
  /** Subtitle dưới appName, vd "Quản lý font Windows" */
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
          {/* Phase 44: ưu tiên AppLogo SVG đồng bộ 4 app. Fallback PNG logo cũ nếu chỉ có logoUrl. */}
          {appShellId ? (
            <div style={{ marginBottom: 12 }}>
              <AppLogoInline appShellId={appShellId} />
            </div>
          ) : logoUrl && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                background: '#ffffff',
                borderRadius: 14,
                padding: 6,
                marginBottom: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <img
                src={logoUrl}
                alt={appName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            </div>
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
          <strong>Trial (chưa kích hoạt)</strong>. Liên hệ admin để được cấp quyền truy cập ứng dụng.
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: 6,
} as const;

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--color-surface-card)',
  color: 'var(--color-text-primary)',
  outline: 'none',
} as const;

function primaryBtnStyle(busy: boolean) {
  return {
    width: '100%',
    padding: '11px 16px',
    background: busy ? '#9CA3AF' : 'var(--color-accent-gradient, var(--color-accent-primary, #059669))',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? 'wait' : 'pointer',
    marginTop: 8,
  } as const;
}

function googleBtnStyle(busy: boolean) {
  return {
    width: '100%',
    padding: '10px 16px',
    background: 'var(--color-surface-card, #fff)',
    color: 'var(--color-text-primary, #1c1b22)',
    border: '1px solid var(--color-border-default, rgba(0,0,0,0.12))',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: busy ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as const;
}

const linkBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-accent-primary, #059669)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
} as const;
