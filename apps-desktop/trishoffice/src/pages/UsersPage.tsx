/**
 * TrishOffice — Users Management Page (Admin IT + Owner only).
 *
 * CRUD account login: tạo NV mới, gán role + dept + employee_id,
 * reset password, disable/enable.
 */

import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LIST, ROLES } from '../auth/types';
import { validatePassword, validateUsername } from '../auth/password';
import { useCollection, formatDate } from '../storage';
import type { AppUser, DepartmentInfo, Role } from '../auth/types';
import type { Employee } from '../types';

export function UsersPage(): JSX.Element {
  const auth = useAuth();
  const departments = useCollection<DepartmentInfo>('departments', 'dpt');
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const users = auth.listUsers();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);

  const filtered = users.filter(
    (u) =>
      !search.trim() ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(u: AppUser): void {
    setEditing(u);
    setShowForm(true);
  }

  return (
    <div>
      <div className="app-header">
        <h1>🛡️ Quản lý người dùng</h1>
        <p>
          Tạo và phân quyền account login cho nhân viên — chỉ <strong>Admin IT</strong>{' '}
          và <strong>Giám đốc</strong> truy cập được module này.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <input
          placeholder="🔍 Tìm username / tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 280px',
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <button type="button" onClick={openCreate} style={primaryBtn}>
          + Thêm người dùng
        </button>
      </div>

      <div
        style={{
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'var(--color-surface-row, #F9FAFB)' }}>
            <tr>
              <Th>Username</Th>
              <Th>Tên hiển thị</Th>
              <Th>Role</Th>
              <Th>Phòng ban</Th>
              <Th>NV liên kết</Th>
              <Th>Trạng thái</Th>
              <Th>Last login</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: 'var(--color-text-muted, #9CA3AF)',
                    fontSize: 13,
                  }}
                >
                  {users.length === 0
                    ? 'Chưa có user nào. Click "+ Thêm người dùng" để tạo.'
                    : 'Không tìm thấy.'}
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const dept = departments.items.find((d) => d.id === u.department_id);
              const emp = employeesCol.items.find((e) => e.id === u.employee_id);
              const isMe = auth.currentUser?.id === u.id;
              return (
                <tr key={u.id} style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}>
                  <Td>
                    <span style={{ fontWeight: 600 }}>{u.username}</span>
                    {isMe && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          background: '#10B981',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        BẠN
                      </span>
                    )}
                  </Td>
                  <Td>{u.display_name}</Td>
                  <Td>
                    <span style={{ fontSize: 12 }}>
                      {ROLES[u.role].emoji} {ROLES[u.role].label}
                    </span>
                  </Td>
                  <Td>{dept ? `${dept.code} · ${dept.name}` : '—'}</Td>
                  <Td>{emp ? `${emp.employee_code} · ${emp.full_name}` : '—'}</Td>
                  <Td>
                    {u.active ? (
                      <span style={{ color: 'var(--color-accent-primary, #10B981)', fontWeight: 600 }}>● Active</span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted, #9CA3AF)' }}>○ Disabled</span>
                    )}
                  </Td>
                  <Td>
                    <span style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
                      {u.last_login_at ? formatDateTime(u.last_login_at) : '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      style={iconBtn}
                      title="Sửa"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetTarget(u)}
                      style={iconBtn}
                      title="Reset password"
                    >
                      🔑
                    </button>
                    <button
                      type="button"
                      onClick={() => auth.toggleUserActive(u.id)}
                      style={iconBtn}
                      title={u.active ? 'Disable' : 'Enable'}
                    >
                      {u.active ? '🔴' : '🟢'}
                    </button>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa user "${u.username}"? (không undo được)`)) {
                            auth.deleteUser(u.id);
                          }
                        }}
                        style={iconBtn}
                        title="Xóa"
                      >
                        🗑️
                      </button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <UserForm
          editing={editing}
          departments={departments.items}
          employees={employeesCol.items}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// User Form (create / edit)
// ============================================================
function UserForm({
  editing,
  departments,
  employees,
  onClose,
}: {
  editing: AppUser | null;
  departments: DepartmentInfo[];
  employees: Employee[];
  onClose: () => void;
}): JSX.Element {
  const auth = useAuth();
  const [username, setUsername] = useState(editing?.username ?? '');
  const [displayName, setDisplayName] = useState(editing?.display_name ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [role, setRole] = useState<Role>(editing?.role ?? 'staff');
  const [departmentId, setDepartmentId] = useState(editing?.department_id ?? '');
  const [employeeId, setEmployeeId] = useState(editing?.employee_id ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (editing) {
      // Update
      const uErr = validateUsername(username);
      if (uErr) {
        setError(uErr);
        return;
      }
      if (!displayName.trim()) {
        setError('Vui lòng nhập tên hiển thị');
        return;
      }
      auth.updateUser(editing.id, {
        username: username.trim(),
        display_name: displayName.trim(),
        email: email.trim() || undefined,
        role,
        department_id: departmentId || undefined,
        employee_id: employeeId || undefined,
      });
      onClose();
      return;
    }

    // Create
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
    setLoading(true);
    const r = await auth.registerUser({
      username,
      password,
      display_name: displayName.trim(),
      email: email.trim() || undefined,
      role,
      department_id: departmentId || undefined,
      employee_id: employeeId || undefined,
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error ?? 'Lỗi tạo user');
      return;
    }
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa user: ${editing.username}` : '+ Thêm người dùng'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <Field label="Username">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            placeholder="vd: nguyen.an, ho.tri"
            disabled={!!editing}
          />
        </Field>

        <Field label="Tên hiển thị">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={inputStyle}
            placeholder="vd: Nguyễn Văn An"
          />
        </Field>

        <Field label="Email (tùy chọn)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="user@company.vn"
          />
        </Field>

        <Field label="Role / Chức vụ">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={inputStyle}
          >
            {ROLE_LIST.sort((a, b) => b.level - a.level).map((r) => (
              <option key={r.key} value={r.key}>
                {r.emoji} {r.label} — {r.description}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Phòng ban (tùy chọn — bắt buộc cho TP/Phó/NV)">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Không thuộc phòng ban —</option>
            {departments
              .filter((d) => d.active)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Liên kết với hồ sơ Nhân sự (tùy chọn)">
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Không liên kết —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.employee_code} · {emp.full_name} · {emp.position}
              </option>
            ))}
          </select>
        </Field>

        {!editing && (
          <Field label="Password ban đầu">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Tối thiểu 6 ký tự, có chữ"
            />
          </Field>
        )}

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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>
            Hủy
          </button>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Đang lưu...' : editing ? '💾 Lưu thay đổi' : '+ Tạo user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Reset Password Modal
