/**
 * Phase 15.0 — TrishCheck settings (persist localStorage).
 *
 * Pattern copy từ TrishLauncher: theme + language + auto-snapshot toggle.
 *
 * Key: `trishcheck:settings:v1`. Bump khi break schema để reset thay vì migrate.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'vi' | 'en';

export interface Settings {
  theme: ThemeMode;
  language: Language;
  /**
   * Tự lưu snapshot mỗi lần benchmark xong. User có thể tắt nếu thấy
   * spam history.
   */
  autoSnapshot: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'vi',
  autoSnapshot: true,
};

const STORAGE_KEY = 'trishcheck:settings:v1';

export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      language: isLanguage(parsed.language)
        ? parsed.language
        : DEFAULT_SETTINGS.language,
      autoSnapshot:
        typeof parsed.autoSnapshot === 'boolean'
          ? parsed.autoSnapshot
          : DEFAULT_SETTINGS.autoSnapshot,
    };
  } catch (err) {
    console.warn('[trishcheck] loadSettings corrupt, reset:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[trishcheck] saveSettings failed:', err);
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

function isTheme(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

function isLanguage(v: unknown): v is Language {
  return v === 'vi' || v === 'en';
}
