/**
 * TrishOffice Auth — Context provider + hooks (Phase 38.7).
 *
 * Quản lý:
 *   - currentUser (AppUser | null)
 *   - login(username, password) → boolean
 *   - logout()
 *   - changePassword(old, new)
 *   - registerUser(input) — chỉ admin gọi
 *
 * Session lưu localStorage `trishoffice:session`. Auto-expires sau 12h.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadAll, saveAll, generateId } from '../storage';
import {
  hashPassword,
  generateSalt,
  verifyPassword,
} from './password';
import type { AppUser, AuthSession, Role } from './types';

const SESSION_KEY = 'trishoffice:session';
const USERS_COLLECTION = 'app_users';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12h

// ============================================================
// Context shape
// ============================================================
interface AuthContextValue {
  /** User đang login. null = chưa login */
  currentUser: AppUser | null;
  /** Session info */
  session: AuthSession | null;
  /** True khi đang load session lần đầu */
  loading: boolean;
  /** True khi chưa có user nào trong hệ thống → cần Setup Admin */
  needsBootstrap: boolean;
  login: (
    username: string,
    password: string,
    /**
     * Phase 38.13 — Khi user login local lần đầu, tự động link firebase_uid
     * + email của Firebase user hiện tại vào AppUser này (nếu chưa có).
     * Lần sau mở app sẽ auto-login (không cần nhập username/password).
     */
    linkFirebase?: { uid: string; email?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Tạo user (chỉ admin/owner gọi) */
  registerUser: (input: {
    username: string;
    password: string;
    display_name: string;
    email?: string;
    role: Role;
    department_id?: string;
    employee_id?: string;
  }) => Promise<{ ok: boolean; error?: string; user?: AppUser }>;
  /** Update user (admin sửa thông tin user khác, hoặc self update) */
  updateUser: (
    userId: string,
    patch: Partial<Omit<AppUser, 'id' | 'password_hash' | 'password_salt' | 'created_at'>>,
  ) => void;
  /** Reset password (admin reset cho user khác) */
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  /** Self change password */
  changeOwnPassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Xóa user */
  deleteUser: (userId: string) => void;
  /** Toggle active */
  toggleUserActive: (userId: string) => void;
  /** Lấy toàn bộ user (cho Users page) */
  listUsers: () => AppUser[];
  /** Reload user list (sau khi mutate) */
  reloadUsers: () => void;
  /**
   * Phase 38.8 — Sign in as TrishTEAM ecosystem admin (bypass password).
   * Tự động tạo AppUser nếu chưa có. Set role 'owner' + is_ecosystem_admin.
   *
   * Gọi từ App.tsx khi detect Firebase user có isAdmin=true.
   */
  signInAsEcosystemAdmin: (input: {
    firebase_uid: string;
    email: string;
    display_name: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================
export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load users + session lần đầu
  useEffect(() => {
    let allUsers = loadAll<AppUser>(USERS_COLLECTION);

    // Phase 40.1 — Migration: ecosystem admin từ role 'owner' (cũ) → 'ecosystem_admin'.
    // User test trước có role='owner' + is_ecosystem_admin=true → tự sửa.
    const needMigrate = allUsers.some(
      (u) => u.is_ecosystem_admin === true && (u.role as string) !== 'ecosystem_admin',
    );
    if (needMigrate) {
      allUsers = allUsers.map((u) =>
        u.is_ecosystem_admin === true && (u.role as string) !== 'ecosystem_admin'
          ? { ...u, role: 'ecosystem_admin' as const, updated_at: Date.now() }
          : u,
      );
      saveAll<AppUser>(USERS_COLLECTION, allUsers);
      console.info('[trishoffice] migrated ecosystem admins from "owner" to "ecosystem_admin"');
    }

    setUsers(allUsers);

    // Restore session
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const sess = JSON.parse(raw) as AuthSession;
        if (sess.expires_at > Date.now()) {
          // Verify user still exists + active
          const u = allUsers.find((x) => x.id === sess.user_id);
          if (u && u.active) {
            setSession(sess);
          } else {
            window.localStorage.removeItem(SESSION_KEY);
          }
        } else {
          window.localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      /* ignore */
    }

    setLoading(false);
  }, []);

  const reloadUsers = useCallback((): void => {
    setUsers(loadAll<AppUser>(USERS_COLLECTION));
  }, []);

  const persistUsers = useCallback((next: AppUser[]): void => {
    setUsers(next);
    saveAll<AppUser>(USERS_COLLECTION, next);
  }, []);

  // ============================================================
  // Derived state
  // ============================================================
  const currentUser = useMemo<AppUser | null>(() => {
    if (!session) return null;
    return users.find((u) => u.id === session.user_id) ?? null;
  }, [session, users]);

  const needsBootstrap = !loading && users.length === 0;

  // ============================================================
  // Login
  // ============================================================
  const login = useCallback(
    async (
      username: string,
      password: string,
      linkFirebase?: { uid: string; email?: string | null },
    ): Promise<{ ok: boolean; error?: string }> => {
      const u = users.find(
        (x) => x.username.toLowerCase() === username.toLowerCase(),
      );
      if (!u) return { ok: false, error: 'Username không tồn tại' };
      if (!u.active) return { ok: false, error: 'Account đã bị disable' };

      const ok = await verifyPassword(password, u.password_hash, u.password_salt);
      if (!ok) return { ok: false, error: 'Sai password' };

      // Update last_login_at + auto-link firebase_uid nếu chưa có
      const now = Date.now();
      const updated: AppUser = {
        ...u,
        last_login_at: now,
        updated_at: now,
        // Auto-link Firebase: chỉ set nếu user chưa có firebase_uid
        firebase_uid: u.firebase_uid ?? linkFirebase?.uid,
        email: u.email ?? linkFirebase?.email ?? undefined,
      };
      persistUsers(users.map((x) => (x.id === u.id ? updated : x)));

      // Create session
      const sess: AuthSession = {
        user_id: u.id,
        username: u.username,
        role: u.role,
        display_name: u.display_name,
        department_id: u.department_id,
        employee_id: u.employee_id,
        logged_in_at: now,
        expires_at: now + SESSION_DURATION_MS,
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      setSession(sess);

      return { ok: true };
    },
    [users, persistUsers],
  );

  // ============================================================
  // Logout
  // ============================================================
  const logout = useCallback((): void => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  // ============================================================
  // Register user
  // ============================================================
  const registerUser = useCallback(
    async (input: {
      username: string;
      password: string;
      display_name: string;
      email?: string;
      role: Role;
      department_id?: string;
      employee_id?: string;
    }): Promise<{ ok: boolean; error?: string; user?: AppUser }> => {
      // Check duplicate username
      if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
        return { ok: false, error: 'Username đã tồn tại' };
      }

      const salt = generateSalt();
      const hash = await hashPassword(input.password, salt);
      const now = Date.now();
      const user: AppUser = {
        id: generateId('usr'),
        username: input.username.trim(),
        display_name: input.display_name.trim(),
        email: input.email?.trim() || undefined,
        role: input.role,
        department_id: input.department_id,
        employee_id: input.employee_id,
        password_hash: hash,
        password_salt: salt,
        active: true,
        created_at: now,
        updated_at: now,
      };
      persistUsers([user, ...users]);
      return { ok: true, user };
    },
    [users, persistUsers],
  );

  // ============================================================
  // Update user (no password change)
  // ============================================================
  const updateUser = useCallback(
    (
      userId: string,
      patch: Partial<Omit<AppUser, 'id' | 'password_hash' | 'password_salt' | 'created_at'>>,
    ): void => {
      persistUsers(
        users.map((u) =>
          u.id === userId ? { ...u, ...patch, updated_at: Date.now() } : u,
        ),
      );
    },
    [users, persistUsers],
  );

  // ============================================================
  // Reset password (admin)
  // ============================================================
  const resetUserPassword = useCallback(
    async (
      userId: string,
      newPassword: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      const u = users.find((x) => x.id === userId);
      if (!u) return { ok: false, error: 'User không tồn tại' };
      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);
      persistUsers(
        users.map((x) =>
          x.id === userId
            ? {
                ...x,
                password_hash: hash,
                password_salt: salt,
                must_change_password: true,
                updated_at: Date.now(),
              }
            : x,
        ),
      );
      return { ok: true };
    },
    [users, persistUsers],
  );

  // ============================================================
  // Self change password
  // ============================================================
  const changeOwnPassword = useCallback(
    async (
      oldPassword: string,
      newPassword: string,
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!currentUser) return { ok: false, error: 'Chưa login' };
      const ok = await verifyPassword(
        oldPassword,
        currentUser.password_hash,
        currentUser.password_salt,
      );
      if (!ok) return { ok: false, error: 'Password cũ sai' };
      const salt = generateSalt();
      const hash = await hashPassword(newPassword, salt);
      persistUsers(
        users.map((x) =>
          x.id === currentUser.id
            ? {
                ...x,
                password_hash: hash,
                password_salt: salt,
                must_change_password: false,
                updated_at: Date.now(),
              }
            : x,
        ),
      );
      return { ok: true };
    },
    [currentUser, users, persistUsers],
  );

  // ============================================================
  // Delete user
  // ============================================================
  const deleteUser = useCallback(
    (userId: string): void => {
      persistUsers(users.filter((u) => u.id !== userId));
      // Nếu xóa chính mình thì logout
      if (currentUser?.id === userId) logout();
    },
    [users, currentUser, logout, persistUsers],
  );

  // ============================================================
  // Toggle active
  // ============================================================
  const toggleUserActive = useCallback(
    (userId: string): void => {
      persistUsers(
        users.map((u) =>
          u.id === userId ? { ...u, active: !u.active, updated_at: Date.now() } : u,
        ),
      );
    },
    [users, persistUsers],
  );

  const listUsers = useCallback((): AppUser[] => users, [users]);

  // ============================================================
  // Phase 38.8 — Sign in as TrishTEAM ecosystem admin (bypass password)
  // ============================================================
  const signInAsEcosystemAdmin = useCallback(
    async (input: {
      firebase_uid: string;
      email: string;
      display_name: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      // 1. Tìm AppUser hiện có theo firebase_uid hoặc email
      let admin = users.find(
        (u) =>
          u.firebase_uid === input.firebase_uid ||
          (u.is_ecosystem_admin && u.email === input.email),
      );

      // 2. Nếu chưa có → tự tạo AppUser owner cho ecosystem admin
      if (!admin) {
        const salt = generateSalt();
        // Random password để placeholder — admin này không dùng password local
        const randomPwd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        const hash = await hashPassword(randomPwd, salt);
        const now = Date.now();
        const username = input.email.split('@')[0] || 'admin';
        // Tránh collision username
        let finalUsername = username;
        let i = 1;
        while (users.some((u) => u.username.toLowerCase() === finalUsername.toLowerCase())) {
          finalUsername = `${username}.${i}`;
          i++;
        }
        admin = {
          id: generateId('usr'),
          username: finalUsername,
          display_name: input.display_name || input.email,
          email: input.email,
          role: 'ecosystem_admin', // Phase 40.1 — tách khỏi 'owner' (Giám đốc)
          firebase_uid: input.firebase_uid,
          is_ecosystem_admin: true,
          password_hash: hash,
          password_salt: salt,
          active: true,
          created_at: now,
          updated_at: now,
        };
        const next = [admin, ...users];
        persistUsers(next);
      } else if (
        !admin.is_ecosystem_admin ||
        admin.firebase_uid !== input.firebase_uid ||
        (admin.role as string) !== 'ecosystem_admin' // Phase 40.1 — force update role
      ) {
        // Update để chắc chắn flag + uid + role đúng
        const next = users.map((u) =>
          u.id === admin!.id
            ? {
                ...u,
                firebase_uid: input.firebase_uid,
                is_ecosystem_admin: true,
                role: 'ecosystem_admin' as const, // Phase 40.1
                active: true,
                last_login_at: Date.now(),
                updated_at: Date.now(),
              }
            : u,
        );
        persistUsers(next);
        admin = next.find((u) => u.id === admin!.id);
      } else {
        // Update last_login_at
        const now = Date.now();
        const next = users.map((u) =>
          u.id === admin!.id ? { ...u, last_login_at: now, updated_at: now } : u,
        );
        persistUsers(next);
        admin = next.find((u) => u.id === admin!.id);
      }

      if (!admin) return { ok: false, error: 'Không tạo được ecosystem admin' };

      // 3. Tạo session
      const now = Date.now();
      const sess: AuthSession = {
        user_id: admin.id,
        username: admin.username,
        role: admin.role,
        display_name: admin.display_name,
        department_id: admin.department_id,
        employee_id: admin.employee_id,
        logged_in_at: now,
        expires_at: now + SESSION_DURATION_MS,
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      setSession(sess);
      return { ok: true };
    },
    [users, persistUsers],
  );

  // ============================================================
  // Provide
  // ============================================================
  const value: AuthContextValue = {
    currentUser,
    session,
    loading,
    needsBootstrap,
    login,
    logout,
    registerUser,
    updateUser,
    resetUserPassword,
    changeOwnPassword,
    deleteUser,
    toggleUserActive,
    listUsers,
    reloadUsers,
    signInAsEcosystemAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================
// Hook
// ============================================================
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
