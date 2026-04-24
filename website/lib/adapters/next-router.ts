'use client';

/**
 * Next.js implementation của @trishteam/adapters.RouterAdapter.
 *
 * Wrap `useRouter()` + `usePathname()` thành interface shared. Shared
 * component nhận một RouterAdapter — không biết mình chạy trên Next,
 * Tauri hay Zalo.
 *
 * Phase 14.1 (2026-04-23).
 */

import { useRouter, usePathname } from 'next/navigation';
import { useMemo } from 'react';
import type { RouterAdapter } from '@trishteam/adapters';

/**
 * Hook tạo RouterAdapter từ next/navigation. Dùng trong 'use client'
 * component để pass xuống shared UI.
 */
export function useNextRouterAdapter(): RouterAdapter {
  const router = useRouter();
  const pathname = usePathname();

  return useMemo<RouterAdapter>(
    () => ({
      pathname: pathname ?? '/',
      push: (path) => router.push(path),
      replace: (path) => router.replace(path),
      back: () => router.back(),
    }),
    [router, pathname],
  );
}
