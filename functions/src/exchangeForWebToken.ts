/**
 * exchangeForWebToken — MINT a oneshot token.
 *
 * Caller đã authenticated (desktop hoặc web), muốn handoff session sang
 * platform còn lại. Function tạo 1 doc `oneshot_tokens/{id}` với TTL 2 phút,
 * trả về oneshot ID + URL đầy đủ.
 *
 * Flow minh hoạ:
 *   Desktop đã login → gọi fn này → nhận {oneshot, url} →
 *     mở browser: https://trishteam.com/sso?oneshot=<id> →
 *     web redeem qua exchangeOneshotToken.
 *
 *   Web đã login → gọi fn này với target=desktop → nhận {oneshot} →
 *     redirect: trishteam://sso?oneshot=<id> →
 *     desktop handler redeem qua exchangeOneshotToken.
 *
 * Input:  { target: "web" | "desktop" }
 * Output: { oneshot: string, url: string, expiresAtMs: number }
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { requireAuth, badArg, withInternalGuard } from "./lib/errors";
import {
  generateOneshotId,
  expiryFromNow,
  ONESHOT_TTL_MS,
} from "./lib/authUtil";

const REGION = "asia-southeast1";

// URL scheme cho từng platform — khớp với Windows registry handler Phase 1.6.
const WEB_SSO_URL = "https://trishteam.com/sso";
const DESKTOP_SSO_URL = "trishteam://sso";

export const exchangeForWebToken = onCall(
  {
    cors: true,
    region: REGION,
    maxInstances: 3,
  },
  async (req) => {
    return withInternalGuard("exchangeForWebToken", async () => {
      requireAuth(req.auth);
      const callerUid = req.auth.uid;

      const data = req.data as { target?: unknown } | undefined;
      const target = data?.target;
      if (target !== "web" && target !== "desktop") {
        badArg("target", "phải là 'web' hoặc 'desktop'");
      }

      // Source = opposite of target (caller đang ở platform kia).
      const sourcePlatform: "web" | "desktop" = target === "web" ? "desktop" : "web";

      const oneshotId = generateOneshotId();
      const nowMs = Date.now();
      const expiresAtMs = expiryFromNow(nowMs, ONESHOT_TTL_MS);

      await admin.firestore().collection("oneshot_tokens").doc(oneshotId).set({
        uid: callerUid,
        createdAtMs: nowMs,
        expiresAtMs,
        used: false,
        targetPlatform: target,
        sourcePlatform,
        createdAt: FieldValue.serverTimestamp(),
      });

      await admin.firestore().collection("auth_events").add({
        uid: callerUid,
        event: "oneshot_mint",
        target_platform: target,
        source_platform: sourcePlatform,
        oneshot_id_prefix: oneshotId.slice(0, 8),
        timestamp: FieldValue.serverTimestamp(),
      });

      const baseUrl = target === "web" ? WEB_SSO_URL : DESKTOP_SSO_URL;
      const url = `${baseUrl}?oneshot=${encodeURIComponent(oneshotId)}`;

      logger.info("exchangeForWebToken_ok", {
        uid: callerUid,
        target,
        expiresIn: ONESHOT_TTL_MS,
      });

      return { oneshot: oneshotId, url, expiresAtMs };
    });
  },
);
