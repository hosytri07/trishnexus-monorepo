'use client';

/**
 * /cong-cu/don-vi — Phase 19.15 — Đơn vị quy đổi.
 *
 * 5 nhóm: Chiều dài · Khối lượng · Nhiệt độ · Diện tích · Thể tích.
 * Mỗi nhóm có N đơn vị, factor về SI (mét, kg, °C, m², L).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Ruler } from 'lucide-react';

interface Unit {
  id: string;
  label: string;
  /** Hệ số convert sang đơn vị cơ bản (m, kg, m², L). 0 nếu cần fn riêng (vd nhiệt độ) */
  factor: number;
}

interface Group {
  id: string;
  name: string;
  base: string;
  units: Unit[];
  /** Hàm convert đặc biệt (vd nhiệt độ) — nếu set thì factor bị bỏ qua */
  convertSpecial?: (value: number, fromId: string, toId: string) => number;
}

const GROUPS: Group[] = [
  {
    id: 'length',
    name: 'Chiều dài',
    base: 'm',
    units: [
      { id: 'mm', label: 'Milimet (mm)', factor: 0.001 },
      { id: 'cm', label: 'Centimet (cm)', factor: 0.01 },
      { id: 'dm', label: 'Decimet (dm)', factor: 0.1 },
      { id: 'm', label: 'Mét (m)', factor: 1 },
      { id: 'km', label: 'Kilomet (km)', factor: 1000 },
      { id: 'in', label: 'Inch', factor: 0.0254 },
      { id: 'ft', label: 'Foot (ft)', factor: 0.3048 },
      { id: 'yd', label: 'Yard (yd)', factor: 0.9144 },
      { id: 'mi', label: 'Dặm (mi)', factor: 1609.344 },
      { id: 'nm', label: 'Hải lý (nm)', factor: 1852 },
    ],
  },
  {
    id: 'mass',
    name: 'Khối lượng',
    base: 'kg',
    units: [
      { id: 'mg', label: 'Miligam (mg)', factor: 0.000001 },
      { id: 'g', label: 'Gam (g)', factor: 0.001 },
      { id: 'kg', label: 'Kilogam (kg)', factor: 1 },
      { id: 't', label: 'Tấn (t)', factor: 1000 },
      { id: 'oz', label: 'Ounce (oz)', factor: 0.02834952 },
      { id: 'lb', label: 'Pound (lb)', factor: 0.45359237 },
      { id: 'cay', label: 'Cây vàng', factor: 0.0375 },
      { id: 'chi', label: 'Chỉ vàng', factor: 0.00375 },
    ],
  },
  {
    id: 'area',
    name: 'Diện tích',
    base: 'm²',
    units: [
      { id: 'cm2', label: 'cm²', factor: 0.0001 },
      { id: 'm2', label: 'Mét vuông (m²)', factor: 1 },
      { id: 'a', label: 'Ar (a) = 100m²', factor: 100 },
      { id: 'ha', label: 'Hecta (ha)', factor: 10000 },
      { id: 'km2', label: 'km²', factor: 1000000 },
      { id: 'mau', label: 'Mẫu Bắc Bộ (3600m²)', factor: 3600 },
      { id: 'sao', label: 'Sào Bắc Bộ (360m²)', factor: 360 },
      { id: 'sqft', label: 'Square foot (ft²)', factor: 0.092903 },
    ],
  },
  {
    id: 'volume',
    name: 'Thể tích',
    base: 'L',
    units: [
      { id: 'ml', label: 'Mililit (ml)', factor: 0.001 },
      { id: 'l', label: 'Lit (L)', factor: 1 },
      { id: 'm3', label: 'Mét khối (m³)', factor: 1000 },
      { id: 'gal', label: 'Gallon (US)', factor: 3.78541 },
      { id: 'cup', label: 'Cup (US)', factor: 0.24 },
      { id: 'tbsp', label: 'Tablespoon (US)', factor: 0.0148 },
    ],
  },
  {
    id: 'temp',
    name: 'Nhiệt độ',
    base: '°C',
    units: [
      { id: 'c', label: 'Celsius (°C)', factor: 0 },
      { id: 'f', label: 'Fahrenheit (°F)', factor: 0 },
      { id: 'k', label: 'Kelvin (K)', factor: 0 },
    ],
    convertSpecial: (value, from, to) => {
      // Convert from → C trước
      let c: number;
      if (from === 'c') c = value;
      else if (from === 'f') c = ((value - 32) * 5) / 9;
      else c = value - 273.15;
      // C → to
      if (to === 'c') return c;
      if (to === 'f') return (c * 9) / 5 + 32;
      return c + 273.15;
    },
  },
];

