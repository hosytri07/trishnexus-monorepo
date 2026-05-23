/**
 * Phase 38.9 — Tab Hợp đồng (Doanh thu) trong Kế toán.
 *
 * CRUD hợp đồng + tracking payments theo từng đợt (advance / progress / final).
 * Tự tính: đã thu, còn lại, % completion.
 */

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, X, DollarSign } from 'lucide-react';
import { useCollection, formatVND, formatDate, generateId } from '../../storage';
import { usePermission } from '../../auth/usePermission';
import { MoneyInput } from '../../components/MoneyInput';
import type {
  ContractIncome,
  ContractStatus,
  ContractType_Income,
  ContractPayment,
  ContractPaymentType,
  Employee,
} from '../../types';

const TYPE_LABEL: Record<ContractType_Income, { label: string; emoji: string }> = {
  construction: { label: 'Thi công', emoji: '🏗️' },
  consulting: { label: 'Tư vấn / Thiết kế', emoji: '📐' },
  survey: { label: 'Khảo sát', emoji: '🔍' },
  maintenance: { label: 'Bảo trì', emoji: '🔧' },
  supply: { label: 'Cung cấp vật tư', emoji: '📦' },
  other: { label: 'Khác', emoji: '📄' },
};

const STATUS_LABEL: Record<ContractStatus, { label: string; color: string }> = {
  draft: { label: 'Soạn', color: '#9CA3AF' },
  signed: { label: 'Đã ký', color: '#3B82F6' },
  in_progress: { label: 'Đang triển khai', color: '#F59E0B' },
  completed: { label: 'Hoàn thành', color: '#10B981' },
  cancelled: { label: 'Hủy', color: '#EF4444' },
};

const PAYMENT_TYPE_LABEL: Record<ContractPaymentType, string> = {
  advance: 'Tạm ứng',
  progress: 'Theo tiến độ',
  final: 'Quyết toán',
  retention_release: 'Hoàn trả bảo hành',
};

