/**
 * Phase 17.5 — TrishImage settings (theme + viewMode + font).
 * localStorage-backed.
 */

const STORAGE_KEY = 'trishimage:settings:v2';

export type Theme = 'auto' | 'light' | 'dark';

/**
 * View modes giống Windows Explorer:
 *  - xl  : Extra Large (~240px tile)
 *  - l   : Large (~180px tile)
 *  - m   : Medium (~140px tile)
 *  - s   : Small (~96px tile)
 *  - details : Bảng chi tiết (1 row/file, ko thumbnail to)
 */
export type ViewMode = 'xl' | 'l' | 'm' | 's' | 'details';

export interface AppSettings {
  theme: Theme;
  viewMode: ViewMode;
  fontSize: number; // 12-18 px
}

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 18;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  viewMode: 'm',
  fontSize: 14,
};

const VALID_VIEW_MODES: ReadonlyArray<ViewMode> = ['xl', 'l', 'm', 's', 'details'];

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const viewMode = VALID_VIEW_MODES.includes(parsed.viewMode as ViewMode)
      ? (parsed.viewMode as ViewMode)
      : DEFAULT_SETTINGS.viewMode;
    return {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      viewMode,
      fontSize: clamp(parsed.fontSize ?? DEFAULT_SETTINGS.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX),
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

  root.classList.remove('theme-light', 'theme-dark');
  if (s.theme !== 'auto') {
    root.classList.add(`theme-${s.theme}`);
  }
  root.style.setProperty('--app-font-size', `${s.fontSize}px`);
}
