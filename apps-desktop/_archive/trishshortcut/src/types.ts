/**
 * TrishShortcut — Data model
 *
 * Shortcut: 1 entry user lưu để launch nhanh.
 * Workspace: nhóm shortcut launch cùng lúc (vd "Môi trường thiết kế" mở
 *   AutoCAD + Excel + TrishDesign + Browser cùng lúc).
 */

export type ShortcutType =
  | 'app'      // .exe file (full path)
  | 'folder'   // thư mục
  | 'url'      // web URL
  | 'file'     // file thường (mở bằng default app)
  | 'game'     // .exe game (steam/standalone)
  | 'uwp'      // UWP/Microsoft Store app
  | 'command'; // lệnh hệ thống (notepad, calc, cmd, ...) — search PATH

export type ShortcutGroup = string; // user-defined: 'Apps', 'Games', 'Work', 'Web', 'Tools', custom

export interface Shortcut {
  id: string;
  name: string;
  type: ShortcutType;
  /** target path/URL. .exe: "C:\\...\\foo.exe", folder: "C:\\Foo", URL: "https://..." */
  target: string;
  /** working directory (khi launch .exe). Mặc định = parent của target. */
  working_dir?: string;
  /** command-line args truyền vào .exe */
  args?: string;
  /** chạy as Administrator (UAC prompt) */
  run_as_admin?: boolean;
  /** path icon đã extract — relative to app cache dir hoặc absolute */
  icon_path?: string;
  /** group/category */
  group: ShortcutGroup;
  /** Phase 32.4.A — đánh dấu yêu thích → hiện ở sidebar "★ Yêu thích" filter */
  favorite?: boolean;
  /** tag list, freeform */
  tags?: string[];
  /** hotkey toàn cục, format Tauri: "CmdOrCtrl+Alt+1", "Super+Shift+G", v.v. */
  global_hotkey?: string;
  /** stats — tự update mỗi launch */
  click_count: number;
  last_used_at?: number; // unix ms
  created_at: number;
  updated_at: number;
  notes?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  /** list shortcut IDs launch theo thứ tự (delay ~500ms giữa các app để OS không nghẽn) */
  shortcut_ids: string[];
  /** delay (ms) giữa mỗi shortcut launch */
  launch_delay_ms: number;
  /** hotkey toàn cục */
  global_hotkey?: string;
  /** icon biểu trưng (optional) */
  icon_path?: string;
  created_at: number;
  updated_at: number;
}

/**
 * ScheduleRule — tự động mở/đóng shortcut theo lịch.
 * Format đơn giản: cron-like nhưng VN-friendly.
 *   weekday: 0=Chủ nhật, 1-5=Thứ 2-6, 6=Thứ 7
 *   action: 'launch' (mở) hoặc 'close' (taskkill /IM <process>)
 */
export interface ScheduleRule {
  id: string;
  shortcut_id: string;
  name: string; // "Mở Outlook 8h sáng"
  hour: number;       // 0-23
  minute: number;     // 0-59
  weekdays: number[]; // [1,2,3,4,5] = Mon-Fri
  action: 'launch' | 'close';
  enabled: boolean;
  created_at: number;
}

export interface AppSettings {
  /** theme: light | dark | auto (follow OS) */
  theme: 'light' | 'dark' | 'auto';
  /** quick launcher overlay hotkey (mặc định Ctrl+Space) */
  overlay_hotkey: string;
  /** start with Windows */
  start_with_windows: boolean;
  /** minimize to tray khi close (X) thay vì exit */
  minimize_to_tray_on_close: boolean;
  /** smart suggestion: bật AI gợi ý theo time-of-day */
  smart_suggest: boolean;
  /** kích thước grid card: small | medium | large */
  grid_size: 'small' | 'medium' | 'large';
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  overlay_hotkey: 'CmdOrCtrl+Space',
  start_with_windows: false,
  minimize_to_tray_on_close: true,
  smart_suggest: true,
  grid_size: 'medium',
};

export const DEFAULT_GROUPS: ShortcutGroup[] = ['Apps', 'Games', 'Work', 'Web', 'Tools'];

/** Toàn bộ data export/import. JSON file backup. */
export interface BackupBundle {
  version: 1;
  exported_at: number;
  shortcuts: Shortcut[];
  workspaces: Workspace[];
  schedules: ScheduleRule[];
  settings: AppSettings;
  groups: ShortcutGroup[];
}
