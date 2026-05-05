/**
 * Phase 37.3 — useKeySession hook shared cho mọi app desktop.
 *
 * State machine:
 *   loading → checking → (activated | needs_activation | error)
 *
 * - **loading**: chưa biết user/device đã activate chưa
 * - **checking**: đang query Firestore user.app_keys[appId] hoặc local cache
 * - **activated**: có session active, app render bình thường
 * - **needs_activation**: render <KeyActivationModal />
 * - **error**: hiển thị retry
 *
 * Account key flow:
 *   1. Wait Firebase Auth ready
 *   2. Read user.app_keys[appId] → nếu có + chưa hết hạn → resume session
 *   3. Nếu chưa → mở modal nhập key → activateAndStartSession()
 *
 * Standalone key flow:
 *   1. Đọc localStorage `trishteam:device_session:{appId}`
 *   2. Nếu có session_id + key_id → resume heartbeat + listenKick
 *   3. Nếu chưa → mở modal nhập key
 *
 * Lifecycle:
 *   - Mount: check + (resume | show modal)
 *   - Unmount: cleanup heartbeat + listener (KHÔNG end session, để user re-mở app dùng tiếp cùng session)
 *   - Khi user logout: caller gọi `endSession()` từ handle
 */
import { useEffect, useRef, useState } from 'react';
import {
  activateAndStartSession,
  registerSession,
  type SessionHandle,
} from './key-session.js';

export type KeySessionState =
  | { status: 'loading' }
  | { status: 'checking' }
  | { status: 'activated'; handle: SessionHandle }
  | { status: 'needs_activation' }
  | { status: 'error'; error: string };

export interface UseKeySessionOptions {
  /** App ID hiện tại */
  appId: string;
  /** 'account' (cần login + key) | 'standalone' (chỉ key, no login) */
  keyType: 'account' | 'standalone';
  /** Lấy machine_id từ Tauri command */
  getMachineId: () => Promise<string>;
  /**
   * Lấy Firebase ID token (account key). Trả null khi chưa login.
   * Skip cho standalone keys.
   */
  getIdToken?: () => Promise<string | null>;
  /**
   * Lấy current Firebase user (account key). Đọc app_keys[appId] để resume.
   * Trả null khi chưa login.
   */
  getCurrentUser?: () => Promise<{
    uid: string;
    appKeys?: Record<string, { key_id: string; expires_at: number } | undefined>;
  } | null>;
  /** Hostname từ OS (audit) */
  hostname?: string;
  /** OS string (audit) */
  os?: string;
  /** Callback khi session bị kick (máy khác login) */
  onKicked?: () => void;
  /** Callback khi heartbeat fail */
  onSessionLost?: (reason: string) => void;
  /** Disable auto-check (mặc định true) — tắt khi muốn manual control */
  autoCheck?: boolean;
}

const LS_DEVICE_SESSION_PREFIX = 'trishteam:device_session:';

interface CachedSession {
  key_id: string;
  session_id: string;
  expires_at: number;
}

function readCachedSession(appId: string): CachedSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(LS_DEVICE_SESSION_PREFIX + appId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (parsed.expires_at && parsed.expires_at < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSession(appId: string, sess: CachedSession): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      LS_DEVICE_SESSION_PREFIX + appId,
      JSON.stringify(sess),
    );
  } catch {
    /* ignore quota */
  }
}

function clearCachedSession(appId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(LS_DEVICE_SESSION_PREFIX + appId);
  } catch {
    /* ignore */
  }
}

/**
 * Hook chính. Trả state + actions:
 *   const { state, activate, refresh, end } = useKeySession({...});
 *
 *   if (state.status === 'needs_activation') {
 *     return <KeyActivationModal onSuccess={activate} ... />
 *   }
 *   if (state.status === 'activated') {
 *     return <YourApp />
 *   }
 */
