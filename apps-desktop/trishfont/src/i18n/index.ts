/**
 * Phase 15.1.d — TrishFont i18n.
 * VN default, EN bù sau. Pattern copy từ TrishCheck.
 */

import type { Language } from '../settings.js';

type Dict = Record<string, string>;

const VI: Dict = {
  // Topbar
  'topbar.tagline': 'Quản lý + cài đặt font tiếng Việt',
  'topbar.settings': 'Cài đặt',
  'topbar.scan_folder': 'Quét folder',
  'topbar.scan_system': 'Font hệ thống',

  // Tab — Phase 15.1.j: rename + reorder (Fontpack đầu tiên)
  'tab.library': 'Cài font thủ công',
  'tab.system': 'Font hệ thống',
  'tab.packs': 'Fontpack TrishTEAM',

  // Packs (FontPack)
  'packs.title': 'Font pack — bộ font do TrishTEAM phát hành',
  'packs.subtitle': 'Tải nhanh các bộ font tiếng Việt + AutoCAD + Unicode đã được kiểm tra. Chỉ cần 1 click — tự download + giải nén.',
  'packs.refresh': 'Tải lại',
  'packs.loading': 'Đang tải danh sách pack từ GitHub...',
  'packs.empty': 'Chưa có pack nào trong manifest.',
  'packs.download': 'Tải pack',
  'packs.installing': 'Đang tải...',
  'packs.downloaded': 'Đã tải',
  'packs.installed': 'Đã cài',
  'packs.update': 'Cập nhật',
  'packs.detail_empty': 'Chọn 1 pack bên trái để xem chi tiết',
  'packs.detail_not_downloaded': 'Pack này chưa được tải. Bấm "⬇ Tải pack" để download.',
  'packs.tab_windows': 'Windows fonts (.ttf/.otf)',
  'packs.tab_shx': 'AutoCAD fonts (.shx)',
  'packs.tab_empty': 'Pack không có font loại này.',
  'packs.files_loading': 'Đang quét file pack...',
  'packs.select_all': 'Chọn tất cả',
  'packs.clear_selection': 'Bỏ chọn',
  'packs.selected': 'đã tick',
  'packs.install_selected': '⬇ Cài đã tick',
  'packs.delete': 'Xóa pack',
  'packs.delete_tooltip': 'Xóa folder pack đã giải nén để tải lại',
  'packs.select_folder': 'Chọn folder này',

  // Install log
  'log.title': 'Tiến trình cài đặt',
  'log.clear': 'Xóa log',

  // Export
  'export.select_all': 'Chọn tất cả',
  'export.clear': 'Bỏ chọn',
  'export.selected': 'đã tick',
  'export.copy': 'Export ra folder',
  // Log empty state
  'log.empty': 'Chưa có log. Sẽ hiện khi bạn cài/export font.',

  // Search + filter
  'search.placeholder': 'Tìm font theo tên...',
  'filter.all': 'Tất cả',
  'filter.vn_only': 'Hỗ trợ tiếng Việt',
  'filter.serif': 'Serif',
  'filter.sans': 'Sans-serif',
  'filter.mono': 'Mono',

  // Preview
  'preview.size': 'Cỡ',
  'preview.sample_label': 'Văn bản preview',
  'preview.empty': 'Quét folder hoặc font hệ thống để xem danh sách',

  // Card
  'card.install': 'Cài vào Windows',
  'card.installing': 'Đang cài...',
  'card.installed': '✓ Đã cài',
  'card.vn': 'VN',
  'card.mono': 'Mono',
  'card.italic': 'Italic',
  'card.weight': 'Weight',

  // Stats
  'stats.found': 'font',
  'stats.errors': 'lỗi',
  'stats.elapsed': 'ms',
  'stats.truncated': 'Đã cắt — thư mục quá lớn',

  // Settings modal
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
  'settings.sample.label': 'Văn bản mẫu (preview)',
  'settings.sample.hint': 'Đoạn text hiện trong card font. Có thể đổi tùy ý.',
  'settings.sample.reset': 'Khôi phục mặc định',

  // Phase 15.1.o — Pack folder + Update check
  'settings.packs.label': 'Quản lý fontpack đã tải',
  'settings.packs.empty': 'Chưa có pack nào tải về',
  'settings.packs.loading': 'Đang đọc thông tin folder...',
  'settings.packs.open_folder': 'Mở folder',
  'settings.packs.clear_all': 'Xóa tất cả',
  'settings.packs.clearing': 'Đang xóa...',
  'settings.packs.confirm_clear':
    'Xóa toàn bộ fontpack đã tải? Sẽ phải tải lại từ đầu nếu cần dùng lại.',
  'settings.packs.hint':
    'Folder lưu pack sau khi giải nén. Xóa giúp giải phóng dung lượng — không ảnh hưởng font đã cài vào hệ thống.',
  'settings.update.label': 'Phiên bản',
  'settings.update.current': 'Phiên bản hiện tại',
  'settings.update.check': 'Kiểm tra cập nhật',
  'settings.update.new_version': 'Có phiên bản mới',
  'settings.update.up_to_date': 'Bạn đang dùng phiên bản mới nhất',
  'settings.update.download': 'Mở trang tải',

  // Install confirmation
  'install.confirm_title': 'Cài font vào Windows?',
  'install.confirm_body':
    'Sẽ copy font vào C:\\Windows\\Fonts (cài hệ thống cho mọi user) và đăng ký vào registry HKLM. Yêu cầu quyền Administrator — nếu chưa, đóng app rồi chuột phải → Run as administrator. Font .shx của AutoCAD sẽ tự copy vào C:\\Program Files\\Autodesk\\AutoCAD <ver>\\Fonts. Mở app khác sau khi cài để dùng font mới.',
  'install.confirm_ok': 'Cài đặt',
  'install.success': 'Đã cài {n} font',
  'install.fail': 'Cài thất bại {n}/{total}',

  // Footer
  'footer.copyright': '© 2026 TrishTEAM',
};

