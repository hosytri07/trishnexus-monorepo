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
