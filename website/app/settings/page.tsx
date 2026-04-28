'use client';

/**
 * /settings — Phase 19.9 — Cài đặt user.
 *
 * Sections:
 *   - Giao diện (theme dark/light)
 *   - Ngôn ngữ (vi/en — placeholder, chưa wire i18n)
 *   - Thông báo (browser push toggle — placeholder)
 *   - Tài khoản (link tới /profile + đăng xuất)
 *   - Dữ liệu (clear localStorage / export notes)
 *   - Về ứng dụng (version + links)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Database,
  Globe,
  Info,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  Sun,
  UserCircle2,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/lib/auth-context';
import { useConfirm } from '@/components/confirm-modal';
import {
  loadPrefs,
  savePrefs,
  requestPushPermission,
  TOPIC_LIST,
  DEFAULT_PREFS,
  type NotificationPrefs,
} from '@/lib/notification-prefs';

type Lang = 'vi' | 'en';

const LANG_KEY = 'trishteam:lang';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();

  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'vi';
    return (window.localStorage.getItem(LANG_KEY) as Lang) ?? 'vi';
  });

  // Phase 19.22 — multi-topic notification prefs
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [permState, setPermState] = useState<NotificationPermission>('default');
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPrefs(user?.id ?? null).then((p) => {
      if (cancelled) return;
      setPrefs(p);
      setPrefsLoading(false);
    });
    if (typeof Notification !== 'undefined') {
      setPermState(Notification.permission);
    }
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function persist(next: NotificationPrefs) {
    setSavingPrefs(true);
    setPrefs(next);
    try {
      await savePrefs(user?.id ?? null, next);
    } finally {
      setSavingPrefs(false);
    }
  }

  function setMaster(v: boolean) {
    void persist({ ...prefs, enabled: v });
  }

  function setTopic(topic: keyof NotificationPrefs['topics'], v: boolean) {
    void persist({ ...prefs, topics: { ...prefs.topics, [topic]: v } });
  }

  async function handleRequestPermission() {
    const perm = await requestPushPermission();
    setPermState(perm);
    if (perm === 'granted' && !prefs.enabled) {
      void persist({ ...prefs, enabled: true });
    }
  }

  function setLang(l: Lang) {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }

  async function clearLocalData() {
    const ok = await askConfirm({
      title: 'Xoá toàn bộ dữ liệu local?',
      message: 'Note nháp, theme, sidebar trạng thái... sẽ bị xoá. Không thể khôi phục. Notes đã đăng nhập vẫn an toàn trên Firestore.',
      okLabel: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    try {
      // Chỉ xóa key có prefix trishteam: để tránh ảnh hưởng key của domain khác
      const keys = Object.keys(localStorage);
      keys.forEach((k) => {
        if (k.startsWith('trishteam:') || k.startsWith('trishteam.')) {
          localStorage.removeItem(k);
        }
      });
      alert('Đã xóa dữ liệu local. Reload trang để áp dụng.');
    } catch (err) {
      alert('Không xóa được: ' + String(err));
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <ConfirmDialog />
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-8 flex items-center gap-3">
        <SettingsIcon size={28} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
        <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Cài đặt
        </h1>
      </header>

      <div className="space-y-5">
        {/* Theme */}
        <Section icon={<Moon size={18} />} title="Giao diện">
          <div className="grid grid-cols-2 gap-2">
            <ThemeButton
              active={theme === 'dark'}
              onClick={() => setTheme('dark')}
              icon={<Moon size={16} />}
              label="Tối"
            />
            <ThemeButton
              active={theme === 'light'}
              onClick={() => setTheme('light')}
              icon={<Sun size={16} />}
              label="Sáng"
            />
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Theme đồng bộ với desktop apps qua attribute <code>data-theme</code>.
          </p>
        </Section>

        {/* Language */}
        <Section icon={<Globe size={18} />} title="Ngôn ngữ">
          <div className="grid grid-cols-2 gap-2">
            <PillButton active={lang === 'vi'} onClick={() => setLang('vi')} label="🇻🇳 Tiếng Việt" />
            <PillButton active={lang === 'en'} onClick={() => setLang('en')} label="🇬🇧 English" />
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
            Hiện chỉ lưu preference. Bản dịch tiếng Anh sẽ được wire sau (Phase 20).
          </p>
        </Section>

        {/* Notifications — Phase 19.22 multi-topic */}
        <Section icon={<Bell size={18} />} title="Thông báo">
          {prefsLoading ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Đang tải tuỳ chỉnh...
            </p>
          ) : (
            <>
              {/* Permission status */}
              {permState !== 'granted' && (
                <div
                  className="flex items-start gap-3 p-3 rounded-md mb-4"
                  style={{
                    background: permState === 'denied' ? 'rgba(239,68,68,0.10)' : 'var(--color-accent-soft)',
                    borderLeft: `3px solid ${permState === 'denied' ? '#EF4444' : 'var(--color-accent-primary)'}`,
                  }}
                >
                  <Bell size={16} className="mt-0.5 shrink-0" style={{ color: permState === 'denied' ? '#EF4444' : 'var(--color-accent-primary)' }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                      {permState === 'denied' ? 'Bạn đã chặn thông báo' : 'Cần cấp quyền browser'}
                    </p>
                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {permState === 'denied'
                        ? 'Vào cài đặt trình duyệt cho domain TrishTEAM để bật lại.'
                        : 'Bấm để cấp quyền nhận thông báo qua trình duyệt.'}
                    </p>
                    {permState !== 'denied' && (
                      <button
                        type="button"
                        onClick={handleRequestPermission}
                        className="inline-flex items-center gap-1.5 px-3 h-7 rounded text-xs font-semibold"
                        style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
                      >
                        Cấp quyền
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Master toggle */}
              <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <Toggle
                  checked={prefs.enabled}
                  onChange={setMaster}
                  label="Bật thông báo"
                  description="Toggle chính. Tắt = không nhận bất kỳ thông báo nào dù từng topic đang bật."
                />
              </div>

              {/* Per-topic toggles */}
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Loại thông báo
              </p>
              <div className="space-y-3.5">
                {TOPIC_LIST.map((t) => (
                  <Toggle
                    key={t.key}
                    checked={prefs.enabled && prefs.topics[t.key]}
                    onChange={(v) => setTopic(t.key, v)}
                    label={`${t.icon} ${t.label}`}
                    description={t.description}
                  />
                ))}
              </div>

              {savingPrefs && (
                <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                  💾 Đang lưu...
                </p>
              )}
              {!isAuthenticated && (
                <p className="text-[11px] mt-3 italic" style={{ color: 'var(--color-text-muted)' }}>
                  Đăng nhập để đồng bộ tuỳ chỉnh giữa các thiết bị.
                </p>
              )}
            </>
          )}
        </Section>

        {/* Account */}
        <Section icon={<UserCircle2 size={18} />} title="Tài khoản">
          {isAuthenticated && user ? (
            <>
              <div
                className="flex items-center justify-between p-3 rounded-md mb-3"
                style={{ background: 'var(--color-surface-bg_elevated)' }}
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {user.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {user.email} · {user.plan}
                  </div>
                </div>
                <Link
                  href="/profile"
                  className="text-xs px-3 h-7 rounded inline-flex items-center font-semibold"
                  style={{
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  Chi tiết
                </Link>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const ok = await askConfirm({
                    title: 'Đăng xuất?',
                    message: 'Bạn sẽ phải đăng nhập lại để xem dữ liệu cá nhân.',
                    okLabel: 'Đăng xuất',
                  });
                  if (ok) void logout();
                }}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
              >
                <LogOut size={14} /> Đăng xuất
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold"
              style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
            >
              Đăng nhập / Đăng ký
            </Link>
          )}
        </Section>

        {/* Data */}
        <Section icon={<Database size={18} />} title="Dữ liệu">
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Dữ liệu local lưu trong trình duyệt (theme, sidebar trạng thái, note quick-saves).
            Notes của tài khoản đã đăng nhập vẫn an toàn trên Firestore.
          </p>
          <button
            type="button"
            onClick={clearLocalData}
            className="inline-flex items-center gap-2 px-3 h-9 rounded-md text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
          >
            Xóa dữ liệu local
          </button>
        </Section>

        {/* About */}
        <Section icon={<Info size={18} />} title="Về TrishTEAM">
          <div className="text-sm space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
            <p>
              <strong style={{ color: 'var(--color-text-primary)' }}>Website</strong> v0.19
              · <Link href="/blog" className="underline" style={{ color: 'var(--color-accent-primary)' }}>Blog</Link>
              {' · '}
              <Link href="/downloads" className="underline" style={{ color: 'var(--color-accent-primary)' }}>Tải về</Link>
            </p>
            <p>
              <strong style={{ color: 'var(--color-text-primary)' }}>Liên hệ</strong>:{' '}
              <a
                href="mailto:trishteam.official@gmail.com"
                className="underline"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                trishteam.official@gmail.com
              </a>
            </p>
            <p>© 2026 TrishTEAM — Hệ sinh thái năng suất cá nhân</p>
          </div>
        </Section>
      </div>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <h2
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 h-12 rounded-md text-sm font-semibold transition-all"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: `1.5px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PillButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center h-10 rounded-md text-sm font-semibold transition-all"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        border: `1.5px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {label}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 inline-flex items-center w-11 h-6 rounded-full transition-colors"
        style={{
          background: checked ? 'var(--color-accent-primary)' : 'var(--color-surface-muted)',
        }}
      >
        <span
          className="block w-5 h-5 rounded-full bg-white transition-transform"
          style={{
            transform: checked ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}
