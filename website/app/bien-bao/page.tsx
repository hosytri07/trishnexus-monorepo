'use client';

/**
 * /bien-bao — Phase 19.7 — Database biển báo QC41:2024.
 *
 * Listing page với:
 *   - Filter group chip (7 nhóm + "Tất cả")
 *   - Search box (tìm theo mã + tên + ý nghĩa)
 *   - Card grid 3 cột (each: code badge + name + group color + meaning preview)
 *   - Click card → modal detail: full meaning + scope + penalty
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Signpost, X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  type TrafficSign,
  SIGN_GROUP_CONFIGS,
  fetchAllSigns,
} from '@/data/traffic-signs';
import { CloudinaryImage } from '@/components/cloudinary-image';
import { ImageLightbox } from '@/components/image-lightbox';
import { buildImageUrl } from '@/lib/cloudinary';

export default function BienBaoPage() {
  const [allSigns, setAllSigns] = useState<TrafficSign[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TrafficSign | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Phase 19.18.3 — fetch full QC41 từ /public/qc41-signs.json
  useEffect(() => {
    fetchAllSigns()
      .then(setAllSigns)
      .catch((err) => setLoadError(err.message ?? 'Lỗi load'));
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'sign_images'),
      (snap) => {
        const map: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const cid = d.data()?.cloudinary_id as string | undefined;
          if (cid) map[d.id] = cid;
        });
        setOverrides(map);
      },
      (err) => console.warn('[bien-bao] sign_images subscribe fail', err),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allSigns ?? []).filter((s) => {
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.meaning ?? '').toLowerCase().includes(q)
      );
    });
  }, [search, allSigns]);

  const groups = Object.values(SIGN_GROUP_CONFIGS);

  if (loadError) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-base mb-4" style={{ color: '#EF4444' }}>⚠ Lỗi load: {loadError}</p>
        <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--color-accent-primary)' }}>Về Dashboard</Link>
      </main>
    );
  }
  if (!allSigns) {
    return (
      <main className="max-w-md mx-auto px-6 py-16 text-center">
        <p style={{ color: 'var(--color-text-muted)' }}>⏳ Đang tải database 451 biển báo...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Signpost size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Biển báo giao thông
          </h1>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
          >
            QCVN 41:2024
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Database {(allSigns?.length ?? 0)} biển báo (sample) — bộ đầy đủ 500+ biển sẽ
          được nhập sau. Click 1 biển để xem ý nghĩa, hiệu lực, chế tài chi tiết.
        </p>
      </header>

      {/* Search */}
      <div
        className="relative mb-4"
      >
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã (P.101) hoặc tên..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Quick nav jump - 7 nhóm */}
      <nav className="flex flex-wrap gap-2 mb-6 sticky top-0 z-10 py-2" style={{ background: 'var(--color-surface-bg, transparent)' }}>
        {groups.map((g) => {
          const count = (allSigns ?? []).filter((s) => s.group === g.group).length;
          return (
            <a
              key={g.group}
              href={`#${g.group}`}
              className="inline-flex items-center px-3 h-7 rounded-full text-xs font-semibold transition-all hover:opacity-80"
              style={{
                background: g.color + '14',
                color: g.color,
                border: `1px solid ${g.color}33`,
              }}
            >
              {g.shortName} <span className="ml-1.5 opacity-70">({count})</span>
            </a>
          );
        })}
      </nav>

      {/* Result count khi search */}
      {search.trim() && (
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {filtered.length} biển khớp "{search}"
        </p>
      )}

      {/* Section riêng cho từng nhóm */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Không tìm thấy biển nào khớp.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => {
            const groupSigns = filtered.filter((s) => s.group === g.group);
            if (groupSigns.length === 0) return null;
            return (
              <section key={g.group} id={g.group} className="scroll-mt-4">
                <header
                  className="flex items-baseline gap-3 mb-4 pb-3 border-b-2"
                  style={{ borderColor: g.color }}
                >
                  <h2
                    className="text-2xl md:text-3xl font-bold"
                    style={{ color: g.color }}
                  >
                    {g.name}
                  </h2>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {groupSigns.length} biển · {g.shape}
                  </span>
                </header>
                <p
                  className="text-sm mb-4"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {g.description}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupSigns.map((sign) => (
                    <SignCard
                      key={sign.code}
                      sign={sign}
                      cloudinaryId={overrides[sign.code]}
                      onClick={() => setSelected(sign)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <SignDetailModal
          sign={selected}
          cloudinaryId={overrides[selected.code]}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function SignCard({
  sign,
  cloudinaryId,
  onClick,
}: {
  sign: TrafficSign;
  cloudinaryId?: string;
  onClick: () => void;
}) {
  const cfg = SIGN_GROUP_CONFIGS[sign.group];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left flex flex-col p-4 rounded-lg border transition-all hover:scale-[1.01]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }}
    >
      {cloudinaryId ? (
        <CloudinaryImage
          publicId={cloudinaryId}
          preset="sign-thumb"
          alt={sign.name}
          className="w-16 h-16 object-contain mb-2 self-center"
          loading="lazy"
        />
      ) : sign.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sign.image_url}
          alt={sign.name}
          className="w-16 h-16 object-contain mb-2 self-center"
          loading="lazy"
        />
      ) : null}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: cfg.color + '22', color: cfg.color }}
        >
          {sign.code}
        </span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          {cfg.shortName}
        </span>
      </div>
      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
        {sign.name}
      </h3>
      <p className="text-xs line-clamp-3" style={{ color: 'var(--color-text-secondary)' }}>
        {sign.meaning ?? ''}
      </p>
    </button>
  );
}

