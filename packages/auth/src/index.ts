/**
 * @trishteam/auth — Public exports (no React).
 *
 * Phase 16.1.b — Firebase Auth wrapper cho TrishTEAM ecosystem.
 *
 * Use:
 *   import { signInWithEmail, signUpWithEmail, signOut, subscribeAuthState }
 *     from '@trishteam/auth';
 *
 *   import { AuthProvider, useAuth } from '@trishteam/auth/react';
 */

export {
  getFirebaseApp,
  getFirebaseAuth,
  getFirebaseDb,
  FIREBASE_PROJECT_ID,
} from './firebase-app.js';

export {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signInWithGoogleRedirect,
  handleGoogleRedirectResult,
  signOut,
  sendResetPassword,
  type SignUpInput,
} from './sign-in.js';

export {
  loadProfile,
  updateProfile,
  activateKey,
  type ActivateKeyResult,
} from './profile.js';

export {
  subscribeAuthState,
  INITIAL_AUTH_STATE,
  type AuthState,
} from './auth-state.js';

// Re-export role helpers + types từ @trishteam/data cho convenience
export {
  type UserRole,
  type TrishUser,
  type ActivationKey,
  ROLE_HIERARCHY,
  hasRoleAtLeast,
} from '@trishteam/data';
