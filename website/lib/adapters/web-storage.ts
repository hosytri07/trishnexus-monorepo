/**
 * Browser localStorage implementation của StorageAdapter.
 *
 * Safe cho SSR: khi chạy server (không có window), trả null/no-op thay
 * vì throw. Shared code dùng adapter này không biết đang chạy server
 * hay client.
 *
 * Phase 14.1 (2026-04-23).
 */

import type { StorageAdapter } from '@trishteam/adapters';

export function createWebStorageAdapter(): StorageAdapter {
  const isClient = typeof window !== 'undefined' && !!window.localStorage;
  return {
    getItem(key) {
      if (!isClient) return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      if (!isClient) return;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // quota exceeded / private mode — swallow, không crash app
      }
    },
    removeItem(key) {
      if (!isClient) return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Singleton tiện dùng ở top-level component. */
export const webStorage = createWebStorageAdapter();
