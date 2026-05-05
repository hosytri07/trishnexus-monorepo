/**
 * @trishteam/auth/react — React hooks + Provider.
 *
 * Phase 16.1.b. Wrap app với <AuthProvider> ở root rồi gọi useAuth() ở
 * component bất kỳ.
 *
 *   import { AuthProvider, useAuth } from '@trishteam/auth/react';
 *
 *   <AuthProvider><App /></AuthProvider>
 *
 *   function MyComp() {
 *     const { profile, loading, role, isPaid, signOut } = useAuth();
 *     ...
 *   }
 */

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { hasRoleAtLeast, type TrishUser, type UserRole } from '@trishteam/data';
import {
  type AuthState,
  INITIAL_AUTH_STATE,
  subscribeAuthState,
} from './auth-state.js';
import { signOut as firebaseSignOut } from './sign-in.js';
import { loadProfile } from './profile.js';

// Phase 37.1 — re-export KeyActivationModal qua /react entry
export {
  KeyActivationModal,
  type KeyActivationModalProps,
} from './key-activation-modal.js';

// Phase 37.3 — Hook + helpers cho key session lifecycle
export {
  useKeySession,
  quickActivate,
  type KeySessionState,
  type UseKeySessionOptions,
} from './use-key-session.js';

// Phase 37.3 — KeyGate generic shared
export { KeyGate, type KeyGateProps } from './key-gate.js';

export interface AuthContextValue extends AuthState {
  /** Quick role check */
  role: UserRole | 'guest';
  isGuest: boolean;
  isTrial: boolean;
  isPaid: boolean; // role === 'user' || 'admin'
  isAdmin: boolean;
  /** Refresh profile từ Firestore (sau khi activate key) */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH_STATE);

  useEffect(() => {
    const unsub = subscribeAuthState(setState);
    return () => unsub();
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!state.firebaseUser) return;
    try {
      const fresh = await loadProfile(state.firebaseUser.uid);
      setState((prev) =>
        prev.firebaseUser?.uid === state.firebaseUser?.uid
          ? { ...prev, profile: fresh, profileError: null }
          : prev,
      );
    } catch (err) {
      setState((prev) => ({
        ...prev,
        profileError: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [state.firebaseUser]);

  const signOut = useCallback(async (): Promise<void> => {
    await firebaseSignOut();
  }, []);

  const profile: TrishUser | null = state.profile;
  const role: UserRole | 'guest' = profile?.role ?? 'guest';
  const isGuest = role === 'guest';
  const isTrial = role === 'trial';
  const isAdmin = role === 'admin';
  const isPaid = profile != null && hasRoleAtLeast(profile.role, 'user');

  const value: AuthContextValue = {
    ...state,
    role,
    isGuest,
    isTrial,
    isPaid,
    isAdmin,
    refreshProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() phải dùng trong <AuthProvider>');
  }
  return ctx;
}
