/**
 * TrishOffice Auth — Strict RBAC Permission Matrix (Phase 38.7).
 *
 * Mỗi cell là { actions: Action[], scope: Scope }.
 * Ý nghĩa scope:
 *   - 'all'        : thấy/sửa toàn bộ data công ty
 *   - 'department' : chỉ phòng ban của user (so sánh employee.department === user.department)
 *   - 'self'       : chỉ data có employee_id === user.employee_id
 *   - 'none'       : không thấy gì (module bị ẩn)
 *
 * Helper: can(role, module, action) → boolean
 * Helper: scopeOf(role, module) → Scope
 *
 * Quy tắc thiết kế:
 *   - Owner: full toàn bộ (trừ admin_it module → có để debug nhưng nhẹ tay)
 *   - Vice Director: như Owner trừ User Management (admin_it không cho)
 *   - Admin IT: full User + Department, view các module khác
 *   - HR: full module Nhân sự + Chấm công + Tài liệu HR + Workflow nghỉ phép
 *   - Accountant: full module Kế toán, view Nhân sự + Chấm công, approve Workflow $
 *   - Dept Manager: scope dept của mình, approve Workflow phòng mình
 *   - Dept Deputy: như Manager nhưng KHÔNG có 'finalize' / 'approve' cuối
 *   - Staff: scope self, chỉ create Workflow của bản thân
 */

import type { Action, ModuleKey, Role, Scope } from './types';

interface Permission {
  /** Phạm vi data được phép thấy */
  scope: Scope;
  /** Các action được phép trong phạm vi đó */
  actions: Action[];
}

/** Helper tạo permission object */
function p(scope: Scope, actions: Action[]): Permission {
  return { scope, actions };
}

/** Quyền full all + mọi action */
const FULL_ALL: Permission = p('all', [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'approve',
  'finalize',
]);

/** Read-only toàn bộ */
const VIEW_ALL: Permission = p('all', ['view', 'export']);
/** Read-only phòng ban */
const VIEW_DEPT: Permission = p('department', ['view', 'export']);
/** Read-only bản thân */
const VIEW_SELF: Permission = p('self', ['view']);
/** Không thấy */
const NONE: Permission = p('none', []);

