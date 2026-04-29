'use client';

/**
 * /quy-chuan — Phase 19.20 — Quy chuẩn / Tiêu chuẩn / Văn bản pháp lý ngành XD-GT.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookText, Search, X, ExternalLink, Loader2 } from 'lucide-react';
import {
  type Standard,
  type StandardType,
  STANDARDS,
  STANDARD_TYPE_CONFIGS,
  CATEGORY_LABELS,
} from '@/data/standards-vn';
import { fetchStandards } from '@/lib/databases-fetch';

export default function QuyChuanPage() {
  // Init với static data → instant render. useEffect sẽ refresh từ Firestore.
  const [standards, setStandards] = useState<Standard[]>(STANDARDS);
  const [activeType, setActiveType] = useState<StandardType | 'all'>('all');
  const [activeCat, setActiveCat] = useState<Standard['category'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Standard | null>(null);

  useEffect(() => {
    fetchStandards().then(setStandards);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return standards.filter((s) => {
      if (activeType !== 'all' && s.type !== activeType) return false;
      if (activeCat !== 'all' && s.category !== activeCat) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }).sort((a, b) => b.year - a.year);
  }, [activeType, activeCat, search, standards]);

  const types = Object.values(STANDARD_TYPE_CONFIGS);
  const categories = Object.entries(CATEGORY_LABELS) as [Standard['category'], string][];

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
          <BookText size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Quy chuẩn / Tiêu chuẩn
          </h1>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            {standards.length} văn bản
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          QCVN, TCVN, Thông tư, Nghị định, Quyết định ngành xây dựng – giao thông VN. Cập nhật theo chuẩn 2024-2025.
        </p>
      </header>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã, tên, phạm vi, tag..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Chip
          active={activeType === 'all'}
          onClick={() => setActiveType('all')}
          label={`Tất cả (${standards.length})`}
          color="#9CA3AF"
        />
        {types.map((t) => {
          const count = standards.filter((s) => s.type === t.type).length;
          if (count === 0) return null;
          return (
            <Chip
              key={t.type}
              active={activeType === t.type}
              onClick={() => setActiveType(t.type)}
              label={`${t.shortName} (${count})`}
              color={t.color}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <SmallChip active={activeCat === 'all'} onClick={() => setActiveCat('all')} label="Mọi lĩnh vực" />
        {categories.map(([id, label]) => {
          const count = standards.filter((s) => s.category === id).length;
          if (count === 0) return null;
          return (
            <SmallChip
              key={id}
              active={activeCat === id}
              onClick={() => setActiveCat(id)}
              label={`${label} (${count})`}
            />
          );
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {filtered.length} văn bản khớp
      </p>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>Không tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map((s) => (
            <StandardRow key={s.id} std={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      {selected && <StandardModal std={selected} onClose={() => setSelected(null)} />}
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

function SmallChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-2.5 h-6 rounded-full text-[11px] font-medium transition-all"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {label}
    </button>
  );
}

function StandardRow({ std, onClick }: { std: Standard; onClick: () => void }) {
  const cfg = STANDARD_TYPE_CONFIGS[std.type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex items-start gap-3 p-4 rounded-lg border transition-all hover:scale-[1.005]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }}
    >
      <span
        className="inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ background: cfg.color + '22', color: cfg.color, minWidth: 50 }}
      >
        {cfg.shortName}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {std.code}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}
          >
            {CATEGORY_LABELS[std.category]}
          </span>
        </div>
        <h3 className="text-sm font-semibold leading-snug mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {std.name}
        </h3>
        <p className="text-xs line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
          {std.scope}
        </p>
      </div>
    </button>
  );
}

function StandardModal({ std, onClose }: { std: Standard; onClose: () => void }) {
  const cfg = STANDARD_TYPE_CONFIGS[std.type];
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
          <div className="flex items-start gap-3 mb-4">
            <span
              className="inline-flex items-center justify-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider shrink-0"
              style={{ background: cfg.color + '22', color: cfg.color }}
            >
              {cfg.shortName}
            </span>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {cfg.name} • {std.year} • {CATEGORY_LABELS[std.category]}
              </p>
              <h2 className="text-xl font-bold leading-tight mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {std.code}
              </h2>
              <p className="text-base leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                {std.name}
              </p>
            </div>
          </div>

          <Section label="Cơ quan ban hành">
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{std.issuer}</p>
          </Section>

          <Section label="Phạm vi áp dụng">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>{std.scope}</p>
          </Section>

          {std.replaces && (
            <div
              className="rounded-md p-3 mb-4 text-sm"
              style={{ background: 'rgba(245,158,11,0.10)', borderLeft: '3px solid #F59E0B' }}
            >
              ⚠️ Thay thế: <strong>{std.replaces}</strong>
            </div>
          )}

          {std.tags.length > 0 && (
            <Section label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {std.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2 h-6 rounded text-xs font-medium"
                    style={{ background: 'var(--color-surface-bg_elevated)', color: 'var(--color-text-primary)' }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {std.url && (
            <a
              href={std.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-semibold mt-2"
              style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
            >
              <ExternalLink size={14} /> Xem văn bản gốc
            </a>
          )}

          <p className="text-[10px] italic mt-4" style={{ color: 'var(--color-text-muted)' }}>
            Lưu ý: Trish<strong>TEAM</strong> tổng hợp tham khảo. Để áp dụng pháp lý vui lòng tra cứu văn bản gốc trên Cổng TT điện tử Chính phủ.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </h3>
      {children}
    </div>
  );
}
