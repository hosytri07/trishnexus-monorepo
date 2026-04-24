/**
 * @trishteam/core/design — shared types cho color palette + design token.
 *
 * Phase 14.4.4 (2026-04-24). Pure TypeScript, không phụ thuộc DOM.
 */

/** Không gian màu hỗ trợ — hex là chuẩn lưu trữ gọn nhất. */
export type ColorSpace = 'hex' | 'rgb' | 'hsl';

/** RGB 8-bit 0..255 trên 3 kênh. Alpha ∈ [0,1] optional (default 1). */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/** HSL — Hue 0..360, Sat/Light 0..100. Alpha ∈ [0,1] optional. */
export interface HSL {
  h: number;
  s: number;
  l: number;
  a?: number;
}

/** 1 swatch riêng lẻ trong palette (e.g. "primary.500"). */
export interface ColorSwatch {
  /** Key trong thang — vd "50", "100", … "950" hoặc "base". */
  key: string;
  /** Hex 7 ký tự viết hoa (e.g. "#F59E0B"). */
  hex: string;
  /** Contrast ratio vs màu trắng #FFFFFF theo WCAG 2.1. */
  contrastWhite: number;
  /** Contrast ratio vs màu đen #000000 theo WCAG 2.1. */
  contrastBlack: number;
}

/** Thang màu 11 bậc (50, 100, 200, …, 900, 950) giống Tailwind. */
export interface ColorScale {
  /** Tên scale (e.g. "primary", "neutral", "accent"). */
  name: string;
  /** Hex của bậc base (thường 500) đã dùng để generate. */
  base: string;
  /** 11 swatch từ key "50" tới "950". */
  swatches: ColorSwatch[];
}

/** Harmony type — luật kết hợp màu kinh điển. */
export type HarmonyKind =
  | 'monochromatic'
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'splitComplementary'
  | 'tetradic';

/** Kết quả harmony — danh sách hex. */
export interface Harmony {
  kind: HarmonyKind;
  base: string;
  colors: string[];
}

/** WCAG 2.1 contrast rating. */
export type ContrastRating = 'fail' | 'AA-large' | 'AA' | 'AAA';

/** 1 ô trong ma trận contrast (fg × bg). */
export interface ContrastCell {
  fg: string;
  bg: string;
  ratio: number;
  rating: ContrastRating;
}

/** Token semantic cho typography — dùng theo Tailwind convention. */
export interface TypographyToken {
  fontFamily: string[];
  /** Vd "14px" | "0.875rem". */
  fontSize: string;
  /** Vd "1.5" | "24px". */
  lineHeight: string;
  fontWeight: number;
  /** Vd "-0.01em" | "0". */
  letterSpacing: string;
}

/** 1 design token set — gom color palette + spacing + typography… */
export interface DesignTokenSet {
  /** Unique ID — slug nội bộ. */
  id: string;
  /** Tên hiển thị. */
  name: string;
  /** Mô tả ngắn optional. */
  description?: string;
  /** 1..n color scale. */
  scales: ColorScale[];
  /**
   * Semantic color alias — map "primary" → "accent.500" ví dụ.
   * Giá trị là hex hoặc "scaleName.key".
   */
  semantic?: Record<string, string>;
  /** Spacing scale — key → rem/px value. */
  spacing?: Record<string, string>;
  /** Radius scale — key → value. */
  radius?: Record<string, string>;
  /** Shadow scale — key → CSS box-shadow. */
  shadow?: Record<string, string>;
  /** Typography scale — key → token. */
  typography?: Record<string, TypographyToken>;
  /** Epoch ms created. */
  createdAt: number;
  /** Epoch ms updated. */
  updatedAt: number;
}

/** Mode cho suggestPalette — quyết định target lightness curve. */
export type PaletteMode = 'light' | 'dark' | 'brand';

/** Lỗi validate token set — non-fatal. */
export interface TokenValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warn';
}
