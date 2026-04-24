/**
 * AI enhancement — suggestPalette.
 *
 * Từ 1 màu base + mode ('light' | 'dark' | 'brand') sinh ra 1 palette hoàn
 * chỉnh gồm: primary scale, secondary (complementary), accent (triadic),
 * neutral scale, semantic alias cơ bản, + meta notes giải thích.
 *
 * Tự động chọn semantic "primary.text" / "primary.bg" đạt WCAG AA nếu có.
 */

import { buildHarmony } from './harmony.js';
import { buildScale, pickAccessibleSwatch, SCALE_KEYS } from './scale.js';
import { createEmptyTokenSet, mergeTokenSets } from './tokens.js';
import { hexToHsl, hslToHex, normalizeHex } from './convert.js';
import type {
  ColorScale,
  DesignTokenSet,
  PaletteMode,
} from './types.js';

export interface PaletteSuggestion {
  set: DesignTokenSet;
  /** Ghi chú giải thích (VN) — dùng cho UI. */
  notes: string[];
}

/** Build palette đề xuất từ hex base + mode. */
export function suggestPalette(
  baseHex: string,
  mode: PaletteMode = 'light',
  name = 'Đề xuất',
): PaletteSuggestion {
  const base = normalizeHex(baseHex);
  const hsl = hexToHsl(base);
  const notes: string[] = [];

  // 1. Primary scale từ base.
  const primary = buildScale('primary', base, '500');
  notes.push(
    `Primary scale xây quanh hue ${Math.round(hsl.h)}°, saturation ${Math.round(
      hsl.s,
    )}%.`,
  );

  // 2. Secondary = complementary. Giảm saturation 15% để không chói.
  const compHsl = { h: (hsl.h + 180) % 360, s: Math.max(20, hsl.s - 15), l: 55 };
  const secondaryBase = hslToHex(compHsl);
  const secondary = buildScale('secondary', secondaryBase, '500');
  notes.push(`Secondary = complementary (+180°) giảm saturation 15%.`);

  // 3. Accent = triadic (+120°), boost sat nhẹ để CTA pop.
  const accentHsl = {
    h: (hsl.h + 120) % 360,
    s: Math.min(95, hsl.s + 10),
    l: 55,
  };
  const accentBase = hslToHex(accentHsl);
  const accent = buildScale('accent', accentBase, '500');
  notes.push(`Accent = triadic (+120°) boost saturation 10% cho CTA.`);

  // 4. Neutral — xám lệch nhẹ theo hue của base (không flat 100% gray).
  const neutralBase = hslToHex({ h: hsl.h, s: 8, l: 50 });
  const neutral = buildScale('neutral', neutralBase, '500');
  notes.push(`Neutral = grayscale lệch hue của primary 8% saturation.`);

  // 5. Status scale — success/warning/danger theo chuẩn.
  const success = buildScale('success', '#16A34A', '500');
  const warning = buildScale('warning', '#EAB308', '500');
  const danger = buildScale('danger', '#DC2626', '500');

  // 6. Mode-driven background / surface.
  const bgKey = mode === 'dark' ? '950' : '50';
  const surfaceKey = mode === 'dark' ? '900' : '100';
  const textKey = mode === 'dark' ? '50' : '900';

  const semantic: Record<string, string> = {
    'primary.default': 'primary.500',
    'primary.hover': mode === 'dark' ? 'primary.400' : 'primary.600',
    'primary.subtle': mode === 'dark' ? 'primary.900' : 'primary.100',
    background: `neutral.${bgKey}`,
    surface: `neutral.${surfaceKey}`,
    text: `neutral.${textKey}`,
    muted: mode === 'dark' ? 'neutral.400' : 'neutral.600',
    border: mode === 'dark' ? 'neutral.800' : 'neutral.200',
    success: 'success.500',
    warning: 'warning.500',
    danger: 'danger.500',
  };

  // 7. Check accessibility cho primary text trên background.
  const bgSwatch = neutral.swatches.find((s) => s.key === bgKey);
  if (bgSwatch) {
    const safe = pickAccessibleSwatch(primary, bgSwatch.hex, 'AA');
    if (safe) {
      semantic['primary.onBg'] = `primary.${safe.key}`;
      notes.push(
        `Text primary trên background = primary.${safe.key} (AA compliant).`,
      );
    } else {
      notes.push(
        `⚠️ Không có swatch primary nào đạt AA trên background — cân nhắc đổi hue base.`,
      );
    }
  }

  // 8. Xây token set.
  const set0 = createEmptyTokenSet(
    slugify(name),
    name,
    primary,
  );
  const scales: ColorScale[] = [secondary, accent, neutral, success, warning, danger];
  const set = mergeTokenSets(set0, {
    scales,
    semantic,
    description: `Palette ${mode} mode xây từ ${base}.`,
  });

  // 9. Bonus — build harmony info và ghi chú.
  const harmony = buildHarmony('tetradic', base);
  notes.push(
    `Harmony tetradic (00°/90°/180°/270°): ${harmony.colors.join(', ')}.`,
  );

  // Đếm số swatch đạt AA để chia sẻ confidence.
  let okCount = 0;
  for (const scale of set.scales) {
    for (const sw of scale.swatches) {
      if (bgSwatch && sw.hex !== bgSwatch.hex) {
        const cBg = sw.contrastWhite; // placeholder — sẽ được tính khi build
        if (cBg >= 4.5) okCount++;
      }
    }
  }
  notes.push(
    `Tổng swatch (${SCALE_KEYS.length} × ${set.scales.length}) có ${okCount} đạt AA ratio vs trắng.`,
  );

  return { set, notes };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
