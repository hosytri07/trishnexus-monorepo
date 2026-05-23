/**
 * Phase 38.6.5 — Module Quy trình duyệt (Workflows).
 *
 * Yêu cầu mua sắm / xin phép / công tác phí / tạm ứng / OT.
 * Workflow đơn giản: tạo request → admin/manager bấm Approve/Reject từng step.
 * Lưu localStorage `trishoffice:workflows`.
 */

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useCollection, formatVND, formatDate, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import type {
  WorkflowRequest,
  WorkflowType,
  WorkflowStatus,
  WorkflowApprovalStep,
  Employee,
} from '../types';

const TYPE_LABEL: Record<WorkflowType, { label: string; emoji: string }> = {
  purchase: { label: 'Mua sắm', emoji: '🛒' },
  leave: { label: 'Xin nghỉ', emoji: '🌴' },
  business_trip: { label: 'Công tác', emoji: '✈️' },
  advance: { label: 'Tạm ứng', emoji: '💵' },
  expense: { label: 'Hoàn ứng', emoji: '🧾' },
  overtime: { label: 'OT', emoji: '⏰' },
  other: { label: 'Khác', emoji: '📋' },
};

const STATUS_LABEL: Record<WorkflowStatus, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'var(--color-text-muted, #9CA3AF)' },
  pending: { label: 'Chờ duyệt', color: '#F59E0B' },
  approved: { label: 'Đã duyệt', color: 'var(--color-accent-primary, #10B981)' },
  rejected: { label: 'Từ chối', color: '#DC2626' },
  cancelled: { label: 'Hủy', color: 'var(--color-text-muted, #6B7280)' },
};

