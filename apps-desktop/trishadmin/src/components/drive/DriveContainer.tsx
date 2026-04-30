/**
 * TrishDrive Panel (Phase 24.1) — embed trong TrishAdmin.
 *
 * TrishAdmin đã gate AuthProvider + AdminLogin trước khi vào panel này,
 * nên KHÔNG cần wrap AuthProvider hay show LoginScreen.
 *
 * Flow:
 *   1. useAuth → đã có firebaseUser (admin)
 *   2. load creds(uid)
 *      .a !has_creds → SetupWizard
 *      .b has_creds  → Main shell (sub-nav 7 page)
 */

import { useEffect, useState } from 'react';
import { Upload, Folder, Settings, Search, BookOpen, Share2, LayoutDashboard, Trash, Send } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@trishteam/auth/react';
import { SetupWizard } from './SetupWizard';
import { UploadPage } from './UploadPage';
import { FilesPage } from './FilesPage';
import { SharesPage } from './SharesPage';
import { DashboardPage } from './DashboardPage';
import { TrashPage } from './TrashPage';
import { HelpPage } from './HelpPage';
import { RequestsPanel } from './RequestsPanel';
import logoUrl from '../../assets/logo.png';

type Page = 'dashboard' | 'files' | 'upload' | 'shares' | 'trash' | 'requests' | 'help' | 'settings';

interface PublicCreds {
  has_creds: boolean;
  channel_title?: string | null;
  channel_id?: number | null;
}

/**
 * Top-level panel exported cho TrishAdmin App.tsx render khi active='drive'.
 * Phase 24.1 — admin-only TrishDrive.
 */
export function TrishDrivePanel(): JSX.Element {
  const { firebaseUser } = useAuth();

  // Phase 24.1.N — KHÔNG đụng html data-theme. Drive panel light cream nhờ
  // CSS vars hardcoded ở `:root` của drive-theme.css + inline background trên
  // .drive-panel container. TrishAdmin theme dark/light do Settings TrishAdmin
  // quản lý (qua applyTheme() trong main.tsx).

  if (!firebaseUser) {
    return (
      <div style={{ padding: 24, color: 'var(--color-text-muted, #9aa4b2)', fontSize: 13 }}>
        Cần đăng nhập admin để dùng TrishDrive.
      </div>
    );
  }

  return <AuthenticatedShell uid={firebaseUser.uid} />;
}

function AuthenticatedShell({ uid }: { uid: string }): JSX.Element {
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
      <div className="ts-app drive-panel min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Đang tải cấu hình...
      </div>
    );
  }

  if (!creds.has_creds) {
    return <SetupWizard uid={uid} onDone={() => void loadCreds()} />;
  }

  return <MainShell uid={uid} creds={creds} page={page} setPage={setPage} reloadCreds={loadCreds} />;
}

