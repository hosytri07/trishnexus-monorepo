'use client';

/**
 * /cong-cu/tinh-ngay — Phase 19.15 — Tính ngày.
 *
 * 3 mode:
 *   - Khoảng cách giữa 2 ngày (số ngày, tuần, tháng, năm)
 *   - Cộng/trừ ngày từ 1 mốc
 *   - Tuổi (tính từ ngày sinh đến nay)
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';

type Mode = 'diff' | 'addsub' | 'age';

export default function TinhNgayPage() {
  const [mode, setMode] = useState<Mode>('diff');

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Tính ngày
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tính khoảng cách giữa 2 ngày, cộng/trừ ngày, tính tuổi chính xác.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <ModeChip active={mode === 'diff'} onClick={() => setMode('diff')} label="Khoảng cách 2 ngày" />
        <ModeChip active={mode === 'addsub'} onClick={() => setMode('addsub')} label="Cộng / Trừ ngày" />
        <ModeChip active={mode === 'age'} onClick={() => setMode('age')} label="Tính tuổi" />
      </div>

      {mode === 'diff' && <DiffMode />}
      {mode === 'addsub' && <AddSubMode />}
      {mode === 'age' && <AgeMode />}
    </main>
  );
}

function ModeChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 h-9 rounded-md text-sm font-semibold transition-all"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-card)',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
      }}
    >
      {label}
    </button>
  );
}

function DiffMode() {
  const today = new Date().toISOString().split('T')[0]!;
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const result = useMemo(() => {
    if (!from || !to) return null;
    const d1 = new Date(from);
    const d2 = new Date(to);
    const diffMs = d2.getTime() - d1.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const absDays = Math.abs(days);
    const weeks = Math.floor(absDays / 7);
    const months = Math.floor(absDays / 30.44);
    const years = (absDays / 365.25).toFixed(2);
    // Working days (estimate skip Saturday + Sunday)
    let workDays = 0;
    const start = new Date(Math.min(d1.getTime(), d2.getTime()));
    const end = new Date(Math.max(d1.getTime(), d2.getTime()));
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) workDays++;
      cur.setDate(cur.getDate() + 1);
    }
    return { days, absDays, weeks, months, years, workDays };
  }, [from, to]);

  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Field label="Từ ngày">
          <DateInput value={from} onChange={setFrom} />
        </Field>
        <Field label="Đến ngày">
          <DateInput value={to} onChange={setTo} />
        </Field>
      </div>
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Số ngày" value={`${result.days >= 0 ? result.days : `${result.days}`}`} highlight />
          <Stat label="Tuần" value={`${result.weeks}`} />
          <Stat label="Tháng (~)" value={`${result.months}`} />
          <Stat label="Năm" value={`${result.years}`} />
          <Stat label="Ngày làm việc" value={`${result.workDays}`} />
        </div>
      )}
    </Card>
  );
}

function AddSubMode() {
  const today = new Date().toISOString().split('T')[0]!;
  const [base, setBase] = useState(today);
  const [delta, setDelta] = useState('30');
  const [op, setOp] = useState<'add' | 'sub'>('add');

  const result = useMemo(() => {
    if (!base) return null;
    const d = new Date(base);
    const n = parseInt(delta, 10);
    if (isNaN(n)) return null;
    d.setDate(d.getDate() + (op === 'add' ? n : -n));
    return d;
  }, [base, delta, op]);

  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_120px] gap-3 mb-4 items-end">
        <Field label="Ngày gốc">
          <DateInput value={base} onChange={setBase} />
        </Field>
        <Field label="Phép">
          <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <button
              type="button"
              onClick={() => setOp('add')}
              className="inline-flex items-center justify-center w-12 h-10 rounded text-base font-bold"
              style={{
                background: op === 'add' ? 'var(--color-accent-soft)' : 'transparent',
                color: op === 'add' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >+</button>
            <button
              type="button"
              onClick={() => setOp('sub')}
              className="inline-flex items-center justify-center w-12 h-10 rounded text-base font-bold"
              style={{
                background: op === 'sub' ? 'var(--color-accent-soft)' : 'transparent',
                color: op === 'sub' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >−</button>
          </div>
        </Field>
        <Field label="Số ngày">
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="w-full h-10 px-3 rounded-md outline-none border"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
      </div>
      {result && (
        <div
          className="rounded-md p-4 text-center"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent-primary)',
          }}
        >
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
            Kết quả
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>
            {result.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        </div>
      )}
    </Card>
  );
}

function AgeMode() {
  const [birth, setBirth] = useState('2000-01-01');

  const age = useMemo(() => {
    if (!birth) return null;
    const b = new Date(birth);
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    let months = now.getMonth() - b.getMonth();
    let days = now.getDate() - b.getDate();
    if (days < 0) {
      months--;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      days += prevMonth;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    const diffMs = now.getTime() - b.getTime();
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = years * 12 + months;
    return { years, months, days, totalDays, totalWeeks, totalMonths };
  }, [birth]);

  return (
    <Card>
      <div className="mb-4 max-w-xs">
        <Field label="Ngày sinh">
          <DateInput value={birth} onChange={setBirth} />
        </Field>
      </div>
      {age && (
        <>
          <div
            className="rounded-md p-4 text-center mb-4"
            style={{
              background: 'var(--color-accent-soft)',
              border: '1px solid var(--color-accent-primary)',
            }}
          >
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Tuổi của bạn
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>
              {age.years} năm · {age.months} tháng · {age.days} ngày
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tổng tháng" value={`${age.totalMonths}`} />
            <Stat label="Tổng tuần" value={`${age.totalWeeks}`} />
            <Stat label="Tổng ngày" value={`${age.totalDays.toLocaleString('vi-VN')}`} />
          </div>
        </>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1 inline-block" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 rounded-md outline-none border"
      style={{
        background: 'var(--color-surface-bg_elevated)',
        borderColor: 'var(--color-border-default)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-md px-3 py-2 text-center"
      style={{
        background: highlight ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
        border: highlight ? '1px solid var(--color-accent-primary)' : 'none',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ opacity: 0.7 }}>
        {label}
      </div>
      <div
        className="font-bold text-base"
        style={{ color: highlight ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}
