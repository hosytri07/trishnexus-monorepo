/**
 * TrishDrive USER app — Phase 26.1.D rewrite.
 *
 * USER-facing flow (khác hoàn toàn admin Drive Panel của TrishAdmin):
 *   1. Login Firebase (giữ LoginScreen từ phase trước)
 *   2. 4 tab horizontal: Download / Library / History / Help
 *      - Download: paste share URL → tải file (Phase 26.1.C backend đã ready)
 *      - Library: browse Thư viện TrishTEAM public (Phase 26.1.E TODO)
 *      - History: lịch sử file đã tải (Phase 26.1.B+C đã ready)
 *      - Help: hướng dẫn dùng app
 *
 * KHÔNG có admin features:
 *   - SetupWizard (Bot API + MTProto setup) — admin only
 *   - UploadPage — admin only
 *   - FilesPage / SharesPage / TrashPage — admin only
 */

import { useEffect, useState } from 'react';
import { Download, BookOpen, History, HelpCircle, LogOut, Sun, Moon, Settings, Shield, WifiOff } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider, useAuth } from '@trishteam/auth/react';
import { LoginScreen } from './pages/LoginScreen';
import { DownloadScreen } from './pages/DownloadScreen';
import { LibraryScreen } from './pages/LibraryScreen';
import { HistoryScreen } from './pages/HistoryScreen';
import { HelpPage } from './pages/HelpPage';
import { SettingsModal, loadCloseBehavior, loadSpeedLimit } from './pages/SettingsModal';
import { DownloadManager } from './pages/DownloadManager';
import logoUrl from './assets/logo.png';

type Page = 'download' | 'library' | 'history' | 'help';

export function App(): JSX.Element {
  // Phase 24.3.G — wrap ts-app ở MOST OUTER để utility CSS scope đúng cho mọi child.
  return (
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthProvider>
        <AppGate />
      </AuthProvider>
    </div>
  );
}

function AppGate(): JSX.Element {
  const { firebaseUser, profile, loading, signOut } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('trishdrive_theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });

  // Set data-theme cho HTML root
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('trishdrive_theme', theme); } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Đang kết nối...
      </div>
    );
  }

  if (!firebaseUser) {
    return <LoginScreen />;
  }

  // Phase 23.6 — block role 'trial' (cần activate key thành 'user' hoặc admin)
  const role = (profile as any)?.role;
  if (role === 'trial' || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-surface-bg)' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 16, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✨</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, color: 'var(--color-text-primary)' }}>Tài khoản dùng thử</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
            Tài khoản trial chưa được kích hoạt key — chưa thể dùng TrishDrive.<br />
            Vào trang profile trên web để nhập key kích hoạt thành <b>User</b>.
          </p>
          <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--color-surface-row)', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04, fontWeight: 600 }}>Tài khoản hiện tại</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 4 }}>{(profile as any)?.display_name || firebaseUser.email}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Role: <b>trial</b></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => { void import('@tauri-apps/plugin-opener').then(m => m.openUrl('https://trishteam.io.vn/profile')); }}>
              Mở web kích hoạt
            </button>
            <button className="btn-secondary" onClick={() => void signOut()}>Đăng xuất</button>
          </div>
        </div>
      </div>
    );
  }

  return <MainShell theme={theme} setTheme={setTheme} />;
}

