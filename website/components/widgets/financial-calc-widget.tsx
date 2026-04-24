'use client';

/**
 * FinancialCalcWidget — máy tính tài chính nhanh cho người Việt.
 *
 * 3 tab:
 *   1. Lãi kép (compound interest): FV = PV × (1+r/n)^(n·t)
 *   2. Tiết kiệm kỳ hạn (monthly deposit): FV = PMT × ((1+i)^n - 1) / i
 *   3. Trả góp cố định (amortized loan): M = P·r·(1+r)^n / ((1+r)^n - 1)
 *
 * Tất cả tính phía client, không gọi API. Lưu state mỗi tab riêng.
 * Input tiền VND dùng number input (không format khi đang gõ, chỉ format output).
 */
import { useMemo, useState } from 'react';
import { Calculator, Coins, PiggyBank, Wallet } from 'lucide-react';
import { WidgetCard } from './widget-card';

type Mode = 'compound' | 'savings' | 'loan';

function formatVND(n: number): string {
  if (!isFinite(n)) return '--';
  return Math.round(n).toLocaleString('vi-VN') + ' đ';
}

function formatPct(n: number): string {
  if (!isFinite(n)) return '--';
  return n.toFixed(2) + ' %';
}

/** Input số với label nhỏ, suffix (đ, %, tháng…). Không format VND khi gõ. */
function NumberField({
  label,
  value,
  onChange,
  suffix,
  step,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-[11px] uppercase tracking-wide font-medium"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <div
        className="flex items-center gap-1 px-2.5 h-9 rounded-md border"
        style={{
          background: 'var(--color-surface-bg)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            onChange(Number.isFinite(v) ? v : 0);
          }}
          step={step}
          min={min}
          className="flex-1 min-w-0 bg-transparent text-sm tabular-nums outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
        {suffix && (
          <span
            className="text-xs shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

/** Hiển thị 1 dòng kết quả: label | giá trị. */
function ResultRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="flex items-baseline justify-between py-1.5 border-b last:border-0"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <span
        className="text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasis ? 'text-base font-bold' : 'text-sm font-semibold'}`}
        style={{
          color: emphasis
            ? 'var(--color-accent-primary)'
            : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// -------- Calculators --------

function CompoundPanel() {
  const [principal, setPrincipal] = useState(100_000_000);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(5);
  const [compounds, setCompounds] = useState(12);

  const result = useMemo(() => {
    const r = rate / 100;
    const n = compounds;
    const t = years;
    const fv = principal * Math.pow(1 + r / n, n * t);
    const interest = fv - principal;
    return { fv, interest };
  }, [principal, rate, years, compounds]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField
          label="Số tiền gốc"
          value={principal}
          onChange={setPrincipal}
          suffix="đ"
          step={1_000_000}
        />
        <NumberField
          label="Lãi suất năm"
          value={rate}
          onChange={setRate}
          suffix="%"
          step={0.1}
        />
        <NumberField
          label="Thời gian"
          value={years}
          onChange={setYears}
          suffix="năm"
          step={1}
        />
        <NumberField
          label="Ghép lãi / năm"
          value={compounds}
          onChange={setCompounds}
          suffix="lần"
          step={1}
          min={1}
        />
      </div>

      <div
        className="rounded-md px-3 py-2.5"
        style={{
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <ResultRow
          label="Giá trị tương lai"
          value={formatVND(result.fv)}
          emphasis
        />
        <ResultRow label="Tiền lãi thu được" value={formatVND(result.interest)} />
      </div>
    </div>
  );
}

function SavingsPanel() {
  const [monthly, setMonthly] = useState(5_000_000);
  const [rate, setRate] = useState(5.5);
  const [months, setMonths] = useState(36);

  const result = useMemo(() => {
    const i = rate / 100 / 12;
    const n = months;
    const fv = i === 0 ? monthly * n : (monthly * (Math.pow(1 + i, n) - 1)) / i;
    const totalDeposit = monthly * n;
    const interest = fv - totalDeposit;
    return { fv, totalDeposit, interest };
  }, [monthly, rate, months]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField
          label="Gửi hàng tháng"
          value={monthly}
          onChange={setMonthly}
          suffix="đ"
          step={500_000}
        />
        <NumberField
          label="Lãi suất năm"
          value={rate}
          onChange={setRate}
          suffix="%"
          step={0.1}
        />
        <NumberField
          label="Số tháng"
          value={months}
          onChange={setMonths}
          suffix="tháng"
          step={1}
          min={1}
        />
        <div
          className="flex flex-col justify-center px-2.5 h-9 rounded-md"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="text-[10px] uppercase">Tương đương</span>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {(months / 12).toFixed(1)} năm
          </span>
        </div>
      </div>

      <div
        className="rounded-md px-3 py-2.5"
        style={{
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <ResultRow
          label="Tổng tiền cuối kỳ"
          value={formatVND(result.fv)}
          emphasis
        />
        <ResultRow label="Tổng vốn đã gửi" value={formatVND(result.totalDeposit)} />
        <ResultRow label="Lãi nhận được" value={formatVND(result.interest)} />
      </div>
    </div>
  );
}

function LoanPanel() {
  const [principal, setPrincipal] = useState(800_000_000);
  const [rate, setRate] = useState(9.5);
  const [months, setMonths] = useState(240);

  const result = useMemo(() => {
    const r = rate / 100 / 12;
    const n = months;
    const monthly =
      r === 0
        ? principal / n
        : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalPaid = monthly * n;
    const totalInterest = totalPaid - principal;
    return { monthly, totalPaid, totalInterest };
  }, [principal, rate, months]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <NumberField
          label="Khoản vay"
          value={principal}
          onChange={setPrincipal}
          suffix="đ"
          step={10_000_000}
        />
        <NumberField
          label="Lãi suất năm"
          value={rate}
          onChange={setRate}
          suffix="%"
          step={0.1}
        />
        <NumberField
          label="Kỳ hạn"
          value={months}
          onChange={setMonths}
          suffix="tháng"
          step={12}
          min={1}
        />
        <div
          className="flex flex-col justify-center px-2.5 h-9 rounded-md"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-muted)',
          }}
        >
          <span className="text-[10px] uppercase">Tương đương</span>
          <span
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {(months / 12).toFixed(1)} năm
          </span>
        </div>
      </div>

      <div
        className="rounded-md px-3 py-2.5"
        style={{
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <ResultRow
          label="Trả hàng tháng"
          value={formatVND(result.monthly)}
          emphasis
        />
        <ResultRow label="Tổng trả sau kỳ hạn" value={formatVND(result.totalPaid)} />
        <ResultRow label="Tổng lãi trả" value={formatVND(result.totalInterest)} />
      </div>
    </div>
  );
}

export function FinancialCalcWidget() {
  const [mode, setMode] = useState<Mode>('compound');

  const tabs: Array<{ key: Mode; label: string; Icon: typeof Coins }> = [
    { key: 'compound', label: 'Lãi kép', Icon: Coins },
    { key: 'savings', label: 'Tiết kiệm', Icon: PiggyBank },
    { key: 'loan', label: 'Trả góp', Icon: Wallet },
  ];

  return (
    <WidgetCard
      title="Máy tính tài chính"
      icon={<Calculator size={16} strokeWidth={2} />}
    >
      <div
        className="flex items-center gap-1 p-1 rounded-md mb-3"
        style={{
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {tabs.map(({ key, label, Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded text-xs font-semibold transition-colors"
              style={{
                background: active ? 'var(--color-surface-card)' : 'transparent',
                color: active
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-muted)',
                boxShadow: active ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <Icon size={13} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </div>

      {mode === 'compound' && <CompoundPanel />}
      {mode === 'savings' && <SavingsPanel />}
      {mode === 'loan' && <LoanPanel />}

      <p
        className="text-[10px] mt-2 italic"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Ước tính nhanh — kết quả thực tế phụ thuộc ngân hàng & phí dịch vụ.
      </p>
    </WidgetCard>
  );
}
