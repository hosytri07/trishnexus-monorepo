/**
 * @trishteam/design-system — Phase 24.3 unified theme + utility CSS.
 *
 * Single entry: `import '@trishteam/design-system'` ở consumer main.tsx
 * sẽ bundle Plus Jakarta Sans woff2 + theme tokens + utility classes.
 *
 * Equivalent verbose: `import '@trishteam/design-system/fonts';
 *                      import '@trishteam/design-system/theme.css';`
 *
 * Theme tokens:
 *   --color-accent-primary: #059669 (emerald-600 light) / #34d399 (emerald-400 dark)
 *   --color-surface-bg: cream (#f4f3f0) / dark warm (#14161b)
 *   --color-text-primary: #1c1b22 / #e5e7eb
 *   ...full list trong theme.css
 *
 * Theme switching: set `<html data-theme="light">` hoặc `data-theme="dark"`.
 * Mặc định (no attribute): light theme (gold standard TrishDrive).
 *
 * Utility classes scope `.drive-panel` (legacy) HOẶC `.ds-panel` (new):
 *   flex, items-center, gap-N, p-N, rounded-N, text-N, font-N, etc.
 *
 * Note: Tailwind v4 framework KHÔNG dùng (gây regression form input). Utility
 * classes ship sẵn trong theme.css.
 */

// Side-effect imports — Vite/bundler sẽ inject CSS + font.
import './fonts';
import './theme.css';

/** Theme mode helper. Set trên `document.documentElement.setAttribute('data-theme', mode)`. */
export type ThemeMode = 'light' | 'dark';

/** Apply theme to HTML root. Persist localStorage if key provided. */
export function applyTheme(mode: ThemeMode, persistKey?: string): void {
  document.documentElement.setAttribute('data-theme', mode);
  if (persistKey) {
    try { localStorage.setItem(persistKey, mode); } catch { /* ignore */ }
  }
}

/** Read persisted theme from localStorage. Default 'light'. */
export function loadTheme(persistKey: string): ThemeMode {
  try {
    const v = localStorage.getItem(persistKey);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* ignore */ }
  return 'light';
}
