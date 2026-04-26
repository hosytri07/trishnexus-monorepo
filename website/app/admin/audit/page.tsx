'use client';

/**
 * /admin/audit — Phase 11.8.4.
 *
 * Query collection-group `events` (index `kind+createdAt desc` có sẵn).
 * MVP: lấy 100 event mới nhất (filter optional theo kind). User email
 * resolve lazy — đọc `/users/{uid}` cache lần đầu, giữ Map trong state.
 *
 * Nâng cấp tương lai: infinite scroll với `startAfter` cursor, export CSV.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collectionGroup,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  Activity,
  Loader2,
  LogIn,
  LogOut,
  NotebookPen,
  UserPlus,
  MousePointerClick,
  MessageSquare,
  UserCog,
  KeyRound,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { formatRelative, type ActivityKind } from '@/lib/activity-log';

interface EventRow {
  id: string;
  uid: string;
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

const KIND_LABELS: Record<ActivityKind | 'all', string> = {
  all: 'Tất cả',
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  register: 'Đăng ký',
  note_update: 'Cập nhật ghi chú',
  app_open: 'Mở app',
  feedback_sent: 'Gửi phản hồi',
  profile_update: 'Cập nhật profile',
  key_activated: 'Kích hoạt key',
};

const KIND_OPTIONS: (ActivityKind | 'all')[] = [
  'all',
  'login',
  'register',
  'note_update',
  'app_open',
  'feedback_sent',
  'key_activated',
];

export default function AdminAuditPage() {
  const [kindFilter, setKindFilter] = useState<ActivityKind | 'all'>('all');
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!db) {
      setErr('Firebase chưa cấu hình');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    let unsub: Unsubscribe | null = null;
    try {
      // Nếu filter all → orderBy(createdAt) + limit 100.
      // Nếu filter kind → where + orderBy(createdAt) + limit (dùng index group).
      const base = collectionGroup(db, 'events');
      const q =
        kindFilter === 'all'
          ? query(base, orderBy('createdAt', 'desc'), limit(100))
          : query(
              base,
              where('kind', '==', kindFilter),
              orderBy('createdAt', 'desc'),
              limit(100),
            );
      unsub = onSnapshot(
        q,
        (snap) => {
          const list: EventRow[] = snap.docs.map((d) => {
            // path: /users/{uid}/events/{id}
            const parts = d.ref.path.split('/');
            const uid = parts.length >= 2 ? parts[1] : '';
            const data = d.data() as {
              kind?: ActivityKind;
              title?: string;
              createdAt?: { toMillis?: () => number };
            };
            return {
              id: d.id,
              uid,
              kind: (data.kind ?? 'login') as ActivityKind,
              title: data.title ?? '',
              createdAt:
                typeof data.createdAt?.toMillis === 'function'
                  ? data.createdAt.toMillis!()
                  : null,
            };
          });
          setRows(list);
          setLoading(false);
          // Resolve email batch (chỉ những uid chưa cache).
          const missing = Array.from(
            new Set(list.map((r) => r.uid).filter((u) => u && !(u in emailMap))),
          );
          if (missing.length > 0) {
            void resolveEmails(missing);
          }
        },
        (e) => {
          setErr(e.message);
          setLoading(false);
        },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindFilter]);

  async function resolveEmails(uids: string[]) {
    if (!db) return;
    const next: Record<string, string> = {};
    await Promise.all(
      uids.map(async (u) => {
        try {
          const s = await getDoc(doc(db!, 'users', u));
          if (s.exists()) {
            const d = s.data() as { email?: string; name?: string };
            next[u] = d.email ?? d.name ?? u;
          } else {
            next[u] = '(đã xoá)';
          }
        } catch {
          next[u] = u;
        }
      }),
    );
    setEmailMap((prev) => ({ ...prev, ...next }));
  }

  const totalByKind = useMemo(() => {
    const m: Partial<Record<ActivityKind, number>> = {};
    rows.forEach((r) => {
      m[r.kind] = (m[r.kind] ?? 0) + 1;
    });
    return m;
  }, [rows]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Nhật ký hoạt động
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Feed 100 event mới nhất toàn hệ thống · collection-group query.
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 h-10 px-3 rounded-md"
          style={{
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as ActivityKind | 'all')}
            className="bg-transparent outline-none text-sm pr-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
                {k !== 'all' && totalByKind[k as ActivityKind]
                  ? ` (${totalByKind[k as ActivityKind]})`
                  : ''}
              </option>
            ))}
          </select>
        </div>
      </header>

      {err ? (
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#B91C1C',
          }}
        >
          Lỗi: {err}. Nếu lỗi là "missing or insufficient permissions", deploy
          lại Firestore rules (Phase 11.8.4 thêm nhánh collection-group cho
          admin). Nếu lỗi là "The query requires an index", deploy index:{' '}
          <code>firebase deploy --only firestore:indexes</code>.
        </div>
      ) : null}

      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--color-surface-primary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {loading && rows.length === 0 ? (
          <div
            className="p-10 text-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Loader2 size={18} className="animate-spin inline" /> Đang tải…
          </div>
        ) : rows.length === 0 ? (
          <div
            className="p-10 text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Activity size={24} className="inline mb-2 opacity-40" />
            <p className="text-sm">Chưa có event nào khớp.</p>
          </div>
        ) : (
          <ul
            className="divide-y"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {rows.map((r) => {
              const Icon = KIND_ICON[r.kind] ?? Activity;
              const color = KIND_COLOR[r.kind] ?? 'var(--color-accent-primary)';
              const email = emailMap[r.uid] ?? r.uid;
              return (
                <li
                  key={`${r.uid}_${r.id}`}
                  className="flex items-center gap-3 p-3"
                >
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                    style={{ background: `${color}22`, color }}
                    aria-hidden
                  >
                    <Icon size={14} strokeWidth={2.25} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <b>{email}</b> · {r.title}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {KIND_LABELS[r.kind]} · {formatRelative(r.createdAt)}
                      {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString('vi-VN')}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
