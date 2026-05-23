/**
 * TrishDesign — Theme manager.
 *
 * Set `data-theme="light|dark"` trên `<html>` để CSS vars chuyển theo.
 * Hỗ trợ 'auto' = follow system (prefers-color-scheme).
 *
 * Persist localStorage 'trishdesign:theme' = 'auto' | 'light' | 'dark'.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large';

const STORAGE_KEY = 'trishdesign:theme';
const FONT_SIZE_KEY = 'trishdesign:fontSize';

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

/** Đọc theme đã save, default 'dark' (đồng bộ ecosystem TrishTEAM) */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'medium';
  try {
    const v = window.localStorage.getItem(FONT_SIZE_KEY);
    if (v === 'small' || v === 'medium' || v === 'large') return v;
  } catch {
    /* ignore */
  }
  return 'medium';
}

/** Resolve 'auto' → 'light' hoặc 'dark' theo system */
function resolveAuto(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/** Apply theme vào DOM (set data-theme attribute) */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const resolved = mode === 'auto' ? resolveAuto() : mode;
  html.setAttribute('data-theme', resolved);
  html.style.colorScheme = resolved;
}

/** Apply font size (root font-size, propagate qua rem nếu có) */
export function applyFontSize(size: FontSize): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const map: Record<FontSize, string> = {
    small: '12px',
    medium: '13px',
    large: '15px',
  };
  html.style.setProperty('--td-base-font-size', map[size]);
  document.body.style.fontSize = map[size];
}

/** Save + apply theme */
export function setTheme(mode: ThemeMode): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }
  applyTheme(mode);
  // Re-listen prefers-color-scheme nếu auto, unsubscribe nếu manual
  setupAutoListener(mode === 'auto');
}

export function setFontSize(size: FontSize): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FONT_SIZE_KEY, size);
    } catch {
      /* ignore */
    }
  }
  applyFontSize(size);
}

function setupAutoListener(enable: boolean): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
    mediaQuery = null;
    mediaListener = null;
  }
  if (!enable) return;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaListener = (): void => {
    applyTheme('auto');
  };
  mediaQuery.addEventListener('change', mediaListener);
}

/** Init: gọi 1 lần khi app mount */
export function initTheme(): void {
  const mode = getStoredTheme();
  const size = getStoredFontSize();
  applyTheme(mode);
  applyFontSize(size);
  setupAutoListener(mode === 'auto');
}
