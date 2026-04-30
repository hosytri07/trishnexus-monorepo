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
import { Settings as SettingsIcon, X, Sun, Moon, MinusSquare, Power, Trash2, Info } from 'lucide-react';

const KEY_THEME = 'trishdrive_theme';
const KEY_CLOSE_BEHAVIOR = 'trishdrive_close_behavior';
const KEY_CLEANUP_DAYS = 'trishdrive_cleanup_days';

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

export function SettingsModal({
  theme, setTheme, onClose, version,
}: {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  onClose: () => void;
  version: string;
}): JSX.Element {
  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>(loadCloseBehavior);
  const [cleanupDays, setCleanupDays] = useState<number>(loadCleanupDays);

  useEffect(() => {
    try { localStorage.setItem(KEY_CLOSE_BEHAVIOR, closeBehavior); } catch { /* */ }
  }, [closeBehavior]);

  useEffect(() => {
    try { localStorage.setItem(KEY_CLEANUP_DAYS, String(cleanupDays)); } catch { /* */ }
  }, [cleanupDays]);

  async function quitNow() {
    if (!confirm('Thoát hoàn toàn TrishDrive? App sẽ không chạy background nữa.')) return;
    try { await invoke('exit_app'); } catch { /* */ }
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
