/**
 * Phase 38.6.3 — Module Chấm công (Attendance) — Phase 1 manual.
 *
 * Admin/HR nhập tay giờ vào/ra hàng ngày cho từng nhân viên. Tính tự động số
 * giờ làm. Hỗ trợ phân loại: làm việc / nghỉ phép / nghỉ ốm / công tác / lễ.
 *
 * Lưu localStorage `trishoffice:attendance`. Phase 2+ tích hợp máy chấm công.
 */

import { useMemo, useState } from 'react';
import { Plus, X, Trash2, Calendar } from 'lucide-react';
import { useCollection, formatDate, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import type {
  AttendanceEntry,
  AttendanceType,
  Employee,
} from '../types';

const TYPE_LABEL: Record<
  AttendanceType,
  { label: string; color: string; emoji: string }
> = {
  work: { label: 'Làm việc', color: 'var(--color-accent-primary, #10B981)', emoji: '💼' },
  leave_paid: { label: 'Nghỉ phép', color: '#3B82F6', emoji: '🌴' },
  leave_unpaid: { label: 'Nghỉ KL', color: 'var(--color-text-muted, #9CA3AF)', emoji: '🚫' },
  leave_sick: { label: 'Nghỉ ốm', color: '#F59E0B', emoji: '🤒' },
  business_trip: { label: 'Công tác', color: '#8B5CF6', emoji: '✈️' },
  holiday: { label: 'Nghỉ lễ', color: '#EF4444', emoji: '🎉' },
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tính giờ giữa "HH:MM" và "HH:MM" */
function calcHours(timeIn?: string, timeOut?: string): number {
  if (!timeIn || !timeOut) return 0;
  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return 0;
  let mins = h2! * 60 + m2! - (h1! * 60 + m1!);
  if (mins < 0) mins += 24 * 60; // qua ngày
  // Giả định trừ 1h ăn trưa
  if (mins > 6 * 60) mins -= 60;
  return Math.max(0, mins / 60);
}

export function AttendancePage(): JSX.Element {
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const { items, create, update, remove } = useCollection<AttendanceEntry>(
    'attendance',
    'att',
  );
  const perm = usePermission('attendance');
  const [period, setPeriod] = useState(currentMonth());
  const [employeeFilter, setEmployeeFilter] = useState<'all' | string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AttendanceEntry | null>(null);

  // RBAC scope filter: nếu user là dept_manager → chỉ thấy NV của phòng mình
  // Nếu staff → chỉ thấy của bản thân
  const scopedItems = useMemo(() => {
    return perm.filter(
      items,
      (a) => {
        const emp = employeesCol.items.find((e) => e.id === a.employee_id);
        return emp?.department;
      },
      (a) => a.employee_id,
    );
  }, [items, employeesCol.items, perm]);

  const filtered = useMemo(() => {
    return scopedItems
      .filter((e) => {
        if (!e.date.startsWith(period)) return false;
        if (employeeFilter !== 'all' && e.employee_id !== employeeFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [scopedItems, period, employeeFilter]);

  // Stats per period
  const stats = useMemo(() => {
    const periodEntries = items.filter((e) => e.date.startsWith(period));
    const totalHours = periodEntries.reduce(
      (s, e) => s + e.hours_regular + (e.hours_ot ?? 0),
      0,
    );
    const totalOT = periodEntries.reduce((s, e) => s + (e.hours_ot ?? 0), 0);
    const workDays = periodEntries.filter((e) => e.type === 'work').length;
    const leaveDays = periodEntries.filter((e) =>
      e.type.startsWith('leave_'),
    ).length;
    return { totalHours, totalOT, workDays, leaveDays };
  }, [items, period]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employeesCol.items.forEach((e) => map.set(e.id, e));
    return map;
  }, [employeesCol.items]);

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(entry: AttendanceEntry): void {
    setEditing(entry);
    setShowForm(true);
  }

  function handleDelete(entry: AttendanceEntry): void {
    if (!window.confirm(`Xóa entry ${formatDate(entry.date)}?`)) return;
    remove(entry.id);
  }

  return (
    <div>
      <div className="app-header">
        <h1>📅 Chấm công ({filtered.length})</h1>
        <p>
          Phase 1 manual: HR/admin nhập giờ vào/ra hàng ngày. Tự tính giờ làm
          (-1h nghỉ trưa). Phase 2+ sẽ tích hợp máy chấm công vân tay.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {perm.can('create') && (
          <button
            type="button"
            className="btn-primary"
            onClick={openCreate}
            disabled={employeesCol.items.length === 0}
            title={
              employeesCol.items.length === 0
                ? 'Cần thêm nhân viên trước'
                : 'Thêm entry chấm công'
            }
          >
            <Plus size={14} /> Thêm entry
          </button>
        )}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface-card, #fff)',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            borderRadius: 8,
            padding: '4px 10px',
          }}
        >
          <Calendar size={14} style={{ color: 'var(--color-text-muted, #6B7280)' }} />
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentMonth())}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="input-field"
          style={{ width: 'auto', minWidth: 200 }}
        >
          <option value="all">Tất cả nhân viên</option>
          {employeesCol.items.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.employee_code} — {emp.full_name}
            </option>
          ))}
        </select>
      </div>

      {employeesCol.items.length === 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8,
            fontSize: 13,
            color: '#B45309',
          }}
        >
          ⚠ Chưa có nhân viên. Vào module <strong>👥 Nhân sự</strong> thêm nhân viên trước
          khi chấm công.
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatBox label="Ngày công" value={stats.workDays.toString()} />
        <StatBox label="Ngày nghỉ" value={stats.leaveDays.toString()} />
        <StatBox label="Tổng giờ" value={stats.totalHours.toFixed(1) + 'h'} />
        <StatBox label="Giờ OT" value={stats.totalOT.toFixed(1) + 'h'} highlight />
      </div>

      {/* Table */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={thead}>
            <tr>
              <th style={th}>Ngày</th>
              <th style={th}>Nhân viên</th>
              <th style={th}>Loại</th>
              <th style={th}>Vào — Ra</th>
              <th style={th}>Giờ chính</th>
              <th style={th}>OT</th>
              <th style={th}>Ghi chú</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                  Chưa có entry trong tháng này.
                </td>
              </tr>
            ) : (
              filtered.map((e) => {
                const emp = employeeMap.get(e.employee_id);
                const t = TYPE_LABEL[e.type];
                return (
                  <tr key={e.id} style={tr}>
                    <td style={td}>{formatDate(e.date)}</td>
                    <td style={td}>
                      {emp ? (
                        <>
                          <strong>{emp.full_name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>
                            {emp.employee_code}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: '#DC2626' }}>(NV đã xóa)</span>
                      )}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: `${t.color}20`,
                          color: t.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {t.emoji} {t.label}
                      </span>
                    </td>
                    <td style={td}>
                      {e.time_in && e.time_out ? `${e.time_in} — ${e.time_out}` : '—'}
                    </td>
                    <td style={td}>{e.hours_regular.toFixed(1)}h</td>
                    <td style={td}>
                      {(e.hours_ot ?? 0) > 0 ? (
                        <strong style={{ color: '#F59E0B' }}>
                          {(e.hours_ot ?? 0).toFixed(1)}h
                        </strong>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={td}>{e.notes ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {perm.can('edit') && (
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          style={iconBtn}
                          title="Sửa"
                        >
                          ✏️
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
        <AttendanceFormModal
          initial={editing}
          employees={employeesCol.items}
          onSave={(data) => {
            if (editing) update(editing.id, data);
            else create(data);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

const thead: React.CSSProperties = {
  background: 'var(--color-surface-muted, #F3F4F6)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--color-text-muted, #6B7280)',
};
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
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

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--color-surface-card, #fff)',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted, #9CA3AF)',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          marginTop: 2,
          color: highlight ? '#F59E0B' : 'var(--color-accent-primary, #10B981)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Form
// ============================================================
function AttendanceFormModal({
  initial,
  employees,
  onSave,
  onClose,
}: {
  initial: AttendanceEntry | null;
  employees: Employee[];
  onSave: (data: Omit<AttendanceEntry, 'id' | 'created_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState<Omit<AttendanceEntry, 'id' | 'created_at'>>(
    () =>
      initial
        ? {
            employee_id: initial.employee_id,
            date: initial.date,
            type: initial.type,
            time_in: initial.time_in,
            time_out: initial.time_out,
            hours_regular: initial.hours_regular,
            hours_ot: initial.hours_ot,
            notes: initial.notes,
            created_by: initial.created_by,
          }
        : {
            employee_id: employees[0]?.id ?? '',
            date: today(),
            type: 'work',
            time_in: '08:00',
            time_out: '17:00',
            hours_regular: 8,
            hours_ot: 0,
          },
  );
  const [error, setError] = useState<string | null>(null);
  const [autoCalc, setAutoCalc] = useState(!initial);

  function setTimeIn(v: string): void {
    const next = { ...form, time_in: v };
    if (autoCalc) next.hours_regular = calcHours(v, form.time_out);
    setForm(next);
  }
  function setTimeOut(v: string): void {
    const next = { ...form, time_out: v };
    if (autoCalc) next.hours_regular = calcHours(form.time_in, v);
    setForm(next);
  }

  function handleSubmit(): void {
    if (!form.employee_id) {
      setError('Chọn nhân viên');
      return;
    }
    if (!form.date) {
      setError('Chọn ngày');
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
          maxWidth: 560,
          color: 'var(--color-text-primary, #1F2937)',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial ? '✏️ Sửa entry' : '➕ Thêm entry chấm công'}
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

        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <Field label="Nhân viên *">
            <select
              className="input-field"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
            >
              <option value="">— Chọn —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_code} — {emp.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Ngày *">
              <input
                type="date"
                className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </Field>
            <Field label="Loại *">
              <select
                className="input-field"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as AttendanceType })
                }
              >
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.emoji} {v.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {form.type === 'work' || form.type === 'business_trip' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Giờ vào">
                  <input
                    type="time"
                    className="input-field"
                    value={form.time_in ?? ''}
                    onChange={(e) => setTimeIn(e.target.value)}
                  />
                </Field>
                <Field label="Giờ ra">
                  <input
                    type="time"
                    className="input-field"
                    value={form.time_out ?? ''}
                    onChange={(e) => setTimeOut(e.target.value)}
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Giờ làm chính (auto)">
                  <input
                    type="number"
                    className="input-field"
                    value={form.hours_regular}
                    onChange={(e) => {
                      setAutoCalc(false);
                      setForm({ ...form, hours_regular: Number(e.target.value) || 0 });
                    }}
                    step={0.5}
                    min={0}
                    max={24}
                  />
                </Field>
                <Field label="OT (giờ)">
                  <input
                    type="number"
                    className="input-field"
                    value={form.hours_ot ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, hours_ot: Number(e.target.value) || 0 })
                    }
                    step={0.5}
                    min={0}
                  />
                </Field>
              </div>
              <small style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>
                💡 Mặc định trừ 1h ăn trưa khi tính giờ làm chính. Sửa tay nếu khác.
              </small>
            </>
          ) : (
            <div
              style={{
                padding: 12,
                background: 'rgba(59,130,246,0.08)',
                borderRadius: 8,
                fontSize: 12,
                color: '#1D4ED8',
              }}
            >
              💡 Loại "{TYPE_LABEL[form.type].label}" — không cần giờ vào/ra. Auto
              hours_regular = 0.
            </div>
          )}

          <Field label="Ghi chú">
            <input
              className="input-field"
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="(optional)"
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
            {initial ? 'Cập nhật' : 'Lưu entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
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
