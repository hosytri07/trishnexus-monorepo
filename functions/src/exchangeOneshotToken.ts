/**
 * exchangeOneshotToken — REDEEM a oneshot token.
 *
 * Caller KHÔNG cần đăng nhập (unauthenticated) — chính là mục đích của
 * oneshot: prove possession → get Firebase custom token → signInWithCustomToken.
 *
 * Flow:
 *   1. Read oneshot_tokens/{id}
 *   2. Validate: chưa used, chưa expired.
 *   3. Atomic mark used = true (runTransaction để replay-safe).
 *   4. admin.auth().createCustomToken(uid, { ssoOneshot: true })
 *   5. Trả về { customToken, uid } — caller dùng signInWithCustomToken.
 *
 * Input:  { oneshot: string, platform: "web" | "desktop" }
 * Output: { customToken: string, uid: string }
 *
 * Security notes:
 *   - Transaction đảm bảo 2 caller race-condition chỉ 1 win.
 *   - Custom token TTL do Firebase mặc định (1h) — nhưng client đổi ngay
 *     thành idToken qua signInWithCustomToken nên không vấn đề.
 *   - Log IP (req.rawRequest.ip) vào audit — forensic nếu abuse.
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { badArg, notFound, preconditionFailed, withInternalGuard } from "./lib/errors";
import { validateOneshotRecord } from "./lib/authUtil";

const REGION = "asia-southeast1";

export const exchangeOneshotToken = onCall(
  {
    cors: true,
    region: REGION,
    maxInstances: 5,
    // Rate-limit để chống brute-force oneshot ID: mỗi IP tối đa N request/phút.
    // Firebase Functions V2 không có built-in rate limit — cần App Check
    // hoặc middleware ngoài. TODO khi production deploy.
  },
  async (req) => {
    return withInternalGuard("exchangeOneshotToken", async () => {
      const data = req.data as { oneshot?: unknown; platform?: unknown } | undefined;
      const oneshotId = data?.oneshot;
      const platform = data?.platform;

      if (typeof oneshotId !== "string" || oneshotId.length < 16 || oneshotId.length > 128) {
        badArg("oneshot", "thiếu hoặc sai format");
      }
      if (platform !== "web" && platform !== "desktop") {
        badArg("platform", "phải là 'web' hoặc 'desktop'");
      }

      const db = admin.firestore();
      const docRef = db.collection("oneshot_tokens").doc(oneshotId);

      // Transaction: đọc + validate + mark used atomically.
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists) {
          notFound("oneshot token");
        }
        const validation = validateOneshotRecord(snap.data(), Date.now());
        if (!validation.ok) {
          if (validation.reason === "already_used") {
            preconditionFailed("Oneshot token đã được sử dụng.");
          } else if (validation.reason === "expired") {
            preconditionFailed("Oneshot token đã hết hạn.");
          } else {
            preconditionFailed("Oneshot token không hợp lệ.");
          }
        }

        const rec = validation.record;
        // Verify platform match — oneshot tạo cho desktop thì chỉ desktop redeem.
        if (rec.targetPlatform !== platform) {
          preconditionFailed(
            `Oneshot token chỉ dùng được cho ${rec.targetPlatform}, không phải ${platform}.`,
          );
        }

        tx.update(docRef, {
          used: true,
          usedAtMs: Date.now(),
          redeemedPlatform: platform,
          redeemedAt: FieldValue.serverTimestamp(),
        });

        return { uid: rec.uid };
      });

      // Mint custom token ngoài transaction (Auth API không hỗ trợ tx).
      const customToken = await admin.auth().createCustomToken(result.uid, {
        ssoOneshot: true,
      });

      await admin.firestore().collection("auth_events").add({
        uid: result.uid,
        event: "oneshot_redeem",
        platform,
        oneshot_id_prefix: oneshotId.slice(0, 8),
        // req.rawRequest có thể undefined trong test env — optional chain.
        ip: req.rawRequest?.ip ?? null,
        timestamp: FieldValue.serverTimestamp(),
      });

      logger.info("exchangeOneshotToken_ok", { uid: result.uid, platform });
      return { customToken, uid: result.uid };
    });
  },
);
