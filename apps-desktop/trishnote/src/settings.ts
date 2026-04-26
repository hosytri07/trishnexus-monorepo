/**
 * Phase 17.2 v4 — TrishNote settings (theme + typography).
 *
 * Thay đổi v4:
 *  - fontFamily giờ là tên family bất kỳ (font cài trên Windows), không
 *    còn enum 4 lựa chọn. Default = '' nghĩa là dùng system stack.
 *  - fontSize range mở rộng 6 → 48.
 *
 * localStorage-backed.
 */

const STORAGE_KEY = 'trishnote:settings:v1';

export type Theme = 'auto' | 'light' | 'dark';

/** Font family — tên đầy đủ (Windows-installed) hoặc '' để dùng default stack. */
export type FontFamily = string;

export interface AppSettings {
  theme: Theme;
  fontSize: number; // px, áp cho note body. Range 6-48.
  fontFamily: FontFamily;
}

export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 48;

/** System font stack — dùng khi user chưa pick font cụ thể. */
export const DEFAULT_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', sans-serif";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  fontSize: 14,
  fontFamily: '',
};

/** Build CSS font-family value với fallback. Ví dụ: "Calibri", "Segoe UI", sans-serif */
export function fontStackFor(family: string | undefined | null): string {
  const f = (family ?? '').trim();
  if (!f) return DEFAULT_FONT_STACK;
  // Bao tên trong dấu nháy nếu có khoảng trắng
  const quoted = /\s/.test(f) ? `"${f}"` : f;
  return `${quoted}, ${DEFAULT_FONT_STACK}`;
}

export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_SETTINGS.fontSize;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(size)));
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      fontFamily?: string;
    };
    // Migration v1→v4: cũ dùng enum 'system'/'serif'/'mono'/'inter' → ánh xạ
    let family = parsed.fontFamily ?? '';
    if (['system', 'serif', 'mono', 'inter'].includes(family)) {
      const legacy: Record<string, string> = {
        system: '',
        serif: 'Cambria',
        mono: 'Consolas',
        inter: 'Segoe UI',
      };
      family = legacy[family] ?? '';
    }
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fontFamily: family,
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

/**
 * Apply theme + typography to document root.
 * Theme: add class theme-light/theme-dark. Auto = follow OS prefers-color-scheme.
 * Typography: set CSS vars --note-font-size + --note-font-family.
 */
export function applySettings(s: AppSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Theme
  root.classList.remove('theme-light', 'theme-dark');
  if (s.theme !== 'auto') {
    root.classList.add(`theme-${s.theme}`);
  }

  // Typography
  root.style.setProperty('--note-font-size', `${clampFontSize(s.fontSize)}px`);
  root.style.setProperty('--note-font-family', fontStackFor(s.fontFamily));
}
