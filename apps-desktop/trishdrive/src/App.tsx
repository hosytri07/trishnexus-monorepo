/**
 * TrishDrive — Phase 22.4b.
 *
 * Flow:
 *   1. AuthProvider wrap → check Firebase login state
 *   2. !isAuthenticated → LoginScreen (bắt buộc, không skip)
 *   3. isAuthenticated → load creds(uid)
 *      .a !has_creds → SetupWizard (bắt buộc, không skip cho tới khi setup xong)
 *      .b has_creds  → Main UI (Files / Upload / Settings)
 */

import { useEffect, useState } from 'react';
import { Upload, Folder, Settings, Search, Sun, Moon, LogOut, BookOpen, Share2, LayoutDashboard, Trash } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AuthProvider, useAuth } from '@trishteam/auth/react';
import { SetupWizard } from './pages/SetupWizard';
import { LoginScreen } from './pages/LoginScreen';
import { UploadPage } from './pages/UploadPage';
import { FilesPage } from './pages/FilesPage';
import { SharesPage } from './pages/SharesPage';
import { DashboardPage } from './pages/DashboardPage';
import { TrashPage } from './pages/TrashPage';
import { HelpPage } from './pages/HelpPage';
import logoUrl from './assets/logo.png';

type Page = 'dashboard' | 'files' | 'upload' | 'shares' | 'trash' | 'help' | 'settings';

interface PublicCreds {
  has_creds: boolean;
  channel_title?: string | null;
  channel_id?: number | null;
}

export function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

function AppGate(): JSX.Element {
  const { firebaseUser, loading } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('trishdrive_theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('trishdrive_theme', theme); } catch {}
  }, [theme]);

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

  return <AuthenticatedShell uid={firebaseUser.uid} theme={theme} setTheme={setTheme} />;
}

function AuthenticatedShell({ uid, theme, setTheme }: { uid: string; theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }): JSX.Element {
  const [page, setPage] = useState<Page>('dashboard');
  const [creds, setCreds] = useState<PublicCreds | null>(null);

  useEffect(() => {
    void loadCreds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function loadCreds() {
    try {
      const c = await invoke<PublicCreds>('creds_load', { uid });
      setCreds(c);
    } catch (err) {
      console.warn('[creds_load] failed', err);
      setCreds({ has_creds: false });
    }
  }

  if (!creds) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Đang tải cấu hình...
      </div>
    );
  }

  if (!creds.has_creds) {
    return <SetupWizard uid={uid} onDone={() => void loadCreds()} />;
  }

  return <MainShell uid={uid} creds={creds} page={page} setPage={setPage} theme={theme} setTheme={setTheme} reloadCreds={loadCreds} />;
}

