'use client';

/**
 * ThemeProvider — 2-theme system (dark default + light).
 *
 * Cơ chế:
 *   1. Server render <html data-theme="dark"> (layout.tsx) — match CSS vars :root.
 *   2. Client mount đọc localStorage 'trishteam:theme' → nếu có, set attr tương ứng.
 *      Nếu không có, giữ default 'dark'.
 *   3. setTheme() persist ngay vào localStorage.
 *
 * Không dùng next-themes vì:
 *   - next-themes swap class .dark, nhưng ta swap [data-theme='light']
 *     cho nhất quán với desktop QSS (dùng property selector).
 *   - 1 dependency ít hơn.
 *
 * Alias handling: persist file cũ có thể chứa 'trishwarm'/'candy'. Hàm
 * `resolveAlias` map về 'dark'/'light' — đồng bộ với desktop theme_manager.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'dark' | 'light';
type ThemeCtx = { theme: Theme; setTheme: (t: Theme | string) => void };

const STORAGE_KEY = 'trishteam:theme';
const DEFAULT: Theme = 'dark';

const ALIASES: Record<string, Theme> = {
  trishwarm: 'dark',
  midnight: 'dark',
  aurora: 'dark',
  sunset: 'dark',
  ocean: 'dark',
  forest: 'dark',
  candy: 'light',
};

function resolveAlias(raw: string | null | undefined): Theme {
  if (!raw) return DEFAULT;
  if (raw === 'dark' || raw === 'light') return raw;
  return ALIASES[raw] ?? DEFAULT;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT);

  // Hydrate từ localStorage sau mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const resolved = resolveAlias(raw);
      setThemeState(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } catch {
      /* localStorage disabled (private mode) — giữ default */
    }
  }, []);

  const setTheme = (t: Theme | string) => {
    const resolved = resolveAlias(t);
    setThemeState(resolved);
    try {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', resolved);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be inside <ThemeProvider>');
  return ctx;
}
