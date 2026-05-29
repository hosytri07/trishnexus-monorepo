/**
 * lib/nav-data.tsx — Phase 78 minimal rebuild.
 *
 * Tinh gọn từ 5 groups (~30 routes) → 1 group flat (~7 routes core).
 * Brutalist minimalist style — không group/heading nhiều, navigation phẳng.
 */
import {
  Boxes,
  Download,
  GraduationCap,
  Home,
  LayoutDashboard,
  Newspaper,
  QrCode,
  type LucideIcon,
} from 'lucide-react';

export type NavStatus = 'available' | 'coming' | 'wip';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  status?: NavStatus;
}

export interface NavGroup {
  heading: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [
      { label: 'Trang chủ', href: '/', icon: Home },
      { label: 'Ứng dụng', href: '/apps', icon: Boxes },
      { label: 'Tải về', href: '/downloads', icon: Download },
      { label: 'Blog', href: '/blog', icon: Newspaper },
      { label: 'Hướng dẫn', href: '/huong-dan', icon: GraduationCap },
      { label: 'QR Code', href: '/qr', icon: QrCode },
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
];

export const STATUS_STYLE: Record<NavStatus, { bg: string; fg: string; label: string; dot: string }> = {
  available: { bg: 'rgba(16,185,129,0.14)', fg: '#10B981', label: 'Có', dot: '#10B981' },
  coming: { bg: 'rgba(245,158,11,0.14)', fg: '#F59E0B', label: 'Sắp', dot: '#F59E0B' },
  wip: { bg: 'rgba(244,114,49,0.14)', fg: '#F47231', label: 'Đang xây', dot: '#F47231' },
};

export function NavStatusBadge({ status, compact = false }: { status: NavStatus; compact?: boolean }) {
  if (status === 'available') return null;
  const s = STATUS_STYLE[status];
  if (compact) {
    return (
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: s.dot, boxShadow: `0 0 4px ${s.dot}` }}
        title={s.label}
      />
    );
  }
  return (
    <span
      className="ml-auto inline-flex items-center px-1.5 h-4 rounded text-[10px] font-bold uppercase tracking-wide shrink-0"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
