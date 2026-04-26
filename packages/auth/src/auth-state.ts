/**
 * @trishteam/auth — Plain auth state subscription (không React).
 *
 * Phase 16.1.b. Dùng được ở mọi env (Tauri, Zalo, Node script).
 * React variant tham khảo `react.tsx` → `useAuth()`.
 */

import {
  type User as FirebaseUser,
  onAuthStateChanged,
  type Unsubscribe,
} from 'firebase/auth';
import { type TrishUser } from '@trishteam/data';
import { getFirebaseAuth } from './firebase-app.js';
import { loadProfile } from './profile.js';
import { ensureUserDoc } from './sign-in.js';

export interface AuthState {
  /** Đang load auth state lần đầu (chưa biết user logged hay chưa) */
  loading: boolean;
  /** Firebase Auth user (null = chưa login) */
  firebaseUser: FirebaseUser | null;
  /** TrishUser doc từ Firestore (null = chưa login HOẶC chưa có doc) */
  profile: TrishUser | null;
  /** Lỗi load profile (khác auth error) */
  profileError: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
  loading: true,
  firebaseUser: null,
  profile: null,
  profileError: null,
};

/**
 * Subscribe auth state changes. Tự động load profile từ Firestore khi user
 * login. Trả unsubscribe.
 *
 * Dùng cho Tauri/Node script:
 *   const unsub = subscribeAuthState((state) => { ... });
 *   // sau:
 *   unsub();
 */
export function subscribeAuthState(
  callback: (state: AuthState) => void,
): Unsubscribe {
  let lastFirebaseUser: FirebaseUser | null = null;
  // Track concurrent loads để tránh stale set
  let loadGen = 0;

  return onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
    lastFirebaseUser = fbUser;
    if (!fbUser) {
      callback({
        loading: false,
        firebaseUser: null,
        profile: null,
        profileError: null,
      });
      return;
    }
    callback({
      loading: true,
      firebaseUser: fbUser,
      profile: null,
      profileError: null,
    });
    const myGen = ++loadGen;
    let profile: TrishUser | null = null;
    let healError: string | null = null;
    try {
      profile = await loadProfile(fbUser.uid);
    } catch (err) {
      healError = err instanceof Error ? err.message : String(err);
      console.warn('[trishteam-auth] loadProfile fail', err);
    }

    // Self-heal: nếu doc chưa tồn tại, tạo với role='trial'.
    if (!profile) {
      const provider =
        fbUser.providerData[0]?.providerId === 'google.com'
          ? 'google.com'
          : 'password';
      try {
        await ensureUserDoc(fbUser, provider);
        profile = await loadProfile(fbUser.uid);
      } catch (healErr) {
        healError = healErr instanceof Error ? healErr.message : String(healErr);
        console.warn('[trishteam-auth] self-heal user doc fail', healErr);
      }
    }

    // Fallback: nếu vẫn không load được profile (rules deny / network),
    // synthetic minimal trial profile để app KHÔNG bị treo. User vẫn vào
    // được TrialBlockedScreen + thấy nút Đăng xuất.
    if (!profile) {
      profile = {
        id: fbUser.uid,
        email: fbUser.email ?? '',
        display_name:
          fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'User',
        role: 'trial',
        photo_url: fbUser.photoURL ?? undefined,
        provider:
          fbUser.providerData[0]?.providerId === 'google.com'
            ? 'google.com'
            : 'password',
        key_activated_at: 0,
        created_at: Date.now(),
      };
    }

    if (myGen !== loadGen || lastFirebaseUser?.uid !== fbUser.uid) return;
    callback({
      loading: false,
      firebaseUser: fbUser,
      profile,
      profileError: healError,
    });
  });
}
