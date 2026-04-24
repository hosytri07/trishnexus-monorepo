/**
 * WCAG 2.1 contrast + relative luminance.
 *
 *   L = 0.2126·R + 0.7152·G + 0.0722·B
 *   với R/G/B = sRGB-to-linear (piecewise).
 *
 *   ratio = (L_light + 0.05) / (L_dark + 0.05)
 *
 * Rating (text ≥ 18pt regular / ≥ 14pt bold được coi là "large"):
 *   AAA       ≥ 7.0    (large 4.5)
 *   AA        ≥ 4.5    (large 3.0)
 *   AA-large  ≥ 3.0    (text thường fail)
 *   fail      < 3.0
 */

import { hexToRgb } from './convert.js';
import type { ContrastCell, ContrastRating } from './types.js';

/** WCAG relative luminance ∈ [0, 1] cho 1 hex. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (ch: number): number => {
    const c = ch / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** Contrast ratio ∈ [1, 21] giữa 2 màu hex. Trả về round 2 chữ số. */
export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  const raw = (light + 0.05) / (dark + 0.05);
  return Math.round(raw * 100) / 100;
}

/** Rating normal text cho 1 ratio. */
export function ratingFor(ratio: number): ContrastRating {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/** True nếu ratio đạt tiêu chuẩn. */
export function meetsAA(ratio: number, largeText = false): boolean {
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

export function meetsAAA(ratio: number, largeText = false): boolean {
  return largeText ? ratio >= 4.5 : ratio >= 7;
}

/** Tính ma trận contrast cho mọi cặp (fg, bg) trong `colors`. */
export function buildContrastMatrix(colors: string[]): ContrastCell[][] {
  return colors.map((fg) =>
    colors.map<ContrastCell>((bg) => {
      const ratio = contrastRatio(fg, bg);
      return { fg, bg, ratio, rating: ratingFor(ratio) };
    }),
  );
}

/** Chọn foreground (đen hoặc trắng) có contrast cao hơn so với bg. */
export function bestForegroundOn(bgHex: string): '#000000' | '#FFFFFF' {
  const rWhite = contrastRatio('#FFFFFF', bgHex);
  const rBlack = contrastRatio('#000000', bgHex);
  return rWhite >= rBlack ? '#FFFFFF' : '#000000';
}