// ============================================================
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: AppUser;
  onClose: () => void;
}): JSX.Element {
  const auth = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    const pErr = validatePassword(newPassword);
    if (pErr) {
      setError(pErr);
      return;
    }
    setLoading(true);
    const r = await auth.resetUserPassword(user.id, newPassword);
    setLoading(false);
    if (!r.ok) {
      setError(r.error ?? 'Reset thất bại');
      return;
    }
    alert(
      `✅ Đã reset password cho "${user.username}".\n\nPassword mới: ${newPassword}\n\nVui lòng thông báo an toàn cho người dùng.`,
    );
    onClose();
  }

  return (
    <Modal title={`🔑 Reset password: ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div
          style={{
            padding: 12,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            fontSize: 12,
            color: '#92400E',
          }}
        >
          ⚠️ Password cũ sẽ bị xóa. Người dùng sẽ phải đổi password lần đăng
          nhập tiếp theo.
        </div>

        <Field label="Password mới">
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
            placeholder="Tối thiểu 6 ký tự, có chữ"
            autoFocus
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={secondaryBtn}>
            Hủy
          </button>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Đang reset...' : '🔑 Reset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Shared sub-components / styles
// ============================================================
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--color-surface-card, #fff)',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--color-text-muted, #6B7280)',
            }}
          >
            ✕
          </button>
        </div>
        {children}
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

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}): JSX.Element {
  return (
    <th
      style={{
        padding: '10px 12px',
        textAlign: align ?? 'left',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-text-secondary, #374151)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}): JSX.Element {
  return (
    <td style={{ padding: '10px 12px', textAlign: align ?? 'left' }}>{children}</td>
  );
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  )} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--color-border-default, #D1D5DB)',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: '#10B981',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--color-surface-muted, #F3F4F6)',
  color: 'var(--color-text-secondary, #374151)',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 6px',
  fontSize: 14,
  borderRadius: 6,
};
