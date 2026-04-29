/**
 * lib/search/static-sources.ts — Phase 12.1.
 *
 * Nguồn tĩnh cho universal search: 10 app ecosystem, nav shortcuts,
 * actions nội bộ (theme, focus mode, QR, logout). Không cần auth.
 */

import { getAppsForWebsite } from '@/lib/apps';
import { foldVietnamese } from '@trishteam/core/search';
import type { SearchableItem } from './types';

/**
 * Bỏ dấu tiếng Việt để keyword fuzzy match.
 * Phase 14.1: delegate sang core `foldVietnamese` — share với desktop/zalo.
 * Export alias `foldVN` giữ tương thích với callsite cũ trong website.
 */
export const foldVN = foldVietnamese;

/** Build 10 app items từ registry. */
export function buildAppItems(): SearchableItem[] {
  return getAppsForWebsite().map((app) => ({
    id: `app:${app.id}`,
    category: 'app',
    title: app.name,
    subtitle: app.tagline,
    keywords: [
      foldVN(app.name),
      foldVN(app.tagline),
      app.id,
      ...app.platforms,
    ],
    href: `/apps#${app.id}`,
    meta: app.status === 'released' ? `v${app.version}` : app.status,
  }));
}

/** Điều hướng chính của site. */
export const NAV_ITEMS: SearchableItem[] = [
  {
    id: 'nav:home',
    category: 'nav',
    title: 'Trang chủ',
    subtitle: 'Dashboard tổng',
    keywords: ['dashboard', 'home', 'trang chu'],
    href: '/',
  },
  {
    id: 'nav:apps',
    category: 'nav',
    title: 'Danh sách ứng dụng',
    subtitle: '10 app desktop trong hệ sinh thái',
    keywords: ['apps', 'ung dung', 'ecosystem', 'danh sach'],
    href: '/apps',
  },
  {
    id: 'nav:downloads',
    category: 'nav',
    title: 'Tải xuống',
    subtitle: 'Installer Windows/macOS',
    keywords: ['download', 'tai xuong', 'installer'],
    href: '/downloads',
  },
  {
    id: 'nav:login',
    category: 'nav',
    title: 'Đăng nhập / Đăng ký',
    subtitle: 'Email + mật khẩu hoặc Google',
    keywords: ['login', 'dang nhap', 'sign in', 'register', 'dang ky'],
    href: '/login',
  },
  {
    id: 'nav:admin',
    category: 'nav',
    title: 'Admin backend',
    subtitle: 'Chỉ cho tài khoản admin',
    keywords: ['admin', 'quan tri', 'dashboard'],
    href: '/admin',
  },
  // ── Ứng dụng đồng bộ ──
  {
    id: 'nav:thu-vien',
    category: 'nav',
    title: 'Thư viện',
    subtitle: 'Đồng bộ thư viện cá nhân',
    keywords: ['library', 'thu vien', 'sach', 'collection'],
    href: '/thu-vien',
  },
  {
    id: 'nav:ghi-chu',
    category: 'nav',
    title: 'Ghi chú',
    subtitle: 'QuickNotes đồng bộ',
    keywords: ['notes', 'ghi chu', 'note'],
    href: '/ghi-chu',
  },
  {
    id: 'nav:tai-lieu',
    category: 'nav',
    title: 'Tài liệu',
    subtitle: 'Document sync',
    keywords: ['docs', 'tai lieu', 'document'],
    href: '/tai-lieu',
  },
  // ── Học tập ──
  {
    id: 'nav:on-thi-lai-xe',
    category: 'nav',
    title: 'Ôn thi bằng lái xe',
    subtitle: 'A1/B1/B2/C — đề random',
    keywords: ['lai xe', 'driving', 'license', 'A1', 'B1', 'B2', 'C', 'on thi'],
    href: '/on-thi-lai-xe',
  },
  {
    id: 'nav:on-thi-chung-chi',
    category: 'nav',
    title: 'Ôn thi chứng chỉ Xây dựng',
    subtitle: 'Định giá / Giám sát / ATLĐ',
    keywords: ['chung chi', 'xay dung', 'cert', 'dinh gia', 'giam sat', 'an toan'],
    href: '/on-thi-chung-chi',
  },
  {
    id: 'nav:tin-hoc-vp',
    category: 'nav',
    title: 'Ôn thi Tin học văn phòng',
    subtitle: 'Word / Excel / PowerPoint / Mạng',
    keywords: ['tin hoc', 'IT', 'IC3', 'MOS', 'word', 'excel', 'powerpoint', 'office'],
    href: '/tin-hoc-vp',
  },
  {
    id: 'nav:tieng-anh',
    category: 'nav',
    title: 'Ôn thi Tiếng Anh',
    subtitle: 'Grammar / Vocab / Reading / Business',
    keywords: ['english', 'tieng anh', 'TOEIC', 'IELTS', 'grammar', 'vocabulary'],
    href: '/tieng-anh',
  },
  // ── Database ──
  {
    id: 'nav:bien-bao',
    category: 'nav',
    title: 'Biển báo QC41:2024',
    subtitle: 'Biển báo giao thông VN — 451 loại',
    keywords: ['bien bao', 'sign', 'QC41', 'giao thong', 'traffic'],
    href: '/bien-bao',
  },
  {
    id: 'nav:cau-vn',
    category: 'nav',
    title: 'Cầu Việt Nam',
    subtitle: 'Database 7549 cây cầu — kèm bản đồ',
    keywords: ['cau', 'bridge', 'cau VN', 'database cau'],
    href: '/cau-vn',
  },
  {
    id: 'nav:duong-vn',
    category: 'nav',
    title: 'Đường Việt Nam',
    subtitle: 'Cao tốc + QL + vành đai',
    keywords: ['duong', 'road', 'cao toc', 'quoc lo', 'vanh dai', 'highway'],
    href: '/duong-vn',
  },
  {
    id: 'nav:quy-chuan',
    category: 'nav',
    title: 'Quy chuẩn / Tiêu chuẩn',
    subtitle: 'QCVN, TCVN, Thông tư, NĐ',
    keywords: ['quy chuan', 'TCVN', 'QCVN', 'tieu chuan', 'thong tu', 'nghi dinh', 'standard'],
    href: '/quy-chuan',
  },
  {
    id: 'nav:dinh-muc',
    category: 'nav',
    title: 'Định mức xây dựng',
    subtitle: 'QĐ 1776/2007 — hao phí',
    keywords: ['dinh muc', '1776', 'hao phi', 'du toan', 'don gia'],
    href: '/dinh-muc',
  },
  {
    id: 'nav:vat-lieu',
    category: 'nav',
    title: 'Vật liệu xây dựng',
    subtitle: 'Thép, xi măng, bê tông, gạch, đá',
    keywords: ['vat lieu', 'thep', 'xi mang', 'be tong', 'gach', 'da', 'material'],
    href: '/vat-lieu',
  },
  // ── Công cụ — phần lớn đã có nav, thêm các tool mới ──
  {
    id: 'nav:vn2000',
    category: 'nav',
    title: 'VN2000 ↔ WGS84 Converter',
    subtitle: 'Chuyển đổi tọa độ Helmert 7-param',
    keywords: ['VN2000', 'WGS84', 'toa do', 'helmert', 'GPS', 'coordinate'],
    href: '/cong-cu/vn2000',
  },
  {
    id: 'nav:ung-ho',
    category: 'nav',
    title: 'Ủng hộ tôi — Quỹ từ thiện VN',
    subtitle: '3 quỹ chính thức + VietQR',
    keywords: ['ung ho', 'donate', 'tu thien', 'charity', 'quy'],
    href: '/ung-ho',
  },
  {
    id: 'nav:blog',
    category: 'nav',
    title: 'Blog',
    subtitle: 'Bài viết kỹ thuật + tin tức',
    keywords: ['blog', 'bai viet', 'tin tuc', 'post', 'article'],
    href: '/blog',
  },
];

