/**
 * Phase 38.6.4 — Module Tài sản công ty (Assets).
 *
 * CRUD danh sách tài sản: laptop/máy in/xe/văn phòng phẩm.
 * Cấp phát + thu hồi cho nhân viên (assigned_to). Lưu localStorage.
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Laptop } from 'lucide-react';
import { useCollection, formatVND, formatDate } from '../storage';
import { usePermission } from '../auth/usePermission';
import type { Asset, AssetCategory, AssetStatus, Employee } from '../types';

const CATEGORY_LABEL: Record<AssetCategory, { label: string; emoji: string }> = {
  laptop: { label: 'Laptop', emoji: '💻' },
  desktop: { label: 'Desktop', emoji: '🖥' },
  monitor: { label: 'Màn hình', emoji: '🖥' },
  printer: { label: 'Máy in', emoji: '🖨' },
  phone: { label: 'Điện thoại', emoji: '📱' },
  vehicle: { label: 'Xe', emoji: '🚗' },
  furniture: { label: 'Nội thất', emoji: '🪑' },
  tool: { label: 'Dụng cụ', emoji: '🔧' },
  other: { label: 'Khác', emoji: '📦' },
};

const STATUS_LABEL: Record<AssetStatus, { label: string; color: string }> = {
  in_use: { label: 'Đang dùng', color: 'var(--color-accent-primary, #10B981)' },
  available: { label: 'Sẵn sàng', color: '#3B82F6' },
  maintenance: { label: 'Bảo trì', color: '#F59E0B' },
  broken: { label: 'Hỏng', color: '#DC2626' },
  disposed: { label: 'Thanh lý', color: 'var(--color-text-muted, #6B7280)' },
};

export function AssetsPage(): JSX.Element {
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const { items, create, update, remove } = useCollection<Asset>('assets', 'ast');
  const perm = usePermission('assets');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssetStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);

  const scopedItems = useMemo(
    () =>
      perm.filter(
        items,
        (a) => {
          const emp = employeesCol.items.find((e) => e.id === a.assigned_to);
          return emp?.department;
        },
        (a) => a.assigned_to,
      ),
    [items, employeesCol.items, perm],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedItems.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.asset_code.toLowerCase().includes(q) ||
        (a.serial ?? '').toLowerCase().includes(q) ||
        (a.brand ?? '').toLowerCase().includes(q)
      );
    });
  }, [scopedItems, search, statusFilter]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employeesCol.items.forEach((e) => m.set(e.id, e));
    return m;
  }, [employeesCol.items]);

  function openCreate(): void {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(a: Asset): void {
    setEditing(a);
    setShowForm(true);
  }

  function handleDelete(a: Asset): void {
    if (!window.confirm(`Xóa tài sản "${a.name}"?`)) return;
    remove(a.id);
  }

  return (
    <div>
      <div className="app-header">
        <h1>🏢 Tài sản công ty ({scopedItems.length})</h1>
        <p>
          Laptop / máy in / xe / văn phòng phẩm — cấp phát + thu hồi + bảo hành.
          KHÁC TrishISO (thiết bị kỹ thuật cần hiệu chuẩn).
          {perm.scope !== 'all' && (
            <span style={{ color: '#F59E0B', marginLeft: 8 }}>
              ⓘ Bạn chỉ thấy {perm.scope === 'department' ? 'phòng ban của mình' : 'tài sản của bản thân'}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {perm.can('create') && (
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={14} /> Thêm tài sản
          </button>
        )}
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={searchIcon} />
          <input
            type="text"
            placeholder="Search tên / mã / serial / hãng…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | AssetStatus)}
          className="input-field"
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div style={tableWrap}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={thead}>
            <tr>
              <th style={th}>Mã</th>
              <th style={th}>Tên / Loại</th>
              <th style={th}>Serial / Hãng</th>
              <th style={th}>Mua / Bảo hành</th>
              <th style={th}>Giao cho</th>
              <th style={th}>Trạng thái</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                  <Laptop size={36} style={{ marginBottom: 6, opacity: 0.4 }} />
                  <div>Chưa có tài sản. Bấm "Thêm tài sản" để bắt đầu.</div>
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const cat = CATEGORY_LABEL[a.category];
                const st = STATUS_LABEL[a.status];
                const assigned = a.assigned_to ? employeeMap.get(a.assigned_to) : null;
                return (
                  <tr key={a.id} style={tr}>
                    <td style={td}><code>{a.asset_code}</code></td>
                    <td style={td}>
                      <strong>{a.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>
                        {cat.emoji} {cat.label}
                      </div>
                    </td>
                    <td style={td}>
                      {a.serial && <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.serial}</div>}
                      {a.brand && <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)' }}>{a.brand} {a.model ?? ''}</div>}
                    </td>
                    <td style={td}>
                      {a.purchase_date && <div>{formatDate(a.purchase_date)}</div>}
                      {a.warranty_until && (
                        <div style={{ fontSize: 11, color: '#F59E0B' }}>
                          BH đến: {formatDate(a.warranty_until)}
                        </div>
                      )}
                      {a.purchase_price && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)' }}>{formatVND(a.purchase_price)}</div>
                      )}
                    </td>
                    <td style={td}>
                      {assigned ? (
                        <>
                          <strong>{assigned.full_name}</strong>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>{assigned.employee_code}</div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted, #9CA3AF)' }}>—</span>
                      )}
                    </td>
                    <td style={td}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: `${st.color}20`,
                          color: st.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {perm.can('edit') && (
                        <button type="button" onClick={() => openEdit(a)} style={iconBtn}><Edit2 size={13} /></button>
                      )}
                      {perm.can('delete') && (
                        <button type="button" onClick={() => handleDelete(a)} style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={13} /></button>
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
        <AssetFormModal
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

const searchIcon: React.CSSProperties = {
  position: 'absolute', left: 10, top: 11, color: 'var(--color-text-muted, #9CA3AF)', pointerEvents: 'none',
};
const tableWrap: React.CSSProperties = {
  border: '1px solid var(--color-border-subtle, #E5E7EB)',
  borderRadius: 10, overflow: 'hidden',
};
const thead: React.CSSProperties = {
  background: 'var(--color-surface-muted, #F3F4F6)',
  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted, #6B7280)' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
const tr: React.CSSProperties = { borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' };
const iconBtn: React.CSSProperties = {
  padding: 6, border: 'none', background: 'transparent', cursor: 'pointer',
  color: 'var(--color-text-muted, #6B7280)', borderRadius: 4,
};

function AssetFormModal({
  initial, employees, onSave, onClose,
}: {
  initial: Asset | null;
  employees: Employee[];
  onSave: (data: Omit<Asset, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>(() =>
    initial
      ? {
          asset_code: initial.asset_code, name: initial.name, category: initial.category,
          serial: initial.serial, brand: initial.brand, model: initial.model,
          purchase_date: initial.purchase_date, purchase_price: initial.purchase_price,
          warranty_until: initial.warranty_until, assigned_to: initial.assigned_to,
          assigned_at: initial.assigned_at, status: initial.status,
          location: initial.location, notes: initial.notes,
        }
      : { asset_code: '', name: '', category: 'laptop', status: 'available' },
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(): void {
    if (!form.asset_code.trim()) return setError('Mã tài sản không được trống');
    if (!form.name.trim()) return setError('Tên không được trống');
    const data = { ...form };
    // Auto-set assigned_at khi giao mới
    if (data.assigned_to && !data.assigned_at) data.assigned_at = Date.now();
    if (!data.assigned_to) data.assigned_at = undefined;
    // Auto status: in_use khi có assigned_to, available khi không
    if (data.assigned_to && data.status === 'available') data.status = 'in_use';
    if (!data.assigned_to && data.status === 'in_use') data.status = 'available';
    onSave(data);
  }

  return (
    <div style={modalBackdrop}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {initial ? '✏️ Sửa tài sản' : '➕ Thêm tài sản'}
          </h3>
          <button type="button" onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, overflowY: 'auto' }}>
          <Field label="Mã tài sản *">
            <input className="input-field" value={form.asset_code}
              onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
              placeholder="vd: TS001" />
          </Field>
          <Field label="Loại *">
            <select className="input-field" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as AssetCategory })}>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Tên *" full>
            <input className="input-field" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dell Latitude 5530" />
          </Field>
          <Field label="Hãng">
            <input className="input-field" value={form.brand ?? ''}
              onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Model / cấu hình">
            <input className="input-field" value={form.model ?? ''}
              onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </Field>
          <Field label="Serial / VIN / IMEI">
            <input className="input-field" value={form.serial ?? ''}
              onChange={(e) => setForm({ ...form, serial: e.target.value })} />
          </Field>
          <Field label="Vị trí đặt">
            <input className="input-field" value={form.location ?? ''}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Phòng kế toán / Kho" />
          </Field>
          <Field label="Ngày mua">
            <input type="date" className="input-field" value={form.purchase_date ?? ''}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </Field>
          <Field label="Hết bảo hành">
            <input type="date" className="input-field" value={form.warranty_until ?? ''}
              onChange={(e) => setForm({ ...form, warranty_until: e.target.value })} />
          </Field>
          <Field label="Giá mua (VND)">
            <input type="number" className="input-field" value={form.purchase_price ?? 0}
              onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) || 0 })}
              step={1000000} min={0} />
          </Field>
          <Field label="Giao cho">
            <select className="input-field" value={form.assigned_to ?? ''}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value || undefined })}>
              <option value="">— Trong kho —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select className="input-field" value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as AssetStatus })}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Ghi chú" full>
            <textarea className="input-field" value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        </div>
        {error && (
          <div style={{ margin: '0 20px 12px', padding: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#DC2626', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}
        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={cancelBtn}>Hủy</button>
          <button type="button" onClick={handleSubmit} className="btn-primary">
            {initial ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }): JSX.Element {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalBox: React.CSSProperties = {
  background: 'var(--color-surface-card, #fff)', borderRadius: 12,
  width: '100%', maxWidth: 720, maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  color: 'var(--color-text-primary, #1F2937)',
};
const modalHead: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const modalFooter: React.CSSProperties = {
  padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const closeBtn: React.CSSProperties = {
  padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted, #6B7280)',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid var(--color-border-default, #D1D5DB)',
  borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
