'use client';

/**
 * /duong-vn — Phase 19.20 — Database đường VN.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Route, Search, X } from 'lucide-react';
import {
  type Road,
  type RoadType,
  ROAD_TYPE_CONFIGS,
  ROADS,
  STATUS_LABELS,
} from '@/data/roads-vn';

export default function DuongVnPage() {
  const [activeType, setActiveType] = useState<RoadType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Road | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ROADS.filter((r) => {
      if (activeType !== 'all' && r.type !== activeType) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.start_point.toLowerCase().includes(q) ||
        r.end_point.toLowerCase().includes(q) ||
        r.provinces.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [activeType, search]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Route size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Đường Việt Nam
          </h1>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            {ROADS.length} tuyến
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Database hệ thống đường bộ VN — cao tốc / quốc lộ / vành đai. Thông số: chiều dài, làn, tải trọng, năm hoàn thành, tổng đầu tư.
        </p>
      </header>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm tên, mã, điểm đầu/cuối, tỉnh..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={activeType === 'all'} onClick={() => setActiveType('all')} label={`Tất cả (${ROADS.length})`} color="#9CA3AF" />
        {Object.values(ROAD_TYPE_CONFIGS).map((c) => {
          const count = ROADS.filter((r) => r.type === c.type).length;
          if (count === 0) return null;
          return (
            <Chip
              key={c.type}
              active={activeType === c.type}
              onClick={() => setActiveType(c.type)}
              label={`${c.icon} ${c.shortName} (${count})`}
              color={c.color}
            />
          );
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>{filtered.length} tuyến khớp</p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Không tìm thấy.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <RoadCard key={r.id} road={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {selected && <RoadModal road={selected} onClose={() => setSelected(null)} />}
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

function RoadCard({ road, onClick }: { road: Road; onClick: () => void }) {
  const cfg = ROAD_TYPE_CONFIGS[road.type];
  const status = STATUS_LABELS[road.status];
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
        <span className="text-xl shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="font-mono text-[10px] font-bold px-1.5 h-4 rounded inline-flex items-center"
              style={{ background: cfg.color + '22', color: cfg.color }}
            >
              {road.code}
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
          <h3 className="text-sm font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {road.name}
          </h3>
        </div>
      </header>

      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {road.start_point} → {road.end_point}
      </p>

      <div className="grid grid-cols-3 gap-2 text-xs mt-auto" style={{ color: 'var(--color-text-secondary)' }}>
        <Stat label="Dài" value={`${road.length_km} km`} />
        <Stat label="Làn" value={`${road.lanes} ×2`} />
        <Stat label="V max" value={road.speed_limit ? `${road.speed_limit}` : '—'} />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-1.5 py-1 text-center" style={{ background: 'var(--color-surface-bg_elevated)' }}>
      <div className="text-[9px] uppercase tracking-wider" style={{ opacity: 0.7 }}>{label}</div>
      <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}

function RoadModal({ road, onClose }: { road: Road; onClose: () => void }) {
  const cfg = ROAD_TYPE_CONFIGS[road.type];
  const status = STATUS_LABELS[road.status];
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
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{cfg.icon}</span>
            <span
              className="font-mono text-xs font-bold px-2 h-5 rounded inline-flex items-center"
              style={{ background: cfg.color + '22', color: cfg.color }}
            >
              {road.code}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 h-5 rounded inline-flex items-center"
              style={{ background: status.color + '22', color: status.color }}
            >
              {status.label}
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{road.name}</h2>
          <p className="text-sm mb-4 inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <MapPin size={13} /> {road.start_point} → {road.end_point}
          </p>

          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {road.description}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <ModalStat label="Chiều dài" value={`${road.length_km} km`} />
            <ModalStat label="Số làn" value={`${road.lanes} làn × 2 chiều`} />
            {road.speed_limit && <ModalStat label="Tốc độ tối đa" value={`${road.speed_limit} km/h`} />}
            {road.load_class && <ModalStat label="Tải trọng" value={road.load_class} />}
            {road.year_completed && <ModalStat label="Năm hoàn thành" value={String(road.year_completed)} />}
            {road.budget_billion_vnd && <ModalStat label="Tổng đầu tư" value={`${road.budget_billion_vnd.toLocaleString('vi-VN')} tỷ`} />}
            <ModalStat label="Phí cầu đường" value={road.toll ? '✓ Có thu phí' : '✗ Không thu'} />
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Đi qua tỉnh / thành
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {road.provinces.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center px-2 h-6 rounded text-xs"
                  style={{ background: 'var(--color-surface-bg_elevated)', color: 'var(--color-text-primary)' }}
                >
                  📍 {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md p-3"
      style={{ background: 'var(--color-surface-bg_elevated)' }}
    >
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
