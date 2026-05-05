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

// Phase 36.6 — Key session client
export {
  registerSession,
  heartbeatSession,
  endSession as endKeySession,
  startHeartbeatLoop,
  listenSessionKick,
  activateAndStartSession,
  getPublicIp,
  type RegisterSessionParams,
  type RegisterSessionResult,
  type SessionApiError,
  type SessionHandle,
} from './key-session.js';

// Re-export role helpers + types từ @trishteam/data cho convenience
export {
  type UserRole,
  type TrishUser,
  type ActivationKey,
  // Phase 36.1 — types mới
  type AppId,
  type AppKeyBinding,
  type KeySession,
  type DeviceActivation,
  type AuditLog,
  type AuditLogType,
  ROLE_HIERARCHY,
  hasRoleAtLeast,
  // Phase 36.1 — defaults + helpers
  KEY_DEFAULT_EXPIRY_DAYS,
  KEY_DEFAULT_MAX_CONCURRENT,
  SESSION_HEARTBEAT_INTERVAL_MS,
  SESSION_EXPIRY_AFTER_LAST_HEARTBEAT_MS,
  KICK_GRACE_PERIOD_MS,
  defaultKeyExpiresAt,
  normalizeActivationKey,
  isKeyValid,
  userHasAppAccess,
} from '@trishteam/data';