function SignDetailModal({
  sign,
  cloudinaryId,
  onClose,
}: {
  sign: TrafficSign;
  cloudinaryId?: string;
  onClose: () => void;
}) {
  const cfg = SIGN_GROUP_CONFIGS[sign.group];
  const heroSrc = cloudinaryId
    ? buildImageUrl(cloudinaryId, 'sign-detail')
    : sign.image_url ?? null;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-lg w-full rounded-xl border p-6 max-h-[85vh] overflow-y-auto"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
          aria-label="Đóng"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-mono text-xs font-bold px-2 py-1 rounded"
            style={{ background: cfg.color + '22', color: cfg.color }}
          >
            {sign.code}
          </span>
          <span
            className="inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ background: cfg.color + '22', color: cfg.color }}
          >
            {cfg.shortName}
          </span>
        </div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          {sign.name}
        </h2>

        {heroSrc && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="w-full flex justify-center mb-4 p-4 rounded-lg transition-transform hover:scale-[1.02] cursor-zoom-in"
            style={{ background: 'var(--color-surface-bg_elevated)' }}
            title="Click để phóng to"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroSrc}
              alt={sign.name}
              className="max-h-48 w-auto object-contain"
            />
          </button>
        )}

        <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
          <Section label="Ý nghĩa" content={sign.meaning ?? ''} />
          {sign.scope && <Section label="Hiệu lực" content={sign.scope} />}
          {sign.penalty && (
            <Section
              label="Chế tài vi phạm"
              content={sign.penalty}
              accent="#EF4444"
            />
          )}
        </div>

        <div
          className="mt-5 pt-3 border-t text-xs"
          style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
        >
          <strong style={{ color: cfg.color }}>{cfg.name}</strong> · {cfg.shape}
          <br />
          {cfg.description}
        </div>
      </div>

      {heroSrc && (
        <ImageLightbox
          images={[{ src: heroSrc, alt: sign.name, caption: `${sign.code} · ${sign.name}` }]}
          initialIndex={0}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function Section({ label, content, accent }: { label: string; content: string; accent?: string }) {
  return (
    <div>
      <div
        className="text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: accent ?? 'var(--color-text-muted)' }}
      >
        {label}
      </div>
      <p className="leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
        {content}
      </p>
    </div>
  );
}
