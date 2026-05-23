/**
 * Phase 14.4.6 — TrialBlockedScreen.
 *
 * User login OK nhưng role = 'trial' → block. Cần kích hoạt activation key.
 */

import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuth } from '@trishteam/auth/react';
import logoUrl from '../assets/logo.png';

export function TrialBlockedScreen(): JSX.Element {
  const { firebaseUser, signOut } = useAuth();

  async function handleActivate(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/profile');
    } catch (err) {
      console.warn('openUrl failed', err);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (!confirm('Đăng xuất khỏi TrishDesign?')) return;
    await signOut();
  }

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 540 }}>
        <div className="login-brand">
          <img src={logoUrl} alt="" className="login-logo" />
          <div>
            <h1>TrishDesign</h1>
            <p className="muted small">Hệ sinh thái TrishTEAM</p>
          </div>
        </div>

        <div className="td-trial-warn">
          <strong>🔒 Tài khoản chưa được phép sử dụng TrishDesign</strong>
          <p>
            Email <code>{firebaseUser?.email ?? '(unknown)'}</code> đang ở role
            <strong> Trial</strong>. App này chỉ dành cho User và Admin —
            anh/chị cần kích hoạt activation key trước khi dùng.
          </p>
        </div>

        <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 6 }}>Các bước kích hoạt:</h3>
        <ol className="td-trial-steps muted small">
          <li>Mở <strong>trang Profile</strong> trên website TrishTEAM</li>
          <li>Nhập <strong>Activation key</strong> (định dạng <code>TRISH-XXXX-XXXX-XXXX</code>)</li>
          <li>Quay lại app này, đăng xuất + đăng nhập lại để cập nhật role</li>
        </ol>

        <div className="td-action-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => void handleActivate()}>
            🔑 Kích hoạt key
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleSignOut()}>
            ↩ Đăng xuất
          </button>
        </div>

        <p className="login-footer muted small">
          Liên hệ <a href="mailto:trishteam.official@gmail.com">trishteam.official@gmail.com</a> nếu cần được cấp key.
        </p>
      </div>
    </div>
  );
}
