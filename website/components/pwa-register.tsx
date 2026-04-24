'use client';

/**
 * PwaRegister — Phase 11.9.3.
 *
 * Đăng ký `/sw.js` khi component mount. Chỉ chạy ở production để tránh
 * cache code khi đang `next dev` (stale HMR). Nếu browser không hỗ trợ
 * Service Worker thì no-op.
 *
 * Khi phát hiện SW mới đã installed (updatefound + state === 'installed'),
 * gửi message 'SKIP_WAITING' để activate ngay — UX mượt hơn là chờ reload.
 */

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Dev: skip để HMR hoạt động bình thường.
    // Có thể bật mock qua ?sw=1 khi cần test offline ở dev.
    const isDev = process.env.NODE_ENV !== 'production';
    const forceDev =
      isDev && typeof window.location !== 'undefined' &&
      window.location.search.includes('sw=1');
    if (isDev && !forceDev) return;

    let cancelled = false;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        if (cancelled) return;

        // Nếu có update đang chờ → skipWaiting.
        if (reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
        }
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // Có bản mới — bảo SW activate ngay.
              sw.postMessage('SKIP_WAITING');
            }
          });
        });
      } catch (err) {
        // Không fail hard — chỉ log để devtools thấy.
        console.warn('[pwa] SW register failed:', err);
      }
    };

    // Đợi window load để tránh tranh tài nguyên khi first paint.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
