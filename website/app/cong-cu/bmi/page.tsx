'use client';

/**
 * /cong-cu/bmi — Phase 19.15 — BMI Calculator.
 *
 * Tính BMI = weight (kg) / height² (m²) + phân loại theo WHO Asia-Pacific
 * (chuẩn riêng cho người châu Á — chặt hơn WHO international).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HeartPulse, Info } from 'lucide-react';

interface BmiCategory {
  name: string;
  range: string;
  color: string;
  hint: string;
  matches: (bmi: number) => boolean;
}

// WHO Asia-Pacific cutoffs (chặt hơn international)
const CATEGORIES: BmiCategory[] = [
  { name: 'Thiếu cân', range: '< 18.5', color: '#3B82F6', hint: 'Nên tăng cân, ăn đủ chất.', matches: (b) => b < 18.5 },
  { name: 'Bình thường', range: '18.5 - 22.9', color: '#10B981', hint: 'Cân nặng hợp lý cho người Châu Á.', matches: (b) => b >= 18.5 && b < 23 },
  { name: 'Thừa cân', range: '23 - 24.9', color: '#F59E0B', hint: 'Nên giảm cân nhẹ, vận động đều đặn.', matches: (b) => b >= 23 && b < 25 },
  { name: 'Béo phì độ I', range: '25 - 29.9', color: '#F97316', hint: 'Cần giảm cân + chế độ tập + dinh dưỡng.', matches: (b) => b >= 25 && b < 30 },
  { name: 'Béo phì độ II', range: '≥ 30', color: '#EF4444', hint: 'Nguy cơ cao, cần khám chuyên khoa.', matches: (b) => b >= 30 },
];

export default function BmiPage() {
  const [weight, setWeight] = useState('70');
  const [height, setHeight] = useState('170');
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');

  const result = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
    let bmi: number;
    if (unit === 'metric') {
      const hMeters = h / 100;
      bmi = w / (hMeters * hMeters);
    } else {
      // weight in lb, height in inch: bmi = (lb / inch²) × 703
      bmi = (w / (h * h)) * 703;
    }
    const cat = CATEGORIES.find((c) => c.matches(bmi)) ?? CATEGORIES[1]!;
    // Tính khoảng cân nặng ideal
    const heightM = unit === 'metric' ? h / 100 : (h * 2.54) / 100;
    const wMin = 18.5 * heightM * heightM;
    const wMax = 22.9 * heightM * heightM;
    return { bmi, cat, wMin, wMax };
  }, [weight, height, unit]);

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
          <HeartPulse size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            BMI Calculator
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tính chỉ số khối cơ thể (BMI) theo chuẩn WHO Asia-Pacific — chặt hơn
          chuẩn quốc tế, phù hợp người Việt.
        </p>
      </header>

      {/* Form */}
      <section
        className="rounded-xl border p-5 mb-5"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        {/* Unit toggle */}
        <div className="flex justify-end mb-4">
          <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
            <button
              type="button"
              onClick={() => setUnit('metric')}
              className="inline-flex items-center px-3 h-8 rounded text-xs font-semibold"
              style={{
                background: unit === 'metric' ? 'var(--color-accent-soft)' : 'transparent',
                color: unit === 'metric' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >
              kg / cm
            </button>
            <button
              type="button"
              onClick={() => setUnit('imperial')}
              className="inline-flex items-center px-3 h-8 rounded text-xs font-semibold"
              style={{
                background: unit === 'imperial' ? 'var(--color-accent-soft)' : 'transparent',
                color: unit === 'imperial' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >
              lb / inch
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={`Cân nặng (${unit === 'metric' ? 'kg' : 'lb'})`}>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              step="0.1"
              className="w-full h-12 px-3 rounded-md outline-none border text-lg font-semibold"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
          <Field label={`Chiều cao (${unit === 'metric' ? 'cm' : 'inch'})`}>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              step="0.1"
              className="w-full h-12 px-3 rounded-md outline-none border text-lg font-semibold"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>
        </div>
      </section>

      {/* Result */}
      {result && (
        <section
          className="rounded-xl border p-6 mb-5"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: result.cat.color,
            borderWidth: 2,
          }}
        >
          <div className="text-center mb-4">
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Chỉ số BMI của bạn
            </div>
            <div className="text-5xl font-extrabold mb-2" style={{ color: result.cat.color }}>
              {result.bmi.toFixed(1)}
            </div>
            <div
              className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
              style={{ background: result.cat.color + '22', color: result.cat.color }}
            >
              {result.cat.name} ({result.cat.range})
            </div>
            <p className="text-sm mt-3 max-w-lg mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              💡 {result.cat.hint}
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-3 pt-4 border-t"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <Stat label="Khoảng cân lý tưởng" value={`${result.wMin.toFixed(1)} - ${result.wMax.toFixed(1)} kg`} />
            <Stat
              label={result.bmi < 18.5 ? 'Cần tăng' : result.bmi > 22.9 ? 'Cần giảm' : 'Đã hợp lý'}
              value={
                result.bmi < 18.5
                  ? `+${(result.wMin - parseFloat(weight)).toFixed(1)} kg`
                  : result.bmi > 22.9
                    ? `-${(parseFloat(weight) - result.wMax).toFixed(1)} kg`
                    : '✓'
              }
            />
          </div>
        </section>
      )}

      {/* Categories table */}
      <section
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3 inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
          <Info size={12} /> Bảng phân loại WHO Asia-Pacific
        </h2>
        <div className="space-y-1.5">
          {CATEGORIES.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between gap-3 p-2 rounded"
              style={{
                background:
                  result && result.cat.name === c.name
                    ? c.color + '22'
                    : 'var(--color-surface-bg_elevated)',
              }}
            >
              <span
                className="inline-flex items-center gap-2 text-sm font-semibold"
                style={{ color: c.color }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: c.color }}
                />
                {c.name}
              </span>
              <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {c.range}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
          ⚠ BMI là chỉ số tham khảo, không tính được khối cơ vs mỡ. Người tập gym
          có thể có BMI cao do nhiều cơ — không có nghĩa béo. Cần đo % mỡ riêng.
        </p>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 inline-block" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
