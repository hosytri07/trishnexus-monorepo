/**
 * TrishOffice — usePermission hook.
 *
 * Tổng hợp can() + scopeOf() + filterByScope() cho 1 module trong context
 * của user đang login. Dùng trong từng page để gate UI + lọc data.
 *
 * @example
 *   const perm = usePermission('employees');
 *   if (perm.can('create')) <button>+ Thêm</button>
 *   const visible = perm.filter(items, e => e.department, e => e.id);
 */

import { useAuth } from './AuthContext';
import { can, scopeOf, filterByScope } from './permissions';
import { useCollection } from '../storage';
import type { Action, ModuleKey, Scope, DepartmentInfo } from './types';
import { useMemo } from 'react';

export interface PermissionHelper {
  scope: Scope;
  can: (action: Action) => boolean;
  /**
   * Lọc list theo scope của user.
   *
   * @param items List gốc
   * @param getDeptCode Hàm lấy department CODE (vd "TK") của item.
   *                    Nếu item lưu department theo NAME hoặc CODE đều ok,
   *                    helper sẽ try match cả 2.
   * @param getEmployeeId Hàm lấy employee_id của item
   */
  filter: <T>(
    items: T[],
    getDeptCode: (item: T) => string | undefined,
    getEmployeeId: (item: T) => string | undefined,
  ) => T[];
  /** Department code của user (từ Department record), undefined nếu user không thuộc dept */
  userDeptCode: string | undefined;
  /** Employee ID của user (link với Employee record) */
  userEmployeeId: string | undefined;
}

export function usePermission(module: ModuleKey): PermissionHelper {
  const auth = useAuth();
  const departments = useCollection<DepartmentInfo>('departments', 'dpt');

  const userDept = auth.currentUser?.department_id
    ? departments.items.find((d) => d.id === auth.currentUser?.department_id)
    : undefined;
  const userDeptCode = userDept?.code;
  const userDeptName = userDept?.name;
  const userEmployeeId = auth.currentUser?.employee_id;

  const role = auth.currentUser?.role;

  return useMemo<PermissionHelper>(() => {
    if (!role) {
      return {
        scope: 'none',
        can: () => false,
        filter: () => [],
        userDeptCode: undefined,
        userEmployeeId: undefined,
      };
    }
    const sc = scopeOf(role, module);
    return {
      scope: sc,
      can: (action: Action) => can(role, module, action),
      filter: <T>(
        items: T[],
        getDeptCode: (item: T) => string | undefined,
        getEmployeeId: (item: T) => string | undefined,
      ): T[] => {
        if (sc === 'all') return items;
        if (sc === 'none') return [];
        if (sc === 'self') {
          if (!userEmployeeId) return [];
          return items.filter((it) => getEmployeeId(it) === userEmployeeId);
        }
        if (sc === 'department') {
          if (!userDeptCode && !userDeptName) return [];
          return items.filter((it) => {
            const itDept = getDeptCode(it);
            if (!itDept) return false;
            // Match either code or name (Employee có thể lưu theo cả 2)
            return itDept === userDeptCode || itDept === userDeptName;
          });
        }
        return filterByScope(
          items,
          sc,
          userDeptCode,
          userEmployeeId,
          getDeptCode,
          getEmployeeId,
        );
      },
      userDeptCode,
      userEmployeeId,
    };
  }, [role, module, userDeptCode, userDeptName, userEmployeeId]);
}