export function ContractsTab(): JSX.Element {
  const { items, create, update, remove } = useCollection<ContractIncome>(
    'contracts',
    'ct',
  );
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const perm = usePermission('accounting');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContractIncome | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ContractIncome | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.contract_code.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let activeCount = 0;
    items.forEach((c) => {
      const totalWithVat = c.contract_value * (1 + c.vat_rate / 100);
      totalValue += totalWithVat;
      const collected = c.payments.reduce(
        (s, p) => s + p.amount + (p.vat_amount ?? 0),
        0,
      );
      totalCollected += collected;
      if (c.status !== 'cancelled' && c.status !== 'completed') {
        totalRemaining += totalWithVat - collected;
        activeCount++;
      }
    });
    return { totalValue, totalCollected, totalRemaining, activeCount };
  }, [items]);

  return (
    <div>
      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Tổng giá trị HD"
          value={formatVND(stats.totalValue)}
          hint={`${items.length} hợp đồng`}
        />
        <Stat
          label="Đã thu"
          value={formatVND(stats.totalCollected)}
          hint={
            stats.totalValue > 0
              ? ((stats.totalCollected / stats.totalValue) * 100).toFixed(1) + '%'
              : '—'
          }
          color="#10B981"
        />
        <Stat
          label="Công nợ còn lại"
          value={formatVND(stats.totalRemaining)}
          hint={`${stats.activeCount} HD đang triển khai`}
          color="#F59E0B"
        />
        <Stat
          label="Hoàn thành"
          value={items.filter((c) => c.status === 'completed').length.toString()}
          hint="HD đã quyết toán"
        />
      </div>

      {/* Action bar */}
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
            <Plus size={14} /> Thêm hợp đồng
          </button>
        )}
        <input
          placeholder="🔍 Tìm tên / mã HD / khách hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 220,
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            background: 'var(--color-surface-card, #fff)',
            color: 'var(--color-text-primary, #111827)',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ContractStatus)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--color-border-default, #D1D5DB)',
            background: 'var(--color-surface-card, #fff)',
            color: 'var(--color-text-primary, #111827)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
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
              <Th>Mã HD</Th>
              <Th>Tên HD / Loại</Th>
              <Th>Khách hàng</Th>
              <Th align="right">Giá trị (gồm VAT)</Th>
              <Th align="right">Đã thu</Th>
              <Th align="right">Còn lại</Th>
              <Th>Trạng thái</Th>
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
                  }}
                >
                  {items.length === 0
                    ? 'Chưa có hợp đồng nào. Bấm "+ Thêm hợp đồng" để bắt đầu.'
                    : 'Không tìm thấy.'}
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const totalWithVat = c.contract_value * (1 + c.vat_rate / 100);
              const collected = c.payments.reduce(
                (s, p) => s + p.amount + (p.vat_amount ?? 0),
                0,
              );
              const remaining = totalWithVat - collected;
              const pct = totalWithVat > 0 ? (collected / totalWithVat) * 100 : 0;
              const stat = STATUS_LABEL[c.status];
              const tlabel = TYPE_LABEL[c.type];
              return (
                <tr
                  key={c.id}
                  style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}
                >
                  <Td>
                    <code style={{ fontSize: 11 }}>{c.contract_code}</code>
                  </Td>
                  <Td>
                    <strong>{c.title}</strong>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted, #6B7280)',
                      }}
                    >
                      {tlabel.emoji} {tlabel.label}
                    </div>
                  </Td>
                  <Td>
                    {c.customer_name}
                    {c.customer_tax_code && (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--color-text-muted, #9CA3AF)',
                        }}
                      >
                        MST: {c.customer_tax_code}
                      </div>
                    )}
                  </Td>
                  <Td align="right">{formatVND(totalWithVat)}</Td>
                  <Td align="right">
                    <span style={{ color: '#10B981', fontWeight: 600 }}>
                      {formatVND(collected)}
                    </span>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--color-text-muted, #9CA3AF)',
                      }}
                    >
                      {pct.toFixed(0)}%
                    </div>
                  </Td>
                  <Td align="right">
                    <span
                      style={{
                        color: remaining > 0 ? '#F59E0B' : '#10B981',
                        fontWeight: 600,
                      }}
                    >
                      {formatVND(remaining)}
                    </span>
                  </Td>
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
                    <button
                      type="button"
                      onClick={() => setPaymentTarget(c)}
                      style={iconBtn}
                      title="Quản lý thanh toán"
                    >
                      <DollarSign size={13} color="#10B981" />
                    </button>
                    {perm.can('edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(c);
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
                          if (confirm(`Xóa hợp đồng "${c.title}"?`)) remove(c.id);
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
        <ContractForm
          editing={editing}
          employees={employeesCol.items}
          onSave={(input) => {
            if (editing) update(editing.id, input);
            else create({ ...input, payments: [] });
            setShowForm(false);
            setEditing(null);
          }}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {paymentTarget && (
        <PaymentsModal
          contract={paymentTarget}
          onUpdate={(payments) => update(paymentTarget.id, { payments })}
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Contract Form
// ============================================================
function ContractForm({
  editing,
  employees,
  onSave,
  onClose,
}: {
  editing: ContractIncome | null;
  employees: Employee[];
  onSave: (input: Omit<ContractIncome, 'id' | 'payments' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [form, setForm] = useState({
    contract_code: editing?.contract_code ?? '',
    title: editing?.title ?? '',
    customer_name: editing?.customer_name ?? '',
    customer_tax_code: editing?.customer_tax_code ?? '',
    customer_address: editing?.customer_address ?? '',
    customer_contact: editing?.customer_contact ?? '',
    type: (editing?.type ?? 'construction') as ContractType_Income,
    contract_value: editing?.contract_value ?? 0,
    vat_rate: editing?.vat_rate ?? 10,
    retention_rate: editing?.retention_rate ?? 5,
    signed_date: editing?.signed_date ?? '',
    start_date: editing?.start_date ?? '',
    end_date: editing?.end_date ?? '',
    completion_date: editing?.completion_date ?? '',
    status: (editing?.status ?? 'draft') as ContractStatus,
    department: editing?.department ?? '',
    manager_id: editing?.manager_id ?? '',
    notes: editing?.notes ?? '',
  });

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!form.contract_code.trim() || !form.title.trim() || !form.customer_name.trim()) {
      alert('Vui lòng nhập mã HD + tên + khách hàng');
      return;
    }
    onSave({
      contract_code: form.contract_code.trim(),
      title: form.title.trim(),
      customer_name: form.customer_name.trim(),
      customer_tax_code: form.customer_tax_code.trim() || undefined,
      customer_address: form.customer_address.trim() || undefined,
      customer_contact: form.customer_contact.trim() || undefined,
      type: form.type,
      contract_value: Number(form.contract_value) || 0,
      vat_rate: Number(form.vat_rate) || 10,
      retention_rate: Number(form.retention_rate) || 0,
      signed_date: form.signed_date || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      completion_date: form.completion_date || undefined,
      status: form.status,
      department: form.department.trim() || undefined,
      manager_id: form.manager_id || undefined,
      notes: form.notes.trim() || undefined,
    });
  }

  const totalWithVat = form.contract_value * (1 + form.vat_rate / 100);

  return (
    <Modal
      title={editing ? `Sửa HD: ${editing.contract_code}` : '+ Thêm hợp đồng'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <Row2>
          <Field label="Mã HD *">
            <input
              value={form.contract_code}
              onChange={(e) => setForm({ ...form, contract_code: e.target.value })}
              style={input}
              placeholder="HD-2026-001"
            />
          </Field>
          <Field label="Trạng thái">
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ContractStatus })
              }
              style={input}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </Row2>

        <Field label="Tên hợp đồng / công trình *">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={input}
            placeholder="vd: Thi công đường Lê Lợi km 0+000 → 1+200"
          />
        </Field>

        <Row2>
          <Field label="Loại HD">
            <select
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as ContractType_Income })
              }
              style={input}
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.emoji} {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="NV phụ trách">
            <select
              value={form.manager_id}
              onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              style={input}
            >
              <option value="">— Chưa gán —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} · {e.position}
                </option>
              ))}
            </select>
          </Field>
        </Row2>

        <Field label="Khách hàng / Chủ đầu tư *">
          <input
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            style={input}
            placeholder="vd: UBND Quận Sơn Trà"
          />
        </Field>

        <Row2>
          <Field label="MST khách hàng">
            <input
              value={form.customer_tax_code}
              onChange={(e) => setForm({ ...form, customer_tax_code: e.target.value })}
              style={input}
              placeholder="0123456789"
            />
          </Field>
          <Field label="Liên hệ">
            <input
              value={form.customer_contact}
              onChange={(e) => setForm({ ...form, customer_contact: e.target.value })}
              style={input}
              placeholder="SĐT / email"
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Giá trị HD chưa VAT (VND) *">
            <MoneyInput
              value={form.contract_value}
              onChange={(v) => setForm({ ...form, contract_value: v })}
              max={999_999_999_999}
              style={input}
              placeholder="vd: 1.000.000.000"
            />
          </Field>
          <Field label="VAT đầu ra (%)">
            <input
              type="number"
              value={form.vat_rate}
              onChange={(e) =>
                setForm({ ...form, vat_rate: Number(e.target.value) || 0 })
              }
              style={input}
            />
          </Field>
        </Row2>

        <div
          style={{
            padding: 10,
            background: 'var(--color-accent-soft, rgba(16,185,129,0.08))',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <strong>Tổng giá trị (gồm VAT):</strong>{' '}
          <span
            style={{
              color: 'var(--color-accent-primary, #10B981)',
              fontWeight: 700,
            }}
          >
            {formatVND(totalWithVat)}
          </span>
          <span
            style={{
              marginLeft: 8,
              color: 'var(--color-text-muted, #6B7280)',
              fontSize: 11,
            }}
          >
            VAT đầu ra: {formatVND(form.contract_value * (form.vat_rate / 100))}
          </span>
        </div>

        <Row2>
          <Field label="Ngày ký HD">
            <input
              type="date"
              value={form.signed_date}
              onChange={(e) => setForm({ ...form, signed_date: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Ngày bắt đầu">
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              style={input}
            />
          </Field>
        </Row2>

        <Row2>
          <Field label="Ngày dự kiến hoàn thành">
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Ngày hoàn thành thực tế">
            <input
              type="date"
              value={form.completion_date}
              onChange={(e) => setForm({ ...form, completion_date: e.target.value })}
              style={input}
            />
          </Field>
        </Row2>

        <Field label="Ghi chú">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ ...input, minHeight: 60, resize: 'vertical' }}
          />
        </Field>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Hủy
          </button>
          <button type="submit" style={btnPrimary}>
            💾 {editing ? 'Lưu' : 'Tạo HD'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// Payments Modal
// ============================================================
function PaymentsModal({
  contract,
  onUpdate,
  onClose,
}: {
  contract: ContractIncome;
  onUpdate: (payments: ContractPayment[]) => void;
  onClose: () => void;
}): JSX.Element {
  const [adding, setAdding] = useState(false);
  const [newP, setNewP] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    vat_amount: 0,
    type: 'progress' as ContractPaymentType,
    receipt_number: '',
    notes: '',
  });

  const totalWithVat = contract.contract_value * (1 + contract.vat_rate / 100);
  const collected = contract.payments.reduce(
    (s, p) => s + p.amount + (p.vat_amount ?? 0),
    0,
  );
  const remaining = totalWithVat - collected;

  function handleAdd(): void {
    if (newP.amount <= 0) {
      alert('Vui lòng nhập số tiền > 0');
      return;
    }
    const payment: ContractPayment = {
      id: generateId('pmt'),
      date: newP.date,
      amount: newP.amount,
      vat_amount: newP.vat_amount || undefined,
      type: newP.type,
      receipt_number: newP.receipt_number.trim() || undefined,
      notes: newP.notes.trim() || undefined,
      created_at: Date.now(),
    };
    onUpdate([...contract.payments, payment]);
    setAdding(false);
    setNewP({
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      vat_amount: 0,
      type: 'progress',
      receipt_number: '',
      notes: '',
    });
  }

  function handleRemove(id: string): void {
    if (!confirm('Xóa khoản thanh toán này?')) return;
    onUpdate(contract.payments.filter((p) => p.id !== id));
  }

  // Auto-fill VAT khi nhập amount (tỷ lệ theo HD)
  function autoFillVat(amount: number): number {
    return Math.round(amount * (contract.vat_rate / 100));
  }

  return (
    <Modal title={`💰 Thanh toán HD: ${contract.contract_code}`} onClose={onClose}>
      {/* Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Stat label="Tổng HD (gồm VAT)" value={formatVND(totalWithVat)} />
        <Stat label="Đã thu" value={formatVND(collected)} color="#10B981" />
        <Stat label="Còn lại" value={formatVND(remaining)} color="#F59E0B" />
      </div>

      {/* Payment list */}
      <div
        style={{
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'var(--color-surface-row, #F9FAFB)' }}>
            <tr>
              <Th>Ngày</Th>
              <Th>Loại</Th>
              <Th align="right">Tiền (chưa VAT)</Th>
              <Th align="right">VAT</Th>
              <Th>Số phiếu</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {contract.payments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'var(--color-text-muted, #9CA3AF)',
                    fontSize: 12,
                  }}
                >
                  Chưa có thanh toán nào.
                </td>
              </tr>
            )}
            {contract.payments
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((p) => (
                <tr
                  key={p.id}
                  style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}
                >
                  <Td>{formatDate(p.date)}</Td>
                  <Td>{PAYMENT_TYPE_LABEL[p.type]}</Td>
                  <Td align="right">{formatVND(p.amount)}</Td>
                  <Td align="right">{p.vat_amount ? formatVND(p.vat_amount) : '—'}</Td>
                  <Td>{p.receipt_number ?? '—'}</Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => handleRemove(p.id)}
                      style={iconBtn}
                      title="Xóa"
                    >
                      <Trash2 size={12} color="#DC2626" />
                    </button>
                  </Td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Add new payment */}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} style={btnPrimary}>
          <Plus size={14} /> Thêm thanh toán
        </button>
      ) : (
        <div
          style={{
            padding: 12,
            background: 'var(--color-surface-row, #F9FAFB)',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 8,
            display: 'grid',
            gap: 8,
          }}
        >
          <Row2>
            <Field label="Ngày">
              <input
                type="date"
                value={newP.date}
                onChange={(e) => setNewP({ ...newP, date: e.target.value })}
                style={input}
              />
            </Field>
            <Field label="Loại">
              <select
                value={newP.type}
                onChange={(e) =>
                  setNewP({ ...newP, type: e.target.value as ContractPaymentType })
                }
                style={input}
              >
                {Object.entries(PAYMENT_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </Row2>
          <Row2>
            <Field label="Số tiền (chưa VAT)">
              <MoneyInput
                value={newP.amount}
                onChange={(v) =>
                  setNewP({ ...newP, amount: v, vat_amount: autoFillVat(v) })
                }
                max={999_999_999_999}
                style={input}
              />
            </Field>
            <Field label="VAT">
              <MoneyInput
                value={newP.vat_amount}
                onChange={(v) => setNewP({ ...newP, vat_amount: v })}
                max={99_999_999_999}
                style={input}
              />
            </Field>
          </Row2>
          <Field label="Số phiếu thu">
            <input
              value={newP.receipt_number}
              onChange={(e) =>
                setNewP({ ...newP, receipt_number: e.target.value })
              }
              style={input}
              placeholder="PT-2026-001"
            />
          </Field>
          <Field label="Ghi chú">
            <input
              value={newP.notes}
              onChange={(e) => setNewP({ ...newP, notes: e.target.value })}
              style={input}
            />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAdding(false)} style={btnSecondary}>
              Hủy
            </button>
            <button type="button" onClick={handleAdd} style={btnPrimary}>
              💾 Lưu
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// Shared bits
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
