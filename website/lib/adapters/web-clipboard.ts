/**
 * Clipboard adapter cho browser.
 *
 * Dùng Clipboard API (cần HTTPS hoặc localhost). Fallback execCommand cho
 * browser cũ — giữ interface tương thích.
 *
 * Phase 14.1 (2026-04-23).
 */

import type { ClipboardAdapter } from '@trishteam/adapters';

export function createWebClipboardAdapter(): ClipboardAdapter {
  return {
    async writeText(text) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return;
      }
      // Fallback execCommand — deprecated nhưng vẫn hoạt động.
      if (typeof document !== 'undefined') {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(el);
        }
        return;
      }
      throw new Error('No clipboard API available');
    },
    async readText() {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        return navigator.clipboard.readText();
      }
      throw new Error('Clipboard read requires navigator.clipboard');
    },
  };
}

export const webClipboard = createWebClipboardAdapter();
