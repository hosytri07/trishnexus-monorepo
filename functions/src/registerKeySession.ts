/**
 * Phase 36.3 — registerKeySession (onCall).
 *
 * Đăng ký 1 active session khi user/device login app + nhập key. Atomic:
 *  1. Validate key (active, not expired, app_id match, type match).
 *  2. Count active sessions của key này.
 *  3. Nếu count < max_concurrent → tạo session mới.
 *  4. Nếu count >= max_concurrent:
 *     - Nếu có session cùng machine_id → update last_heartbeat (re-login cùng máy).
 *     - Nếu khác machine_id → kick session cũ nhất (oldest started_at) + tạo session mới.
 *
 * Input:
 *   {
 *     key_code: string;       // "XXXX-XXXX-XXXX-XXXX" hoặc 16 chars no dash
 *     app_id: AppId;
 *     machine_id: string;     // 16 hex chars, hash từ Rust
 *     ip_address: string;
 *     hostname?: string;
 *     os?: string;
 *     user_agent?: string;
 *   }
 *
 * Output:
 *   {
 *     ok: true,
 *     session_id: string,
 *     key_id: string,
 *     expires_at: number,
 *     kicked_session_id?: string,  // nếu đã kick session cũ
 *   }
 *
 * Errors:
 *   - 'key/not-found'
 *   - 'key/revoked'
 *   - 'key/expired'
 *   - 'key/wrong-app'
 *   - 'key/wrong-type'
 *   - 'key/wrong-binding' — đã bind user/machine khác
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

const REGION = 'asia-southeast1';
const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 phút sau heartbeat cuối

interface RegisterSessionInput {
  key_code: string;
  app_id: string;
  machine_id: string;
  ip_address: string;
  hostname?: string;
  os?: string;
  user_agent?: string;
}

/** Normalize "XXXX-XXXX-XXXX-XXXX" → "XXXXXXXXXXXXXXXX" (16 chars upper) */
function normalizeKeyCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const registerKeySession = onCall(
  {
    cors: true,
    region: REGION,
    timeoutSeconds: 30,
  },
  async (req) => {
    const auth = req.auth;
    const data = req.data as RegisterSessionInput;

    // Validate input
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'Missing payload');
    }
    const keyCodeRaw = data.key_code;
    const appId = data.app_id;
    const machineId = data.machine_id;
    const ipAddress = data.ip_address || 'unknown';

    if (!keyCodeRaw || typeof keyCodeRaw !== 'string') {
      throw new HttpsError('invalid-argument', 'key_code required');
    }
    if (!appId || typeof appId !== 'string') {
      throw new HttpsError('invalid-argument', 'app_id required');
    }
    if (!machineId || typeof machineId !== 'string' || machineId.length < 8) {
      throw new HttpsError('invalid-argument', 'machine_id required (>= 8 chars)');
    }

    const keyCode = normalizeKeyCode(keyCodeRaw);
    if (keyCode.length !== 16) {
      throw new HttpsError('invalid-argument', 'key_code must be 16 alphanumeric chars');
    }

    const db = admin.firestore();
    const now = Date.now();

    // 1. Find key by code
    const keysSnap = await db
      .collection('keys')
      .where('code', '==', keyCode)
      .limit(1)
      .get();

    if (keysSnap.empty) {
      throw new HttpsError('not-found', 'key/not-found');
    }
    const keyDoc = keysSnap.docs[0]!;
    const key = keyDoc.data();
    const keyId = keyDoc.id;

    // 2. Validate key
    if (key.status === 'revoked') {
      throw new HttpsError('permission-denied', 'key/revoked');
    }
    if (key.expires_at && key.expires_at > 0 && now >= key.expires_at) {
      throw new HttpsError('permission-denied', 'key/expired');
    }

    // Backward-compat: keys cũ không có app_id → coi như 'all'
    const keyAppId = key.app_id ?? 'all';
    if (keyAppId !== 'all' && keyAppId !== appId) {
      throw new HttpsError('permission-denied', 'key/wrong-app');
    }

    // Backward-compat: keys cũ không có type → 'account'
    const keyType = key.type ?? 'account';

    // 3. Validate binding
    if (keyType === 'account') {
      if (!auth) {
        throw new HttpsError('unauthenticated', 'Account key requires login');
      }
      // Check binding
      if (key.bound_uid && key.bound_uid !== auth.uid) {
        throw new HttpsError('permission-denied', 'key/wrong-binding');
      }
    } else if (keyType === 'standalone') {
      if (key.bound_machine_id && key.bound_machine_id !== machineId) {
        throw new HttpsError('permission-denied', 'key/wrong-binding');
      }
    } else {
      throw new HttpsError('invalid-argument', 'key/unknown-type');
    }

    const maxConcurrent = key.max_concurrent ?? 1;

    // 4. Atomic transaction: bind key (nếu chưa) + count sessions + create/kick
    const sessionId = randomUUID();
    let kickedSessionId: string | undefined;

    await db.runTransaction(async (tx) => {
      // Re-read key inside transaction
      const keyRef = keyDoc.ref;
      const keyTx = await tx.get(keyRef);
      if (!keyTx.exists) {
        throw new HttpsError('not-found', 'key/not-found');
      }
      const keyData = keyTx.data()!;

      // Bind key on first activate
      const updates: Record<string, unknown> = {};
      if (keyData.status === 'active') {
        updates.status = 'used';
        updates.activated_at = now;
      }
      if (keyType === 'account' && !keyData.bound_uid) {
        updates.bound_uid = auth!.uid;
        updates.used_by_uid = auth!.uid;
        updates.used_at = now;
      }
      if (keyType === 'standalone' && !keyData.bound_machine_id) {
        updates.bound_machine_id = machineId;
        updates.used_at = now;
      }
      if (Object.keys(updates).length > 0) {
        tx.update(keyRef, updates);
      }

      // Count active sessions
      const sessionsRef = keyRef.collection('sessions');
      const activeSessionsSnap = await tx.get(
        sessionsRef.where('expires_at', '>', now),
      );

      const activeSessions = activeSessionsSnap.docs;
      const sameMachine = activeSessions.find(
        (d) => d.data().machine_id === machineId,
      );

      if (sameMachine) {
        // Re-login cùng máy → update heartbeat
        tx.update(sameMachine.ref, {
          last_heartbeat: now,
          expires_at: now + SESSION_EXPIRY_MS,
          ip_address: ipAddress,
        });
        // Trả session_id của session cũ (KHÔNG tạo mới)
        return;
      }

      // Khác máy
      if (activeSessions.length >= maxConcurrent) {
        // Kick session cũ nhất
        const oldest = activeSessions.sort(
          (a, b) => (a.data().started_at ?? 0) - (b.data().started_at ?? 0),
        )[0]!;
        tx.delete(oldest.ref);
        kickedSessionId = oldest.id;

        // Audit log
        const auditRef = db.collection('audit_logs').doc();
        tx.set(auditRef, {
          id: auditRef.id,
          type: 'session_kicked',
          key_id: keyId,
          uid: oldest.data().uid,
          machine_id: oldest.data().machine_id,
          ip: oldest.data().ip_address,
          app_id: oldest.data().app_id,
          actor_uid: keyType === 'account' ? auth!.uid : undefined,
          details: {
            reason: 'new_login_other_machine',
            kicked_session_id: oldest.id,
            new_machine_id: machineId,
          },
          timestamp: now,
        });
      }

      // Tạo session mới
      const newSessionRef = sessionsRef.doc(sessionId);
      tx.set(newSessionRef, {
        session_id: sessionId,
        key_id: keyId,
        app_id: appId,
        machine_id: machineId,
        ip_address: ipAddress,
        uid: keyType === 'account' ? auth!.uid : null,
        user_agent: data.user_agent ?? null,
        os: data.os ?? null,
        hostname: data.hostname ?? null,
        started_at: now,
        last_heartbeat: now,
        expires_at: now + SESSION_EXPIRY_MS,
      });

      // Audit log session_start
      const auditRef = db.collection('audit_logs').doc();
      tx.set(auditRef, {
        id: auditRef.id,
        type: 'session_start',
        key_id: keyId,
        uid: keyType === 'account' ? auth!.uid : undefined,
        machine_id: machineId,
        ip: ipAddress,
        app_id: appId,
        details: { session_id: sessionId },
        timestamp: now,
      });

      // Phase 36.1 — update user.app_keys nếu account key
      if (keyType === 'account' && auth) {
        const userRef = db.collection('users').doc(auth.uid);
        tx.set(
          userRef,
          {
            app_keys: {
              [appId]: {
                key_id: keyId,
                activated_at: keyData.activated_at ?? now,
                expires_at: keyData.expires_at ?? 0,
              },
            },
          },
          { merge: true },
        );
      }

      // Standalone key → /device_activations/{compositeId}
      if (keyType === 'standalone') {
        const compositeId = `${machineId}_${appId}`;
        const deviceRef = db.collection('device_activations').doc(compositeId);
        tx.set(deviceRef, {
          composite_id: compositeId,
          machine_id: machineId,
          app_id: appId,
          key_id: keyId,
          activated_at: keyData.activated_at ?? now,
          expires_at: keyData.expires_at ?? 0,
          hostname: data.hostname ?? null,
          os: data.os ?? null,
          ip_first_seen: ipAddress,
        });
      }
    });

    logger.info('Key session registered', {
      keyId,
      sessionId,
      appId,
      machineId,
      uid: auth?.uid,
      kickedSessionId,
    });

    return {
      ok: true,
      session_id: sessionId,
      key_id: keyId,
      expires_at: now + SESSION_EXPIRY_MS,
      kicked_session_id: kickedSessionId,
    };
  },
);