// ============================================================
// Permission Matrix — Role × Module → Permission
// ============================================================
export const PERMISSIONS: Record<Role, Record<ModuleKey, Permission>> = {
  // ============================================================
  // ECOSYSTEM ADMIN — Admin TrishTEAM: full toàn bộ, cross-company
  // ============================================================
  ecosystem_admin: {
    dashboard: FULL_ALL,
    employees: FULL_ALL,
    attendance: FULL_ALL,
    assets: FULL_ALL,
    workflows: FULL_ALL,
    documents: FULL_ALL,
    accounting: FULL_ALL,
    calendar: FULL_ALL,
    reports: FULL_ALL,
    import_export: FULL_ALL,
    users: FULL_ALL, // KHÁC owner — admin được quản lý user
    departments: FULL_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // OWNER — Giám đốc 1 công ty: full toàn bộ trừ User Management
  // ============================================================
  owner: {
    dashboard: FULL_ALL,
    employees: FULL_ALL,
    attendance: FULL_ALL,
    assets: FULL_ALL,
    workflows: FULL_ALL,
    documents: FULL_ALL,
    accounting: FULL_ALL,
    calendar: FULL_ALL,
    reports: FULL_ALL,
    import_export: FULL_ALL,
    users: VIEW_ALL, // chỉ xem, ko sửa (Admin IT làm)
    departments: FULL_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // VICE DIRECTOR — Phó GĐ: như Owner trừ User Management
  // ============================================================
  vice_director: {
    dashboard: FULL_ALL,
    employees: p('all', ['view', 'create', 'edit', 'export']),
    attendance: FULL_ALL,
    assets: FULL_ALL,
    workflows: FULL_ALL,
    documents: FULL_ALL,
    accounting: p('all', ['view', 'export', 'finalize']),
    calendar: FULL_ALL,
    reports: FULL_ALL,
    import_export: FULL_ALL,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // DEPT MANAGER — Trưởng phòng: scope dept
  // ============================================================
  dept_manager: {
    dashboard: p('department', ['view']),
    employees: p('department', ['view', 'edit', 'export']),
    attendance: p('department', ['view', 'create', 'edit', 'export']),
    assets: p('department', ['view', 'edit']),
    workflows: p('department', ['view', 'create', 'edit', 'approve', 'export']),
    documents: p('all', ['view', 'create', 'edit']), // tài liệu xem chung
    accounting: VIEW_SELF, // chỉ thấy lương bản thân
    calendar: p('department', ['view']),
    reports: VIEW_DEPT,
    import_export: NONE,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // DEPT DEPUTY — Phó phòng: như Manager nhưng ko approve cuối
  // ============================================================
  dept_deputy: {
    dashboard: p('department', ['view']),
    employees: p('department', ['view', 'export']),
    attendance: p('department', ['view', 'create', 'edit']),
    assets: p('department', ['view']),
    workflows: p('department', ['view', 'create', 'edit', 'export']), // ko approve
    documents: p('all', ['view']),
    accounting: VIEW_SELF,
    calendar: p('department', ['view']),
    reports: VIEW_DEPT,
    import_export: NONE,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // HR — full Nhân sự + Chấm công + Tài liệu HR
  // ============================================================
  hr: {
    dashboard: VIEW_ALL,
    employees: FULL_ALL,
    attendance: FULL_ALL,
    assets: VIEW_ALL,
    workflows: p('all', ['view', 'create', 'edit', 'approve', 'export']),
    documents: FULL_ALL,
    accounting: VIEW_ALL, // HR thấy lương để verify
    calendar: FULL_ALL,
    reports: VIEW_ALL,
    import_export: NONE,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // ACCOUNTANT — full Kế toán
  // ============================================================
  accountant: {
    dashboard: VIEW_ALL,
    employees: VIEW_ALL,
    attendance: VIEW_ALL,
    assets: VIEW_ALL,
    workflows: p('all', ['view', 'approve', 'export']), // approve $ workflows
    documents: VIEW_ALL,
    accounting: FULL_ALL,
    calendar: VIEW_ALL,
    reports: FULL_ALL,
    import_export: NONE,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // ADMIN IT — User + Department + Settings
  // ============================================================
  admin_it: {
    dashboard: VIEW_ALL,
    employees: VIEW_ALL,
    attendance: VIEW_ALL,
    assets: FULL_ALL,
    workflows: VIEW_ALL,
    documents: VIEW_ALL,
    accounting: NONE, // ko nhúng vào lương
    calendar: VIEW_ALL,
    reports: NONE,
    import_export: FULL_ALL,
    users: FULL_ALL,
    departments: FULL_ALL,
    settings: p('self', ['view', 'edit']),
  },

  // ============================================================
  // STAFF — chỉ self
  // ============================================================
  staff: {
    dashboard: p('self', ['view']),
    employees: VIEW_SELF,
    attendance: p('self', ['view', 'create']), // tự nhập OT
    assets: VIEW_SELF, // thấy tài sản đang được giao
    workflows: p('self', ['view', 'create']), // tạo yêu cầu cá nhân
    documents: p('all', ['view']), // tài liệu cty xem chung
    accounting: VIEW_SELF, // xem lương bản thân
    calendar: p('all', ['view']),
    reports: NONE,
    import_export: NONE,
    users: NONE,
    departments: VIEW_ALL,
    settings: p('self', ['view', 'edit']),
  },
};

// ============================================================
// Public helpers
// ============================================================

/**
 * Kiểm tra role có quyền thực hiện action trên module ko.
 *
 * @example
 *   can('hr', 'employees', 'edit') // true
 *   can('staff', 'employees', 'delete') // false
 */
export function can(role: Role, module: ModuleKey, action: Action): boolean {
  const perm = PERMISSIONS[role]?.[module];
  if (!perm || perm.scope === 'none') return false;
  return perm.actions.includes(action);
}

/**
 * Lấy scope của role với module.
 *
 * @example
 *   scopeOf('dept_manager', 'employees') // 'department'
 *   scopeOf('staff', 'accounting') // 'self'
 */
export function scopeOf(role: Role, module: ModuleKey): Scope {
  return PERMISSIONS[role]?.[module]?.scope ?? 'none';
}

/**
 * Kiểm tra role có thấy được module ko (để hiển thị/ẩn nav item).
 */
export function canSeeModule(role: Role, module: ModuleKey): boolean {
  return scopeOf(role, module) !== 'none';
}

/**
 * Filter list items theo scope của user.
 *
 * @param items List gốc
 * @param scope Scope của user với module
 * @param userDept ID phòng ban của user
 * @param userEmployeeId ID employee của user
 * @param getDept Hàm lấy department của item
 * @param getEmployeeId Hàm lấy employee_id của item
 */
export function filterByScope<T>(
  items: T[],
  scope: Scope,
  userDept: string | undefined,
  userEmployeeId: string | undefined,
  getDept: (item: T) => string | undefined,
  getEmployeeId: (item: T) => string | undefined,
): T[] {
  if (scope === 'all') return items;
  if (scope === 'none') return [];
  if (scope === 'department') {
    if (!userDept) return [];
    return items.filter((it) => getDept(it) === userDept);
  }
  if (scope === 'self') {
    if (!userEmployeeId) return [];
    return items.filter((it) => getEmployeeId(it) === userEmployeeId);
  }
  return [];
}
