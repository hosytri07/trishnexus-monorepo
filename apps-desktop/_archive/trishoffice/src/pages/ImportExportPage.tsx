/**
 * ImportExportPage — Sao lưu / Nhập xuất (Phase 38.21).
 *
 * Export:
 *   - JSON backup (tất cả collections)
 *   - Excel employees
 *   - Excel payroll (period picker)
 *   - Excel contracts
 *   - Excel expenses
 *
 * Import:
 *   - JSON backup (merge last-write-wins)
 *   - Excel employees (bulk create)
 *
 * Chỉ admin_it + owner được access (permission matrix).
 */

import { useState } from 'react';
import { Download, Upload, AlertCircle } from 'lucide-react';
import { useCollection, formatVND, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import * as XLSX from 'xlsx';
import type {
  Employee,
  AttendanceEntry,
  Asset,
  WorkflowRequest,
  CompanyDocument,
  PayrollEntry,
  ContractIncome,
  Expense,
} from '../types';

export function ImportExportPage(): JSX.Element {
  const employees = useCollection<Employee>('employees', 'emp');
  const attendance = useCollection<AttendanceEntry>('attendance', 'att');
  const assets = useCollection<Asset>('assets', 'ast');
  const workflows = useCollection<WorkflowRequest>('workflows', 'wf');
  const documents = useCollection<CompanyDocument>('documents', 'doc');
  const payrolls = useCollection<PayrollEntry>('payroll', 'pay');
  const contracts = useCollection<ContractIncome>('contracts', 'con');
  const expenses = useCollection<Expense>('expenses', 'exp');

  const perm = usePermission('import_export');

  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');

  if (!perm.can('view')) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={20} style={{ color: '#DC2626', flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#991B1B' }}>
            <strong>Không có quyền truy cập.</strong> Chỉ owner + admin IT được phép sao lưu/nhập xuất dữ liệu.
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Export functions
  // ============================================================

  function exportJSON(): void {
    const backup = {
      exported_at: new Date().toISOString(),
      employees: employees.items,
      attendance: attendance.items,
      assets: assets.items,
      workflows: workflows.items,
      documents: documents.items,
      payroll: payrolls.items,
      contracts: contracts.items,
      expenses: expenses.items,
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(
      blob,
      `trishoffice-backup-${new Date().toISOString().slice(0, 16).replace(/[-:]/g, '')}.json`,
    );
  }

  function exportEmployeesExcel(): void {
    const data = employees.items.map((e) => ({
      'Mã NV': e.employee_code,
      'Họ tên': e.full_name,
      'Email': e.email || '',
      'Điện thoại': e.phone || '',
      'Sinh nhật': e.dob || '',
      'Chức vụ': e.position,
      'Phòng ban': e.department,
      'Ngày vào': e.hire_date,
      'Hợp đồng': e.contract_type,
      'Lương cơ bản': e.base_salary,
      'Phụ cấp': e.allowance || 0,
      'BHXH': e.bhxh_code || '',
      'Thuế': e.tax_code || '',
      'Ngân hàng': e.bank_account || '',
      'Trạng thái': e.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhân sự');
    XLSX.writeFile(wb, `trishoffice-employees-${today()}.xlsx`);
  }

  function exportPayrollExcel(): void {
    const periodPayrolls = payrolls.items.filter((p) => p.period === payrollPeriod);
    const data = periodPayrolls.map((p) => {
      const emp = employees.items.find((e) => e.id === p.employee_id);
      return {
        'Mã NV': emp?.employee_code || '',
        'Họ tên': emp?.full_name || '',
        'Lương cơ bản': p.base_salary,
        'Phụ cấp': p.allowance,
        'Ngày công': p.workdays,
        'OT giờ': p.ot_hours,
        'Tiền OT': p.ot_amount,
        'Tổng thu nhập': p.gross_income,
        'BHXH 8%': p.bhxh,
        'BHYT 1.5%': p.bhyt,
        'BHTN 1%': p.bhtn,
        'Thuế TNCN': p.tax_pit,
        'Tổng khấu trừ': p.total_deductions,
        'Lương net': p.net_pay,
        'Trạng thái': p.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bảng lương');
    XLSX.writeFile(wb, `trishoffice-payroll-${payrollPeriod}.xlsx`);
  }

  function exportContractsExcel(): void {
    const data = contracts.items.map((c) => ({
      'Số HĐ': c.contract_code,
      'Tên HĐ': c.title,
      'Khách hàng': c.customer_name,
      'Loại HĐ': c.type,
      'Giá trị': c.contract_value,
      'VAT %': c.vat_rate,
      'Ngày ký': c.signed_date || '',
      'Ngày kết thúc': c.end_date || '',
      'Trạng thái': c.status,
      'Tổng thu': c.payments.reduce((s, p) => s + p.amount, 0),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hợp đồng');
    XLSX.writeFile(wb, `trishoffice-contracts-${today()}.xlsx`);
  }

  function exportExpensesExcel(): void {
    const data = expenses.items.map((e) => ({
      'Mã phiếu': e.expense_code,
      'Ngày': e.date,
      'Danh mục': e.category,
      'Mô tả': e.title,
      'Nhà cung cấp': e.vendor_name || '',
      'Số tiền': e.amount,
      'VAT %': e.vat_rate,
      'VAT đầu vào': e.vat_amount,
      'Tổng': e.total,
      'Đã thanh toán': e.paid_amount,
      'Trạng thái': e.payment_status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chi phí');
    XLSX.writeFile(wb, `trishoffice-expenses-${today()}.xlsx`);
  }

  // ============================================================
  // Import functions
  // ============================================================

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setImportError('');
        const text = evt.target?.result as string;
        const backup = JSON.parse(text);

        let totalAdded = 0;
        let totalUpdated = 0;

        // Merge each collection
        [
          { items: backup.employees, col: employees },
          { items: backup.attendance, col: attendance },
          { items: backup.assets, col: assets },
          { items: backup.workflows, col: workflows },
          { items: backup.documents, col: documents },
          { items: backup.payroll, col: payrolls },
          { items: backup.contracts, col: contracts },
          { items: backup.expenses, col: expenses },
        ].forEach(({ items, col }) => {
          if (!Array.isArray(items)) return;
          items.forEach((item) => {
            const existing = col.items.find((i) => i.id === item.id);
            if (existing) {
              if ((item.updated_at || 0) > (existing.updated_at || 0)) {
                col.update(item.id, item);
                totalUpdated++;
              }
            } else {
              col.create(item);
              totalAdded++;
            }
          });
        });

        setImportMsg(`✓ Nhập thành công! Thêm ${totalAdded} bản ghi, cập nhật ${totalUpdated} bản ghi.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err) {
        setImportError(`Lỗi: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }

  function handleImportEmployeesExcel(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        setImportError('');
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!confirm(`Nhập ${rows.length} nhân viên từ Excel? (sẽ thêm mới, ko cập nhật)`)) {
          return;
        }

        let count = 0;
        rows.forEach((row) => {
          if (!row['Mã NV'] || !row['Họ tên']) return; // skip invalid rows
          employees.create({
            employee_code: String(row['Mã NV']),
            full_name: String(row['Họ tên']),
            email: row['Email'] || undefined,
            phone: row['Điện thoại'] || undefined,
            dob: row['Sinh nhật'] || undefined,
            position: String(row['Chức vụ'] || 'Chưa cập nhật'),
            department: String(row['Phòng ban'] || 'Chưa cập nhật'),
            hire_date: String(row['Ngày vào'] || today()),
            contract_type: (row['Hợp đồng'] as any) || 'full_time',
            base_salary: Number(row['Lương cơ bản'] || 0),
            allowance: Number(row['Phụ cấp'] || 0),
            bhxh_code: row['BHXH'] || undefined,
            tax_code: row['Thuế'] || undefined,
            bank_account: row['Ngân hàng'] || undefined,
            status: 'active',
          });
          count++;
        });

        setImportMsg(`✓ Nhập thành công! Thêm ${count} nhân viên.`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch (err) {
        setImportError(`Lỗi: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div>
      <div className="app-header">
        <h1>📥 Sao lưu / Nhập xuất</h1>
        <p>Backup & restore JSON · Excel import/export hàng loạt</p>
      </div>

      {/* Messages */}
      {importMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 10,
            fontSize: 13,
            color: '#166534',
          }}
        >
          {importMsg}
        </div>
      )}
      {importError && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            fontSize: 13,
            color: '#991B1B',
          }}
        >
          {importError}
        </div>
      )}

      {/* Export section */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
          📦 Export (Xuất dữ liệu)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <ExportBtn
            label="Export JSON (Backup)"
            hint="Tất cả collections"
            onClick={exportJSON}
            icon="📦"
          />
          <ExportBtn
            label="Export Nhân sự (.xlsx)"
            hint="Danh sách nhân viên"
            onClick={exportEmployeesExcel}
            icon="👥"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>📊 Bảng lương:</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="month"
                value={payrollPeriod}
                onChange={(e) => setPayrollPeriod(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border-subtle, #E5E7EB)',
                  fontSize: 12,
                }}
              />
              <button
                type="button"
                onClick={exportPayrollExcel}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--color-accent-primary, #10B981)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} style={{ display: 'inline', marginRight: 4 }} />
                Export
              </button>
            </div>
          </div>
          <ExportBtn
            label="Export Hợp đồng (.xlsx)"
            hint="Doanh thu"
            onClick={exportContractsExcel}
            icon="📈"
          />
          <ExportBtn
            label="Export Chi phí (.xlsx)"
            hint="Phiếu chi"
            onClick={exportExpensesExcel}
            icon="📉"
          />
        </div>
      </div>

      {/* Import section */}
      <div
        style={{
          padding: 16,
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
          📥 Import (Nhập dữ liệu)
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <ImportBtn
            label="Import JSON Backup"
            hint="Merge dữ liệu (last-write-wins)"
            accept=".json"
            onChange={handleImportJSON}
            icon="📦"
          />
          <ImportBtn
            label="Import Nhân sự (.xlsx)"
            hint="Thêm mới từ Excel"
            accept=".xlsx,.xls"
            onChange={handleImportEmployeesExcel}
            icon="👥"
          />
        </div>
      </div>
    </div>
  );
}

function ExportBtn({
  label,
  hint,
  onClick,
  icon,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  icon: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        background: 'var(--color-surface-row, #F9FAFB)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary, #10B981)';
        e.currentTarget.style.background = 'var(--color-surface-card, #fff)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-subtle, #E5E7EB)';
        e.currentTarget.style.background = 'var(--color-surface-row, #F9FAFB)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <Download size={14} style={{ color: 'var(--color-accent-primary, #10B981)' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>{hint}</div>
    </button>
  );
}

function ImportBtn({
  label,
  hint,
  accept,
  onChange,
  icon,
}: {
  label: string;
  hint: string;
  accept: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: string;
}): JSX.Element {
  return (
    <label
      style={{
        padding: 12,
        borderRadius: 8,
        border: '2px dashed var(--color-border-subtle, #E5E7EB)',
        background: 'var(--color-surface-row, #F9FAFB)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms',
        display: 'block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary, #10B981)';
        e.currentTarget.style.background = 'var(--color-surface-card, #fff)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-subtle, #E5E7EB)';
        e.currentTarget.style.background = 'var(--color-surface-row, #F9FAFB)';
      }}
    >
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <Upload size={14} style={{ color: 'var(--color-accent-primary, #10B981)' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #9CA3AF)' }}>{hint}</div>
    </label>
  );
}

function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
