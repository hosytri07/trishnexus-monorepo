'use client';

/**
 * AnnouncementsBanner — Phase 19.22 (rewrite).
 *
 * Subscribe Firestore /announcements (admin tạo qua /admin/announcements).
 * Fallback static `data/announcements.ts` nếu Firestore trống/lỗi.
 *
 * Lọc:
 *   - active === true
 *   - startAt <= now <= endAt (nếu có)
 *   - Chưa bị dismiss (localStorage)
 *
 * Ưu tiên kind: danger > warning > info > success.
 * Hiện 1 announcement cao nhất tại 1 thời điểm.
 */
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { db, firebaseReady } from '@/lib/firebase';
import { ANNOUNCEMENTS as STATIC_ANNOUNCEMENTS } from '@/data/announcements';

type Kind = 'info' | 'success' | 'warning' | 'danger' | 'critical';

interface BannerEntry {
  id: string;
  kind: Kind;
  title: string;
  message: string;
  link?: { label: string; href: string };
  startAt: number | null;
  endAt: number | null;
  dismissible: boolean;
  active: boolean;
}

const DISMISS_KEY = 'trishteam:dismissed';

const KIND_ORDER: Record<Kind, number> = {
  critical: 0,
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

const KIND_STYLE: Record<
  Kind,
  { bg: string; border: string; color: string; Icon: typeof Info }
> = {
  critical: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    color: '#EF4444',
    Icon: AlertCircle,
  },
  danger: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    color: '#EF4444',
    Icon: XCircle,
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    color: '#F59E0B',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.35)',
    color: '#3B82F6',
    Icon: Info,
  },
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    color: '#10B981',
    Icon: CheckCircle2,
  },
};

function loadDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function staticToBanner(): BannerEntry[] {
  return STATIC_ANNOUNCEMENTS.map((a) => ({
    id: a.id,
    kind: a.severity === 'critical' ? 'critical' : (a.severity as Kind),
    title: a.title,
    message: a.body ?? '',
    link: a.link,
    startAt: a.starts_at ? new Date(a.starts_at).getTime() : null,
    endAt: a.expires_at ? new Date(a.expires_at).getTime() : null,
    dismissible: a.dismissible ?? true,
    active: true,
  }));
}

function isVisible(b: BannerEntry, now: number): boolean {
  if (!b.active) return false;
  if (b.startAt && b.startAt > now) return false;
  if (b.endAt && b.endAt < now) return false;
  return true;
}

export function AnnouncementsBanner() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [entries, setEntries] = useState<BannerEntry[]>(() => staticToBanner());

  // Mount + load dismissed
  useEffect(() => {
    setMounted(true);
    setDismissed(loadDismissed());
  }, []);

  // Subscribe Firestore
  useEffect(() => {
    if (!firebaseReady || !db) return;
    const unsub = onSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        if (snap.empty) {
          setEntries(staticToBanner());
          return;
        }
        const list: BannerEntry[] = snap.docs.map((d) => {
          const data = d.data();
          const start =
            (data.startAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
            (typeof data.startAt === 'number' ? (data.startAt as number) : null);
          const end =
            (data.endAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
            (typeof data.endAt === 'number' ? (data.endAt as number) : null);
          const k = (data.kind as string) ?? 'info';
          const kind: Kind = ['info', 'success', 'warning', 'danger', 'critical'].includes(k)
            ? (k as Kind)
            : 'info';
          return {
            id: d.id,
            kind,
            title: (data.title as string) ?? '',
            message: (data.message as string) ?? (data.body as string) ?? '',
            link: data.link as { label: string; href: string } | undefined,
            startAt: start,
            endAt: end,
            dismissible: (data.dismissible as boolean) ?? true,
            active: (data.active as boolean) ?? true,
          };
        });
        setEntries(list);
      },
      (err) => {
        console.warn('[banner] subscribe fail, fallback static:', err);
        setEntries(staticToBanner());
      },
    );
    return () => unsub();
  }, []);

  const active = useMemo<BannerEntry | null>(() => {
    if (!mounted) return null;
    const now = Date.now();
    const visible = entries
      .filter((b) => isVisible(b, now) && !dismissed.includes(b.id))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    return visible[0] ?? null;
  }, [mounted, entries, dismissed]);

  if (!mounted || !active) return null;

  const style = KIND_STYLE[active.kind] ?? KIND_STYLE.info;
  const { Icon } = style;

  function handleDismiss() {
    if (!active) return;
    const next = [...new Set([...dismissed, active.id])];
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div
      role="status"
      className="rounded-lg px-4 py-3 flex items-start gap-3"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <span aria-hidden="true" className="shrink-0 mt-0.5" style={{ color: style.color }}>
        <Icon size={18} strokeWidth={2} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {active.title}
        </div>
        {active.message && (
          <div
            className="text-xs mt-0.5 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {active.message}
          </div>
        )}
        {active.link && (
          <a
            href={active.link.href}
            className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 hover:opacity-80 transition-opacity"
            style={{ color: style.color }}
            target={active.link.href.startsWith('http') ? '_blank' : undefined}
            rel={active.link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {active.link.label}
            <ExternalLink size={10} strokeWidth={2} />
          </a>
        )}
      </div>

      {active.dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Đóng thông báo"
          className="shrink-0 p-1 rounded hover:bg-[var(--color-surface-muted)] transition-colors"
          style={{ color: style.color }}
        >
          <X size={14} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
