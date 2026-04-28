'use client';

/**
 * /thu-vien — Phase 19.3 (Đợt 4A) — Library web mirror.
 *
 * Đồng bộ với module Thư viện trong TrishLibrary 3.0 desktop:
 *   - Cá nhân: subscribe `users/{uid}/trishlibrary/online_folders` (private, per-user)
 *   - TrishTEAM: subscribe `trishteam_library/{folderId}` + subcoll `links/`
 *     (curated bởi admin qua TrishAdmin desktop)
 *
 * Web là READ-ONLY. Sửa cá nhân thì mở TrishLibrary 3.0 trên Windows.
 *
 * Auth gate:
 *   - Guest → prompt login
 *   - Trial → vẫn xem được (rules cho phép signedIn read, không cần paid)
 *   - User/Admin → full
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Cloud,
  ExternalLink,
  Folder,
  Library,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { TrialBlockedScreen } from '@/components/trial-blocked-screen';

// ============================================================
// Types — mirror với desktop
// ============================================================
interface OnlineLink {
  id: string;
  url: string;
  title: string;
  description: string;
  qr_data_url?: string;
  created_at: number;
  updated_at: number;
}

interface OnlineFolder {
  id: string;
  name: string;
  icon: string;
  links: OnlineLink[];
  created_at: number;
  updated_at: number;
}

/** Folder admin-curated trong /trishteam_library */
interface TrishTeamFolder {
  id: string;
  name: string;
  description?: string;
  icon: string;
  sort_order?: number;
  links: TrishTeamLink[];
}

interface TrishTeamLink {
  id: string;
  url: string;
  title: string;
  description?: string;
  icon?: string;
  link_type?: string;
  sort_order?: number;
}

// ============================================================
// Page
// ============================================================
export default function ThuVienPage() {
  const { user, isAuthenticated, loading, isPaid } = useAuth();
  const [personal, setPersonal] = useState<OnlineFolder[] | null>(null);
  const [team, setTeam] = useState<TrishTeamFolder[] | null>(null);
  const [tab, setTab] = useState<'team' | 'personal'>('team');

  // Subscribe personal online_folders
  useEffect(() => {
    if (!firebaseReady || !db || !user?.id) {
      setPersonal([]);
      return;
    }
    const ref = doc(db, `users/${user.id}/trishlibrary/online_folders`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setPersonal([]);
          return;
        }
        const data = snap.data();
        const items = Array.isArray(data?.items) ? (data.items as OnlineFolder[]) : [];
        setPersonal(items);
      },
      (err) => {
        console.warn('[thu-vien] personal subscribe fail', err);
        setPersonal([]);
      },
    );
    return () => unsub();
  }, [user?.id]);

  // Subscribe trishteam_library top-level + per-folder links
  useEffect(() => {
    if (!firebaseReady || !db || !isAuthenticated) {
      setTeam([]);
      return;
    }
    const folderQuery = query(
      collection(db, 'trishteam_library'),
      orderBy('sort_order', 'asc'),
    );

    const linkUnsubs = new Map<string, Unsubscribe>();

    const unsubTop = onSnapshot(
      folderQuery,
      (folderSnap) => {
        const folders: TrishTeamFolder[] = folderSnap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            name: (raw.name as string) ?? d.id,
            description: raw.description as string | undefined,
            icon: (raw.icon as string) ?? '📁',
            sort_order: (raw.sort_order as number) ?? 0,
            links: [], // populate below
          };
        });
        setTeam(folders);

        // Cleanup link subs no longer valid
        const validIds = new Set(folders.map((f) => f.id));
        for (const [fid, unsub] of linkUnsubs) {
          if (!validIds.has(fid)) {
            unsub();
            linkUnsubs.delete(fid);
          }
        }

        // Subscribe links per folder
        folders.forEach((folder) => {
          if (linkUnsubs.has(folder.id)) return;
          const linkQ = query(
            collection(db!, `trishteam_library/${folder.id}/links`),
            orderBy('sort_order', 'asc'),
          );
          const linkUnsub = onSnapshot(
            linkQ,
            (linkSnap) => {
              const links: TrishTeamLink[] = linkSnap.docs.map((ld) => {
                const lr = ld.data();
                return {
                  id: ld.id,
                  url: (lr.url as string) ?? '#',
                  title: (lr.title as string) ?? 'Untitled',
                  description: lr.description as string | undefined,
                  icon: lr.icon as string | undefined,
                  link_type: lr.link_type as string | undefined,
                  sort_order: (lr.sort_order as number) ?? 0,
                };
              });
              setTeam((prev) =>
                (prev ?? []).map((f) =>
                  f.id === folder.id ? { ...f, links } : f,
                ),
              );
            },
            (err) =>
              console.warn(`[thu-vien] links/${folder.id} subscribe fail`, err),
          );
          linkUnsubs.set(folder.id, linkUnsub);
        });
      },
      (err) => {
        console.warn('[thu-vien] team subscribe fail', err);
        setTeam([]);
      },
    );

    return () => {
      unsubTop();
      for (const unsub of linkUnsubs.values()) unsub();
    };
  }, [isAuthenticated]);

  // Total counts (memoized)
  const teamCount = useMemo(
    () =>
      (team ?? []).reduce((sum, f) => sum + f.links.length, 0),
    [team],
  );
  const personalCount = useMemo(
    () =>
      (personal ?? []).reduce((sum, f) => sum + f.links.length, 0),
    [personal],
  );

  if (loading) return <LoadingState />;
  if (!isAuthenticated) return <GuestState />;
  // Phase 19.16 — Block trial users
  if (!isPaid) return <TrialBlockedScreen featureName="Thư viện" />;

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
          <Library size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Thư viện
          </h1>
          <span
            className="ml-2 inline-flex items-center px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: 'rgba(245,158,11,0.14)',
              color: '#F59E0B',
            }}
          >
            READ-ONLY
          </span>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Đồng bộ từ TrishLibrary 3.0 desktop. Sửa folder/link cá nhân thì mở app desktop —
          web hiển thị real-time mọi thay đổi sau vài giây.
        </p>
      </header>

      {/* Tabs */}
      <div
        className="inline-flex p-1 rounded-md mb-6"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <TabButton
          active={tab === 'team'}
          onClick={() => setTab('team')}
          icon={<Cloud size={14} />}
          label={`TrishTEAM (${teamCount})`}
        />
        <TabButton
          active={tab === 'personal'}
          onClick={() => setTab('personal')}
          icon={<Folder size={14} />}
          label={`Cá nhân (${personalCount})`}
        />
      </div>

      {/* Content */}
      {tab === 'team' ? <TeamSection folders={team} /> : <PersonalSection folders={personal} />}
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded text-xs font-semibold transition-colors"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function TeamSection({ folders }: { folders: TrishTeamFolder[] | null }) {
  if (folders === null) {
    return (
      <p className="text-sm flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <Loader2 size={14} className="animate-spin" />
        Đang tải thư viện TrishTEAM...
      </p>
    );
  }
  if (folders.length === 0) {
    return (
      <EmptyState
        icon={<Cloud size={36} strokeWidth={1.5} />}
        title="Admin chưa tạo folder nào"
        hint="Folder TrishTEAM được admin tạo qua TrishAdmin desktop. Khi có folder mới sẽ tự xuất hiện ở đây."
      />
    );
  }
  return (
    <div className="space-y-6">
      {folders.map((f) => (
        <FolderCard key={f.id} icon={f.icon} name={f.name} description={f.description} count={f.links.length}>
          {f.links.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              (Chưa có link)
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {f.links.map((link) => (
                <LinkRow
                  key={link.id}
                  url={link.url}
                  title={link.title}
                  description={link.description}
                />
              ))}
            </div>
          )}
        </FolderCard>
      ))}
    </div>
  );
}

