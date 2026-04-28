/**
 * apps-meta.ts — WEBSITE-SIDE enrichment cho apps-registry.json.
 *
 * apps-registry.json là contract với desktop launcher (trishnexus-launcher-registry),
 * không nên modify structure. Bảng dưới bổ sung metadata chỉ dùng ở website:
 *   - release_date:  ISO date (null nếu chưa release)
 *   - features:      3-6 bullet cho App Detail Modal
 *   - accent:        CSS color for app tile (gradient hint)
 *   - icon_fallback: lucide icon name khi logo_path 404
 *   - logo_path:     PNG logo trong /public/logos/<Name>/icon-256.png
 *
 * Sync với apps-registry.json khi thêm/xóa app.
 */

export type AppMeta = {
  release_date: string | null;
  features: string[];
  accent: string;
  icon_fallback: string;
  logo_path: string;
};

export const APP_META: Record<string, AppMeta> = {
  trishfont: {
    release_date: null,
    features: [
      'Quản lý thư viện font theo folder + tag',
      'Preview live nhiều size / weight cùng lúc',
      'Hỗ trợ AutoCAD .shx (hiếm app nào làm)',
      'Cài/gỡ font hàng loạt không cần admin',
      'Search fuzzy theo tên + phân loại Serif/Sans/Mono',
    ],
    accent: '#F59E0B',
    icon_fallback: 'Type',
    logo_path: '/logos/TrishFont/icon-256.png',
  },
  trishlauncher: {
    release_date: '2026-04-25',
    features: [
      'Quản lý + cài đặt 9 ứng dụng TrishTEAM qua 1 entry',
      'Auto-detect app đã cài + Quick-launch từ system tray',
      'Tự fetch registry remote (admin update apps không cần ship lại)',
      'Hỗ trợ song ngữ Việt / English',
      'Theme sáng / tối / theo hệ thống',
    ],
    accent: '#667EEA',
    icon_fallback: 'Rocket',
    logo_path: '/logos/TrishLauncher/icon-256.png',
  },
  trishdesign: {
    release_date: null,
    features: [
      'Quản lý dự án + danh mục hồ sơ KS/TK/HC/NT/TT đầy đủ',
      'Vẽ hiện trạng hư hỏng MĐ + ATGT trực tiếp lên AutoCAD',
      'Khảo sát: ảnh / PDF sổ hiện trạng → AI OCR → Excel',
      'Bảng tính kết cấu (dầm/móng/cọc) + dự toán theo định mức',
      'Quản lý thư viện AutoLISP + Chatbot AI vẽ CAD (MCP)',
      'Tiện ích GIS: chuyển VN2000 ↔ WGS84 + quản lý mốc tọa độ',
    ],
    accent: '#FF5722',
    icon_fallback: 'Compass',
    logo_path: '/logos/TrishDesign/icon-256.png',
  },
  trishlibrary: {
    release_date: '2026-04-27',
    features: [
      '4 module trong 1 app: 📚 Thư viện · 📝 Ghi chú · 📄 Tài liệu · 🖼 Ảnh',
      'Thư viện: scan folder + Tantivy full-text search + LAN/UNC paths + annotation',
      'Ghi chú: TipTap rich text + 10 templates + daily note + backlinks + sticky note',
      'Tài liệu: 22 templates VN + 13 PDF tools (merge / split / OCR / encrypt) + auto ToC',
      'Ảnh: 5 view modes + EXIF + lightbox + bulk rename + batch progress',
      'Cross-module: Ctrl+K global search · Ctrl+Shift+N sticky · Backup + Auto-backup',
      'Sync 2-chiều với Firestore qua tài khoản đã activate (key 16 ký tự)',
    ],
    accent: '#3B82F6',
    icon_fallback: 'Library',
    logo_path: '/logos/TrishLibrary/icon-256.png',
  },
  trishnote: {
    release_date: null,
    features: [
      'Ghi chú markdown + rich text đồng bộ',
      'Checklist / deadline / project board',
      'Sync desktop ↔ website real-time',
      'Offline-first, merge conflict tự động',
      'Tag + backlink kiểu Obsidian',
    ],
    accent: '#06B6D4',
    icon_fallback: 'NotebookPen',
    logo_path: '/logos/TrishNote/icon-256.png',
  },
  trishtype: {
    release_date: null,
    features: [
      'Code/text editor offline với Monaco engine (VSCode core)',
      'Multi-caret: Alt+Click · Ctrl+D select next · Ctrl+Shift+L select all',
      'Syntax highlight 50+ ngôn ngữ tự động (.js/.ts/.py/.rs/.md/.json/.html...)',
      'Tab system + file tree workspace + recent files',
      'Find/Replace với regex (Ctrl+F, Ctrl+H)',
      'Markdown preview split view + auto-save',
      'Theme dark/light/auto · 5 fonts · word wrap · minimap',
    ],
    accent: '#0EA5E9',
    icon_fallback: 'Code2',
    logo_path: '/logos/TrishType/icon-256.png',
  },
  trishcheck: {
    release_date: '2026-04-25',
    features: [
      'Đọc thông tin máy: OS, CPU, RAM, GPU (onboard + rời), ổ đĩa, mạng',
      'Pin laptop: % sạc + sức khỏe pin (chai bao nhiêu)',
      'Top 5 tiến trình tiêu thụ RAM / CPU',
      'Benchmark CPU đa luồng + Memory bandwidth + Disk read/write',
      'So sánh máy với 25 phần mềm phổ biến (Office, Adobe, AutoCAD, ...) — admin update remote',
      'Export báo cáo JSON / Markdown + lưu lịch sử snapshot',
    ],
    accent: '#EF4444',
    icon_fallback: 'Activity',
    logo_path: '/logos/TrishCheck/icon-256.png',
  },
  trishsearch: {
    release_date: null,
    features: [
      'Search file local bằng FTS5 (nhanh gấp 10 Windows)',
      'Search Firestore cloud (notes, library, posts)',
      'Regex + glob + natural language',
      'Preview kết quả inline không mở app',
      'Hotkey Ctrl+Space gọi nhanh khắp OS',
    ],
    accent: '#8B5CF6',
    icon_fallback: 'Search',
    logo_path: '/logos/TrishSearch/icon-256.png',
  },
  trishclean: {
    release_date: null,
    features: [
      'Scan .bak / .tmp / cache / Recycle Bin / logs',
      'Preview từng file trước khi xoá',
      'Safe mode — không đụng system files',
      'Schedule clean hàng tuần auto',
      'Ước tính dung lượng giải phóng trước khi chạy',
    ],
    accent: '#F59E0B',
    icon_fallback: 'Trash2',
    logo_path: '/logos/TrishClean/icon-256.png',
  },
  trishimage: {
    release_date: '2026-04-27',
    features: [
      'Quản lý ảnh + video local (JPG/PNG/WEBP/GIF/BMP/TIFF + MP4/MOV/AVI/MKV/WEBM)',
      '5 chế độ xem giống Windows Explorer (Cực lớn / Lớn / Vừa / Nhỏ / Chi tiết)',
      'EXIF đầy đủ: camera, ngày chụp, GPS map link',
      'Tag + ghi chú per-photo · đổi tên file thật trên ổ',
      'Hỗ trợ LAN UNC (\\\\server\\share) — quản lý ảnh máy khác trong mạng',
      'Similar photos (cùng ngày ±1) · Timeline year/month',
      'Progress bar per-file giống Windows file copy · 100% offline',
    ],
    accent: '#EC4899',
    icon_fallback: 'Image',
    logo_path: '/logos/TrishImage/icon-256.png',
  },
};
