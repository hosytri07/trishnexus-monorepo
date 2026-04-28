/**
 * Phase 18.7.a — AdminBlocked screen.
 *
 * User login Firebase OK nhưng email KHÔNG nằm trong ADMIN_EMAILS list.
 * Hiện thông báo + force sign out. Không cho thử lại với account khác.
 */

import { useEffect } from 'react';
import { useAuth } from '@trishteam/auth/react';

interface Props {
  email: string | null;
}

export function AdminBlocked({ email }: Props): JSX.Element {
  const { signOut } = useAuth();

  // Auto sign out sau 4 giây để user phải login lại
  useEffect(() => {
    const t = setTimeout(() => {
      void signOut();
    }, 4000);
    return () => clearTimeout(t);
  }, [signOut]);

  return (
    <div className="blocked-screen">
      <div className="blocked-card">
        <span className="blocked-icon">🚫</span>
        <h1>Không có quyền truy cập</h1>
        <p>
          Tài khoản <code>{email ?? '(không có email)'}</code> không phải admin
          của hệ sinh thái TrishTEAM.
        </p>
        <p className="muted small">
          Đang đăng xuất tự động trong 4 giây…
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void signOut()}
        >
          Đăng xuất ngay
        </button>
      </div>
    </div>
  );
}
