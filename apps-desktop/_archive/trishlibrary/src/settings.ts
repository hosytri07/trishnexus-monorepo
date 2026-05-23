/**
 * Phase 15.2.b — TrishLibrary settings.
 *
 * Pattern copy từ TrishFont/TrishCheck: theme + language.
 * Key: `trishlibrary:settings:v1`. Bump khi break schema.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'vi' | 'en';

export interface Settings {
  theme: ThemeMode;
  language: Language;
  /** Phase 15.2.r8 — folder thư viện gốc user chọn. Empty = chưa chọn. */
  library_root: string;
  /** Phase 15.2.r10 — tên hiển thị của thư viện. User đổi được. */
  library_name: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'vi',
  library_root: '',
  library_name: 'Thư viện 1',
};

const STORAGE_KEY = 'trishlibrary:settings:v1';

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
      library_root:
        typeof parsed.library_root === 'string' ? parsed.library_root : '',
      library_name:
        typeof parsed.library_name === 'string' && parsed.library_name.trim()
          ? parsed.library_name
          : DEFAULT_SETTINGS.library_name,
    };
  } catch (err) {
    console.warn('[trishlibrary] loadSettings corrupt, reset:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[trishlibrary] saveSettings failed:', err);
  }
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

function isTheme(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

function isLanguage(v: unknown): v is Language {
  return v === 'vi' || v === 'en';
}
