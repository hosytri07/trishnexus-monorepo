/**
 * setUserRole — onCall function.
 *
 * Chỉ caller có role "dev" (đã đăng ký manual Firebase console lần đầu)
 * mới assign được role cho user khác. Tránh tự phong admin qua CLI.
 *
 * Input:  { uid: string, role: "user"|"admin"|"dev" }
 * Output: { ok: true, uid, role }
 *
 * Side effects:
 *   - setCustomUserClaims(uid, { role })
 *   - users/{uid}.role merge-set
 *   - auth_events ghi audit log
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { requireAuth, badArg, denyPermission, withInternalGuard } from "./lib/errors";
import { isValidRole, isValidUid } from "./lib/authUtil";

// Region mặc định — asia-southeast1 (Singapore) gần Vietnam user best latency.
// Đổi qua config nếu cần test local.
const REGION = "asia-southeast1";

export const setUserRole = onCall(
  {
    cors: true,
    region: REGION,
    // Hạn chế chi phí — 1 instance đủ, function này gọi thưa.
    maxInstances: 2,
  },
  async (req) => {
    return withInternalGuard("setUserRole", async () => {
      requireAuth(req.auth);
      const callerUid = req.auth.uid;

      // 1. Caller phải là dev.
      const callerRecord = await admin.auth().getUser(callerUid);
      const callerRole = (callerRecord.customClaims ?? {}).role;
      if (callerRole !== "dev") {
        denyPermission(callerUid, `setUserRole requires dev, got ${callerRole ?? "none"}`);
      }

      // 2. Validate input.
      const data = req.data as { uid?: unknown; role?: unknown } | undefined;
      if (!data) {
        badArg("data", "body rỗng");
      }
      const targetUid = data.uid;
      const newRole = data.role;
      if (!isValidUid(targetUid)) {
        badArg("uid", "phải là chuỗi UID hợp lệ");
      }
      if (!isValidRole(newRole)) {
        badArg("role", "phải là 'user', 'admin', hoặc 'dev'");
      }

      // 3. Apply.
      await admin.auth().setCustomUserClaims(targetUid, { role: newRole });
      await admin
        .firestore()
        .collection("users")
        .doc(targetUid)
        .set({ role: newRole, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await admin.firestore().collection("auth_events").add({
        uid: targetUid,
        actor_uid: callerUid,
        event: "role_change",
        new_role: newRole,
        previous_role: callerRole === newRole ? callerRole : undefined,
        timestamp: FieldValue.serverTimestamp(),
      });

      logger.info("setUserRole_ok", { actor: callerUid, target: targetUid, role: newRole });
      return { ok: true, uid: targetUid, role: newRole };
    });
  },
);

// Re-export cho index.ts tránh naming collision khi test.
export { HttpsError };
