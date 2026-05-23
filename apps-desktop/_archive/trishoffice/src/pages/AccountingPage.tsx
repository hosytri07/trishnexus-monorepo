/**
 * Phase 38.9 — Module Kế toán (Multi-tab).
 *
 * 4 tab:
 *   1. Bảng lương (Payroll) — tính lương + thuế TNCN từ Nhân sự + Chấm công
 *   2. Hợp đồng (Doanh thu) — quản lý HD + tracking thanh toán theo đợt
 *   3. Chi phí — phiếu chi + VAT đầu vào + payment status
 *   4. Thuế — tổng hợp VAT, TNDN, TNCN theo kỳ
 *
 * Tab Payroll giữ lại logic gốc (Phase 38.6.7). 3 tab còn lại mới Phase 38.9.
 */

import { useMemo, useState } from 'react';
import { Calculator, Download, Calendar, CheckCircle2 } from 'lucide-react';
import { useCollection, formatVND, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import { ContractsTab } from './accounting/ContractsTab';
import { ExpensesTab } from './accounting/ExpensesTab';
import { TaxTab } from './accounting/TaxTab';
import type {
  Employee,
  AttendanceEntry,
  PayrollEntry,
} from '../types';

type AccTab = 'payroll' | 'contracts' | 'expenses' | 'tax';

const ACC_TABS: Array<{ key: AccTab; label: string; emoji: string; desc: string }> = [
  { key: 'payroll', label: 'Bảng lương', emoji: '💵', desc: 'Lương NV + thuế TNCN + BHXH' },
  { key: 'contracts', label: 'Hợp đồng', emoji: '📈', desc: 'Doanh thu + tracking thanh toán' },
  { key: 'expenses', label: 'Chi phí', emoji: '📉', desc: 'Phiếu chi + VAT đầu vào' },
  { key: 'tax', label: 'Thuế', emoji: '🧾', desc: 'VAT · TNDN · TNCN tổng hợp' },
];

export function AccountingPage(): JSX.Element {
  const [tab, setTab] = useState<AccTab>('payroll');

  return (
    <div>
      <div className="app-header">
        <h1>💵 Kế toán</h1>
        <p>
          Bảng lương · Doanh thu hợp đồng · Chi phí · Thuế (VAT + TNDN + TNCN). Tổng
          hợp tự động cho doanh nghiệp XD-GT.
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          padding: 4,
          background: 'var(--color-surface-row, #F3F4F6)',
          borderRadius: 10,
          flexWrap: 'wrap',
        }}
      >
        {ACC_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            title={t.desc}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background:
                tab === t.key
                  ? 'var(--color-surface-card, #fff)'
                  : 'transparent',
              color:
                tab === t.key
                  ? 'var(--color-accent-primary, #10B981)'
                  : 'var(--color-text-secondary, #4B5563)',
              boxShadow:
                tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 150ms ease-out',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'payroll' && <PayrollTab />}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'tax' && <TaxTab />}
    </div>
  );
}

const PERSONAL_DEDUCTION = 11_000_000; // 11tr giảm trừ bản thân
const DEPENDENT_DEDUCTION = 4_400_000; // 4.4tr/người phụ thuộc

