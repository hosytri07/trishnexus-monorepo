'use client';

/**
 * /vat-lieu — Phase 19.20 — Vật liệu xây dựng catalog.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Search, X } from 'lucide-react';
import {
  type MaterialCategory,
  type MaterialItem,
  CATEGORY_CONFIGS,
  MATERIALS,
} from '@/data/materials';

export default function VatLieuPage() {
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MaterialItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MATERIALS.filter((m) => {
      if (activeCategory !== 'all' && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.spec.toLowerCase().includes(q) ||
        (m.standard ?? '').toLowerCase().includes(q) ||
        (m.brands ?? []).some((b) => b.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, search]);

  const categories = Object.values(CATEGORY_CONFIGS);

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
          <Package size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Vật liệu xây dựng
          </h1>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            {MATERIALS.length} loại
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Database vật liệu phổ biến tại VN — thông số kỹ thuật, TCVN áp dụng, hãng sản xuất, giá tham khảo.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên, thông số, TCVN, hãng..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
          label={`Tất cả (${MATERIALS.length})`}
          color="#9CA3AF"
        />
        {categories.map((c) => {
          const count = MATERIALS.filter((m) => m.category === c.id).length;
          return (
            <Chip
              key={c.id}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
              label={`${c.icon} ${c.shortName} (${count})`}
              color={c.color}
            />
          );
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {filtered.length} vật liệu khớp
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>Không tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((m) => (
            <MaterialCard key={m.id} material={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      {selected && <MaterialModal material={selected} onClose={() => setSelected(null)} />}
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

function MaterialCard({ material, onClick }: { material: MaterialItem; onClick: () => void }) {
  const cfg = CATEGORY_CONFIGS[material.category];
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
          <h3 className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {material.name}
          </h3>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {material.spec}
          </p>
        </div>
      </header>
      {material.standard && (
        <span
          className="inline-flex items-center self-start px-1.5 h-4 rounded text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ background: cfg.color + '22', color: cfg.color }}
        >
          {material.standard}
        </span>
      )}
      {material.priceRef && (
        <p className="text-xs mt-auto" style={{ color: 'var(--color-text-secondary)' }}>
          💰 {material.priceRef}
        </p>
      )}
    </button>
  );
}

function MaterialModal({ material, onClose }: { material: MaterialItem; onClose: () => void }) {
  const cfg = CATEGORY_CONFIGS[material.category];
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-xl w-full rounded-xl border max-h-[85vh] overflow-y-auto"
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
          <div className="flex items-start gap-3 mb-3">
            <span className="text-3xl">{cfg.icon}</span>
            <div className="flex-1">
              <span
                className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ background: cfg.color + '22', color: cfg.color }}
              >
                {cfg.name}
              </span>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {material.name}
              </h2>
              <p className="text-sm font-mono mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {material.spec}
              </p>
            </div>
          </div>

          {material.standard && (
            <div
              className="rounded-md p-3 mb-4 text-sm"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-text-primary)', borderLeft: '3px solid var(--color-accent-primary)' }}
            >
              📖 Tiêu chuẩn áp dụng: <strong>{material.standard}</strong>
            </div>
          )}

          {/* Properties */}
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Thông số kỹ thuật
          </h3>
          <dl className="space-y-2 mb-4">
            {material.properties.map((p, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 pb-2 border-b"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <dt className="text-xs uppercase tracking-wider shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {p.label}
                </dt>
                <dd className="text-right text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {p.value}
                </dd>
              </div>
            ))}
          </dl>

          {material.brands && material.brands.length > 0 && (
            <>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Hãng phổ biến
              </h3>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {material.brands.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center px-2 h-6 rounded text-xs font-medium"
                    style={{ background: 'var(--color-surface-bg_elevated)', color: 'var(--color-text-primary)' }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </>
          )}

          {material.priceRef && (
            <div
              className="rounded-md p-3 mt-3"
              style={{ background: 'rgba(245,158,11,0.10)', borderLeft: '3px solid #F59E0B' }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#F59E0B' }}>
                Giá tham khảo
              </div>
              <div className="text-base font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                {material.priceRef}
              </div>
              <p className="text-[10px] mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>
                Giá thay đổi theo vùng + thời điểm. Liên hệ nhà cung cấp để báo giá chính xác.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
