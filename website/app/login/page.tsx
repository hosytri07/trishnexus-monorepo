'use client';

/**
 * /login — Login + Register (Phase 11.6.3 — wire Firebase Auth thật).
 *
 * Cấu trúc:
 *   .auth-container (toggle `is-active` để slide):
 *     ├── sign-up-container (Họ và tên, Tên hiển thị, Email, SĐT, Mật khẩu)
 *     ├── sign-in-container (Email, Mật khẩu, Forgot, Google OAuth)
 *     └── overlay-container (greeting + switch button)
 *
 * Logic:
 *   - firebaseReady=true → createUserWithEmailAndPassword + Firestore
 *     /users/{uid} ghi {fullName, displayName, email, phone, role:'user'}.
 *   - firebaseReady=false → toast "Chưa cấu hình Firebase, add env vars…".
 *   - Google OAuth: signInWithPopup(GoogleAuthProvider).
 *   - Forgot: sendPasswordResetEmail → toast nhắc kiểm tra email.
 *   - Sau khi auth OK → redirect /.
 */
import { useState, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Facebook,
  Github,
  Linkedin,
  Mail,
  ArrowLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  type AuthError,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseReady } from '@/lib/firebase';
import { logActivity } from '@/lib/activity-log';

/** Map Firebase error codes → message tiếng Việt. */
function errMsg(err: unknown): string {
  const code = (err as AuthError)?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/user-disabled': 'Tài khoản này đã bị khoá.',
    'auth/user-not-found': 'Không tìm thấy tài khoản.',
    'auth/wrong-password': 'Sai mật khẩu.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/email-already-in-use': 'Email này đã được đăng ký.',
    'auth/weak-password': 'Mật khẩu cần tối thiểu 6 ký tự.',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google.',
    'auth/network-request-failed': 'Lỗi mạng, thử lại.',
    'auth/too-many-requests': 'Quá nhiều lần thử, tạm khoá 15 phút.',
  };
  if (code && map[code]) return map[code];
  return (err as Error)?.message ?? 'Có lỗi xảy ra, thử lại.';
}