function MainShell({
  uid,
  creds,
  page,
  setPage,
  reloadCreds,
}: {
  uid: string;
  creds: PublicCreds;
  page: Page;
  setPage: (p: Page) => void;
  reloadCreds: () => Promise<void>;
}): JSX.Element {
  const [search, setSearch] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  // Phase 24.1 — embed trong TrishAdmin: bỏ nested sidebar, bỏ user info,
  // bỏ signout button (TrishAdmin sidebar đã có). Sub-nav 7 page = horizontal tabs ở top.
  return (
    <div className="ts-app drive-panel" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }}>
      {/* Top header: title + channel badge + search (when files).
          Phase 24.1.R — bỏ logo (trùng TrishDrive standalone sắp rebuild). */}
      <header className="drive-header" style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-bg-elevated)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
            Drive Cloud Telegram
            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}>
              {creds.channel_title}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
            Cloud Storage qua Telegram · không giới hạn dung lượng
          </div>
        </div>
        {page === 'files' && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--color-text-muted)' }} />
            <input
              type="search"
              placeholder="Tìm file..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field"
              style={{ width: 240, paddingLeft: 32 }}
            />
          </div>
        )}
      </header>

      {/* Top horizontal tab nav — 7 pages */}
      <nav className="drive-tabs" style={{ display: 'flex', gap: 2, padding: '0 22px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface-bg-elevated)', overflowX: 'auto' }}>
        <TabBtn icon={LayoutDashboard} label="Tổng quan" active={page === 'dashboard'} onClick={() => setPage('dashboard')} />
        <TabBtn icon={Folder} label="File của tôi" active={page === 'files'} onClick={() => setPage('files')} />
        <TabBtn icon={Upload} label="Upload" active={page === 'upload'} onClick={() => setPage('upload')} />
        <TabBtn icon={Share2} label="Link share" active={page === 'shares'} onClick={() => setPage('shares')} />
        <TabBtn icon={Trash} label="Thùng rác" active={page === 'trash'} onClick={() => setPage('trash')} />
        <TabBtn icon={Send} label="Yêu cầu file" active={page === 'requests'} onClick={() => setPage('requests')} />
        <TabBtn icon={BookOpen} label="Hướng dẫn" active={page === 'help'} onClick={() => setPage('help')} />
        <TabBtn icon={Settings} label="Cài đặt Drive" active={page === 'settings'} onClick={() => setPage('settings')} />
      </nav>

      {/* Page content — centered container max 1100px cho mọi sub-page,
          padding đều 2 bên để không lệch trái như Upload page trước */}
      <div style={{ flex: 1, overflow: 'auto' }}>
       <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px', width: '100%' }}>
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
        {page === 'requests' && <RequestsPanel />}
        {page === 'help' && <HelpPage />}
        {page === 'settings' && <SettingsPage uid={uid} onReset={reloadCreds} />}
       </div>
      </div>
    </div>
  );
}

