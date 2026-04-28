'use client';

/**
 * /cau-vn — Phase 19.18 — Database 7,549 cầu Việt Nam.
 *
 * Lazy load /public/bridges-vn.json (1.8 MB) khi mount.
 * Pagination 50 cầu/page (vì 7549 quá nhiều render 1 lần).
 * Filter: structure + province + search.
 * Sort: length / span_count / year.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  Map,
  Waypoints,
  X,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  type BridgeStructure,
  type VietnamBridge,
  STRUCTURE_CONFIGS,
  fetchAllBridges,
  formatLength,
} from '@/data/bridges-vn';
import { CloudinaryImage } from '@/components/cloudinary-image';
import { ImageLightbox } from '@/components/image-lightbox';
import { CauMap } from '@/components/cau-map';
import { buildImageUrl } from '@/lib/cloudinary';

type SortBy = 'length' | 'span' | 'year';

const PAGE_SIZE = 50;

export default function CauVNPage() {
  const [allBridges, setAllBridges] = useState<VietnamBridge[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeStructure, setActiveStructure] = useState<BridgeStructure | 'all'>('all');
  const [activeProvince, setActiveProvince] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('length');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<VietnamBridge | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Fetch all bridges
  useEffect(() => {
    fetchAllBridges()
      .then(setAllBridges)
      .catch((err) => setLoadError(err.message ?? 'Lỗi load'));
  }, []);

  // Subscribe Cloudinary overrides
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'bridge_images'),
      (snap) => {
        const map: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const cid = d.data()?.cloudinary_id as string | undefined;
          if (cid) map[d.id] = cid;
        });
        setOverrides(map);
      },
      (err) => console.warn('[cau-vn] overrides subscribe fail', err),
    );
    return () => unsub();
  }, []);

  // Build province list
  const provinces = useMemo(() => {
    if (!allBridges) return [];
    const set = new Set(allBridges.map((b) => b.province));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allBridges]);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!allBridges) return [];
    const q = search.trim().toLowerCase();
    let list = allBridges.filter((b) => {
      if (activeStructure !== 'all' && b.structure !== activeStructure) return false;
      if (activeProvince !== 'all' && b.province !== activeProvince) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.province.toLowerCase().includes(q) ||
        b.road.toLowerCase().includes(q) ||
        b.ly_trinh.toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'length') return b.length_m - a.length_m;
      if (sortBy === 'span') return (b.span_count ?? 0) - (a.span_count ?? 0);
      if (sortBy === 'year') return (b.year_built ?? 0) - (a.year_built ?? 0);
      return 0;
    });
    return list;
  }, [allBridges, activeStructure, activeProvince, search, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [activeStructure, activeProvince, search, sortBy]);

  const structures = Object.values(STRUCTURE_CONFIGS);

  if (loadError) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-base mb-4" style={{ color: '#EF4444' }}>
          ⚠ Lỗi load database: {loadError}
        </p>
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--color-accent-primary)' }}>
          Về Dashboard
        </Link>
      </main>
    );
  }

  if (!allBridges) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-accent-primary)' }} />
        <p style={{ color: 'var(--color-text-muted)' }}>Đang tải database 7,549 cầu... (~1.8 MB)</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Waypoints size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Cầu Việt Nam
          </h1>
          <span
            className="ml-2 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            {allBridges.length.toLocaleString('vi-VN')} cầu
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Database cầu Việt Nam — nguồn Cục Quản lý Đường bộ + dữ liệu công khai. Filter theo
          tỉnh, kết cấu, sort theo chiều dài / năm xây.
        </p>
      </header>

      {/* Search + Province + Sort */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 mb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên cầu, đường, lý trình..."
            className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        <select
          value={activeProvince}
          onChange={(e) => setActiveProvince(e.target.value)}
          className="h-10 px-3 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="all">Tất cả tỉnh ({provinces.length})</option>
          {provinces.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <div
          className="flex items-center gap-1 px-1 rounded-md border"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <ArrowDown size={13} style={{ color: 'var(--color-text-muted)' }} className="ml-2" />
          <SortBtn active={sortBy === 'length'} onClick={() => setSortBy('length')} label="Dài" />
          <SortBtn active={sortBy === 'span'} onClick={() => setSortBy('span')} label="Nhịp" />
          <SortBtn active={sortBy === 'year'} onClick={() => setSortBy('year')} label="Năm" />
        </div>
      </div>

      {/* Structure chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <FilterChip
          active={activeStructure === 'all'}
          onClick={() => setActiveStructure('all')}
          label={`Tất cả (${allBridges.length.toLocaleString('vi-VN')})`}
          color="#9CA3AF"
        />
        {structures.map((s) => {
          const count = allBridges.filter((b) => b.structure === s.structure).length;
          if (count === 0) return null;
          return (
            <FilterChip
              key={s.structure}
              active={activeStructure === s.structure}
              onClick={() => setActiveStructure(s.structure)}
              label={`${s.shortName} (${count.toLocaleString('vi-VN')})`}
              color={s.color}
            />
          );
        })}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length.toLocaleString('vi-VN')} cầu khớp{viewMode === 'list' ? ` · Trang ${page + 1}/${Math.max(1, totalPages)}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 rounded-md border" style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1 px-3 h-8 rounded text-xs font-semibold transition-colors"
              style={{
                background: viewMode === 'list' ? 'var(--color-accent-soft)' : 'transparent',
                color: viewMode === 'list' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className="inline-flex items-center gap-1 px-3 h-8 rounded text-xs font-semibold transition-colors"
              style={{
                background: viewMode === 'map' ? 'var(--color-accent-soft)' : 'transparent',
                color: viewMode === 'map' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
              }}
            >
              <Map size={11} /> Bản đồ
            </button>
          </div>
        </div>
      </div>

      {/* Pagination — chỉ list view */}
      {viewMode === 'list' && totalPages > 1 && (
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-1">
          <PageBtn disabled={page === 0} onClick={() => setPage(0)}>‹‹</PageBtn>
          <PageBtn disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={14} />
          </PageBtn>
          <span className="text-xs px-2" style={{ color: 'var(--color-text-secondary)' }}>
            {page + 1} / {totalPages}
          </span>
          <PageBtn disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight size={14} />
          </PageBtn>
          <PageBtn disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>››</PageBtn>
        </div>
      </div>
      )}

      {/* Content: List or Map */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>Không tìm thấy cầu nào khớp.</p>
        </div>
      ) : viewMode === 'map' ? (
        <CauMap bridges={filtered} onSelect={setSelected} />
      ) : (
        <div className="space-y-1.5">
          {pageItems.map((b) => (
            <BridgeRow key={b.id} bridge={b} cloudinaryId={overrides[b.id]} onClick={() => setSelected(b)} />
          ))}
        </div>
      )}

      {selected && (
        <BridgeDetailModal
          bridge={selected}
          cloudinaryId={overrides[selected.id]}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded text-xs font-semibold disabled:opacity-30"
      style={{
        background: 'var(--color-surface-card)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      {children}
    </button>
  );
}

function SortBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-2.5 h-8 rounded text-xs font-semibold transition-colors"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
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

function BridgeRow({
  bridge,
  cloudinaryId,
  onClick,
}: {
  bridge: VietnamBridge;
  cloudinaryId?: string;
  onClick: () => void;
}) {
  const cfg = STRUCTURE_CONFIGS[bridge.structure];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.005]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {bridge.name}
          </h3>
          <span
            className="text-[9px] uppercase tracking-wider font-bold px-1.5 h-4 rounded inline-flex items-center shrink-0"
            style={{ background: cfg.color + '22', color: cfg.color }}
          >
            {cfg.shortName}
          </span>
        </div>
        <p
          className="text-xs mt-0.5 inline-flex items-center gap-2 flex-wrap"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span className="inline-flex items-center gap-1"><MapPin size={10} /> {bridge.province}</span>
          {bridge.road && <span aria-hidden>·</span>}
          {bridge.road && <span>{bridge.road}</span>}
          {bridge.ly_trinh && <span aria-hidden>·</span>}
          {bridge.ly_trinh && <span className="font-mono">Km {bridge.ly_trinh}</span>}
        </p>
      </div>
      <div
        className="shrink-0 text-right text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <div className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {formatLength(bridge.length_m)}
        </div>
        {bridge.year_built && <div>{bridge.year_built}</div>}
      </div>
    </button>
  );
}

