/**
 * Phase 15.0.e — Min-spec database cho phần mềm phổ biến.
 *
 * Wave 70.1 — Cập nhật TrishTEAM Ecosystem: chỉ còn 3 app cho user
 * (TrishWork, TrishUtilities, TrishFinance) + TrishAdmin (admin tool).
 *
 * Wave 70.2 — Mở rộng SpecRequirement với detail fields (os/cpu_model/
 * gpu/ssd/notes) để modal chi tiết hiển thị đầy đủ thông số.
 */

export type SpecCategory =
  | 'trishteam'
  | 'office'
  | 'design'
  | 'video'
  | 'engineering'
  | 'dev'
  | 'games'
  | 'communication';

export interface SpecRequirement {
  cpu_cores: number;
  ram_gb: number;
  disk_free_gb: number;
  /** Wave 70.2 — Chi tiết thêm cho modal */
  os?: string;
  cpu_model?: string;
  gpu?: string;
  ssd_recommended?: boolean;
  notes?: string;
}

export interface SoftwareSpec {
  id: string;
  name: string;
  icon: string; // Emoji single char hoặc 2 char (Office: 📊, Adobe: 🅰️, ...)
  category: SpecCategory;
  min: SpecRequirement;
  recommended: SpecRequirement;
  /** Note thêm cho user — ví dụ "Cần GPU rời", "SSD bắt buộc". */
  note?: string;
  /** Wave 70.3 — đánh dấu phần mềm admin tự thêm (lưu localStorage) */
  custom?: boolean;
  /** Wave 70.2 — vendor / nhà phát triển */
  vendor?: string;
  /** Wave 70.2 — link tải hoặc trang chính thức */
  url?: string;
}

/**
 * Phần mềm phổ biến nhất user Việt Nam dùng (2026).
 * Sắp xếp theo category để render group được.
 */
