/**
 * TrishOffice Auth — Role + Permission domain types (Phase 38.7).
 *
 * 8 role:
 *   - owner       : Giám đốc (full access toàn bộ)
 *   - vice_director: Phó Giám đốc (như owner trừ User Management)
 *   - dept_manager: Trưởng phòng (quản lý phòng mình)
 *   - dept_deputy : Phó phòng (như TP nhưng ko approve cuối)
 *   - hr          : HR / Nhân sự (full module Nhân sự + Tài liệu HR)
 *   - accountant  : Kế toán (full module Kế toán)
 *   - staff       : Nhân viên (chỉ thấy hồ sơ + lương cá nhân)
 *   - admin_it    : Admin IT (User management + system settings)
 */

// ============================================================
// Role enum
// ============================================================
export type Role =
  | 'owner'
  | 'vice_director'
  | 'dept_manager'
  | 'dept_deputy'
  | 'hr'
  | 'accountant'
  | 'staff'
  | 'admin_it';

export interface RoleMeta {
  key: Role;
  label: string;
  emoji: string;
  /** Gợi ý dùng cho ai */
  description: string;
  /** Mức cao thấp (lớn = cao). Dùng cho approval workflow. */
  level: number;
}

export const ROLES: Record<Role, RoleMeta> = {
  owner: {
    key: 'owner',
    label: 'Giám đốc',
    emoji: '👑',
    description: 'Toàn quyền — xem và quản lý mọi module, phê duyệt cuối cùng',
    level: 100,
  },
  vice_director: {
    key: 'vice_director',
    label: 'Phó Giám đốc',
    emoji: '🎖️',
    description: 'Như Giám đốc, không được quản lý user system',
    level: 90,
  },
  dept_manager: {
    key: 'dept_manager',
    label: 'Trưởng phòng',
    emoji: '👔',
    description: 'Quản lý nhân sự + tài sản + duyệt workflow phòng mình',
    level: 70,
  },
  dept_deputy: {
    key: 'dept_deputy',
    label: 'Phó phòng',
    emoji: '🎩',
    description: 'Như Trưởng phòng nhưng không phải người duyệt cuối',
    level: 60,
  },
  hr: {
    key: 'hr',
    label: 'HR / Nhân sự',
    emoji: '👥',
    description: 'Quản lý hồ sơ NV cross-department, chấm công, hợp đồng',
    level: 50,
  },
  accountant: {
    key: 'accountant',
    label: 'Kế toán',
    emoji: '💵',
    description: 'Tính lương + thuế + BHXH + báo cáo BCTC, view nhân sự',
    level: 50,
  },
  admin_it: {
    key: 'admin_it',
    label: 'Admin IT',
    emoji: '🛡️',
    description: 'Quản lý user accounts + phòng ban + system settings',
    level: 80,
  },
  staff: {
    key: 'staff',
    label: 'Nhân viên',
    emoji: '👤',
    description: 'Xem hồ sơ + lương cá nhân, tạo yêu cầu workflow',
    level: 10,
  },
};

export const ROLE_LIST: RoleMeta[] = Object.values(ROLES);

// ============================================================
// Module key (sync với 7 module trong App.tsx + 2 admin module + 3 phase 38.20+)
// ============================================================
export type ModuleKey =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'assets'
  | 'workflows'
  | 'documents'
  | 'accounting'
  | 'calendar' // Phase 38.20: lịch events
  | 'reports' // Phase 38.22: báo cáo nâng cao
  | 'import_export' // Phase 38.21: backup/restore
  | 'users' // admin: quản lý account login
  | 'departments' // admin: quản lý phòng ban
  | 'settings'; // self: đổi password

// ============================================================
// Action enum (CRUD + special)
// ============================================================
export type Action =
  | 'view' // xem list/detail
  | 'create' // tạo mới
  | 'edit' // sửa
  | 'delete' // xóa
  | 'export' // export CSV/PDF
  | 'approve' // duyệt workflow
  | 'finalize'; // finalize bảng lương / approve cuối

// ============================================================
// Scope — phạm vi data được phép thấy
// ============================================================
export type Scope =
  | 'all' // toàn bộ data công ty
  | 'department' // chỉ phòng ban mình
  | 'self' // chỉ data của bản thân
  | 'none'; // ko thấy gì

// ============================================================
// AppUser — account login local
// ============================================================
export interface AppUser {
  id: string;
  /** Username login (unique) */
  username: string;
  /** Tên hiển thị */
  display_name: string;
  /** Email tùy chọn */
  email?: string;
  role: Role;
  /** Phòng ban (id của Department). Optional cho owner/vice/admin_it */
  department_id?: string;
  /** Liên kết tới Employee record (nếu user này là nhân viên trong cty) */
  employee_id?: string;
  /** Hash password (SHA256(salt + password) hex) */
  password_hash: string;
  /** Salt random (hex) — gắn với từng user */
  password_salt: string;
  /** Active hay đã disable */
  active: boolean;
  /** Lần login cuối */
  last_login_at?: number;
  /** Cần đổi password lần đăng nhập tới ko (khi admin reset) */
  must_change_password?: boolean;
  /**
   * Phase 38.8 — TrishTEAM ecosystem admin link.
   * Nếu user này là admin của hệ sinh thái (Firebase role='admin'),
   * lưu firebase_uid để tự động restore session khi mở app.
   * Các user này KHÔNG dùng password local — auth qua Firebase.
   */
  firebase_uid?: string;
  /** True nếu user là TrishTEAM ecosystem admin (Trí + cộng sự) */
  is_ecosystem_admin?: boolean;
  notes?: string;
  created_at: number;
  updated_at: number;
}

// ============================================================
// Department — phòng ban (mở rộng từ types.ts gốc cho UI)
// ============================================================
export interface DepartmentInfo {
  id: string;
  /** Mã ngắn (vd "TK", "TC") */
  code: string;
  name: string;
  /** Trưởng phòng (employee_id) */
  manager_id?: string;
  /** Mô tả */
  description?: string;
  /** Phòng ban cha (cho hierarchy đa cấp) */
  parent_id?: string;
  /** Đang hoạt động */
  active: boolean;
  created_at: number;
  updated_at: number;
}

// ============================================================
// Auth session state
// ============================================================
export interface AuthSession {
  user_id: string;
  username: string;
  role: Role;
  display_name: string;
  department_id?: string;
  employee_id?: string;
  /** Timestamp login */
  logged_in_at: number;
  /** Hết hạn session (auto logout). Default 12h. */
  expires_at: number;
}

// ============================================================
// 6 phòng ban preset gợi ý cho cty XD-GT VN
// ============================================================
export const DEPARTMENT_PRESETS: Array<{
  code: string;
  name: string;
  description: string;
}> = [
  { code: 'BGD', name: 'Ban Giám đốc', description: 'Lãnh đạo công ty' },
  { code: 'TK', name: 'Phòng Thiết kế', description: 'Thiết kế kỹ thuật, hồ sơ thiết kế' },
  { code: 'TC', name: 'Phòng Thi công', description: 'Thi công công trường, giám sát' },
  { code: 'KT', name: 'Phòng Kế toán', description: 'Kế toán, tài chính, lương' },
  { code: 'HR', name: 'Phòng Hành chính - Nhân sự', description: 'HR, tuyển dụng, hợp đồng, BHXH' },
  { code: 'HC', name: 'Phòng Hành chính', description: 'Văn phòng, tài sản, hậu cần' },
];
