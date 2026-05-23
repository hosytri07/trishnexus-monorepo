/**
 * TrishOffice — Firebase Login Page (Phase 38.16).
 *
 * Hiển thị khi Firebase user chưa login. Cho phép Trí (admin) hoặc NV
 * đăng nhập trực tiếp bằng email/password Firebase.
 *
 * Sau khi login thành công, profile được load → useAuth() từ ecosystem
 * sẽ trả về firebaseUser + isAdmin/role chính xác → App.tsx flow tiếp tục.
 */

import { useState } from 'react';
import { signInWithEmail } from '@trishteam/auth';
import logoUrl from '../assets/logo.png';

export function FirebaseLoginPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email + password');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // Sau khi login thành công, subscribeAuthState sẽ trigger re-render
      // App.tsx → ecosystem.firebaseUser non-null → flow tiếp tục
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Friendly Vietnamese error messages
      if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        setError('Email hoặc password không đúng');
      } else if (msg.includes('wrong-password')) {
        setError('Sai password');
      } else if (msg.includes('too-many-requests')) {
        setError('Quá nhiều lần thử — vui lòng đợi vài phút');
      } else if (msg.includes('network')) {
        setError('Không kết nối được mạng — kiểm tra internet');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-surface-bg, #f4f3f0)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: '92vw',
          background: 'var(--color-surface-card, #fff)',
          color: 'var(--color-text-primary, #1f2937)',
          borderRadius: 14,
          padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          border: '1px solid var(--color-border-subtle, transparent)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img
            src={logoUrl}
            alt="TrishOffice"
            style={{ width: 72, height: 72, objectFit: 'contain' }}
          />
          <h1
            style={{
              margin: '8px 0 4px',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--color-accent-primary, #10B981)',
            }}
          >
            TrishOffice
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--color-text-muted, #6B7280)',
            }}
          >
            Đăng nhập tài khoản TrishTEAM hệ sinh thái
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Email TrishTEAM">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="hosytri@trishteam.io.vn"
              autoFocus
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#DC2626',
                fontSize: 12,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Đang đăng nhập...' : '🔓 Đăng nhập TrishTEAM'}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
            fontSize: 11,
            color: 'var(--color-text-muted, #9CA3AF)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Chỉ admin TrishTEAM hoặc user được cấp quyền TrishOffice mới đăng nhập được.
          <br />
          Liên hệ admin nếu chưa có account.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted, #6B7280)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--color-surface-bg-elevated, #fff)',
  color: 'var(--color-text-primary, #1f2937)',
  border: '1px solid var(--color-border-default, #D1D5DB)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--color-accent-primary, #10B981)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 4,
};
