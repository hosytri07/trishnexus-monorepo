/**
 * Phase 36 — Keys + Sessions logic chung cho API routes Vercel.
 *
 * Atomic transaction validate key + count sessions + kick oldest + create.
 * Lazy cleanup: trước khi count active sessions, xóa session expired của key.
 *
 * Dùng Firebase Admin SDK (server-only). Mỗi route gọi `adminDb()` từ
 * lib/firebase-admin.
 */
import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from './firebase-admin';

export const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 phút sau heartbeat cuối

export interface RegisterSessionInput {
  keyCode: string;
  appId: string;
  machineId: string;
  ipAddress: string;
  hostname?: string;
  os?: string;
  userAgent?: string;
  /** UID nếu account key — verified từ ID token của caller */
  uid?: string;
}

export interface RegisterSessionResult {
  ok: true;
  sessionId: string;
  keyId: string;
  expiresAt: number;
  kickedSessionId?: string;
}

export type SessionError =
  | 'key/not-found'
  | 'key/revoked'
  | 'key/expired'
  | 'key/wrong-app'
  | 'key/wrong-binding'
  | 'key/unknown-type'
  | 'key/unauthenticated'
  | 'invalid-input';

export class SessionRegisterError extends Error {
  constructor(public code: SessionError, message?: string) {
    super(message ?? code);
  }
}

/** Normalize "XXXX-XXXX-XXXX-XXXX" → "XXXXXXXXXXXXXXXX" (16 chars upper) */
export function normalizeKeyCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Lazy cleanup: xóa expired sessions của 1 key (gọi trước count).
 * Chạy ngoài transaction để tránh contention. Best-effort.
 */
async function cleanupExpiredSessionsOfKey(keyId: string): Promise<number> {
  const db = adminDb();
  const now = Date.now();
  const expiredSnap = await db
    .collection('keys')
    .doc(keyId)
    .collection('sessions')
    .where('expires_at', '<', now)
    .limit(50)
    .get();

  if (expiredSnap.empty) return 0;

  const batch = db.batch();
  for (const doc of expiredSnap.docs) {
    batch.delete(doc.ref);
    const auditRef = db.collection('audit_logs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      type: 'session_expired',
      key_id: keyId,
      uid: doc.data().uid,
      machine_id: doc.data().machine_id,
      ip: doc.data().ip_address,
      app_id: doc.data().app_id,
      details: {
        reason: 'lazy_cleanup_heartbeat_timeout',
        session_id: doc.id,
        last_heartbeat: doc.data().last_heartbeat,
      },
      timestamp: now,
    });
  }
  await batch.commit();
  return expiredSnap.size;
}

/**
 * Đăng ký active session (entry point chính).
 *
 * Throw SessionRegisterError nếu key invalid. Trả result nếu OK.
 */
