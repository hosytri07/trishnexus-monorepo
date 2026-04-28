/**
 * /not-found — Phase 19.10 — Custom 404 page.
 *
 * Next.js auto-renders khi không match route nào. Cyber theme với big 404,
 * shortcut tới các page chính + nút "Báo link hỏng".
 */
import Link from 'next/link';
import {
  BookMarked,
  Calculator,
  Compass,
  FileBadge,
  Home,
  Newspaper,
  Search,
  Signpost,
  Sparkles,
  Waypoints,
} from 'lucide-react';

export const metadata = {
  title: '404 — Không tìm thấy trang',
};

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
      <div className="relative inline-block mb-6">
        <span
          className="block text-7xl md:text-9xl font-extrabold tracking-tighter"
          style={{
            color: 'var(--color-accent-primary)',
            textShadow: '0 0 30px rgba(34, 211, 238, 0.35)',
          }}
        >
          404
        </span>
        <Compass
          size={36}
          strokeWidth={1.5}
          className="absolute -top-2 -right-6 md:-right-10"
          style={{
            color: 'var(--color-accent-primary)',
            opacity: 0.6,
            animation: 'spin 8s linear infinite',
          }}
        />
      </div>

      <h1
        className="text-2xl md:text-3xl font-bold mb-3"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Trang không tồn tại
      </h1>
      <p
        className="text-base md:text-lg mb-8 max-w-xl mx-auto leading-relaxed"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Có thể link đã đổi, hoặc anh gõ sai URL. Thử mấy chỗ dưới đây hoặc
        quay về Dashboard.
      </p>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-4">
        <QuickLink href="/" icon={<Home size={20} />} label="Dashboard" />
        <QuickLink href="/blog" icon={<Newspaper size={20} />} label="Blog" />
        <QuickLink href="/downloads" icon={<Sparkles size={20} />} label="Tải về" />
        <QuickLink href="/search" icon={<Search size={20} />} label="Tìm kiếm" />
      </div>

      {/* Database links */}
      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Database VN
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-8">
        <QuickLink href="/bien-bao" icon={<Signpost size={20} />} label="Biển báo" />
        <QuickLink href="/cau-vn" icon={<Waypoints size={20} />} label="Cầu VN" />
        <QuickLink href="/quy-chuan" icon={<BookMarked size={20} />} label="Quy chuẩn" />
        <QuickLink href="/dinh-muc" icon={<Calculator size={20} />} label="Định mức" />
        <QuickLink href="/on-thi-lai-xe" icon={<Compass size={20} />} label="Ôn lái xe" />
        <QuickLink href="/on-thi-chung-chi" icon={<FileBadge size={20} />} label="Ôn chứng chỉ XD" />
      </div>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Nếu link này lẽ ra phải hoạt động,{' '}
        <a
          href="mailto:trishteam.official@gmail.com?subject=Báo%20link%20hỏng"
          className="underline hover:no-underline"
          style={{ color: 'var(--color-accent-primary)' }}
        >
          báo cho team
        </a>
        .
      </p>
    </main>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all hover:scale-[1.02]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <span style={{ color: 'var(--color-accent-primary)' }}>{icon}</span>
      <span
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {label}
      </span>
    </Link>
  );
}
