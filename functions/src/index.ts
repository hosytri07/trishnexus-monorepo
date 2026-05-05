/**
 * TrishTEAM Cloud Functions entry point.
 *
 * Firebase CLI deploy chỉ phát hiện functions qua re-export từ file này.
 * Init admin SDK 1 lần duy nhất ở top-level.
 */

import * as admin from "firebase-admin";

// Guard — tránh re-init khi functions:shell reload.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { setUserRole } from "./setUserRole";
export { exchangeForWebToken } from "./exchangeForWebToken";
export { exchangeOneshotToken } from "./exchangeOneshotToken";

// Phase 36.3-4 — Key/session management
export {
  registerKeySession,
  heartbeatKeySession,
  endKeySession,
} from "./registerKeySession";
export { cleanupExpiredSessions } from "./cleanupExpiredSessions";