export default function LoginPage() {
  const router = useRouter();
  const [active, setActive] = useState(false); // false = Login, true = Register
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Refs để lấy value từ form mà không cần controlled state
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const loginPassRef = useRef<HTMLInputElement>(null);
  const regFullRef = useRef<HTMLInputElement>(null);
  const regDisplayRef = useRef<HTMLInputElement>(null);
  const regEmailRef = useRef<HTMLInputElement>(null);
  const regPhoneRef = useRef<HTMLInputElement>(null);
  const regPassRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('Chưa cấu hình Firebase. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local.');
      return;
    }
    const email = loginEmailRef.current?.value.trim() ?? '';
    const pass = loginPassRef.current?.value ?? '';
    if (!email || !pass) return;
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      // fire-and-forget activity log (Phase 11.7.3)
      void logActivity(cred.user.uid, {
        kind: 'login',
        title: 'Đăng nhập bằng email',
        meta: { method: 'password' },
      });
      showToast('Đăng nhập thành công, đang chuyển về dashboard…');
      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      showToast(errMsg(err));
      setBusy(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firebaseReady || !auth || !db) {
      showToast('Chưa cấu hình Firebase. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local.');
      return;
    }
    const fullName = regFullRef.current?.value.trim() ?? '';
    const displayName = regDisplayRef.current?.value.trim() ?? '';
    const email = regEmailRef.current?.value.trim() ?? '';
    const phone = regPhoneRef.current?.value.trim() ?? '';
    const pass = regPassRef.current?.value ?? '';
    if (!fullName || !displayName || !email || !phone || !pass) return;
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName });
      // Ghi profile mở rộng vào Firestore /users/{uid}
      await setDoc(doc(db, 'users', cred.user.uid), {
        id: cred.user.uid,
        name: displayName,
        fullName,
        email,
        phone,
        role: 'user',
        plan: 'Free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Phase 11.7.3 — log cả register + login đầu tiên.
      void logActivity(cred.user.uid, {
        kind: 'register',
        title: `Tạo tài khoản mới (${displayName})`,
        meta: { method: 'password' },
      });
      showToast('Tạo tài khoản thành công! Đang chuyển về dashboard…');
      setTimeout(() => router.push('/'), 1000);
    } catch (err) {
      showToast(errMsg(err));
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('Chưa cấu hình Firebase. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local.');
      return;
    }
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      void logActivity(cred.user.uid, {
        kind: 'login',
        title: 'Đăng nhập bằng Google',
        meta: { method: 'google' },
      });
      showToast('Đăng nhập Google OK, đang chuyển về dashboard…');
      setTimeout(() => router.push('/'), 900);
    } catch (err) {
      showToast(errMsg(err));
      setBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('Chưa cấu hình Firebase. Thêm NEXT_PUBLIC_FIREBASE_* vào .env.local.');
      return;
    }
    const email = loginEmailRef.current?.value.trim() ?? '';
    if (!email) {
      showToast('Nhập email ở ô trên trước khi bấm "Quên mật khẩu?".');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('Đã gửi email đặt lại mật khẩu. Check inbox + spam.');
    } catch (err) {
      showToast(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Phase 11.5.24b — đơn giản lại: chỉ một nút back tròn, hover scale. */}
      <Link href="/" className="auth-back" aria-label="Về dashboard TrishTEAM">
        <ArrowLeft size={18} strokeWidth={2.25} aria-hidden="true" />
      </Link>

      <div className={`auth-container${active ? ' is-active' : ''}`}>
        {/* ============ REGISTER (sign-up) ============ */}
        <div className="form-container sign-up-container">
          <form onSubmit={onRegister}>
            <h1>Đăng ký</h1>
            <div className="social-container">
              <button type="button" aria-label="Google" onClick={onGoogle} disabled={busy}>
                <Mail size={16} />
              </button>
              <a href="#" aria-label="Facebook" onClick={(e) => { e.preventDefault(); showToast('Facebook OAuth: chưa bật provider — add vào Firebase Console.'); }}><Facebook size={16} /></a>
              <a href="#" aria-label="GitHub" onClick={(e) => { e.preventDefault(); showToast('GitHub OAuth: chưa bật provider — add vào Firebase Console.'); }}><Github size={16} /></a>
              <a href="#" aria-label="LinkedIn" onClick={(e) => { e.preventDefault(); showToast('LinkedIn OAuth: chưa hỗ trợ native Firebase (dùng custom token).'); }}><Linkedin size={16} /></a>
            </div>
            <span className="muted">hoặc dùng email để đăng ký</span>
            <input ref={regFullRef} type="text" name="fullname" placeholder="Họ và tên" required autoComplete="name" disabled={busy} />
            <input ref={regDisplayRef} type="text" name="displayName" placeholder="Tên hiển thị" required autoComplete="nickname" disabled={busy} />
            <input ref={regEmailRef} type="email" name="email" placeholder="Email" required autoComplete="email" disabled={busy} />
            <input ref={regPhoneRef} type="tel" name="phone" placeholder="Số điện thoại" required autoComplete="tel" pattern="[0-9+\-\s]{9,15}" disabled={busy} />
            <input ref={regPassRef} type="password" name="password" placeholder="Mật khẩu (≥ 6 ký tự)" required autoComplete="new-password" minLength={6} disabled={busy} />
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? <Loader2 size={13} className="spin" /> : null}
              {busy ? 'Đang xử lý…' : 'Đăng ký'}
            </button>
          </form>
        </div>

        {/* ============ LOGIN (sign-in) ============ */}
        <div className="form-container sign-in-container">
          <form onSubmit={onLogin}>
            <h1>Đăng nhập</h1>
            <div className="social-container">
              <button type="button" aria-label="Google" onClick={onGoogle} disabled={busy}>
                <Mail size={16} />
              </button>
              <a href="#" aria-label="Facebook" onClick={(e) => { e.preventDefault(); showToast('Facebook OAuth: chưa bật provider — add vào Firebase Console.'); }}><Facebook size={16} /></a>
              <a href="#" aria-label="GitHub" onClick={(e) => { e.preventDefault(); showToast('GitHub OAuth: chưa bật provider — add vào Firebase Console.'); }}><Github size={16} /></a>
              <a href="#" aria-label="LinkedIn" onClick={(e) => { e.preventDefault(); showToast('LinkedIn OAuth: chưa hỗ trợ native Firebase (dùng custom token).'); }}><Linkedin size={16} /></a>
            </div>
            <span className="muted">hoặc dùng tài khoản của bạn</span>
            <input ref={loginEmailRef} type="email" placeholder="Email" required autoComplete="email" disabled={busy} />
            <input ref={loginPassRef} type="password" placeholder="Mật khẩu" required autoComplete="current-password" disabled={busy} />
            <a href="#" className="forgot" onClick={onForgot}>Quên mật khẩu?</a>
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? <Loader2 size={13} className="spin" /> : null}
              {busy ? 'Đang xử lý…' : 'Đăng nhập'}
            </button>
          </form>
        </div>

        {/* ============ OVERLAY (greeting panel) ============ */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <div className="overlay-brand">
                <Sparkles size={22} strokeWidth={2.25} />
                <span>TrishTEAM</span>
              </div>
              <h1>Chào mừng trở lại!</h1>
              <p>
                Đăng nhập để đồng bộ quiz lái xe, chứng chỉ XD, notes và
                theme giữa desktop ↔ web.
              </p>
              <button className="ghost" type="button" onClick={() => setActive(false)}>
                Đăng nhập
              </button>
            </div>
            <div className="overlay-panel overlay-right">
              <div className="overlay-brand">
                <Sparkles size={22} strokeWidth={2.25} />
                <span>TrishTEAM</span>
              </div>
              <h1>Xin chào bạn mới!</h1>
              <p>
                Tạo tài khoản để lưu tiến độ ôn thi, đồng bộ bookmark, và
                nhận thông báo khi có update nội dung.
              </p>
              <button className="ghost" type="button" onClick={() => setActive(true)}>
                Đăng ký
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="auth-toast" role="status">{toast}</div>}

      <style jsx>{`
        .auth-page {
          min-height: calc(100vh - 60px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }
        /* ------------------------------------------------------------------
         * auth-back (Phase 11.5.24b) — nút back tròn đơn giản.
         *   User feedback: "Phần back về dashboard để nút back thôi có
         *   hiệu ứng là được rồi, rắc rối quá".
         *   → Single ArrowLeft icon trong circle 40px, hover scale + slide
         *     trái nhẹ, màu accent gradient khi hover.
         * ------------------------------------------------------------------ */
        .auth-back {
          position: absolute;
          top: 20px;
          left: 22px;
          z-index: 10;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-primary);
          text-decoration: none;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
          transition:
            transform 0.22s cubic-bezier(0.2, 0, 0, 1),
            background 0.22s ease,
            color 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }
        .auth-back:hover {
          transform: translateX(-3px) scale(1.08);
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
          border-color: transparent;
          box-shadow: 0 10px 24px rgba(74, 222, 128, 0.36);
        }
        .auth-back:active {
          transform: translateX(-2px) scale(1.02);
        }
        .auth-container {
          position: relative;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: 20px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
          overflow: hidden;
          width: 860px;
          max-width: 100%;
          min-height: 560px;
        }
        .form-container {
          position: absolute;
          top: 0;
          height: 100%;
          transition: all 0.6s ease-in-out;
        }
        .sign-in-container {
          left: 0;
          width: 50%;
          z-index: 2;
        }
        .auth-container.is-active .sign-in-container {
          transform: translateX(100%);
        }
        .sign-up-container {
          left: 0;
          width: 50%;
          opacity: 0;
          z-index: 1;
        }
        .auth-container.is-active .sign-up-container {
          transform: translateX(100%);
          opacity: 1;
          z-index: 5;
          animation: auth-show 0.6s;
        }
        @keyframes auth-show {
          0%,
          49.99% {
            opacity: 0;
            z-index: 1;
          }
          50%,
          100% {
            opacity: 1;
            z-index: 5;
          }
        }
        .form-container :global(form) {
          background: var(--color-surface-bg_elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 0 44px;
          height: 100%;
          text-align: center;
        }
        .form-container :global(h1) {
          font-weight: 700;
          margin-bottom: 18px;
          color: var(--color-text-primary);
          font-size: 1.9rem;
        }
        .muted {
          font-size: 12px;
          color: var(--color-text-muted);
          margin-bottom: 14px;
        }
        .social-container {
          margin: 18px 0 4px;
        }
        .social-container :global(a),
        .social-container :global(button) {
          border: 1px solid var(--color-border-default);
          border-radius: 50%;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          margin: 0 6px;
          height: 38px;
          width: 38px;
          color: var(--color-text-secondary);
          text-decoration: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.25s;
        }
        .social-container :global(a:hover),
        .social-container :global(button:hover:not(:disabled)) {
          background: var(--color-accent-primary);
          border-color: var(--color-accent-primary);
          color: #0b1020;
          transform: translateY(-2px);
        }
        .social-container :global(button:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }
        :global(.spin) {
          animation: auth-spin 1s linear infinite;
          margin-right: 6px;
        }
        @keyframes auth-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .form-container :global(input) {
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-subtle);
          padding: 12px 15px;
          margin: 8px 0;
          width: 100%;
          border-radius: 10px;
          color: var(--color-text-primary);
          outline: none;
          font-family: inherit;
          font-size: 13px;
          transition: border-color 0.25s, background 0.25s;
        }
        .form-container :global(input:focus) {
          border-color: var(--color-accent-primary);
          background: var(--color-surface-bg);
        }
        .form-container :global(input::placeholder) {
          color: var(--color-text-muted);
        }
        .forgot {
          color: var(--color-text-muted);
          font-size: 12px;
          text-decoration: none;
          margin: 14px 0 10px;
          transition: color 0.25s;
        }
        .forgot:hover {
          color: var(--color-accent-primary);
        }
        .auth-submit {
          border-radius: 999px;
          border: none;
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
          font-size: 12px;
          font-weight: 700;
          padding: 12px 48px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          margin-top: 10px;
          font-family: inherit;
          transition: transform 0.12s ease-in, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 6px 16px rgba(74, 222, 128, 0.25);
        }
        .auth-submit:hover {
          box-shadow: 0 10px 24px rgba(74, 222, 128, 0.4);
        }
        .auth-submit:active {
          transform: scale(0.96);
        }
        .auth-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        .overlay-container {
          position: absolute;
          top: 0;
          left: 50%;
          width: 50%;
          height: 100%;
          overflow: hidden;
          transition: transform 0.6s ease-in-out;
          z-index: 100;
        }
        .auth-container.is-active .overlay-container {
          transform: translateX(-100%);
        }
        .overlay {
          background:
            radial-gradient(
              ellipse at 30% 20%,
              rgba(255, 255, 255, 0.12),
              transparent 55%
            ),
            var(--color-accent-gradient, linear-gradient(135deg, #4ade80, #10b981));
          background-repeat: no-repeat;
          background-size: cover;
          color: #0b1020;
          position: relative;
          left: -100%;
          height: 100%;
          width: 200%;
          transform: translateX(0);
          transition: transform 0.6s ease-in-out;
        }
        .auth-container.is-active .overlay {
          transform: translateX(50%);
        }
        .overlay-panel {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 0 44px;
          text-align: center;
          top: 0;
          height: 100%;
          width: 50%;
          transform: translateX(0);
          transition: transform 0.6s ease-in-out;
          color: #0b1020;
        }
        .overlay-panel :global(h1) {
          color: #0b1020;
          font-size: 1.8rem;
          margin-bottom: 14px;
        }
        .overlay-panel :global(p) {
          font-size: 13px;
          line-height: 20px;
          letter-spacing: 0.01em;
          margin: 8px 0 26px;
          opacity: 0.82;
        }
        .overlay-brand {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-bottom: 18px;
          font-size: 14px;
        }
        .overlay-left {
          transform: translateX(-20%);
        }
        .auth-container.is-active .overlay-left {
          transform: translateX(0);
        }
        .overlay-right {
          right: 0;
          transform: translateX(0);
        }
        .auth-container.is-active .overlay-right {
          transform: translateX(20%);
        }
        .overlay-panel :global(button.ghost) {
          background: transparent;
          border: 1.5px solid rgba(11, 16, 32, 0.7);
          color: #0b1020;
          border-radius: 999px;
          padding: 11px 42px;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .overlay-panel :global(button.ghost:hover) {
          background: rgba(11, 16, 32, 0.12);
          transform: translateY(-1px);
        }
        .auth-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 22px;
          border-radius: 10px;
          color: #0b1020;
          background: var(--color-accent-primary);
          box-shadow: 0 6px 20px rgba(74, 222, 128, 0.4);
          z-index: 1000;
          font-size: 13px;
          font-weight: 500;
          animation: auth-slide-in 0.28s ease-out;
        }
        @keyframes auth-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* ============ Responsive — mobile xếp dọc ============ */
        @media (max-width: 768px) {
          .auth-container {
            width: 100%;
            max-width: 460px;
            display: flex;
            flex-direction: column;
            min-height: auto;
          }
          .form-container {
            width: 100%;
            padding: 24px 0;
            position: relative;
            transform: none;
            justify-content: center;
          }
          .sign-up-container,
          .sign-in-container {
            display: none;
          }
          .auth-container:not(.is-active) .sign-in-container {
            display: flex;
            opacity: 1;
            z-index: 5;
          }
          .auth-container.is-active .sign-up-container {
            display: flex;
            opacity: 1;
            z-index: 5;
            transform: none;
          }
          .overlay-container {
            position: relative;
            width: 100%;
            left: 0;
            transform: none;
            z-index: 10;
            background: var(--color-surface-bg_elevated);
            padding-bottom: 28px;
          }
          .auth-container.is-active .overlay-container {
            transform: none;
          }
          .overlay {
            width: 100%;
            left: 0;
            transform: none;
            background: none;
            color: var(--color-text-primary);
          }
          .auth-container.is-active .overlay {
            transform: none;
          }
          .overlay-panel {
            width: 100%;
            position: relative;
            transform: none;
            padding: 12px 20px;
            display: none;
            color: var(--color-text-primary);
          }
          .overlay-panel :global(h1),
          .overlay-panel :global(p),
          .overlay-brand {
            display: none;
          }
          .auth-container:not(.is-active) .overlay-right,
          .auth-container.is-active .overlay-left {
            display: flex;
          }
          .overlay-panel :global(button.ghost) {
            border: 1.5px solid var(--color-accent-primary);
            color: var(--color-accent-primary);
            max-width: 280px;
          }
        }
      `}</style>
    </div>
  );
}
