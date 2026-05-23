/**
 * TrishOffice — Departments Management Page.
 *
 * CRUD phòng ban + quick seed 6 preset gợi ý cho cty XD-GT VN.
 */

import { useState } from 'react';
import { useCollection, formatDate } from '../storage';
import type { DepartmentInfo } from '../auth/types';
import { DEPARTMENT_PRESETS } from '../auth/types';
import type { Employee } from '../types';

export function DepartmentsPage(): JSX.Element {
  const { items, create, update, remove } = useCollection<DepartmentInfo>(
    'departments',
    'dpt',
  );
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DepartmentInfo | null>(null);

  function handleSeedPresets(): void {
    if (items.length > 0) {
      if (
        !confirm(
          `Đã có ${items.length} phòng ban. Vẫn tạo thêm 6 preset? (preset đã trùng tên sẽ bị skip)`,
        )
      ) {
        return;
      }
    }
    const existingCodes = new Set(items.map((d) => d.code));
    let added = 0;
    DEPARTMENT_PRESETS.forEach((p) => {
      if (!existingCodes.has(p.code)) {
        create({
          code: p.code,
          name: p.name,
          description: p.description,
          active: true,
        });
        added++;
      }
    });
    alert(`✅ Đã thêm ${added} phòng ban preset.`);
  }

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(d: DepartmentInfo): void {
    setEditing(d);
    setShowForm(true);
  }

  return (
    <div>
      <div className="app-header">
        <h1>🏛️ Phòng ban</h1>
        <p>Quản lý cơ cấu phòng ban công ty. Mỗi nhân viên thuộc 1 phòng ban.</p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <button type="button" onClick={openCreate} style={primaryBtn}>
          + Thêm phòng ban
        </button>
        <button type="button" onClick={handleSeedPresets} style={secondaryBtn}>
          ⚡ Thêm nhanh 6 phòng ban chuẩn XD-GT
        </button>
      </div>

      {items.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px dashed #D1D5DB',
            borderRadius: 12,
            color: 'var(--color-text-muted, #9CA3AF)',
            fontSize: 13,
          }}
        >
          Chưa có phòng ban nào. Click <strong>"⚡ Thêm nhanh"</strong> để có
          ngay 6 phòng ban chuẩn (Ban GĐ · Thiết kế · Thi công · Kế toán · HR ·
          Hành chính), hoặc tự thêm bằng "+ Thêm phòng ban".
        </div>
      )}

      {items.length > 0 && (
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
                <Th>Mã</Th>
                <Th>Tên phòng ban</Th>
                <Th>Mô tả</Th>
                <Th>Trưởng phòng</Th>
                <Th>Số NV</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày tạo</Th>
                <Th align="right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const manager = employeesCol.items.find((e) => e.id === d.manager_id);
                const memberCount = employeesCol.items.filter(
                  (e) => e.department === d.code || e.department === d.name,
                ).length;
                return (
                  <tr key={d.id} style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}>
                    <Td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          background: 'var(--color-surface-muted, #F3F4F6)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                      >
                        {d.code}
                      </span>
                    </Td>
                    <Td>
                      <strong>{d.name}</strong>
                    </Td>
                    <Td>
                      <span style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
                        {d.description ?? '—'}
                      </span>
                    </Td>
                    <Td>{manager ? manager.full_name : '—'}</Td>
                    <Td>{memberCount}</Td>
                    <Td>
                      {d.active ? (
                        <span style={{ color: 'var(--color-accent-primary, #10B981)', fontWeight: 600 }}>
                          ● Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted, #9CA3AF)' }}>○ Disabled</span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
                        {formatDate(
                          new Date(d.created_at).toISOString().slice(0, 10),
                        )}
                      </span>
                    </Td>
                    <Td align="right">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        style={iconBtn}
                        title="Sửa"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          update(d.id, { active: !d.active } as Partial<DepartmentInfo>)
                        }
                        style={iconBtn}
                        title={d.active ? 'Disable' : 'Enable'}
                      >
                        {d.active ? '🔴' : '🟢'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (memberCount > 0) {
                            alert(
                              `Không thể xóa: phòng "${d.name}" còn ${memberCount} nhân viên. Hãy chuyển NV sang phòng khác trước.`,
                            );
                            return;
                          }
                          if (confirm(`Xóa phòng "${d.name}"?`)) remove(d.id);
                        }}
                        style={iconBtn}
                        title="Xóa"
                      >
                        🗑️
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DeptForm
          editing={editing}
          employees={employeesCol.items}
          onSave={(input) => {
            if (editing) update(editing.id, input);
            else create({ ...input, active: true });
            setShowForm(false);
            setEditing(null);
          }}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Form
// ============================================================
function DeptForm({
  editing,
  employees,
  onSave,
  onClose,
}: {
  editing: DepartmentInfo | null;
  employees: Employee[];
  onSave: (input: {
    code: string;
    name: string;
    description?: string;
    manager_id?: string;
  }) => void;
  onClose: () => void;
}): JSX.Element {
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [managerId, setManagerId] = useState(editing?.manager_id ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError('Mã và tên không được để trống');
      return;
    }
    onSave({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      manager_id: managerId || undefined,
    });
  }

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
          width: 460,
          maxWidth: '92vw',
          background: 'var(--color-surface-card, #fff)',
          borderRadius: 14,
          padding: 24,
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>
          {editing ? `Sửa phòng ban: ${editing.code}` : '+ Thêm phòng ban'}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <Field label="Mã ngắn (vd TK, TC, KT)">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={inputStyle}
              placeholder="TK"
              maxLength={10}
            />
          </Field>
          <Field label="Tên phòng ban">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              placeholder="Phòng Thiết kế"
            />
          </Field>
          <Field label="Mô tả">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              placeholder="Mô tả ngắn về phòng ban"
            />
          </Field>
          <Field label="Trưởng phòng (tùy chọn)">
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Chưa có TP —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employee_code} · {e.full_name} · {e.position}
                </option>
              ))}
            </select>
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
            <button type="submit" style={primaryBtn}>
              💾 {editing ? 'Lưu' : 'Tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
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
