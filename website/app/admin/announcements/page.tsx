'use client';

/**
 * /admin/announcements — Phase 11.8.3.
 *
 * Composer (bên trái) + List hiện hữu (bên phải). Khi publish:
 *   addDoc(/announcements, {title, message, kind, active, dismissible,
 *   startAt, endAt?, createdAt, createdBy})
 * → Banner ở dashboard subscribe realtime → hiện ngay.
 *
 * Thao tác trên list: toggle active (bật/tắt nhanh) + xoá.
 */
import { useEffect, useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  Megaphone,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

type Kind = 'info' | 'success' | 'warning' | 'danger';

interface AnnRow {
  id: string;
  title: string;
  message: string;
  kind: Kind;
  active: boolean;
  dismissible: boolean;
  startAt: number | null;
  endAt: number | null;
  createdBy?: string;
}

const KIND_META: Record<
  Kind,
  { label: string; color: string; icon: typeof Info }
> = {
  info: { label: 'Info', color: '#3B82F6', icon: Info },
  success: { label: 'Success', color: '#10B981', icon: CheckCircle2 },
  warning: { label: 'Warning', color: '#F59E0B', icon: AlertTriangle },
  danger: { label: 'Danger', color: '#EF4444', icon: XCircle },
};

function toRow(id: string, data: Record<string, unknown>): AnnRow {
  const start = (data.startAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
  const end = (data.endAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
  const kind = (data.kind as string) ?? 'info';
  return {
    id,
    title: (data.title as string) ?? '',
    message: (data.message as string) ?? '',
    kind: (['info', 'success', 'warning', 'danger'].includes(kind)
      ? kind
      : 'info') as Kind,
    active: (data.active as boolean) ?? false,
    dismissible: (data.dismissible as boolean) ?? true,
    startAt: start,
    endAt: end,
    createdBy: (data.createdBy as string) ?? undefined,
  };
}

export default function AdminAnnouncementsPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<AnnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<Kind>('info');
  const [dismissible, setDismissible] = useState(true);
  const [active, setActive] = useState(true);
  const [endAt, setEndAt] = useState<string>(''); // datetime-local
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setErr('Firebase chưa cấu hình');
      setLoading(false);
      return;
    }
    let unsub: Unsubscribe | null = null;
    try {
      const q = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          setRows(snap.docs.map((d) => toRow(d.id, d.data())));
          setLoading(false);
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
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !db) return;
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        message: message.trim(),
        kind,
        active,
        dismissible,
        startAt: serverTimestamp(),
        endAt: endAt ? Timestamp.fromDate(new Date(endAt)) : null,
        createdAt: serverTimestamp(),
        createdBy: me?.email ?? me?.id ?? 'unknown',
      });
      setTitle('');
      setMessage('');
      setKind('info');
      setDismissible(true);
      setActive(true);
      setEndAt('');
      setFlash('Đã publish thông báo — banner sẽ xuất hiện ngay trên dashboard.');
      setTimeout(() => setFlash(null), 3500);
    } catch (e) {
      setFlash('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setFlash(null), 5000);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(r: AnnRow) {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'announcements', r.id), {
        active: !r.active,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      setFlash('Lỗi toggle: ' + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setFlash(null), 4500);
    }
  }

  async function remove(r: AnnRow) {
    if (!db) return;
    if (!window.confirm(`Xoá thông báo "${r.title}"? Không thể khôi phục.`)) return;
    try {
      await deleteDoc(doc(db, 'announcements', r.id));
    } catch (e) {
      setFlash('Lỗi xoá: ' + (e instanceof Error ? e.message : String(e)));
      setTimeout(() => setFlash(null), 4500);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Thông báo
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Push banner tới toàn bộ user đang đăng nhập. Banner đọc Firestore
          realtime — user thấy ngay khi bạn publish.
        </p>
      </header>

      {flash ? (
        <div
          className="p-3 rounded-md text-sm"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: '#059669',
          }}
        >
          {flash}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5">
        {/* Composer */}
        <form
          onSubmit={onSubmit}
          className="rounded-lg p-5 space-y-3"
          style={{
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Tạo mới
          </h2>

          <label className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tiêu đề</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Ví dụ: Bảo trì hệ thống 23h tối nay"
              className="mt-1 w-full h-10 px-3 rounded-md text-sm outline-none"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nội dung</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={500}
              rows={4}
              placeholder="Nội dung chi tiết cho user…"
              className="mt-1 w-full px-3 py-2 rounded-md text-sm outline-none resize-y"
              style={{
                background: 'var(--color-surface-muted)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span
              className="text-xs mt-0.5 block"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {message.length}/500 ký tự
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Loại</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Kind)}
                className="mt-1 w-full h-10 px-3 rounded-md text-sm outline-none"
                style={{
                  background: 'var(--color-surface-muted)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {(Object.keys(KIND_META) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_META[k].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Hết hạn (tuỳ chọn)</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md text-sm outline-none"
                style={{
                  background: 'var(--color-surface-muted)',
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </label>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span style={{ color: 'var(--color-text-secondary)' }}>Bật ngay</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={dismissible}
                onChange={(e) => setDismissible(e.target.checked)}
              />
              <span style={{ color: 'var(--color-text-secondary)' }}>User có thể đóng</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !message.trim()}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--color-accent-gradient)',
              color: '#ffffff',
            }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} strokeWidth={2.25} />
            )}
            Publish
          </button>
        </form>

        {/* List */}
        <div>
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-3 inline-flex items-center gap-1.5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Megaphone size={13} strokeWidth={2.5} />
            Danh sách ({rows.length})
          </h2>

          {err ? (
            <div
              className="p-3 rounded-md text-sm"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#B91C1C',
              }}
            >
              Lỗi: {err}
            </div>
          ) : loading ? (
            <div
              className="p-6 text-sm text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Loader2 size={16} className="animate-spin inline" /> Đang tải…
            </div>
          ) : rows.length === 0 ? (
            <div
              className="p-6 text-sm text-center rounded-lg"
              style={{
                background: 'var(--color-surface-primary)',
                border: '1px dashed var(--color-border-subtle)',
                color: 'var(--color-text-muted)',
              }}
            >
              Chưa có thông báo nào.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <li
                    key={r.id}
                    className="rounded-lg p-3 flex items-start gap-3"
                    style={{
                      background: 'var(--color-surface-primary)',
                      border: '1px solid var(--color-border-subtle)',
                      opacity: r.active ? 1 : 0.6,
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0"
                      style={{
                        background: `${meta.color}22`,
                        color: meta.color,
                      }}
                    >
                      <Icon size={15} strokeWidth={2.25} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="font-semibold text-sm"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {r.title}
                        </p>
                        {!r.active ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'var(--color-surface-muted)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            Tắt
                          </span>
                        ) : null}
                      </div>
                      <p
                        className="text-sm mt-0.5 whitespace-pre-wrap"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {r.message}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {r.startAt ? new Date(r.startAt).toLocaleString('vi-VN') : '—'}
                        {r.endAt ? ` → ${new Date(r.endAt).toLocaleString('vi-VN')}` : ''}
                        {r.createdBy ? ` · ${r.createdBy}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => void toggleActive(r)}
                        aria-label={r.active ? 'Tắt' : 'Bật'}
                        className="p-1.5 rounded-md transition-colors hover:opacity-80"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {r.active ? (
                          <ToggleRight size={18} style={{ color: '#10B981' }} />
                        ) : (
                          <ToggleLeft size={18} />
                        )}
                      </button>
                      <button
                        onClick={() => void remove(r)}
                        aria-label="Xoá"
                        className="p-1.5 rounded-md transition-colors hover:opacity-80"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
