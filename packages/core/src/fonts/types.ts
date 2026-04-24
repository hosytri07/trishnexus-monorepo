/**
 * Font domain model — pure TS, không chạm filesystem hay DOM.
 *
 * Rust backend (`read_font`) parse font metadata và trả về
 * {@link FontMeta}. TS chỉ làm logic phân loại + pair recommendation.
 */

/**
 * Personality tổng quát của một font family.
 * Dùng để khuyến nghị pair (heading + body) với contrast hợp lý.
 */
export type FontPersonality =
  | 'serif' // Times, Georgia, Merriweather — có chân
  | 'sans' // Helvetica, Inter, Roboto — không chân
  | 'slab' // Roboto Slab, Rockwell — chân vuông
  | 'mono' // Fira Code, JetBrains Mono — monospace
  | 'display' // Bebas, Impact — chỉ dùng tiêu đề
  | 'script' // Great Vibes, Dancing Script — nét nối
  | 'handwriting' // Caveat, Kalam — viết tay
  | 'unknown';

/** Role đề xuất trong layout typography. */
export type FontRole = 'heading' | 'body' | 'display' | 'accent' | 'code';

/**
 * Metadata 1 file font đơn (TTF/OTF/WOFF). Rust fill các field từ
 * name table + os2; TS dùng để classify.
 */
export interface FontMeta {
  /** Absolute path tới file font. */
  path: string;
  /** Font family name (name ID 1). Vd "Inter", "Times New Roman". */
  family: string;
  /** Sub-family (name ID 2). Vd "Regular", "Bold Italic". */
  subfamily: string;
  /** Full name (name ID 4). Thường "Inter Bold". */
  full_name: string;
  /** Postscript name (name ID 6). Slug-like, vd "Inter-Bold". */
  postscript_name: string;
  /** Weight numeric 100-900 theo OS/2 usWeightClass. */
  weight: number;
  /** Width 1-9 theo OS/2 usWidthClass (5=normal). */
  width: number;
  /** Italic flag. */
  italic: boolean;
  /** Monospaced flag (panose=mono hoặc post.isFixedPitch). */
  monospace: boolean;
  /** Có đầy đủ diacritic cho tiếng Việt (à, ả, ã, ă, â, ...). */
  vn_support: boolean;
  /** Số glyph trong font. */
  glyph_count: number;
  /** File size in bytes. */
  size_bytes: number;
}

export interface FontFamily {
  family: string;
  personality: FontPersonality;
  vn_support: boolean;
  styles: FontMeta[];
  /** Weight range thấp nhất-cao nhất. */
  weight_min: number;
  weight_max: number;
  /** Có style italic trong family. */
  has_italic: boolean;
}

/**
 * Khuyến nghị 1 cặp heading + body. Score càng cao càng hợp.
 * `score` range [0, 100], `contrast` mức tương phản [0, 1].
 */
export interface FontPair {
  heading: FontFamily;
  body: FontFamily;
  score: number;
  contrast: number;
  rationale: string;
}

export interface FontCollection {
  families: FontFamily[];
  total_files: number;
  total_size_bytes: number;
}
