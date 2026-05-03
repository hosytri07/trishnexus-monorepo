/**
 * SettingsModal — Phase 26.5.G
 *
 * Cài đặt user app:
 *   - Theme (light/dark) — sync với toggle ngoài header
 *   - Close behavior (X button → tray hide hoặc quit hẳn)
 *   - Cleanup threshold history (default 90 ngày)
 *   - About + version
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Settings as SettingsIcon, X, Sun, Moon, MinusSquare, Power, Trash2,
  Info, Bell, Folder, Gauge, Download as DownloadIcon, RefreshCw, Clock,
} from 'lucide-react';

const KEY_THEME = 'trishdrive_theme';
const KEY_CLOSE_BEHAVIOR = 'trishdrive_close_behavior';
const KEY_CLEANUP_DAYS = 'trishdrive_cleanup_days';
const KEY_SUBSCRIBED_FOLDERS = 'trishdrive_subscribed_folders';
const KEY_SPEED_LIMIT = 'trishdrive_speed_limit_mbps';
const KEY_SCHEDULE = 'trishdrive_schedule';

export type CloseBehavior = 'tray' | 'quit';

export function loadCloseBehavior(): CloseBehavior {
  try {
    const v = localStorage.getItem(KEY_CLOSE_BEHAVIOR);
    if (v === 'quit') return 'quit';
  } catch { /* ignore */ }
  return 'tray';
}

export function loadCleanupDays(): number {
  try {
    const v = localStorage.getItem(KEY_CLEANUP_DAYS);
    if (v) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 7 && n <= 365) return n;
    }
  } catch { /* ignore */ }
  return 90;
}

/** Phase 26.4.A — folder Trí theo dõi để nhận notification highlight. */
export function loadSubscribedFolders(): string[] {
  try {
    const v = localStorage.getItem(KEY_SUBSCRIBED_FOLDERS);
    if (v) return JSON.parse(v) as string[];
  } catch { /* ignore */ }
  return [];
}

export function saveSubscribedFolders(folders: string[]): void {
  try { localStorage.setItem(KEY_SUBSCRIBED_FOLDERS, JSON.stringify(folders)); } catch { /* */ }
}

/** Phase 26.2.D — Speed limit MB/s (0 = unlimited). */
export function loadSpeedLimit(): number {
  try {
    const v = localStorage.getItem(KEY_SPEED_LIMIT);
    if (v) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1000) return n;
    }
  } catch { /* */ }
  return 0;
}

/** Phase 26.2.E — Download schedule: "23:00" → "06:00" cho tải đêm. */
export interface DownloadSchedule {
  enabled: boolean;
  start: string;  // "HH:MM"
  end: string;    // "HH:MM"
}

export function loadSchedule(): DownloadSchedule {
  try {
    const v = localStorage.getItem(KEY_SCHEDULE);
    if (v) {
      const parsed = JSON.parse(v) as Partial<DownloadSchedule>;
      return {
        enabled: !!parsed.enabled,
        start: parsed.start || '23:00',
        end: parsed.end || '06:00',
      };
    }
  } catch { /* */ }
  return { enabled: false, start: '23:00', end: '06:00' };
}

export function saveSchedule(s: DownloadSchedule): void {
  try { localStorage.setItem(KEY_SCHEDULE, JSON.stringify(s)); } catch { /* */ }
}

/** Check current time có trong schedule range không.
 *  Hỗ trợ overnight range (vd 23:00 → 06:00 = từ 23h đêm tới 6h sáng hôm sau). */
export function isInScheduleWindow(s: DownloadSchedule, now = new Date()): boolean {
  if (!s.enabled) return true; // không enable = luôn cho phép tải
  const [sh, sm] = s.start.split(':').map(Number);
  const [eh, em] = s.end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin < endMin) {
    // Same-day range (vd 09:00-17:00)
    return nowMin >= startMin && nowMin < endMin;
  }
  // Overnight range (vd 23:00-06:00)
  return nowMin >= startMin || nowMin < endMin;
}

