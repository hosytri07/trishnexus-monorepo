'use client';

/**
 * /dashboard — User dashboard (Phase 37.8).
 *
 * Hiển thị:
 *   - Apps user đã activate (user.app_keys map)
 *   - Active sessions hiện tại của user
 *   - Nút "Logout máy khác" (kick session từ máy khác cùng user)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  collectionGroup,
  query,
  where,
  doc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface AppKeyEntry {
  appId: string;
  keyId: string;
  activatedAt: number;
  expiresAt: number;
}

interface SessionRow {
  session_id: string;
  key_id: string;
  app_id: string;
  machine_id: string;
  ip_address: string;
  hostname?: string;
  os?: string;
  started_at: number;
  last_heartbeat: number;
  expires_at: number;
}

const APP_LABELS: Record<string, string> = {
  trishlibrary: '📚 TrishLibrary',
  trishdrive: '☁️ TrishDrive',
  trishdesign: '✏️ TrishDesign',
  trishfinance: '💰 TrishFinance',
  trishiso: '📋 TrishISO',
  trishoffice: '🏢 TrishOffice',
  trishshortcut: '⌨️ TrishShortcut',
  trishcheck: '🔍 TrishCheck',
  trishclean: '🧹 TrishClean',
  trishfont: '🔤 TrishFont',
  all: '🌐 All apps',
};

function formatRelative(ts: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 0) return 'sắp xảy ra';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s trước`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  return `${day} ngày trước`;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('vi-VN');
}

export default function DashboardPage(): JSX.Element {
  const { user, role, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Lấy app_keys từ user (SessionUser từ website auth-context)
  const appKeys: AppKeyEntry[] = useMemo(() => {
    if (!user?.app_keys) return [];
    return Object.entries(user.app_keys)
      .filter(([, v]) => !!v)
      .map(([appId, v]) => ({
        appId,
        keyId: v!.key_id,
        activatedAt: v!.activated_at,
        expiresAt: v!.expires_at,
      }));
  }, [user]);

  // Listen sessions của user qua collectionGroup query
  useEffect(() => {
    if (!firebaseReady || !db) return;
    if (authLoading || !user) return;

    const now = Date.now();
    const q = query(
      collectionGroup(db, 'sessions'),
      where('uid', '==', user.id),
      where('expires_at', '>', now),
    );

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: SessionRow[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            session_id: d.id,
            key_id: data.key_id ?? d.ref.parent.parent?.id ?? '',
            app_id: data.app_id ?? '',
            machine_id: data.machine_id ?? '',
            ip_address: data.ip_address ?? '',
            hostname: data.hostname,
            os: data.os,
            started_at: data.started_at ?? 0,
            last_heartbeat: data.last_heartbeat ?? 0,
            expires_at: data.expires_at ?? 0,
          };
        });
        setSessions(rows);
        setLoadingSessions(false);
      },
      (err) => {
        setError(err.message);
        setLoadingSessions(false);
      },
    );

    return () => unsub();
  }, [user, authLoading]);

  async function handleKick(s: SessionRow): Promise<void> {
    if (!db) return;
    if (!window.confirm(`Đăng xuất session trên máy "${s.hostname ?? s.machine_id.slice(0, 8)}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'keys', s.key_id, 'sessions', s.session_id));
      setActionMsg('✓ Đã đăng xuất máy khác');
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (authLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-xl font-bold">Chưa đăng nhập</h2>
          <p className="text-sm text-amber-800 mt-2">Vui lòng đăng nhập để xem dashboard.</p>
          <Link href="/login" className="mt-4 inline-block text-amber-700 underline">
            → Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Trang chủ
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user.name ?? user.email}
          {role && <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">{role}</span>}
        </p>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700">
          ⚠ {error}
        </div>
      )}

      {/* Apps đã activate */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <KeyRound size={18} /> Apps đã kích hoạt ({appKeys.length})
        </h2>
        {appKeys.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">
              Bạn chưa kích hoạt key cho app nào. Mở app desktop và nhập key admin
              cấp để bắt đầu sử dụng.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {appKeys.map((ak) => {
              const expired = ak.expiresAt > 0 && ak.expiresAt < Date.now();
              return (
                <div
                  key={ak.appId}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="font-semibold">
                    {APP_LABELS[ak.appId] ?? ak.appId}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Kích hoạt: {formatDate(ak.activatedAt)}
                  </div>
                  <div className="text-xs mt-1">
                    {ak.expiresAt === 0 ? (
                      <span className="text-emerald-600">∞ Vô thời hạn</span>
                    ) : expired ? (
                      <span className="text-rose-600 inline-flex items-center gap-1">
                        <XCircle size={12} /> Hết hạn {formatDate(ak.expiresAt)}
                      </span>
                    ) : (
                      <span className="text-slate-600 inline-flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        Hết hạn: {formatDate(ak.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active sessions */}
      <section>
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Laptop size={18} /> Active sessions ({sessions.length})
        </h2>
        {loadingSessions ? (
          <Loader2 className="animate-spin text-slate-400" />
        ) : sessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">Không có session active.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className="rounded-lg border border-slate-200 bg-white p-4 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {APP_LABELS[s.app_id] ?? s.app_id}
                    <span className="text-xs font-normal text-slate-400">
                      {s.hostname ?? s.machine_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                    <span>IP: {s.ip_address}</span>
                    {s.os && <span>{s.os}</span>}
                    <span>Heartbeat: {formatRelative(s.last_heartbeat)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleKick(s)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded"
                  title="Đăng xuất máy khác"
                >
                  <LogOut size={12} /> Đăng xuất máy này
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 text-xs text-slate-400">
        💡 Mỗi key chỉ dùng được trên 1 thiết bị tại 1 thời điểm (do admin set max_concurrent).
        Nếu bạn login máy khác, máy cũ sẽ tự động đăng xuất sau 5 giây.
      </div>
    </div>
  );
}
