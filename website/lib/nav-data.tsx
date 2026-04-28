/**
 * lib/nav-data.tsx — Phase 19.15.
 *
 * Đã bỏ "Ảnh" (chỉ desktop, không sync web được).
 * Thêm 3 công cụ mới + 2 mục học tập mới.
 */
import {
  BookMarked,
  BookOpen,
  Calculator,
  Calendar,
  Car,
  Code2,
  Compass,
  FileBadge,
  FileText,
  Hash,
  HeartPulse,
  Home,
  KeyRound,
  Languages,
  Library,
  Link2,
  NotebookPen,
  Package,
  QrCode,
  Route,
  Ruler,
  Signpost,
  Timer,
  Waypoints,
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
    items: [{ label: 'Dashboard', href: '/', icon: Home }],
  },
  {
    heading: 'Ứng dụng đồng bộ',
    items: [
      { label: 'Thư viện', href: '/thu-vien', icon: Library, status: 'available' },
      { label: 'Ghi chú', href: '/ghi-chu', icon: NotebookPen, status: 'available' },
      { label: 'Tài liệu', href: '/tai-lieu', icon: FileText, status: 'available' },
    ],
  },
  {
    heading: 'Học tập',
    items: [
      { label: 'Ôn thi lái xe', href: '/on-thi-lai-xe', icon: Car, status: 'available' },
      { label: 'Chứng chỉ XD', href: '/on-thi-chung-chi', icon: FileBadge, status: 'available' },
      { label: 'Tin học văn phòng', href: '/tin-hoc-vp', icon: BookOpen, status: 'available' },
      { label: 'Tiếng Anh', href: '/tieng-anh', icon: Languages, status: 'available' },
    ],
  },
  {
    heading: 'Database',
    items: [
      { label: 'Biển báo QC41:2024', href: '/bien-bao', icon: Signpost, status: 'available' },
      { label: 'Cầu Việt Nam', href: '/cau-vn', icon: Waypoints, status: 'available' },
      { label: 'Đường Việt Nam', href: '/duong-vn', icon: Route, status: 'available' },
      { label: 'Quy chuẩn / TCVN', href: '/quy-chuan', icon: BookMarked, status: 'available' },
      { label: 'Định mức + Đơn giá', href: '/dinh-muc', icon: Calculator, status: 'available' },
      { label: 'Vật liệu XD', href: '/vat-lieu', icon: Package, status: 'available' },
    ],
  },
  {
    heading: 'Công cụ',
    items: [
      { label: 'Pomodoro', href: '/cong-cu/pomodoro', icon: Timer },
      { label: 'Máy tính tài chính', href: '/cong-cu/may-tinh-tai-chinh', icon: Calculator },
      { label: 'QR Code', href: '/cong-cu/qr-code', icon: QrCode },
      { label: 'Đơn vị quy đổi', href: '/cong-cu/don-vi', icon: Ruler },
      { label: 'Tính ngày', href: '/cong-cu/tinh-ngay', icon: Calendar },
      { label: 'BMI', href: '/cong-cu/bmi', icon: HeartPulse },
      { label: 'Rút gọn link', href: '/cong-cu/rut-gon-link', icon: Link2 },
      { label: 'Tạo mật khẩu', href: '/cong-cu/mat-khau', icon: KeyRound },
      { label: 'Base64', href: '/cong-cu/base64', icon: Code2 },
      { label: 'Hash generator', href: '/cong-cu/hash', icon: Hash },
      { label: 'VN2000 ↔ WGS84', href: '/cong-cu/vn2000', icon: Compass, status: 'available' },
    ],
  },
];

export const STATUS_STYLE: Record<NavStatus, { bg: string; fg: string; label: string; dot: string }> = {
  available: { bg: 'rgba(16,185,129,0.14)', fg: '#10B981', label: 'Có', dot: '#10B981' },
  coming: { bg: 'rgba(245,158,11,0.14)', fg: '#F59E0B', label: 'Sắp', dot: '#F59E0B' },
  wip: { bg: 'rgba(244,114,49,0.14)', fg: '#F47231', label: 'Đang xây', dot: '#F47231' },
};

export function NavStatusBadge({ status, compact = false }: { status: NavStatus; compact?: boolean }) {
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
