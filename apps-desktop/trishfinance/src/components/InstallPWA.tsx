/**
 * InstallPWA — Phase 27.3.C.
 *
 * Banner gợi ý "Cài đặt app" khi Chrome/Edge detect manifest hợp lệ.
 * Browser fire `beforeinstallprompt` event → save event + show banner.
 * User click → prompt() → user choose Cài đặt hoặc Hủy.
 *
 * iOS Safari KHÔNG fire event này — show fallback hint khác cho iOS.
 *
 * Auto-hide nếu app đã chạy ở standalone mode (đã cài).
 */

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export function InstallPWA(): JSX.Element | null {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('trishfinance:install_dismissed') === '1'; } catch { return false; }
  });
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect đã cài (standalone display mode)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(display-mode: standalone)');
      setIsStandalone(mq.matches || (window.navigator as any).standalone === true);
    }
    // iOS detection
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua) && !(window as any).MSStream);

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('[PWA] TrishFinance installed');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  function handleInstall() {
    if (!deferredPrompt) return;
    void deferredPrompt.prompt();
    void deferredPrompt.userChoice.then((res) => {
      if (res.outcome === 'accepted') {
        console.log('[PWA] User accepted install');
      }
      setDeferredPrompt(null);
    });
  }

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem('trishfinance:install_dismissed', '1'); } catch {}
  }

  // Đã cài hoặc đã dismiss → ẩn
  if (isStandalone || dismissed) return null;

  // Chrome/Edge với event detected → show banner Cài đặt
  if (deferredPrompt) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
          left: 12,
          right: 12,
          zIndex: 95,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-accent-primary)',
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 8px 32px rgba(16,185,129,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Smartphone style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Cài đặt TrishFinance
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Mở nhanh từ màn hình chính, chạy như app native
          </div>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="btn-primary"
          style={{ padding: '8px 14px', fontSize: 12, flexShrink: 0 }}
        >
          <Download className="h-4 w-4" /> Cài
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="icon-btn"
          style={{ flexShrink: 0 }}
          title="Bỏ qua"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // iOS Safari (không có beforeinstallprompt) → show hint
  if (isIOS) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
          left: 12,
          right: 12,
          zIndex: 95,
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Smartphone style={{ width: 24, height: 24, color: 'var(--color-accent-primary)', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
          Cài đặt: nhấn nút <b>Chia sẻ</b> ⎙ → <b>Thêm vào Màn hình chính</b>
        </div>
        <button type="button" onClick={handleDismiss} className="icon-btn" style={{ flexShrink: 0 }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}
