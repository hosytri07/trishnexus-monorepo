/**
 * Phase 19.24 — AdminBlocked screen (rewrite — đồng bộ với TrialBlockedScreen).
 *
 * User login Firebase OK nhưng email KHÔNG nằm trong ADMIN_EMAILS list.
 * Hiện UI thông báo theo style TrishLibrary TrialBlockedScreen.
 *
 * Force auto-signout sau 8 giây nếu user không bấm gì.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import logoUrl from '../assets/logo.png';

interface Props {
  email: string | null;
}

const AUTO_SIGNOUT_SECONDS = 8;

export function AdminBlocked({ email }: Props): JSX.Element {
  const { signOut } = useAuth();
  const [countdown, setCountdown] = useState(AUTO_SIGNOUT_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    const timeout = setTimeout(() => {
      void signOut();
    }, AUTO_SIGNOUT_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [signOut]);

  async function handleOpenWebsite(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn');
    } catch (err) {
      console.warn('open website fail', err);
    }
  }

  async function handleSignOut(): Promise<void> {
    await signOut();
  }

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-brand">
          <img src={logoUrl} alt="" className="login-logo" />
          <div>
            <h1>TrishAdmin</h1>
            <p className="muted small">Hệ sinh thái TrishTEAM</p>
          </div>
        </div>

        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 12,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: '0 0 8px',
              color: 'var(--danger)',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            🚫 Không có quyền truy cập
          </h2>
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--fg)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Tài khoản{' '}
            <strong>
              <code>{email ?? '(không có email)'}</code>
            </strong>{' '}
            không phải admin của hệ sinh thái TrishTEAM.
          </p>
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--fg-muted)',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            TrishAdmin là <strong>công cụ quản trị nội bộ</strong> — chỉ owner/admin
            được cấp quyền mới đăng nhập được. User thường vui lòng dùng:
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
              Website TrishTEAM:{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void handleOpenWebsite();
                }}
                style={{ color: 'var(--accent)' }}
              >
                trishteam.io.vn
              </a>
            </li>
            <li>App desktop khác (TrishLibrary, TrishFont, TrishCheck...)</li>
          </ul>
          <p
            style={{
              margin: 0,
              color: 'var(--warn)',
              fontSize: 12,
              fontStyle: 'italic',
            }}
          >
            ⏳ Đang tự động đăng xuất sau {countdown} giây…
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleOpenWebsite()}
            style={{ width: '100%' }}
          >
            🌐 Mở website TrishTEAM
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void handleSignOut()}
            style={{ width: '100%' }}
          >
            🚪 Đăng xuất ngay
          </button>
        </div>

        <p className="login-foot muted small">
          © 2026 TrishTEAM — Internal admin tool
        </p>
      </div>
    </div>
  );
}
