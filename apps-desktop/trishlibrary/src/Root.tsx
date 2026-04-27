/**
 * Phase 16.2.a — Root component: gate auth.
 *
 * - Loading → spinner
 * - Chưa login → LoginScreen
 * - Đã login (mọi role) → App
 *
 * Trial users vẫn xem được app local + Online Library, nhưng sync Firestore
 * sẽ bị Firestore Security Rules chặn (rule isPaidUser). Banner hint trong
 * App sẽ nhắc activate key.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { AppShell } from './AppShell.js';
import { LoginScreen } from './components/LoginScreen.js';
import { TrialBlockedScreen } from './components/TrialBlockedScreen.js';
import { loadSettings } from './settings.js';
import { makeT } from './i18n/index.js';

export function Root(): JSX.Element {
  const { loading, firebaseUser, profile, isTrial, isPaid } = useAuth();

  // Re-use i18n cho LoginScreen
  const settings = useMemo(() => loadSettings(), []);
  const tr = useMemo(() => makeT(settings.language), [settings.language]);

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
          background: 'var(--bg)',
          color: 'var(--fg-muted)',
        }}
      >
        <div className="spinner" />
        <p>Đang khởi động…</p>
        <style>{`
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--border);
            border-top-color: var(--accent);
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
    return <LoginScreen trKey={tr} />;
  }

  // Đợi profile load. Có timeout để fallback Sign out nếu treo (vd Firestore
  // rules deny + self-heal fail — user không bị stuck mãi).
  if (!profile) {
    return <ProfileLoadingScreen />;
  }

  // Trial → block hoàn toàn, chỉ hiện màn hình kích hoạt
  if (isTrial || !isPaid) {
    return <TrialBlockedScreen />;
  }

  return <AppShell />;
}

/**
 * Loading profile UI với fallback Sign out sau 8 giây nếu treo.
 */
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
        background: 'var(--bg)',
        color: 'var(--fg-muted)',
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
            className="btn btn-ghost btn-danger"
            style={{ marginTop: 10 }}
            onClick={() => void signOut()}
          >
            🚪 Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
