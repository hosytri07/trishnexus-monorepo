/**
 * Phase 15.1.d — TrishFont settings.
 *
 * Pattern copy từ TrishCheck/TrishLauncher: theme + language + sample text
 * tùy chỉnh cho preview + size slider.
 *
 * Key: `trishfont:settings:v1`. Bump khi break schema.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'vi' | 'en';

export interface Settings {
  theme: ThemeMode;
  language: Language;
  /** Sample text hiển thị trong preview. Default = pangram tiếng Việt. */
  sampleText: string;
  /** Font size px cho preview. Default 24. Slider 12-72. */
  previewSize: number;
}

// Phase 15.1.j — đổi default thành alphabet — gọn, dễ so sánh font
// Tiếng Việt diacritic giữ trên dòng riêng để vẫn check VN support
export const DEFAULT_SAMPLE_TEXT =
  'ABCDEFGHIJKLM NOPQRSTUVWXYZ abcdefghijklm nopqrstuvwxyz 0123456789 áàảãạăắằâấậđêếệôốồổơớợưứựạ';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'vi',
  sampleText: DEFAULT_SAMPLE_TEXT,
  previewSize: 18, // Phase 15.1.j — giảm 24 → 18 cho card gọn hơn
};

const STORAGE_KEY = 'trishfont:settings:v1';

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
      language: isLanguage(parsed.language) ? parsed.language : DEFAULT_SETTINGS.language,
      sampleText:
        typeof parsed.sampleText === 'string' && parsed.sampleText.trim()
          ? parsed.sampleText
          : DEFAULT_SETTINGS.sampleText,
      previewSize:
        typeof parsed.previewSize === 'number' &&
        parsed.previewSize >= 12 &&
        parsed.previewSize <= 72
          ? parsed.previewSize
          : DEFAULT_SETTINGS.previewSize,
    };
  } catch (err) {
    console.warn('[trishfont] loadSettings corrupt, reset:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[trishfont] saveSettings failed:', err);
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
