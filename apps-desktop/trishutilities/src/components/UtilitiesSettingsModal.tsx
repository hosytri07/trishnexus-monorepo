/**
 * UtilitiesSettingsModal — Phase 66.
 *
 * Cài đặt TỔNG cho TrishUtilities. Mỗi tab module có form settings INLINE
 * (load/save trực tiếp qua module's settings.ts), KHÔNG dẫn modal khác.
 *
 * Tabs:
 *   - Giao diện: theme app-wide
 *   - Dọn dẹp: Clean settings (retention days, auto-purge, confirm-before-clean...)
 *   - Kiểm tra máy: Check settings (language, auto-snapshot)
 *   - Cloud: Drive settings (placeholder — chưa có Settings interface)
 *   - Font: Font settings (language, sample text, preview size)
 *   - Shortcut: Shortcut settings (overlay hotkey, start with windows, etc.)
 *   - Tài khoản: user info + signout
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';

// Load/save settings từng module — import trực tiếp
import {
  loadSettings as loadCleanSettings,
  saveSettings as saveCleanSettings,
  type AppSettings as CleanSettings,
} from '../modules/clean/settings.js';
import {
  loadSettings as loadCheckSettings,
  saveSettings as saveCheckSettings,
  type Settings as CheckSettings,
} from '../modules/check/settings.js';
import {
  loadSettings as loadFontSettings,
  saveSettings as saveFontSettings,
  type Settings as FontSettings,
} from '../modules/font/settings.js';
import {
  loadSettings as loadShortcutSettings,
  saveSettings as saveShortcutSettings,
} from '../modules/shortcut/storage.js';
import type { AppSettings as ShortcutSettings } from '../modules/shortcut/types.js';

type TabId = 'general' | 'clean' | 'check' | 'drive' | 'font' | 'shortcut' | 'account';

const TABS: Array<{ id: TabId; icon: string; label: string }> = [
  { id: 'general',  icon: '🎨', label: 'Giao diện' },
  { id: 'clean',    icon: '🧹', label: 'Dọn dẹp' },
  { id: 'check',    icon: '🔍', label: 'Kiểm tra máy' },
  { id: 'drive',    icon: '☁',  label: 'Cloud' },
  { id: 'font',     icon: '🔤', label: 'Font' },
  { id: 'shortcut', icon: '⚡', label: 'Shortcut' },
  { id: 'account',  icon: '👤', label: 'Tài khoản' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
  demo: 'Demo',
  trial: 'Trial',
  guest: 'Khách',
};

export interface UtilitiesSettingsModalProps {
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
  onClose: () => void;
  version?: string;
}

export function UtilitiesSettingsModal({
  theme,
  onThemeChange,
  onClose,
  version = '2.0.0',
}: UtilitiesSettingsModalProps): JSX.Element {
  const [active, setActive] = useState<TabId>('general');
  const { firebaseUser, profile, role, signOut } = useAuth();

  // Esc → close
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const display = profile?.display_name || firebaseUser?.email || '';
  const email = firebaseUser?.email ?? '';
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,14,12,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          width: '100%',
          maxWidth: 820,
          height: '85vh',
          maxHeight: 640,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* Sidebar tabs */}
        <div
          style={{
            width: 200,
            background: 'var(--color-surface-bg-elevated)',
            borderRight: '1px solid var(--color-border-subtle)',
            padding: '16px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '0 12px 14px',
              borderBottom: '1px solid var(--color-border-subtle)',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Cài đặt
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
              TrishUtilities · v{version}
            </div>
          </div>
          {TABS.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 12px',
                  background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 120ms',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-surface-row)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content panel */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
          {/* Header với nút đóng */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {TABS.find((t) => t.id === active)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              title="Đóng"
              style={{
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 7,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ×
            </button>
          </div>

          {/* Tab content */}
          {active === 'general' && (
            <Section label="Chế độ màu">
              <div style={{ display: 'flex', gap: 8 }}>
                <ThemeOption active={theme === 'light'} label="Sáng" icon="☀" onClick={() => onThemeChange('light')} />
                <ThemeOption active={theme === 'dark'} label="Tối" icon="🌙" onClick={() => onThemeChange('dark')} />
              </div>
              <Hint>Áp dụng cho toàn bộ TrishUtilities (Dọn dẹp · Kiểm tra · Cloud · Font · Shortcut).</Hint>
            </Section>
          )}

          {active === 'clean' && <CleanSettingsTab />}
          {active === 'check' && <CheckSettingsTab />}
          {active === 'drive' && <DriveSettingsTab />}
          {active === 'font' && <FontSettingsTab />}
          {active === 'shortcut' && <ShortcutSettingsTab />}

          {active === 'account' && (
            <div>
              <Section label="Thông tin tài khoản">
                <InfoRow label="Tên hiển thị" value={display} />
                <InfoRow label="Email" value={email} />
                <InfoRow label="Vai trò" value={roleLabel} bold />
              </Section>
              <button
                type="button"
                onClick={() => { onClose(); void signOut(); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 9,
                  color: '#ef4444',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 16,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🚪 Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Module settings tabs — embed form inline
// ============================================================

function CleanSettingsTab(): JSX.Element {
  const [s, setS] = useState<CleanSettings>(() => loadCleanSettings());
  function update<K extends keyof CleanSettings>(key: K, value: CleanSettings[K]): void {
    const next = { ...s, [key]: value };
    setS(next);
    saveCleanSettings(next);
  }
  return (
    <div>
      <Section label="Trash retention">
        <Row label="Giữ trash bao lâu (ngày)">
          <input
            type="number"
            min={1}
            max={90}
            value={s.retentionDays}
            onChange={(e) => update('retentionDays', Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7)))}
            style={inputStyle}
          />
        </Row>
        <Hint>File trong trash sẽ tự xoá vĩnh viễn sau N ngày. Mặc định 7 ngày.</Hint>
      </Section>
      <Section label="Hành vi tự động">
        <Toggle
          label="Tự xoá trash cũ khi mở app"
          desc="Mỗi lần mở app, session quá hạn sẽ tự xoá vĩnh viễn."
          checked={s.autoPurgeOnLaunch}
          onChange={(v) => update('autoPurgeOnLaunch', v)}
        />
        <Toggle
          label="Hỏi xác nhận trước khi dọn"
          desc="Dialog confirm trước mỗi action dọn (Quick Clean / Custom Scan)."
          checked={s.confirmBeforeClean}
          onChange={(v) => update('confirmBeforeClean', v)}
        />
        <Toggle
          label="Tự kiểm tra cập nhật"
          desc="Khi mở app, check version mới (nếu có)."
          checked={s.autoCheckUpdate}
          onChange={(v) => update('autoCheckUpdate', v)}
        />
      </Section>
    </div>
  );
}

function CheckSettingsTab(): JSX.Element {
  const [s, setS] = useState<CheckSettings>(() => loadCheckSettings());
  function update<K extends keyof CheckSettings>(key: K, value: CheckSettings[K]): void {
    const next = { ...s, [key]: value };
    setS(next);
    saveCheckSettings(next);
  }
  return (
    <div>
      <Section label="Ngôn ngữ">
        <div style={{ display: 'flex', gap: 8 }}>
          <PillOption active={s.language === 'vi'} label="Tiếng Việt" onClick={() => update('language', 'vi')} />
          <PillOption active={s.language === 'en'} label="English" onClick={() => update('language', 'en')} />
        </div>
      </Section>
      <Section label="Snapshot">
        <Toggle
          label="Tự lưu snapshot sau benchmark"
          desc="Mỗi lần chạy benchmark xong, tự thêm vào lịch sử."
          checked={s.autoSnapshot}
          onChange={(v) => update('autoSnapshot', v)}
        />
      </Section>
    </div>
  );
}

function FontSettingsTab(): JSX.Element {
  const [s, setS] = useState<FontSettings>(() => loadFontSettings());
  function update<K extends keyof FontSettings>(key: K, value: FontSettings[K]): void {
    const next = { ...s, [key]: value };
    setS(next);
    saveFontSettings(next);
  }
  return (
    <div>
      <Section label="Ngôn ngữ">
        <div style={{ display: 'flex', gap: 8 }}>
          <PillOption active={s.language === 'vi'} label="Tiếng Việt" onClick={() => update('language', 'vi')} />
          <PillOption active={s.language === 'en'} label="English" onClick={() => update('language', 'en')} />
        </div>
      </Section>
      <Section label="Preview font">
        <Row label="Văn bản mẫu">
          <textarea
            value={s.sampleText}
            onChange={(e) => update('sampleText', e.target.value)}
            rows={3}
            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
          />
        </Row>
        <Row label={`Kích thước (${s.previewSize}px)`}>
          <input
            type="range"
            min={12}
            max={72}
            value={s.previewSize}
            onChange={(e) => update('previewSize', parseInt(e.target.value, 10))}
            style={{ width: '100%' }}
          />
        </Row>
      </Section>
    </div>
  );
}

function ShortcutSettingsTab(): JSX.Element {
  const [s, setS] = useState<ShortcutSettings>(() => loadShortcutSettings());
  function update<K extends keyof ShortcutSettings>(key: K, value: ShortcutSettings[K]): void {
    const next = { ...s, [key]: value };
    setS(next);
    saveShortcutSettings(next);
  }
  return (
    <div>
      <Section label="Quick launcher">
        <Row label="Phím tắt mở overlay">
          <input
            type="text"
            value={s.overlay_hotkey}
            onChange={(e) => update('overlay_hotkey', e.target.value)}
            placeholder="Ctrl+Space"
            style={inputStyle}
          />
        </Row>
        <Hint>Phím tắt toàn cục để bật quick launcher (mặc định Ctrl+Space).</Hint>
      </Section>
      <Section label="Khởi động">
        <Toggle
          label="Khởi động cùng Windows"
          desc="App tự chạy khi Windows boot."
          checked={s.start_with_windows}
          onChange={(v) => update('start_with_windows', v)}
        />
        <Toggle
          label="Thu nhỏ về tray khi đóng"
          desc="Nhấn X không tắt app, chỉ thu xuống tray."
          checked={s.minimize_to_tray_on_close}
          onChange={(v) => update('minimize_to_tray_on_close', v)}
        />
      </Section>
    </div>
  );
}

function DriveSettingsTab(): JSX.Element {
  return (
    <div>
      <Section label="Cloud (TrishDrive)">
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
          TrishDrive hiện chưa có cài đặt riêng. Các tuỳ chọn nằm trực tiếp trong panel Cloud
          (thư mục lưu mặc định, history, WebDAV mount...).
        </p>
        <Hint>Cài đặt riêng cho TrishDrive sẽ được thêm trong phiên bản tiếp theo.</Hint>
      </Section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function Section({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>{label}</div>
      <div style={{ flex: 2 }}>{children}</div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 0',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: 'var(--color-accent-primary)', width: 16, height: 16, cursor: 'pointer' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
        {desc && (
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>
    </label>
  );
}

function PillOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 14px',
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
        borderRadius: 7,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '6px 0', borderBottom: '1px dashed var(--color-border-subtle)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function ThemeOption({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 16px',
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
        borderRadius: 9,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-primary)',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 7,
  background: 'var(--color-surface-card)',
  color: 'var(--color-text-primary)',
  fontFamily: 'inherit',
  outline: 'none',
};
