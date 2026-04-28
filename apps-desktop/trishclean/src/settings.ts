/**
 * TrishClean Settings — localStorage-backed, no backend.
 * Phase 17.1.
 */

const STORAGE_KEY = 'trishclean:settings:v1';

export type Theme = 'auto' | 'light' | 'dark';

export interface AppSettings {
  theme: Theme;
  retentionDays: number; // số ngày giữ trash trước auto-purge
  autoPurgeOnLaunch: boolean;
  autoCheckUpdate: boolean;
  confirmBeforeClean: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  retentionDays: 7,
  autoPurgeOnLaunch: true,
  autoCheckUpdate: true,
  confirmBeforeClean: true,
};

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
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

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  if (theme === 'auto') {
    // Để CSS prefers-color-scheme tự handle
    return;
  }
  root.classList.add(`theme-${theme}`);
}
