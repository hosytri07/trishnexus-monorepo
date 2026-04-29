'use client';

/**
 * /admin/signs — Phase 19.13 — Admin upload ảnh biển báo.
 *
 * Hiển thị 32 biển báo từ data/traffic-signs.ts. Mỗi biển có:
 *   - Code badge + name + group
 *   - Preview ảnh hiện tại (Cloudinary nếu có > /public SVG nếu có > placeholder)
 *   - Nút "Upload" → CloudinaryUploader → lưu publicId vào sign_images/{code}
 *   - Nút "Xoá ảnh" để xoá override Firestore (về fallback)
 *
 * Search + filter giống /bien-bao.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Signpost, Trash2, X } from 'lucide-react';
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
  type SignGroup,
  type TrafficSign,
  SIGN_GROUP_CONFIGS,
  fetchAllSigns,
} from '@/data/traffic-signs';
import { CloudinaryUploader } from '@/components/cloudinary-uploader';
import { CloudinaryImage } from '@/components/cloudinary-image';

interface SignImageDoc {
  cloudinary_id: string;
  uploaded_at: number;
  uploader_uid: string;
}

export default function AdminSignsPage() {
  const { user } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [allSigns, setAllSigns] = useState<TrafficSign[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, SignImageDoc>>({});
  const [activeGroup, setActiveGroup] = useState<SignGroup | 'all'>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 60;

  useEffect(() => {
    fetchAllSigns().then(setAllSigns).catch((err) => console.warn('[admin/signs] fetch fail', err));
  }, []);

  // Subscribe sign_images collection
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'sign_images'),
      (snap) => {
        const map: Record<string, SignImageDoc> = {};
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
      (err) => console.warn('[admin/signs] subscribe fail', err),
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allSigns ?? []).filter((s) => {
      if (activeGroup !== 'all' && s.group !== activeGroup) return false;
      if (!q) return true;
      return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    });
  }, [activeGroup, search, allSigns]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { setPage(0); }, [activeGroup, search]);

  async function handleUpload(sign: TrafficSign, publicId: string) {
    if (!db || !user) return;
    try {
      await setDoc(doc(db, 'sign_images', sign.code), {
        cloudinary_id: publicId,
        uploaded_at: Date.now(),
        uploader_uid: user.id,
        _server_uploaded_at: serverTimestamp(),
      });
      showMsg(`✓ Upload thành công cho ${sign.code}`);
    } catch (err) {
      showMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function handleRemove(sign: TrafficSign) {
    if (!db) return;
    const __ok = await askConfirm({
      title: 'Xác nhận',
      message: 'Xoá ảnh override của ${sign.code}? (về fallback SVG/placeholder)',
      okLabel: 'Đồng ý',
    });
    if (!__ok) return;
    try {
      await deleteDoc(doc(db, 'sign_images', sign.code));
      showMsg(`✓ Đã xoá override ${sign.code}`);
    } catch (err) {
      showMsg(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`);
    }
  }

  function showMsg(m: string) {
    setActionMsg(m);
    setTimeout(() => setActionMsg(null), 3500);
  }

  const groups = Object.values(SIGN_GROUP_CONFIGS);
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
          <Signpost size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Quản lý ảnh biển báo
          </h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          {(allSigns?.length ?? 0)} biển có trong database · {overrideCount} đã có ảnh
          Cloudinary · Còn lại {(allSigns?.length ?? 0) - overrideCount} đợi upload
        </p>
      </header>

      {/* Search */}
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
          placeholder="Tìm theo mã hoặc tên..."
          className="w-full h-10 pl-10 pr-4 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Group chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip
          active={activeGroup === 'all'}
          onClick={() => setActiveGroup('all')}
          label={`Tất cả (${(allSigns?.length ?? 0)})`}
          color="#9CA3AF"
        />
        {groups.map((g) => {
          const count = (allSigns ?? []).filter((s) => s.group === g.group).length;
          return (
            <FilterChip
              key={g.group}
              active={activeGroup === g.group}
              onClick={() => setActiveGroup(g.group)}
              label={`${g.shortName} (${count})`}
              color={g.color}
            />
          );
        })}
      </div>

      {/* Toast */}
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pageItems.map((s) => (
          <SignAdminRow
            key={s.code}
            sign={s}
            override={overrides[s.code]}
            onUpload={(pid) => handleUpload(s, pid)}
            onRemove={() => handleRemove(s)}
          />
        ))}
      </div>
    </main>
  );
}

function SignAdminRow({
  sign,
  override,
  onUpload,
  onRemove,
}: {
  sign: TrafficSign;
  override?: SignImageDoc;
  onUpload: (publicId: string) => void;
  onRemove: () => void;
}) {
  const cfg = SIGN_GROUP_CONFIGS[sign.group];
  const hasCloudinary = Boolean(override?.cloudinary_id);
  const hasStaticSvg = Boolean(sign.image_url);

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
          <span
            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: cfg.color + '22', color: cfg.color }}
          >
            {sign.code}
          </span>
          <h3
            className="text-sm font-bold mt-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {sign.name}
          </h3>
        </div>
        <StatusBadge hasCloudinary={hasCloudinary} hasStaticSvg={hasStaticSvg} />
      </header>

      {/* Preview */}
      <div
        className="flex items-center justify-center h-28 rounded"
        style={{ background: 'var(--color-surface-bg_elevated)' }}
      >
        {hasCloudinary ? (
          <CloudinaryImage
            publicId={override!.cloudinary_id}
            preset="sign-thumb"
            alt={sign.name}
            className="max-h-24 w-auto object-contain"
          />
        ) : hasStaticSvg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={sign.image_url} alt={sign.name} className="max-h-24 w-auto object-contain" />
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            (Chưa có ảnh)
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <CloudinaryUploader
          folder="sign"
          publicId={sign.code.replace(/\./g, '-').toLowerCase()}
          tags={`sign,${sign.group}`}
          onUpload={(r) => onUpload(r.publicId)}
          maxSizeMB={5}
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
  hasStaticSvg,
}: {
  hasCloudinary: boolean;
  hasStaticSvg: boolean;
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
  if (hasStaticSvg) {
    return (
      <span
        className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold uppercase tracking-wider"
        style={{ background: 'rgba(59,130,246,0.18)', color: '#3B82F6' }}
      >
        SVG
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
