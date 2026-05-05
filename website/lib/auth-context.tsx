'use client';

/**
 * AuthProvider — Phase 16.1.f.
 *
 * Firebase-only. Mock mode đã bị remove.
 *
 *   1. onAuthStateChanged() listener cập nhật firebaseUser
 *   2. Fetch Firestore /users/{uid} để lấy profile mở rộng (fullName,
 *      phone, role...) — nếu doc chưa có thì tự tạo với role='trial'.
 *   3. SessionUser = { id, name, email, avatar_initials, plan, role }.
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

export type UserRole = 'guest' | 'trial' | 'user' | 'admin';

export type SessionUser = {
  id: string;
  name: string; // display name
  fullName?: string;
  email: string;
  phone?: string;
  photo_url?: string;
  avatar_initials: string;
  plan: 'Free' | 'Pro' | 'Team' | 'Admin' | 'Trial';
  role: UserRole;
  /** Phase 16.1.c — timestamp ms khi kích hoạt key (Trial → User). 0 = chưa */
  key_activated_at?: number;
  /** Mã key đã activate */
  activated_key_id?: string;
  /** Phase 19.12 — Cloudinary public_id của avatar */
  cloudinary_avatar_id?: string;
  /** Phase 36.1 — Per-app key activation map */
  app_keys?: Record<string, { key_id: string; activated_at: number; expires_at: number } | undefined>;
};

type AuthContextValue = {
  /** @deprecated Always 'firebase' — giữ để không break code cũ */
  mode: 'firebase';
  user: SessionUser | null;
  role: UserRole;
  /** @deprecated Mock role switcher đã bị remove — no-op */
  setRole: (r: UserRole) => void;
  isAdmin: boolean;
  isAuthenticated: boolean;
  /** Phase 16.1.c — true nếu role >= 'user' (đã kích hoạt key hoặc admin) */
  isPaid: boolean;
  /** Trial chưa activate key */
  isTrial: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  /** Refresh profile sau khi activate key */
  refreshProfile: () => Promise<void>;
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
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(firebaseReady);

  /** Helper: load profile từ Firestore (re-use cho refreshProfile) */
  const loadProfileFromFirestore = useCallback(
    async (u: FirebaseUser): Promise<SessionUser> => {
      if (!db) throw new Error('no db');
      const ref = doc(db, 'users', u.uid);
      const snap = await getDoc(ref);
      let data: Record<string, unknown> = {};
      if (snap.exists()) {
        data = snap.data() as Record<string, unknown>;
      } else {
        // Phase 16.1.c — Default role 'trial' (thay vì 'user').
        // User phải nhập key để upgrade thành 'user'.
        const now = Date.now();
        const newDoc = {
          id: u.uid,
          email: u.email ?? '',
          display_name: u.displayName ?? u.email?.split('@')[0] ?? 'User',
          role: 'trial' as UserRole,
          photo_url: u.photoURL ?? null,
          provider: u.providerData[0]?.providerId ?? 'password',
          key_activated_at: 0,
          created_at: now,
          last_login_at: now,
        };
        await setDoc(ref, {
          ...newDoc,
          _server_created_at: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        data = newDoc;
      }
      const role = (data.role as UserRole) ?? 'trial';
      const displayName =
        (data.display_name as string) ??
        (data.name as string) ??
        u.displayName ??
        u.email?.split('@')[0] ??
        'User';
      let plan: SessionUser['plan'] = 'Trial';
      if (role === 'admin') plan = 'Admin';
      else if (role === 'user') plan = 'Pro';
      else if (role === 'trial') plan = 'Trial';
      return {
        id: u.uid,
        name: displayName,
        fullName: (data.fullName as string) ?? undefined,
        email: u.email ?? (data.email as string) ?? '',
        phone: (data.phone as string) ?? undefined,
        photo_url:
          (data.photo_url as string) ?? u.photoURL ?? undefined,
        avatar_initials: initials(displayName),
        plan,
        role,
        key_activated_at: (data.key_activated_at as number) ?? 0,
        activated_key_id:
          (data.activated_key_id as string) ?? undefined,
        cloudinary_avatar_id:
          (data.cloudinary_avatar_id as string) ?? undefined,
        // Phase 36.1 — per-app key activation map
        app_keys: (data.app_keys as SessionUser['app_keys']) ?? undefined,
      };
    },
    [],
  );

  // Listen to Firebase auth state
  useEffect(() => {
    if (!firebaseReady || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const sessionUser = await loadProfileFromFirestore(u);
        setProfile(sessionUser);
      } catch (err) {
        console.error('[AuthProvider] load profile fail', err);
        setProfile({
          id: u.uid,
          name: u.displayName ?? 'User',
          email: u.email ?? '',
          avatar_initials: initials(u.displayName ?? u.email ?? 'U'),
          plan: 'Trial',
          role: 'trial',
          key_activated_at: 0,
        });
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [loadProfileFromFirestore]);

  const refreshProfile = useCallback(async () => {
    if (!fbUser) return;
    try {
      const sessionUser = await loadProfileFromFirestore(fbUser);
      setProfile(sessionUser);
    } catch (err) {
      console.error('[AuthProvider] refresh profile fail', err);
    }
  }, [fbUser, loadProfileFromFirestore]);

  // No-op stub — giữ API cho code cũ destructure {setRole}
  const setRole = useCallback((_r: UserRole) => {
    // Mock role switcher đã bị remove — chỉ Firebase quản lý role.
  }, []);

  const logout = useCallback(async () => {
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.error('[Auth] signOut fail', err);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role: UserRole = profile?.role ?? (fbUser ? 'trial' : 'guest');
    // Phase 16.1.d — Khi fbUser logged in nhưng profile đang load, return
    // minimal user để UI không crash với `user!.X`. Khi profile load xong
    // sẽ tự re-render với data đầy đủ.
    let userVal: SessionUser | null = profile;
    if (!profile && fbUser) {
      const fallbackName =
        fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User';
      userVal = {
        id: fbUser.uid,
        name: fallbackName,
        email: fbUser.email ?? '',
        photo_url: fbUser.photoURL ?? undefined,
        avatar_initials: initials(fallbackName),
        plan: 'Trial',
        role: 'trial',
        key_activated_at: 0,
      };
    }
    return {
      mode: 'firebase',
      user: userVal,
      role,
      setRole,
      isAdmin: role === 'admin',
      isAuthenticated: Boolean(fbUser),
      isPaid: role === 'user' || role === 'admin',
      isTrial: role === 'trial',
      loading,
      logout,
      refreshProfile,
    };
  }, [fbUser, profile, loading, setRole, logout, refreshProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // Graceful fallback if provider missing (e.g. legacy component tree).
    return {
      mode: 'firebase',
      user: null,
      role: 'guest',
      setRole: () => {},
      isAdmin: false,
      isAuthenticated: false,
      isPaid: false,
      isTrial: false,
      loading: false,
      logout: async () => {},
      refreshProfile: async () => {},
    };
  }
  return v;
}
