/**
 * LoginScreen — Phase 22.4d.
 * Login Firebase + Remember me + Đăng ký link + Quên mật khẩu.
 */

import { useState } from 'react';
import { signInWithEmail, signInWithGoogle, getFirebaseAuth } from '@trishteam/auth';
import { setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Mail, AlertCircle, ExternalLink, KeyRound } from 'lucide-react';
import logoUrl from '../assets/logo.png';

const REMEMBER_KEY = 'trishdrive_remember_me';

export function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState<boolean>(() => {
    try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; }
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function applyPersistence() {
    try {
      const auth = getFirebaseAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); } catch {}
    } catch (e) {
      console.warn('[persistence] failed', e);
    }
  }

  async function doEmailLogin() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setErr(null);
    setResetMsg(null);
    try {
      await applyPersistence();
      await signInWithEmail(email.trim(), password);
    } catch (e) {
      setErr(prettyError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function doGoogleLogin() {
    setBusy(true);
    setErr(null);
    setResetMsg(null);
    try {
      await applyPersistence();
      await signInWithGoogle();
    } catch (e) {
      setErr(prettyError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function doForgotPassword() {
    if (!email.trim()) {
      setErr('Nhập email trước rồi bấm "Quên mật khẩu"');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setResetMsg(`Đã gửi link reset tới ${email.trim()}. Kiểm tra hộp thư + spam.`);
    } catch (e) {
      setErr(prettyError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-surface-bg)' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          <img src={logoUrl} alt="TrishDrive" style={{ width: 100, height: 100, borderRadius: 22, objectFit: 'cover', boxShadow: 'var(--shadow-md)' }} />
          <div className="text-center">
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)' }}>TrishDrive</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Cloud Storage cá nhân qua Telegram</p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>Đăng nhập</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
            Login tài khoản TrishTEAM để bắt đầu. Mỗi tài khoản 1 cloud Telegram riêng + AES-256 encrypt.
          </p>

          <div className="space-y-3 mt-5">
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="input-field"
                style={{ marginTop: 4 }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doEmailLogin()}
                className="input-field"
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
              />
              Ghi nhớ tài khoản
            </label>
            <button
              type="button"
              onClick={doForgotPassword}
              style={{ fontSize: 13, color: 'var(--color-text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Quên mật khẩu?
            </button>
          </div>

          {err && (
            <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
              <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
            </div>
          )}
          {resetMsg && (
            <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <KeyRound className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
              <div style={{ fontSize: 12, color: 'var(--color-accent-primary)' }}>{resetMsg}</div>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-5">
            <button className="btn-primary" onClick={doEmailLogin} disabled={busy || !email || !password} style={{ width: '100%' }}>
              <Mail className="h-4 w-4" /> {busy ? 'Đang đăng nhập...' : 'Đăng nhập bằng Email'}
            </button>

            <div className="flex items-center gap-3 my-1">
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>hoặc</span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
            </div>

            <button className="btn-secondary" onClick={doGoogleLogin} disabled={busy} style={{ width: '100%' }}>
              <GoogleIcon /> Đăng nhập bằng Google
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 16, textAlign: 'center', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 16 }}>
            Chưa có tài khoản?{' '}
            <button
              type="button"
              onClick={() => openUrl('https://trishteam.io.vn/login?signup=1')}
              style={{ color: 'var(--color-text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Đăng ký tại trishteam.io.vn
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 16 }}>
          TrishDrive v0.1.0-alpha · TrishTEAM ecosystem
        </p>
      </div>
    </div>
  );
}

function prettyError(msg: string): string {
  // Map Firebase error codes → tiếng Việt
  if (msg.includes('user-not-found')) return 'Email chưa đăng ký. Bấm "Đăng ký" để tạo tài khoản.';
  if (msg.includes('wrong-password') || msg.includes('invalid-credential')) return 'Email hoặc mật khẩu sai.';
  if (msg.includes('too-many-requests')) return 'Quá nhiều lần thử sai. Đợi vài phút rồi thử lại.';
  if (msg.includes('network')) return 'Không kết nối được Firebase. Kiểm tra mạng.';
  if (msg.includes('invalid-email')) return 'Email không hợp lệ.';
  if (msg.includes('user-disabled')) return 'Tài khoản đã bị vô hiệu hoá.';
  return msg;
}

function GoogleIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