function MainShell({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }): JSX.Element {
  const { profile, firebaseUser, signOut } = useAuth();
  const [page, setPage] = useState<Page>('download');
  const [refreshTick, setRefreshTick] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [version, setVersion] = useState('1.0.0');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Phase 26.4.B — listen online/offline events
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    void invoke<string>('app_version').then(setVersion).catch(() => {});
    // Phase 26.2.D — sync speed limit từ localStorage → Rust state lúc app start
    void invoke('set_speed_limit', { mbps: loadSpeedLimit() }).catch(() => {});
    // Phase 26.6.A — request Notification permission lúc app start
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Phase 26.5.A — listen nav-to-tab event từ tray menu (vd "Xem lịch sử")
  useEffect(() => {
    const unlisten = listen<string>('nav-to-tab', (e) => {
      const tab = e.payload as Page;
      if (['download', 'library', 'history', 'help'].includes(tab)) {
        setPage(tab);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Phase 26.5.G — listen close-requested event từ Rust → check setting
  useEffect(() => {
    const unlisten = listen('app-close-requested', () => {
      const behavior = loadCloseBehavior();
      if (behavior === 'quit') {
        void invoke('exit_app');
      } else {
        void invoke('hide_to_tray');
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Role label + color (Phase 26.5.G)
  const roleRaw = (profile as { role?: string } | null)?.role;
  const role = (roleRaw === 'admin' || roleRaw === 'trial' || roleRaw === 'user') ? roleRaw : 'user';
  const roleStyle: Record<string, { label: string; bg: string; color: string }> = {
    admin: { label: 'Admin', bg: 'rgba(239,68,68,0.15)', color: '#dc2626' },
    user:  { label: 'User',  bg: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' },
    trial: { label: 'Trial', bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  };
  const r = roleStyle[role];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }}>
      {/* Top header — logo + title + user info + theme toggle */}
      <header style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <img
            src={logoUrl}
            alt="TrishDrive"
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#fff', padding: 2 }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
              TrishDrive
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
              Tải file từ Thư viện TrishTEAM · paste link share + tải về máy
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-secondary"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Đổi giao diện"
            style={{ padding: '6px 10px' }}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowSettings(true)}
            title="Cài đặt"
            style={{ padding: '6px 10px' }}
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 p-2" style={{ background: 'var(--color-surface-row)', borderRadius: 10 }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: 'var(--color-accent-gradient)' }}>
              {(profile?.display_name || firebaseUser?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {profile?.display_name || firebaseUser?.email}
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '1px 6px', borderRadius: 5,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                    background: r.bg, color: r.color,
                  }}
                  title={`Role: ${role}`}
                >
                  <Shield className="h-2.5 w-2.5" /> {r.label}
                </span>
              </div>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => void signOut()} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
          </button>
        </div>
      </header>

      {showSettings && (
        <SettingsModal
          theme={theme}
          setTheme={setTheme}
          onClose={() => setShowSettings(false)}
          version={version}
          availableFolders={loadKnownFolders()}
        />
      )}

      {/* Phase 26.4.B — Offline banner */}
      {!isOnline && (
        <div
          style={{
            background: 'linear-gradient(90deg, #f59e0b, #dc2626)',
            color: 'white',
            padding: '8px 22px',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <WifiOff className="h-4 w-4" />
          Đang offline — Thư viện TrishTEAM + Tải file tạm không khả dụng. Lịch sử + file đã tải vẫn xem được.
        </div>
      )}

      {/* Top tab nav */}
      <nav style={{ display: 'flex', gap: 2, padding: '0 22px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-bg-elevated)', overflowX: 'auto' }}>
        <TabBtn icon={Download} label="Tải file" active={page === 'download'} onClick={() => setPage('download')} />
        <TabBtn icon={BookOpen} label="Thư viện TrishTEAM" active={page === 'library'} onClick={() => setPage('library')} />
        <TabBtn icon={History} label="Lịch sử" active={page === 'history'} onClick={() => setPage('history')} />
        <TabBtn icon={HelpCircle} label="Hướng dẫn" active={page === 'help'} onClick={() => setPage('help')} />
      </nav>

      {/* Page content centered */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '24px 28px', width: '100%' }}>
          {page === 'download' && <DownloadScreen onDone={() => setRefreshTick(t => t + 1)} />}
          {page === 'library' && <LibraryScreen />}
          {page === 'history' && <HistoryScreen refreshTick={refreshTick} />}
          {page === 'help' && <HelpPage />}
        </div>
      </div>

      {/* Phase 25.1.H — Global download manager (concurrent downloads + per-file progress) */}
      <DownloadManager />
    </div>
  );
}

/**
 * Phase 26.4.A — Đọc list folder admin từng có (LibraryScreen update mỗi lần fetch).
 * Truyền vào SettingsModal cho user tick subscribe.
 */
function loadKnownFolders(): string[] {
  try {
    const v = localStorage.getItem('trishdrive_known_folders');
    if (v) return JSON.parse(v) as string[];
  } catch { /* ignore */ }
  return [];
}

function TabBtn({ icon: Icon, label, active, onClick }: { icon: typeof Download; label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px',
        fontSize: 13, fontWeight: 500,
        background: 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        marginBottom: -1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'color 200ms, border-color 200ms',
      }}
    >
      <Icon style={{ width: 14, height: 14 }} />
      {label}
    </button>
  );
}
