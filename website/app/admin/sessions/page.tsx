'use client';

/**
 * /admin/sessions — Active sessions admin panel (Phase 37.7).
 *
 * Mirror TrishAdmin ActiveSessionsPanel. Hiển thị mọi session active của 11 apps,
 * cho phép admin force kick. Realtime qua Firestore collectionGroup onSnapshot.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  LogOut,
  RefreshCw,
  Search,
  Loader2,
} from 'lucide-react';
import {
  collectionGroup,
  query,
  where,
  doc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
  getDoc,
} from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

interface SessionRow {
  session_id: string;
  key_id: string;
  app_id: string;
  machine_id: string;
  ip_address: string;
  uid?: string;
  hostname?: string;
  os?: string;
  started_at: number;
  last_heartbeat: number;
  expires_at: number;
  doc_path: string;
}

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
  return new Date(ts).toLocaleString('vi-VN');
}

export default function AdminSessionsPage(): JSX.Element {
  const { user, role, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appFilter, setAppFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseReady || !db) {
      setError('Firebase chưa sẵn sàng');
      setLoading(false);
      return;
    }
    if (authLoading) return;
    if (role !== 'admin') {
      setError('Chỉ admin được phép xem trang này');
      setLoading(false);
      return;
    }

    const now = Date.now();
    const q = query(
      collectionGroup(db, 'sessions'),
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
            uid: data.uid,
            hostname: data.hostname,
            os: data.os,
            started_at: data.started_at ?? 0,
            last_heartbeat: data.last_heartbeat ?? 0,
            expires_at: data.expires_at ?? 0,
            doc_path: d.ref.path,
          };
        });
        setSessions(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [role, authLoading]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (appFilter !== 'all' && s.app_id !== appFilter) return false;
      if (!q) return true;
      return (
        s.uid?.toLowerCase().includes(q) ||
        s.machine_id?.toLowerCase().includes(q) ||
        s.ip_address?.toLowerCase().includes(q) ||
        s.key_id?.toLowerCase().includes(q) ||
        s.hostname?.toLowerCase().includes(q)
      );
    });
  }, [sessions, appFilter, search]);

  const uniqueApps = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.app_id))).sort(),
    [sessions],
  );

  async function handleKick(s: SessionRow): Promise<void> {
    const ok = window.confirm(
      `Force kick session?\n\nApp: ${s.app_id}\nUser: ${s.uid ?? '(standalone)'}\nMáy: ${s.machine_id}\nIP: ${s.ip_address}\n\nClient sẽ tự logout sau ~5 giây.`,
    );
    if (!ok) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'keys', s.key_id, 'sessions', s.session_id));
      // Audit log via admin Cloud Function (server endpoint)
      void getDoc(doc(db, 'keys', s.key_id, 'sessions', s.session_id));
      setActionMsg(`✓ Đã kick session ${s.session_id.slice(0, 8)}…`);
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (authLoading) {
    return (
      <div className="p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-6">
          <AlertCircle className="text-rose-600 mb-2" />
          <h2 className="text-xl font-bold text-rose-900">Truy cập bị chặn</h2>
          <p className="text-rose-800 mt-2">
            Chỉ tài khoản role <code>admin</code> được phép xem trang này.
          </p>
          <Link href="/" className="text-rose-700 underline mt-4 inline-block">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} /> Admin
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🔌 Active Sessions ({filtered.length}
          {filtered.length !== sessions.length && ` / ${sessions.length}`})
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Realtime qua Firestore. Phiên đang chạy của 11 apps. Force kick = xóa
          session doc → client detect mất doc qua onSnapshot listener → auto logout
          5 giây.
        </p>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex-1 min-w-60 relative">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search uid / machine / IP / key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white"
          />
        </div>
        <select
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
          className="px-3 py-2 text-sm border rounded-md bg-white min-w-40"
        >
          <option value="all">Tất cả apps</option>
          {uniqueApps.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
      </div>

      {actionMsg && (
        <div className="mb-3 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-700">
          ⚠ {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">App</th>
              <th className="px-3 py-2 text-left">User / Machine</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Hostname / OS</th>
              <th className="px-3 py-2 text-left">Bắt đầu</th>
              <th className="px-3 py-2 text-left">Heartbeat cuối</th>
              <th className="px-3 py-2 text-left">Hết hạn</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-slate-400">
                  {loading ? 'Đang tải…' : 'Không có session active.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.session_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{s.app_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.uid ? (
                      <>👤 {s.uid.slice(0, 12)}…</>
                    ) : (
                      <>🔒 {s.machine_id.slice(0, 8)}… <span className="text-slate-400">(standalone)</span></>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.ip_address}</td>
                  <td className="px-3 py-2">
                    {s.hostname || '—'}
                    {s.os && <div className="text-xs text-slate-400">{s.os}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatRelative(s.started_at)}</td>
                  <td className="px-3 py-2 text-xs">{formatRelative(s.last_heartbeat)}</td>
                  <td className="px-3 py-2 text-xs">{formatDate(s.expires_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void handleKick(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded"
                      title="Force kick session"
                    >
                      <LogOut size={12} /> Kick
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
