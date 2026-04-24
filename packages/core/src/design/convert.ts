/**
 * Color space conversion — hex ↔ rgb ↔ hsl.
 *
 * Công thức HSL lấy từ CSS Color Module Level 3 (khuôn mẫu chuẩn).
 * Clamp mọi giá trị trong biên đúng tránh leak NaN.
 */

import type { HSL, RGB } from './types.js';

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Clamp n vào [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Hex (# optional, 3/4/6/8 hex) → RGB 0..255 + a 0..1. */
export function hexToRgb(hex: string): RGB {
  const m = HEX_RE.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  let h = m[1] ?? '';
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const out: RGB = { r, g, b };
  if (h.length === 8) {
    out.a = parseInt(h.slice(6, 8), 16) / 255;
  }
  return out;
}

/** RGB → Hex uppercase "#RRGGBB" (hoặc "#RRGGBBAA" nếu a < 1). */
export function rgbToHex(rgb: RGB): string {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  const core =
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0');
  if (rgb.a !== undefined && rgb.a < 1) {
    const a = clamp(Math.round(rgb.a * 255), 0, 255);
    return (core + a.toString(16).padStart(2, '0')).toUpperCase();
  }
  return core.toUpperCase();
}

/** RGB → HSL theo công thức CSS Level 3. */
export function rgbToHsl(rgb: RGB): HSL {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  const out: HSL = {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  };
  if (rgb.a !== undefined) out.a = rgb.a;
  return out;
}

/** HSL → RGB theo CSS Level 3. */
export function hslToRgb(hsl: HSL): RGB {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    const out: RGB = { r: v, g: v, b: v };
    if (hsl.a !== undefined) out.a = hsl.a;
    return out;
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;

  const out: RGB = {
    r: Math.round(hueToRgb(p, q, hk + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hk) * 255),
    b: Math.round(hueToRgb(p, q, hk - 1 / 3) * 255),
  };
  if (hsl.a !== undefined) out.a = hsl.a;
  return out;
}

function hueToRgb(p: number, q: number, tIn: number): number {
  let t = tIn;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Hex → HSL (helper gọn). */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/** HSL → Hex (helper gọn). */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/** Parser linh hoạt: nhận "#abc", "#abcdef", "rgb(…)", "hsl(…)". */
export function parseColor(input: string): RGB {
  const s = input.trim();
  if (HEX_RE.test(s)) return hexToRgb(s);
  const rgbMatch =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i.exec(
      s,
    );
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1] ?? '0');
    const g = parseFloat(rgbMatch[2] ?? '0');
    const b = parseFloat(rgbMatch[3] ?? '0');
    const out: RGB = { r, g, b };
    if (rgbMatch[4] !== undefined && rgbMatch[4] !== '') {
      out.a = parseFloat(rgbMatch[4]);
    }
    return out;
  }
  const hslMatch =
    /^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i.exec(
      s,
    );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1] ?? '0');
    const sat = parseFloat(hslMatch[2] ?? '0');
    const l = parseFloat(hslMatch[3] ?? '0');
    const hsl: HSL = { h, s: sat, l };
    if (hslMatch[4] !== undefined && hslMatch[4] !== '') {
      hsl.a = parseFloat(hslMatch[4]);
    }
    return hslToRgb(hsl);
  }
  throw new Error(`Cannot parse color: ${input}`);
}

/** Normalise hex input → format hoa 7 ký tự (#RRGGBB). Throw nếu invalid. */
export function normalizeHex(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}
