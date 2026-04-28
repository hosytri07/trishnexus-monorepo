/**
 * Phase 18.7.a — AdminLogin screen.
 *
 * Login form Firebase Auth. Hint: chỉ admin email mới vào được app.
 * Sau khi login thành công, Root.tsx sẽ kiểm tra email vs ADMIN_EMAILS:
 *   - Match → render <App>
 *   - Không match → render <AdminBlocked> (đăng xuất + không cho thử lại)
 */

import { useState } from 'react';
import { signInWithEmail } from '@trishteam/auth';

export function AdminLogin(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      // Root.tsx auto-rerender sau khi firebaseUser update
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-head">
          <span className="login-emoji">🛡</span>
          <h1>TrishAdmin</h1>
          <p className="muted small">
            Quản trị hệ sinh thái — chỉ admin được phép truy cập.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            <span>Email admin</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trishteam.official@gmail.com"
              autoFocus
              required
              disabled={busy}
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
            />
          </label>
          {error && (
            <div className="login-error">
              ⚠ {error}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !email.trim() || !password}
          >
            {busy ? '⏳ Đang đăng nhập…' : '🔐 Đăng nhập'}
          </button>
        </form>

        <footer className="login-foot">
          <p className="muted small">
            Không có tài khoản admin? Đây là tool nội bộ — liên hệ owner repo.
          </p>
        </footer>
      </div>
    </div>
  );
}
