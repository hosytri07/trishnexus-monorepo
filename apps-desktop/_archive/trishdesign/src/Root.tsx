/**
 * Phase 14.4.5 — Root auth gate.
 *
 * 4 trạng thái:
 *   1. loading → LoadingScreen
 *   2. !firebaseUser → LoginScreen
 *   3. profile.role === 'trial' → TrialBlockedScreen
 *   4. user / admin → App (full UI)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { LoginScreen } from './components/LoginScreen.js';
import { TrialBlockedScreen } from './components/TrialBlockedScreen.js';
import { App } from './App.js';

export function Root(): JSX.Element {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  // Block trial users — chỉ user + admin được vào
  const role = profile?.role ?? 'trial';
  if (role === 'trial') {
    return <TrialBlockedScreen />;
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
    <div className="td-boot-screen">
      <div className="td-boot-spinner" />
      <p className="td-boot-text">Đang khởi động TrishDesign…</p>
      {showHint && (
        <p className="td-boot-hint muted small">
          Nếu bị treo, kiểm tra kết nối mạng (cần Firebase) và thử mở lại.
        </p>
      )}
    </div>
  );
}
