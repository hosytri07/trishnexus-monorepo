/**
 * TrishOffice — Login Page.
 *
 * Hiển thị khi đã có user trong hệ thống nhưng chưa login.
 */

import { useState } from 'react';
import { useAuth as useEcosystemAuth } from '@trishteam/auth/react';
import { useAuth } from './AuthContext';
import logoUrl from '../assets/logo.png';

export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const ecosystem = useEcosystemAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Vui lòng nhập username + password');
      return;
    }
    setLoading(true);
    // Phase 38.13 — Truyền Firebase user hiện tại để auto-link sau lần login đầu
    const linkFirebase = ecosystem.firebaseUser
      ? {
          uid: ecosystem.firebaseUser.uid,
          email: ecosystem.firebaseUser.email,
        }
      : undefined;
    const r = await login(username.trim(), password, linkFirebase);
    setLoading(false);
    if (!r.ok) setError(r.error ?? 'Login thất bại');
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
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
            HRM/ERP-light cho doanh nghiệp · Đăng nhập
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Username">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              placeholder="username"
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
            {loading ? 'Đang đăng nhập...' : '🔓 Đăng nhập'}
          </button>
        </form>

        {ecosystem.firebaseUser && (
          <div
            style={{
              marginTop: 14,
              padding: 10,
              background: 'var(--color-accent-soft, rgba(16,185,129,0.08))',
              border: '1px solid var(--color-border-subtle, rgba(16,185,129,0.25))',
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--color-text-secondary, #4B5563)',
              lineHeight: 1.5,
            }}
          >
            <strong>💡 Đang login TrishTEAM:</strong> {ecosystem.firebaseUser.email}
            <br />
            Đăng nhập 1 lần với tài khoản TrishOffice của bạn — hệ thống sẽ tự
            link với email TrishTEAM. Lần sau mở app sẽ vào thẳng dashboard.
          </div>
        )}

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
          Quên password? Liên hệ Admin IT công ty để reset.
          <br />
          Phiên đăng nhập tự hết hạn sau 12 giờ.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components / Styles (tương tự SetupAdmin)
// ============================================================
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

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--color-surface-bg, #f4f3f0)',
  fontFamily: 'inherit',
};

const cardStyle: React.CSSProperties = {
  width: 380,
  maxWidth: '92vw',
  background: 'var(--color-surface-card, #fff)',
  color: 'var(--color-text-primary, #1f2937)',
  borderRadius: 14,
  padding: 28,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  border: '1px solid var(--color-border-subtle, transparent)',
};

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
