/**
 * Color harmony — luật kết hợp màu kinh điển.
 *
 * Dựa trên wheel HSL 360° — rotate hue theo offsets đặc trưng.
 *
 *   monochromatic  : shift lightness ±12 thành 3-5 tone
 *   complementary  : base + (base+180°)
 *   analogous      : base-30, base, base+30
 *   triadic        : 0, 120, 240
 *   splitComp      : base, base+150, base+210
 *   tetradic       : 0, 90, 180, 270
 */

import { hexToHsl, hslToHex } from './convert.js';
import type { Harmony, HarmonyKind } from './types.js';

function rotate(hex: string, deltaH: number, deltaL = 0, deltaS = 0): string {
  const hsl = hexToHsl(hex);
  return hslToHex({
    h: (hsl.h + deltaH + 360) % 360,
    s: Math.max(0, Math.min(100, hsl.s + deltaS)),
    l: Math.max(0, Math.min(100, hsl.l + deltaL)),
    a: hsl.a ?? 1,
  });
}

/** Xây harmony theo kind. Base là màu seed (hex). */
export function buildHarmony(kind: HarmonyKind, baseHex: string): Harmony {
  const base = baseHex.toUpperCase();
  let colors: string[];
  switch (kind) {
    case 'monochromatic':
      colors = [
        rotate(base, 0, -25),
        rotate(base, 0, -12),
        base,
        rotate(base, 0, 12),
        rotate(base, 0, 25),
      ];
      break;
    case 'complementary':
      colors = [base, rotate(base, 180)];
      break;
    case 'analogous':
      colors = [rotate(base, -30), base, rotate(base, 30)];
      break;
    case 'triadic':
      colors = [base, rotate(base, 120), rotate(base, 240)];
      break;
    case 'splitComplementary':
      colors = [base, rotate(base, 150), rotate(base, 210)];
      break;
    case 'tetradic':
      colors = [base, rotate(base, 90), rotate(base, 180), rotate(base, 270)];
      break;
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown harmony kind: ${String(exhaustive)}`);
    }
  }
  return { kind, base, colors };
}

/** Build tất cả harmony cho 1 base — dùng cho UI "explore". */
export function buildAllHarmonies(baseHex: string): Harmony[] {
  const kinds: HarmonyKind[] = [
    'monochromatic',
    'complementary',
    'analogous',
    'triadic',
    'splitComplementary',
    'tetradic',
  ];
  return kinds.map((k) => buildHarmony(k, baseHex));
}
