'use client';

/**
 * /dinh-muc — Phase 19.20 — Định mức xây dựng (rút gọn).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, Search, X } from 'lucide-react';
import {
  type ConstructionNorm,
  type NormCategory,
  CONSTRUCTION_NORMS,
  NORM_CATEGORIES,
} from '@/data/dinh-muc';
import { fetchConstructionNorms } from '@/lib/databases-fetch';

export default function DinhMucPage() {
  const [norms, setNorms] = useState<ConstructionNorm[]>(CONSTRUCTION_NORMS);
  const [activeCat, setActiveCat] = useState<NormCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConstructionNorm | null>(null);
  const [qty, setQty] = useState<number>(1);

  useEffect(() => {
    fetchConstructionNorms().then(setNorms);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return norms.filter((n) => {
      if (activeCat !== 'all' && n.category !== activeCat) return false;
      if (!q) return true;
      return (
        n.code.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q)
      );
    });
  }, [activeCat, search, norms]);

  const cats = Object.values(NORM_CATEGORIES);

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calculator size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Định mức xây dựng
          </h1>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            {norms.length} mã
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Tra cứu định mức hao phí vật liệu / nhân công / máy thi công theo QĐ 1776/2007/QĐ-BXD. Bấm vào để tính khối lượng.
        </p>
      </header>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã hiệu, tên công tác..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Chip
          active={activeCat === 'all'}
          onClick={() => setActiveCat('all')}
          label={`Tất cả (${norms.length})`}
          color="#9CA3AF"
        />
        {cats.map((c) => {
          const count = norms.filter((n) => n.category === c.id).length;
          return (
            <Chip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              label={`${c.icon} ${c.name} (${count})`}
              color={c.color}
            />
          );
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {filtered.length} công tác khớp
      </p>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>Không tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((n) => (
            <NormCard key={n.id} norm={n} onClick={() => { setSelected(n); setQty(1); }} />
          ))}
        </div>
      )}

      {selected && (
        <NormModal
          norm={selected}
          qty={qty}
          onQtyChange={setQty}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function Chip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 h-7 rounded-full text-xs font-semibold transition-all"
      style={{
        background: active ? color + '22' : 'var(--color-surface-bg_elevated)',
        color: active ? color : 'var(--color-text-muted)',
        border: `1px solid ${active ? color + '66' : 'var(--color-border-subtle)'}`,
      }}
    >
      {label}
    </button>
  );
}

function NormCard({ norm, onClick }: { norm: ConstructionNorm; onClick: () => void }) {
  const cfg = NORM_CATEGORIES[norm.category];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex flex-col p-4 rounded-lg border transition-all hover:scale-[1.005]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }}
    >
      <header className="flex items-start gap-2 mb-2">
        <span className="text-xl shrink-0" aria-hidden>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono font-bold mb-0.5" style={{ color: cfg.color }}>
            {norm.code}
          </p>
          <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {norm.name}
          </h3>
        </div>
      </header>
      <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {norm.description}
      </p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Đơn vị: <strong style={{ color: 'var(--color-text-primary)' }}>{norm.unit}</strong>
        </span>
        <span
          className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold"
          style={{ background: cfg.color + '22', color: cfg.color }}
        >
          {norm.resources.length} resource
        </span>
      </div>
    </button>
  );
}

function NormModal({
  norm,
  qty,
  onQtyChange,
  onClose,
}: {
  norm: ConstructionNorm;
  qty: number;
  onQtyChange: (v: number) => void;
  onClose: () => void;
}) {
  const cfg = NORM_CATEGORIES[norm.category];

  // Group by resource type
  const grouped = {
    'vat-lieu': norm.resources.filter((r) => r.type === 'vat-lieu'),
    'nhan-cong': norm.resources.filter((r) => r.type === 'nhan-cong'),
    may: norm.resources.filter((r) => r.type === 'may'),
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-2xl w-full rounded-xl border max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--color-surface-card)', borderColor: cfg.color, borderWidth: 2 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--color-surface-muted)]"
          aria-label="Đóng"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">{cfg.icon}</span>
            <div className="flex-1">
              <p className="text-xs font-mono font-bold mb-1" style={{ color: cfg.color }}>
                {cfg.name} • {norm.code}
              </p>
              <h2 className="text-xl font-bold leading-tight mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {norm.name}
              </h2>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {norm.description}
              </p>
            </div>
          </div>

          {/* Calculator */}
          <div
            className="rounded-md p-3 mb-4 flex items-center gap-3"
            style={{ background: 'var(--color-accent-soft)', borderLeft: '3px solid var(--color-accent-primary)' }}
          >
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-primary)' }}>
              Khối lượng
            </label>
            <input
              type="number"
              value={qty}
              min={0}
              step="any"
              onChange={(e) => onQtyChange(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-28 h-8 px-2 rounded text-sm text-right outline-none border"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {norm.unit}
            </span>
          </div>

          {(['vat-lieu', 'nhan-cong', 'may'] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const labels: Record<typeof type, string> = {
              'vat-lieu': '🧪 Vật liệu',
              'nhan-cong': '👷 Nhân công',
              may: '🏗️ Máy thi công',
            };
            return (
              <div key={type} className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  {labels[type]}
                </h3>
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <th className="text-left py-1 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-muted)' }}>Tên</th>
                        <th className="text-right py-1 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-muted)' }}>Đơn vị</th>
                        <th className="text-right py-1 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-muted)' }}>Định mức</th>
                        <th className="text-right py-1 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--color-accent-primary)' }}>Tổng × {qty}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td className="py-1.5 text-xs pr-2" style={{ color: 'var(--color-text-primary)' }}>{r.name}</td>
                          <td className="py-1.5 text-xs text-right whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{r.unit}</td>
                          <td className="py-1.5 text-xs text-right font-mono whitespace-nowrap" style={{ color: 'var(--color-text-primary)' }}>{r.qty.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}</td>
                          <td className="py-1.5 text-xs text-right font-mono font-bold whitespace-nowrap" style={{ color: 'var(--color-accent-primary)' }}>
                            {(r.qty * qty).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <p className="text-[10px] italic mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Nguồn: {norm.source}. Số liệu rút gọn để tham khảo nhanh — tra văn bản gốc khi lập dự toán chính thức.
          </p>
        </div>
      </div>
    </div>
  );
}