export const SOFTWARE_SPECS: SoftwareSpec[] = [
  // ─── TrishTEAM ecosystem (3 app user + TrishAdmin) ────────────────────
  {
    id: 'trishwork',
    name: 'TrishWork',
    icon: '🟢',
    category: 'trishteam',
    vendor: 'TrishTEAM',
    url: 'https://trishteam.io.vn',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10 1809+ / Windows 11',
      cpu_model: 'Intel Core i3-6100 / AMD Ryzen 3 1200 (≥ 2.0 GHz)',
      gpu: 'Tích hợp (Intel UHD / AMD Vega)',
      ssd_recommended: false,
      notes: 'Module Design (AutoCAD overlay) bật nâng cao cần thêm RAM.',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 11 22H2+',
      cpu_model: 'Intel Core i5-10400 / AMD Ryzen 5 5600 trở lên',
      gpu: 'GTX 1650 / RX 6500 (cho overlay 3D Design)',
      ssd_recommended: true,
      notes: 'SSD NVMe khuyến nghị để mở file dự án nhanh.',
    },
    note: 'Suite làm việc — Design (AutoCAD), Project, Documents.',
  },
  {
    id: 'trishutilities',
    name: 'TrishUtilities',
    icon: '🟡',
    category: 'trishteam',
    vendor: 'TrishTEAM',
    url: 'https://trishteam.io.vn',
    min: {
      cpu_cores: 2,
      ram_gb: 2,
      disk_free_gb: 1,
      os: 'Windows 10 1809+ / Windows 11',
      cpu_model: 'Intel Core i3 / AMD Ryzen 3',
      gpu: 'Tích hợp',
      ssd_recommended: false,
      notes: 'Module Clean quét full ổ cứng có thể chậm trên HDD cũ.',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 4,
      disk_free_gb: 5,
      os: 'Windows 11 22H2+',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'Tích hợp đủ',
      ssd_recommended: true,
      notes: 'Font pack 4K cần SSD; Benchmark đo chính xác hơn trên CPU mới.',
    },
    note: 'Suite tiện ích — Clean, Check, Drive, Font, Shortcut.',
  },
  {
    id: 'trishfinance',
    name: 'TrishFinance',
    icon: '🔵',
    category: 'trishteam',
    vendor: 'TrishTEAM',
    url: 'https://trishteam.io.vn',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10 1809+ / Windows 11',
      cpu_model: 'Intel Core i3 / AMD Ryzen 3',
      gpu: 'Tích hợp',
      ssd_recommended: false,
      notes: 'Database SQLite local — chạy được trên HDD.',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 11 22H2+',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'Tích hợp đủ',
      ssd_recommended: true,
      notes: 'Báo cáo lớn (10k+ giao dịch) chạy mượt với SSD + RAM ≥ 8 GB.',
    },
    note: 'Suite quản lý tài chính cá nhân / hộ kinh doanh nhỏ.',
  },
  {
    id: 'trishadmin',
    name: 'TrishAdmin',
    icon: '🔴',
    category: 'trishteam',
    vendor: 'TrishTEAM (chỉ admin)',
    url: 'https://trishteam.io.vn',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10 1809+ / Windows 11',
      cpu_model: 'Intel Core i3 / AMD Ryzen 3',
      gpu: 'Tích hợp',
      ssd_recommended: false,
      notes: 'Cần internet ổn định để sync Firestore.',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 5,
      os: 'Windows 11 22H2+',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'Tích hợp đủ',
      ssd_recommended: true,
      notes: 'Quản lý nhiều user / key kích hoạt cần SSD + băng thông ổn.',
    },
    note: 'Công cụ quản trị nội bộ (chỉ admin).',
  },

  // ─── Office ──────────────────────────────────────────
  {
    id: 'office-365',
    name: 'Microsoft Office 365',
    icon: '📊',
    category: 'office',
    vendor: 'Microsoft',
    url: 'https://www.microsoft.com/microsoft-365',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 4,
      os: 'Windows 10 / 11',
      cpu_model: '1.6 GHz dual-core trở lên',
      gpu: 'DirectX 9+ tích hợp',
      ssd_recommended: false,
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 11 22H2+',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'Tích hợp đủ',
      ssd_recommended: true,
      notes: 'File Excel > 100k rows mượt hơn nhiều khi có ≥ 16 GB RAM.',
    },
  },
  {
    id: 'libreoffice',
    name: 'LibreOffice',
    icon: '📝',
    category: 'office',
    vendor: 'The Document Foundation',
    url: 'https://www.libreoffice.org',
    min: {
      cpu_cores: 2,
      ram_gb: 2,
      disk_free_gb: 2,
      os: 'Windows 7+ / macOS / Linux',
      cpu_model: 'Pentium III tương đương trở lên',
    },
    recommended: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 5,
      os: 'Windows 10/11',
      cpu_model: 'Intel Core i3 / AMD Ryzen 3 trở lên',
      ssd_recommended: true,
    },
  },

  // ─── Communication ──────────────────────────────────
  {
    id: 'zalo-pc',
    name: 'Zalo PC',
    icon: '💬',
    category: 'communication',
    vendor: 'VNG Corporation',
    url: 'https://zalo.me/pc',
    min: {
      cpu_cores: 2,
      ram_gb: 2,
      disk_free_gb: 1,
      os: 'Windows 7 SP1+ / 10 / 11',
      cpu_model: 'Dual-core 1.6 GHz',
    },
    recommended: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10/11',
      cpu_model: 'Intel Core i3 / AMD Ryzen 3',
      ssd_recommended: false,
    },
  },
  {
    id: 'teams-zoom',
    name: 'Teams / Zoom',
    icon: '📹',
    category: 'communication',
    vendor: 'Microsoft / Zoom',
    url: 'https://www.microsoft.com/microsoft-teams',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10 / macOS 10.14+',
      cpu_model: 'Intel Core i3 dual-core 2.0 GHz',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 5,
      os: 'Windows 11',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'Tích hợp với hardware accel',
      ssd_recommended: true,
      notes: 'Video call HD cần webcam + mic chất lượng.',
    },
    note: 'Video call HD cần webcam + mic chất lượng.',
  },

  // ─── Design ──────────────────────────────────────────
  {
    id: 'photoshop-2024',
    name: 'Adobe Photoshop CC 2024',
    icon: '🎨',
    category: 'design',
    vendor: 'Adobe',
    url: 'https://www.adobe.com/products/photoshop.html',
    min: {
      cpu_cores: 2,
      ram_gb: 8,
      disk_free_gb: 20,
      os: 'Windows 10 64-bit (v22H2+)',
      cpu_model: 'Intel/AMD 64-bit, 2 GHz+ với SSE 4.2',
      gpu: 'GPU hỗ trợ DirectX 12, 2 GB VRAM',
      ssd_recommended: true,
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 16,
      disk_free_gb: 50,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7 trở lên',
      gpu: 'NVIDIA RTX 3060 / RX 6600 trở lên (≥ 8 GB VRAM)',
      ssd_recommended: true,
      notes: 'Neural filters + 3D cần GPU ≥ 8 GB VRAM.',
    },
    note: 'Cần GPU rời (≥ 2 GB VRAM) cho filter Neural + 3D.',
  },
  {
    id: 'illustrator-2024',
    name: 'Adobe Illustrator 2024',
    icon: '✏️',
    category: 'design',
    vendor: 'Adobe',
    url: 'https://www.adobe.com/products/illustrator.html',
    min: {
      cpu_cores: 2,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 10 64-bit (v22H2+)',
      cpu_model: 'Intel/AMD 64-bit, 2 GHz+',
      gpu: 'GPU hỗ trợ DirectX 12, 1 GB VRAM',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 20,
      os: 'Windows 11',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'GPU rời 4 GB VRAM trở lên',
      ssd_recommended: true,
    },
  },
  {
    id: 'figma-desktop',
    name: 'Figma Desktop',
    icon: '🎯',
    category: 'design',
    vendor: 'Figma Inc.',
    url: 'https://www.figma.com/downloads',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 1,
      os: 'Windows 10 / macOS 11+',
      cpu_model: 'Dual-core 2 GHz',
      notes: 'Cần internet — Figma là cloud-first.',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 2,
      os: 'Windows 11 / macOS 13+',
      cpu_model: 'Intel Core i5 / Apple M1+',
      ssd_recommended: true,
    },
    note: 'Cần internet ổn định — Figma là cloud-first.',
  },

  // ─── Video ──────────────────────────────────────────
  {
    id: 'premiere-2024',
    name: 'Adobe Premiere Pro 2024',
    icon: '🎬',
    category: 'video',
    vendor: 'Adobe',
    url: 'https://www.adobe.com/products/premiere.html',
    min: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 50,
      os: 'Windows 10 64-bit (v22H2+)',
      cpu_model: 'Intel 7th-gen / AMD Ryzen 1000 trở lên',
      gpu: '2 GB VRAM (DirectX 12)',
      ssd_recommended: true,
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 32,
      disk_free_gb: 200,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 12700 / AMD Ryzen 7 5800X trở lên',
      gpu: 'NVIDIA RTX 3070 / RX 6800 (≥ 8 GB VRAM)',
      ssd_recommended: true,
      notes: 'SSD NVMe bắt buộc cho 4K timeline mượt.',
    },
    note: '4K timeline mượt cần GPU rời + SSD NVMe.',
  },
  {
    id: 'davinci-resolve-18',
    name: 'DaVinci Resolve 18',
    icon: '🎞️',
    category: 'video',
    vendor: 'Blackmagic Design',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
    min: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 30,
      os: 'Windows 10 / 11',
      cpu_model: 'Intel/AMD 64-bit',
      gpu: 'GPU rời 2 GB VRAM (OpenCL 1.2)',
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 32,
      disk_free_gb: 100,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7',
      gpu: 'NVIDIA RTX 3060+ hoặc AMD RX 6700+ (≥ 8 GB VRAM)',
      ssd_recommended: true,
      notes: 'Studio version cần dongle. 4K mượt bắt buộc GPU mạnh.',
    },
    note: 'Free version đủ. Studio cần dongle. GPU rời bắt buộc cho 4K.',
  },
  {
    id: 'obs-studio',
    name: 'OBS Studio',
    icon: '📺',
    category: 'video',
    vendor: 'OBS Project',
    url: 'https://obsproject.com',
    min: {
      cpu_cores: 4,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10 / 11',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5',
      gpu: 'DirectX 11 compatible',
    },
    recommended: {
      cpu_cores: 6,
      ram_gb: 16,
      disk_free_gb: 50,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7',
      gpu: 'GPU có NVENC (NVIDIA) hoặc AMF (AMD)',
      ssd_recommended: true,
      notes: 'Stream 1080p60 nên dùng NVENC để giảm tải CPU.',
    },
    note: 'Stream 1080p60 cần GPU encoder (NVENC/AMF).',
  },

  // ─── Engineering ─────────────────────────────────────
  {
    id: 'autocad-2024',
    name: 'AutoCAD 2024',
    icon: '📐',
    category: 'engineering',
    vendor: 'Autodesk',
    url: 'https://www.autodesk.com/products/autocad',
    min: {
      cpu_cores: 2,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 10/11 64-bit',
      cpu_model: '2.5 GHz dual-core (3 GHz khuyến nghị)',
      gpu: '1 GB VRAM với DirectX 11',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 30,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7 (3+ GHz)',
      gpu: 'GPU rời 4 GB VRAM trở lên',
      ssd_recommended: true,
      notes: 'File 3D phức tạp cần ≥ 32 GB RAM.',
    },
    note: 'File 3D phức tạp cần ≥ 32 GB RAM.',
  },
  {
    id: 'revit-2024',
    name: 'Revit 2024',
    icon: '🏗️',
    category: 'engineering',
    vendor: 'Autodesk',
    url: 'https://www.autodesk.com/products/revit',
    min: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 30,
      os: 'Windows 10/11 64-bit',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7 (multi-core highest possible)',
      gpu: 'DirectX 11 GPU rời, 4 GB VRAM',
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 32,
      disk_free_gb: 50,
      os: 'Windows 11',
      cpu_model: 'Intel Xeon W / AMD Ryzen 9 / Threadripper',
      gpu: 'NVIDIA Quadro / RTX Pro (≥ 8 GB VRAM)',
      ssd_recommended: true,
      notes: 'BIM model lớn cần ≥ 64 GB RAM + GPU pro.',
    },
    note: 'BIM model lớn cần ≥ 64 GB RAM + GPU pro (Quadro).',
  },
  {
    id: 'sketchup-pro-2024',
    name: 'SketchUp Pro 2024',
    icon: '🏠',
    category: 'engineering',
    vendor: 'Trimble',
    url: 'https://www.sketchup.com',
    min: {
      cpu_cores: 2,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 10/11 64-bit',
      cpu_model: '2 GHz trở lên',
      gpu: '1 GB VRAM, DirectX 11',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 20,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7',
      gpu: 'GPU rời 4 GB VRAM',
      ssd_recommended: true,
    },
  },

  // ─── Dev ────────────────────────────────────────────
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    icon: '💻',
    category: 'dev',
    vendor: 'Microsoft',
    url: 'https://code.visualstudio.com',
    min: {
      cpu_cores: 2,
      ram_gb: 4,
      disk_free_gb: 2,
      os: 'Windows 10/11, macOS, Linux',
      cpu_model: '1.6 GHz trở lên',
    },
    recommended: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 10,
      os: 'Windows 11',
      cpu_model: 'Intel Core i5 / AMD Ryzen 5 / Apple M1+',
      ssd_recommended: true,
      notes: 'Project Node/Rust lớn cần thêm RAM cho language servers.',
    },
  },
  {
    id: 'android-studio',
    name: 'Android Studio',
    icon: '📱',
    category: 'dev',
    vendor: 'Google',
    url: 'https://developer.android.com/studio',
    min: {
      cpu_cores: 4,
      ram_gb: 8,
      disk_free_gb: 30,
      os: 'Windows 10/11 64-bit',
      cpu_model: 'x86_64 CPU với SLAT (hỗ trợ ảo hoá)',
      gpu: '1280×800 trở lên',
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 16,
      disk_free_gb: 100,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7 / AMD Ryzen 7',
      gpu: 'GPU tích hợp đủ; rời tốt hơn cho preview',
      ssd_recommended: true,
      notes: 'Emulator cần ảo hoá CPU + ≥ 10 GB free / device image.',
    },
    note: 'Emulator cần ảo hoá CPU + ≥ 10 GB free cho 1 device image.',
  },

  // ─── Games ──────────────────────────────────────────
  {
    id: 'aaa-games-2026',
    name: 'AAA Games 2026 (Steam)',
    icon: '🎮',
    category: 'games',
    vendor: 'Various',
    url: 'https://store.steampowered.com',
    min: {
      cpu_cores: 4,
      ram_gb: 16,
      disk_free_gb: 100,
      os: 'Windows 10/11 64-bit',
      cpu_model: 'Intel Core i5-9400 / AMD Ryzen 5 3600',
      gpu: 'GTX 1660 Super / RX 5600 XT (6-8 GB VRAM)',
      ssd_recommended: true,
    },
    recommended: {
      cpu_cores: 8,
      ram_gb: 32,
      disk_free_gb: 500,
      os: 'Windows 11',
      cpu_model: 'Intel Core i7-13700K / AMD Ryzen 7 7700X',
      gpu: 'RTX 4070 / RX 7800 XT (≥ 12 GB VRAM)',
      ssd_recommended: true,
      notes: 'NVMe Gen4 SSD giảm thời gian load đáng kể.',
    },
    note: 'Tham khảo: Cyberpunk 2077, Elden Ring class. GPU rời ≥ 8 GB VRAM.',
  },
];

