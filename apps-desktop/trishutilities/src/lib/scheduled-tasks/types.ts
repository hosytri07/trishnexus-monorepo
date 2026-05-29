/**
 * Phase 78.13 — Scheduled Tasks types.
 *
 * Lightweight scheduler chạy ngay trong app (không cần background service).
 * Mỗi user có nhiều tasks; tasks sync Firestore để Admin quan sát + để các
 * device khác của cùng user thấy chung lịch (last-run wins).
 */

/** Type công việc có thể schedule. */
export type ScheduledTaskKind =
  | 'clean.preview'      // Preview rác (an toàn, không xoá)
  | 'clean.full'         // Dọn rác + xoá thực sự (Temp / cache)
  | 'check.report'       // Sinh report System Info (markdown / json)
  | 'font.scan-system';  // Scan font đã cài + cảnh báo font thiếu

/** Lịch chạy — chỉ những preset thông dụng. `custom` dùng cron-like. */
export type ScheduledTaskCadence =
  | 'hourly'             // mỗi giờ tròn
  | 'daily-morning'      // 08:00 mỗi ngày
  | 'daily-noon'         // 12:00 mỗi ngày
  | 'daily-evening'      // 19:00 mỗi ngày
  | 'weekly-monday'      // Thứ 2, 08:00
  | 'weekly-friday'      // Thứ 6, 17:00
  | 'monthly-first';     // Mùng 1 hàng tháng, 08:00

export type ScheduledTaskStatus = 'idle' | 'running' | 'success' | 'error';

export interface ScheduledTask {
  id: string;
  uid: string;
  /** Tên hiển thị, do user đặt. */
  name: string;
  kind: ScheduledTaskKind;
  cadence: ScheduledTaskCadence;
  enabled: boolean;
  /** Epoch ms — lần chạy kế tiếp. */
  nextRun: number;
  /** Epoch ms — lần chạy gần nhất. */
  lastRun?: number;
  lastStatus?: ScheduledTaskStatus;
  /** Mô tả lỗi gọn (nếu lastStatus === 'error'). */
  lastError?: string;
  /** Mô tả ngắn kết quả (file count, MB cleaned, …). */
  lastSummary?: string;
  /** Device tạo task — chỉ device này tự động chạy (tránh chạy trùng nhiều máy). */
  deviceId: string;
  /** Hostname để admin nhận diện máy. */
  deviceName?: string;
  createdAt: number;
  updatedAt: number;
}

/** Thông tin hiển thị + meta về 4 loại task. */
export interface TaskKindMeta {
  kind: ScheduledTaskKind;
  label: string;
  description: string;
  icon: string;
}

export const TASK_KINDS: ReadonlyArray<TaskKindMeta> = [
  {
    kind: 'clean.preview',
    label: 'Dọn dẹp — preview',
    description: 'Quét tìm file rác, KHÔNG xoá. Báo cáo dung lượng có thể giải phóng.',
    icon: '🔍',
  },
  {
    kind: 'clean.full',
    label: 'Dọn dẹp — xoá thực',
    description: 'Xoá file rác Temp / Recycle Bin / browser cache.',
    icon: '🧹',
  },
  {
    kind: 'check.report',
    label: 'Kiểm tra máy — sinh report',
    description: 'Snapshot System Info + Health Score.',
    icon: '📊',
  },
  {
    kind: 'font.scan-system',
    label: 'Font — scan hệ thống',
    description: 'Liệt kê font đã cài, đối chiếu font pack TrishTEAM.',
    icon: '🔤',
  },
];

export interface CadenceMeta {
  cadence: ScheduledTaskCadence;
  label: string;
  description: string;
}

export const CADENCES: ReadonlyArray<CadenceMeta> = [
  { cadence: 'hourly',         label: 'Mỗi giờ',           description: 'Đầu mỗi giờ tròn (0 phút).' },
  { cadence: 'daily-morning',  label: 'Sáng (08:00)',     description: 'Mỗi ngày lúc 08:00.' },
  { cadence: 'daily-noon',     label: 'Trưa (12:00)',     description: 'Mỗi ngày lúc 12:00.' },
  { cadence: 'daily-evening',  label: 'Tối (19:00)',      description: 'Mỗi ngày lúc 19:00.' },
  { cadence: 'weekly-monday',  label: 'Thứ 2 hàng tuần',  description: 'Thứ 2 lúc 08:00.' },
  { cadence: 'weekly-friday',  label: 'Thứ 6 hàng tuần',  description: 'Thứ 6 lúc 17:00.' },
  { cadence: 'monthly-first',  label: 'Mùng 1 hàng tháng', description: 'Ngày 1 hàng tháng lúc 08:00.' },
];
