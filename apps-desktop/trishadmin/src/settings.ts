/**
 * TrishAdmin settings — theme + language. Persist localStorage.
 */

export type ThemeMode = 'dark' | 'light' | 'system';
export type Language = 'vi' | 'en';

export interface Settings {
  theme: ThemeMode;
  language: Language;
}

const STORAGE_KEY = 'trishadmin.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'vi',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      language: parsed.language ?? DEFAULT_SETTINGS.language,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
}

/** Apply theme bằng cách set data-theme attribute trên <html>. */
export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  let resolved: 'dark' | 'light';
  if (theme === 'system') {
    resolved =
      window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } else {
    resolved = theme;
  }
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
}