/** Action nội tại site — cần wire runtime ở consumer (hook). */
export const ACTION_KEYS = {
  toggleTheme: 'action:toggle-theme',
  toggleFocus: 'action:toggle-focus',
  openKeyboardHelp: 'action:keyboard-help',
  jumpQR: 'action:qr-generator',
  jumpNotes: 'action:quick-notes',
  jumpCalendar: 'action:calendar',
  refreshDashboard: 'action:refresh',
} as const;

export type ActionKey = keyof typeof ACTION_KEYS;

/** Action metadata (title/subtitle/keywords). Runtime gắn `run` ở hook. */
export const ACTION_META: Record<
  ActionKey,
  Omit<SearchableItem, 'id' | 'run'>
> = {
  toggleTheme: {
    category: 'action',
    title: 'Đổi giao diện (Dark ↔ Light)',
    subtitle: 'Ctrl+Shift+L',
    keywords: ['theme', 'dark', 'light', 'giao dien', 'doi theme'],
  },
  toggleFocus: {
    category: 'action',
    title: 'Bật / tắt Focus Mode',
    subtitle: 'Ẩn nav để tập trung',
    keywords: ['focus', 'tap trung', 'zen'],
  },
  openKeyboardHelp: {
    category: 'action',
    title: 'Xem phím tắt',
    subtitle: 'Phím ?',
    keywords: ['keyboard', 'shortcut', 'phim tat', 'help'],
  },
  jumpQR: {
    category: 'action',
    title: 'Tạo QR code',
    subtitle: 'Mở QR Generator widget',
    keywords: ['qr', 'barcode', 'ma vach', 'generate'],
    href: '/#qr',
  },
  jumpNotes: {
    category: 'action',
    title: 'Ghi chú nhanh',
    subtitle: 'Mở QuickNotes widget',
    keywords: ['notes', 'ghi chu', 'scratchpad'],
    href: '/#notes',
  },
  jumpCalendar: {
    category: 'action',
    title: 'Xem lịch',
    subtitle: 'Sự kiện & ngày lễ',
    keywords: ['calendar', 'lich', 'su kien', 'event'],
    href: '/#calendar',
  },
  refreshDashboard: {
    category: 'action',
    title: 'Tải lại dashboard',
    subtitle: 'Clear cache widget',
    keywords: ['refresh', 'reload', 'tai lai'],
  },
};

/** Build action items với `run` callback (consumer truyền vào). */
export function buildActionItems(
  runners: Partial<Record<ActionKey, () => void>>,
): SearchableItem[] {
  return (Object.keys(ACTION_META) as ActionKey[]).map((key) => {
    const meta = ACTION_META[key];
    return {
      ...meta,
      id: ACTION_KEYS[key],
      run: runners[key],
    } as SearchableItem;
  });
}

/** Tổng hợp static items không cần runner (subtitle + href đủ dùng). */
export function buildStaticItems(): SearchableItem[] {
  return [...buildAppItems(), ...NAV_ITEMS];
}
