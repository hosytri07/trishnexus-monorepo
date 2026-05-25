/**
 * WorkSettingsModal — Phase 54.2.
 *
 * Cài đặt TỔNG cho TrishWork, gộp settings của 3 module + chung + tài khoản.
 *
 * Layout: sidebar 5 tabs trái + content panel phải.
 *
 *   ┌──────────────┬─────────────────────────────────────┐
 *   │ Giao diện   ││ <theme picker>                       │
 *   │ Khảo sát-TK  │                                       │
 *   │ Thư viện     │                                       │
 *   │ ISO          │                                       │
 *   │ Tài khoản    │                                       │
 *   └──────────────┴─────────────────────────────────────┘
 *
 * Mỗi tab "Khảo sát-TK / Thư viện / ISO" hiển thị mô tả + 1 nút mở chi tiết.
 * Click nút → dispatch custom event → module nghe và tự mở settings panel/modal cũ.
 *
 * Lý do dùng event thay vì lift state lên: tránh phá vỡ state của 3 module độc lập.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';

type TabId = 'general' | 'design' | 'library' | 'iso' | 'account';

const TABS: Array<{ id: TabId; icon: string; label: string }> = [
  { id: 'general', icon: '🎨', label: 'Giao diện' },
  { id: 'design',  icon: '✏',  label: 'Khảo sát - Thiết kế' },
  { id: 'library', icon: '📚', label: 'Thư viện' },
  { id: 'iso',     icon: '📋', label: 'ISO' },
  { id: 'account', icon: '👤', label: 'Tài khoản' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
  demo: 'Demo',
  trial: 'Trial',
  guest: 'Khách',
};

export interface WorkSettingsModalProps {
  theme: 'light' | 'dark';
  onThemeChange: (t: 'light' | 'dark') => void;
  onClose: () => void;
  version?: string;
}

export function WorkSettingsModal({
  theme,
  onThemeChange,
  onClose,
  version = '2.0.0',
}: WorkSettingsModalProps): JSX.Element {
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

  /** Dispatch event để module tự mở settings của nó + đóng modal tổng */
  function openModuleSettings(eventName: string): void {
    onClose();
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(eventName));
    }, 100);
  }

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
          maxWidth: 760,
          height: '85vh',
          maxHeight: 600,
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
              TrishWork · v{version}
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

          {/* Tab: Giao diện */}
          {active === 'general' && (
            <div>
              <Section label="Chế độ màu">
                <div style={{ display: 'flex', gap: 8 }}>
                  <ThemeOption active={theme === 'light'} label="Sáng" icon="☀" onClick={() => onThemeChange('light')} />
                  <ThemeOption active={theme === 'dark'} label="Tối" icon="🌙" onClick={() => onThemeChange('dark')} />
                </div>
                <Hint>Áp dụng cho toàn bộ TrishWork (Khảo sát · Thư viện · ISO).</Hint>
              </Section>
            </div>
          )}

          {/* Tab: Khảo sát - Thiết kế */}
          {active === 'design' && (
            <ModuleSettingsLink
              description="Cài đặt riêng cho Khảo sát - Thiết kế: API keys (Claude/Groq/Gemini), AutoCAD path, Telegram bot, mẫu Excel/Word, dự toán..."
              buttonLabel="Mở cài đặt Khảo sát - Thiết kế"
              onClick={() => openModuleSettings('trishwork:open-design-settings')}
            />
          )}

          {/* Tab: Thư viện */}
          {active === 'library' && (
            <ModuleSettingsLink
              description="Cài đặt riêng cho Thư viện: ngôn ngữ, phím tắt, modules được bật, cập nhật, công cụ ngoài, sao lưu..."
              buttonLabel="Mở cài đặt Thư viện"
              onClick={() => openModuleSettings('trishwork:open-library-settings')}
            />
          )}

          {/* Tab: ISO */}
          {active === 'iso' && (
            <ModuleSettingsLink
              description="Cài đặt riêng cho ISO: sao lưu/khôi phục JSON, đồng bộ cloud (Firestore), kiểm tra cập nhật, audit log, reset dữ liệu..."
              buttonLabel="Mở cài đặt ISO"
              onClick={() => openModuleSettings('trishwork:open-iso-settings')}
            />
          )}

          {/* Tab: Tài khoản */}
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
// Sub-components
// ============================================================

function Section({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.5 }}>
      {children}
    </div>
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

function ModuleSettingsLink({
  description,
  buttonLabel,
  onClick,
}: {
  description: string;
  buttonLabel: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        {description}
      </p>
      <button
        type="button"
        onClick={onClick}
        style={{
          padding: '10px 16px',
          background: 'var(--color-accent-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        ⚙ {buttonLabel} →
      </button>
      <Hint>
        Cửa sổ cài đặt nâng cao của module sẽ mở sau khi bạn đóng modal này.
      </Hint>
    </div>
  );
}