/** Horizontal tab button thay sidebar NavBtn cũ. Underline khi active. */
function TabBtn({ icon: Icon, label, active, onClick }: { icon: typeof Folder; label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px',
        fontSize: 13, fontWeight: 500,
        background: 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
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

interface DriveStats {
  total: number;
  totalBytes: number;
  lastUploadMs: number | null;
}

function SettingsPage({ uid, onReset }: { uid: string; onReset: () => Promise<void> }): JSX.Element {
  // Phase 24.1.Q — bỏ profile/firebaseUser/signOut destructure vì card "Tài khoản
  // TrishTEAM" đã được xoá (duplicate với sidebar TrishAdmin).
  const [stats, setStats] = useState<DriveStats>({ total: 0, totalBytes: 0, lastUploadMs: null });

  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    try {
      const files = await invoke<Array<{ size_bytes: number; created_at: number }>>('db_files_list', {
        folderId: null,
        search: null,
      });
      const totalBytes = files.reduce((s, f) => s + (f.size_bytes || 0), 0);
      const lastUploadMs = files.length > 0
        ? Math.max(...files.map(f => f.created_at || 0))
        : null;
      setStats({ total: files.length, totalBytes, lastUploadMs });
    } catch (e) {
      console.warn('[stats]', e);
    }
  }

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
    <div className="space-y-4">
      {/* Phase 24.1.Q — bỏ card "Tài khoản TrishTEAM" duplicate vì sidebar
          TrishAdmin đã có avatar + email + nút Đăng xuất. */}

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


      {/* Phase 24.1.N — bỏ card "Giao diện" trong Drive Settings.
          Theme toàn TrishAdmin do panel "Cài đặt" của TrishAdmin quản lý.
          Drive panel LUÔN light cream (gold standard, hardcoded vars). */}

      {/* Dữ liệu */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Dữ liệu local</h2>
            <p className="card-subtitle">SQLite index files + chunks lưu tại %APPDATA%/vn.trishteam.drive/index.db</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mt-4">
          <Stat label="Tổng files" value={String(stats.total)} hint="Phase 22.5" />
          <Stat label="Storage Telegram" value={formatBytes(stats.totalBytes)} hint="Bot API + MTProto" />
          <Stat label="Last upload" value={formatLastUpload(stats.lastUploadMs)} hint={stats.lastUploadMs ? 'Phase 22.5' : '—'} />
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button className="btn-secondary" onClick={loadStats}>
            🔄 Refresh stats
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatLastUpload(ms: number | null): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s trước`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m trước`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h trước`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

interface MtprotoStatus {
  configured: boolean;
  authorized: boolean;
  user_phone: string | null;
  session_path: string;
}

function MtprotoStatusCard({ uid }: { uid: string }): JSX.Element {
  const [status, setStatus] = useState<MtprotoStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const s = await invoke<MtprotoStatus>('mtproto_status', { uid });
      setStatus(s);
    } catch (e) {
      setErr(String(e));
    } finally { setLoading(false); }
  }

  async function signout() {
    if (!confirm('Đăng xuất MTProto? Phải verify lại phone OTP nếu muốn dùng tiếp.')) return;
    try {
      await invoke('mtproto_signout', { uid });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  useEffect(() => { void load(); }, []);

  const isConnected = status?.authorized ?? false;
  const badgeText = isConnected ? '✓ Connected' : status?.configured ? '⚠ Chưa đăng nhập' : '◯ Chưa setup';
  const badgeBg = isConnected ? 'var(--color-accent-soft)' : status?.configured ? 'rgba(245,158,11,0.12)' : 'var(--color-surface-muted)';
  const badgeColor = isConnected ? 'var(--color-accent-primary)' : status?.configured ? '#b45309' : 'var(--color-text-muted)';

  return (
    <>
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Cloud Telegram (MTProto) <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', marginLeft: 6 }}>PHASE 23</span></h2>
          <p className="card-subtitle">User account thay vì bot — upload nguyên file 2GB (free) hoặc 4GB (Premium) không chia chunk Bot API. Tốc độ tải/lên cao hơn 5-10x.</p>
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
            Telegram account
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4, fontFamily: 'monospace' }}>
            {status.user_phone}{status.user_username && ` · @${status.user_username}`}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 flex-wrap">
        {!isConnected && (
          <button className="btn-primary" onClick={() => setShowSetup(true)}>
            {status?.configured ? 'Đăng nhập lại' : 'Setup MTProto'}
          </button>
        )}
        {isConnected && (
          <button className="btn-secondary" onClick={signout} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            Đăng xuất
          </button>
        )}
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Đang check...' : 'Reload status'}
        </button>
      </div>

      {isConnected && <MtprotoTestPanel uid={uid} />}

      <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        🚧 Phase 23.3 — test upload/download/delete MTProto trên Saved Messages. Sau khi xác nhận work, Phase 23.4 sẽ wire vào pipeline file_upload thay Bot API.
      </div>
    </div>
    {showSetup && <MtprotoSetupModal uid={uid} onClose={() => { setShowSetup(false); void load(); }} />}
    </>
  );
}

function MtprotoTestPanel({ uid }: { uid: string }): JSX.Element {
  const [filePath, setFilePath] = useState('');
  const [lastMsgId, setLastMsgId] = useState<number | null>(null);
  const [dlMsgId, setDlMsgId] = useState('');
  const [dlDest, setDlDest] = useState('');
  const [delMsgId, setDelMsgId] = useState('');
  const [busy, setBusy] = useState<'up' | 'dl' | 'del' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pickFile() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const sel = await open({ multiple: false, directory: false });
      if (typeof sel === 'string') setFilePath(sel);
    } catch (e) { setErr(String(e)); }
  }

  async function pickDest() {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const sel = await save({ defaultPath: 'mtproto-download.bin' });
      if (typeof sel === 'string') setDlDest(sel);
    } catch (e) { setErr(String(e)); }
  }

  async function doUpload() {
    setBusy('up'); setErr(null); setInfo(null);
    try {
      const r = await invoke<{ message_id: number; size_bytes: number }>('mtproto_test_upload', { uid, filePath });
      setLastMsgId(r.message_id);
      setDlMsgId(String(r.message_id));
      setInfo(`✓ Upload OK — message_id=${r.message_id}, size=${(r.size_bytes / 1024 / 1024).toFixed(2)}MB`);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  async function doDownload() {
    setBusy('dl'); setErr(null); setInfo(null);
    try {
      const id = parseInt(dlMsgId.trim(), 10);
      if (isNaN(id)) throw new Error('message_id phải là số');
      if (!dlDest.trim()) throw new Error('Chưa chọn dest path');
      await invoke('mtproto_test_download', { uid, messageId: id, destPath: dlDest });
      setInfo(`✓ Download OK → ${dlDest}`);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  async function doDelete() {
    setBusy('del'); setErr(null); setInfo(null);
    try {
      const id = parseInt(delMsgId.trim(), 10);
      if (isNaN(id)) throw new Error('message_id phải là số');
      if (!confirm(`Xoá message ${id} khỏi Saved Messages?`)) { setBusy(null); return; }
      await invoke('mtproto_test_delete', { uid, messageIds: [id] });
      setInfo(`✓ Đã xoá message ${id}`);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text-primary)', fontSize: 12, fontFamily: 'monospace',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 4, display: 'block',
  };

  return (
    <div className="mt-4 p-3" style={{ background: 'var(--color-surface-row)', borderRadius: 10, border: '1px dashed var(--color-border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        🧪 Test panel — Saved Messages
      </div>

      {info && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}>
          {info}
        </div>
      )}
      {err && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.2)' }}>
          {err}
        </div>
      )}

      {/* Upload row */}
      <div className="mb-3">
        <span style={labelStyle}>1. Upload file → Saved Messages</span>
        <div className="flex gap-2 items-center">
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Đường dẫn file..." value={filePath} onChange={e => setFilePath(e.target.value)} />
          <button className="btn-secondary" onClick={pickFile}>Chọn file</button>
          <button className="btn-primary" onClick={doUpload} disabled={busy !== null || !filePath}>
            {busy === 'up' ? 'Đang upload...' : 'Upload'}
          </button>
        </div>
        {lastMsgId !== null && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Message vừa tạo: <code>{lastMsgId}</code>
          </div>
        )}
      </div>

      {/* Download row */}
      <div className="mb-3">
        <span style={labelStyle}>2. Download by message_id</span>
        <div className="flex gap-2 items-center mb-1">
          <input style={{ ...inputStyle, width: 120 }} placeholder="message_id" value={dlMsgId} onChange={e => setDlMsgId(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Đường dẫn lưu..." value={dlDest} onChange={e => setDlDest(e.target.value)} />
          <button className="btn-secondary" onClick={pickDest}>Chọn dest</button>
          <button className="btn-primary" onClick={doDownload} disabled={busy !== null || !dlMsgId || !dlDest}>
            {busy === 'dl' ? 'Đang tải...' : 'Download'}
          </button>
        </div>
      </div>

      {/* Delete row */}
      <div>
        <span style={labelStyle}>3. Delete by message_id</span>
        <div className="flex gap-2 items-center">
          <input style={{ ...inputStyle, width: 120 }} placeholder="message_id" value={delMsgId} onChange={e => setDelMsgId(e.target.value)} />
          <button className="btn-secondary" onClick={doDelete} disabled={busy !== null || !delMsgId} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            {busy === 'del' ? 'Đang xoá...' : 'Xoá'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MtprotoSetupModal({ uid, onClose }: { uid: string; onClose: () => void }): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function saveConfig() {
    setBusy(true);
    setErr(null);
    try {
      const apiIdInt = parseInt(apiId.trim(), 10);
      if (isNaN(apiIdInt) || apiIdInt <= 0) {
        throw new Error('api_id phải là số nguyên > 0');
      }
      if (apiHash.trim().length < 16) {
        throw new Error('api_hash phải dài ≥ 16 ký tự');
      }
      await invoke('mtproto_save_config', { uid, apiId: apiIdInt, apiHash: apiHash.trim() });
      setStep(2);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function requestCode() {
    setBusy(true);
    setErr(null);
    try {
      if (!phone.trim().startsWith('+')) {
        throw new Error('Phone phải bắt đầu bằng + (vd: +84912345678)');
      }
      await invoke('mtproto_request_code', { uid, phone: phone.trim() });
      setStep(3);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function submitCode() {
    setBusy(true);
    setErr(null);
    try {
      const result = await invoke<{ user_phone: string | null; needs_password: boolean }>(
        'mtproto_submit_code',
        { uid, code: code.trim(), password: password || null }
      );
      if (result.needs_password) {
        setNeedsPassword(true);
        setErr('Tài khoản có 2FA. Nhập password Cloud password để tiếp tục.');
      } else {
        onClose();
      }
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 540, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="card-title">Setup MTProto · Bước {step}/3</h2>
            <p className="card-subtitle">User account Telegram thay vì bot — upload file lớn không chia chunks.</p>
          </div>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-1 mb-4">
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= step ? 'var(--color-accent-primary)' : 'var(--color-surface-muted)' }} />
          ))}
        </div>

        {step === 1 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <strong>Lấy api_id + api_hash:</strong>
            </p>
            <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, paddingLeft: 20, marginTop: 8 }}>
              <li>Mở <a href="https://my.telegram.org/apps" target="_blank" rel="noopener" style={{ color: 'var(--color-text-link)' }}>my.telegram.org/apps</a> (login với phone Telegram)</li>
              <li>Điền form "Create new application": tên app vd <code>TrishDrive</code>, platform <code>Desktop</code></li>
              <li>Submit → Telegram show <code>App api_id</code> (số) + <code>App api_hash</code> (chuỗi 32 ký tự)</li>
              <li>Copy về paste vào đây</li>
            </ol>
            <div className="mt-4 space-y-3">
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>api_id</label>
                <input className="input-field" style={{ marginTop: 4, fontFamily: 'monospace' }} value={apiId} onChange={e => setApiId(e.target.value)} placeholder="12345678" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>api_hash</label>
                <input className="input-field" style={{ marginTop: 4, fontFamily: 'monospace' }} value={apiHash} onChange={e => setApiHash(e.target.value)} placeholder="abcdef0123456789..." />
              </div>
            </div>
            {err && <ErrBox msg={err} />}
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={onClose}>Huỷ</button>
              <button className="btn-primary" onClick={saveConfig} disabled={busy || !apiId || !apiHash}>
                {busy ? 'Đang lưu...' : 'Tiếp tục →'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Nhập số phone đã đăng ký Telegram. App sẽ gọi Telegram → Telegram gửi OTP qua chính ứng dụng Telegram của bạn (KHÔNG gửi SMS).
            </p>
            <div className="mt-4">
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Phone (định dạng quốc tế)</label>
              <input className="input-field" style={{ marginTop: 4, fontFamily: 'monospace' }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+84912345678" />
            </div>
            {err && <ErrBox msg={err} />}
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setStep(1)}>← Quay lại</button>
              <button className="btn-primary" onClick={requestCode} disabled={busy || !phone}>
                {busy ? 'Đang gửi code...' : 'Gửi mã OTP →'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Mở Telegram app → tin nhắn từ <strong>Telegram</strong> chứa mã OTP 5 chữ số. Paste vào đây.
            </p>
            <div className="mt-4">
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>OTP code</label>
              <input className="input-field" style={{ marginTop: 4, fontFamily: 'monospace', textAlign: 'center', fontSize: 18, letterSpacing: 4 }} value={code} onChange={e => setCode(e.target.value)} placeholder="12345" maxLength={6} disabled={needsPassword} />
            </div>
            <div className="mt-3">
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                Cloud password (2FA) <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>— bỏ trống nếu account không có 2FA</span>
              </label>
              <input type="password" className="input-field" style={{ marginTop: 4 }} value={password} onChange={e => setPassword(e.target.value)} placeholder="Telegram 2FA password (Settings → Privacy → 2-Step Verification)" />
            </div>
            {needsPassword && (
              <div className="mt-2 p-2 rounded text-xs" style={{ background: 'rgba(245,158,11,0.08)', color: '#b45309', border: '1px solid rgba(245,158,11,0.2)' }}>
                ⚠ Tài khoản này có 2FA. Nhập Cloud password ở trên rồi bấm <strong>Đăng nhập</strong> lại (KHÔNG cần nhập OTP nữa, app đã ghi nhớ).
              </div>
            )}
            {err && <ErrBox msg={err} />}
            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setStep(2)}>← Lại</button>
              <button className="btn-primary" onClick={submitCode} disabled={busy || (!code && !needsPassword) || (needsPassword && !password)}>
                {busy ? 'Đang verify...' : needsPassword ? 'Verify 2FA' : 'Đăng nhập'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }): JSX.Element {
  return (
    <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <div style={{ fontSize: 12, color: '#dc2626' }}>{msg}</div>
    </div>
  );
}
