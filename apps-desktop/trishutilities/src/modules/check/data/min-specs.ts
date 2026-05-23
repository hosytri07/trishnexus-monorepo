/**
 * Phase 15.0.e — Min-spec database cho phần mềm phổ biến.
 *
 * Data hardcode (không fetch online) từ trang official của từng vendor
 * + cộng đồng chia sẻ thực tế (Reddit, forums) cho năm 2026. Spec
 * "min" = chạy nhưng có thể giật lag, "recommended" = chạy mượt.
 *
 * Note: TrishCheck chưa đo GPU thực tế — phần GPU bỏ qua trong v1
 * (chỉ check CPU cores + RAM + free disk). Các app cần GPU mạnh sẽ
 * có note text "Cần GPU rời".
 *
 * Khi cần update: edit array, không cần ship lại nếu chuyển data ra
 * file riêng + fetch URL — defer Phase 15.x.
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
}

/**
 * 14 phần mềm phổ biến nhất user Việt Nam dùng (2026).
 * Sắp xếp theo category để render group được.
 */
export const SOFTWARE_SPECS: SoftwareSpec[] = [
  // ─── TrishTEAM ecosystem (priority đầu — luôn check máy có chạy được app nhà chưa) ──
  {
    id: 'trishlauncher',
    name: 'TrishLauncher',
    icon: '🚀',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 1 },
    recommended: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
  },
  {
    id: 'trishcheck',
    name: 'TrishCheck',
    icon: '🩺',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 2, disk_free_gb: 1 },
    recommended: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
  },
  {
    id: 'trishfont',
    name: 'TrishFont',
    icon: '🔤',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 5 },
  },
  {
    id: 'trishnote',
    name: 'TrishNote',
    icon: '📝',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 1 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 5 },
  },
  {
    id: 'trishclean',
    name: 'TrishClean',
    icon: '🧹',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 2, disk_free_gb: 1 },
    recommended: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
  },
  {
    id: 'trishimage',
    name: 'TrishImage',
    icon: '🖼️',
    category: 'trishteam',
    min: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 5 },
    recommended: { cpu_cores: 8, ram_gb: 16, disk_free_gb: 30 },
    note: 'Face grouping cần GPU rời để chạy mượt.',
  },
  {
    id: 'trishtype',
    name: 'TrishType',
    icon: '⌨️',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 1 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 2 },
  },
  {
    id: 'trishlibrary',
    name: 'TrishLibrary',
    icon: '📚',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 10 },
  },
  {
    id: 'trishsearch',
    name: 'TrishSearch',
    icon: '🔍',
    category: 'trishteam',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 1 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 2 },
  },

  // ─── Office ──────────────────────────────────────────
  {
    id: 'office-365',
    name: 'Microsoft Office 365',
    icon: '📊',
    category: 'office',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 4 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 10 },
  },
  {
    id: 'libreoffice',
    name: 'LibreOffice',
    icon: '📝',
    category: 'office',
    min: { cpu_cores: 2, ram_gb: 2, disk_free_gb: 2 },
    recommended: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 5 },
  },

  // ─── Communication ──────────────────────────────────
  {
    id: 'zalo-pc',
    name: 'Zalo PC',
    icon: '💬',
    category: 'communication',
    min: { cpu_cores: 2, ram_gb: 2, disk_free_gb: 1 },
    recommended: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
  },
  {
    id: 'teams-zoom',
    name: 'Teams / Zoom',
    icon: '📹',
    category: 'communication',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 5 },
    note: 'Video call HD cần webcam + mic chất lượng.',
  },

  // ─── Design ──────────────────────────────────────────
  {
    id: 'photoshop-2024',
    name: 'Adobe Photoshop CC 2024',
    icon: '🎨',
    category: 'design',
    min: { cpu_cores: 2, ram_gb: 8, disk_free_gb: 20 },
    recommended: { cpu_cores: 8, ram_gb: 16, disk_free_gb: 50 },
    note: 'Cần GPU rời (≥2GB VRAM) cho filter Neural + 3D.',
  },
  {
    id: 'illustrator-2024',
    name: 'Adobe Illustrator 2024',
    icon: '✏️',
    category: 'design',
    min: { cpu_cores: 2, ram_gb: 8, disk_free_gb: 10 },
    recommended: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 20 },
  },
  {
    id: 'figma-desktop',
    name: 'Figma Desktop',
    icon: '🎯',
    category: 'design',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 1 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 2 },
    note: 'Cần internet ổn định — Figma là cloud-first.',
  },

  // ─── Video ──────────────────────────────────────────
  {
    id: 'premiere-2024',
    name: 'Adobe Premiere Pro 2024',
    icon: '🎬',
    category: 'video',
    min: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 50 },
    recommended: { cpu_cores: 8, ram_gb: 32, disk_free_gb: 200 },
    note: '4K timeline mượt cần GPU rời + SSD NVMe.',
  },
  {
    id: 'davinci-resolve-18',
    name: 'DaVinci Resolve 18',
    icon: '🎞️',
    category: 'video',
    min: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 30 },
    recommended: { cpu_cores: 8, ram_gb: 32, disk_free_gb: 100 },
    note: 'Free version đủ. Studio cần dongle. GPU rời bắt buộc cho 4K.',
  },
  {
    id: 'obs-studio',
    name: 'OBS Studio',
    icon: '📺',
    category: 'video',
    min: { cpu_cores: 4, ram_gb: 4, disk_free_gb: 2 },
    recommended: { cpu_cores: 6, ram_gb: 16, disk_free_gb: 50 },
    note: 'Stream 1080p60 cần GPU encoder (NVENC/AMF).',
  },

  // ─── Engineering ─────────────────────────────────────
  {
    id: 'autocad-2024',
    name: 'AutoCAD 2024',
    icon: '📐',
    category: 'engineering',
    min: { cpu_cores: 2, ram_gb: 8, disk_free_gb: 10 },
    recommended: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 30 },
    note: 'File 3D phức tạp cần ≥32GB RAM.',
  },
  {
    id: 'revit-2024',
    name: 'Revit 2024',
    icon: '🏗️',
    category: 'engineering',
    min: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 30 },
    recommended: { cpu_cores: 8, ram_gb: 32, disk_free_gb: 50 },
    note: 'BIM model lớn cần ≥64GB RAM + GPU pro (Quadro).',
  },
  {
    id: 'sketchup-pro-2024',
    name: 'SketchUp Pro 2024',
    icon: '🏠',
    category: 'engineering',
    min: { cpu_cores: 2, ram_gb: 8, disk_free_gb: 10 },
    recommended: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 20 },
  },

  // ─── Dev ────────────────────────────────────────────
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    icon: '💻',
    category: 'dev',
    min: { cpu_cores: 2, ram_gb: 4, disk_free_gb: 2 },
    recommended: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 10 },
  },
  {
    id: 'android-studio',
    name: 'Android Studio',
    icon: '📱',
    category: 'dev',
    min: { cpu_cores: 4, ram_gb: 8, disk_free_gb: 30 },
    recommended: { cpu_cores: 8, ram_gb: 16, disk_free_gb: 100 },
    note: 'Emulator cần ảo hoá CPU + ≥10GB free cho 1 device image.',
  },

  // ─── Games ──────────────────────────────────────────
  {
    id: 'aaa-games-2026',
    name: 'AAA Games 2026 (Steam)',
    icon: '🎮',
    category: 'games',
    min: { cpu_cores: 4, ram_gb: 16, disk_free_gb: 100 },
    recommended: { cpu_cores: 8, ram_gb: 32, disk_free_gb: 500 },
    note: 'Tham khảo: Cyberpunk 2077, Elden Ring class. GPU rời ≥8GB VRAM.',
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

export const CATEGORY_LABELS: Record<SpecCategory, string> = {
  trishteam: '🚀 TrishTEAM Ecosystem',
  office: 'Văn phòng',
  communication: 'Liên lạc',
  design: 'Thiết kế',
  video: 'Video / Stream',
  engineering: 'Kỹ thuật',
  dev: 'Lập trình',
  games: 'Game',
};
