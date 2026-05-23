/**
 * Phase 38.9 — Tab Thuế trong Kế toán.
 *
 * Tổng hợp 3 loại thuế VN cho doanh nghiệp XD-GT:
 *   - VAT (đầu ra từ HD - đầu vào từ chi phí) — kỳ tháng/quý/năm
 *   - TNDN 20% (thuế thu nhập doanh nghiệp = doanh thu - chi phí)
 *   - TNCN (cross-reference từ module Bảng lương)
 *
 * Tất cả là computed view — không CRUD trực tiếp ở đây.
 */

import { useMemo, useState } from 'react';
import { useCollection, formatVND } from '../../storage';
import type {
  ContractIncome,
  Expense,
  PayrollEntry,
} from '../../types';

type Period = 'month' | 'quarter' | 'year';

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentYearStr(): string {
  return String(new Date().getFullYear());
}
function currentQuarter(): string {
  const m = new Date().getMonth() + 1;
  const q = Math.ceil(m / 3);
  return `${new Date().getFullYear()}-Q${q}`;
}

const TNDN_RATE = 0.20; // 20% thuế TNDN (thuế thu nhập doanh nghiệp)

export function TaxTab(): JSX.Element {
  const contracts = useCollection<ContractIncome>('contracts', 'ct');
  const expenses = useCollection<Expense>('expenses', 'exp');
  const payrolls = useCollection<PayrollEntry>('payroll', 'pay');

  const [periodMode, setPeriodMode] = useState<Period>('month');
  const [periodValue, setPeriodValue] = useState<string>(currentMonthStr());

  // Filter helper: trả về (date) → boolean theo period
  const inPeriod = useMemo(() => {
    return (dateStr?: string): boolean => {
      if (!dateStr) return false;
      if (periodMode === 'month') {
        return dateStr.startsWith(periodValue); // YYYY-MM
      }
      if (periodMode === 'year') {
        return dateStr.startsWith(periodValue); // YYYY
      }
      // quarter
      const [yy, q] = periodValue.split('-Q');
      if (!yy || !q) return false;
      const m = parseInt(dateStr.slice(5, 7), 10);
      const qStart = (parseInt(q, 10) - 1) * 3 + 1;
      return dateStr.startsWith(yy) && m >= qStart && m <= qStart + 2;
    };
  }, [periodMode, periodValue]);

  // ============================================================
  // VAT
  // ============================================================
  const vat = useMemo(() => {
    let outputVat = 0;
    let outputBase = 0;
    contracts.items.forEach((c) => {
      c.payments.forEach((p) => {
        if (inPeriod(p.date)) {
          outputBase += p.amount;
          outputVat += p.vat_amount ?? 0;
        }
      });
    });
    let inputVat = 0;
    let inputBase = 0;
    expenses.items.forEach((e) => {
      if (inPeriod(e.date)) {
        inputBase += e.amount;
        inputVat += e.vat_amount;
      }
    });
    return {
      outputVat,
      outputBase,
      inputVat,
      inputBase,
      payable: outputVat - inputVat,
    };
  }, [contracts.items, expenses.items, inPeriod]);

  // ============================================================
  // TNDN
  // ============================================================
  const tndn = useMemo(() => {
    // Doanh thu (từ payments của HD trong kỳ, không tính VAT)
    let revenue = 0;
    contracts.items.forEach((c) => {
      c.payments.forEach((p) => {
        if (inPeriod(p.date)) revenue += p.amount;
      });
    });
    // Chi phí (chưa VAT) trong kỳ
    let cost = 0;
    expenses.items.forEach((e) => {
      if (inPeriod(e.date)) cost += e.amount;
    });
    // Lương cũng là chi phí (gross_income trong kỳ)
    let payrollCost = 0;
    payrolls.items.forEach((p) => {
      if (inPeriod(p.period + '-01')) payrollCost += p.gross_income;
    });
    const totalCost = cost + payrollCost;
    const profit = revenue - totalCost;
    const tax = Math.max(0, profit * TNDN_RATE);
    return { revenue, cost, payrollCost, totalCost, profit, tax };
  }, [contracts.items, expenses.items, payrolls.items, inPeriod]);

  // ============================================================
  // TNCN summary
  // ============================================================
  const tncn = useMemo(() => {
    let total = 0;
    let count = 0;
    payrolls.items.forEach((p) => {
      if (inPeriod(p.period + '-01')) {
        total += p.tax_pit;
        count++;
      }
    });
    return { total, count };
  }, [payrolls.items, inPeriod]);

  return (
    <div>
      {/* Period selector */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600 }}>Kỳ tính thuế:</span>
        <select
          value={periodMode}
          onChange={(e) => {
            const mode = e.target.value as Period;
            setPeriodMode(mode);
            if (mode === 'month') setPeriodValue(currentMonthStr());
            else if (mode === 'year') setPeriodValue(currentYearStr());
            else setPeriodValue(currentQuarter());
          }}
          style={selectStyle}
        >
          <option value="month">Theo tháng</option>
          <option value="quarter">Theo quý</option>
          <option value="year">Theo năm</option>
        </select>
        {periodMode === 'month' ? (
          <input
            type="month"
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            style={selectStyle}
          />
        ) : periodMode === 'year' ? (
          <input
            type="number"
            value={periodValue}
            min={2020}
            max={2030}
            onChange={(e) => setPeriodValue(e.target.value)}
            style={{ ...selectStyle, width: 100 }}
          />
        ) : (
          <select
            value={periodValue}
            onChange={(e) => setPeriodValue(e.target.value)}
            style={selectStyle}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={`${currentYearStr()}-Q${q}`}>
                {currentYearStr()} - Q{q}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* VAT Section */}
      <Section emoji="🧾" title="Thuế GTGT (VAT)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <Stat
            label="Doanh thu chưa VAT"
            value={formatVND(vat.outputBase)}
            hint="Tổng tiền hợp đồng đã thu (chưa VAT)"
          />
          <Stat
            label="VAT đầu ra"
            value={formatVND(vat.outputVat)}
            color="#3B82F6"
            hint="Từ thanh toán HD trong kỳ"
          />
          <Stat
            label="VAT đầu vào"
            value={formatVND(vat.inputVat)}
            color="#10B981"
            hint="Khấu trừ từ HĐ chi phí có VAT"
          />
          <Stat
            label={vat.payable >= 0 ? 'VAT phải nộp' : 'VAT được hoàn'}
            value={formatVND(Math.abs(vat.payable))}
            color={vat.payable >= 0 ? '#EF4444' : '#10B981'}
            hint="= VAT đầu ra − VAT đầu vào"
          />
        </div>
      </Section>

      {/* TNDN Section */}
      <Section emoji="🏢" title="Thuế Thu nhập Doanh nghiệp (TNDN 20%)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <Stat label="Doanh thu" value={formatVND(tndn.revenue)} color="#10B981" />
          <Stat
            label="Chi phí vật tư + DV"
            value={formatVND(tndn.cost)}
            hint="Từ module Chi phí"
          />
          <Stat
            label="Chi phí lương"
            value={formatVND(tndn.payrollCost)}
            hint="Từ Bảng lương"
          />
          <Stat
            label={tndn.profit >= 0 ? 'Lợi nhuận trước thuế' : 'Lỗ trước thuế'}
            value={formatVND(Math.abs(tndn.profit))}
            color={tndn.profit >= 0 ? '#10B981' : '#EF4444'}
          />
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 14,
            background: tndn.profit >= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${tndn.profit >= 0 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted, #6B7280)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Thuế TNDN ước tính (20%)
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: tndn.profit >= 0 ? '#EF4444' : '#10B981',
              marginTop: 4,
            }}
          >
            {formatVND(tndn.tax)}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted, #9CA3AF)',
              marginTop: 4,
            }}
          >
            {tndn.profit >= 0
              ? `= ${formatVND(tndn.profit)} × 20%`
              : 'Doanh nghiệp đang lỗ — không phát sinh thuế TNDN trong kỳ'}
          </div>
        </div>
      </Section>

      {/* TNCN Section */}
      <Section emoji="👤" title="Thuế Thu nhập Cá nhân (TNCN)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <Stat
            label="Tổng TNCN khấu trừ"
            value={formatVND(tncn.total)}
            color="#F59E0B"
            hint={`Từ ${tncn.count} bảng lương trong kỳ`}
          />
          <Stat
            label="Số bảng lương"
            value={tncn.count.toString()}
            hint="Đã có TNCN tính sẵn"
          />
          <div
            style={{
              padding: 12,
              background: 'var(--color-surface-card, #fff)',
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              borderRadius: 10,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'var(--color-text-muted, #6B7280)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Ghi chú
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary, #4B5563)' }}>
              Doanh nghiệp khấu trừ TNCN tại nguồn theo bậc lũy tiến 5/10/15/20/25/30/35%.
              Báo cáo TNCN nộp Tổng cục Thuế hàng tháng/quý.
            </p>
          </div>
        </div>
      </Section>

      {/* Summary */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'var(--color-accent-soft, rgba(16,185,129,0.08))',
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          borderRadius: 12,
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>
          📊 Tổng số thuế ước tính phải nộp trong kỳ
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          <SummaryRow
            label="VAT"
            value={Math.max(0, vat.payable)}
            note={vat.payable < 0 ? '(được hoàn)' : ''}
          />
          <SummaryRow label="TNDN" value={tndn.tax} />
          <SummaryRow label="TNCN khấu trừ" value={tncn.total} />
          <SummaryRow
            label="Tổng cộng"
            value={Math.max(0, vat.payable) + tndn.tax + tncn.total}
            highlight
          />
        </div>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 11,
            color: 'var(--color-text-muted, #6B7280)',
            lineHeight: 1.5,
          }}
        >
          ⚠️ Đây là số ước tính phục vụ quản trị nội bộ. Số thuế nộp thực tế cần được kế
          toán chuyên môn rà soát theo quy định hiện hành (Luật thuế GTGT, Luật thuế TNDN,
          Nghị định/Thông tư hướng dẫn) trước khi nộp báo cáo.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Components
// ============================================================
function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 14,
          fontWeight: 800,
          color: 'var(--color-accent-primary, #10B981)',
        }}
      >
        {emoji} {title}
      </h3>
      {children}
    </div>
  );
}

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
            lineHeight: 1.4,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: number;
  note?: string;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        padding: 10,
        background: highlight
          ? 'var(--color-accent-primary, #10B981)'
          : 'var(--color-surface-card, #fff)',
        color: highlight ? '#fff' : 'inherit',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: highlight ? 0.85 : 1,
          color: highlight ? '#fff' : 'var(--color-text-muted, #6B7280)',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          marginTop: 3,
        }}
      >
        {formatVND(value)}
      </div>
      {note && (
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{note}</div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid var(--color-border-default, #D1D5DB)',
  background: 'var(--color-surface-card, #fff)',
  color: 'var(--color-text-primary, #111827)',
  borderRadius: 8,
  fontSize: 13,
};
