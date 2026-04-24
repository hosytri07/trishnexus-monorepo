'use client';

/**
 * AuthProvider — Phase 11.6.2.
 *
 * Kiến trúc:
 *   - Khi firebaseReady=false HOẶC NEXT_PUBLIC_AUTH_MOCK=1 → mode='mock':
 *     dùng localStorage role switcher cũ (để dev không cần Firebase).
 *   - Khi firebaseReady=true → mode='firebase':
 *     1. onAuthStateChanged() listener cập nhật firebaseUser
 *     2. Fetch Firestore /users/{uid} để lấy profile mở rộng (fullName,
 *        phone, role...) — nếu doc chưa có thì tự tạo với role='user'.
 *     3. SessionUser = { id, name, email, avatar_initials, plan, role }.
 *
 * Bọc ở `app/layout.tsx` với <AuthProvider>. Components dùng `useAuth()`
 * hoặc compat wrapper `useUserSession()` (giữ API cũ).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, firebaseReady } from './firebase';

export type UserRole = 'guest' | 'user' | 'admin';

export type SessionUser = {
  id: string;
  name: string; // display name
  fullName?: string;
  email: string;
  phone?: string;
  avatar_initials: string;
  plan: 'Free' | 'Pro' | 'Team' | 'Admin';
  role: UserRole;
};

type AuthMode = 'mock' | 'firebase';

type AuthContextValue = {
  mode: AuthMode;
  user: SessionUser | null;
  role: UserRole;
  setRole: (r: UserRole) => void; // mock only
  isAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => Promise<void>;
};

const MOCK_STORAGE = 'trishteam:session_role';

const MOCK_USERS: Record<Exclude<UserRole, 'guest'>, SessionUser> = {
  user: {
    id: 'usr_demo_01',
    name: 'Trí Hồ Sỹ',
    email: 'hosytri77@gmail.com',
    avatar_initials: 'TH',
    plan: 'Pro',
    role: 'user',
  },
  admin: {
    id: 'adm_owner_01',
    name: 'TrishTEAM Admin',
    email: 'trishteam.official@gmail.com',
    avatar_initials: 'TT',
    plan: 'Admin',
    role: 'admin',
  },
};

function initials(s: string): string {
  const parts = s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2);
  return parts
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const forceMock =
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_AUTH_MOCK === '1';
  const mode: AuthMode = firebaseReady && !forceMock ? 'firebase' : 'mock';

  // ---- Mock mode state ----
  const [mockRole, setMockRole] = useState<UserRole>('guest');

  // ---- Firebase mode state ----
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(mode === 'firebase');

  // Hydrate mock role from localStorage on mount
  useEffect(() => {
    if (mode !== 'mock') return;
    try {
      const raw = window.localStorage.getItem(MOCK_STORAGE);
      if (raw === 'user' || raw === 'admin' || raw === 'guest') {
        setMockRole(raw);
      }
    } catch {
      /* ignore */
    }
  }, [mode]);

  // Listen to Firebase auth state
  useEffect(() => {
    if (mode !== 'firebase' || !auth) return;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Fetch/create Firestore profile
      try {
        if (!db) throw new Error('no db');
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        let data: Partial<SessionUser> & { role?: UserRole } = {};
        if (snap.exists()) {
          data = snap.data() as Partial<SessionUser>;
        } else {
          // Create minimal profile if missing (e.g. OAuth signup)
          data = {
            id: u.uid,
            name: u.displayName ?? u.email?.split('@')[0] ?? 'User',
            email: u.email ?? '',
            role: 'user',
            plan: 'Free',
          };
          await setDoc(ref, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        const displayName =
          data.name ?? u.displayName ?? u.email?.split('@')[0] ?? 'User';
        setProfile({
          id: u.uid,
          name: displayName,
          fullName: data.fullName,
          email: u.email ?? data.email ?? '',
          phone: data.phone,
          avatar_initials: initials(displayName),
          plan: data.plan ?? 'Free',
          role: (data.role as UserRole) ?? 'user',
        });
      } catch (err) {
        console.error('[AuthProvider] load profile fail', err);
        setProfile({
          id: u.uid,
          name: u.displayName ?? 'User',
          email: u.email ?? '',
          avatar_initials: initials(u.displayName ?? u.email ?? 'U'),
          plan: 'Free',
          role: 'user',
        });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [mode]);

  const setRole = useCallback(
    (r: UserRole) => {
      if (mode !== 'mock') {
        console.warn('[Auth] setRole chỉ dùng được ở mock mode');
        return;
      }
      setMockRole(r);
      try {
        window.localStorage.setItem(MOCK_STORAGE, r);
      } catch {
        /* ignore */
      }
    },
    [mode],
  );

  const logout = useCallback(async () => {
    if (mode === 'mock') {
      setMockRole('guest');
      try {
        window.localStorage.setItem(MOCK_STORAGE, 'guest');
      } catch {
        /* ignore */
      }
      return;
    }
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.error('[Auth] signOut fail', err);
      }
    }
  }, [mode]);

  const value = useMemo<AuthContextValue>(() => {
    if (mode === 'mock') {
      const u = mockRole === 'guest' ? null : MOCK_USERS[mockRole];
      return {
        mode,
        user: u,
        role: mockRole,
        setRole,
        isAdmin: mockRole === 'admin',
        isAuthenticated: mockRole !== 'guest',
        loading: false,
        logout,
      };
    }
    // firebase mode
    const role: UserRole = profile?.role ?? (fbUser ? 'user' : 'guest');
    return {
      mode,
      user: profile,
      role,
      setRole,
      isAdmin: role === 'admin',
      isAuthenticated: Boolean(fbUser),
      loading,
      logout,
    };
  }, [mode, mockRole, fbUser, profile, loading, setRole, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Graceful fallback if provider missing (e.g. legacy component tree).
    return {
      mode: 'mock',
      user: null,
      role: 'guest',
      setRole: () => {},
      isAdmin: false,
      isAuthenticated: false,
      loading: false,
      logout: async () => {},
    };
  }
  return v;
}
