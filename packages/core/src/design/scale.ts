/**
 * Tint/shade scale generator — xây 11 bậc (50, 100, 200, …, 900, 950)
 * kiểu Tailwind CSS từ 1 màu base.
 *
 * Strategy: convert base → HSL, điều chỉnh lightness theo 1 curve target
 * (mỗi bậc có target L%), giữ hue. Saturation giảm nhẹ ở các bậc tối/sáng
 * cực đoan để tránh màu "nhạt toẹt" hoặc "lặn".
 *
 * Target lightness curve (tinh chỉnh theo Tailwind v3):
 *   50  → 97, 100 → 94, 200 → 86, 300 → 77, 400 → 66
 *   500 → 55, 600 → 46, 700 → 36, 800 → 27, 900 → 18, 950 → 10
 */

import { contrastRatio, ratingFor } from './contrast.js';
import { hexToHsl, hslToHex } from './convert.js';
import type { ColorScale, ColorSwatch } from './types.js';

export const SCALE_KEYS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;

export type ScaleKey = (typeof SCALE_KEYS)[number];

/** Target lightness cho mỗi bậc (%). Kinh điển theo Tailwind. */
export const TARGET_LIGHTNESS: Record<ScaleKey, number> = {
  '50': 97,
  '100': 94,
  '200': 86,
  '300': 77,
  '400': 66,
  '500': 55,
  '600': 46,
  '700': 36,
  '800': 27,
  '900': 18,
  '950': 10,
};

/**
 * Saturation multiplier tại mỗi bậc — giảm nhẹ ở 2 đầu để tránh
 * "neon hồng" ở bậc 50/100 và "xanh lè lờ" ở 900/950.
 */
export const SAT_MULTIPLIER: Record<ScaleKey, number> = {
  '50': 0.35,
  '100': 0.5,
  '200': 0.7,
  '300': 0.85,
  '400': 0.95,
  '500': 1,
  '600': 1,
  '700': 0.95,
  '800': 0.9,
  '900': 0.85,
  '950': 0.8,
};

/**
 * Build color scale từ 1 hex base.
 * Mặc định coi base = bậc 500 (center). Nếu muốn pin base ở bậc khác
 * (vd "700"), truyền `anchorKey`.
 */
export function buildScale(
  name: string,
  baseHex: string,
  anchorKey: ScaleKey = '500',
): ColorScale {
  const baseHsl = hexToHsl(baseHex);
  const anchorTargetL = TARGET_LIGHTNESS[anchorKey];
  const anchorSatMul = SAT_MULTIPLIER[anchorKey];

  // Offset L để anchor đúng lightness base.
  const lOffset = baseHsl.l - anchorTargetL;
  // Base sat "real" — khi anchor không phải 500, chia ngược.
  const baseSat = anchorSatMul > 0 ? baseHsl.s / anchorSatMul : baseHsl.s;

  const swatches: ColorSwatch[] = SCALE_KEYS.map((key) => {
    const targetL = TARGET_LIGHTNESS[key];
    const satMul = SAT_MULTIPLIER[key];
    // Shift curve theo offset của base.
    const l = clamp(targetL + lOffset * (1 - Math.abs(targetL - 55) / 55), 2, 98);
    const s = clamp(baseSat * satMul, 0, 100);
    const hex = hslToHex({ h: baseHsl.h, s, l });
    const cw = contrastRatio(hex, '#FFFFFF');
    const cb = contrastRatio(hex, '#000000');
    return { key, hex, contrastWhite: cw, contrastBlack: cb };
  });

  return {
    name,
    base: baseHex.toUpperCase(),
    swatches,
  };
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Lookup swatch theo key. Trả undefined nếu không có. */
export function swatchByKey(
  scale: ColorScale,
  key: string,
): ColorSwatch | undefined {
  return scale.swatches.find((s) => s.key === key);
}

/**
 * Chọn swatch "an toàn" cho text trên nền bất kỳ. Ưu tiên bậc có
 * rating ≥ "AA" vs background. Fallback: swatch gần nhất đạt tối thiểu
 * "AA-large".
 */
export function pickAccessibleSwatch(
  scale: ColorScale,
  bgHex: string,
  minRating: 'AA-large' | 'AA' | 'AAA' = 'AA',
): ColorSwatch | undefined {
  const priority: Record<'AA-large' | 'AA' | 'AAA', number> = {
    'AA-large': 3,
    AA: 4.5,
    AAA: 7,
  };
  const threshold = priority[minRating];
  let best: ColorSwatch | undefined;
  let bestRatio = 0;
  for (const s of scale.swatches) {
    const r = contrastRatio(s.hex, bgHex);
    if (r >= threshold && r > bestRatio) {
      best = s;
      bestRatio = r;
    }
  }
  if (best) return best;
  // Fallback: trả swatch có contrast cao nhất dù chưa đạt threshold.
  for (const s of scale.swatches) {
    const r = contrastRatio(s.hex, bgHex);
    if (r > bestRatio) {
      best = s;
      bestRatio = r;
    }
  }
  return best;
}

/** Count số swatch đạt rating text thường (≥ AA ratio 4.5) trên bg cho trước. */
export function countAccessible(scale: ColorScale, bgHex: string): number {
  let n = 0;
  for (const s of scale.swatches) {
    const r = contrastRatio(s.hex, bgHex);
    if (ratingFor(r) === 'AA' || ratingFor(r) === 'AAA') n++;
  }
  return n;
}
