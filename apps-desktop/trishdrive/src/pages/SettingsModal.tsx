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