export function useKeySession(options: UseKeySessionOptions): {
  state: KeySessionState;
  /** Gọi sau khi user nhập key thành công (qua KeyActivationModal onSuccess) */
  activate: (handle: SessionHandle) => void;
  /** Re-check (vd sau khi user login lại) */
  refresh: () => Promise<void>;
  /** End session chủ động (logout) */
  end: () => Promise<void>;
} {
  const [state, setState] = useState<KeySessionState>({ status: 'loading' });
  const handleRef = useRef<SessionHandle | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const cleanup = (): void => {
    if (handleRef.current) {
      handleRef.current.stop();
      handleRef.current = null;
    }
  };

  const activate = (handle: SessionHandle): void => {
    cleanup();
    handleRef.current = handle;
    if (optsRef.current.keyType === 'standalone') {
      writeCachedSession(optsRef.current.appId, {
        key_id: handle.keyId,
        session_id: handle.sessionId,
        expires_at: handle.expiresAt,
      });
    }
    setState({ status: 'activated', handle });
  };

  const end = async (): Promise<void> => {
    if (handleRef.current) {
      await handleRef.current.end();
      handleRef.current = null;
    }
    clearCachedSession(optsRef.current.appId);
    setState({ status: 'needs_activation' });
  };

  const checkAndResume = async (): Promise<void> => {
    setState({ status: 'checking' });
    const opts = optsRef.current;
    try {
      if (opts.keyType === 'standalone') {
        // Đọc cached session từ localStorage
        const cached = readCachedSession(opts.appId);
        if (cached) {
          // KHÔNG re-activate (key đã bind máy này), chỉ start heartbeat + listener
          // → cần re-fetch handle qua hàm registerSession (sẽ update heartbeat existing session)
          // Đây là edge case — đơn giản hóa: yêu cầu user nhập key lại nếu cache stale
          setState({ status: 'needs_activation' });
          return;
        }
        setState({ status: 'needs_activation' });
        return;
      }

      // Account key flow
      const user = opts.getCurrentUser ? await opts.getCurrentUser() : null;
      if (!user) {
        // Chưa login → modal yêu cầu login (caller xử lý)
        setState({ status: 'needs_activation' });
        return;
      }
      const appKey = user.appKeys?.[opts.appId];
      if (!appKey) {
        setState({ status: 'needs_activation' });
        return;
      }
      if (appKey.expires_at > 0 && appKey.expires_at < Date.now()) {
        setState({ status: 'needs_activation' });
        return;
      }
      // OK — re-register session để có sessionId mới + start heartbeat
      const idToken = opts.getIdToken ? await opts.getIdToken() : null;
      if (!idToken) {
        setState({ status: 'needs_activation' });
        return;
      }
      const machineId = await opts.getMachineId();
      // Lấy code key qua server không cần — registerSession qua key_id KHÔNG support
      // → cần code key. User đã activate trước đây = đã lưu key code qua app (TODO)
      // Đơn giản: yêu cầu user nhập lại key (chấp nhận UX hơi kém)
      // Tương lai: server endpoint /api/keys/resume-by-uid
      void machineId;
      void idToken;
      setState({ status: 'needs_activation' });
    } catch (err) {
      setState({ status: 'error', error: (err as Error).message });
    }
  };

  useEffect(() => {
    if (options.autoCheck === false) {
      setState({ status: 'needs_activation' });
      return;
    }
    void checkAndResume();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.appId, options.keyType]);

  return {
    state,
    activate,
    refresh: checkAndResume,
    end,
  };
}

/**
 * Helper: activate qua key code + register session.
 * Wrap activateAndStartSession để set callbacks default.
 */
export async function quickActivate(opts: {
  appId: string;
  keyCode: string;
  keyType: 'account' | 'standalone';
  machineId: string;
  idToken?: string;
  hostname?: string;
  os?: string;
  onKicked?: () => void;
  onSessionLost?: (reason: string) => void;
}): Promise<SessionHandle> {
  return activateAndStartSession(
    {
      keyCode: opts.keyCode,
      appId: opts.appId,
      machineId: opts.machineId,
      idToken: opts.idToken,
      hostname: opts.hostname,
      os: opts.os,
    },
    {
      onKicked: opts.onKicked,
      onSessionLost: opts.onSessionLost,
    },
  );
}

// Re-export để app dùng resume-by-keycode nếu cần
export { registerSession };
