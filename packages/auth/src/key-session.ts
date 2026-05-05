/**
 * Phase 36.6 — Key session client module.
 *
 * Workflow:
 *   1. App mount → check user.app_keys[appId] hoặc device_activations[machineId_appId]
 *   2. Nếu chưa activate → hiện UI nhập key → call activateAndStartSession()
 *   3. Đã activate → call resumeSession() (skip activation, register session mới)
 *   4. setInterval 5min → heartbeat()
 *   5. Listen Firestore /keys/{kid}/sessions/{sid} → nếu doc bị xóa = bị kick
 *      → hiện toast 5s + auto signOut
 *   6. Logout → endSession() + signOut Firebase
 *
 * API endpoint: https://trishteam.io.vn/api/keys/* (Vercel API routes).
 *
 * Sử dụng (account key):
 *   ```ts
 *   import { activateAndStartSession, startHeartbeatLoop, listenSessionKick } from '@trishteam/auth';
 *
 *   const result = await activateAndStartSession({
 *     keyCode: '...',
 *     appId: 'trishfinance',
 *     machineId: await invoke('get_device_id'),
 *     idToken: await user.getIdToken(),
 *   });
 *   const stop = startHeartbeatLoop(result.keyId, result.sessionId);
 *   const unsubKick = listenSessionKick(result.keyId, result.sessionId, () => {
 *     showToast('Phiên cũ đã bị thay thế. Đăng xuất sau 5s...');
 *     setTimeout(() => signOut(), 5000);
 *   });
 *   ```
 */

import {
  doc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase-app.js';
import { SESSION_HEARTBEAT_INTERVAL_MS } from '@trishteam/data';

// ============================================================
// Config
// ============================================================
const API_BASE =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE) ||
  'https://trishteam.io.vn';
const IPIFY_URL = 'https://api.ipify.org?format=json';
const IPIFY_TIMEOUT_MS = 3000;

// ============================================================
// Types
// ============================================================
export interface RegisterSessionParams {
  keyCode: string;
  appId: string;
  machineId: string;
  /** Firebase ID token — cần cho account key (apps có login) */
  idToken?: string;
  /** Hostname từ Tauri command — optional, audit only */
  hostname?: string;
  /** OS string — optional, audit only */
  os?: string;
}

export interface RegisterSessionResult {
  ok: true;
  sessionId: string;
  keyId: string;
  expiresAt: number;
  /** Nếu có nghĩa session này vừa kick session cũ */
  kickedSessionId?: string;
}

export interface SessionApiError {
  error: string;
  message?: string;
  detail?: string;
}

// ============================================================
// IP Detection
// ============================================================