function nextRequestCode(items: WorkflowRequest[], type: WorkflowType): string {
  const prefix = {
    purchase: 'YCMS', leave: 'XNP', business_trip: 'CT',
    advance: 'TU', expense: 'HU', overtime: 'OT', other: 'YC',
  }[type];
  const existing = items.filter((r) => r.request_code.startsWith(prefix));
  const num = existing.length + 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export function WorkflowsPage(): JSX.Element {
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const { items, create, update, remove } = useCollection<WorkflowRequest>(
    'workflows', 'wf',
  );
  const perm = usePermission('workflows');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkflowStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | WorkflowType>('all');
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<WorkflowRequest | null>(null);

  const scopedItems = useMemo(
    () =>
      perm.filter(
        items,
        (w) => {
          const emp = employeesCol.items.find((e) => e.id === w.requester_id);
          return emp?.department;
        },
        (w) => w.requester_id,
      ),
    [items, employeesCol.items, perm],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedItems.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (typeFilter !== 'all' && w.type !== typeFilter) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.request_code.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
      );
    });
  }, [scopedItems, search, statusFilter, typeFilter]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employeesCol.items.forEach((e) => m.set(e.id, e));
    return m;
  }, [employeesCol.items]);

  function handleApproveStep(req: WorkflowRequest, idx: number, status: 'approved' | 'rejected'): void {
    const comment = status === 'rejected' ? window.prompt('Lý do từ chối:', '') : null;
    if (status === 'rejected' && !comment) return;
    const newSteps = [...req.steps];
    newSteps[idx] = { ...newSteps[idx]!, status, comment: comment ?? undefined, decided_at: Date.now() };
    let newStatus: WorkflowStatus = req.status;
    if (status === 'rejected') newStatus = 'rejected';
    else if (newSteps.every((s) => s.status === 'approved')) newStatus = 'approved';
    update(req.id, { steps: newSteps, status: newStatus });
    setViewing({ ...req, steps: newSteps, status: newStatus });
  }

  return (
    <div>
      <div className="app-header">
        <h1>📋 Quy trình duyệt ({items.length})</h1>
        <p>
          Yêu cầu mua sắm / xin nghỉ / công tác / tạm ứng / OT — phê duyệt nhiều cấp.
          Click vào yêu cầu để xem chi tiết + duyệt.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {perm.can('create') && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowForm(true)}
            disabled={employeesCol.items.length === 0}
          >
            <Plus size={14} /> Tạo yêu cầu
          </button>
        )}
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--color-text-muted, #9CA3AF)' }} />
          <input
            type="text"
            placeholder="Search mã / tiêu đề / mô tả…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 32 }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | WorkflowType)}
          className="input-field"
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="all">Tất cả loại</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | WorkflowStatus)}
          className="input-field"
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="all">Tất cả TT</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {employeesCol.items.length === 0 && (
        <div style={warnBox}>
          ⚠ Chưa có nhân viên. Vào module <strong>👥 Nhân sự</strong> thêm trước.
        </div>
      )}

      <div style={tableWrap}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead style={thead}>
            <tr>
              <th style={th}>Mã</th>
              <th style={th}>Loại</th>
              <th style={th}>Tiêu đề</th>
              <th style={th}>Người tạo</th>
              <th style={th}>Số tiền</th>
              <th style={th}>Ngày</th>
              <th style={th}>Tiến trình</th>
              <th style={th}>Trạng thái</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                  Chưa có yêu cầu nào.
                </td>
              </tr>
            ) : (
              filtered.map((w) => {
                const t = TYPE_LABEL[w.type];
                const st = STATUS_LABEL[w.status];
                const requester = employeeMap.get(w.requester_id);
                const approvedSteps = w.steps.filter((s) => s.status === 'approved').length;
                return (
                  <tr key={w.id} style={tr}>
                    <td style={td}><code>{w.request_code}</code></td>
                    <td style={td}>{t.emoji} {t.label}</td>
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => setViewing(w)}
                        style={{
                          background: 'transparent', border: 'none', padding: 0,
                          color: 'var(--color-text-link, #2563EB)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                          fontWeight: 600,
                        }}
                      >
                        {w.title}
                      </button>
                    </td>
                    <td style={td}>{requester?.full_name ?? '—'}</td>
                    <td style={td}>{w.amount ? formatVND(w.amount) : '—'}</td>
                    <td style={td}>
                      {w.start_date && formatDate(w.start_date)}
                      {w.end_date && w.end_date !== w.start_date && ` → ${formatDate(w.end_date)}`}
                    </td>
                    <td style={td}>
                      <strong>{approvedSteps}/{w.steps.length}</strong> bước
                    </td>
                    <td style={td}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: `${st.color}20`, color: st.color, fontSize: 11, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {perm.can('delete') && (
                        <button type="button" onClick={() => {
                          if (window.confirm(`Xóa yêu cầu ${w.request_code}?`)) remove(w.id);
                        }} style={{ ...iconBtn, color: '#DC2626' }}>
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

      {viewing && (
        <WorkflowDetail
          request={viewing}
          employees={employeesCol.items}
          onApprove={(idx, status) => handleApproveStep(viewing, idx, status)}
          onClose={() => setViewing(null)}
          canApprove={perm.can('approve')}
        />
      )}

      {showForm && (
        <WorkflowFormModal
          employees={employeesCol.items}
          existingItems={items}
          onSave={(data) => {
            create(data);
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

const warnBox: React.CSSProperties = {
  marginBottom: 16, padding: 16,
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 8, fontSize: 13, color: '#B45309',
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

// ============================================================
// Detail view + Approval actions
// ============================================================
function WorkflowDetail({
  request, employees, onApprove, onClose, canApprove,
}: {
  request: WorkflowRequest;
  employees: Employee[];
  onApprove: (stepIdx: number, status: 'approved' | 'rejected') => void;
  onClose: () => void;
  canApprove?: boolean;
}): JSX.Element {
  const t = TYPE_LABEL[request.type];
  const st = STATUS_LABEL[request.status];
  const requester = employees.find((e) => e.id === request.requester_id);
  const isFinal = request.status === 'approved' || request.status === 'rejected' || request.status === 'cancelled';

  return (
    <div style={modalBackdrop}>
      <div style={{ ...modalBox, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {t.emoji} {request.title}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted, #6B7280)', marginTop: 2 }}>
              <code>{request.request_code}</code> · {t.label} ·
              <span style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 4, background: `${st.color}20`, color: st.color, fontWeight: 600 }}>
                {st.label}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ padding: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted, #6B7280)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Info label="Người tạo" value={requester?.full_name ?? '—'} />
            <Info label="Ngày tạo" value={new Date(request.created_at).toLocaleDateString('vi-VN')} />
            {request.amount !== undefined && (
              <Info label="Số tiền" value={formatVND(request.amount)} />
            )}
            {request.start_date && (
              <Info label="Ngày bắt đầu" value={formatDate(request.start_date)} />
            )}
            {request.end_date && (
              <Info label="Ngày kết thúc" value={formatDate(request.end_date)} />
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)', textTransform: 'uppercase' }}>
              Mô tả
            </label>
            <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {request.description || '(không có mô tả)'}
            </div>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 8px' }}>
            🔄 Tiến trình duyệt ({request.steps.filter((s) => s.status === 'approved').length}/{request.steps.length})
          </h4>
          {request.steps.map((s, idx) => {
            const approver = s.approver_id ? employees.find((e) => e.id === s.approver_id) : null;
            const stepStatusColor = s.status === 'approved' ? '#10B981' : s.status === 'rejected' ? '#DC2626' : '#F59E0B';
            return (
              <div
                key={idx}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  border: `1px solid ${stepStatusColor}40`,
                  borderRadius: 8,
                  background: `${stepStatusColor}08`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>Bước {idx + 1}</span>
                  <span style={{ flex: 1 }}>
                    {s.approver_role ?? '—'}
                    {approver && <span style={{ color: 'var(--color-text-muted, #9CA3AF)' }}> · {approver.full_name}</span>}
                  </span>
                  {s.status === 'approved' && <CheckCircle2 size={16} style={{ color: 'var(--color-accent-primary, #10B981)' }} />}
                  {s.status === 'rejected' && <XCircle size={16} style={{ color: '#DC2626' }} />}
                  {s.status === 'pending' && <Clock size={16} style={{ color: '#F59E0B' }} />}
                </div>
                {s.comment && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted, #6B7280)', fontStyle: 'italic' }}>
                    "{s.comment}"
                  </div>
                )}
                {s.decided_at && (
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>
                    {new Date(s.decided_at).toLocaleString('vi-VN')}
                  </div>
                )}
                {!isFinal && s.status === 'pending' && canApprove && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => onApprove(idx, 'approved')}
                      style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, background: '#10B981', color: '#fff', cursor: 'pointer' }}
                    >
                      ✓ Duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(idx, 'rejected')}
                      style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, background: '#DC2626', color: '#fff', cursor: 'pointer' }}
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={cancelBtn}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted, #9CA3AF)', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ============================================================
// Form
// ============================================================
function WorkflowFormModal({
  employees, existingItems, onSave, onClose,
}: {
  employees: Employee[];
  existingItems: WorkflowRequest[];
  onSave: (data: Omit<WorkflowRequest, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
}): JSX.Element {
  const [type, setType] = useState<WorkflowType>('purchase');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requesterId, setRequesterId] = useState(employees[0]?.id ?? '');
  const [amount, setAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [approvers, setApprovers] = useState<{ role: string; id: string }[]>([
    { role: 'Trưởng phòng', id: '' },
    { role: 'Giám đốc', id: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  function addStep(): void {
    setApprovers([...approvers, { role: '', id: '' }]);
  }
  function removeStep(idx: number): void {
    setApprovers(approvers.filter((_, i) => i !== idx));
  }
  function setStep(idx: number, patch: Partial<{ role: string; id: string }>): void {
    setApprovers(approvers.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  function handleSubmit(): void {
    if (!title.trim()) return setError('Tiêu đề không được trống');
    if (!requesterId) return setError('Chọn người tạo');
    if (approvers.length === 0) return setError('Cần ít nhất 1 cấp duyệt');

    const steps: WorkflowApprovalStep[] = approvers.map((a, idx) => ({
      step_order: idx + 1,
      approver_role: a.role || undefined,
      approver_id: a.id || undefined,
      status: 'pending',
    }));

    onSave({
      request_code: nextRequestCode(existingItems, type),
      type,
      title: title.trim(),
      description: description.trim(),
      requester_id: requesterId,
      amount: amount > 0 ? amount : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: 'pending',
      steps,
    });
  }

  return (
    <div style={modalBackdrop}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>➕ Tạo yêu cầu duyệt</h3>
          <button type="button" onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="Loại *">
              <select className="input-field" value={type} onChange={(e) => setType(e.target.value as WorkflowType)}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Tiêu đề *">
              <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="vd: Mua 5 laptop Dell cho phòng thiết kế" />
            </Field>
          </div>
          <Field label="Mô tả">
            <textarea className="input-field" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Chi tiết yêu cầu, lý do, danh sách items..." />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Người tạo *">
              <select className="input-field" value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
                <option value="">— Chọn —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.full_name}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền (VND)">
              <input type="number" className="input-field" value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                step={100000} min={0} />
            </Field>
            <Field label="Ngày bắt đầu">
              <input type="date" className="input-field" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Ngày kết thúc">
              <input type="date" className="input-field" value={endDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              Cấp duyệt ({approvers.length})
            </div>
            {approvers.map((a, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)', fontWeight: 700 }}>#{idx + 1}</span>
                <input className="input-field" value={a.role}
                  onChange={(e) => setStep(idx, { role: e.target.value })}
                  placeholder="Vai trò (vd Trưởng phòng)" />
                <select className="input-field" value={a.id}
                  onChange={(e) => setStep(idx, { id: e.target.value })}>
                  <option value="">— Chọn người —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => removeStep(idx)}
                  style={{ padding: 4, border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addStep}
              style={{ padding: '6px 12px', fontSize: 11, border: '1px dashed var(--color-border-default, #D1D5DB)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Thêm cấp duyệt
            </button>
          </div>
        </div>

        {error && (
          <div style={{ margin: '0 20px 12px', padding: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, color: '#DC2626', fontSize: 12 }}>
            ⚠ {error}
          </div>
        )}

        <div style={modalFooter}>
          <button type="button" onClick={onClose} style={cancelBtn}>Hủy</button>
          <button type="button" onClick={handleSubmit} className="btn-primary">Gửi yêu cầu</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted, #6B7280)', marginBottom: 4 }}>
        {label}
      </label>
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