export type CompareStatus = 'pass' | 'warn' | 'fail';

export interface CompareResult {
  status: CompareStatus;
  /** Chi tiết — field nào fail, field nào warn. UI có thể hiện tooltip. */
  details: string[];
}

export interface MachineSpec {
  cpu_cores: number;
  ram_gb: number;
  disk_free_gb: number;
}

/**
 * Compare máy với spec phần mềm.
 *
 * Logic:
 *  - Bất kỳ field nào của máy < min → 'fail' (không nên cài)
 *  - Tất cả ≥ min nhưng có field < recommended → 'warn' (chạy được, có thể chậm)
 *  - Tất cả ≥ recommended → 'pass' (mượt mà)
 */
export function compareSpec(
  machine: MachineSpec,
  spec: SoftwareSpec,
): CompareResult {
  const details: string[] = [];

  // Check each field against min
  if (machine.cpu_cores < spec.min.cpu_cores) {
    details.push(
      `CPU thiếu nhân: ${machine.cpu_cores} < ${spec.min.cpu_cores} (min)`,
    );
  }
  if (machine.ram_gb < spec.min.ram_gb) {
    details.push(
      `RAM thiếu: ${machine.ram_gb.toFixed(1)} GB < ${spec.min.ram_gb} GB (min)`,
    );
  }
  if (machine.disk_free_gb < spec.min.disk_free_gb) {
    details.push(
      `Đĩa thiếu: ${machine.disk_free_gb.toFixed(0)} GB free < ${spec.min.disk_free_gb} GB (min)`,
    );
  }

  if (details.length > 0) {
    return { status: 'fail', details };
  }

  // All ≥ min — check recommended
  if (machine.cpu_cores < spec.recommended.cpu_cores) {
    details.push(
      `CPU vừa đủ: ${machine.cpu_cores} < ${spec.recommended.cpu_cores} (đề xuất)`,
    );
  }
  if (machine.ram_gb < spec.recommended.ram_gb) {
    details.push(
      `RAM vừa đủ: ${machine.ram_gb.toFixed(1)} GB < ${spec.recommended.ram_gb} GB (đề xuất)`,
    );
  }
  if (machine.disk_free_gb < spec.recommended.disk_free_gb) {
    details.push(
      `Đĩa vừa đủ: ${machine.disk_free_gb.toFixed(0)} GB free < ${spec.recommended.disk_free_gb} GB (đề xuất)`,
    );
  }

  if (details.length > 0) {
    return { status: 'warn', details };
  }

  return { status: 'pass', details: [] };
}