function PersonalSection({ folders }: { folders: OnlineFolder[] | null }) {
  if (folders === null) {
    return (
      <p className="text-sm flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
        <Loader2 size={14} className="animate-spin" />
        Đang tải dữ liệu cá nhân...
      </p>
    );
  }
  if (folders.length === 0) {
    return (
      <EmptyState
        icon={<Folder size={36} strokeWidth={1.5} />}
        title="Bạn chưa có folder cá nhân nào"
        hint="Mở TrishLibrary 3.0 trên Windows → tạo Online Folder + thêm link → web tự sync trong vài giây."
        ctaHref="/downloads#trishlibrary"
        ctaLabel="Tải TrishLibrary 3.0"
      />
    );
  }
  return (
    <div className="space-y-6">
      {folders.map((f) => (
        <FolderCard key={f.id} icon={f.icon} name={f.name} count={f.links.length}>
          {f.links.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              (Chưa có link)
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {f.links.map((link) => (
                <LinkRow
                  key={link.id}
                  url={link.url}
                  title={link.title}
                  description={link.description}
                />
              ))}
            </div>
          )}
        </FolderCard>
      ))}
    </div>
  );
}

function FolderCard({
  icon,
  name,
  description,
  count,
  children,
}: {
  icon: string;
  name: string;
  description?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <header className="flex items-start gap-3 mb-4">
        <span className="text-2xl shrink-0" aria-hidden>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2
            className="text-lg font-bold leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {name}
            <span
              className="ml-2 text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ({count})
            </span>
          </h2>
          {description && (
            <p
              className="text-xs mt-0.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {description}
            </p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

function LinkRow({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 p-2.5 rounded-md transition-colors hover:bg-[var(--color-surface-muted)]"
      style={{ background: 'var(--color-surface-bg_elevated)' }}
    >
      <ExternalLink
        size={14}
        strokeWidth={2}
        className="shrink-0 mt-0.5"
        style={{ color: 'var(--color-text-muted)' }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </div>
        {description && (
          <div
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {description}
          </div>
        )}
      </div>
    </a>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3"
        style={{ background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}
      >
        {icon}
      </div>
      <h3
        className="text-lg font-bold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm mb-4 max-w-md mx-auto"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {hint}
      </p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 text-center">
      <Loader2
        size={32}
        className="animate-spin mx-auto mb-3"
        style={{ color: 'var(--color-accent-primary)' }}
      />
      <p style={{ color: 'var(--color-text-muted)' }}>Đang kiểm tra đăng nhập...</p>
    </main>
  );
}

function GuestState() {
  return (
    <main className="max-w-md mx-auto px-6 py-16 text-center">
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
        style={{ background: 'var(--color-surface-muted)' }}
      >
        <Lock size={26} strokeWidth={1.5} style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        Cần đăng nhập
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
        Thư viện hiển thị folder + link đồng bộ từ tài khoản của bạn. Đăng nhập để xem.
      </p>
      <Link
        href="/login?next=/thu-vien"
        className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
      >
        <RefreshCw size={14} />
        Đăng nhập ngay
      </Link>
    </main>
  );
}
