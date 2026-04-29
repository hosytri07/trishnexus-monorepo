'use client';

/**
 * /admin/bridges — Phase 19.13 — Admin upload ảnh cầu Việt Nam.
 *
 * Pattern giống /admin/signs nhưng data là (allBridges ?? []) + collection
 * Firestore là `bridge_images/{id}`.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Search, Trash2, Waypoints } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/lib/auth-context';
import {
  type BridgeStructure,
  type VietnamBridge,
  STRUCTURE_CONFIGS,
  fetchAllBridges,
  formatLength,
} from '@/data/bridges-vn';
import { CloudinaryUploader } from '@/components/cloudinary-uploader';
import { CloudinaryImage } from '@/components/cloudinary-image';

interface BridgeImageDoc {
  cloudinary_id: string;
  uploaded_at: number;
  uploader_uid: string;
}

export default function AdminBridgesPage() {
  const { user } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [allBridges, setAllBridges] = useState<VietnamBridge[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, BridgeImageDoc>>({});
  const [activeStructure, setActiveStructure] = useState<BridgeStructure | 'all'>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  // Phase 19.18 — fetch full DB từ /public/bridges-vn.json
  useEffect(() => {
    fetchAllBridges()
      .then(setAllBridges)
      .catch((err) => console.warn('[admin/bridges] fetch fail', err));
  }, []);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'bridge_images'),
      (snap) => {
        const map: Record<string, BridgeImageDoc> = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data?.cloudinary_id) {
            map[d.id] = {
              cloudinary_id: data.cloudinary_id as string,
              uploaded_at: (data.uploaded_at as number) ?? 0,
              uploader_uid: (data.uploader_uid as string) ?? '',
            };
          }
        });
        setOverrides(map);
      },
      (err) => console.warn('[admin/bridges] subscribe fail', err),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allBridges ?? []).filter((b) => {
      if (activeStructure !== 'all' && b.structure !== activeStructure) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.province.toLowerCase().includes(q) ||
        b.road.toLowerCase().includes(q)
      );
    });
  }, [allBridges, activeStructure, search]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  
  // Reset page khi filter đổi
  useEffect(() => { setPage(0); }, [activeStructure, search]);

  async function handleUpload(bridge: VietnamBridge, publicId: string) {
    if (!db || !user) return;
    try {
      await setDoc(doc(db, 'bridge_images', bridge.id), {
        cloudinary_id: publicId,
        uploaded_at: Date.now(),
        uploader_uid: user.id,
        _server_uploaded_at: serverTimestamp(),
      });
      showMsg(`✓ Upload thành công cho ${bridge.name}`);
    } catch (err) {
      showMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function handleRemove(bridge: VietnamBridge) {
    if (!db) return;
    const __ok = await askConfirm({
      title: 'Xác nhận',
      message: 'Xoá ảnh override của ${bridge.name}?',
      okLabel: 'Đồng ý',
    });
    if (!__ok) return;
    try {
      await deleteDoc(doc(db, 'bridge_images', bridge.id));
      showMsg(`✓ Đã xoá override ${bridge.name}`);
    } catch (err) {
      showMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    }
  }

  function showMsg(m: string) {
    setActionMsg(m);
    setTimeout(() => setActionMsg(null), 3500);
  }

  const structures = Object.values(STRUCTURE_CONFIGS);
  const overrideCount = Object.keys(overrides).length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <ConfirmDialog />
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Admin Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Waypoints size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Quản lý ảnh cầu Việt Nam
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          {(allBridges?.length ?? 0)} cầu trong database · {overrideCount} đã có ảnh ·
          Còn lại {(allBridges?.length ?? 0) - overrideCount} đợi upload
        </p>
      </header>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-muted)' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên cầu, tỉnh, sông..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip
          active={activeStructure === 'all'}
          onClick={() => setActiveStructure('all')}
          label={`Tất cả (${(allBridges?.length ?? 0)})`}
          color="#9CA3AF"
        />
        {structures.map((s) => {
          const count = (allBridges ?? []).filter((b) => b.structure === s.structure).length;
          if (count === 0) return null;
          return (
            <FilterChip
              key={s.structure}
              active={activeStructure === s.structure}
              onClick={() => setActiveStructure(s.structure)}
              label={`${s.shortName} (${count})`}
              color={s.color}
            />
          );
        })}
      </div>

      {actionMsg && (
        <div
          className="mb-4 px-3 py-2 rounded text-sm"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-primary)',
            border: '1px solid var(--color-accent-primary)',
          }}
        >
          {actionMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {pageItems.map((b) => (
          <BridgeAdminRow
            key={b.id}
            bridge={b}
            override={overrides[b.id]}
            onUpload={(pid) => handleUpload(b, pid)}
            onRemove={() => handleRemove(b)}
          />
        ))}
      </div>
    </main>
  );
}

function BridgeAdminRow({
  bridge,
  override,
  onUpload,
  onRemove,
}: {
  bridge: VietnamBridge;
  override?: BridgeImageDoc;
  onUpload: (publicId: string) => void;
  onRemove: () => void;
}) {
  const cfg = STRUCTURE_CONFIGS[bridge.structure];
  const hasCloudinary = Boolean(override?.cloudinary_id);
  const hasStatic = false;

  return (
    <article
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: cfg.color,
      }}
    >
      <header className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3
            className="text-base font-bold leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {bridge.name}
          </h3>
          <p
            className="text-xs mt-0.5 inline-flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <MapPin size={11} /> {bridge.province} · {formatLength(bridge.length_m)}
          </p>
        </div>
        <StatusBadge hasCloudinary={hasCloudinary} hasStatic={hasStatic} />
      </header>

      <div
        className="flex items-center justify-center h-32 rounded overflow-hidden"
        style={{ background: 'var(--color-surface-bg_elevated)' }}
      >
        {hasCloudinary ? (
          <CloudinaryImage
            publicId={override!.cloudinary_id}
            preset="bridge-card"
            alt={bridge.name}
            className="w-full h-full object-cover"
          />
        ) : hasStatic ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={undefined} alt={bridge.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            (Chưa có ảnh)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <CloudinaryUploader
          folder="bridge"
          publicId={bridge.id}
          tags={`bridge,${bridge.structure}`}
          onUpload={(r) => onUpload(r.publicId)}
          maxSizeMB={10}
        >
          <span
            className="inline-flex items-center gap-1 px-2.5 h-8 rounded text-xs font-semibold cursor-pointer"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-primary)',
              border: '1px solid var(--color-accent-primary)',
            }}
          >
            {hasCloudinary ? 'Đổi ảnh' : 'Upload'}
          </span>
        </CloudinaryUploader>
        {hasCloudinary && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-[rgba(239,68,68,0.1)]"
            title="Xoá override"
            style={{ color: '#EF4444' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </article>
  );
}

function StatusBadge({
  hasCloudinary,
  hasStatic,
}: {
  hasCloudinary: boolean;
  hasStatic: boolean;
}) {
  if (hasCloudinary) {
    return (
      <span
        className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(16,185,129,0.18)', color: '#10B981' }}
      >
        Cloudinary
      </span>
    );
  }
  if (hasStatic) {
    return (
      <span
        className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(59,130,246,0.18)', color: '#3B82F6' }}
      >
        Static
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ background: 'rgba(244,114,49,0.18)', color: '#F47231' }}
    >
      Trống
    </span>
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