/** Format spec ngắn cho cell bảng: "4C / 8GB / 20GB" */
export function formatSpec(req: SpecRequirement): string {
  return `${req.cpu_cores}C / ${req.ram_gb}GB / ${req.disk_free_gb}GB`;
}

/**
 * Phase 69.2 — Compute % máy đáp ứng vs requirement.
 * Trả average của 3 dimensions (CPU/RAM/Disk), mỗi dim cap 100%.
 */
export function computeSpecPercent(
  machine: MachineSpec,
  req: SpecRequirement,
): number {
  const cpuPct = req.cpu_cores > 0
    ? Math.min(100, (machine.cpu_cores / req.cpu_cores) * 100)
    : 100;
  const ramPct = req.ram_gb > 0
    ? Math.min(100, (machine.ram_gb / req.ram_gb) * 100)
    : 100;
  const diskPct = req.disk_free_gb > 0
    ? Math.min(100, (machine.disk_free_gb / req.disk_free_gb) * 100)
    : 100;
  return Math.round((cpuPct + ramPct + diskPct) / 3);
}

export const CATEGORY_LABELS: Record<SpecCategory, string> = {
  trishteam: '🚀 TrishTEAM Ecosystem',
  office: '📊 Văn phòng',
  communication: '💬 Liên lạc',
  design: '🎨 Thiết kế',
  video: '🎬 Video / Stream',
  engineering: '📐 Kỹ thuật',
  dev: '💻 Lập trình',
  games: '🎮 Game',
};

