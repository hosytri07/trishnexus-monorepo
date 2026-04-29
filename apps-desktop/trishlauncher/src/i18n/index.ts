/**
 * Phase 14.5.5.e — i18n stub cho Launcher.
 *
 * Không dùng react-i18next/LinguiJS cho lightweight (Launcher UI bé).
 * Dictionary inline + `t(key, lang)` helper. Fallback về key nếu
 * translation miss (dev thấy "UNTRANSLATED_key" sớm).
 *
 * EN phase này incomplete có chủ ý — VN là default, EN chỉ fill sau
 * khi UI stable. Milestone full-i18n sẽ bù sau Phase 14.6 release.
 */

import type { Language } from '../settings.js';

type Dict = Record<string, string>;

const VI: Dict = {
  'topbar.website': 'Mở website',
  'topbar.settings': 'Cài đặt',
  'topbar.check_updates': 'Kiểm tra cập nhật',
  'topbar.check_updates_title':
    'Tải lại danh sách app từ server (bỏ qua cache). Sau đó bấm "Cập nhật" trên card đã cài để tải bản mới.',
  'sysbar.connected': 'Đã kết nối',
  'sysbar.offline': 'Offline — dùng bản gốc',
  'footer.apps_released': 'phần mềm đã phát hành',
  'grid.empty': 'Chưa có ứng dụng nào tương thích với máy này',
  'settings.title': 'Cài đặt',
  'settings.close': 'Đóng',
  'settings.save': 'Lưu',
  'settings.cancel': 'Hủy',
  'settings.theme.label': 'Giao diện',
  'settings.theme.light': 'Sáng',
  'settings.theme.dark': 'Tối',
  'settings.theme.system': 'Theo hệ thống',
  'settings.language.label': 'Ngôn ngữ',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.registry.label': 'Registry source URL',
  'settings.registry.hint': 'Để trống = dùng bản built-in. Chỉ thay đổi nếu bạn biết mình đang làm gì.',
  'settings.registry.placeholder': 'https://...',
  'settings.update.label': 'Tự kiểm tra bản mới',
  'settings.update.off': 'Tắt',
  'settings.update.daily': 'Hàng ngày',
  'settings.update.weekly': 'Hàng tuần',
  'settings.tray.label': 'Khi đóng cửa sổ',
  'settings.tray.toggle': 'Ẩn vào khay hệ thống thay vì thoát',
  'settings.tray.hint':
    'Bật: bấm X sẽ ẩn launcher xuống khay (tray) — click icon tray để mở lại. Tắt: bấm X thoát hẳn.',
  'card.detail': 'Chi tiết',
  'card.installed_badge': 'Đã cài',
  'card.installed_title': 'Đã cài đặt',
  'meta.version': 'Phiên bản',
  'meta.size': 'Dung lượng',
  'meta.access': 'Truy cập',
};

const EN: Dict = {
  'topbar.website': 'Open website',
  'topbar.settings': 'Settings',
  'topbar.check_updates': 'Check for updates',
  'topbar.check_updates_title':
    'Reload app list from server (bypass cache). Then click "Update" on installed card to download new version.',
  'sysbar.connected': 'Connected',
  'sysbar.offline': 'Offline — using bundled',
  'footer.apps_released': 'apps released',
  'grid.empty': 'No compatible apps for this machine',
  'settings.title': 'Settings',
  'settings.close': 'Close',
  'settings.save': 'Save',
  'settings.cancel': 'Cancel',
  'settings.theme.label': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.system': 'System',
  'settings.language.label': 'Language',
  'settings.language.vi': 'Tiếng Việt',
  'settings.language.en': 'English',
  'settings.registry.label': 'Registry source URL',
  'settings.registry.hint': 'Leave empty to use built-in. Only change if you know what you are doing.',
  'settings.registry.placeholder': 'https://...',
  'settings.update.label': 'Auto-check for updates',
  'settings.update.off': 'Off',
  'settings.update.daily': 'Daily',
  'settings.update.weekly': 'Weekly',
  'settings.tray.label': 'When closing window',
  'settings.tray.toggle': 'Hide to system tray instead of quitting',
  'settings.tray.hint':
    'On: clicking X minimizes launcher to tray — click the tray icon to bring it back. Off: clicking X quits the app.',
  'card.detail': 'Details',
  'card.installed_badge': 'Installed',
  'card.installed_title': 'Already installed',
  'meta.version': 'Version',
  'meta.size': 'Size',
  'meta.access': 'Access',
};

const DICTS: Record<Language, Dict> = { vi: VI, en: EN };

/**
 * Translate key theo language hiện tại. Miss → fallback VI → fallback
 * key literal (visible "settings.foo" ở UI = dev bug dễ phát hiện).
 */
export function t(key: string, lang: Language): string {
  return DICTS[lang]?.[key] ?? VI[key] ?? key;
}

/**
 * Factory trả wrapper để component không phải truyền `lang` mỗi lần.
 * Dùng: `const tr = makeT(settings.language); tr('topbar.website')`.
 */
export function makeT(lang: Language): (key: string) => string {
  return (key) => t(key, lang);
}