/**
 * heartbeatKeySession — onCall.
 * Update last_heartbeat của 1 session đang active.
 */
export const heartbeatKeySession = onCall(
  {
    cors: true,
    region: REGION,
    timeoutSeconds: 10,
  },
  async (req) => {
    const data = req.data as { key_id: string; session_id: string };
    if (!data?.key_id || !data?.session_id) {
      throw new HttpsError('invalid-argument', 'key_id + session_id required');
    }

    const db = admin.firestore();
    const now = Date.now();
    const sessionRef = db
      .collection('keys')
      .doc(data.key_id)
      .collection('sessions')
      .doc(data.session_id);

    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      // Session bị kick → app cần logout
      return { ok: false, reason: 'session_not_found' };
    }

    await sessionRef.update({
      last_heartbeat: now,
      expires_at: now + SESSION_EXPIRY_MS,
    });

    return { ok: true, expires_at: now + SESSION_EXPIRY_MS };
  },
);

/**
 * endKeySession — onCall.
 * Logout chủ động: xóa session.
 */
export const endKeySession = onCall(
  {
    cors: true,
    region: REGION,
    timeoutSeconds: 10,
  },
  async (req) => {
    const data = req.data as { key_id: string; session_id: string };
    if (!data?.key_id || !data?.session_id) {
      throw new HttpsError('invalid-argument', 'key_id + session_id required');
    }

    const db = admin.firestore();
    const sessionRef = db
      .collection('keys')
      .doc(data.key_id)
      .collection('sessions')
      .doc(data.session_id);

    const sessionSnap = await sessionRef.get();
    if (sessionSnap.exists) {
      const sessionData = sessionSnap.data()!;
      await sessionRef.delete();

      // Audit
      await db.collection('audit_logs').add({
        type: 'session_expired',
        key_id: data.key_id,
        uid: sessionData.uid,
        machine_id: sessionData.machine_id,
        ip: sessionData.ip_address,
        app_id: sessionData.app_id,
        details: { reason: 'user_logout', session_id: data.session_id },
        timestamp: Date.now(),
      });
    }

    return { ok: true };
  },
);
