/**
 * TrishOffice — Settings Page (self).
 *
 * User tự đổi password + xem thông tin profile.
 */

import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/types';
import { validatePassword } from '../auth/password';
import { useCollection } from '../storage';
import type { DepartmentInfo } from '../auth/types';
import type { Employee } from '../types';

export function SettingsPage(): JSX.Element {
  const auth = useAuth();
  const departments = useCollection<DepartmentInfo>('departments', 'dpt');
  const employees = useCollection<Employee>('employees', 'emp');

  const me = auth.currentUser;
  if (!me) return <div>Chưa login</div>;

  const dept = departments.items.find((d) => d.id === me.department_id);
  const emp = employees.items.find((e) => e.id === me.employee_id);
  const roleMeta = ROLES[me.role];

  return (
    <div>
      <div className="app-header">
        <h1>⚙️ Cài đặt cá nhân</h1>
        <p>Thông tin tài khoản + đổi password.</p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        {/* Profile card */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>👤 Thông tin tài khoản</h3>
          <Row label="Username" value={me.username} />
          <Row label="Tên hiển thị" value={me.display_name} />
          <Row label="Email" value={me.email ?? '—'} />
          <Row
            label="Role"
            value={`${roleMeta.emoji} ${roleMeta.label}`}
          />
          <Row
            label="Phòng ban"
            value={dept ? `${dept.code} · ${dept.name}` : '— (không thuộc phòng ban)'}
          />
          <Row
            label="Hồ sơ NV"
            value={
              emp ? `${emp.employee_code} · ${emp.full_name} · ${emp.position}` : '— (không liên kết)'
            }
          />
          <Row
            label="Tạo lúc"
            value={new Date(me.created_at).toLocaleString('vi-VN')}
          />
          <Row
            label="Login lần cuối"
            value={
              me.last_login_at
                ? new Date(me.last_login_at).toLocaleString('vi-VN')
                : '—'
            }
          />
        </div>

        {/* Change password card */}
        <div style={cardStyle}>
          <h3 style={cardTitle}>🔑 Đổi password</h3>
          <ChangePasswordForm />
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(74, 222, 128, 0.25)',
          borderRadius: 10,
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <strong>📋 Quyền của bạn ({roleMeta.label}):</strong>
        <p style={{ margin: '6px 0 0' }}>{roleMeta.description}</p>
      </div>
    </div>
  );
}

// ============================================================
// Change Password Form
// ============================================================
function ChangePasswordForm(): JSX.Element {
  const auth = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword) {
      setError('Vui lòng nhập password cũ');
      return;
    }
    const pErr = validatePassword(newPassword);
    if (pErr) {
      setError(pErr);
      return;
    }
    if (newPassword !== confirm) {
      setError('Password mới và xác nhận không khớp');
      return;
    }

    setLoading(true);
    const r = await auth.changeOwnPassword(oldPassword, newPassword);
    setLoading(false);

    if (!r.ok) {
      setError(r.error ?? 'Đổi password thất bại');
      return;
    }
    setSuccess('✅ Đổi password thành công.');
    setOldPassword('');
    setNewPassword('');
    setConfirm('');
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
      <Field label="Password cũ">
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Password mới">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={inputStyle}
          placeholder="Tối thiểu 6 ký tự, có chữ"
        />
      </Field>
      <Field label="Xác nhận password mới">
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          style={inputStyle}
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
      {success && (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8,
            color: '#047857',
            fontSize: 12,
          }}
        >
          {success}
        </div>
      )}

      <button type="submit" disabled={loading} style={primaryBtn}>
        {loading ? 'Đang đổi...' : '🔑 Đổi password'}
      </button>
    </form>
  );
}

// ============================================================
// Sub-components
// ============================================================
function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--color-border-subtle, #F3F4F6)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--color-text-muted, #6B7280)' }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: 'var(--color-text-primary, #111827)',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
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

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface-card, #fff)',
  border: '1px solid var(--color-border-subtle, #E5E7EB)',
  borderRadius: 12,
  padding: 20,
};

const cardTitle: React.CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-accent-primary, #10B981)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
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
  padding: '10px 14px',
  background: 'var(--color-accent-primary, #10B981)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: 4,
};
