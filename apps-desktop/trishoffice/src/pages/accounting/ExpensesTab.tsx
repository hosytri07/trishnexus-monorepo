/**
 * Phase 38.9 — Tab Chi phí trong Kế toán.
 *
 * CRUD chi phí + tracking VAT đầu vào + payment status. Có thể link với HD
 * để cost analysis từng dự án.
 */

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useCollection, formatVND, formatDate } from '../../storage';
import { usePermission } from '../../auth/usePermission';
import { MoneyInput } from '../../components/MoneyInput';
import type {
  Expense,
  ExpenseCategory,
  ExpensePaymentStatus,
  ContractIncome,
  Employee,
} from '../../types';

const CATEGORY_LABEL: Record<ExpenseCategory, { label: string; emoji: string }> = {
  material: { label: 'Vật tư XD', emoji: '🧱' },
  labor: { label: 'Nhân công thuê', emoji: '👷' },
  equipment: { label: 'Thiết bị', emoji: '🚜' },
  subcontract: { label: 'Thầu phụ', emoji: '🤝' },
  transport: { label: 'Vận chuyển', emoji: '🚚' },
  utility: { label: 'Điện nước', emoji: '⚡' },
  office: { label: 'VPP', emoji: '📎' },
  admin: { label: 'Hành chính', emoji: '📋' },
  travel: { label: 'Công tác phí', emoji: '✈️' },
  tax_fee: { label: 'Thuế phí', emoji: '🧾' },
  other: { label: 'Khác', emoji: '📦' },
};

const STATUS_LABEL: Record<ExpensePaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Chưa TT', color: '#F59E0B' },
  partial: { label: 'TT một phần', color: '#3B82F6' },
  paid: { label: 'Đã TT', color: '#10B981' },
};

