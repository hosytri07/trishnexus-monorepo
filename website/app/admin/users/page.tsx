'use client';

/**
 * /admin/users — Phase 19.22 (rewrite).
 *
 * Dùng /api/admin/list-users (Admin SDK) để lấy NGUỒN THẬT từ Firebase Auth
 * + merge Firestore /users/{uid} doc. Trước đây chỉ query Firestore client-
 * side → bỏ sót user tạo từ Console / app khác chưa có Firestore doc.
 *
 * Features:
 *   - List user với search email/tên/phone
 *   - Toggle ẩn/hiện email + phone (privacy mode)
 *   - Dropdown role 3 cấp: trial / user / admin
 *   - Delete user (xóa Auth + Firestore + audit)
 *   - Modal xem chi tiết user (UID, providers, claims, metadata)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShieldCheck,
  UserRound,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  Info,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/lib/auth-context';

type Role = 'trial' | 'user' | 'admin';

interface UserItem {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: number | null;
  lastSignedIn: number | null;
  providers: string[];
  customClaims: Record<string, unknown> | null;
  firestore: {
    role: Role;
    plan: string | null;
    fullName: string | null;
    phone: string | null;
    display_name: string | null;
    key_activated_at: number;
    activated_key_id: string | null;
  } | null;
}

const ROLE_META: Record<Role, { label: string; bg: string; fg: string; icon: typeof ShieldCheck }> = {
  trial: { label: 'Trial', bg: 'rgba(245,158,11,0.15)', fg: '#B45309', icon: Sparkles },
  user: { label: 'User', bg: 'rgba(59,130,246,0.15)', fg: '#1D4ED8', icon: UserRound },
  admin: { label: 'Admin', bg: 'rgba(16,185,129,0.15)', fg: '#059669', icon: ShieldCheck },
};

function maskEmail(email: string | null): string {
  if (!email) return '—';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const masked = name.length <= 2 ? '••' : name.slice(0, 2) + '•••';
  return `${masked}@${domain}`;
}

function maskPhone(phone: string | null): string {
  if (!phone) return '—';
  if (phone.length <= 4) return '••••';
  return phone.slice(0, 3) + '••••' + phone.slice(-2);
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

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [maskPii, setMaskPii] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<UserItem | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    tone: 'ok' | 'warn' | 'err';
  } | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      if (!auth?.currentUser) {
        throw new Error('Bạn chưa đăng nhập.');
      }
      const idToken = await getIdToken(auth.currentUser);
      const res = await fetch('/api/admin/list-users?max=1000', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const body = (await res.json()) as { users?: UserItem[]; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setUsers(body.users ?? []);
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

  async function changeRole(u: UserItem, next: Role) {
    if (busyUid) return;
    if (u.uid === me?.id && next !== 'admin') {
      flash('warn', 'Không thể tự gỡ quyền admin của chính bạn.');
      return;
    }
    const current = u.firestore?.role ?? 'trial';
    if (current === next) return;

    const ok = await askConfirm({
      title: 'Đổi role',
      message: `Đổi ${u.email ?? u.uid} từ ${current.toUpperCase()} → ${next.toUpperCase()}?`,
      okLabel: 'Đồng ý',
    });
    if (!ok) return;

    setBusyUid(u.uid);
    try {
      const idToken = await getIdToken(auth!.currentUser!);
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: u.uid, role: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      // Local update
      setUsers((prev) =>
        prev.map((x) =>
          x.uid === u.uid
            ? {
                ...x,
                firestore: {
                  ...(x.firestore ?? {
                    role: next,
                    plan: null,
                    fullName: null,
                    phone: null,
                    display_name: null,
                    key_activated_at: 0,
                    activated_key_id: null,
                  }),
                  role: next,
                },
              }
            : x,
        ),
      );
      flash('ok', `Đổi role thành ${next.toUpperCase()}. User cần logout-login để claim refresh.`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUid(null);
    }
  }

  async function deleteUser(u: UserItem) {
    if (busyUid) return;
    if (u.uid === me?.id) {
      flash('warn', 'Không thể tự xóa chính bạn.');
      return;
    }
    const ok = await askConfirm({
      title: 'Xóa user',
      message: `Xóa hoàn toàn ${u.email ?? u.uid}? Hành động này KHÔNG THỂ undo.`,
      okLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;

    setBusyUid(u.uid);
    try {
      const idToken = await getIdToken(auth!.currentUser!);
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: u.uid }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      flash('ok', `Đã xóa ${u.email ?? u.uid}.`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUid(null);
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(s) ||
        (u.displayName ?? '').toLowerCase().includes(s) ||
        (u.firestore?.display_name ?? '').toLowerCase().includes(s) ||
        (u.firestore?.fullName ?? '').toLowerCase().includes(s) ||
        (u.phoneNumber ?? '').includes(s) ||
        u.uid.includes(s),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    const counts: Record<Role, number> = { trial: 0, user: 0, admin: 0 };
    let noFirestore = 0;
    for (const u of users) {
      if (!u.firestore) {
        noFirestore++;
        counts.trial++;
      } else {
        counts[u.firestore.role] = (counts[u.firestore.role] ?? 0) + 1;
      }
    }
    return { ...counts, noFirestore };
  }, [users]);

  return (
    <div className="space-y-5">
      <ConfirmDialog />

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
              : `${filtered.length.toLocaleString('vi-VN')} / ${users.length.toLocaleString('vi-VN')} user · ${stats.admin} admin · ${stats.user} user · ${stats.trial} trial`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setMaskPii((v) => !v)}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: maskPii ? 'var(--color-accent-soft)' : 'var(--color-surface-muted)',
              color: maskPii ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
            title={maskPii ? 'Đang ẩn email/SĐT' : 'Đang hiện email/SĐT'}
          >
            {maskPii ? <EyeOff size={13} /> : <Eye size={13} />}
            {maskPii ? 'Ẩn PII' : 'Hiện PII'}
          </button>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              background: 'var(--color-surface-muted)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>

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
              placeholder="Tìm email, tên, SĐT, UID…"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
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
                  Lần cuối
                </th>
                <th className="text-left px-4 py-2.5">Role</th>
                <th className="text-right px-4 py-2.5">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Loader2 size={18} className="animate-spin inline mr-2" />
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {users.length === 0
                      ? 'Chưa có user nào.'
                      : `Không có user khớp "${search}".`}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const role: Role = u.firestore?.role ?? 'trial';
                  const meta = ROLE_META[role];
                  const Icon = meta.icon;
                  const displayName =
                    u.firestore?.fullName ??
                    u.firestore?.display_name ??
                    u.displayName ??
                    u.email?.split('@')[0] ??
                    '(chưa có tên)';
                  return (
                    <tr
                      key={u.uid}
                      style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt=""
                              className="w-8 h-8 rounded-full shrink-0 object-cover"
                            />
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0"
                              style={{
                                background: meta.bg,
                                color: meta.fg,
                              }}
                            >
                              {initials(displayName)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p
                              className="font-semibold truncate"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {displayName}
                              {u.disabled ? (
                                <span
                                  className="ml-2 text-[10px] px-1.5 rounded font-bold"
                                  style={{ background: 'rgba(239,68,68,0.15)', color: '#B91C1C' }}
                                >
                                  DISABLED
                                </span>
                              ) : null}
                            </p>
                            <p
                              className="text-xs truncate md:hidden"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {maskPii ? maskEmail(u.email) : u.email ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p
                          className="truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {maskPii ? maskEmail(u.email) : u.email ?? '—'}
                        </p>
                        {u.phoneNumber || u.firestore?.phone ? (
                          <p
                            className="text-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {maskPii
                              ? maskPhone(u.phoneNumber ?? u.firestore?.phone ?? null)
                              : u.phoneNumber ?? u.firestore?.phone}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className="px-4 py-3 hidden lg:table-cell text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {u.lastSignedIn
                          ? new Date(u.lastSignedIn).toLocaleDateString('vi-VN')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={role}
                          onChange={(e) => void changeRole(u, e.target.value as Role)}
                          disabled={busyUid === u.uid}
                          className="text-xs font-semibold px-2 py-1 rounded outline-none disabled:opacity-50 cursor-pointer"
                          style={{
                            background: meta.bg,
                            color: meta.fg,
                            border: `1px solid ${meta.fg}33`,
                          }}
                        >
                          <option value="trial">Trial</option>
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setDetailUser(u)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-opacity hover:opacity-80"
                            style={{
                              background: 'var(--color-surface-muted)',
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border-subtle)',
                            }}
                            title="Xem chi tiết"
                          >
                            <Info size={13} />
                          </button>
                          <button
                            onClick={() => void deleteUser(u)}
                            disabled={busyUid === u.uid || u.uid === me?.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              background: 'rgba(239,68,68,0.08)',
                              color: '#B91C1C',
                              border: '1px solid rgba(239,68,68,0.25)',
                            }}
                            title={u.uid === me?.id ? 'Không thể tự xóa' : 'Xóa user'}
                          >
                            {busyUid === u.uid ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
        custom claim. User chưa có Firestore doc sẽ tự tạo lúc login lần đầu (role='trial').
      </p>

      {/* Detail modal */}
      {detailUser ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setDetailUser(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl p-6"
            style={{
              background: 'var(--color-surface-primary)',
              border: '1px solid var(--color-border-default)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {detailUser.photoURL ? (
                  <img src={detailUser.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <span
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full text-base font-bold"
                    style={{
                      background: ROLE_META[detailUser.firestore?.role ?? 'trial'].bg,
                      color: ROLE_META[detailUser.firestore?.role ?? 'trial'].fg,
                    }}
                  >
                    {initials(
                      detailUser.firestore?.fullName ??
                        detailUser.displayName ??
                        detailUser.email ??
                        'U',
                    )}
                  </span>
                )}
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {detailUser.firestore?.fullName ??
                      detailUser.firestore?.display_name ??
                      detailUser.displayName ??
                      '(chưa có tên)'}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {detailUser.email ?? '—'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailUser(null)}
                className="p-1 rounded hover:opacity-70"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <DetailRow label="UID" value={detailUser.uid} mono />
            <DetailRow label="Email" value={detailUser.email ?? '—'} mono />
            <DetailRow
              label="Email verified"
              value={detailUser.emailVerified ? '✓ Đã xác thực' : '✗ Chưa xác thực'}
            />
            <DetailRow label="SĐT (Auth)" value={detailUser.phoneNumber ?? '—'} mono />
            <DetailRow label="SĐT (Firestore)" value={detailUser.firestore?.phone ?? '—'} mono />
            <DetailRow
              label="Providers"
              value={detailUser.providers.join(', ') || '—'}
            />
            <DetailRow
              label="Disabled"
              value={detailUser.disabled ? '⛔ Đã disable' : '✓ Active'}
            />
            <DetailRow
              label="Tạo lúc"
              value={
                detailUser.createdAt
                  ? new Date(detailUser.createdAt).toLocaleString('vi-VN')
                  : '—'
              }
            />
            <DetailRow
              label="Login lần cuối"
              value={
                detailUser.lastSignedIn
                  ? new Date(detailUser.lastSignedIn).toLocaleString('vi-VN')
                  : '—'
              }
            />
            <DetailRow label="Role" value={detailUser.firestore?.role ?? 'trial (no doc)'} />
            <DetailRow label="Plan" value={detailUser.firestore?.plan ?? '—'} />
            <DetailRow
              label="Key activated"
              value={
                detailUser.firestore?.key_activated_at
                  ? new Date(detailUser.firestore.key_activated_at).toLocaleString('vi-VN')
                  : '—'
              }
            />
            <DetailRow
              label="Key ID"
              value={detailUser.firestore?.activated_key_id ?? '—'}
              mono
            />
            <DetailRow
              label="Custom claims"
              value={
                detailUser.customClaims
                  ? JSON.stringify(detailUser.customClaims)
                  : '—'
              }
              mono
            />
            <DetailRow
              label="Firestore doc"
              value={detailUser.firestore ? '✓ Có' : '✗ Chưa có (tạo khi user login web lần đầu)'}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 py-2"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <span
        className="text-xs font-medium uppercase tracking-wide w-32 shrink-0 pt-0.5"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <span
        className={`text-sm flex-1 break-all ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}
