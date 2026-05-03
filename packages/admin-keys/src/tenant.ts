/**
 * @trishteam/admin-keys — Tenant resolver.
 *
 * Phase 28.8 (2026-05-03).
 *
 * Multi-tenant strategy:
 *   - Mỗi user có thể thuộc 1 tenant (team/công ty). Mặc định 'default'.
 *   - Field `tenant_id` trên TrishUser doc (chưa add vào @trishteam/data —
 *     tự fallback nếu thiếu).
 *   - Admin có thể switch tenant qua TrishAdmin UI (lưu localStorage).
 *
 * Resolution order ở client (TrishDesign):
 *   1. localStorage 'trishteam.tenant_id'
 *   2. profile.tenant_id (nếu có)
 *   3. 'default'
 */

import type { TrishUser } from '@trishteam/data';

export const DEFAULT_TENANT_ID = 'default';
const TENANT_LS_KEY = 'trishteam.tenant_id';

/** Resolve tenant ID từ profile + localStorage. Client-side only. */
export function resolveTenantId(profile: TrishUser | null | undefined): string {
  // 1. localStorage override (admin set trong TrishAdmin)
  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage.getItem(TENANT_LS_KEY);
      if (ls && ls.trim()) return ls.trim();
    } catch {
      /* ignore */
    }
  }
  // 2. profile.tenant_id (cast vì TrishUser hiện chưa khai báo field này)
  const fromProfile = (profile as unknown as { tenant_id?: string } | null)
    ?.tenant_id;
  if (typeof fromProfile === 'string' && fromProfile.trim()) {
    return fromProfile.trim();
  }
  // 3. default
  return DEFAULT_TENANT_ID;
}

/** Admin set tenant active trong TrishAdmin (lưu localStorage). */
export function setActiveTenantId(tenant: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (tenant && tenant !== DEFAULT_TENANT_ID) {
      window.localStorage.setItem(TENANT_LS_KEY, tenant);
    } else {
      window.localStorage.removeItem(TENANT_LS_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Lấy tenant active từ localStorage (TrishAdmin UI). */
export function getActiveTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  try {
    const ls = window.localStorage.getItem(TENANT_LS_KEY);
    return ls && ls.trim() ? ls.trim() : DEFAULT_TENANT_ID;
  } catch {
    return DEFAULT_TENANT_ID;
  }
}

/**
 * Validate tenant ID format. Chỉ cho a-zA-Z0-9_- để tránh path injection
 * Firestore. Trả lỗi message nếu invalid.
 */
export function validateTenantId(tenant: string): string | null {
  const t = tenant.trim();
  if (!t) return 'Tenant ID rỗng';
  if (t.length > 64) return 'Tenant ID dài tối đa 64 ký tự';
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) {
    return 'Tenant ID chỉ chứa chữ, số, gạch dưới, gạch ngang';
  }
  return null;
}
