'use client';

/**
 * /login — Phase 78.7 Brutalist Login/Register.
 *
 * Single form với toggle tab Sign In / Sign Up.
 * Query param `?mode=signup` → mở mode đăng ký mặc định.
 */
import { useState, useRef, useEffect, type FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, LogIn, UserPlus, Mail, KeyRound, User, Phone, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
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

const REMEMBER_KEY = 'trishteam:remember_email';

/** Google brand "G" logo SVG. */
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function errMsg(err: unknown): string {
  const code = (err as AuthError)?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/user-disabled': 'Tài khoản bị khoá.',
    'auth/user-not-found': 'Không tìm thấy tài khoản.',
    'auth/wrong-password': 'Sai mật khẩu.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/email-already-in-use': 'Email đã được đăng ký.',
    'auth/weak-password': 'Mật khẩu cần tối thiểu 6 ký tự.',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ Google.',
    'auth/network-request-failed': 'Lỗi mạng, thử lại.',
    'auth/too-many-requests': 'Quá nhiều lần thử, tạm khoá 15 phút.',
  };
  if (code && map[code]) return map[code];
  return (err as Error)?.message ?? 'Có lỗi xảy ra.';
}

function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialMode = sp.get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err' | 'info'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // Refs
  const inEmail = useRef<HTMLInputElement>(null);
  const inPass = useRef<HTMLInputElement>(null);
  const inFullName = useRef<HTMLInputElement>(null);
  const inDisplay = useRef<HTMLInputElement>(null);
  const inPhone = useRef<HTMLInputElement>(null);

  // Prefill email từ localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved && inEmail.current) {
        inEmail.current.value = saved;
        setRemember(true);
      }
    } catch { /* ignore */ }
  }, []);

  function showToast(kind: 'ok' | 'err' | 'info', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function persistEmail(value: string) {
    try {
      if (remember && value.trim()) {
        window.localStorage.setItem(REMEMBER_KEY, value.trim());
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    } catch { /* ignore */ }
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('err', 'Chưa cấu hình Firebase.');
      return;
    }
    const email = inEmail.current?.value.trim() ?? '';
    const pass = inPass.current?.value ?? '';
    if (!email || !pass) return;
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      persistEmail(email);
      void logActivity(cred.user.uid, {
        kind: 'login',
        title: 'Đăng nhập bằng email',
        meta: { method: 'password' },
      });
      showToast('ok', 'Đăng nhập thành công, đang chuyển hướng…');
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err) {
      showToast('err', errMsg(err));
      setBusy(false);
    }
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firebaseReady || !auth || !db) {
      showToast('err', 'Chưa cấu hình Firebase.');
      return;
    }
    const fullName = inFullName.current?.value.trim() ?? '';
    const displayName = inDisplay.current?.value.trim() ?? '';
    const email = inEmail.current?.value.trim() ?? '';
    const phone = inPhone.current?.value.trim() ?? '';
    const pass = inPass.current?.value ?? '';
    if (!fullName || !displayName || !email || !pass) {
      showToast('err', 'Điền đầy đủ Họ tên, Tên hiển thị, Email, Mật khẩu.');
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName });
      const now = Date.now();
      await setDoc(doc(db, 'users', cred.user.uid), {
        id: cred.user.uid,
        display_name: displayName,
        fullName,
        email,
        phone: phone || null,
        role: 'trial',
        provider: 'password',
        key_activated_at: 0,
        created_at: now,
        last_login_at: now,
        _server_created_at: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      try {
        const { sendEmailVerification } = await import('firebase/auth');
        await sendEmailVerification(cred.user);
      } catch { /* ignore */ }
      void logActivity(cred.user.uid, {
        kind: 'register',
        title: `Tạo tài khoản mới (${displayName})`,
        meta: { method: 'password', role: 'trial' },
      });
      showToast('ok', 'Tạo tài khoản OK! Email xác thực đã gửi.');
      setTimeout(() => router.push('/profile'), 1200);
    } catch (err) {
      showToast('err', errMsg(err));
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('err', 'Chưa cấu hình Firebase.');
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
      showToast('ok', 'Đăng nhập Google OK, đang chuyển hướng…');
      setTimeout(() => router.push('/dashboard'), 800);
    } catch (err) {
      showToast('err', errMsg(err));
      setBusy(false);
    }
  }

  async function onForgot() {
    if (busy) return;
    if (!firebaseReady || !auth) {
      showToast('err', 'Chưa cấu hình Firebase.');
      return;
    }
    const email = inEmail.current?.value.trim() ?? '';
    if (!email) {
      showToast('info', 'Nhập email ở ô trên trước khi bấm "Quên mật khẩu".');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('ok', 'Đã gửi email đặt lại mật khẩu. Check inbox + spam.');
    } catch (err) {
      showToast('err', errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const isSignIn = mode === 'signin';

  return (
    <main
      className="bru"
      style={{
        minHeight: 'calc(100vh - 80px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px var(--bru-page-px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--bru-bg-elevated)',
          border: '2px solid var(--bru-border-strong)',
          boxShadow: '6px 6px 0 var(--bru-accent)',
          padding: 'clamp(20px, 2.5vw, 32px)',
        }}
      >
        {/* Header */}
        <div className="bru-eyebrow" style={{ marginBottom: 6, fontSize: 12 }}>
          // {isSignIn ? 'Đăng nhập' : 'Đăng ký mới'}
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4 }}>
          {isSignIn ? (
            <>
              CHÀO MỪNG <span className="bru-accent">TRỞ LẠI.</span>
            </>
          ) : (
            <>
              TẠO <span className="bru-accent">TÀI KHOẢN.</span>
            </>
          )}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--bru-fg-dim)', marginBottom: 16 }}>
          {isSignIn
            ? 'Đăng nhập để truy cập dashboard + 3 app desktop.'
            : 'Đăng ký miễn phí. Không thẻ tín dụng. Sync web + desktop.'}
        </p>

        {/* Toggle */}
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--bru-border-strong)',
            borderRadius: 4,
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('signin')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: isSignIn ? 'var(--bru-accent)' : 'transparent',
              color: isSignIn ? 'var(--bru-accent-fg)' : 'var(--bru-fg-dim)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <LogIn size={13} strokeWidth={2.5} />
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: !isSignIn ? 'var(--bru-accent)' : 'transparent',
              color: !isSignIn ? 'var(--bru-accent-fg)' : 'var(--bru-fg-dim)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <UserPlus size={13} strokeWidth={2.5} />
            Đăng ký
          </button>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={() => void onGoogle()}
          disabled={busy}
          className="bru-btn bru-btn-sm"
          style={{ width: '100%', justifyContent: 'center', marginBottom: 10, fontSize: 13, padding: '10px 16px' }}
        >
          <GoogleIcon size={15} />
          {isSignIn ? 'Đăng nhập với Google' : 'Đăng ký với Google'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--bru-border)' }} />
          <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 11 }}>
            HOẶC EMAIL
          </span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--bru-border)' }} />
        </div>

        {/* Form */}
        <form
          onSubmit={isSignIn ? onSignIn : onSignUp}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {!isSignIn && (
            <>
              <BruField icon={User} placeholder="Họ và tên *" type="text" name="fullname" required autoComplete="name" disabled={busy} refEl={inFullName} />
              <BruField icon={User} placeholder="Tên hiển thị *" type="text" name="displayName" required autoComplete="nickname" disabled={busy} refEl={inDisplay} />
            </>
          )}
          <BruField icon={Mail} placeholder="Email *" type="email" name="email" required autoComplete="email" disabled={busy} refEl={inEmail} />
          {!isSignIn && (
            <BruField icon={Phone} placeholder="Số điện thoại (tùy chọn)" type="tel" name="phone" autoComplete="tel" disabled={busy} refEl={inPhone} />
          )}
          <div style={{ position: 'relative' }}>
            <BruField
              icon={KeyRound}
              placeholder={isSignIn ? 'Mật khẩu *' : 'Mật khẩu (≥ 6 ký tự) *'}
              type={showPass ? 'text' : 'password'}
              name="password"
              required
              minLength={isSignIn ? undefined : 6}
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              disabled={busy}
              refEl={inPass}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--bru-fg-muted)',
                padding: 4,
              }}
              tabIndex={-1}
              aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {isSignIn && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: 'var(--bru-accent)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--bru-fg-dim)' }}>
                  Ghi nhớ email
                </span>
              </label>
              <button
                type="button"
                onClick={() => void onForgot()}
                disabled={busy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--bru-accent)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  fontFamily: 'inherit',
                }}
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="bru-btn bru-btn-primary"
            style={{ justifyContent: 'center', marginTop: 6, padding: '14px 22px', fontSize: 14 }}
          >
            {busy ? <Loader2 size={15} className="spin" /> : isSignIn ? <LogIn size={15} strokeWidth={2.5} /> : <UserPlus size={15} strokeWidth={2.5} />}
            {busy ? 'Đang xử lý…' : isSignIn ? 'Đăng nhập' : 'Tạo tài khoản'}
            {!busy && <ArrowRight size={15} strokeWidth={2.5} />}
          </button>
        </form>

        {/* Switch CTA + back home — gọn 1 dòng */}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 14, borderTop: '1px solid var(--bru-border)' }}>
          <p style={{ fontSize: 12, color: 'var(--bru-fg-dim)', margin: 0 }}>
            {isSignIn ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button
              type="button"
              onClick={() => setMode(isSignIn ? 'signup' : 'signin')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--bru-accent)',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {isSignIn ? 'Đăng ký miễn phí' : 'Đăng nhập'}
            </button>
          </p>
          <Link href="/" className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 11, textDecoration: 'none' }}>
            ← Trang chủ
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bru-bg-elevated)',
            border: `2px solid ${toast.kind === 'ok' ? '#34D399' : toast.kind === 'err' ? '#F87171' : 'var(--bru-accent)'}`,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 420,
            boxShadow: `4px 4px 0 ${toast.kind === 'ok' ? '#34D399' : toast.kind === 'err' ? '#F87171' : 'var(--bru-accent)'}`,
            zIndex: 100,
            animation: 'bru-fade-up 200ms ease both',
          }}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 size={16} strokeWidth={2.5} style={{ color: '#34D399' }} />
          ) : toast.kind === 'err' ? (
            <AlertCircle size={16} strokeWidth={2.5} style={{ color: '#F87171' }} />
          ) : (
            <AlertCircle size={16} strokeWidth={2.5} style={{ color: 'var(--bru-accent)' }} />
          )}
          <span style={{ fontSize: 13, color: 'var(--bru-fg)' }}>{toast.msg}</span>
        </div>
      )}

      <style>{`
        .spin { animation: bru-spin 700ms linear infinite; }
        @keyframes bru-spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}

// Input field component with icon
function BruField({
  icon: Icon,
  placeholder,
  type,
  name,
  required,
  autoComplete,
  disabled,
  minLength,
  refEl,
}: {
  icon: typeof Mail;
  placeholder: string;
  type: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  minLength?: number;
  refEl: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon
        size={14}
        strokeWidth={2}
        style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--bru-fg-muted)',
          pointerEvents: 'none',
        }}
      />
      <input
        ref={refEl}
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        minLength={minLength}
        style={{
          width: '100%',
          padding: '10px 12px 10px 34px',
          border: '2px solid var(--bru-border)',
          borderRadius: 4,
          background: 'var(--bru-bg)',
          color: 'var(--bru-fg)',
          fontSize: 14,
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 120ms',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--bru-accent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--bru-border)';
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: 'calc(100vh - 80px)' }} />}>
      <LoginContent />
    </Suspense>
  );
}
