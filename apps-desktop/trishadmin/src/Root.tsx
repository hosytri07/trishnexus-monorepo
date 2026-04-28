/**
 * Phase 18.7.a — Root component cho TrishAdmin.
 *
 * Auth gate 3 tầng:
 *   1. loading → spinner
 *   2. !firebaseUser → AdminLogin
 *   3. firebaseUser nhưng email KHÔNG nằm trong ADMIN_EMAILS → AdminBlocked
 *      (force sign out — không leak admin app cho user thường)
 *   4. email là admin → App
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { AdminLogin } from './components/AdminLogin.js';
import { AdminBlocked } from './components/AdminBlocked.js';
import { App } from './App.js';
import { isAdminEmail } from './lib/admin-emails.js';

export function Root(): JSX.Element {
  const { loading, firebaseUser } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return <AdminLogin />;
  }

  // CRITICAL — chỉ admin email được vào. User thường login qua app khác
  // mà mở TrishAdmin (vì nó hidden không hiện trên launcher) sẽ thấy block.
  const email = firebaseUser.email;
  if (!isAdminEmail(email)) {
    return <AdminBlocked email={email ?? null} />;
  }

  return <App />;
}

function LoadingScreen(): JSX.Element {
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="boot-screen">
      <div className="boot-spinner" />
      <p className="boot-text">Đang khởi động TrishAdmin…</p>
      {showHint && (
        <p className="boot-hint">
          Nếu bị treo, kiểm tra kết nối mạng (cần Firebase) và thử mở lại.
        </p>
      )}
    </div>
  );
}
