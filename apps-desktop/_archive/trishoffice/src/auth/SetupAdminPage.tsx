/**
 * TrishOffice — Setup Admin (lần đầu mở app, chưa có user nào).
 *
 * Yêu cầu admin tạo account đầu tiên với role 'owner'.
 * Sau khi tạo xong → tự động login.
 */

import { useState } from 'react';
import { useAuth } from './AuthContext';
import { validatePassword, validateUsername } from './password';
import logoUrl from '../assets/logo.png';

export function SetupAdminPage(): JSX.Element {
  const { registerUser, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const uErr = validateUsername(username);
    if (uErr) {
      setError(uErr);
      return;
    }
    if (!displayName.trim()) {
      setError('Vui lòng nhập tên hiển thị');
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      setError(pErr);
      return;
    }
    if (password !== confirm) {
      setError('Password và xác nhận không khớp');
      return;
    }

    setLoading(true);
    const r = await registerUser({
      username,
      password,
      display_name: displayName.trim(),
      role: 'owner',
    });
    if (!r.ok) {
      setError(r.error ?? 'Lỗi tạo account');
      setLoading(false);
      return;
    }

    // Auto login
    await login(username, password);
    setLoading(false);
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
            TrishOffice — Khởi tạo
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--color-text-muted, #6B7280)',
              lineHeight: 1.5,
            }}
          >
            Đây là lần đầu sử dụng. Vui lòng tạo tài khoản{' '}
            <strong>Giám đốc</strong> đầu tiên để quản lý hệ thống.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Username (đăng nhập)">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              placeholder="vd: admin, giamdoc, ho.tri"
              autoFocus
            />
          </Field>

          <Field label="Tên hiển thị">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
              placeholder="vd: Hồ Sỹ Trí"
            />
          </Field>

          <Field label="Password (tối thiểu 6 ký tự, có chữ)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </Field>

          <Field label="Xác nhận password">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? 'Đang tạo...' : '🚀 Tạo tài khoản & vào hệ thống'}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'rgba(16, 185, 129, 0.06)',
            borderRadius: 8,
            fontSize: 11,
            color: '#374151',
            lineHeight: 1.5,
          }}
        >
          <strong>💡 Lưu ý:</strong> Account đầu tiên sẽ có role{' '}
          <strong>Giám đốc (Owner)</strong> — toàn quyền hệ thống. Sau khi vào
          được, bạn có thể tạo thêm account cho nhân viên trong{' '}
          <em>Quản trị → Người dùng</em>.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
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

// ============================================================
// Styles
// ============================================================
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--color-surface-bg, #f4f3f0)',
  fontFamily: 'inherit',
};

const cardStyle: React.CSSProperties = {
  width: 420,
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
