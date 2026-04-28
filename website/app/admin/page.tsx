'use client';

/**
 * /admin — Admin Dashboard (Phase 11.8.2).
 *
 * Stat cards đọc Firestore count (getCountFromServer) để giảm cost:
 *   - Tổng user
 *   - Số admin
 *   - Announcements đang active
 *   - Events 24h gần đây (qua collection-group query + where createdAt > now-24h)
 *
 * Không subscribe realtime — chỉ fetch 1 lần khi mount (admin hiếm khi
 * cần live update, refresh page là được).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Megaphone,
  Activity,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  collection,
  collectionGroup,
  getCountFromServer,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Stat {
  key: string;
  label: string;
  value: number | null;
  icon: typeof Users;
  color: string;
  hint?: string;
}

async function fetchStats() {
  if (!db) throw new Error('Firebase chưa cấu hình');
  const since24h = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

  // Phase 19.18.3 — events24h tách riêng try/catch vì collectionGroup query
  // cần fieldOverride (deploy chậm hoặc chưa build xong index).
  // 3 query đầu chắc chắn work; events24h fail → show null thay vì crash UI.
  const [usersAll, admins, annActive] = await Promise.all([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(query(collection(db, 'users'), where('role', '==', 'admin'))),
    getCountFromServer(query(collection(db, 'announcements'), where('active', '==', true))),
  ]);

  let events24hCount: number | null = null;
  try {
    const events24h = await getCountFromServer(
      query(collectionGroup(db, 'events'), where('createdAt', '>=', since24h)),
    );
    events24hCount = events24h.data().count;
  } catch (err) {
    console.warn('[admin/dashboard] events24h fail (cần fieldOverride events.createdAt):', err);
    // events24h vẫn null → UI hiện "—" không phá dashboard
  }

  return {
    users: usersAll.data().count,
    admins: admins.data().count,
    announcements: annActive.data().count,
    events24h: events24hCount,
  };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stat[]>([
    { key: 'users', label: 'Tổng số user', value: null, icon: Users, color: '#3B82F6' },
    {
      key: 'admins',
      label: 'Admin',
      value: null,
      icon: ShieldCheck,
      color: '#10B981',
    },
    {
      key: 'announcements',
      label: 'Thông báo đang bật',
      value: null,
      icon: Megaphone,
      color: '#F59E0B',
    },
    {
      key: 'events24h',
      label: 'Hoạt động 24h',
      value: null,
      icon: Activity,
      color: '#8B5CF6',
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await fetchStats();
      setStats((prev) =>
        prev.map((x) => ({
          ...x,
          value:
            x.key === 'users'
              ? s.users
              : x.key === 'admins'
              ? s.admins
              : x.key === 'announcements'
              ? s.announcements
              : s.events24h,
        })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Admin Dashboard
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Tổng quan hệ thống TrishTEAM — stats đọc trực tiếp từ Firestore.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-primary)',
          }}
          aria-label="Tải lại stats"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </button>
      </header>

      {err ? (
        <div
          className="p-4 rounded-md text-sm"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#B91C1C',
          }}
        >
          Lỗi tải stats: {err}. Kiểm tra Firestore rules đã deploy + admin custom
          claim còn hiệu lực (logout-login lại nếu vừa seed).
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.key}
              className="p-4 rounded-lg"
              style={{
                background: 'var(--color-surface-primary)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0"
                  style={{ background: `${s.color}22`, color: s.color }}
                >
                  <Icon size={18} strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-xs uppercase tracking-wide"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {s.label}
                  </p>
                  <p
                    className="text-2xl font-bold mt-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {s.value === null ? '—' : s.value.toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div
        className="rounded-lg p-5"
        style={{
          background: 'var(--color-surface-primary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <h2
          className="text-sm font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Truy cập nhanh
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink href="/admin/users" icon={Users} label="Quản lý user" desc="Xem danh sách, gán quyền admin" />
          <QuickLink
            href="/admin/announcements"
            icon={Megaphone}
            label="Tạo thông báo"
            desc="Push banner tới toàn bộ user"
          />
          <QuickLink
            href="/admin/audit"
            icon={Activity}
            label="Nhật ký hoạt động"
            desc="Feed event toàn hệ thống"
          />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: typeof Users;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 p-3 rounded-md transition-colors"
      style={{ border: '1px solid var(--color-border-subtle)' }}
    >
      <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-md shrink-0"
        style={{ background: 'var(--color-surface-muted)' }}
      >
        <Icon
          size={16}
          strokeWidth={2.25}
          style={{ color: 'var(--color-accent-primary)' }}
        />
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold flex items-center gap-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {label}
          <ArrowRight
            size={12}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </p>
        <p
          className="text-xs mt-0.5 leading-snug"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {desc}
        </p>
      </div>
    </Link>
  );
}
