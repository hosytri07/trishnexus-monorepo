/**
 * Phase 16.2.d — TrialBlockedScreen.
 *
 * Block toàn bộ tính năng cho user role 'trial'. Hiện UI thông báo + 2 button:
 *   - Mở web để kích hoạt key
 *   - Đăng xuất
 */

import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuth } from '@trishteam/auth/react';
import logoUrl from '../assets/logo.png';

export function TrialBlockedScreen(): JSX.Element {
  const { profile, signOut } = useAuth();

  async function handleOpenProfile(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/profile');
    } catch (err) {
      console.warn('open profile fail', err);
    }
  }

  async function handleOpenFeedback(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/#feedback');
    } catch (err) {
      console.warn('open feedback fail', err);
    }
  }

  async function handleSignOut(): Promise<void> {
    if (!confirm('Đăng xuất?')) return;
    await signOut();
  }

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-brand">
          <img src={logoUrl} alt="" className="login-logo" />
          <div>
            <h1>TrishLibrary</h1>
            <p className="muted small">Hệ sinh thái TrishTEAM</p>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            borderRadius: 12,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              color: 'rgb(252, 211, 77)',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ⏳ Tài khoản Trial — chưa kích hoạt
          </h2>
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--fg)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Xin chào <strong>{profile?.display_name ?? profile?.email}</strong>!
          </p>
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--fg-muted)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Anh/chị cần <strong>kích hoạt key</strong> mới sử dụng được phần mềm.
            Liên hệ:
          </p>
          <ul
            style={{
              margin: '0 0 12px',
              paddingLeft: 20,
              color: 'var(--fg-muted)',
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            <li>
              Email:{' '}
              <a
                href="mailto:trishteam.official@gmail.com"
                style={{ color: 'var(--accent)' }}
              >
                trishteam.official@gmail.com
              </a>
            </li>
            <li>
              Hoặc gửi góp ý ở cuối website{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void handleOpenFeedback();
                }}
                style={{ color: 'var(--accent)' }}
              >
                trishteam.io.vn
              </a>
            </li>
          </ul>
          <p
            style={{
              margin: 0,
              color: 'var(--fg-muted)',
              fontSize: 12,
              fontStyle: 'italic',
            }}
          >
            Sau khi nhận được key, vào trang Profile trên website để kích hoạt.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleOpenProfile()}
            style={{ width: '100%' }}
          >
            🔑 Mở trang Profile để nhập key
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleOpenFeedback()}
            style={{ width: '100%' }}
          >
            💬 Gửi góp ý liên hệ Admin
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={() => void handleSignOut()}
            style={{ width: '100%' }}
          >
            🚪 Đăng xuất
          </button>
        </div>

        <p className="login-footer muted small">
          © 2026 TrishTEAM — Local-first ecosystem
        </p>
      </div>
    </div>
  );
}