export async function registerKeySession(
  input: RegisterSessionInput,
): Promise<RegisterSessionResult> {
  const db = adminDb();
  const now = Date.now();

  // Validate input
  if (!input.keyCode || !input.appId || !input.machineId) {
    throw new SessionRegisterError('invalid-input');
  }
  const keyCode = normalizeKeyCode(input.keyCode);
  if (keyCode.length !== 16) {
    throw new SessionRegisterError('invalid-input', 'key_code must be 16 chars');
  }
  if (input.machineId.length < 8) {
    throw new SessionRegisterError('invalid-input', 'machine_id too short');
  }

  // 1. Find key by code
  const keysSnap = await db
    .collection('keys')
    .where('code', '==', keyCode)
    .limit(1)
    .get();
  if (keysSnap.empty) {
    throw new SessionRegisterError('key/not-found');
  }
  const keyDoc = keysSnap.docs[0]!;
  const key = keyDoc.data();
  const keyId = keyDoc.id;

  // 2. Validate key
  if (key.status === 'revoked') {
    throw new SessionRegisterError('key/revoked');
  }
  if (key.expires_at && key.expires_at > 0 && now >= key.expires_at) {
    throw new SessionRegisterError('key/expired');
  }

  const keyAppId = key.app_id ?? 'all';
  if (keyAppId !== 'all' && keyAppId !== input.appId) {
    throw new SessionRegisterError('key/wrong-app');
  }
  const keyType = key.type ?? 'account';

  // 3. Validate binding
  if (keyType === 'account') {
    if (!input.uid) {
      throw new SessionRegisterError('key/unauthenticated');
    }
    if (key.bound_uid && key.bound_uid !== input.uid) {
      throw new SessionRegisterError('key/wrong-binding');
    }
  } else if (keyType === 'standalone') {
    if (key.bound_machine_id && key.bound_machine_id !== input.machineId) {
      throw new SessionRegisterError('key/wrong-binding');
    }
  } else {
    throw new SessionRegisterError('key/unknown-type');
  }

  const maxConcurrent = key.max_concurrent ?? 1;

  // 4. Lazy cleanup expired sessions (best-effort, ngoài transaction)
  await cleanupExpiredSessionsOfKey(keyId).catch(() => {
    // ignore — best-effort, transaction sẽ tự re-count
  });

  // 5. Atomic transaction: bind key (nếu chưa) + count + create/kick
  const sessionId = randomUUID();
  let kickedSessionId: string | undefined;

  await db.runTransaction(async (tx) => {
    const keyRef = keyDoc.ref;
    const keyTx = await tx.get(keyRef);
    if (!keyTx.exists) {
      throw new SessionRegisterError('key/not-found');
    }
    const keyData = keyTx.data()!;

    // Bind key on first activate
    const updates: Record<string, string | number | undefined> = {};
    if (keyData.status === 'active') {
      updates.status = 'used';
      updates.activated_at = now;
    }
    if (keyType === 'account' && !keyData.bound_uid) {
      updates.bound_uid = input.uid;
      updates.used_by_uid = input.uid;
      updates.used_at = now;
    }
    if (keyType === 'standalone' && !keyData.bound_machine_id) {
      updates.bound_machine_id = input.machineId;
      updates.used_at = now;
    }
    if (Object.keys(updates).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tx.update(keyRef, updates as any);
    }

    // Count active sessions (đã lazy cleanup ở trên)
    const sessionsRef = keyRef.collection('sessions');
    const activeSnap = await tx.get(sessionsRef.where('expires_at', '>', now));
    const activeSessions = activeSnap.docs;

    const sameMachine = activeSessions.find(
      (d) => d.data().machine_id === input.machineId,
    );

    if (sameMachine) {
      tx.update(sameMachine.ref, {
        last_heartbeat: now,
        expires_at: now + SESSION_EXPIRY_MS,
        ip_address: input.ipAddress,
      });
      return;
    }

    if (activeSessions.length >= maxConcurrent) {
      const oldest = activeSessions.sort(
        (a, b) => (a.data().started_at ?? 0) - (b.data().started_at ?? 0),
      )[0]!;
      tx.delete(oldest.ref);
      kickedSessionId = oldest.id;

      const auditRef = db.collection('audit_logs').doc();
      tx.set(auditRef, {
        id: auditRef.id,
        type: 'session_kicked',
        key_id: keyId,
        uid: oldest.data().uid,
        machine_id: oldest.data().machine_id,
        ip: oldest.data().ip_address,
        app_id: oldest.data().app_id,
        actor_uid: keyType === 'account' ? input.uid : undefined,
        details: {
          reason: 'new_login_other_machine',
          kicked_session_id: oldest.id,
          new_machine_id: input.machineId,
        },
        timestamp: now,
      });
    }

    // Tạo session mới
    const newSessionRef = sessionsRef.doc(sessionId);
    tx.set(newSessionRef, {
      session_id: sessionId,
      key_id: keyId,
      app_id: input.appId,
      machine_id: input.machineId,
      ip_address: input.ipAddress,
      uid: keyType === 'account' ? input.uid : null,
      user_agent: input.userAgent ?? null,
      os: input.os ?? null,
      hostname: input.hostname ?? null,
      started_at: now,
      last_heartbeat: now,
      expires_at: now + SESSION_EXPIRY_MS,
    });

    // Audit session_start
    const auditRef = db.collection('audit_logs').doc();
    tx.set(auditRef, {
      id: auditRef.id,
      type: 'session_start',
      key_id: keyId,
      uid: keyType === 'account' ? input.uid : undefined,
      machine_id: input.machineId,
      ip: input.ipAddress,
      app_id: input.appId,
      details: { session_id: sessionId },
      timestamp: now,
    });

    // Update user.app_keys (account key)
    if (keyType === 'account' && input.uid) {
      const userRef = db.collection('users').doc(input.uid);
      tx.set(
        userRef,
        {
          app_keys: {
            [input.appId]: {
              key_id: keyId,
              activated_at: keyData.activated_at ?? now,
              expires_at: keyData.expires_at ?? 0,
            },
          },
        },
        { merge: true },
      );
    }

    // Standalone → device_activations
    if (keyType === 'standalone') {
      const compositeId = `${input.machineId}_${input.appId}`;
      const deviceRef = db.collection('device_activations').doc(compositeId);
      tx.set(deviceRef, {
        composite_id: compositeId,
        machine_id: input.machineId,
        app_id: input.appId,
        key_id: keyId,
        activated_at: keyData.activated_at ?? now,
        expires_at: keyData.expires_at ?? 0,
        hostname: input.hostname ?? null,
        os: input.os ?? null,
        ip_first_seen: input.ipAddress,
      });
    }
  });

  return {
    ok: true,
    sessionId,
    keyId,
    expiresAt: now + SESSION_EXPIRY_MS,
    kickedSessionId,
  };
}

/**
 * Heartbeat session: update last_heartbeat. Trả false nếu session đã bị kick.
 */
export async function heartbeatKeySession(
  keyId: string,
  sessionId: string,
): Promise<{ ok: boolean; expiresAt?: number; reason?: string }> {
  const db = adminDb();
  const now = Date.now();
  const sessionRef = db
    .collection('keys')
    .doc(keyId)
    .collection('sessions')
    .doc(sessionId);

  const snap = await sessionRef.get();
  if (!snap.exists) {
    return { ok: false, reason: 'session_not_found' };
  }
  await sessionRef.update({
    last_heartbeat: now,
    expires_at: now + SESSION_EXPIRY_MS,
  });
  return { ok: true, expiresAt: now + SESSION_EXPIRY_MS };
}

/**
 * End session: xóa + audit.
 */
export async function endKeySession(
  keyId: string,
  sessionId: string,
): Promise<{ ok: boolean }> {
  const db = adminDb();
  const sessionRef = db
    .collection('keys')
    .doc(keyId)
    .collection('sessions')
    .doc(sessionId);

  const snap = await sessionRef.get();
  if (snap.exists) {
    const data = snap.data()!;
    await sessionRef.delete();
    await db.collection('audit_logs').add({
      type: 'session_expired',
      key_id: keyId,
      uid: data.uid,
      machine_id: data.machine_id,
      ip: data.ip_address,
      app_id: data.app_id,
      details: { reason: 'user_logout', session_id: sessionId },
      timestamp: Date.now(),
    });
  }
  return { ok: true };
}
