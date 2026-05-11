'use client';

/**
 * /admin/promo-codes — Phase 38.8.
 *
 * Admin CRUD promo codes (readable, shared). Mỗi code:
 *   - Doc ID = code chữ hoa (vd "TRIAL2026")
 *   - active toggle, duration_days, max_activations (optional), expires_at (optional)
 *   - Hiển thị activation_count realtime
 *
 * User kích hoạt qua POST /api/promo/activate (Admin SDK bypass).
 * Admin UI dùng Firestore client SDK + rules `isAdmin()`.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Ticket,
  Plus,
  Trash2,
  Power,
  PowerOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Infinity as InfinityIcon,
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/lib/auth-context';

interface PromoRow {
  id: string;
  code: string;
  active: boolean;
  action: 'demo';
  duration_days: number;
  note?: string;
  activation_count?: number;
  max_activations?: number;
  expires_at?: number;
  created_at?: number;
  created_by_uid?: string;
  updated_at?: number;
  last_activated_at?: number;
}

const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

function formatDate(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('vi-VN');
}

export default function AdminPromoCodesPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [newCode, setNewCode] = useState('');
  const [newDuration, setNewDuration] = useState<number>(3);
  const [newMaxActivations, setNewMaxActivations] = useState<string>(''); // '' = unlimited
  const [newExpiresDate, setNewExpiresDate] = useState<string>(''); // YYYY-MM-DD
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/');
    }
  }, [loading, isAdmin, router]);

  // Realtime subscribe
  useEffect(() => {
    if (!firebaseReady || !db || !isAdmin) {
      setLoadingRows(false);
      return;
    }
    const q = query(collection(db, 'promo_codes'), orderBy('created_at', 'desc'));
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: PromoRow[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            code: (data.code ?? d.id) as string,
            active: data.active !== false,
            action: 'demo',
            duration_days: Number(data.duration_days ?? 0),
            note: data.note as string | undefined,
            activation_count: Number(data.activation_count ?? 0),
            max_activations: data.max_activations as number | undefined,
            expires_at: data.expires_at as number | undefined,
            created_at: data.created_at as number | undefined,
            created_by_uid: data.created_by_uid as string | undefined,
            updated_at: data.updated_at as number | undefined,
            last_activated_at: data.last_activated_at as number | undefined,
          });
        });
        setRows(list);
        setLoadingRows(false);
      },
      (err) => {
        console.error('[promo-codes] subscribe fail:', err);
        setToast({ msg: `Lỗi đọc: ${err.message}`, kind: 'err' });
        setLoadingRows(false);
      },
    );
    return () => unsub();
  }, [isAdmin]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    const totalActivations = rows.reduce(
      (sum, r) => sum + (r.activation_count ?? 0),
      0,
    );
    return { total, active, totalActivations };
  }, [rows]);

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    const code = normalize(newCode);
    if (!CODE_PATTERN.test(code)) {
      setToast({
        msg: 'Code phải 4-32 ký tự, chỉ chữ và số (sẽ tự uppercase).',
        kind: 'err',
      });
      return;
    }
    if (newDuration < 1 || newDuration > 365) {
      setToast({ msg: 'Duration phải từ 1 đến 365 ngày.', kind: 'err' });
      return;
    }
    if (!db || !user) return;

    setSubmitting(true);
    try {
      const maxAct = newMaxActivations.trim()
        ? Math.max(1, Math.floor(Number(newMaxActivations)))
        : undefined;
      const expiresAt = newExpiresDate
        ? new Date(`${newExpiresDate}T23:59:59`).getTime()
        : undefined;

      const ref = doc(db, 'promo_codes', code);
      await setDoc(ref, {
        code,
        active: true,
        action: 'demo',
        duration_days: newDuration,
        note: newNote.trim() || null,
        activation_count: 0,
        ...(maxAct !== undefined ? { max_activations: maxAct } : {}),
        ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
        created_at: Date.now(),
        created_by_uid: user.uid,
        updated_at: serverTimestamp(),
      });
      setToast({ msg: `✓ Đã tạo code ${code}`, kind: 'ok' });
      setNewCode('');
      setNewDuration(3);
      setNewMaxActivations('');
      setNewExpiresDate('');
      setNewNote('');
    } catch (err) {
      setToast({
        msg: `Lỗi tạo: ${err instanceof Error ? err.message : String(err)}`,
        kind: 'err',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(row: PromoRow): Promise<void> {
    if (!db) return;
    const next = !row.active;
    const confirmed = await askConfirm({
      title: next ? `Kích hoạt lại ${row.code}?` : `Tạm ngưng ${row.code}?`,
      message: next
        ? `Bật lại ${row.code} — user có thể nhập lại để kích hoạt demo.`
        : `Tạm ngưng ${row.code} — user nhập sẽ bị reject "inactive". Code không bị xóa.`,
      okLabel: next ? 'Kích hoạt' : 'Tạm ngưng',
    });
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'promo_codes', row.id), {
        active: next,
        updated_at: serverTimestamp(),
      });
      setToast({ msg: `✓ ${next ? 'Đã bật' : 'Đã ngưng'} ${row.code}`, kind: 'ok' });
    } catch (err) {
      setToast({
        msg: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
        kind: 'err',
      });
    }
  }

  async function handleDelete(row: PromoRow): Promise<void> {
    if (!db) return;
    const confirmed = await askConfirm({
      title: `Xóa code ${row.code}?`,
      message:
        `Xóa hẳn ${row.code} khỏi Firestore.\n\n` +
        `• ${row.activation_count ?? 0} user đã dùng — họ vẫn giữ demo (không bị thu hồi).\n` +
        `• Code không thể tạo lại với cùng tên nếu đã có user dùng (vì array activated_codes vẫn còn).\n` +
        `• Khuyến nghị: dùng "Tạm ngưng" thay vì xóa.`,
      okLabel: 'Xóa hẳn',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'promo_codes', row.id));
      setToast({ msg: `✓ Đã xóa ${row.code}`, kind: 'ok' });
    } catch (err) {
      setToast({
        msg: `Lỗi: ${err instanceof Error ? err.message : String(err)}`,
        kind: 'err',
      });
    }
  }

  async function handleCopy(code: string, id: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft size={14} /> Admin
        </Link>
      </div>

      <header className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Ticket size={22} /> Mã khuyến mãi (Promo Codes)
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Codes user gõ vào để kích hoạt bản dùng thử (demo). Mỗi user dùng 1 code 1 lần.
          </p>
        </div>
        <div className="flex gap-2">
          <span
            className="px-3 py-1 rounded-md text-sm font-semibold"
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'rgb(16, 185, 129)',
            }}
          >
            {stats.active} active
          </span>
          <span
            className="px-3 py-1 rounded-md text-sm font-semibold"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'rgb(59, 130, 246)',
            }}
          >
            {stats.totalActivations} lượt dùng
          </span>
        </div>
      </header>

      {/* Create form */}
      <section
        className="mb-6 p-4 rounded-lg"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <h2
          className="text-base font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Tạo mã mới
        </h2>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Mã code (uppercase, 4-32 ký tự)
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="VD: TRIAL2026"
              maxLength={32}
              className="w-full px-3 py-2 rounded-md text-sm font-mono tracking-wider uppercase outline-none"
              style={{
                background: 'var(--color-surface-bg)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Số ngày demo
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--color-surface-bg)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="md:col-span-2">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Giới hạn lượt (∞)
            </label>
            <input
              type="number"
              min={1}
              value={newMaxActivations}
              onChange={(e) => setNewMaxActivations(e.target.value)}
              placeholder="Trống = ∞"
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--color-surface-bg)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="md:col-span-4">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Hạn dùng code (∞ nếu trống)
            </label>
            <input
              type="date"
              value={newExpiresDate}
              onChange={(e) => setNewExpiresDate(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--color-surface-bg)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="md:col-span-10">
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Ghi chú (optional)
            </label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="VD: Khuyến mãi ra mắt 2026"
              className="w-full px-3 py-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--color-surface-bg)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={submitting || !newCode.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-accent-gradient, linear-gradient(135deg, #10B981, #059669))',
                color: '#fff',
              }}
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Plus size={14} />
              )}
              Tạo mã
            </button>
          </div>
        </form>
      </section>

      {toast && (
        <div
          className="mb-4 p-3 rounded-md text-sm cursor-pointer"
          onClick={() => setToast(null)}
          style={{
            background:
              toast.kind === 'ok'
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(220, 38, 38, 0.12)',
            color: toast.kind === 'ok' ? 'rgb(6, 95, 70)' : 'rgb(153, 27, 27)',
            border: `1px solid ${toast.kind === 'ok' ? 'rgb(16, 185, 129)' : 'rgb(220, 38, 38)'}`,
          }}
        >
          {toast.msg} <span className="opacity-70 text-xs">(click đóng)</span>
        </div>
      )}

      {/* List */}
      <section>
        <h2
          className="text-base font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Danh sách mã ({rows.length})
        </h2>
        {loadingRows ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : rows.length === 0 ? (
          <div
            className="rounded-md p-8 text-center text-sm"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px dashed var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
          >
            Chưa có mã nào. Tạo mã đầu tiên ở form trên.
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-lg"
            style={{
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs uppercase tracking-wide text-left"
                  style={{
                    color: 'var(--color-text-muted)',
                    borderBottom: '1px solid var(--color-border-default)',
                  }}
                >
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Demo</th>
                  <th className="px-3 py-2">Lượt dùng</th>
                  <th className="px-3 py-2">Hạn code</th>
                  <th className="px-3 py-2">Ghi chú</th>
                  <th className="px-3 py-2">Tạo lúc</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired =
                    typeof r.expires_at === 'number' &&
                    r.expires_at > 0 &&
                    r.expires_at < Date.now();
                  const quotaFull =
                    typeof r.max_activations === 'number' &&
                    r.max_activations > 0 &&
                    (r.activation_count ?? 0) >= r.max_activations;
                  const usable = r.active && !expired && !quotaFull;
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid var(--color-border-default)' }}
                    >
                      <td className="px-3 py-2">
                        <code
                          className="font-mono font-bold tracking-wider"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {r.code}
                        </code>
                      </td>
                      <td className="px-3 py-2">
                        {usable ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: 'rgb(16, 185, 129)',
                            }}
                          >
                            <CheckCircle2 size={12} /> Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: 'rgba(156, 163, 175, 0.2)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            <XCircle size={12} />{' '}
                            {!r.active
                              ? 'Tạm ngưng'
                              : expired
                                ? 'Hết hạn'
                                : 'Hết lượt'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {r.duration_days} ngày
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                        <strong style={{ color: 'var(--color-text-primary)' }}>
                          {r.activation_count ?? 0}
                        </strong>
                        {' / '}
                        {r.max_activations && r.max_activations > 0 ? (
                          r.max_activations
                        ) : (
                          <InfinityIcon size={12} className="inline" />
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {r.expires_at ? formatDate(r.expires_at) : '∞'}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {r.note ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void handleCopy(r.code, r.id)}
                            title="Copy code"
                            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {copiedId === r.id ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(r)}
                            title={r.active ? 'Tạm ngưng' : 'Kích hoạt lại'}
                            className="p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {r.active ? <PowerOff size={14} /> : <Power size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(r)}
                            title="Xóa hẳn"
                            className="p-1.5 rounded hover:bg-rose-500/20"
                            style={{ color: 'rgb(220, 38, 38)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ConfirmDialog}
    </div>
  );
}
