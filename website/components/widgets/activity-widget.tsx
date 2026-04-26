'use client';

/**
 * ActivityWidget — Phase 11.7.3.
 *
 * Pre-auth (guest): empty state với CTA Đăng nhập (giữ UX cũ).
 * Post-auth: subscribe `/users/{uid}/events` (orderBy createdAt desc,
 * limit 10) để show feed realtime. Loading và empty state được tách
 * riêng để tránh hiện icon login trong lúc đang fetch.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  LogIn,
  LogOut,
  NotebookPen,
  UserPlus,
  MousePointerClick,
  MessageSquare,
  UserCog,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  type Unsubscribe,
} from 'firebase/firestore';
import { WidgetCard } from './widget-card';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';
import {
  formatRelative,
  type ActivityKind,
} from '@/lib/activity-log';

interface ActivityRow {
  id: string;
  kind: ActivityKind;
  title: string;
  createdAt: number | null;
}

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  login: LogIn,
  logout: LogOut,
  register: UserPlus,
  note_update: NotebookPen,
  app_open: MousePointerClick,
  feedback_sent: MessageSquare,
  profile_update: UserCog,
  key_activated: KeyRound,
};

const KIND_COLOR: Record<ActivityKind, string> = {
  login: '#10B981',
  logout: '#94A3B8',
  register: '#6366F1',
  note_update: '#F59E0B',
  app_open: '#3B82F6',
  feedback_sent: '#8B5CF6',
  profile_update: '#EC4899',
  key_activated: '#22C55E',
};

export function ActivityWidget() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !db) {
      setRows(null);
      return;
    }
    setErr(null);
    let unsub: Unsubscribe | null = null;
    try {
      const q = query(
        collection(db, 'users', user.id, 'events'),
        orderBy('createdAt', 'desc'),
        limit(10),
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: ActivityRow[] = snap.docs.map((d) => {
            const data = d.data() as {
              kind?: ActivityKind;
              title?: string;
              createdAt?: { toMillis?: () => number };
            };
            return {
              id: d.id,
              kind: (data.kind ?? 'login') as ActivityKind,
              title: data.title ?? '',
              createdAt:
                typeof data.createdAt?.toMillis === 'function'
                  ? data.createdAt.toMillis!()
                  : null,
            };
          });
          setRows(list);
        },
        (e) => {
          console.error('[activity] subscribe fail', e);
          setErr(e.message);
          setRows([]);
        },
      );
    } catch (e) {
      console.error('[activity] query fail', e);
      setErr(e instanceof Error ? e.message : String(e));
    }
    return () => {
      if (unsub) unsub();
    };
  }, [isAuthenticated, user?.id]);

  // Pre-auth: empty state + CTA
  if (!authLoading && !isAuthenticated) {
    return <GuestState />;
  }

  // Loading
  if (authLoading || rows === null) {
    return (
      <WidgetCard title="Hoạt động gần đây" icon={<Activity size={16} strokeWidth={2} />}>
        <div className="flex flex-col gap-3 py-4 min-h-[240px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full animate-pulse"
                style={{ background: 'var(--color-surface-muted)' }}
              />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3 rounded animate-pulse w-3/4"
                  style={{ background: 'var(--color-surface-muted)' }}
                />
                <div
                  className="h-2.5 rounded animate-pulse w-1/4"
                  style={{ background: 'var(--color-surface-muted)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </WidgetCard>
    );
  }

  // Error
  if (err && rows.length === 0) {
    return (
      <WidgetCard title="Hoạt động gần đây" icon={<Activity size={16} strokeWidth={2} />}>
        <div
          className="text-sm p-3 rounded-md"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-muted)',
          }}
        >
          Không tải được feed hoạt động. Kiểm tra Firestore rules hoặc kết nối
          mạng. ({err})
        </div>
      </WidgetCard>
    );
  }

  // Empty (auth nhưng chưa có event)
  if (rows.length === 0) {
    return (
      <WidgetCard title="Hoạt động gần đây" icon={<Activity size={16} strokeWidth={2} />}>
        <div className="flex flex-col items-center justify-center text-center py-8 px-4 min-h-[240px]">
          <div className="text-4xl mb-3" role="img" aria-label="Sao sáng">
            ✨
          </div>
          <p
            className="text-sm leading-relaxed max-w-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Chưa có hoạt động nào. Mở một ứng dụng, cập nhật ghi chú hoặc gửi
            phản hồi — feed sẽ xuất hiện ở đây.
          </p>
        </div>
      </WidgetCard>
    );
  }

  // Feed
  return (
    <WidgetCard title="Hoạt động gần đây" icon={<Activity size={16} strokeWidth={2} />}>
      <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {rows.map((r) => {
          const Icon = KIND_ICON[r.kind] ?? Activity;
          const color = KIND_COLOR[r.kind] ?? 'var(--color-accent-primary)';
          return (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                style={{ background: `${color}22`, color }}
                aria-hidden
              >
                <Icon size={15} strokeWidth={2.25} />
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm leading-snug truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {r.title}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {formatRelative(r.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}

function GuestState() {
  return (
    <WidgetCard title="Hoạt động gần đây" icon={<Activity size={16} strokeWidth={2} />}>
      <div className="flex flex-col items-center justify-center text-center py-8 px-4 min-h-[240px]">
        <div className="text-5xl mb-4" role="img" aria-label="Vẫy tay chào">
          👋
        </div>
        <p
          className="text-sm leading-relaxed max-w-sm mb-5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Đăng nhập để theo dõi tiến độ ôn thi, ghi chú, bookmark và hoạt động
          cá nhân.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: 'var(--color-accent-gradient)',
            color: '#ffffff',
          }}
        >
          Đăng nhập ngay
          <ArrowRight size={14} strokeWidth={2.25} />
        </Link>
      </div>
    </WidgetCard>
  );
}