const EN: Dict = {
  'topbar.tagline': 'Vietnamese font manager + installer',
  'topbar.settings': 'Settings',
  'topbar.scan_folder': 'Scan folder',
  'topbar.scan_system': 'System fonts',

  'tab.library': 'Manual install',
  'tab.system': 'System fonts',
  'tab.packs': 'Fontpack TrishTEAM',

  'packs.title': 'Font packs — curated by TrishTEAM',
  'packs.subtitle': 'Download bundles of Vietnamese + AutoCAD + Unicode fonts vetted by TrishTEAM. One click — auto download + extract.',
  'packs.refresh': 'Reload',
  'packs.loading': 'Loading packs from GitHub...',
  'packs.empty': 'No packs in manifest yet.',
  'packs.download': 'Download',
  'packs.installing': 'Downloading...',
  'packs.downloaded': 'Downloaded',
  'packs.installed': 'Installed',
  'packs.update': 'Update',
  'packs.detail_empty': 'Select a pack on the left to see details',
  'packs.detail_not_downloaded': 'This pack is not downloaded yet. Click "⬇ Download" first.',
  'packs.tab_windows': 'Windows fonts (.ttf/.otf)',
  'packs.tab_shx': 'AutoCAD fonts (.shx)',
  'packs.tab_empty': 'No fonts of this type in pack.',
  'packs.files_loading': 'Scanning pack files...',
  'packs.select_all': 'Select all',
  'packs.clear_selection': 'Clear',
  'packs.selected': 'selected',
  'packs.install_selected': '⬇ Install selected',
  'packs.delete': 'Delete pack',
  'packs.delete_tooltip': 'Delete extracted pack folder to re-download',
  'packs.select_folder': 'Select this folder',

  'log.title': 'Install progress',
  'log.clear': 'Clear log',

  'export.select_all': 'Select all',
  'export.clear': 'Clear',
  'export.selected': 'selected',
  'export.copy': 'Export to folder',
  'log.empty': 'No log yet. Will populate when you install/export fonts.',

  'search.placeholder': 'Search font by name...',
  'filter.all': 'All',
  'filter.vn_only': 'Vietnamese support',
  'filter.serif': 'Serif',
  'filter.sans': 'Sans-serif',
  'filter.mono': 'Mono',

  'preview.size': 'Size',
  'preview.sample_label': 'Preview text',
  'preview.empty': 'Scan a folder or system fonts to see list',

  'card.install': 'Install to Windows',
  'card.installing': 'Installing...',
  'card.installed': '✓ Installed',
  'card.vn': 'VN',
  'card.mono': 'Mono',
  'card.italic': 'Italic',
  'card.weight': 'Weight',

  'stats.found': 'fonts',
  'stats.errors': 'errors',
  'stats.elapsed': 'ms',
  'stats.truncated': 'Truncated — folder too large',

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
  'settings.sample.label': 'Sample text (preview)',
  'settings.sample.hint': 'Text shown in font cards. Customizable.',
  'settings.sample.reset': 'Reset to default',

  'settings.packs.label': 'Manage downloaded fontpacks',
  'settings.packs.empty': 'No packs downloaded yet',
  'settings.packs.loading': 'Reading folder info...',
  'settings.packs.open_folder': 'Open folder',
  'settings.packs.clear_all': 'Clear all',
  'settings.packs.clearing': 'Clearing...',
  'settings.packs.confirm_clear':
    'Delete all downloaded fontpacks? You will need to re-download if needed again.',
  'settings.packs.hint':
    'Folder storing extracted packs. Clearing frees disk space — does not affect installed system fonts.',
  'settings.update.label': 'Version',
  'settings.update.current': 'Current version',
  'settings.update.check': 'Check for updates',
  'settings.update.new_version': 'New version available',
  'settings.update.up_to_date': 'You are on the latest version',
  'settings.update.download': 'Open download page',

  'install.confirm_title': 'Install font to Windows?',
  'install.confirm_body':
    'Will copy font to C:\\Windows\\Fonts (system-wide, all users) and register in HKLM. Requires Administrator — if not elevated, close and right-click → Run as administrator. AutoCAD .shx fonts auto-copy to C:\\Program Files\\Autodesk\\AutoCAD <ver>\\Fonts. Reopen other apps to use the new font.',
  'install.confirm_ok': 'Install',
  'install.success': 'Installed {n} font(s)',
  'install.fail': 'Install failed {n}/{total}',

  'footer.copyright': '© 2026 TrishTEAM',
};

const DICTS: Record<Language, Dict> = { vi: VI, en: EN };

export function t(key: string, lang: Language): string {
  return DICTS[lang]?.[key] ?? VI[key] ?? key;
}

export function makeT(lang: Language): (key: string) => string {
  return (key) => t(key, lang);
}
