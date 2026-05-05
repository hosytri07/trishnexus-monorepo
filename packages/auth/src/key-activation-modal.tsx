/**
 * Phase 37.1 — KeyActivationModal: React component shared cho mọi app.
 *
 * Hỗ trợ cả 2 loại key:
 * - **Account key** (apps có login): cần `idToken` Firebase
 * - **Standalone key** (apps no-login): chỉ cần machine_id
 *
 * Workflow:
 *   1. User mở app → app check user.app_keys[appId] hoặc device_activations
 *   2. Nếu chưa activate → render <KeyActivationModal appId="trishfinance" .../>
 *   3. User nhập 16 chars XXXX-XXXX-XXXX-XXXX (auto format)
 *   4. Submit → call activateAndStartSession() → onSuccess(handle)
 *   5. App lưu handle, gắn vào lifecycle, listen kick + heartbeat tự động chạy
 *
 * Caller cần inject `getMachineId` callback vì @trishteam/auth không depend
 * trực tiếp vào @tauri-apps/api (web cũng dùng package này).
 */

import {
  type FC,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  activateAndStartSession,
  type SessionHandle,
} from './key-session.js';

export interface KeyActivationModalProps {
  /** App ID hiện tại (vd 'trishfinance') */
  appId: string;
  /** Tên app hiển thị (vd 'TrishFinance') */
  appName: string;
  /** Lấy machine_id từ Tauri command. Caller tự inject. */
  getMachineId: () => Promise<string>;
  /** Lấy Firebase ID token. Bỏ qua nếu là standalone key (apps no-login). */
  getIdToken?: () => Promise<string | null>;
  /** Callback khi activate thành công. App nhận handle để cleanup khi unmount. */
  onSuccess: (handle: SessionHandle) => void;
  /** Callback session bị kick (máy khác login) — show toast 5s + signOut. */
  onKicked?: () => void;
  /** Callback heartbeat fail — show toast + signOut. */
  onSessionLost?: (reason: string) => void;
  /** Hostname từ OS — optional, audit log */
  hostname?: string;
  /** OS string — optional */
  os?: string;
  /** Hiện modal hay không */
  isOpen: boolean;
  /** Đóng modal (X / ESC). Caller có thể prevent close nếu force activate. */
  onClose?: () => void;
  /** Mặc định 'account'. Set 'standalone' cho apps no-login. */
  keyType?: 'account' | 'standalone';
}

/** Format raw 16 chars → "XXXX-XXXX-XXXX-XXXX" (chỉ uppercase + alphanumeric) */
function formatKeyDisplay(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return clean.match(/.{1,4}/g)?.join('-') ?? clean;
}

/** Map error code (từ API) sang message tiếng Việt */
function errorMessage(code?: string): string {
  switch (code) {
    case 'key/not-found':
      return 'Key không tồn tại. Vui lòng kiểm tra lại.';
    case 'key/revoked':
      return 'Key đã bị thu hồi. Liên hệ admin để cấp key mới.';
    case 'key/expired':
      return 'Key đã hết hạn. Liên hệ admin để gia hạn hoặc cấp key mới.';
    case 'key/wrong-app':
      return 'Key này không dùng được cho app này.';
    case 'key/wrong-binding':
      return 'Key đã được kích hoạt bởi user/máy khác.';
    case 'key/unauthenticated':
      return 'Vui lòng đăng nhập trước khi kích hoạt key.';
    case 'invalid-input':
      return 'Key phải có đúng 16 ký tự (chữ hoặc số).';
    case 'unauthenticated':
      return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    case 'internal':
      return 'Lỗi máy chủ. Thử lại sau ít phút.';
    default:
      return code || 'Lỗi không xác định.';
  }
}

