/**
 * Phase 17.2 — Root component cho TrishNote: gate auth.
 *
 * - Loading → spinner
 * - Chưa login → LoginScreen
 * - Trial (chưa activate key) → TrialBlockedScreen
 * - User/Admin → App
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { App } from './App.js';
import { LoginScreen } from './components/LoginScreen.js';
import { TrialBlockedScreen } from './components/TrialBlockedScreen.js';

export function Root(): JSX.Element {
  const { loading, firebaseUser, profile, isTrial, isPaid } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--bg, #0f1115)',
          color: 'var(--muted, #9ca3af)',
        }}
      >
        <div className="spinner" />
        <p>Đang khởi động…</p>
        <style>{`
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(255,255,255,0.12);
            border-top-color: #0891b2;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  if (!profile) {
    return <ProfileLoadingScreen />;
  }

  if (isTrial || !isPaid) {
    return <TrialBlockedScreen />;
  }

  return <App />;
}

function ProfileLoadingScreen(): JSX.Element {
  const { signOut } = useAuth();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 14,
        background: 'var(--bg, #0f1115)',
        color: 'var(--muted, #9ca3af)',
        padding: 24,
      }}
    >
      <div className="spinner" />
      <p>Đang load profile…</p>
      {showFallback && (
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            maxWidth: 460,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <p style={{ color: 'rgb(252, 165, 165)' }}>
            Load profile bị treo (có thể Firestore rules chặn hoặc lỗi mạng).
            Anh thử đăng xuất rồi đăng nhập lại.
          </p>
          <button
            type="button"
            style={{
              marginTop: 10,
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(239,68,68,0.5)',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
            }}
            onClick={() => void signOut()}
          >
            🚪 Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
