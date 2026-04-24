/**
 * Phase 14.5.5.e — Launcher settings (persist localStorage).
 *
 * Key convention: `trishlauncher:settings:v1`. Bump version khi break
 * schema để reset sạch thay vì migrate.
 *
 * Browser dev + Tauri webview share localStorage → cùng config. Không
 * đẩy lên Rust vì 4 field này chỉ ảnh hưởng UI (theme/language) và
 * runtime fetch (registryUrl/autoUpdateInterval) — Rust process khởi
 * động lại sẽ đọc từ webview qua IPC nếu cần.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'vi' | 'en';
export type UpdateInterval = 'off' | 'daily' | 'weekly';

export interface Settings {
  theme: ThemeMode;
  language: Language;
  /** Base URL cho registry JSON (mirror/staging). Rỗng = dùng seed built-in. */
  registryUrl: string;
  autoUpdateInterval: UpdateInterval;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'vi',
  registryUrl: '',
  autoUpdateInterval: 'weekly',
};

const STORAGE_KEY = 'trishlauncher:settings:v1';

/**
 * Load từ localStorage. Merge với defaults để field mới (sau này thêm)
 * tự fill default. Corrupt JSON → fallback defaults + log warning.
 */
export function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Validate enum ngược — user tay sửa localStorage sai giá trị →
      // rơi về default an toàn thay vì crash UI.
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      language: isLanguage(parsed.language)
        ? parsed.language
        : DEFAULT_SETTINGS.language,
      autoUpdateInterval: isInterval(parsed.autoUpdateInterval)
        ? parsed.autoUpdateInterval
        : DEFAULT_SETTINGS.autoUpdateInterval,
      registryUrl:
        typeof parsed.registryUrl === 'string'
          ? parsed.registryUrl.trim()
          : DEFAULT_SETTINGS.registryUrl,
    };
  } catch (err) {
    console.warn('[trishlauncher] loadSettings corrupt, reset:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[trishlauncher] saveSettings failed:', err);
  }
}

/**
 * Apply theme lên document.documentElement — dùng `data-theme` attribute
 * để CSS switch vars. Mode 'system' → gỡ attribute, CSS dùng
 * @media (prefers-color-scheme) fallback.
 */
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

function isInterval(v: unknown): v is UpdateInterval {
  return v === 'off' || v === 'daily' || v === 'weekly';
}