export function ExpensesTab(): JSX.Element {
  const { items, create, update, remove } = useCollection<Expense>('expenses', 'exp');
  const contractsCol = useCollection<ContractIncome>('contracts', 'ct');
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const perm = usePermission('accounting');

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | ExpenseCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpensePaymentStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((e) => {
        if (catFilter !== 'all' && e.category !== catFilter) return false;
        if (statusFilter !== 'all' && e.payment_status !== statusFilter) return false;
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          e.expense_code.toLowerCase().includes(q) ||
          (e.vendor_name ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [items, search, catFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = items.reduce((s, e) => s + e.total, 0);
    const paid = items.reduce((s, e) => s + e.paid_amount, 0);
    const pending = total - paid;
    const vatInput = items.reduce((s, e) => s + e.vat_amount, 0);
    return { total, paid, pending, vatInput };
  }, [items]);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Tổng chi phí (gồm VAT)"
          value={formatVND(stats.total)}
          hint={`${items.length} phiếu chi`}
        />
        <Stat label="Đã thanh toán" value={formatVND(stats.paid)} color="#10B981" />
        <Stat label="Còn nợ NCC" value={formatVND(stats.pending)} color="#F59E0B" />
        <Stat
          label="VAT đầu vào (khấu trừ)"
          value={formatVND(stats.vatInput)}
          color="#3B82F6"
          hint="Để khấu trừ với VAT đầu ra"
        />
      </div>

      <div
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
      >
        {perm.can('create') && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            style={btnPrimary}
          >
            <Plus size={14} /> Thêm chi phí
          </button>
        )}
        <input
          placeholder="🔍 Tìm tên / mã / NCC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            background: 'var(--color-surface-card, #fff)',
            color: 'var(--color-text-primary, #111827)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as 'all' | ExpenseCategory)}
          style={selectStyle}
        >
          <option value="all">Tất cả loại</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.emoji} {v.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | ExpensePaymentStatus)
          }
          style={selectStyle}
        >
          <option value="all">Mọi trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
          overflow: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'var(--color-surface-row, #F9FAFB)' }}>
            <tr>
              <Th>Ngày</Th>
              <Th>Mã / Tên</Th>
              <Th>Loại</Th>
              <Th>NCC</Th>
              <Th align="right">Chưa VAT</Th>
              <Th align="right">VAT</Th>
              <Th align="right">Tổng</Th>
              <Th align="right">Đã TT</Th>
              <Th>Trạng thái</Th>
              <Th align="right">Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    padding: 32,
                    textAlign: 'center',
                    color: 'var(--color-text-muted, #9CA3AF)',
                  }}
                >
                  {items.length === 0
                    ? 'Chưa có chi phí nào.'
                    : 'Không khớp bộ lọc.'}
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const cat = CATEGORY_LABEL[e.category];
              const stat = STATUS_LABEL[e.payment_status];
              return (
                <tr
                  key={e.id}
                  style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}
                >
                  <Td>{formatDate(e.date)}</Td>
                  <Td>
                    <code style={{ fontSize: 10 }}>{e.expense_code}</code>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    {e.invoice_number && (
                      <div style={{ fontSize: 10, color: '#3B82F6' }}>
                        HĐ VAT: {e.invoice_number}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {cat.emoji} {cat.label}
                  </Td>
                  <Td>{e.vendor_name ?? '—'}</Td>
                  <Td align="right">{formatVND(e.amount)}</Td>
                  <Td align="right">
                    {e.vat_amount > 0 ? (
                      <span style={{ color: '#3B82F6' }}>
                        {formatVND(e.vat_amount)}
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted, #9CA3AF)' }}>
                          {e.vat_rate}%
                        </div>
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td align="right">
                    <strong>{formatVND(e.total)}</strong>
                  </Td>
                  <Td align="right">{formatVND(e.paid_amount)}</Td>
                  <Td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${stat.color}20`,
                        color: stat.color,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {stat.label}
                    </span>
                  </Td>
                  <Td align="right">
                    {perm.can('edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(e);
                          setShowForm(true);
                        }}
                        style={iconBtn}
                        title="Sửa"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    {perm.can('delete') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Xóa chi phí "${e.title}"?`)) remove(e.id);
                        }}
                        style={{ ...iconBtn, color: '#DC2626' }}
                        title="Xóa"
                      >
                        <Trash2 size={13} />
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
        <ExpenseForm
          editing={editing}
          contracts={contractsCol.items}
          employees={employeesCol.items}
          onSave={(input) => {
            if (editing) update(editing.id, input);
            else create(input);
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
// Expense Form
// ============================================================
function ExpenseForm({
  editing,
  contracts,
  employees,
  onSave,
  onClose,
}: {
  editing: Expense | null;
  contracts: ContractIncome[];
  employees: Employee[];
  onSave: (input: Omit<Expense, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState({
    expense_code: editing?.expense_code ?? '',
    date: editing?.date ?? new Date().toISOString().slice(0, 10),
    category: (editing?.category ?? 'material') as ExpenseCategory,
    title: editing?.title ?? '',
    vendor_name: editing?.vendor_name ?? '',
    vendor_tax_code: editing?.vendor_tax_code ?? '',
    amount: editing?.amount ?? 0,
    vat_rate: editing?.vat_rate ?? 10,
    paid_amount: editing?.paid_amount ?? 0,
    payment_date: editing?.payment_date ?? '',
    invoice_number: editing?.invoice_number ?? '',
    linked_contract_id: editing?.linked_contract_id ?? '',
    paid_to_employee_id: editing?.paid_to_employee_id ?? '',
    notes: editing?.notes ?? '',
  });

  const vat_amount = Math.round(form.amount * (form.vat_rate / 100));
  const total = form.amount + vat_amount;
  const status: ExpensePaymentStatus =
    form.paid_amount <= 0 ? 'pending' : form.paid_amount >= total ? 'paid' : 'partial';

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!form.expense_code.trim() || !form.title.trim()) {
      alert('Vui lòng nhập mã + tên chi phí');
      return;
    }
    onSave({
      expense_code: form.expense_code.trim(),
      date: form.date,
      category: form.category,
      title: form.title.trim(),
      vendor_name: form.vendor_name.trim() || undefined,
      vendor_tax_code: form.vendor_tax_code.trim() || undefined,
      amount: Number(form.amount) || 0,
      vat_rate: Number(form.vat_rate) || 0,
      vat_amount,
      total,
      paid_amount: Number(form.paid_amount) || 0,
      payment_status: status,
      payment_date: form.payment_date || undefined,
      invoice_number: form.invoice_number.trim() || undefined,
      linked_contract_id: form.linked_contract_id || undefined,
      paid_to_employee_id: form.paid_to_employee_id || undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <Modal
      title={editing ? `Sửa chi phí: ${editing.expense_code}` : '+ Thêm chi phí'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <Row2>
          <Field label="Mã phiếu chi *">
            <input
              value={form.expense_code}
              onChange={(e) => setForm({ ...form, expense_code: e.target.value })}
              style={input}
              placeholder="PC-2026-001"
            />
          </Field>
          <Field label="Ngày">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={input}
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Loại">
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as ExpenseCategory })
              }
              style={input}
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.emoji} {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số HĐ VAT (để khấu trừ)">
            <input
              value={form.invoice_number}
              onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              style={input}
              placeholder="0000123"
            />
          </Field>
        </Row2>

        <Field label="Mô tả *">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={input}
            placeholder="vd: Mua xi măng cho công trình A"
          />
        </Field>

        <Row2>
          <Field label="NCC">
            <input
              value={form.vendor_name}
              onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="MST NCC">
            <input
              value={form.vendor_tax_code}
              onChange={(e) =>
                setForm({ ...form, vendor_tax_code: e.target.value })
              }
              style={input}
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Số tiền (chưa VAT) *">
            <MoneyInput
              value={form.amount}
              onChange={(v) => setForm({ ...form, amount: v })}
              max={999_999_999_999}
              style={input}
              placeholder="vd: 5.000.000"
            />
          </Field>
          <Field label="VAT đầu vào (%)">
            <select
              value={form.vat_rate}
              onChange={(e) =>
                setForm({ ...form, vat_rate: Number(e.target.value) || 0 })
              }
              style={input}
            >
              <option value={0}>0%</option>
              <option value={5}>5%</option>
              <option value={8}>8%</option>
              <option value={10}>10%</option>
            </select>
          </Field>
        </Row2>

        <div
          style={{
            padding: 10,
            background: 'var(--color-accent-soft, rgba(16,185,129,0.08))',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 8,
            fontSize: 12,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted, #6B7280)' }}>
              VAT đầu vào
            </div>
            <strong style={{ color: '#3B82F6' }}>{formatVND(vat_amount)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted, #6B7280)' }}>
              Tổng (gồm VAT)
            </div>
            <strong>{formatVND(total)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted, #6B7280)' }}>
              Trạng thái
            </div>
            <strong style={{ color: STATUS_LABEL[status].color }}>
              {STATUS_LABEL[status].label}
            </strong>
          </div>
        </div>

        <Row2>
          <Field label="Đã thanh toán">
            <MoneyInput
              value={form.paid_amount}
              onChange={(v) => setForm({ ...form, paid_amount: v })}
              max={999_999_999_999}
              style={input}
              placeholder="0"
            />
          </Field>
          <Field label="Ngày TT">
            <input
              type="date"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              style={input}
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Liên kết với HD (cost analysis)">
            <select
              value={form.linked_contract_id}
              onChange={(e) =>
                setForm({ ...form, linked_contract_id: e.target.value })
              }
              style={input}
            >
              <option value="">— Không gán —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_code} · {c.title.slice(0, 40)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tạm ứng cho NV (nếu có)">
            <select
              value={form.paid_to_employee_id}
              onChange={(e) =>
                setForm({ ...form, paid_to_employee_id: e.target.value })
              }
              style={input}
            >
              <option value="">— Không —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </Field>
        </Row2>

        <Field label="Ghi chú">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ ...input, minHeight: 50, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Hủy
          </button>
          <button type="submit" style={btnPrimary}>
            💾 {editing ? 'Lưu' : 'Tạo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Shared
// ============================================================
function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--color-surface-card, #fff)',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted, #6B7280)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          marginTop: 4,
          color: color ?? 'var(--color-text-primary, #111827)',
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--color-text-muted, #9CA3AF)',
            marginTop: 2,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

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
          width: 600,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--color-surface-card, #fff)',
          color: 'var(--color-text-primary, #111827)',
          borderRadius: 14,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--color-border-subtle, transparent)',
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

function Row2({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
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
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--color-text-muted, #6B7280)',
          marginBottom: 3,
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
  children?: React.ReactNode;
  align?: 'left' | 'right';
}): JSX.Element {
  return (
    <th
      style={{
        padding: '8px 10px',
        textAlign: align ?? 'left',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--color-text-secondary, #374151)',
        textTransform: 'uppercase',
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
  return <td style={{ padding: '8px 10px', textAlign: align ?? 'left' }}>{children}</td>;
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--color-surface-bg-elevated, #fff)',
  color: 'var(--color-text-primary, #111827)',
  border: '1px solid var(--color-border-default, #D1D5DB)',
  borderRadius: 6,
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--color-border-default, #D1D5DB)',
  background: 'var(--color-surface-card, #fff)',
  color: 'var(--color-text-primary, #111827)',
  borderRadius: 8,
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--color-accent-primary, #10B981)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--color-surface-row, #F3F4F6)',
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
  color: 'var(--color-text-secondary, #374151)',
};