/** Tính thuế TNCN lũy tiến 7 bậc 2026 VN */
function calcTaxPIT(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  const brackets = [
    { limit: 5_000_000, rate: 0.05 },
    { limit: 10_000_000, rate: 0.10 },
    { limit: 18_000_000, rate: 0.15 },
    { limit: 32_000_000, rate: 0.20 },
    { limit: 52_000_000, rate: 0.25 },
    { limit: 80_000_000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
  ];
  let prev = 0;
  for (const b of brackets) {
    if (taxableIncome <= prev) break;
    const taxedAmount = Math.min(taxableIncome, b.limit) - prev;
    tax += taxedAmount * b.rate;
    prev = b.limit;
  }
  return Math.round(tax);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface ComputedRow {
  employee: Employee;
  workdays: number;
  ot_hours: number;
  base_salary: number;
  allowance: number;
  ot_amount: number;
  gross_income: number;
  bhxh: number;
  bhyt: number;
  bhtn: number;
  taxable_income: number;
  tax_pit: number;
  total_deductions: number;
  net_pay: number;
}

function PayrollTab(): JSX.Element {
  const employeesCol = useCollection<Employee>('employees', 'emp');
  const attendanceCol = useCollection<AttendanceEntry>('attendance', 'att');
  const payrollCol = useCollection<PayrollEntry>('payroll', 'pay');
  const perm = usePermission('accounting');

  const [period, setPeriod] = useState(currentMonth());
  const [workdaysStandard, setWorkdaysStandard] = useState(26);
  const [otRate, setOtRate] = useState(1.5);
  const [dependents, setDependents] = useState<Record<string, number>>({}); // employee_id → count

  const activeEmployees = useMemo(
    () =>
      perm.filter(
        employeesCol.items.filter((e) => e.status === 'active'),
        (e) => e.department,
        (e) => e.id,
      ),
    [employeesCol.items, perm],
  );

  const payrollScopedItems = useMemo(
    () =>
      perm.filter(
        payrollCol.items,
        (p) => {
          const emp = employeesCol.items.find((e) => e.id === p.employee_id);
          return emp?.department;
        },
        (p) => p.employee_id,
      ),
    [payrollCol.items, employeesCol.items, perm],
  );

  /** Compute payroll cho period đã chọn (preview chưa save) */
  const computed = useMemo<ComputedRow[]>(() => {
    const periodAttendance = attendanceCol.items.filter((a) => a.date.startsWith(period));
    return activeEmployees.map((emp) => {
      const empAttendance = periodAttendance.filter((a) => a.employee_id === emp.id);
      const workdays = empAttendance.filter(
        (a) => a.type === 'work' || a.type === 'business_trip',
      ).length;
      const ot_hours = empAttendance.reduce((s, a) => s + (a.hours_ot ?? 0), 0);

      const base_salary = emp.base_salary;
      const allowance = emp.allowance ?? 0;
      const ot_amount = Math.round((base_salary / workdaysStandard / 8) * ot_hours * otRate);
      const workRatio = workdaysStandard > 0 ? workdays / workdaysStandard : 1;
      const gross_income =
        Math.round(base_salary * workRatio) + allowance + ot_amount;

      const bhxh = Math.round(base_salary * 0.08);
      const bhyt = Math.round(base_salary * 0.015);
      const bhtn = Math.round(base_salary * 0.01);

      const dependentCount = dependents[emp.id] ?? 0;
      const taxable_income = Math.max(
        0,
        gross_income - bhxh - bhyt - bhtn - PERSONAL_DEDUCTION - dependentCount * DEPENDENT_DEDUCTION,
      );
      const tax_pit = calcTaxPIT(taxable_income);
      const total_deductions = bhxh + bhyt + bhtn + tax_pit;
      const net_pay = gross_income - total_deductions;

      return {
        employee: emp, workdays, ot_hours, base_salary, allowance, ot_amount,
        gross_income, bhxh, bhyt, bhtn, taxable_income, tax_pit,
        total_deductions, net_pay,
      };
    });
  }, [activeEmployees, attendanceCol.items, period, workdaysStandard, otRate, dependents]);

  /** Đã save chưa cho period này */
  const savedEntries = useMemo(
    () => payrollScopedItems.filter((p) => p.period === period),
    [payrollScopedItems, period],
  );
  const isSaved = savedEntries.length > 0;

  const totals = useMemo(() => {
    return computed.reduce(
      (acc, r) => ({
        gross: acc.gross + r.gross_income,
        bhxh: acc.bhxh + r.bhxh + r.bhyt + r.bhtn,
        tax: acc.tax + r.tax_pit,
        net: acc.net + r.net_pay,
      }),
      { gross: 0, bhxh: 0, tax: 0, net: 0 },
    );
  }, [computed]);

  function handleSave(): void {
    if (computed.length === 0) {
      alert('Không có nhân viên đang làm để tính lương');
      return;
    }
    if (isSaved) {
      if (!window.confirm(`Period ${period} đã có ${savedEntries.length} entries. Ghi đè?`)) {
        return;
      }
      // Xóa entries cũ
      savedEntries.forEach((p) => payrollCol.remove(p.id));
    }
    computed.forEach((r) => {
      payrollCol.create({
        employee_id: r.employee.id,
        period,
        base_salary: r.base_salary,
        allowance: r.allowance,
        workdays: r.workdays,
        workdays_standard: workdaysStandard,
        ot_hours: r.ot_hours,
        ot_rate: otRate,
        ot_amount: r.ot_amount,
        gross_income: r.gross_income,
        bhxh: r.bhxh,
        bhyt: r.bhyt,
        bhtn: r.bhtn,
        tax_pit: r.tax_pit,
        total_deductions: r.total_deductions,
        net_pay: r.net_pay,
        status: 'draft',
      });
    });
    alert(`✓ Đã lưu bảng lương ${computed.length} nhân viên cho ${period}.`);
  }

  function handleExportCSV(): void {
    if (computed.length === 0) return;
    const headers = [
      'Mã NV', 'Họ tên', 'Lương cơ bản', 'Phụ cấp', 'Ngày công', 'OT (h)',
      'Tiền OT', 'Thu nhập gộp', 'BHXH', 'BHYT', 'BHTN', 'Thuế TNCN',
      'Tổng khấu trừ', 'Lương net', 'TK ngân hàng', 'Ngân hàng',
    ];
    const rows = computed.map((r) => [
      r.employee.employee_code,
      r.employee.full_name,
      r.base_salary,
      r.allowance,
      r.workdays,
      r.ot_hours,
      r.ot_amount,
      r.gross_income,
      r.bhxh,
      r.bhyt,
      r.bhtn,
      r.tax_pit,
      r.total_deductions,
      r.net_pay,
      r.employee.bank_account ?? '',
      r.employee.bank_name ?? '',
    ]);
    const csv = '﻿' + [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang-luong-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: 12,
          color: 'var(--color-text-muted, #6B7280)',
          lineHeight: 1.5,
        }}
      >
        Tính lương hàng tháng từ Nhân sự + Chấm công. BHXH 8% + BHYT 1.5% + BHTN 1%.
        Thuế TNCN lũy tiến 7 bậc. Giảm trừ 11tr/tháng + 4.4tr/người phụ thuộc.
      </p>

      {/* Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
          padding: 16,
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 10,
        }}
      >
        <Field label="Kỳ tính lương">
          <input type="month" className="input-field" value={period}
            onChange={(e) => setPeriod(e.target.value || currentMonth())} />
        </Field>
        <Field label="Số ngày công chuẩn">
          <input type="number" className="input-field" value={workdaysStandard}
            onChange={(e) => setWorkdaysStandard(Number(e.target.value) || 26)}
            min={20} max={31} />
        </Field>
        <Field label="Tỷ lệ OT (×)">
          <input type="number" className="input-field" value={otRate}
            onChange={(e) => setOtRate(Number(e.target.value) || 1.5)}
            step={0.1} min={1} max={3} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {perm.can('create') || perm.can('edit') ? (
            <button type="button" className="btn-primary" onClick={handleSave} disabled={computed.length === 0}>
              <CheckCircle2 size={14} /> {isSaved ? 'Lưu lại' : 'Lưu bảng'}
            </button>
          ) : null}
          <button type="button" onClick={handleExportCSV} disabled={computed.length === 0}
            style={{ padding: '8px 14px', border: '1px solid var(--color-border-default, #D1D5DB)', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {activeEmployees.length === 0 && (
        <div
          style={{
            marginBottom: 16, padding: 16,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8, fontSize: 13, color: '#B45309',
          }}
        >
          ⚠ Chưa có nhân viên đang làm. Vào module <strong>👥 Nhân sự</strong> thêm trước.
        </div>
      )}

      {/* Totals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <SumBox label="Tổng thu nhập" value={formatVND(totals.gross)} color="#3B82F6" />
        <SumBox label="Tổng BH (8+1.5+1%)" value={formatVND(totals.bhxh)} color="#F59E0B" />
        <SumBox label="Tổng thuế TNCN" value={formatVND(totals.tax)} color="#DC2626" />
        <SumBox label="Tổng net thực nhận" value={formatVND(totals.net)} color="#10B981" />
      </div>

      {/* Table */}
      <div style={{
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 480px)',
      }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--color-surface-muted, #F3F4F6)', position: 'sticky', top: 0 }}>
            <tr>
              <th style={th}>Mã NV</th>
              <th style={th}>Họ tên</th>
              <th style={th}>Lương CB</th>
              <th style={th}>Phụ cấp</th>
              <th style={th}>Ngày công</th>
              <th style={th}>OT (h)</th>
              <th style={th}>+Tiền OT</th>
              <th style={th}>Người phụ thuộc</th>
              <th style={th}>Gross</th>
              <th style={th}>BHXH 8%</th>
              <th style={th}>BHYT 1.5%</th>
              <th style={th}>BHTN 1%</th>
              <th style={th}>Thuế TNCN</th>
              <th style={th}><strong>Net</strong></th>
            </tr>
          </thead>
          <tbody>
            {computed.length === 0 ? (
              <tr><td colSpan={14} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted, #9CA3AF)' }}>
                <Calculator size={36} style={{ marginBottom: 6, opacity: 0.4 }} />
                <div>Không có nhân viên đang làm việc.</div>
              </td></tr>
            ) : (
              computed.map((r) => (
                <tr key={r.employee.id} style={{ borderTop: '1px solid var(--color-border-subtle, #E5E7EB)' }}>
                  <td style={td}><code>{r.employee.employee_code}</code></td>
                  <td style={td}><strong>{r.employee.full_name}</strong></td>
                  <td style={td}>{formatVND(r.base_salary)}</td>
                  <td style={td}>{formatVND(r.allowance)}</td>
                  <td style={td}>{r.workdays}/{workdaysStandard}</td>
                  <td style={td}>{r.ot_hours.toFixed(1)}</td>
                  <td style={td}>{formatVND(r.ot_amount)}</td>
                  <td style={td}>
                    <input type="number" min={0} max={10}
                      value={dependents[r.employee.id] ?? 0}
                      onChange={(e) => setDependents({ ...dependents, [r.employee.id]: Number(e.target.value) || 0 })}
                      style={{ width: 50, padding: '2px 6px', fontSize: 11, border: '1px solid var(--color-border-default, #D1D5DB)', borderRadius: 4 }}
                    />
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: '#3B82F6' }}>{formatVND(r.gross_income)}</td>
                  <td style={td}>{formatVND(r.bhxh)}</td>
                  <td style={td}>{formatVND(r.bhyt)}</td>
                  <td style={td}>{formatVND(r.bhtn)}</td>
                  <td style={td}>{formatVND(r.tax_pit)}</td>
                  <td style={{ ...td, fontWeight: 700, color: 'var(--color-accent-primary, #10B981)', background: 'rgba(16,185,129,0.06)' }}>
                    {formatVND(r.net_pay)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 12, padding: 12,
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8, fontSize: 11, lineHeight: 1.65,
        }}
      >
        <strong>📐 Công thức tính (TNCN VN 2026):</strong>
        <div>• <strong>Gross</strong> = Lương CB × (Ngày công / Ngày chuẩn) + Phụ cấp + Tiền OT</div>
        <div>• <strong>Tiền OT</strong> = Lương CB / Ngày chuẩn / 8h × Số giờ OT × Tỷ lệ OT (default 1.5x)</div>
        <div>• <strong>BHXH</strong> = LCB × 8% · <strong>BHYT</strong> = LCB × 1.5% · <strong>BHTN</strong> = LCB × 1%</div>
        <div>• <strong>Thu nhập chịu thuế</strong> = Gross - BHXH - BHYT - BHTN - 11tr (bản thân) - 4.4tr × số người phụ thuộc</div>
        <div>• <strong>Thuế TNCN</strong>: lũy tiến 7 bậc 5%/10%/15%/20%/25%/30%/35%</div>
        <div>• <strong>Net</strong> = Gross - BHXH - BHYT - BHTN - Thuế TNCN</div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '8px 8px', textAlign: 'left', fontWeight: 700, fontSize: 10,
  color: 'var(--color-text-muted, #6B7280)', textTransform: 'uppercase',
};
const td: React.CSSProperties = { padding: '8px 8px', verticalAlign: 'middle' };

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

function SumBox({ label, value, color }: { label: string; value: string; color: string }): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--color-surface-card, #fff)',
        border: `1px solid ${color}40`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--color-text-muted, #9CA3AF)', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color }}>{value}</div>
    </div>
  );
}
