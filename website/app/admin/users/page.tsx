'use client';

/**
 * /admin/users — Phase 11.8.2.
 *
 * Load toàn bộ `/users` (orderBy createdAt desc, limit 500 cho MVP; sau
 * này chuyển cursor pagination khi > 500). Search client-side theo email
 * hoặc displayName. Toggle role admin/user:
 *   1. Gọi POST /api/admin/set-role (nếu server có Admin SDK env) →
 *      custom claim + Firestore cùng cập nhật.
 *   2. Nếu API lỗi/env chưa config → fallback update Firestore doc, show
 *      toast nhắc Trí rerun seed-admin script để refresh custom claim.
 * Tự ngăn admin unset chính mình (safeguard).
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Search,
  ShieldCheck,
  UserRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface UserRow {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  plan?: string;
  createdAt?: number | null;
}

function toRow(
  id: string,
  data: Record<string, unknown>,
): UserRow {
  const created =
    (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ??
    null;
  return {
    id,
    name: (data.name as string) ?? '',
    fullName: (data.fullName as string) ?? undefined,
    email: (data.email as string) ?? '',
    phone: (data.phone as string) ?? undefined,
    role: ((data.role as string) === 'admin' ? 'admin' : 'user') as
      | 'user'
      | 'admin',
    plan: (data.plan as string) ?? 'Free',
    createdAt: created,
  };
}

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{
    text: string;
    tone: 'ok' | 'warn' | 'err';
  } | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (!db) throw new Error('Firebase chưa cấu hình');
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(500),
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => toRow(d.id, d.data())));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function flash(tone: 'ok' | 'warn' | 'err', text: string) {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3800);
  }

  async function toggleRole(row: UserRow) {
    if (busyUid) return;
    if (row.id === me?.id && row.role === 'admin') {
      flash('warn', 'Không thể tự gỡ quyền admin của chính bạn.');
      return;
    }
    const next: 'user' | 'admin' = row.role === 'admin' ? 'user' : 'admin';
    const verb = next === 'admin' ? 'Cấp quyền admin' : 'Gỡ quyền admin';
    if (!window.confirm(`${verb} cho ${row.email}?`)) return;

    setBusyUid(row.id);
    try {
      // 1. Thử gọi server API (Admin SDK) — cập nhật custom claim + Firestore.
      let usedServer = false;
      try {
        if (auth?.currentUser) {
          const idToken = await getIdToken(auth.currentUser);
          const res = await fetch('/api/admin/set-role', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ uid: row.id, role: next }),
          });
          if (res.ok) {
            usedServer = true;
          } else if (res.status !== 501) {
            // 501 = server chưa config Admin SDK → fallback.
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(body.error ?? `Server lỗi ${res.status}`);
          }
        }
      } catch (apiErr) {
        console.warn('[admin/users] API set-role fail, fallback:', apiErr);
      }

      // 2. Fallback: update Firestore doc (custom claim cần rerun seed script).
      if (!usedServer) {
        if (!db) throw new Error('Firebase chưa cấu hình');
        await updateDoc(doc(db, 'users', row.id), {
          role: next,
          plan: next === 'admin' ? 'Admin' : (row.plan ?? 'Free'),
          updatedAt: serverTimestamp(),
        });
      }

      // 3. Local state update (optimistic).
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, role: next } : r)),
      );
      flash(
        usedServer ? 'ok' : 'warn',
        usedServer
          ? `${verb} thành công — custom claim đã cập nhật, user cần logout-login.`
          : `${verb} Firestore OK — custom claim cần rerun seed-admin script (xem FIREBASE-SETUP §6).`,
      );
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUid(null);
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(s) ||
        r.name.toLowerCase().includes(s) ||
        (r.fullName ?? '').toLowerCase().includes(s),
    );
  }, [rows, search]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Người dùng
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {loading
              ? 'Đang tải…'
              : `${filtered.length.toLocaleString('vi-VN')} / ${rows.length.toLocaleString('vi-VN')} user`}
          </p>
        </div>

        <div
          className="inline-flex items-center gap-2 h-10 px-3 rounded-md min-w-[260px]"
          style={{
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo email, tên…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>
      </header>

      {toast ? (
        <div
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
          style={{
            background:
              toast.tone === 'ok'
                ? 'rgba(16,185,129,0.1)'
                : toast.tone === 'warn'
                ? 'rgba(245,158,11,0.1)'
                : 'rgba(239,68,68,0.1)',
            color:
              toast.tone === 'ok'
                ? '#059669'
                : toast.tone === 'warn'
                ? '#B45309'
                : '#B91C1C',
            border: `1px solid ${
              toast.tone === 'ok'
                ? '#10B98155'
                : toast.tone === 'warn'
                ? '#F59E0B55'
                : '#EF444455'
            }`,
          }}
        >
          {toast.tone === 'ok' ? (
            <CheckCircle2 size={14} />
          ) : (
            <AlertTriangle size={14} />
          )}
          {toast.text}
        </div>
      ) : null}

      {err ? (
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#B91C1C',
          }}
        >
          Lỗi tải user: {err}.
        </div>
      ) : null}

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--color-surface-primary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className="text-xs uppercase tracking-wide"
              style={{
                background: 'var(--color-surface-muted)',
                color: 'var(--color-text-muted)',
              }}
            >
              <tr>
                <th className="text-left px-4 py-2.5">User</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">
                  Email · SĐT
                </th>
                <th className="text-left px-4 py-2.5 hidden lg:table-cell">
                  Tạo lúc
                </th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-right px-4 py-2.5">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Loader2 size={18} className="animate-spin inline" /> Đang
                    tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Không có user khớp "{search}".
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                          style={{
                            background:
                              r.role === 'admin'
                                ? 'rgba(16,185,129,0.15)'
                                : 'var(--color-surface-muted)',
                            color:
                              r.role === 'admin'
                                ? '#059669'
                                : 'var(--color-text-secondary)',
                          }}
                        >
                          {initials(r.fullName ?? r.name ?? r.email)}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="font-semibold truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {r.fullName ?? r.name ?? '(chưa có tên)'}
                          </p>
                          <p
                            className="text-xs truncate md:hidden"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {r.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p
                        className="truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {r.email}
                      </p>
                      {r.phone ? (
                        <p
                          className="text-xs"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {r.phone}
                        </p>
                      ) : null}
                    </td>
                    <td
                      className="px-4 py-3 hidden lg:table-cell text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background:
                            r.role === 'admin'
                              ? 'rgba(16,185,129,0.15)'
                              : 'var(--color-surface-muted)',
                          color:
                            r.role === 'admin'
                              ? '#059669'
                              : 'var(--color-text-secondary)',
                        }}
                      >
                        {r.role === 'admin' ? (
                          <ShieldCheck size={11} strokeWidth={2.5} />
                        ) : (
                          <UserRound size={11} strokeWidth={2.5} />
                        )}
                        {r.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void toggleRole(r)}
                        disabled={busyUid === r.id}
                        className="inline-flex items-center gap-1 px-3 h-8 rounded-md text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                        style={{
                          background:
                            r.role === 'admin'
                              ? 'rgba(239,68,68,0.08)'
                              : 'var(--color-accent-gradient)',
                          color:
                            r.role === 'admin' ? '#B91C1C' : '#ffffff',
                          border:
                            r.role === 'admin'
                              ? '1px solid rgba(239,68,68,0.25)'
                              : 'none',
                        }}
                      >
                        {busyUid === r.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : null}
                        {r.role === 'admin' ? 'Gỡ admin' : 'Cấp admin'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <AlertTriangle size={11} className="inline mr-1" />
        Sau khi đổi role: user cần <b>logout + login lại</b> để ID token refresh
        custom claim. Nếu server chưa cấu hình Admin SDK (env
        <code className="mx-1">FIREBASE_SERVICE_ACCOUNT</code>), role chỉ cập
        nhật Firestore — rerun <code>scripts/firebase/seed-admin.ts</code> để
        set claim.
      </p>
    </div>
  );
}

function initials(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
