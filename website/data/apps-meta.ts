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
    release_date: null,
    features: [
      'Cài + update toàn bộ hệ sinh thái qua 1 entry',
      'Auto-check version qua registry JSON',
      'Rollback version an toàn khi update lỗi',
      'Dark/light sync với OS',
      'Single sign-on cho 10 app cùng lúc',
    ],
    accent: '#667EEA',
    icon_fallback: 'Rocket',
    logo_path: '/logos/TrishLauncher/icon-256.png',
  },
  trishdesign: {
    release_date: null,
    features: [
      'Dự toán công trình theo định mức mới nhất',
      'Tính kết cấu dầm/cột/móng nhanh',
      'Tích hợp bản đồ VN2000 + chuyển hệ tọa độ',
      'Xuất CAD trực tiếp (không qua Excel)',
      'Thư viện ATGT + biển báo QC41:2024',
    ],
    accent: '#10B981',
    icon_fallback: 'Compass',
    logo_path: '/logos/TrishDesign/icon-256.png',
  },
  trishlibrary: {
    release_date: null,
    features: [
      'Thư viện PDF / docx / link tập trung',
      'Local-first + cloud sync qua Firestore',
      'Full-text search qua SQLite FTS5',
      'Tag + folder + smart collection',
      'Share link read-only giữa team',
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
      'Soạn thảo .docx / .pdf / .md / .html',
      'PDF tools: merge, split, sign, watermark',
      'OCR nhanh cho PDF scan (tiếng Việt)',
      'Export về nhiều format không đổi layout',
      'Template engineering có sẵn',
    ],
    accent: '#764BA2',
    icon_fallback: 'FileText',
    logo_path: '/logos/TrishType/icon-256.png',
  },
  trishcheck: {
    release_date: null,
    features: [
      'Quét cấu hình máy (CPU/RAM/GPU/storage)',
      'So với yêu cầu Revit / AutoCAD / Photoshop…',
      'Cảnh báo bottleneck trước khi mua hardware',
      'Benchmark cho cộng đồng kỹ sư VN',
      'Export report PDF gửi IT',
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
    release_date: null,
    features: [
      'Quản lý thư viện ảnh theo folder + tag',
      'Đọc EXIF: camera / ISO / ngày chụp',
      'Face grouping local (không upload cloud)',
      'Backup cloud có option encrypt',
      'Duplicate detection nhanh qua perceptual hash',
    ],
    accent: '#EC4899',
    icon_fallback: 'Image',
    logo_path: '/logos/TrishImage/icon-256.png',
  },
};