export function SettingsModal({
  theme, setTheme, onClose, version, availableFolders,
}: {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  onClose: () => void;
  version: string;
  /** Phase 26.4.A — list folder admin từng có, để render checkbox subscribe. */
  availableFolders?: string[];
}): JSX.Element {
  // Phase 25.1.E — WebDAV mount state
  const [webdavRunning, setWebdavRunning] = useState<number | null>(null);
  const [webdavPort, setWebdavPort] = useState<number>(() => {
    const v = parseInt(localStorage.getItem('webdav-port') ?? '8766', 10);
    return Number.isFinite(v) && v > 1024 ? v : 8766;
  });
  const [webdavDriveLetter, setWebdavDriveLetter] = useState<string>(() => {
    return localStorage.getItem('webdav-drive-letter') ?? 'Z';
  });
  const [webdavCacheBytes, setWebdavCacheBytes] = useState<number>(0);
  const [webdavCacheCapGB, setWebdavCacheCapGB] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem('webdav-cache-cap-gb') ?? '2');
    return Number.isFinite(v) && v > 0 ? v : 2;
  });
  const [webdavMsg, setWebdavMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  useEffect(() => {
    void invoke<number | null>('webdav_status').then((p) => setWebdavRunning(p)).catch(() => {});
    void invoke<number>('webdav_cache_size').then(setWebdavCacheBytes).catch(() => {});
  }, []);

  useEffect(() => { try { localStorage.setItem('webdav-port', String(webdavPort)); } catch {} }, [webdavPort]);
  useEffect(() => { try { localStorage.setItem('webdav-drive-letter', webdavDriveLetter); } catch {} }, [webdavDriveLetter]);
  useEffect(() => { try { localStorage.setItem('webdav-cache-cap-gb', String(webdavCacheCapGB)); } catch {} }, [webdavCacheCapGB]);

  async function handleWebdavStart(): Promise<void> {
    try {
      const p = await invoke<number>('webdav_start', { port: webdavPort });
      setWebdavRunning(p);
      // Phase 25.1.E.2 — Auto mount Z: + set label "TrishTEAM Cloud"
      try {
        const mountMsg = await invoke<string>('webdav_mount_drive', {
          driveLetter: webdavDriveLetter,
          port: p,
        });
        setWebdavMsg(`✓ WebDAV chạy tại http://127.0.0.1:${p}/. ${mountMsg}`);
      } catch (mountErr) {
        setWebdavMsg(`✓ WebDAV chạy port ${p} nhưng auto-mount fail: ${String(mountErr)}. Map thủ công: net use ${webdavDriveLetter}: http://127.0.0.1:${p}/`);
      }
    } catch (e) {
      setWebdavMsg(`✗ Start fail: ${String(e)}`);
    }
  }
  async function handleWebdavStop(): Promise<void> {
    try {
      // Unmount drive trước rồi stop server
      try {
        await invoke('webdav_unmount_drive', { driveLetter: webdavDriveLetter });
      } catch { /* silent — drive có thể chưa mount */ }
      await invoke('webdav_stop');
      setWebdavRunning(null);
      setWebdavMsg(`✓ Đã unmount ${webdavDriveLetter}:\\ + dừng WebDAV server.`);
    } catch (e) {
      setWebdavMsg(`✗ Stop fail: ${String(e)}`);
    }
  }
  async function handleEvictCache(): Promise<void> {
    try {
      const target = Math.floor(webdavCacheCapGB * 1024 * 1024 * 1024 * 0.8);
      const [n, freed] = await invoke<[number, number]>('webdav_cache_evict', { targetBytes: target });
      const newSize = await invoke<number>('webdav_cache_size');
      setWebdavCacheBytes(newSize);
      setWebdavMsg(`✓ Đã xoá ${n} file (${(freed / 1024 / 1024).toFixed(1)} MB).`);
    } catch (e) {
      setWebdavMsg(`✗ Evict fail: ${String(e)}`);
    }
  }
  /**
   * Phase 25.1.E.3 — Sync TrishTEAM Library xuống cache để mount Z:\
   * Fetch /api/drive/library/list → for each share → share_paste_and_download
   * → cache/TrishTEAM Library/{folder}/{file_name}
   */
  async function handleSyncLibrary(): Promise<void> {
    setSyncing(true);
    setSyncProgress(null);
    setWebdavMsg('⏳ Đang fetch list từ trishteam.io.vn...');
    try {
      // 1. Get cache dir (KHÔNG mở Explorer)
      const cacheDir = await invoke<string>('webdav_get_cache_dir');
      const libraryRoot = `${cacheDir}\\TrishTEAM Library`;
      console.log('[sync] cache dir:', cacheDir);
      console.log('[sync] library root:', libraryRoot);

      // 2. Fetch library list từ trishteam.io.vn API
      const { getFirebaseAuth } = await import('@trishteam/auth');
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần đăng nhập Firebase trước');
      const token = await user.getIdToken();
      console.log('[sync] token length:', token.length, 'starts:', token.slice(0, 20) + '...');
      console.log('[sync] fetching library list via Rust (bypass CORS)...');
      // Gọi qua Rust để bypass CORS dev mode + xử lý redirect HTTPS
      const data = await invoke<{ items: Array<{ token: string; file_name: string; file_size_bytes: number; folder_label: string | null; url: string }> }>('fetch_library_list', { token });
      const items = data.items || [];
      console.log('[sync] received items:', items.length, items);

      if (items.length === 0) {
        setWebdavMsg('⚠ Library API trả về 0 file. Có thể (a) admin chưa publish file nào với is_public=true, (b) API filter sai. Vào TrishAdmin → Drive → Link share → set "public" cho file muốn share.');
        return;
      }

      setWebdavMsg(`📥 Đang download ${items.length} file...`);

      // 3. Loop download
      let okCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const failures: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setSyncProgress({ current: i + 1, total: items.length, name: item.file_name });
        const folder = (item.folder_label?.trim() || '_root').replace(/[<>:"/\\|?*]/g, '_');
        const safeName = item.file_name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200) || 'file.bin';
        const destPath = `${libraryRoot}\\${folder}\\${safeName}`;
        console.log(`[sync] [${i + 1}/${items.length}] ${item.file_name} → ${destPath}`);
        try {
          // Phase 25.1.H — pass downloadId để DownloadManager track per-file progress.
          const downloadId = `sync-${item.token}-${i}-${Date.now()}`;
          await invoke('share_paste_and_download', {
            url: item.url,
            password: null,
            destPath,
            downloadId,
          });
          okCount++;
          console.log(`[sync] ✓ OK ${item.file_name}`);
        } catch (e) {
          const msg = String(e);
          console.warn(`[sync] ✗ ${item.file_name}:`, e);
          if (msg.toLowerCase().includes('already exists') || msg.includes('đã tồn tại')) {
            skipCount++;
          } else {
            failCount++;
            failures.push(`${item.file_name}: ${msg.slice(0, 80)}`);
          }
        }
      }
      setSyncProgress(null);
      const summary = `✓ Sync xong ${items.length} file: ${okCount} mới, ${skipCount} đã có, ${failCount} fail.`;
      const detail = failures.length > 0 ? `\n\nLỗi:\n${failures.slice(0, 5).join('\n')}` : '';
      setWebdavMsg(`${summary}${detail}\nVào ổ ${webdavDriveLetter}:\\TrishTEAM Library để xem.`);
      // Refresh cache size
      const newSize = await invoke<number>('webdav_cache_size');
      setWebdavCacheBytes(newSize);
    } catch (e) {
      console.error('[sync] fatal:', e);
      setWebdavMsg(`✗ Sync fail: ${String(e)}`);
      setSyncProgress(null);
    } finally {
      setSyncing(false);
    }
  }

  async function handleOpenCacheDir(): Promise<void> {
    try {
      const dir = await invoke<string>('webdav_open_cache_dir');
      console.log('[webdav] cache dir:', dir);
      setWebdavMsg(`✓ Cache dir: ${dir}`);
    } catch (e) {
      console.error('[webdav] open cache fail:', e);
      setWebdavMsg(`✗ Lỗi: ${String(e)}`);
    }
  }

  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>(loadCloseBehavior);
  const [cleanupDays, setCleanupDays] = useState<number>(loadCleanupDays);
  const [subscribedFolders, setSubscribedFolders] = useState<string[]>(loadSubscribedFolders);
  const [speedLimit, setSpeedLimit] = useState<number>(loadSpeedLimit);
  const [schedule, setScheduleState] = useState<DownloadSchedule>(loadSchedule);

  useEffect(() => {
    try { localStorage.setItem(KEY_CLOSE_BEHAVIOR, closeBehavior); } catch { /* */ }
  }, [closeBehavior]);

  useEffect(() => {
    try { localStorage.setItem(KEY_CLEANUP_DAYS, String(cleanupDays)); } catch { /* */ }
  }, [cleanupDays]);

  useEffect(() => {
    saveSubscribedFolders(subscribedFolders);
  }, [subscribedFolders]);

  // Phase 26.2.D — sync speed limit Rust state khi đổi
  useEffect(() => {
    try { localStorage.setItem(KEY_SPEED_LIMIT, String(speedLimit)); } catch { /* */ }
    void invoke('set_speed_limit', { mbps: speedLimit }).catch(() => {});
  }, [speedLimit]);

  // Phase 26.2.E — save schedule
  useEffect(() => { saveSchedule(schedule); }, [schedule]);

  function toggleFolder(name: string) {
    setSubscribedFolders(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    );
  }

  async function quitNow() {
    if (!confirm('Thoát hoàn toàn TrishDrive? App sẽ không chạy background nữa.')) return;
    try { await invoke('exit_app'); } catch { /* */ }
  }

  // Phase 26.5.F — check update qua Tauri updater plugin
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  async function checkUpdate() {
    setUpdateChecking(true);
    setUpdateStatus(null);
    try {
      // Dynamic import để TS không complain nếu plugin chưa cài
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        setUpdateStatus(`✓ Có bản mới: v${update.version} — ${update.body || 'Click bên dưới để cài'}`);
        if (confirm(`Có bản cập nhật v${update.version}.\n\nTải + cài đặt + restart app ngay?`)) {
          await update.downloadAndInstall();
          // Tauri sẽ tự restart sau khi cài
        }
      } else {
        setUpdateStatus('✓ App đã là phiên bản mới nhất.');
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      if (msg.includes('PLACEHOLDER') || msg.includes('pubkey')) {
        setUpdateStatus('⚠ Auto-update chưa setup — Trí cần gen RSA key + config.');
      } else {
        setUpdateStatus(`✕ ${msg}`);
      }
    } finally {
      setUpdateChecking(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--color-surface-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" /> Cài đặt
            </h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>
              Tinh chỉnh giao diện · hành vi đóng · cleanup
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Theme */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Giao diện
          </label>
          <div className="flex gap-2 mt-2">
            <button
              className={theme === 'light' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTheme('light')}
              style={{ flex: 1 }}
            >
              <Sun className="h-4 w-4" /> Sáng
            </button>
            <button
              className={theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTheme('dark')}
              style={{ flex: 1 }}
            >
              <Moon className="h-4 w-4" /> Tối
            </button>
          </div>
        </div>

        {/* Close behavior */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Khi đóng cửa sổ (nút ✕)
          </label>
          <div className="flex flex-col gap-2 mt-2">
            <label
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{
                background: closeBehavior === 'tray' ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
                border: '1px solid ' + (closeBehavior === 'tray' ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
              }}
            >
              <input
                type="radio"
                name="close"
                checked={closeBehavior === 'tray'}
                onChange={() => setCloseBehavior('tray')}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
              />
              <MinusSquare className="h-4 w-4" style={{ color: 'var(--color-accent-primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Thu nhỏ vào tray (khuyên dùng)
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  App chạy background, vẫn nhận thông báo file mới. Click icon tray góc Windows để mở lại.
                </div>
              </div>
            </label>
            <label
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
              style={{
                background: closeBehavior === 'quit' ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
                border: '1px solid ' + (closeBehavior === 'quit' ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
              }}
            >
              <input
                type="radio"
                name="close"
                checked={closeBehavior === 'quit'}
                onChange={() => setCloseBehavior('quit')}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
              />
              <Power className="h-4 w-4" style={{ color: '#dc2626' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Thoát hoàn toàn
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  Đóng app hoàn toàn, không nhận thông báo. Phải mở lại từ Start menu / shortcut.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Phase 25.1.E — WebDAV mount đã được gỡ ở Phase 25.1.E.4 (chưa cần thiết).
            Rust commands giữ lại trong lib.rs cho phase tương lai nếu cần. */}
        {false && (<>
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            ☁ WebDAV mount — Map TrishTEAM Library thành ổ ảo
          </label>
          <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, marginBottom: 10 }}>
              Mount Library TrishTEAM (admin curate) thành ổ Z:\ trên Windows Explorer. AutoCAD/Office mở file trực tiếp từ ổ này.
              <strong> Read-only</strong> — admin sở hữu, user chỉ đọc.
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Drive letter:</label>
              <select
                value={webdavDriveLetter}
                onChange={(e) => setWebdavDriveLetter(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 12, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-default)', borderRadius: 6 }}
              >
                {['Z','Y','X','W','V','U','T','S'].map((l) => <option key={l} value={l}>{l}:\</option>)}
              </select>
              <label style={{ fontSize: 12, marginLeft: 8 }}>Port:</label>
              <input
                type="number"
                value={webdavPort}
                onChange={(e) => setWebdavPort(parseInt(e.target.value, 10) || 8766)}
                style={{ width: 80, padding: '4px 8px', fontSize: 12, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-default)', borderRadius: 6 }}
              />
              <label style={{ fontSize: 12, marginLeft: 8 }}>Cache cap (GB):</label>
              <input
                type="number"
                step={0.5}
                min={0.5}
                value={webdavCacheCapGB}
                onChange={(e) => setWebdavCacheCapGB(parseFloat(e.target.value) || 2)}
                style={{ width: 70, padding: '4px 8px', fontSize: 12, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-default)', borderRadius: 6 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {webdavRunning ? (
                <>
                  <span style={{ fontSize: 12, padding: '3px 8px', background: 'var(--color-success-soft, #d1fae5)', color: 'var(--color-success, #059669)', borderRadius: 4 }}>
                    ● Đang chạy: 127.0.0.1:{webdavRunning}
                  </span>
                  <button onClick={handleWebdavStop} style={{ fontSize: 12, padding: '4px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    ⏹ Dừng
                  </button>
                </>
              ) : (
                <button onClick={handleWebdavStart} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--color-accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  ▶ Khởi động WebDAV
                </button>
              )}
              <span className="muted" style={{ fontSize: 11 }}>
                Cache: {(webdavCacheBytes / 1024 / 1024).toFixed(1)} MB / {(webdavCacheCapGB * 1024).toFixed(0)} MB
              </span>
              <button onClick={handleEvictCache} style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 4, cursor: 'pointer' }}>
                🗑 Xoá LRU
              </button>
              <button onClick={handleOpenCacheDir} style={{ fontSize: 11, padding: '3px 8px', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 4, cursor: 'pointer' }}>
                📂 Mở cache dir
              </button>
            </div>
            {/* Phase 25.1.E.3 — Sync TrishTEAM Library button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                onClick={() => void handleSyncLibrary()}
                disabled={syncing}
                style={{
                  fontSize: 12, padding: '6px 12px',
                  background: syncing ? 'var(--color-surface-row)' : 'var(--color-accent-primary)',
                  color: syncing ? 'var(--color-text-muted)' : 'white',
                  border: 'none', borderRadius: 6, cursor: syncing ? 'wait' : 'pointer', fontWeight: 600,
                }}
              >
                {syncing ? '⏳ Đang sync...' : '🔄 Sync TrishTEAM Library xuống cache'}
              </button>
              <span className="muted" style={{ fontSize: 11 }}>
                Tải tất cả file public Trí đã share xuống ổ {webdavDriveLetter}:\TrishTEAM Library
              </span>
            </div>
            {syncProgress && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--color-accent-soft)', borderRadius: 6, fontSize: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>📥 [{syncProgress.current}/{syncProgress.total}] {syncProgress.name}</span>
                  <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                    height: '100%',
                    background: 'var(--color-accent-primary)',
                    transition: 'width 200ms',
                  }} />
                </div>
              </div>
            )}
            {webdavMsg && (
              <div style={{ fontSize: 11, marginTop: 8, padding: '6px 10px', background: 'var(--color-accent-soft)', borderRadius: 4 }}>
                {webdavMsg}
              </div>
            )}
            {webdavRunning && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, cursor: 'pointer', color: 'var(--color-text-muted)' }}>📖 Hướng dẫn map ổ {webdavDriveLetter}:\</summary>
                <ol style={{ fontSize: 11, marginTop: 6, paddingLeft: 20, color: 'var(--color-text-muted)' }}>
                  <li>Mở Windows Explorer → "This PC"</li>
                  <li>Click "Computer" tab → "Map network drive"</li>
                  <li>Drive: <code>{webdavDriveLetter}:</code></li>
                  <li>Folder: <code>http://127.0.0.1:{webdavRunning}/</code></li>
                  <li>Tick "Reconnect at sign-in" → Finish</li>
                  <li>Hoặc command line: <code>net use {webdavDriveLetter}: http://127.0.0.1:{webdavRunning}/</code></li>
                </ol>
              </details>
            )}
          </div>
        </div>
        </>)}

        {/* Phase 26.4.A — Subscribe folders */}
        {availableFolders && availableFolders.length > 0 && (
          <div className="mt-5">
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
              <Bell className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> Theo dõi folder ({subscribedFolders.length})
            </label>
            <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                Tick folder bạn quan tâm → nhận toast nhấn mạnh khi admin upload file mới vào folder đó.
              </p>
              <div className="space-y-1">
                {availableFolders.map(folder => (
                  <label
                    key={folder}
                    className="flex items-center gap-2 p-2 cursor-pointer rounded"
                    style={{
                      background: subscribedFolders.includes(folder) ? 'var(--color-accent-soft)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={subscribedFolders.includes(folder)}
                      onChange={() => toggleFolder(folder)}
                      style={{ width: 14, height: 14, accentColor: 'var(--color-accent-primary)' }}
                    />
                    <Folder className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{folder}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase 26.2.D — Speed limit */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            <Gauge className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> Giới hạn tốc độ tải
          </label>
          <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={50}
                step={0.5}
                value={speedLimit}
                onChange={e => setSpeedLimit(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--color-accent-primary)' }}
              />
              <input
                type="number"
                min={0}
                max={1000}
                step={0.5}
                value={speedLimit}
                onChange={e => setSpeedLimit(parseFloat(e.target.value) || 0)}
                className="input-field"
                style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 40 }}>MB/s</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              {speedLimit === 0
                ? '⚡ Không giới hạn — tải nhanh nhất có thể'
                : `🐢 Giới hạn ${speedLimit} MB/s — tránh nghẽn mạng nhà / 4G dial-up`}
            </p>
          </div>
        </div>

        {/* Phase 26.2.E — Schedule download */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            <Clock className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> Lịch tải tự động
          </label>
          <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={e => setScheduleState({ ...schedule, enabled: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Chỉ tải vào khung giờ thấp điểm
              </span>
            </label>
            {schedule.enabled && (
              <div className="flex items-center gap-2 mt-2">
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Từ</span>
                <input
                  type="time"
                  value={schedule.start}
                  onChange={e => setScheduleState({ ...schedule, start: e.target.value })}
                  className="input-field"
                  style={{ width: 120, padding: '4px 8px', fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>đến</span>
                <input
                  type="time"
                  value={schedule.end}
                  onChange={e => setScheduleState({ ...schedule, end: e.target.value })}
                  className="input-field"
                  style={{ width: 120, padding: '4px 8px', fontSize: 13 }}
                />
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              {schedule.enabled
                ? `Click "Tải file" ngoài khung ${schedule.start}-${schedule.end} → app sẽ queue và tự động tải vào khung giờ này. Hỗ trợ qua đêm (vd 23:00 → 06:00 sáng hôm sau).`
                : 'Tắt — tải ngay khi click. Bật để tránh nghẽn mạng giờ cao điểm.'}
            </p>
          </div>
        </div>

        {/* Cleanup history */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Auto cleanup lịch sử
          </label>
          <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>
                Xoá record lịch sử cũ hơn
              </div>
              <input
                type="number"
                min={7}
                max={365}
                value={cleanupDays}
                onChange={e => setCleanupDays(parseInt(e.target.value, 10) || 90)}
                className="input-field"
                style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>ngày</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              File trên ổ cứng KHÔNG bị xoá. Bookmark giữ lại bất kể tuổi. Auto chạy 1 lần/ngày.
            </p>
          </div>
        </div>

        {/* Phase 26.5.F — Auto-update */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            <DownloadIcon className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} /> Cập nhật phần mềm
          </label>
          <div className="p-3 rounded-xl mt-2" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
            <div className="flex items-center gap-3">
              <button className="btn-secondary" onClick={checkUpdate} disabled={updateChecking} style={{ flex: 1 }}>
                <RefreshCw className={`h-3.5 w-3.5 ${updateChecking ? 'animate-spin' : ''}`} />
                {updateChecking ? 'Đang check...' : 'Kiểm tra cập nhật'}
              </button>
            </div>
            {updateStatus && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                {updateStatus}
              </div>
            )}
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Hiện tại v{version} · Auto-update qua GitHub Releases (sẽ enable khi admin setup RSA key)
            </p>
          </div>
        </div>

        {/* Quit now */}
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <button className="btn-secondary" onClick={quitNow} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            <Power className="h-4 w-4" /> Thoát app ngay
          </button>
        </div>

        {/* About */}
        <div className="mt-5 p-3 rounded-xl" style={{ background: 'var(--color-surface-row)' }}>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              <strong>TrishDrive</strong> v{version} · TrishTEAM ecosystem · Phase 26.1 User app
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
