/**
 * ReportsPage — Báo cáo + Dashboard nâng cao (Phase 38.22).
 *
 * Sections:
 *   1. Lãi / Lỗ (P&L statement)
 *   2. Dòng tiền (Cash flow)
 *   3. Nhân sự (Payroll breakdown)
 *   4. Hợp đồng (Contract analysis)
 *
 * Uses Recharts for charts. Theme-aware colors.
 * Accountant + HR + Owner + Vice Director can access.
 */

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCollection, formatVND, today } from '../storage';
import { usePermission } from '../auth/usePermission';
import type {
  Employee,
  PayrollEntry,
  ContractIncome,
  Expense,
} from '../types';

export function ReportsPage(): JSX.Element {
  const employees = useCollection<Employee>('employees', 'emp');
  const payrolls = useCollection<PayrollEntry>('payroll', 'pay');
  const contracts = useCollection<ContractIncome>('contracts', 'con');
  const expenses = useCollection<Expense>('expenses', 'exp');

  const perm = usePermission('reports');
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Get last 6 months of data
  const last6Months = useMemo(() => {
    const months: string[] = [];
    const d = new Date(period);
    for (let i = 0; i < 6; i++) {
      months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return months;
  }, [period]);

  // ============================================================
  // P&L Statement
  // ============================================================
  const plData = useMemo(() => {
    const currentPayrolls = payrolls.items.filter((p) => p.period === period);
    const currentContracts = contracts.items.filter(
      (c) => c.signed_date && c.signed_date.startsWith(period),
    );
    const currentExpenses = expenses.items.filter((e) => e.date.startsWith(period));

    const revenue = currentContracts.reduce((s, c) => s + c.contract_value, 0);
    const costOfRevenue = currentExpenses
      .filter((e) => ['material', 'labor', 'equipment', 'subcontract'].includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const otherExpenses = currentExpenses
      .filter((e) => !['material', 'labor', 'equipment', 'subcontract'].includes(e.category))
      .reduce((s, e) => s + e.amount, 0);
    const payrollCost = currentPayrolls.reduce((s, p) => s + p.gross_income, 0);

    const ebit = revenue - costOfRevenue - otherExpenses - payrollCost;
    const corporateTax = ebit > 0 ? ebit * 0.2 : 0; // 20% TNDN
    const netProfit = ebit - corporateTax;

    return {
      revenue,
      costOfRevenue,
      otherExpenses,
      payrollCost,
      ebit,
      corporateTax,
      netProfit,
    };
  }, [period, payrolls.items, contracts.items, expenses.items]);

  // ============================================================
  // Cash flow (last 6 months)
  // ============================================================
  const cashFlowData = useMemo(() => {
    let cumulative = 0;
    return last6Months.map((month) => {
      const monthContracts = contracts.items.filter((c) =>
        c.payments.some((p) => p.date.startsWith(month)),
      );
      const monthPayments = monthContracts.reduce(
        (s, c) => s + c.payments.filter((p) => p.date.startsWith(month)).reduce((ss, p) => ss + p.amount, 0),
        0,
      );

      const monthExpenses = expenses.items
        .filter((e) => e.date.startsWith(month) && e.payment_status === 'paid')
        .reduce((s, e) => s + e.paid_amount, 0);

      const netCash = monthPayments - monthExpenses;
      cumulative += netCash;

      return {
        month: month.slice(-2),
        incoming: Math.round(monthPayments),
        outgoing: Math.round(monthExpenses),
        cumulative: Math.round(cumulative),
      };
    });
  }, [last6Months, contracts.items, expenses.items]);

  // ============================================================
  // Payroll breakdown (6 months)
  // ============================================================
  const payrollTrendData = useMemo(() => {
    return last6Months.map((month) => {
      const monthPayrolls = payrolls.items.filter((p) => p.period === month);
      const totalGross = monthPayrolls.reduce((s, p) => s + p.gross_income, 0);
      return {
        month: month.slice(-2),
        amount: Math.round(totalGross),
      };
    });
  }, [last6Months, payrolls.items]);

  // ============================================================
  // Payroll by department (pie)
  // ============================================================
  const payrollByDeptData = useMemo(() => {
    const currentPayrolls = payrolls.items.filter((p) => p.period === period);
    const deptMap: Record<string, number> = {};
    currentPayrolls.forEach((p) => {
      const emp = employees.items.find((e) => e.id === p.employee_id);
      if (emp?.department) {
        deptMap[emp.department] = (deptMap[emp.department] || 0) + p.gross_income;
      }
    });
    return Object.entries(deptMap).map(([dept, amount]) => ({
      name: dept,
      value: Math.round(amount),
    }));
  }, [period, payrolls.items, employees.items]);

  // ============================================================
  // Revenue by contract type (pie)
  // ============================================================
  const revenueByTypeData = useMemo(() => {
    const typeMap: Record<string, number> = {};
    contracts.items.forEach((c) => {
      typeMap[c.type] = (typeMap[c.type] || 0) + c.contract_value;
    });
    return Object.entries(typeMap).map(([type, amount]) => ({
      name: type,
      value: Math.round(amount),
    }));
  }, [contracts.items]);

  // ============================================================
  // Top 5 contracts by value
  // ============================================================
  const topContracts = useMemo(() => {
    return contracts.items
      .sort((a, b) => b.contract_value - a.contract_value)
      .slice(0, 5);
  }, [contracts.items]);

  const COLORS = [
    '#10B981',
    '#3B82F6',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
  ];

  if (!perm.can('view')) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'var(--color-text-muted, #6B7280)' }}>Không có quyền truy cập.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="app-header">
        <h1>📊 Báo cáo</h1>
        <p>Lãi/lỗ · Dòng tiền · Nhân sự · Hợp đồng</p>
      </div>

      {/* Period selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, marginRight: 8 }}>
          Kỳ tính:
        </label>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            fontSize: 13,
          }}
        />
      </div>

      {/* P&L Section */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: 'var(--color-surface-card, #fff)',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
        }}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 700 }}>
          💰 Báo cáo Lãi / Lỗ
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <PLRow label="Doanh thu" amount={plData.revenue} color="#10B981" />
          <PLRow label="Chi phí (vật tư + khác)" amount={plData.costOfRevenue + plData.otherExpenses} color="#EF4444" />
          <PLRow label="Lương NV" amount={plData.payrollCost} color="#EF4444" />
          <PLRow label="EBIT" amount={plData.ebit} color={plData.ebit >= 0 ? '#10B981' : '#EF4444'} />
          <PLRow label="Thuế TNDN 20%" amount={plData.corporateTax} color="#F59E0B" />
          <PLRow
            label="Lợi nhuận ròng"
            amount={plData.netProfit}
            color={plData.netProfit >= 0 ? '#10B981' : '#EF4444'}
            bold
          />
        </div>
      </div>

      {/* Revenue vs Expense Chart (6 months) */}
      {last6Months.length > 0 && (
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
            📈 Doanh thu vs Chi phí (6 tháng gần nhất)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={last6Months.map((month) => {
                const monthContracts = contracts.items.filter((c) =>
                  c.signed_date?.startsWith(month),
                );
                const monthExpenses = expenses.items
                  .filter((e) => e.date.startsWith(month))
                  .reduce((s, e) => s + e.total, 0);
                return {
                  month: month.slice(-2),
                  revenue: monthContracts.reduce((s, c) => s + c.contract_value, 0),
                  expense: monthExpenses,
                };
              })}
              margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatVND(v as number)} />
              <Legend />
              <Bar dataKey="revenue" fill="#10B981" name="Doanh thu" />
              <Bar dataKey="expense" fill="#EF4444" name="Chi phí" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cash Flow Chart (6 months) */}
      {cashFlowData.length > 0 && (
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
            💵 Dòng tiền (Cash flow)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashFlowData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatVND(v as number)} />
              <Legend />
              <Line type="monotone" dataKey="incoming" stroke="#10B981" name="Thu vào" />
              <Line type="monotone" dataKey="outgoing" stroke="#EF4444" name="Chi ra" />
              <Line type="monotone" dataKey="cumulative" stroke="#3B82F6" name="Cumulative" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payroll Trend (6 months) */}
      {payrollTrendData.length > 0 && (
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
            👥 Quỹ lương theo tháng
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={payrollTrendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatVND(v as number)} />
              <Line type="monotone" dataKey="amount" stroke="#10B981" name="Tổng lương" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payroll by Department (pie) + Revenue by Contract Type (pie) */}
      <div
        style={{
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {payrollByDeptData.length > 0 && (
          <div
            style={{
              padding: 16,
              background: 'var(--color-surface-card, #fff)',
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700 }}>
              Cơ cấu lương theo phòng ban
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={payrollByDeptData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatVND(value)}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {payrollByDeptData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {revenueByTypeData.length > 0 && (
          <div
            style={{
              padding: 16,
              background: 'var(--color-surface-card, #fff)',
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700 }}>
              Doanh thu theo loại hợp đồng
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={revenueByTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${formatVND(value)}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {revenueByTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top 5 Contracts */}
      {topContracts.length > 0 && (
        <div
          style={{
            padding: 16,
            background: 'var(--color-surface-card, #fff)',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700 }}>
            📈 Top 5 Hợp đồng lớn nhất
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topContracts.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 12,
                  background: 'var(--color-surface-row, #F9FAFB)',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)' }}>
                    {c.customer_name} · {c.type}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-accent-primary, #10B981)',
                  }}
                >
                  {formatVND(c.contract_value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PLRow({
  label,
  amount,
  color,
  bold,
}: {
  label: string;
  amount: number;
  color: string;
  bold?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 12,
        background: 'var(--color-surface-row, #F9FAFB)',
        borderRadius: 8,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--color-text-muted, #6B7280)', marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: bold ? 16 : 14,
          fontWeight: bold ? 800 : 700,
          color: color,
        }}
      >
        {formatVND(amount)}
      </div>
    </div>
  );
}