export const KeyActivationModal: FC<KeyActivationModalProps> = ({
  appId,
  appName,
  getMachineId,
  getIdToken,
  onSuccess,
  onKicked,
  onSessionLost,
  hostname,
  os,
  isOpen,
  onClose,
  keyType = 'account',
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatted = useMemo(() => formatKeyDisplay(keyInput), [keyInput]);
  const cleanKey = useMemo(
    () => keyInput.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16),
    [keyInput],
  );
  const canSubmit = cleanKey.length === 16 && !submitting;

  // Reset khi mở lại
  useEffect(() => {
    if (isOpen) {
      setKeyInput('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e?: FormEvent): Promise<void> => {
      e?.preventDefault();
      if (!canSubmit) return;
      setSubmitting(true);
      setError(null);
      try {
        const machineId = await getMachineId();
        const idToken =
          keyType === 'account' && getIdToken ? await getIdToken() : null;

        if (keyType === 'account' && !idToken) {
          setError('Vui lòng đăng nhập trước khi kích hoạt key.');
          setSubmitting(false);
          return;
        }

        const handle = await activateAndStartSession(
          {
            keyCode: cleanKey,
            appId,
            machineId,
            idToken: idToken ?? undefined,
            hostname,
            os,
          },
          {
            onKicked,
            onSessionLost,
          },
        );
        onSuccess(handle);
      } catch (err) {
        const e = err as { code?: string; message?: string };
        setError(errorMessage(e.code || e.message));
        setSubmitting(false);
      }
    },
    [
      canSubmit,
      cleanKey,
      appId,
      keyType,
      getMachineId,
      getIdToken,
      onSuccess,
      onKicked,
      onSessionLost,
      hostname,
      os,
    ],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      } else if (e.key === 'Escape' && onClose && !submitting) {
        onClose();
      }
    },
    [handleSubmit, onClose, submitting],
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose && !submitting ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-bg-elevated, #ffffff)',
          color: 'var(--color-text-primary, #1F2937)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: 480,
          padding: 28,
          fontFamily:
            "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#10B981',
              marginBottom: 6,
            }}
          >
            🔐 Kích hoạt key
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            {appName}
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 13,
              color: 'var(--color-text-secondary, #6B7280)',
              lineHeight: 1.55,
            }}
          >
            Để sử dụng <strong>{appName}</strong>, vui lòng nhập key kích hoạt
            được admin cấp.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Key kích hoạt (16 ký tự)
          </label>
          <input
            type="text"
            value={formatted}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            disabled={submitting}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 16,
              fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace',
              letterSpacing: '0.06em',
              border: '1px solid var(--color-border-default, #D1D5DB)',
              borderRadius: 10,
              background: 'var(--color-surface-card, #FFFFFF)',
              color: 'var(--color-text-primary, #1F2937)',
              boxSizing: 'border-box',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 8,
                color: '#DC2626',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div
            style={{
              marginTop: 14,
              fontSize: 11,
              color: 'var(--color-text-muted, #9CA3AF)',
              lineHeight: 1.55,
            }}
          >
            💡 Key có dạng <code>XXXX-XXXX-XXXX-XXXX</code> (16 chữ + số ngẫu
            nhiên). Mỗi key chỉ dùng được trên{' '}
            <strong>1 thiết bị tại 1 thời điểm</strong> (do admin set).
            {keyType === 'account' && (
              <>
                {' '}
                Sau khi kích hoạt, key gắn với tài khoản của bạn.
              </>
            )}
            {keyType === 'standalone' && (
              <>
                {' '}
                Key gắn với máy này, không cần đăng nhập.
              </>
            )}
          </div>

          <div
            style={{
              marginTop: 22,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid var(--color-border-default, #D1D5DB)',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--color-text-primary, #1F2937)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '10px 22px',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                background: canSubmit
                  ? 'linear-gradient(135deg, #10B981 0%, #4ADE80 100%)'
                  : 'rgba(148, 163, 184, 0.4)',
                color: '#FFFFFF',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                letterSpacing: '0.02em',
                transition: 'all 250ms ease-out',
                boxShadow: canSubmit
                  ? '0 4px 18px rgba(16, 185, 129, 0.4)'
                  : 'none',
              }}
            >
              {submitting ? 'Đang kích hoạt...' : 'Kích hoạt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
