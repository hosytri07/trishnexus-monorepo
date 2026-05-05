/**
 * Phase 37.3 — KeyGate generic shared cho mọi app desktop.
 *
 * Wrap component App. Check key activation, nếu chưa → hiện KeyActivationModal.
 * Sau khi activate → render children + auto heartbeat 5min + listen kick.
 *
 * Ví dụ wire vào TrishLibrary main.tsx:
 *   <AuthProvider>
 *     <KeyGate appId="trishlibrary" appName="TrishLibrary" keyType="account"
 *              getMachineId={() => invoke('get_device_id')}>
 *       <App />
 *     </KeyGate>
 *   </AuthProvider>
 *
 * Cho standalone app (no-login, vd TrishShortcut):
 *   <KeyGate appId="trishshortcut" appName="TrishShortcut" keyType="standalone"
 *            getMachineId={() => invoke('get_device_id')}>
 *     <App />
 *   </KeyGate>
 */
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './react.js';
import { KeyActivationModal } from './key-activation-modal.js';
import { type SessionHandle } from './key-session.js';

export interface KeyGateProps {
  appId: string;
  appName: string;
  keyType: 'account' | 'standalone';
  /** Lấy machine_id qua Tauri command. Caller inject. */
  getMachineId: () => Promise<string>;
  /** Hostname OS — audit only */
  hostname?: string;
  /** OS string — audit only */
  os?: string;
  children: ReactNode;
  /** Render khi đang load auth state */
  loadingFallback?: ReactNode;
  /** Custom message khi modal hiện */
  customWelcomeMessage?: string;
}

export function KeyGate({
  appId,
  appName,
  keyType,
  getMachineId,
  hostname,
  os,
  children,
  loadingFallback,
}: KeyGateProps): JSX.Element {
  const auth = keyType === 'account' ? useAuth() : null;
  const firebaseUser = auth?.firebaseUser ?? null;
  const profile = auth?.profile ?? null;
  const loading = auth?.loading ?? false;
  const signOutFn = auth?.signOut;

  const [sessionHandle, setSessionHandle] = useState<SessionHandle | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [kicked, setKicked] = useState(false);

  const checkActivation = useCallback((): void => {
    if (keyType === 'account') {
      if (loading) return;
      if (!firebaseUser) {
        // Chưa login → bỏ qua KeyGate (auth flow riêng xử lý)
        setShowModal(false);
        return;
      }
      // Có login. Check app_keys.
      const appKey = profile?.app_keys?.[
        appId as keyof NonNullable<typeof profile.app_keys>
      ];
      if (
        appKey &&
        (appKey.expires_at === 0 || appKey.expires_at > Date.now())
      ) {
        // Đã activate trước, nhưng client KHÔNG có key code (chỉ key_id) →
        // vẫn cần user nhập key 1 lần để có sessionId mới + session active.
        // (Có thể tối ưu sau: /api/keys/resume-by-uid)
        setShowModal(true);
        return;
      }
      setShowModal(true);
    } else {
      // Standalone: luôn hiện modal nếu chưa có handle (cache localStorage TODO)
      setShowModal(true);
    }
  }, [keyType, firebaseUser, profile, loading, appId]);

  useEffect(() => {
    checkActivation();
  }, [checkActivation]);

  // Cleanup khi unmount
  useEffect(() => {
    return () => {
      if (sessionHandle) {
        sessionHandle.stop();
      }
    };
  }, [sessionHandle]);

  const handleActivated = useCallback((handle: SessionHandle): void => {
    setSessionHandle(handle);
    setShowModal(false);
    setKicked(false);
  }, []);

  const handleKicked = useCallback((): void => {
    setKicked(true);
    if (sessionHandle) {
      sessionHandle.stop();
      setSessionHandle(null);
    }
    setTimeout(() => {
      setKicked(false);
      setShowModal(true);
    }, 5000);
  }, [sessionHandle]);

  const handleSessionLost = useCallback((reason: string): void => {
    console.warn('[KeyGate]', appId, 'session lost:', reason);
    if (sessionHandle) {
      sessionHandle.stop();
      setSessionHandle(null);
    }
    setShowModal(true);
  }, [sessionHandle, appId]);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (keyType !== 'account' || !firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [keyType, firebaseUser]);

  // Loading auth
  if (keyType === 'account' && loading) {
    return (
      <>
        {loadingFallback ?? (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              color: '#6B7280',
            }}
          >
            Đang tải…
          </div>
        )}
      </>
    );
  }

  // Account key + chưa login → để app render auth flow
  if (keyType === 'account' && !firebaseUser) {
    return <>{children}</>;
  }

  // Đã activate → render app + listener đang chạy ở handle
  if (sessionHandle && !kicked && !showModal) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {kicked && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2147483646,
            background: 'rgba(220, 38, 38, 0.95)',
            color: '#fff',
            padding: '14px 22px',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            maxWidth: 480,
            textAlign: 'center',
            animation: 'slideDown 280ms ease-out',
          }}
        >
          ⚠️ Tài khoản vừa đăng nhập trên máy khác. Phiên này sẽ tự đăng xuất sau 5 giây.
        </div>
      )}
      <KeyActivationModal
        isOpen={showModal}
        appId={appId}
        appName={appName}
        keyType={keyType}
        getMachineId={getMachineId}
        getIdToken={keyType === 'account' ? getIdToken : undefined}
        onSuccess={handleActivated}
        onKicked={handleKicked}
        onSessionLost={handleSessionLost}
        hostname={hostname}
        os={os}
        // Phase 38.x — Email + signOut callback (account key only)
        currentUserEmail={
          keyType === 'account' ? (firebaseUser?.email ?? undefined) : undefined
        }
        onSignOut={
          keyType === 'account' && signOutFn
            ? async () => {
                // Cleanup session handle hiện tại trước khi signOut
                if (sessionHandle) {
                  sessionHandle.stop();
                  setSessionHandle(null);
                }
                await signOutFn();
                // Sau signOut, AuthProvider re-render với firebaseUser=null
                // → KeyGate sẽ render children (auth flow của app) thay vì modal
                setShowModal(false);
              }
            : undefined
        }
        // KHÔNG cho đóng modal khi chưa activate (force user nhập key)
      />
    </>
  );
}