function BridgeDetailModal({
  bridge,
  cloudinaryId,
  onClose,
}: {
  bridge: VietnamBridge;
  cloudinaryId?: string;
  onClose: () => void;
}) {
  const cfg = STRUCTURE_CONFIGS[bridge.structure];
  const heroSrc = cloudinaryId ? buildImageUrl(cloudinaryId, 'bridge-hero') : null;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-xl w-full rounded-xl border max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: cfg.color,
          borderWidth: 2,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-[var(--color-surface-muted)]"
          aria-label="Đóng"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <div className="p-6">
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ background: cfg.color + '22', color: cfg.color }}
          >
            {cfg.name}
          </span>
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {bridge.name}
          </h2>
          <p className="text-sm mb-4 inline-flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
            <MapPin size={13} /> {bridge.province}
          </p>

          {heroSrc && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full rounded-lg overflow-hidden mb-4 cursor-zoom-in transition-transform hover:scale-[1.005]"
              style={{ border: '1px solid var(--color-border-subtle)' }}
              title="Click để phóng to"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroSrc} alt={bridge.name} className="w-full h-auto" loading="lazy" />
            </button>
          )}

          <div className="space-y-2.5 text-sm" style={{ color: 'var(--color-text-primary)' }}>
            {bridge.road && <Row label="Tuyến đường" value={bridge.road} />}
            {bridge.ly_trinh && <Row label="Lý trình" value={`Km ${bridge.ly_trinh}`} />}
            <Row label="Tổng chiều dài" value={formatLength(bridge.length_m)} />
            {bridge.width_m && <Row label="Mặt cắt ngang" value={`${bridge.width_m} m`} />}
            {bridge.span_count && <Row label="Số nhịp" value={`${bridge.span_count}`} />}
            {bridge.structure_raw && <Row label="Kết cấu chi tiết" value={bridge.structure_raw} />}
            {bridge.load_class && <Row label="Tải trọng thiết kế" value={bridge.load_class.toUpperCase()} />}
            {bridge.manager && <Row label="Đơn vị quản lý" value={bridge.manager} />}
            {bridge.condition && <Row label="Tình trạng" value={bridge.condition} />}
            {bridge.year_built && <Row label="Năm xây dựng" value={String(bridge.year_built)} />}
          </div>

          {bridge.source && (
            <p className="mt-4 pt-3 border-t text-[10px]" style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
              Nguồn: {bridge.source}
            </p>
          )}
        </div>
      </div>

      {heroSrc && (
        <ImageLightbox
          images={[{ src: heroSrc, alt: bridge.name, caption: `${bridge.name} · ${bridge.province}` }]}
          initialIndex={0}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-start justify-between gap-3 pb-2 border-b"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span className="text-right font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  );
}