/** Lấy public IP qua ipify.org. Fallback 'unknown' nếu fail. */
export async function getPublicIp(): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), IPIFY_TIMEOUT_MS);
    const res = await fetch(IPIFY_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return 'unknown';
    const data = (await res.json()) as { ip?: string };
    return data.ip ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ============================================================
// API calls
// ============================================================

/**
 * Đăng ký session mới (atomic transaction qua Vercel API).
 * Throw error có `code` field nếu fail.
 */
export async function registerSession(
  params: RegisterSessionParams,
): Promise<RegisterSessionResult> {
  const ip = await getPublicIp();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.idToken) {
    headers['Authorization'] = `Bearer ${params.idToken}`;
  }

  const res = await fetch(`${API_BASE}/api/keys/register-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      key_code: params.keyCode,
      app_id: params.appId,
      machine_id: params.machineId,
      ip_address: ip,
      hostname: params.hostname,
      os: params.os,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const err = (data ?? {}) as SessionApiError;
    const e = new Error(err.error || `HTTP ${res.status}`) as Error & {
      code?: string;
      status?: number;
    };
    e.code = err.error;
    e.status = res.status;
    throw e;
  }

  return {
    ok: true,
    sessionId: data.session_id,
    keyId: data.key_id,
    expiresAt: data.expires_at,
    kickedSessionId: data.kicked_session_id,
  };
}

/** Heartbeat update last_heartbeat. Return false nếu session đã bị kick. */
export async function heartbeatSession(
  keyId: string,
  sessionId: string,
): Promise<{ ok: boolean; expiresAt?: number; reason?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/keys/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key_id: keyId, session_id: sessionId }),
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      ok: data.ok === true,
      expiresAt: data.expires_at,
      reason: data.reason,
    };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

/** Logout chủ động — xóa session. Best-effort, không throw. */
export async function endSession(
  keyId: string,
  sessionId: string,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/keys/end-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key_id: keyId, session_id: sessionId }),
    });
  } catch {
    // ignore
  }
}

// ============================================================
// Heartbeat loop
// ============================================================

/**
 * Bắt đầu heartbeat loop mỗi 5 phút. Trả function stop().
 * Nếu heartbeat fail → callback `onSessionLost` được gọi.
 */
export function startHeartbeatLoop(
  keyId: string,
  sessionId: string,
  onSessionLost?: (reason: string) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const result = await heartbeatSession(keyId, sessionId);
    if (!result.ok) {
      onSessionLost?.(result.reason ?? 'unknown');
      return; // dừng loop
    }
    if (!stopped) {
      timer = setTimeout(() => void tick(), SESSION_HEARTBEAT_INTERVAL_MS);
    }
  };

  // Tick đầu sau 5 phút (không tick ngay vì registerSession đã tạo session)
  timer = setTimeout(() => void tick(), SESSION_HEARTBEAT_INTERVAL_MS);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

// ============================================================
// Realtime kick listener (Firestore onSnapshot)
// ============================================================

/**
 * Listen realtime session document. Nếu doc BỊ XÓA (server-side kick) → callback.
 *
 * Lưu ý: client cần có quyền read /keys/{keyId}/sessions/{sessionId} qua
 * Firestore rules. Đã setup Phase 36.2: owner (bound_uid) đọc được.
 */
export function listenSessionKick(
  keyId: string,
  sessionId: string,
  onKicked: () => void,
): Unsubscribe {
  const db = getFirebaseDb();
  const sessionRef = doc(db, 'keys', keyId, 'sessions', sessionId);
  return onSnapshot(
    sessionRef,
    (snap) => {
      if (!snap.exists()) {
        onKicked();
      }
    },
    (err) => {
      // Permission error or network — không call onKicked (tránh false positive)
      console.warn('[key-session] listener error:', err);
    },
  );
}

// ============================================================
// High-level orchestration
// ============================================================

export interface SessionHandle {
  keyId: string;
  sessionId: string;
  expiresAt: number;
  /** Stop heartbeat loop + unsubscribe kick listener */
  stop: () => void;
  /** Logout chủ động + cleanup */
  end: () => Promise<void>;
}

/**
 * Activate key (nếu chưa) + start session + heartbeat + kick listener.
 * Trả handle với stop() / end() để app quản lý lifecycle.
 *
 * Caller cần handle:
 * - `onKicked`: hiển thị toast 5s rồi signOut Firebase
 * - Catch error từ registerSession (key invalid/expired/wrong-binding...)
 */
export async function activateAndStartSession(
  params: RegisterSessionParams,
  callbacks?: {
    onKicked?: () => void;
    onSessionLost?: (reason: string) => void;
  },
): Promise<SessionHandle> {
  const result = await registerSession(params);

  const stopHeartbeat = startHeartbeatLoop(
    result.keyId,
    result.sessionId,
    callbacks?.onSessionLost,
  );

  const unsubKick = listenSessionKick(
    result.keyId,
    result.sessionId,
    () => {
      callbacks?.onKicked?.();
    },
  );

  return {
    keyId: result.keyId,
    sessionId: result.sessionId,
    expiresAt: result.expiresAt,
    stop: () => {
      stopHeartbeat();
      unsubKick();
    },
    end: async () => {
      stopHeartbeat();
      unsubKick();
      await endSession(result.keyId, result.sessionId);
    },
  };
}
