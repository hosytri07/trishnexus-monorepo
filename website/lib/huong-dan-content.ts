/**
 * Phase 39.1 — Hướng dẫn 11 apps TrishTEAM.
 *
 * Content array cho /huong-dan/[slug] dynamic route. Mỗi app có:
 *   - title, slug, icon
 *   - intro (1-2 câu giới thiệu)
 *   - sections (mảng heading + body markdown-like)
 *   - features (list bullet)
 *   - keyType: 'free' | 'standalone' | 'account'
 */

export interface GuideSection {
  heading: string;
  body: string;
}

export interface AppGuide {
  slug: string;
  title: string;
  icon: string;
  shortDesc: string;
  keyType: 'free' | 'standalone' | 'account';
  intro: string;
  sections: GuideSection[];
  features: string[];
  downloadUrl?: string;
  webUrl?: string;
}

export const APP_GUIDES: AppGuide[] = [
  {
    slug: 'trishlauncher',
    title: 'TrishLauncher',
    icon: '🚀',
    shortDesc: 'Hub trung tâm — cài đặt + chạy 11 app TrishTEAM',
    keyType: 'free',
    intro:
      'TrishLauncher là entry point duy nhất bạn cần cài để khám phá hệ sinh thái TrishTEAM. App tự động phát hiện các app đã cài, giúp tải/cập nhật/khởi chạy trong 1 nơi — không cần truy cập website mỗi lần.',
    sections: [
      {
        heading: 'Cài đặt lần đầu',
        body: 'Tải TrishLauncher_x.x.x_x64-setup.exe từ trang chủ TrishTEAM, chạy installer, ứng dụng tự sinh shortcut Desktop + Start Menu. Lần đầu mở sẽ fetch danh mục 11 apps online; nếu offline sẽ dùng seed local.',
      },
      {
        heading: 'Cài app khác từ Launcher',
        body: 'Mỗi card app hiển thị badge: 🆓 Free / 🔒 Key máy / 🗝 Key tài khoản. Click "Tải về" → Launcher mở browser tải installer. Sau khi cài, Launcher tự nhận diện và chuyển button sang "🚀 Mở".',
      },
      {
        heading: 'System tray',
        body: 'TrishLauncher có thể minimize-to-tray (mặc định OFF, bật trong Cài đặt). Khi minimize, click tray icon → mở quick launcher menu với danh sách apps đã cài.',
      },
    ],
    features: [
      'Hub 11 apps trong 1 nơi',
      'Auto-detect app đã cài + cập nhật version',
      'Quick launch từ system tray',
      'Offline-first (seed registry)',
      'Dark/Light theme + emerald accent',
    ],
    downloadUrl: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlauncher-v1.0.0',
  },
  {
    slug: 'trishlibrary',
    title: 'TrishLibrary',
    icon: '📚',
    shortDesc: 'All-in-one: Thư viện · Note · Tài liệu · Ảnh + PDF Tools 13 chức năng',
    keyType: 'account',
    intro:
      'TrishLibrary gộp 4 module Thư viện / Ghi chú / Tài liệu / Ảnh thành 1 app duy nhất. Có 13 PDF Tools chạy 100% offline qua Rust (không cần Adobe), full-text search Tantivy + 2-way sync Firebase.',
    sections: [
      {
        heading: 'Đăng nhập + Kích hoạt key',
        body: 'TrishLibrary cần đăng nhập Firebase (email/Google) + nhập key tài khoản (16 ký tự admin cấp). Key bind vào tài khoản — login máy khác sẽ kick session cũ tự động sau 5s.',
      },
      {
        heading: '13 PDF Tools',
        body: 'Vào tab "📄 Tài liệu" → "PDF Tools": Info, Merge, Binder (gộp + bookmark), Split, Extract, Delete pages, Rotate, Images→PDF, Watermark, Page numbers, Encrypt/Decrypt (qpdf), OCR (Tesseract), Trích ảnh.',
      },
      {
        heading: 'PDF Binder (Phase 38.2)',
        body: 'Gộp nhiều PDF theo thứ tự + tự tạo bookmark sidebar. Phù hợp hồ sơ nghiệm thu/hoàn công có nhiều PDF nhỏ cần đóng thành 1 bộ. Mở PDF kết quả ở Acrobat/Foxit/Edge sẽ thấy panel bookmark.',
      },
      {
        heading: 'Tìm kiếm full-text',
        body: 'TrishLibrary index nội dung PDF/DOCX/MD/TXT qua Tantivy 0.22 (BM25). Tìm kiếm tiếng Việt có dấu / không dấu đều match. Index re-build offline.',
      },
    ],
    features: [
      '4 module gộp: Thư viện · Note · Tài liệu · Ảnh',
      '13 PDF Tools offline (lopdf + printpdf + Tesseract)',
      'Full-text search Tantivy BM25',
      'Sync 2-way Firebase',
      'Database tra cứu: cầu/đường VN, biển báo, định mức, vật liệu',
    ],
    downloadUrl: 'https://github.com/hosytri07/trishnexus-monorepo/releases/tag/trishlibrary-v1.0.0',
  },
  {
    slug: 'trishdesign',
    title: 'TrishDesign',
    icon: '✏️',
    shortDesc: 'CAD generator: vẽ hư hỏng mặt đường + ATGT + GIS + dự toán + AI chatbot',
    keyType: 'account',
    intro:
      'TrishDesign là app lớn nhất hệ sinh thái — bộ công cụ đại tu cho kỹ sư khảo sát-thiết kế hạ tầng giao thông. Tự động hóa AutoCAD COM: vẽ hư hỏng mặt đường, ATGT, GIS-MAP VN2000, bóc tách khối lượng, AI RAG TCVN/AASHTO.',
    sections: [
      {
        heading: 'Mode bão lũ tách 500m+500m',
        body: 'Chọn frame "A4 (54×39 đv = 1:10) — bão lũ" + tick checkbox "Mode bão lũ" trong Cài đặt bản vẽ. Đoạn 1km sẽ tự tách thành 2 dải 500m+500m xếp song song dọc, fit khổ A4.',
      },
      {
        heading: 'Tạo đoạn mới',
        body: 'Bấm "+ Đoạn" → nhập tên (vd "Km1064 - Km1065") + Km bắt đầu/kết thúc (chỉ để gắn tên). Lý trình thực tế cố định 0-1000m, cọc H1=100, H9=900. Cài đặt bản vẽ + khổ đường tự kế thừa từ đoạn cuối.',
      },
      {
        heading: 'Export/Import hồ sơ',
        body: 'Bấm "💾 Xuất" lưu hồ sơ ra file .tdproject.json. Bấm "📥 Nhập" để restore từ file → tạo project mới với ID mới. Snapshot đầy đủ: project + segments + damagePieces + stakes + damageCodes.',
      },
    ],
    features: [
      'Vẽ hư hỏng mặt đường (TCCS/TCVN 2026)',
      'ATGT 9 loại đối tượng QCVN 41:2019',
      'Bão lũ split 500m+500m fit A4',
      'GIS-MAP VN2000 + Helmert 7-param',
      'AI Chatbot proxy → Claude API',
      'Export/Import .tdproject.json',
    ],
  },
  {
    slug: 'trishdrive',
    title: 'TrishDrive',
    icon: '☁️',
    shortDesc: 'Cloud storage cá nhân qua Telegram Bot — encrypt AES-256 + share link',
    keyType: 'account',
    intro:
      'TrishDrive biến Telegram thành cloud storage cá nhân: upload file → encrypt AES-256-GCM → lưu Bot/Channel của bạn → tải về decrypt. Free 100% (Telegram unlimited storage), share link zero-knowledge.',
    sections: [
      {
        heading: 'Setup lần đầu',
        body: 'Tạo Telegram Bot qua @BotFather → lưu BOT_TOKEN. Tạo Channel private → add Bot làm admin. Mở TrishDrive → SetupWizard nhập 4 bước (api_id, api_hash, BOT_TOKEN, channel_id) → DPAPI Windows lưu encrypted.',
      },
      {
        heading: 'Upload + Share',
        body: 'Drag-drop file (≤2GB Bot API, ≤4GB MTProto). App tự encrypt AES-256-GCM client-side, upload qua Bot/MTProto. Share link rút gọn /s/{6-char} với key 32 hex nhúng URL fragment — server zero-knowledge.',
      },
    ],
    features: [
      'Encrypt AES-256-GCM client-side (zero-knowledge)',
      'Bot API ≤2GB + MTProto ≤4GB',
      'Multi-channel (folder support)',
      'Share link zero-knowledge',
      'Download history + bookmark',
    ],
  },
  {
    slug: 'trishfinance',
    title: 'TrishFinance',
    icon: '💰',
    shortDesc: 'Quản lý tài chính cá nhân + bán hàng + nhà trọ + thu chi tổng hợp',
    keyType: 'account',
    intro:
      'TrishFinance là bộ công cụ tài chính 3-in-1: POS bán hàng (sản phẩm/đơn/kho/khách), quản lý nhà trọ (phòng/hợp đồng/hóa đơn), thu chi tổng hợp. Chạy desktop + PWA web (finance.trishteam.io.vn).',
    sections: [
      {
        heading: 'Module Bán hàng (POS)',
        body: 'Quản lý sản phẩm, tạo đơn nhanh, theo dõi tồn kho, danh sách khách hàng + lịch sử mua. In hóa đơn nhiệt 80mm hoặc A4.',
      },
      {
        heading: 'Module Nhà trọ',
        body: 'Quản lý phòng, hợp đồng thuê, ghi điện/nước hàng tháng, in hóa đơn, theo dõi nợ. Notification deadline thanh toán.',
      },
    ],
    features: [
      'POS bán hàng + tồn kho',
      'Quản lý nhà trọ + hóa đơn điện nước',
      'Thu chi tổng hợp + biểu đồ',
      'PWA web (truy cập từ mobile)',
    ],
  },
  {
    slug: 'trishiso',
    title: 'TrishISO',
    icon: '📋',
    shortDesc: 'Quản lý hồ sơ ISO + thiết bị nội bộ + Hoan Cong Checklist (Phase 38.4)',
    keyType: 'account',
    intro:
      'TrishISO quản lý đầy đủ hệ thống tài liệu ISO 9001/14001 trong công ty: hồ sơ tổng quát, thiết bị nội bộ, lịch hiệu chuẩn/bảo trì, mượn-trả hồ sơ, biểu mẫu, duyệt, calendar, notification deadline.',
    sections: [
      {
        heading: 'Checklist hoàn công (Phase 38.4)',
        body: 'Tab "Checklist hoàn công" có 4 preset theo loại công trình: 🛣 Đường (14 items) / 🌉 Cầu (12 items) / 🚰 Thoát nước (9 items) / 💡 Điện (10 items). Tick từng mục: ✓ Đủ / ⏳ Đang chuẩn bị / ✗ Thiếu → hiện % hoàn thành. Lưu offline localStorage.',
      },
      {
        heading: 'Quản lý thiết bị + lịch hiệu chuẩn',
        body: 'Nhập thông tin thiết bị (serial, ngày mua, hạn hiệu chuẩn). Notification 1 lần/ngày báo deadline gần. In QR sticker dán thiết bị → quét QR mở ngay TrishISO show info.',
      },
    ],
    features: [
      'Hồ sơ ISO + mục lục tự động',
      'Thiết bị + lịch hiệu chuẩn',
      'Mượn/trả hồ sơ + audit',
      'Hoan Cong Checklist (Đường/Cầu/Thoát nước/Điện)',
      'QR sticker + quét tra cứu',
    ],
  },
  {
    slug: 'trishshortcut',
    title: 'TrishShortcut',
    icon: '⌨️',
    shortDesc: 'Quick Launcher Ctrl+Space + workspace + hotkey + tray',
    keyType: 'standalone',
    intro:
      'TrishShortcut là quick launcher Windows mạnh hơn Wox/PowerToys Run: nhập app/folder/URL bằng phím tắt Ctrl+Space, workspace mode để chuyển bộ apps theo context (work/play/study), hotkey toàn cục.',
    sections: [
      {
        heading: 'Setup hotkey toàn cục',
        body: 'Mặc định Ctrl+Space mở Quick Launcher. Tab "Hotkey" tùy chỉnh phím tắt cho từng workspace (vd Ctrl+Alt+W = chuyển workspace work).',
      },
    ],
    features: [
      'Quick Launcher Ctrl+Space',
      'Workspace mode (work/play/study)',
      'Hotkey toàn cục',
      'System tray + minimize',
      'Drag-drop add shortcut',
    ],
  },
  {
    slug: 'trishcheck',
    title: 'TrishCheck',
    icon: '🔍',
    shortDesc: 'Kiểm tra hệ thống + benchmark CPU/RAM/disk',
    keyType: 'standalone',
    intro:
      'TrishCheck đánh giá phần cứng máy tính nhanh: thông tin OS/CPU/RAM/disk/GPU, benchmark CPU (multi-thread), memory bandwidth, disk read/write, so sánh với 25 app phổ biến để biết máy bạn chạy được app nào.',
    sections: [
      {
        heading: 'Benchmark',
        body: 'Tab "Benchmark" chạy 4 test: CPU multi-core / Memory bandwidth / Disk sequential R/W / GPU detect. Kết quả tự so sánh với threshold của AutoCAD, SketchUp, Photoshop, Davinci Resolve, Unity, Unreal, Blender, etc.',
      },
    ],
    features: [
      'System info đầy đủ',
      'Benchmark CPU/RAM/Disk',
      'So sánh 25 app phổ biến',
      'Export report PDF',
    ],
  },
  {
    slug: 'trishclean',
    title: 'TrishClean',
    icon: '🧹',
    shortDesc: 'Dọn cache + file rác — staged delete + undo 7 ngày',
    keyType: 'standalone',
    intro:
      'TrishClean là CCleaner mini cho Windows: scan cache trình duyệt, temp folder, AutoCAD junk (.bak, .sv$), file >7 ngày trong Downloads. Tính năng đặc biệt: staged delete + undo 7 ngày — file xóa được khôi phục nếu nhỡ tay.',
    sections: [
      {
        heading: 'Staged delete + undo',
        body: 'File "xóa" thực ra move vào folder TrishClean Trash (không Recycle Bin). Trong 7 ngày bạn có thể restore từ tab "Undo". Sau 7 ngày auto purge thật.',
      },
    ],
    features: [
      'Scan cache + temp + AutoCAD junk',
      'Staged delete + undo 7 ngày',
      'Preset Windows paths',
      'Update check qua GitHub',
    ],
  },
  {
    slug: 'trishfont',
    title: 'TrishFont',
    icon: '🔤',
    shortDesc: 'Font manager + AutoCAD .shx + Pair AI gợi ý font đôi',
    keyType: 'standalone',
    intro:
      'TrishFont quản lý font tiếng Việt + AutoCAD .shx, hỗ trợ Pair AI (gợi ý 2 font đôi heading + body cho UI/print), download font pack từ TrishTEAM library.',
    sections: [
      {
        heading: 'Font Pack từ thư viện',
        body: 'Tab "Pack" liệt kê các bộ font do admin curate (vd "Pack Việt hóa AutoCAD", "Pack Sans-Serif modern"). Download zip → SHA256 verify → extract → install registry tự động.',
      },
    ],
    features: [
      'Quản lý font Windows + .shx',
      'Pair AI gợi ý font đôi',
      'Font Pack download zip',
      'Install registry write Windows',
    ],
  },
  {
    slug: 'trishoffice',
    title: 'TrishOffice',
    icon: '🏢',
    shortDesc: 'Bộ công cụ văn phòng kỹ sư XD (sắp ra mắt — Phase 38.6)',
    keyType: 'account',
    intro:
      'TrishOffice = "BuildOffice Assistant": Project Launcher + File Rename Pro + Biên bản tự động + Photo Report + Công văn manager. Tự động hóa workflow văn phòng kỹ sư xây dựng / giao thông Việt Nam.',
    sections: [
      {
        heading: 'Project Launcher',
        body: 'Tạo dự án mới với folder structure chuẩn (10 thư mục: 01_HoSoPhapLy / 02_BanVeCAD / 03_BanVePDF / 04_DuToan / 05_NghiemThu / 06_HinhAnh / 07_CongVan / 08_HoanCong / 09_ISO / 10_XuatBan). Mở nhanh file CAD/Excel/Word/PDF + cloud links.',
      },
      {
        heading: 'File Rename Pro',
        body: 'Đổi tên hàng loạt theo mẫu chuẩn: TenDuAn_HangMuc_MaBanVe_Revision_Ngay.pdf. Hỗ trợ .dwg/.pdf/.docx/.xlsx, chuẩn hóa tiếng Việt không dấu, preview trước khi đổi.',
      },
    ],
    features: [
      'Project Launcher + folder chuẩn',
      'File Rename Pro hàng loạt',
      'Biên bản nghiệm thu Excel→Word',
      'Photo Report (chèn ảnh hiện trường)',
      'Công văn manager + audit',
    ],
  },
];

export function findGuideBySlug(slug: string): AppGuide | undefined {
  return APP_GUIDES.find((g) => g.slug === slug);
}
