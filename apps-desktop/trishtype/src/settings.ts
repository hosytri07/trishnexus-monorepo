/**
 * Phase 17.6 v2 — TrishType settings.
 * Document editor + converter mode.
 */

const STORAGE_KEY = 'trishtype:settings:v3';

export type Theme = 'auto' | 'light' | 'dark';
export type EditorFontFamily = 'system' | 'serif' | 'georgia' | 'times' | 'mono';

export interface AppSettings {
  theme: Theme;
  uiFontSize: number; // 12-16 — UI chrome size
  editorFontFamily: EditorFontFamily;
  editorFontSize: number; // 12-22
  editorZoom: number; // 0.5-2.0
  autoSave: boolean;
  autoSaveDelayMs: number;
  defaultExportFormat: 'docx' | 'md' | 'pdf' | 'html' | 'txt';
  showOutline: boolean;
  showStats: boolean;
  autoFormatPaste: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  uiFontSize: 14,
  editorFontFamily: 'system',
  editorFontSize: 16,
  editorZoom: 1.0,
  autoSave: true,
  autoSaveDelayMs: 1500,
  defaultExportFormat: 'docx',
  showOutline: true,
  showStats: false,
  autoFormatPaste: true,
};

const VALID_THEMES: ReadonlyArray<Theme> = ['auto', 'light', 'dark'];
const VALID_FONTS: ReadonlyArray<EditorFontFamily> = [
  'system',
  'serif',
  'georgia',
  'times',
  'mono',
];
const VALID_EXPORTS: ReadonlyArray<AppSettings['defaultExportFormat']> = [
  'docx',
  'md',
  'pdf',
  'html',
  'txt',
];

export function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: VALID_THEMES.includes(parsed.theme as Theme)
        ? (parsed.theme as Theme)
        : DEFAULT_SETTINGS.theme,
      uiFontSize: Math.round(clamp(parsed.uiFontSize ?? DEFAULT_SETTINGS.uiFontSize, 12, 16)),
      editorFontFamily: VALID_FONTS.includes(parsed.editorFontFamily as EditorFontFamily)
        ? (parsed.editorFontFamily as EditorFontFamily)
        : DEFAULT_SETTINGS.editorFontFamily,
      editorFontSize: Math.round(
        clamp(parsed.editorFontSize ?? DEFAULT_SETTINGS.editorFontSize, 12, 22),
      ),
      editorZoom: clamp(parsed.editorZoom ?? DEFAULT_SETTINGS.editorZoom, 0.5, 2.0),
      autoSave:
        typeof parsed.autoSave === 'boolean' ? parsed.autoSave : DEFAULT_SETTINGS.autoSave,
      autoSaveDelayMs: Math.round(
        clamp(parsed.autoSaveDelayMs ?? DEFAULT_SETTINGS.autoSaveDelayMs, 500, 5000),
      ),
      defaultExportFormat: VALID_EXPORTS.includes(
        parsed.defaultExportFormat as AppSettings['defaultExportFormat'],
      )
        ? (parsed.defaultExportFormat as AppSettings['defaultExportFormat'])
        : DEFAULT_SETTINGS.defaultExportFormat,
      showOutline:
        typeof parsed.showOutline === 'boolean'
          ? parsed.showOutline
          : DEFAULT_SETTINGS.showOutline,
      showStats:
        typeof parsed.showStats === 'boolean' ? parsed.showStats : DEFAULT_SETTINGS.showStats,
      autoFormatPaste:
        typeof parsed.autoFormatPaste === 'boolean'
          ? parsed.autoFormatPaste
          : DEFAULT_SETTINGS.autoFormatPaste,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
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
  root.style.setProperty('--app-font-size', `${s.uiFontSize}px`);
}

export function resolveEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function editorFontStack(f: EditorFontFamily): string {
  switch (f) {
    case 'serif':
      return "'Charter', 'Iowan Old Style', 'Source Serif Pro', Cambria, Georgia, serif";
    case 'georgia':
      return "Georgia, 'Times New Roman', serif";
    case 'times':
      return "'Times New Roman', Times, serif";
    case 'mono':
      return "'Cascadia Code', 'JetBrains Mono', Consolas, monospace";
    case 'system':
    default:
      return "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  }
}