/* ──────────────────────────────────────────────────────────────────
 * Wave 70.3 — Custom software persistence (admin thêm phần mềm khác)
 * ────────────────────────────────────────────────────────────────── */

const CUSTOM_SPECS_KEY = 'trishcheck:custom-specs:v1';

/** Load custom software từ localStorage. Trả mảng rỗng nếu chưa có / lỗi. */
export function loadCustomSpecs(): SoftwareSpec[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SPECS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is SoftwareSpec => {
      if (!s || typeof s !== 'object') return false;
      const r = s as Record<string, unknown>;
      return typeof r.id === 'string'
        && typeof r.name === 'string'
        && typeof r.icon === 'string'
        && r.min !== undefined
        && r.recommended !== undefined;
    }).map((s) => ({ ...s, custom: true }));
  } catch (err) {
    console.warn('[min-specs] loadCustomSpecs fail:', err);
    return [];
  }
}

/** Lưu danh sách custom specs vào localStorage. */
export function saveCustomSpecs(list: SoftwareSpec[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_SPECS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('[min-specs] saveCustomSpecs fail:', err);
  }
}

/** Merge bundled/remote specs với custom specs. Custom hiển thị sau, không đè ID. */
export function mergeSpecs(
  base: SoftwareSpec[],
  custom: SoftwareSpec[],
): SoftwareSpec[] {
  const seen = new Set(base.map((s) => s.id));
  const result = [...base];
  for (const c of custom) {
    if (seen.has(c.id)) continue;
    result.push(c);
  }
  return result;
}
