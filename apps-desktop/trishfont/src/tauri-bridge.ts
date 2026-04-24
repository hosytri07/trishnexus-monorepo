import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { FontMeta } from '@trishteam/core/fonts';

export interface ScanFontsStats {
  entries: FontMeta[];
  truncated: boolean;
  elapsed_ms: number;
  errors: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/**
 * Dev fallback seed — đủ family đa dạng để test pair matrix khi
 * chưa start Tauri. Personality seed dựa trên tên family.
 */
export const DEV_FALLBACK_SCAN: ScanFontsStats = {
  entries: [
    makeFake('Inter', 'Regular', 400, 500, false, true),
    makeFake('Inter', 'Bold', 700, 500, false, true),
    makeFake('Merriweather', 'Regular', 400, 500, false, true),
    makeFake('Merriweather', 'Bold', 700, 500, false, true),
    makeFake('Roboto Slab', 'Regular', 400, 500, false, true),
    makeFake('JetBrains Mono', 'Regular', 400, 500, true, false),
    makeFake('Bebas Neue', 'Regular', 400, 500, false, false),
    makeFake('Dancing Script', 'Regular', 400, 500, false, false),
    makeFake('Playfair Display', 'Regular', 400, 500, false, true),
    makeFake('Be Vietnam Pro', 'Regular', 400, 500, false, true),
    makeFake('Be Vietnam Pro', 'Bold', 700, 500, false, true),
  ],
  truncated: false,
  elapsed_ms: 0,
  errors: 0,
};

function makeFake(
  family: string,
  subfamily: string,
  weight: number,
  glyphs: number,
  monospace: boolean,
  vn: boolean,
): FontMeta {
  return {
    path: `/Users/dev/Library/Fonts/${family.replace(/\s+/g, '')}-${subfamily}.ttf`,
    family,
    subfamily,
    full_name: `${family} ${subfamily}`,
    postscript_name: `${family.replace(/\s+/g, '')}-${subfamily}`,
    weight,
    width: 5,
    italic: subfamily.toLowerCase().includes('italic'),
    monospace,
    vn_support: vn,
    glyph_count: glyphs,
    size_bytes: 180_000,
  };
}

export async function scanFonts(
  dir: string,
  opts?: { maxEntries?: number },
): Promise<ScanFontsStats> {
  if (!isInTauri()) return DEV_FALLBACK_SCAN;
  try {
    return await invoke<ScanFontsStats>('scan_fonts', {
      dir,
      maxEntries: opts?.maxEntries,
    });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function readFont(path: string): Promise<FontMeta> {
  if (!isInTauri()) {
    // Trả fake entry đầu trong dev fallback.
    return DEV_FALLBACK_SCAN.entries[0]!;
  }
  return invoke<FontMeta>('read_font', { path });
}

export async function pickFontDirectory(): Promise<string | null> {
  if (!isInTauri()) return '/Users/dev/Library/Fonts (dev-mode seed)';
  const res = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn thư mục font',
  });
  if (typeof res === 'string') return res;
  return null;
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}
