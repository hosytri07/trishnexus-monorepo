'use client';

/**
 * /admin layout — Phase 11.8.1.
 *
 * Gate role: chỉ `role === 'admin'` mới được xem. Nếu:
 *   - loading    → spinner
 *   - guest      → redirect /login?next=/admin
 *   - non-admin  → 403 page (không redirect, nói rõ lý do + link Home)
 *
 * Sidebar left: nav cố định. Content chính bên phải full-height scroll.
 * Responsive: dưới md ẩn sidebar, hiện menu inline ở top.
 */
import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  History,
  ArrowLeft,
  Shield,
  Loader2,
  Sparkles,
  Gauge,
  Bug,
  KeyRound,
  HardDrive,
  Signpost,
  Waypoints,
  Newspaper,
  Library,
  Database,
  Package,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Người dùng', icon: Users },
  { href: '/admin/keys', label: 'Activation Keys', icon: KeyRound },
  { href: '/admin/announcements', label: 'Thông báo', icon: Megaphone },
  { href: '/admin/reindex', label: 'Semantic', icon: Sparkles },
  { href: '/admin/vitals', label: 'Vitals', icon: Gauge },
  { href: '/admin/errors', label: 'Lỗi', icon: Bug },
  { href: '/admin/audit', label: 'Nhật ký', icon: History },
  { href: '/admin/storage', label: 'Storage', icon: HardDrive },
  { href: '/admin/posts', label: 'Bài blog', icon: Newspaper },
  { href: '/admin/library', label: 'Thư viện TrishTEAM', icon: Library },
  { href: '/admin/databases', label: 'Database VN', icon: Database },
  { href: '/admin/apps', label: 'Apps Desktop', icon: Package },
  { href: '/admin/signs', label: 'Ảnh biển báo', icon: Signpost },
  { href: '/admin/bridges', label: 'Ảnh cầu', icon: Waypoints },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { role, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guest → redirect /login
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login?next=/admin');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2
          className="animate-spin"
          size={24}
          style={{ color: 'var(--color-accent-primary)' }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // effect đang redirect
  }

  // Non-admin user → 403
  if (role !== 'admin') {
    return (
      <main className="max-w-xl mx-auto px-6 py-16 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: 'var(--color-surface-muted)' }}
        >
          <Shield size={28} style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          403 — Chỉ dành cho Admin
        </h1>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Tài khoản của bạn chưa có quyền truy cập khu vực quản trị. Nếu đây
          là nhầm lẫn, liên hệ Trí để được cấp quyền.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-5 h-10 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            background: 'var(--color-accent-gradient)',
            color: '#ffffff',
          }}
        >
          <ArrowLeft size={14} strokeWidth={2.25} />
          Về dashboard
        </Link>
      </main>
    );
  }

  // Admin layout
  return (
    <div className="max-w-[88rem] mx-auto px-6 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="md:sticky md:top-24 md:self-start">
          <div
            className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide inline-flex items-center gap-1.5"
            style={{
              background: 'var(--color-surface-muted)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Shield size={12} strokeWidth={2.5} />
            Quản trị
          </div>
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1">
            {NAV.map((item) => {
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                  style={{
                    background: active
                      ? 'var(--color-surface-muted)'
                      : 'transparent',
                    color: active
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                  }}
                >
                  <Icon size={15} strokeWidth={2.25} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
