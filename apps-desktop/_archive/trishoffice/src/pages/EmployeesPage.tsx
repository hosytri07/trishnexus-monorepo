/**
 * Phase 38.6.2 — Module Nhân sự (Employees).
 *
 * CRUD danh sách nhân viên. Lưu localStorage `trishoffice:employees`.
 *
 * Fields chính: mã NV, họ tên, chức vụ, phòng ban, ngày vào, lương cơ bản,
 * BHXH, tài khoản ngân hàng, trạng thái.
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { useCollection, formatVND, formatDate, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import { MoneyInput } from '../components/MoneyInput';
import type {
  Employee,
  EmployeeStatus,
  ContractType,
  Gender,
} from '../types';

const STATUS_LABEL: Record<EmployeeStatus, { label: string; color: string }> = {
  active: { label: 'Đang làm', color: 'var(--color-accent-primary, #10B981)' },
  on_leave: { label: 'Nghỉ phép', color: '#F59E0B' },
  terminated: { label: 'Đã nghỉ', color: 'var(--color-text-muted, #6B7280)' },
};

const CONTRACT_LABEL: Record<ContractType, string> = {
  full_time: 'Toàn thời gian',
  part_time: 'Bán thời gian',
  contract: 'Hợp đồng',
  intern: 'Thực tập',
};

const GENDER_LABEL: Record<Gender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

export function EmployeesPage(): JSX.Element {
  const { items, create, update, remove } = useCollection<Employee>(
    'employees',
    'emp',
  );
  const perm = usePermission('employees');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EmployeeStatus>('all');
  const [editing, setEditing] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Apply RBAC scope filter trước khi search/status filter
  const scopedItems = useMemo(
    () =>
      perm.filter(
        items,
        (e) => e.department,
        (e) => e.id,
      ),
    [items, perm],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedItems.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        (e.email ?? '').toLowerCase().includes(q) ||
        (e.phone ?? '').includes(q)
      );
    });
  }, [scopedItems, search, statusFilter]);

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(emp: Employee): void {
    setEditing(emp);
    setShowForm(true);
  }

  function handleDelete(emp: Employee): void {
    if (!window.confirm(`Xóa nhân viên "${emp.full_name}"?`)) return;
    remove(emp.id);
  }

  return (
    <div>
      <div className="app-header">
        <h1>👥 Nhân sự ({scopedItems.length})</h1>
        <p>
          Quản lý hồ sơ nhân viên: thông tin cá nhân, chức vụ, hợp đồng, lương cơ
          bản, BHXH, tài khoản ngân hàng. Module foundation cho Chấm công + Kế toán.
          {perm.scope !== 'all' && (
            <span style={{ color: '#F59E0B', marginLeft: 8 }}>
              ⓘ Bạn chỉ thấy {perm.scope === 'department' ? 'phòng ban của mình' : 'hồ sơ của bản thân'}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {perm.can('create') && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={14} /> Thêm nhân viên
          </button>
        )}
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: 11,
              color: 'var(--color-text-muted, #9CA3AF)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search tên / mã NV / chức vụ / phòng ban / SĐT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | EmployeeStatus)}
          className="input-field"
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang làm</option>
          <option value="on_leave">Nghỉ phép</option>
          <option value="terminated">Đã nghỉ</option>
        </select>
      </div>

      <div
        style={{
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead
            style={{
              background: 'var(--color-surface-muted, #F3F4F6)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <tr>
              <th style={th}>Mã NV</th>
              <th style={th}>Họ tên</th>
              <th style={th}>Chức vụ / Phòng ban</th>
              <th style={th}>Liên hệ</th>
              <th style={th}>Ngày vào</th>
              <th style={th}>Lương cơ bản</th>
              <th style={th}>Trạng thái</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                  {items.length === 0
                    ? 'Chưa có nhân viên. Bấm "Thêm nhân viên" để bắt đầu.'
                    : 'Không khớp bộ lọc.'}
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const status = STATUS_LABEL[e.status];
                return (
                  <tr key={e.id} style={tr}>
                    <td style={td}>
                      <code>{e.employee_code}</code>
                    </td>
                    <td style={td}>
                      <strong>{e.full_name}</strong>
                      {e.gender && (
                        <span style={{ color: 'var(--color-text-muted, #9CA3AF)', marginLeft: 6, fontSize: 11 }}>
                          ({GENDER_LABEL[e.gender]})
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {e.position}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>{e.department}</div>
                    </td>
                    <td style={td}>
                      {e.phone && <div>{e.phone}</div>}
                      {e.email && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)' }}>{e.email}</div>
                      )}
                    </td>
                    <td style={td}>{formatDate(e.hire_date)}</td>
                    <td style={td}>{formatVND(e.base_salary)}</td>
                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: `${status.color}20`,
                          color: status.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {perm.can('edit') && (
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          style={iconBtn}
                          title="Sửa"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {perm.can('delete') && (
                        <button
                          type="button"
                          onClick={() => handleDelete(e)}
                          style={{ ...iconBtn, color: '#DC2626' }}
                          title="Xóa"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EmployeeFormModal
          initial={editing}
          onSave={(data) => {
            if (editing) {
              update(editing.id, data);
            } else {
              create(data);
            }
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--color-text-muted, #6B7280)',
};
const td: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'top',
};
const tr: React.CSSProperties = {
  borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
};
const iconBtn: React.CSSProperties = {
  padding: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--color-text-muted, #6B7280)',
  borderRadius: 4,
};

// ============================================================
// Form Modal
// ============================================================
function EmployeeFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Employee | null;
  onSave: (data: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>(
    () =>
      initial
        ? {
            employee_code: initial.employee_code,
            full_name: initial.full_name,
            email: initial.email,
            phone: initial.phone,
            dob: initial.dob,
            gender: initial.gender,
            address: initial.address,
            position: initial.position,
            department: initial.department,
            hire_date: initial.hire_date,
            contract_type: initial.contract_type,
            base_salary: initial.base_salary,
            allowance: initial.allowance,
            bhxh_code: initial.bhxh_code,
            tax_code: initial.tax_code,
            bank_account: initial.bank_account,
            bank_name: initial.bank_name,
            status: initial.status,
            notes: initial.notes,
          }
        : {
            employee_code: '',
            full_name: '',
            position: '',
            department: '',
            hire_date: today(),
            contract_type: 'full_time',
            base_salary: 0,
            status: 'active',
          },
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (!form.employee_code.trim()) {
      setError('Mã nhân viên không được trống');
      return;
    }
    if (!form.full_name.trim()) {
      setError('Họ tên không được trống');
      return;
    }
    if (!form.position.trim()) {
      setError('Chức vụ không được trống');
      return;
    }
    if (!form.department.trim()) {
      setError('Phòng ban không được trống');
      return;
    }
    if (form.base_salary <= 0) {
      setError('Lương cơ bản phải > 0');
      return;
    }
    onSave(form);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-card, #fff)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--color-text-primary, #1F2937)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial ? '✏️ Sửa nhân viên' : '➕ Thêm nhân viên'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #6B7280)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          <Field label="Mã nhân viên *">
            <input
              className="input-field"
              value={form.employee_code}
              onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
              placeholder="vd: NV001"
            />
          </Field>
          <Field label="Họ tên *">
            <input
              className="input-field"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Chức vụ *">
            <input
              className="input-field"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="Kỹ sư thiết kế"
            />
          </Field>
          <Field label="Phòng ban *">
            <input
              className="input-field"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Phòng Thiết kế"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input-field"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Số điện thoại">
            <input
              className="input-field"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Ngày sinh">
            <input
              type="date"
              className="input-field"
              value={form.dob ?? ''}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </Field>
          <Field label="Giới tính">
            <select
              className="input-field"
              value={form.gender ?? ''}
              onChange={(e) =>
                setForm({ ...form, gender: (e.target.value || undefined) as Gender | undefined })
              }
            >
              <option value="">— Chọn —</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </Field>
          <Field label="Ngày vào *">
            <input
              type="date"
              className="input-field"
              value={form.hire_date}
              onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            />
          </Field>
          <Field label="Loại HĐ *">
            <select
              className="input-field"
              value={form.contract_type}
              onChange={(e) =>
                setForm({ ...form, contract_type: e.target.value as ContractType })
              }
            >
              <option value="full_time">Toàn thời gian</option>
              <option value="part_time">Bán thời gian</option>
              <option value="contract">Hợp đồng</option>
              <option value="intern">Thực tập</option>
            </select>
          </Field>
          <Field label="Lương cơ bản (VND) *">
            <MoneyInput
              className="input-field"
              value={form.base_salary}
              onChange={(v) => setForm({ ...form, base_salary: v })}
              max={999_999_999_999}
              placeholder="vd: 15.000.000"
            />
          </Field>
          <Field label="Phụ cấp cố định (VND)">
            <MoneyInput
              className="input-field"
              value={form.allowance ?? 0}
              onChange={(v) => setForm({ ...form, allowance: v })}
              max={999_999_999}
              placeholder="vd: 2.000.000"
            />
          </Field>
          <Field label="Mã BHXH">
            <input
              className="input-field"
              value={form.bhxh_code ?? ''}
              onChange={(e) => setForm({ ...form, bhxh_code: e.target.value })}
              placeholder="10 chữ số"
            />
          </Field>
          <Field label="Mã số thuế">
            <input
              className="input-field"
              value={form.tax_code ?? ''}
              onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
            />
          </Field>
          <Field label="Số tài khoản NH">
            <input
              className="input-field"
              value={form.bank_account ?? ''}
              onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
            />
          </Field>
          <Field label="Tên ngân hàng">
            <input
              className="input-field"
              value={form.bank_name ?? ''}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="Vietcombank"
            />
          </Field>
          <Field label="Trạng thái">
            <select
              className="input-field"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as EmployeeStatus })
              }
            >
              <option value="active">Đang làm</option>
              <option value="on_leave">Nghỉ phép</option>
              <option value="terminated">Đã nghỉ</option>
            </select>
          </Field>
          <Field label="Địa chỉ" full>
            <input
              className="input-field"
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
          <Field label="Ghi chú" full>
            <textarea
              className="input-field"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
        </div>

        {error && (
          <div
            style={{
              margin: '0 20px 12px',
              padding: 10,
              background: 'rgba(220,38,38,0.08)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 6,
              color: '#DC2626',
              fontSize: 12,
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border-default, #D1D5DB)',
              borderRadius: 8,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            Hủy
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary">
            {initial ? 'Cập nhật' : 'Lưu nhân viên'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}): JSX.Element {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted, #6B7280)',
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
