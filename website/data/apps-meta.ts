/**
 * apps-meta.ts — Phase 78.13.12 — Website enrichment cho 4 app TrishTEAM.
 *
 * SAU CONSOLIDATION Phase 65: chỉ còn 4 desktop apps. 10 app cũ
 * (TrishLauncher / TrishCheck / TrishClean / TrishShortcut / TrishFont /
 *  TrishDrive standalone / TrishLibrary / TrishISO / TrishDesign / TrishOffice)
 * đã GỘP vào TrishWork hoặc TrishUtilities — không còn standalone nữa.
 *
 * Hợp đồng với `apps-registry.json` (schema_version 7). Bảng dưới bổ sung
 * metadata chỉ dùng ở website:
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
  trishwork: {
    release_date: '2026-05-28',
    features: [
      'Design — generator block AutoCAD theo template (biển báo QC41:2024, cấu tạo cầu/cống/đường)',
      'Library — quản lý thư viện block .dwg + .dxf theo 9 nhóm ATGT, sync GitHub Release',
      'ISO — lập hồ sơ ISO chuẩn quốc gia (lý lịch tài sản, bảo trì, kiểm định)',
      'Tương thích AutoCAD 2017–2024',
      'Xuất Excel báo cáo ISO 1-click',
    ],
    accent: '#34D399',
    icon_fallback: 'Compass',
    logo_path: '/logos/TrishWork/icon-256.png',
  },
  trishutilities: {
    release_date: '2026-05-28',
    features: [
      'Clean — dọn rác Temp / Recycle Bin / browser / AutoCAD .bak/.sv$ với preview + undo 7 ngày',
      'Check — system info chi tiết, benchmark CPU/RAM/Disk/Net, Health Score, so MinSpec phần mềm',
      'Downloader — tải file URL / video MXH (yt-dlp) / Google Drive bulk folder',
      'Font — quản lý font tiếng Việt + AutoCAD .shx, pack 1716 font cài 1-click, scanner .dwg detect font thiếu',
      'Shortcut — gom shortcut Desktop/Start Menu, hotkey toàn cục, Ctrl+Space quick launcher',
    ],
    accent: '#FBBF24',
    icon_fallback: 'Wrench',
    logo_path: '/logos/TrishUtilities/icon-256.png',
  },
  trishfinance: {
    release_date: '2026-05-28',
    features: [
      '12 loại business: POS · Nhà trọ · Cafe / F&B · Gym · Karaoke · Photocopy · Sân thể thao · Spa · Kho điện tử · Tài chính cá nhân',
      'Import sao kê ngân hàng (Vietcombank, ACB, BIDV, ...) → tự sync giao dịch',
      'Báo cáo Excel + PDF cuối tháng tự động',
      'Sync Firebase realtime giữa các máy + hoá đơn thermal 58/80mm hoặc PDF',
      'Multi-cửa hàng / multi-business trong 1 tài khoản',
    ],
    accent: '#2563EB',
    icon_fallback: 'Wallet',
    logo_path: '/logos/TrishFinance/icon-256.png',
  },
  trishadmin: {
    release_date: '2026-05-28',
    features: [
      'Quản lý users, keys, sessions, security alerts hệ sinh thái',
      'Schedule Manager + FontPacks Admin + Synced Devices viewer',
      'Audit log mọi thay đổi của admin',
      'GitHub Release auto-upload tích hợp (fontpack/atgt/lisp)',
      'Admin-only (role=admin) — không hiển thị cho user thường',
    ],
    accent: '#F87171',
    icon_fallback: 'ShieldCheck',
    logo_path: '/logos/TrishAdmin/icon-256.png',
  },
};