export default function DonViPage() {
  const [groupId, setGroupId] = useState<string>('length');
  const [fromId, setFromId] = useState<string>('m');
  const [toId, setToId] = useState<string>('cm');
  const [value, setValue] = useState<string>('1');

  const group = useMemo(() => GROUPS.find((g) => g.id === groupId)!, [groupId]);

  function handleGroupChange(id: string) {
    setGroupId(id);
    const g = GROUPS.find((x) => x.id === id)!;
    setFromId(g.units[0]!.id);
    setToId(g.units[1]?.id ?? g.units[0]!.id);
  }

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return null;
    if (group.convertSpecial) return group.convertSpecial(v, fromId, toId);
    const fromUnit = group.units.find((u) => u.id === fromId);
    const toUnit = group.units.find((u) => u.id === toId);
    if (!fromUnit || !toUnit) return null;
    return (v * fromUnit.factor) / toUnit.factor;
  }, [value, fromId, toId, group]);

  function fmt(n: number | null): string {
    if (n === null) return '—';
    if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6);
    return n.toLocaleString('vi-VN', { maximumFractionDigits: 8 });
  }

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
          <Ruler size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Đơn vị quy đổi
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Chuyển đổi nhanh giữa các đơn vị: chiều dài, khối lượng, nhiệt độ, diện
          tích, thể tích — bao gồm đơn vị Việt Nam (mẫu, sào, cây/chỉ vàng).
        </p>
      </header>

      {/* Group picker */}
      <div className="flex flex-wrap gap-2 mb-5">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => handleGroupChange(g.id)}
            className="inline-flex items-center px-3 h-9 rounded-md text-sm font-semibold transition-all"
            style={{
              background: groupId === g.id ? 'var(--color-accent-soft)' : 'var(--color-surface-card)',
              color: groupId === g.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              border: `1px solid ${groupId === g.id ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
            }}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Converter */}
      <section
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          {/* From */}
          <div>
            <label className="text-xs font-semibold mb-1 inline-block" style={{ color: 'var(--color-text-muted)' }}>
              Từ
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-11 px-3 rounded-md outline-none border text-base font-semibold mb-2"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full h-10 px-3 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            >
              {group.units.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          {/* Arrow */}
          <div className="flex justify-center pb-2 md:pb-7">
            <button
              type="button"
              onClick={() => {
                setFromId(toId);
                setToId(fromId);
              }}
              title="Đổi chiều"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-[var(--color-surface-muted)]"
              style={{ color: 'var(--color-accent-primary)' }}
            >
              <ArrowRight size={16} />
            </button>
          </div>

          {/* To */}
          <div>
            <label className="text-xs font-semibold mb-1 inline-block" style={{ color: 'var(--color-text-muted)' }}>
              Sang
            </label>
            <div
              className="w-full h-11 px-3 rounded-md flex items-center text-base font-semibold mb-2"
              style={{
                background: 'var(--color-accent-soft)',
                color: 'var(--color-accent-primary)',
                border: '1px solid var(--color-accent-primary)',
              }}
            >
              {fmt(result)}
            </div>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full h-10 px-3 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            >
              {group.units.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Đơn vị Việt Nam (mẫu Bắc Bộ, sào, cây vàng, chỉ vàng) tính theo chuẩn truyền thống.
        Hệ số có thể chênh ±0.1% theo vùng miền.
      </p>
    </main>
  );
}
