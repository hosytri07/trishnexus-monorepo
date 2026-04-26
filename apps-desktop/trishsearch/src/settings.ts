/**
 * Phase 17.3 — TrishSearch settings (theme + font size).
 * localStorage-backed.
 */

const STORAGE_KEY = 'trishsearch:settings:v1';

export type Theme = 'auto' | 'light' | 'dark';

export interface AppSettings {
  theme: Theme;
  fontSize: number; // px, body text 12-20
}

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  fontSize: 14,
};

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_SETTINGS.fontSize;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)));
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fontSize: clampFontSize(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function applySettings(s: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Theme
  root.classList.remove('theme-light', 'theme-dark');
  if (s.theme !== 'auto') {
    root.classList.add(`theme-${s.theme}`);
  }

  // Font size
  root.style.setProperty('--app-font-size', `${clampFontSize(s.fontSize)}px`);
}
