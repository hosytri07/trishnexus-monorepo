'use client';

/**
 * useUserSession — compat wrapper Phase 11.6.2.
 *
 * API cũ được giữ nguyên để các component hiện tại (NavPanels, admin,
 * dashboard) không cần sửa. Nội bộ delegate sang `useAuth()` từ
 * lib/auth-context.tsx — có thể chạy ở cả mock mode (chưa có Firebase)
 * lẫn firebase mode (đã set NEXT_PUBLIC_FIREBASE_*).
 *
 * Đặc điểm:
 *   - Mock mode: role switcher trong navbar còn hoạt động (dev).
 *   - Firebase mode: setRole() no-op + warn; role đọc từ Firestore.
 */
import { useAuth, type UserRole, type SessionUser } from './auth-context';

export type { UserRole, SessionUser };

export function useUserSession(): {
  user: SessionUser | null;
  role: UserRole;
  setRole: (r: UserRole) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  logout: () => void;
} {
  const { user, role, setRole, isAdmin, isAuthenticated, logout } = useAuth();
  // Wrap async logout() → sync void để giữ signature cũ.
  return {
    user,
    role,
    setRole,
    isAdmin,
    isAuthenticated,
    logout: () => {
      void logout();
    },
  };
}
