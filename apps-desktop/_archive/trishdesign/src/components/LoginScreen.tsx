/**
 * Phase 14.4.8 — LoginScreen cho TrishDesign.
 *
 * 3 mode: signin / signup / forgot.
 * Remember email (localStorage).
 * Error code → tiếng Việt.
 * Google login DIRECT (signInWithGoogle qua Firebase popup).
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendResetPassword,
} from '@trishteam/auth';
import { loginWithGoogleLoopback } from '../lib/google-oauth.js';
import logoUrl from '../assets/logo.png';

type Mode = 'signin' | 'signup' | 'forgot';

const REMEMBER_KEY = 'trishdesign:remember_email';

export function LoginScreen(): JSX.Element {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persistRememberedEmail(value: string): void {
    try {
      if (remember && value.trim()) {
        localStorage.setItem(REMEMBER_KEY, value.trim());
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  function showError(msg: string): void {
    setError(msg);
    setInfo(null);
    setTimeout(() => setError(null), 6000);
  }
  function showInfo(msg: string): void {
    setInfo(msg);
    setError(null);
    setTimeout(() => setInfo(null), 6000);
  }

  function errMsg(err: unknown): string {
    const code = (err as { code?: string }).code ?? '';
    const map: Record<string, string> = {
      'auth/invalid-email': 'Email không hợp lệ',
      'auth/user-not-found': 'Không tìm thấy tài khoản',
      'auth/wrong-password': 'Sai mật khẩu',
      'auth/invalid-credential': 'Email hoặc mật khẩu sai',
      'auth/email-already-in-use': 'Email đã đăng ký',
      'auth/weak-password': 'Mật khẩu cần tối thiểu 6 ký tự',
      'auth/popup-closed-by-user': 'Đã đóng cửa sổ Google',
      'auth/popup-blocked': 'Trình duyệt chặn popup — bật cho phép popup rồi thử lại',
      'auth/cancelled-popup-request': 'Đã huỷ đăng nhập',
      'auth/network-request-failed': 'Lỗi mạng — kiểm tra Internet',
      'auth/too-many-requests': 'Quá nhiều lần thử, chờ 15 phút',
      'auth/operation-not-supported-in-this-environment': 'Môi trường không hỗ trợ — thử cách khác',
    };
    return map[code] ?? (err as Error).message ?? 'Lỗi không xác định';
  }

  async function handleSignIn(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      persistRememberedEmail(email);
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    if (!displayName.trim()) {
      showError('Nhập tên hiển thị');
      return;
    }
    setBusy(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      persistRememberedEmail(email);
      showInfo('✓ Đăng ký thành công! Cần kích hoạt key để dùng được app.');
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Phase 14.4.10 — Google login qua Loopback OAuth flow.
   *
   * 1) Mở Edge/Chrome (browser ngoài, có sẵn Google session đã save)
   * 2) User chọn account
   * 3) Google redirect → http://127.0.0.1:RANDOM_PORT (Rust loopback server catch)
   * 4) Frontend exchange code → ID token
   * 5) Firebase signInWithCredential
   *
   * UX giống Slack/VSCode/GitHub Desktop. Tận dụng được account Google đã
   * lưu trong browser default của user.
   */
  async function handleGoogle(): Promise<void> {
    if (busy) return;
    setBusy(true);
    showInfo('🌐 Đang mở browser… Chọn tài khoản Google trong cửa sổ vừa hiện ra.');
    try {
      await loginWithGoogleLoopback();
      // signInWithCredential thành công → AuthProvider sẽ fire onAuthStateChanged
      showInfo('✓ Đăng nhập thành công!');
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      showError('Nhập email trước');
      return;
    }
    setBusy(true);
    try {
      await sendResetPassword(email.trim());
      showInfo('✓ Email đặt lại mật khẩu đã gửi. Check inbox + spam.');
      setTimeout(() => setMode('signin'), 2500);
    } catch (err) {
      showError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <img src={logoUrl} alt="" className="login-logo" />
          <div>
            <h1>TrishDesign</h1>
            <p className="muted small">Đăng nhập để bắt đầu</p>
          </div>
        </div>

        {error && <div className="login-banner login-banner-error">⚠ {error}</div>}
        {info && <div className="login-banner login-banner-info">{info}</div>}

        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="login-form">
            <h2>Đăng nhập</h2>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={busy}
            />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={busy}
            />
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={busy}
              />
              <span>Ghi nhớ tài khoản (tự đăng nhập lần sau)</span>
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
            <div className="login-divider">— hoặc —</div>
            <button
              type="button"
              className="btn btn-ghost btn-google"
              onClick={() => void handleGoogle()}
              disabled={busy}
            >
              <span className="google-icon">G</span> Đăng nhập Google qua web ↗
            </button>
            <div className="login-links">
              <button
                type="button"
                className="link-btn"
                onClick={() => setMode('forgot')}
                disabled={busy}
              >
                Quên mật khẩu?
              </button>
              <span className="muted">·</span>
              <button
                type="button"
                className="link-btn"
                onClick={() => setMode('signup')}
                disabled={busy}
              >
                Tạo tài khoản
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="login-form">
            <h2>Tạo tài khoản</h2>
            <input
              type="text"
              placeholder="Tên hiển thị"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              disabled={busy}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={busy}
            />
            <input
              type="password"
              placeholder="Mật khẩu (≥ 6 ký tự)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              disabled={busy}
            />
            <p className="muted small">
              Sau khi đăng ký, tài khoản là <strong>Trial</strong>. TrishDesign chỉ
              dành cho User và Admin — cần kích hoạt activation key trước khi dùng.
            </p>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Đăng ký'}
            </button>
            <div className="login-links">
              <button
                type="button"
                className="link-btn"
                onClick={() => setMode('signin')}
                disabled={busy}
              >
                ← Đã có tài khoản? Đăng nhập
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="login-form">
            <h2>Quên mật khẩu</h2>
            <p className="muted small">
              Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu.
            </p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi link reset'}
            </button>
            <div className="login-links">
              <button
                type="button"
                className="link-btn"
                onClick={() => setMode('signin')}
                disabled={busy}
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        <p className="login-footer muted small">
          © 2026 TrishTEAM — Bộ công cụ Khảo sát &amp; Thiết kế
        </p>
      </div>
    </div>
  );
}
