'use client';

/**
 * /profile — User profile page (Phase 16.1.e)
 *
 * Hiển thị:
 *   - Avatar + display name + email + role badge (Admin / User / Trial)
 *   - Trial users: form nhập key activation
 *   - Activated date nếu đã activate
 *   - Sign out button
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  LogOut,
  Lock,
} from 'lucide-react';
import {
  doc,
  collection,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
} from 'firebase/auth';
import { auth, db, firebaseReady } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { logActivity } from '@/lib/activity-log';

type ActivateResult =
  | { ok: true; keyId: string }
  | { ok: false; error: string };

async function activateKeyOnFirestore(
  uid: string,
  code: string,
): Promise<ActivateResult> {
  // Wrap entire function trong try/catch — đảm bảo không throw uncaught
  try {
    if (!db) return { ok: false, error: 'Firestore chưa cấu hình' };
    const trimmed = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!trimmed) return { ok: false, error: 'Mã key không được rỗng' };
    if (trimmed.length !== 16) {
      return { ok: false, error: 'Mã key phải đúng 16 ký tự (chữ hoa + số)' };
    }

    // Firestore rules yêu cầu query filter `status == 'active'` để tránh
    // permission-denied (rules engine không cho phép query "có thể" trả về
    // doc không thoả rule, dù thực tế filter exclude — phải explicit).
    const q = query(
      collection(db, 'keys'),
      where('code', '==', trimmed),
      where('status', '==', 'active'),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return {
        ok: false,
        error: 'Mã key không tồn tại hoặc đã được sử dụng',
      };
    }
    const keyDoc = snap.docs[0]!;
    const keyData = keyDoc.data();
    if (
      typeof keyData.expires_at === 'number' &&
      keyData.expires_at > 0 &&
      keyData.expires_at < Date.now()
    ) {
      return { ok: false, error: 'Mã key đã hết hạn' };
    }

    await runTransaction(db, async (tx) => {
      const userRef = doc(db!, 'users', uid);
      const keyRef = doc(db!, 'keys', keyDoc.id);
      const userSnap = await tx.get(userRef);
      const freshKeySnap = await tx.get(keyRef);
      if (!userSnap.exists()) throw new Error('User không tồn tại');
      if (!freshKeySnap.exists()) throw new Error('Key không tồn tại');
      const fresh = freshKeySnap.data();
      if (fresh.status !== 'active') {
        throw new Error('Key đã bị dùng giữa chừng');
      }
      const now = Date.now();
      tx.update(keyRef, {
        status: 'used',
        used_by_uid: uid,
        used_at: now,
      });
      tx.update(userRef, {
        role: 'user',
        key_activated_at: now,
        activated_key_id: keyDoc.id,
      });
    });
    return { ok: true, keyId: keyDoc.id };
  } catch (err) {
    console.error('[profile] activate key fail', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, role, loading, isAuthenticated, isPaid, isTrial, isAdmin, logout, refreshProfile } =
    useAuth();
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  // Phase 16.2.f — Set password cho user login Google (để dùng email + pass trên desktop)
  const [newPass, setNewPass] = useState('');
  const [newPass2, setNewPass2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  /** Detect xem user có phương thức "password" chưa.
   *  - Google-only: providers = ['google.com']
   *  - Đã có pass: providers chứa 'password'
   */
  const fbCurrent = auth?.currentUser ?? null;
  const providers = fbCurrent?.providerData.map((p) => p.providerId) ?? [];
  const hasPassword = providers.includes('password');
  const isGoogleOnly = providers.includes('google.com') && !hasPassword;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  function showToast(msg: string, kind: 'ok' | 'err'): void {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  async function onActivateKey(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (busy || !user) return;
    if (!firebaseReady) {
      showToast('Firebase chưa cấu hình.', 'err');
      return;
    }
    setBusy(true);
    try {
      const result = await activateKeyOnFirestore(user.id, keyInput);
      if (result.ok) {
        void logActivity(user.id, {
          kind: 'key_activated',
          title: `Kích hoạt key ${result.keyId}`,
          meta: { keyId: result.keyId },
        });
        showToast('🎉 Kích hoạt thành công! Bạn đã trở thành User chính thức.', 'ok');
        setKeyInput('');
        await refreshProfile();
      } else {
        showToast(`⚠ ${result.error}`, 'err');
      }
    } catch (err) {
      console.error('[profile] onActivateKey unexpected', err);
      showToast(`⚠ Lỗi: ${err instanceof Error ? err.message : String(err)}`, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onLogout(): Promise<void> {
    await logout();
    router.push('/');
  }

  /**
   * Phase 16.2.f — Đặt mật khẩu cho user Google-only.
   *  - Google-only: link credential email/password → user có thể login email + pass.
   *  - Đã có password (đăng ký bằng email): chỉ updatePassword.
   *
   * Yêu cầu: user vừa login gần đây (<5 min). Nếu credentials cũ → Firebase
   * yêu cầu reauthenticate, lúc đó báo user đăng xuất + login lại.
   */
  async function onSetPassword(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (pwBusy || !user || !fbCurrent) return;
    if (newPass.length < 6) {
      showToast('Mật khẩu phải ≥ 6 ký tự.', 'err');
      return;
    }
    if (newPass !== newPass2) {
      showToast('Mật khẩu nhập lại không khớp.', 'err');
      return;
    }
    setPwBusy(true);
    try {
      if (isGoogleOnly && fbCurrent.email) {
        // Link email/password credential vào Google account
        const cred = EmailAuthProvider.credential(fbCurrent.email, newPass);
        await linkWithCredential(fbCurrent, cred);
        showToast('✓ Đã đặt mật khẩu! Giờ anh có thể login bằng email + pass trên desktop.', 'ok');
      } else {
        // User đã có password → chỉ update
        await updatePassword(fbCurrent, newPass);
        showToast('✓ Đổi mật khẩu thành công.', 'ok');
      }
      void logActivity(user.id, {
        kind: 'profile_update',
        title: isGoogleOnly ? 'Đặt mật khẩu (link email/password)' : 'Đổi mật khẩu',
      });
      setNewPass('');
      setNewPass2('');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        showToast('Phiên login đã quá lâu. Vui lòng đăng xuất và đăng nhập lại để đổi mật khẩu.', 'err');
      } else if (code === 'auth/provider-already-linked') {
        showToast('Tài khoản đã có mật khẩu. Hãy logout, login bằng email + pass cũ.', 'err');
      } else if (code === 'auth/email-already-in-use') {
        showToast('Email này đã có account password riêng. Liên hệ admin để gộp.', 'err');
      } else {
        showToast(`⚠ ${err instanceof Error ? err.message : String(err)}`, 'err');
      }
    } finally {
      setPwBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-page-loading">
        <Loader2 className="spin" size={28} />
        <p>Đang tải…</p>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="profile-page">
      <Link href="/" className="profile-back" aria-label="Về dashboard">
        <ArrowLeft size={18} />
      </Link>

      <div className="profile-card">
        <div className="profile-header">
          {user.photo_url ? (
            <img src={user.photo_url} alt="avatar" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-fallback">
              {user.avatar_initials}
            </div>
          )}
          <div className="profile-info">
            <h1 className="profile-name">{user.name}</h1>
            <p className="profile-email">{user.email}</p>
            <RoleBadge role={role} />
          </div>
        </div>

        {/* Role-specific cards */}
        {isAdmin && (
          <div className="profile-section profile-admin-section">
            <ShieldCheck size={20} />
            <div>
              <strong>Bạn là Administrator</strong>
              <p>Toàn quyền hệ sinh thái TrishTEAM. Quản lý users, keys, content. Vào <Link href="/admin">Admin Panel</Link>.</p>
            </div>
          </div>
        )}

        {isPaid && !isAdmin && (
          <div className="profile-section profile-user-section">
            <Sparkles size={20} />
            <div>
              <strong>Tài khoản User chính thức</strong>
              <p>Bạn có quyền dùng đầy đủ tính năng tất cả app. Đồng bộ data giữa web + desktop.</p>
              {user.key_activated_at && user.key_activated_at > 0 && (
                <p className="profile-activated-date">
                  Kích hoạt lúc:{' '}
                  {new Date(user.key_activated_at).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          </div>
        )}

        {isTrial && (
          <div className="profile-section profile-trial-section">
            <h3>
              <KeyRound size={18} /> Kích hoạt Key để mở khoá đầy đủ
            </h3>
            <p className="muted">
              Bạn đang ở chế độ <strong>Trial</strong> — chỉ xem demo. Nhập mã
              key TrishTEAM để upgrade thành <strong>User</strong> và dùng đầy
              đủ tính năng các app.
            </p>
            <form onSubmit={onActivateKey} className="profile-key-form">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => {
                  // Strip mọi ký tự không phải A-Z 0-9, cap 16. Hiển thị
                  // dạng XXXX-XXXX-XXXX-XXXX (gạch chỉ để dễ đọc).
                  const raw = e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 16);
                  // Format hiển thị có gạch
                  const formatted = raw.match(/.{1,4}/g)?.join('-') ?? raw;
                  setKeyInput(formatted);
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX (16 ký tự)"
                disabled={busy}
                maxLength={19}
                autoComplete="off"
                spellCheck={false}
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  letterSpacing: '0.18em',
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              />
              <button type="submit" disabled={busy || !keyInput.trim()}>
                {busy ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
                {busy ? 'Đang kiểm tra…' : 'Kích hoạt'}
              </button>
            </form>
            <p className="muted small profile-trial-hint">
              💡 Liên hệ <a href="mailto:trishteam.official@gmail.com">trishteam.official@gmail.com</a> hoặc
              Zalo TrishTEAM để được cấp key.
            </p>
          </div>
        )}

        {/* Phase 16.2.f — Đặt/đổi mật khẩu (cho Google user dùng được trên desktop) */}
        <div className="profile-section profile-password-section">
          <h3>
            <Lock size={18} /> {isGoogleOnly ? 'Đặt mật khẩu cho desktop' : 'Đổi mật khẩu'}
          </h3>
          <p className="muted small">
            {isGoogleOnly
              ? '🔑 Anh đăng nhập bằng Google. Trong app desktop (TrishLibrary, TrishDesign...) chỉ login bằng email + mật khẩu được. Đặt mật khẩu ở đây để dùng cùng email Google trên desktop.'
              : 'Đổi mật khẩu hiện tại. Sau khi đổi, các thiết bị khác cần login lại.'}
          </p>
          <form onSubmit={onSetPassword} className="profile-key-form" style={{ marginTop: 12 }}>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mật khẩu mới (≥ 6 ký tự)"
              minLength={6}
              autoComplete="new-password"
              disabled={pwBusy}
              required
            />
            <input
              type="password"
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              minLength={6}
              autoComplete="new-password"
              disabled={pwBusy}
              required
              style={{ marginTop: 8 }}
            />
            <button
              type="submit"
              disabled={pwBusy || newPass.length < 6 || newPass !== newPass2}
              style={{ marginTop: 8 }}
            >
              {pwBusy ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
              {pwBusy ? 'Đang xử lý…' : isGoogleOnly ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>

        <div className="profile-section profile-actions">
          <button type="button" className="profile-logout" onClick={() => void onLogout()}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </div>

      {toast && (
        <div className={`profile-toast profile-toast-${toast.kind}`} role="status">
          {toast.msg}
        </div>
      )}

      <style jsx>{`
        .profile-page {
          min-height: calc(100vh - 60px);
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }
        .profile-page-loading {
          min-height: calc(100vh - 60px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: var(--color-text-muted);
        }
        :global(.spin) {
          animation: profile-spin 1s linear infinite;
        }
        @keyframes profile-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .profile-back {
          position: absolute;
          top: 24px;
          left: 24px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: all 0.2s;
        }
        .profile-back:hover {
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
        }
        .profile-card {
          width: 100%;
          max-width: 720px;
          background: var(--color-surface-bg_elevated);
          border: 1px solid var(--color-border-subtle);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }
        .profile-header {
          display: flex;
          gap: 20px;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .profile-avatar,
        .profile-avatar-fallback {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 28px;
          flex-shrink: 0;
        }
        .profile-name {
          margin: 0 0 4px;
          font-size: 1.4rem;
          color: var(--color-text-primary);
        }
        .profile-email {
          margin: 0 0 8px;
          font-size: 0.9rem;
          color: var(--color-text-muted);
        }
        .profile-section {
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 14px;
        }
        .profile-admin-section {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: var(--color-text-primary);
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .profile-admin-section a {
          color: rgb(196, 124, 255);
          font-weight: 600;
        }
        .profile-user-section {
          background: rgba(74, 222, 128, 0.1);
          border: 1px solid rgba(74, 222, 128, 0.3);
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .profile-trial-section {
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.3);
        }
        .profile-trial-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 8px;
          color: rgb(252, 211, 77);
          font-size: 1.05rem;
        }
        .profile-key-form {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }
        .profile-key-form input {
          flex: 1;
          padding: 12px 14px;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border-subtle);
          border-radius: 10px;
          color: var(--color-text-primary);
          font-family: var(--font-mono, monospace);
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        .profile-key-form input:focus {
          border-color: var(--color-accent-primary);
        }
        .profile-key-form button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 12px 20px;
          background: var(--color-accent-gradient, var(--color-accent-primary));
          color: #0b1020;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .profile-key-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .profile-trial-hint {
          margin-top: 12px;
        }
        .profile-trial-hint a {
          color: var(--color-accent-primary);
        }
        .profile-activated-date {
          margin-top: 6px;
          font-size: 0.85rem;
          color: var(--color-text-muted);
          font-style: italic;
        }
        .muted {
          color: var(--color-text-muted);
          font-size: 0.9rem;
          margin: 0 0 8px;
        }
        .small {
          font-size: 0.8rem;
        }
        .profile-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--color-border-subtle);
        }
        .profile-logout {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: transparent;
          color: var(--color-text-muted);
          border: 1px solid var(--color-border-default);
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .profile-logout:hover {
          background: rgba(239, 68, 68, 0.1);
          color: rgb(252, 165, 165);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .profile-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }
        .profile-toast-ok {
          background: var(--color-accent-primary);
          color: #0b1020;
        }
        .profile-toast-err {
          background: rgb(239, 68, 68);
          color: white;
        }
      `}</style>
    </div>
  );
}

function RoleBadge({ role }: { role: string }): JSX.Element {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    admin: { label: '🛡 Administrator', color: 'rgb(196, 124, 255)', bg: 'rgba(168, 85, 247, 0.15)' },
    user: { label: '✨ User', color: 'rgb(74, 222, 128)', bg: 'rgba(74, 222, 128, 0.15)' },
    trial: { label: '⏳ Trial', color: 'rgb(252, 211, 77)', bg: 'rgba(251, 191, 36, 0.15)' },
    guest: { label: '👤 Guest', color: 'rgb(148, 163, 184)', bg: 'rgba(148, 163, 184, 0.15)' },
  };
  const c = config[role] ?? config.guest!;
  return (
    <span
      className="role-badge"
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}
