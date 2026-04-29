/**
 * Phase 19.24 — AdminLogin với 3 mode (đồng bộ TrishLibrary):
 *   - signin  — Đăng nhập (default)
 *   - signup  — Đăng ký tài khoản mới
 *   - forgot  — Quên mật khẩu
 *
 * LƯU Ý: TrishAdmin chỉ cho admin (allowlist email) vào.
 * User signup sẽ tạo account trial — vào được TrishLibrary/web nhưng
 * KHÔNG vào được TrishAdmin (sẽ thấy AdminBlocked).
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  signInWithEmail,
  signUpWithEmail,
  sendResetPassword,
} from '@trishteam/auth';
import { openUrl } from '@tauri-apps/plugin-opener';
import logoUrl from '../assets/logo.png';

type Mode = 'signin' | 'signup' | 'forgot';

const REMEMBER_KEY = 'trishadmin:remember_email';

export function AdminLogin(): JSX.Element {
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
      'auth/network-request-failed': 'Lỗi mạng — kiểm tra Internet',
      'auth/too-many-requests': 'Quá nhiều lần thử, chờ 15 phút',
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
      showInfo('✓ Đăng ký thành công! Email xác thực đã gửi.');
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

  async function handleOpenWeb(): Promise<void> {
    try {
      await openUrl('https://trishteam.io.vn/login');
    } catch (err) {
      showError(`Không mở được browser: ${err instanceof Error ? err.message : err}`);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-head">
          <img src={logoUrl} alt="TrishAdmin" className="login-logo" />
          <h1>TrishAdmin</h1>
          <p className="muted small">
            Quản trị hệ sinh thái — chỉ admin được phép truy cập.
          </p>
        </header>

        {error && <div className="login-banner login-banner-error">⚠ {error}</div>}
        {info && <div className="login-banner login-banner-info">{info}</div>}

        {/* === SIGN IN === */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="login-form">
            <label className="login-label">
              <span>Email admin</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoFocus
                required
                disabled={busy}
                autoComplete="email"
              />
            </label>
            <label className="login-label">
              <span>Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={busy}
                autoComplete="current-password"
              />
            </label>
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={busy}
              />
              <span>Ghi nhớ email cho lần sau</span>
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !email.trim() || !password}
            >
              {busy ? '⏳ Đang đăng nhập…' : '🔐 Đăng nhập'}
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

        {/* === SIGN UP === */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="login-form">
            <h2 className="login-mode-title">Tạo tài khoản mới</h2>
            <label className="login-label">
              <span>Tên hiển thị</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required
                autoComplete="name"
                disabled={busy}
              />
            </label>
            <label className="login-label">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                autoComplete="email"
                disabled={busy}
              />
            </label>
            <label className="login-label">
              <span>Mật khẩu (≥ 6 ký tự)</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                minLength={6}
                disabled={busy}
              />
            </label>
            <p className="muted small login-warning">
              ⚠ Tài khoản mới sẽ là <strong>Trial</strong> — KHÔNG vào được
              TrishAdmin (chỉ admin được phép). Sau khi đăng ký, dùng email +
              mật khẩu để login{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  void handleOpenWeb();
                }}
              >
                trishteam.io.vn
              </a>{' '}
              hoặc app desktop khác.
            </p>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '⏳ Đang đăng ký…' : '✨ Đăng ký'}
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

        {/* === FORGOT === */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="login-form">
            <h2 className="login-mode-title">Quên mật khẩu</h2>
            <p className="muted small">
              Nhập email tài khoản. Firebase sẽ gửi link đặt lại mật khẩu qua email.
            </p>
            <label className="login-label">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                autoFocus
                disabled={busy}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '⏳ Đang gửi…' : '📧 Gửi email đặt lại mật khẩu'}
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

        <footer className="login-foot">
          <p className="muted small">
            Tool nội bộ — chỉ admin có quyền truy cập đầy đủ.
          </p>
        </footer>
      </div>
    </div>
  );
}
