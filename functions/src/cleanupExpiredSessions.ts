/**
 * Phase 36.4 — cleanupExpiredSessions (Functions v1, scheduled).
 *
 * Quét toàn bộ active sessions trong /keys/{kid}/sessions, xóa session có
 * expires_at < now. Chạy mỗi 10 phút qua Cloud Scheduler (Spark plan có 3
 * scheduled jobs free).
 *
 * Cũng auto-mark key.status = "expired" nếu key.expires_at < now (để app
 * detect và force user gia hạn).
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";

export const cleanupExpiredSessions = functions
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async () => {
    const db = admin.firestore();
    const now = Date.now();

    // 1. Cleanup expired sessions (collectionGroup query)
    const expiredSnap = await db
      .collectionGroup("sessions")
      .where("expires_at", "<", now)
      .limit(500) // batch limit
      .get();

    let deletedCount = 0;
    if (!expiredSnap.empty) {
      const batch = db.batch();
      for (const doc of expiredSnap.docs) {
        batch.delete(doc.ref);
        // Audit log per session expired (best-effort)
        const data = doc.data();
        const auditRef = db.collection("audit_logs").doc();
        batch.set(auditRef, {
          id: auditRef.id,
          type: "session_expired",
          key_id: data.key_id,
          uid: data.uid,
          machine_id: data.machine_id,
          ip: data.ip_address,
          app_id: data.app_id,
          details: {
            reason: "heartbeat_timeout",
            session_id: doc.id,
            last_heartbeat: data.last_heartbeat,
          },
          timestamp: now,
        });
        deletedCount += 1;
      }
      await batch.commit();
      functions.logger.info(`Cleaned ${deletedCount} expired sessions`);
    }

    // 2. Mark keys với expires_at < now thành "expired" status (nếu chưa)
    const expiredKeysSnap = await db
      .collection("keys")
      .where("status", "==", "used")
      .where("expires_at", ">", 0)
      .where("expires_at", "<", now)
      .limit(100)
      .get();

    if (!expiredKeysSnap.empty) {
      const batch = db.batch();
      let expiredKeyCount = 0;
      for (const doc of expiredKeysSnap.docs) {
        batch.update(doc.ref, { status: "expired" });
        const auditRef = db.collection("audit_logs").doc();
        batch.set(auditRef, {
          id: auditRef.id,
          type: "key_expired",
          key_id: doc.id,
          uid: doc.data().bound_uid,
          machine_id: doc.data().bound_machine_id,
          app_id: doc.data().app_id,
          timestamp: now,
        });
        expiredKeyCount += 1;
      }
      await batch.commit();
      functions.logger.info(`Marked ${expiredKeyCount} keys as expired`);
    }

    return null;
  });