function MainShell({
  uid,
  creds,
  page,
  setPage,
  theme,
  setTheme,
  reloadCreds,
}: {
  uid: string;
  creds: PublicCreds;
  page: Page;
  setPage: (p: Page) => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  reloadCreds: () => Promise<void>;
}): JSX.Element {
  const { profile, firebaseUser, signOut } = useAuth();
  const [search, setSearch] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }}>
      <aside className="w-64 p-5 flex flex-col" style={{ background: 'var(--color-surface-card)', borderRight: '1px solid var(--color-border-subtle)' }}>
        <div className="flex items-center gap-3 mb-6 p-3" style={{ background: 'var(--color-surface-row)', borderRadius: '14px', border: '1px solid var(--color-border-subtle)' }}>
          <img src={logoUrl} alt="TrishDrive" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          <div className="min-w-0">
            <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>TrishDrive</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creds.channel_title}</div>
          </div>
        </div>
        <nav className="space-y-1 flex-1">
          <NavBtn icon={LayoutDashboard} label="Tổng quan" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
          <NavBtn icon={Folder} label="File của tôi" active={page === 'files'} onClick={() => setPage('files')} />
          <NavBtn icon={Upload} label="Upload" active={page === 'upload'} onClick={() => setPage('upload')} />
          <NavBtn icon={Share2} label="Link share" active={page === 'shares'} onClick={() => setPage('shares')} />
          <NavBtn icon={Trash} label="Thùng rác" active={page === 'trash'} onClick={() => setPage('trash')} />
          <NavBtn icon={BookOpen} label="Hướng dẫn" active={page === 'help'} onClick={() => setPage('help')} />
          <NavBtn icon={Settings} label="Cài đặt" active={page === 'settings'} onClick={() => setPage('settings')} />
        </nav>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2 mb-2 p-2" style={{ background: 'var(--color-surface-row)', borderRadius: 10 }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ background: 'var(--color-accent-gradient)' }}>
              {(profile?.display_name || firebaseUser?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.display_name || firebaseUser?.email}
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>uid: {uid.slice(0, 8)}...</div>
            </div>
          </div>
          <button className="btn-secondary w-full" onClick={() => void signOut()} style={{ fontSize: 12 }}>
            <LogOut className="h-3.5 w-3.5" /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-bg-elevated)' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>{page === 'dashboard' ? 'Tổng quan' : page === 'files' ? 'File của tôi' : page === 'upload' ? 'Upload file mới' : page === 'shares' ? 'Link share đã tạo' : page === 'trash' ? 'Thùng rác' : page === 'help' ? 'Hướng dẫn sử dụng' : 'Cài đặt'}</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Cloud Storage qua Telegram · không giới hạn dung lượng</p>
          </div>
          <div className="flex gap-2 items-center">
            {page === 'files' && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="search"
                  placeholder="Tìm kiếm..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-8"
                  style={{ width: '240px' }}
                />
              </div>
            )}
            <button className="btn-secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Đổi giao diện">
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {page === 'dashboard' && (
            <DashboardPage
              uid={uid}
              onGoFiles={() => setPage('files')}
              onGoUpload={() => setPage('upload')}
              onGoShares={() => setPage('shares')}
            />
          )}
          {page === 'files' && <FilesPage uid={uid} search={search} refreshTick={refreshTick} />}
          {page === 'upload' && (
            <UploadPage
              uid={uid}
              onUploadDone={() => {
                setRefreshTick(t => t + 1);
                setPage('files');
              }}
            />
          )}
          {page === 'shares' && <SharesPage uid={uid} />}
          {page === 'trash' && <TrashPage uid={uid} />}
          {page === 'help' && <HelpPage />}
          {page === 'settings' && <SettingsPage uid={uid} onReset={reloadCreds} theme={theme} setTheme={setTheme} />}
        </div>
      </main>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick }: { icon: typeof Folder; label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 transition" style={{
      borderRadius: '10px',
      padding: '9px 12px',
      fontSize: '13px',
      fontWeight: 500,
      background: active ? 'var(--color-accent-soft)' : 'transparent',
      color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
    }}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SettingsPage({ uid, onReset, theme, setTheme }: { uid: string; onReset: () => Promise<void>; theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }): JSX.Element {
  const { profile, firebaseUser, signOut } = useAuth();

  async function reset() {
    if (!confirm('Xoá Telegram credentials? File đã upload vẫn còn trên Telegram channel, nhưng index local mất — phải import lại.')) return;
    try {
      await invoke('creds_delete', { uid });
      await onReset();
    } catch (e) {
      alert('Lỗi reset: ' + String(e));
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Tài khoản */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Tài khoản TrishTEAM</h2>
            <p className="card-subtitle">Đang đăng nhập với tài khoản này. Cloud Telegram + AES master key gắn với uid.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 p-3" style={{ background: 'var(--color-surface-row)', borderRadius: 12 }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'var(--color-accent-gradient)', fontSize: 16 }}>
            {(profile?.display_name || firebaseUser?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {profile?.display_name || firebaseUser?.email}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{firebaseUser?.email}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>uid: {uid}</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-secondary" onClick={() => void invoke('plugin:opener|open_url', { url: 'https://trishteam.io.vn/profile' }).catch(() => {})}>
            Quản lý tài khoản (web)
          </button>
          <button className="btn-secondary" onClick={() => void signOut()} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Cloud Telegram (Bot API hiện tại) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Cloud Telegram (Bot API)</h2>
            <p className="card-subtitle">BOT_TOKEN + CHANNEL_ID + AES master key (PBKDF2 200k) lưu Windows Credential Manager. Chunks 19MB.</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}>
            ✓ Active
          </span>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button className="btn-secondary" onClick={reset} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            Reset config (mở wizard)
          </button>
        </div>
      </div>

      {/* MTProto status (Phase 23) */}
      <MtprotoStatusCard uid={uid} />


      {/* Giao diện */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Giao diện</h2>
            <p className="card-subtitle">Sáng / tối + ngôn ngữ. Lưu localStorage per-app.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Theme</label>
            <div className="mt-2 flex gap-2">
              <button
                className={theme === 'light' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setTheme('light')}
                style={{ flex: 1 }}
              >
                Sáng
              </button>
              <button
                className={theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setTheme('dark')}
                style={{ flex: 1 }}
              >
                Tối
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Ngôn ngữ</label>
            <select className="select-field mt-2" disabled value="vi">
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇺🇸 English (Phase 23)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dữ liệu */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Dữ liệu local</h2>
            <p className="card-subtitle">SQLite index files + chunks lưu tại %APPDATA%/vn.trishteam.drive/index.db</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mt-4">
          <Stat label="Tổng files" value="0" hint="Phase 22.5" />
          <Stat label="Storage Telegram" value="0 B" hint="Phase 22.5" />
          <Stat label="Last upload" value="—" hint="Phase 22.5" />
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
            Export config + index (Phase 22.5)
          </button>
          <button className="btn-secondary" disabled style={{ opacity: 0.5 }}>
            Rebuild index từ Telegram (Phase 22.6)
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">About</h2>
            <p className="card-subtitle">TrishDrive v0.1.0-alpha · TrishTEAM ecosystem · Phase 22.4d</p>
          </div>
        </div>
        <div className="mt-3 text-xs space-y-1.5" style={{ color: 'var(--color-text-muted)' }}>
          <div>📦 Tham khảo: <a href="https://github.com/caamer20/Telegram-Drive" style={{ color: 'var(--color-text-link)' }}>caamer20/Telegram-Drive</a></div>
          <div>🔐 Encryption: AES-256-GCM · PBKDF2-SHA256 200k rounds</div>
          <div>📡 Transport: Telegram Bot API (Phase 22.5) · MTProto (Phase 23)</div>
          <div>💾 Index: SQLite + FTS5 search</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div style={{ background: 'var(--color-surface-row)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

interface MtprotoStatus {
  configured: boolean;
  authorized: boolean;
  user_phone: string | null;
  session_path: string;
}

function MtprotoStatusCard({ uid: _uid }: { uid: string }): JSX.Element {
  const [status, setStatus] = useState<MtprotoStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await invoke<MtprotoStatus>('mtproto_status');
      setStatus(s);
    } catch (e) {
      setErr(String(e));
      setStatus(null);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const isConnected = status?.authorized ?? false;
  const badgeText = isConnected ? '✓ Connected' : status?.configured ? '⚠ Cần đăng nhập lại' : '◯ Chưa setup';
  const badgeBg = isConnected ? 'var(--color-accent-soft)' : status?.configured ? 'rgba(245,158,11,0.12)' : 'var(--color-surface-muted)';
  const badgeColor = isConnected ? 'var(--color-accent-primary)' : status?.configured ? '#b45309' : 'var(--color-text-muted)';

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Cloud Telegram (MTProto) <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', marginLeft: 6 }}>PHASE 23</span></h2>
          <p className="card-subtitle">User account thay vì bot — upload nguyên file 2GB không chia chunk, tốc độ 5-10x Bot API. Cần đăng ký <code>my.telegram.org/apps</code> để lấy api_id + api_hash.</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: badgeBg, color: badgeColor }}>
          {badgeText}
        </span>
      </div>

      {err && (
        <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 12, color: '#b45309' }}>{err}</div>
        </div>
      )}

      {status?.user_phone && (
        <div className="mt-3 p-3" style={{ background: 'var(--color-surface-row)', borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Phone đã verify
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4, fontFamily: 'monospace' }}>
            {status.user_phone}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 flex-wrap">
        <button className="btn-primary" disabled style={{ opacity: 0.5 }}>
          Setup MTProto (Phase 23.2)
        </button>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Đang check...' : 'Reload status'}
        </button>
      </div>

      <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        🚧 Scaffold xong (Phase 23.1). Phase 23.2 sẽ có wizard nhập phone + OTP. Hiện file vẫn upload qua Bot API chunks.
      </div>
    </div>
  );
}
