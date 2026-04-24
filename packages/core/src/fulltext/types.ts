/**
 * @trishteam/core/fulltext — full-text BM25 cross-source search.
 *
 * Dùng cho TrishSearch desktop app (Phase 14.4.3) — index TrishNote JSON +
 * TrishLibrary JSON + text file bên ngoài, rồi query offline bằng BM25.
 *
 * Pure TS, không phụ thuộc Fuse / Lunr / Tantivy.
 */

/**
 * Nguồn dữ liệu của 1 tài liệu trong index.
 * - `note`    — từ TrishNote (`notes.json`)
 * - `library` — từ TrishLibrary (`library.json`)
 * - `file`    — text file user pick trực tiếp (md/txt/html)
 */
export type FulltextSource = 'note' | 'library' | 'file';

export const FULLTEXT_SOURCES: readonly FulltextSource[] = [
  'note',
  'library',
  'file',
] as const;

/**
 * 1 document chuẩn hoá để index. Luôn có `id` unique
 * (thường là `${source}:${originalId}`), `title` ngắn, `body` dài.
 * `path` tùy chọn để UI mở file bằng app mặc định.
 */
export interface FulltextDoc {
  id: string;
  source: FulltextSource;
  title: string;
  body: string;
  /** Đường dẫn file hoặc id gốc — dùng để UI hiển thị hoặc `openPath`. */
  path?: string;
  /** Ngày modified hoặc updated (ms epoch) — dùng recency boost. */
  mtimeMs: number;
  /** Tag hoặc category — chứa trong vùng ngoài body để highlight riêng. */
  tags?: string[];
}

/**
 * Posting entry cho 1 term trong 1 doc.
 * - `tf`      : số lần xuất hiện của term trong doc (raw count)
 * - `first`   : vị trí token đầu tiên (dùng cho snippet)
 */
export interface PostingEntry {
  docId: string;
  tf: number;
  first: number;
}

/**
 * Inverted index dạng pure JSON — serializable để cache giữa các run.
 * Cấu trúc:
 *   - `docs`           : Record<docId, DocMeta>
 *   - `terms`          : Record<term, PostingEntry[]>
 *   - `avgDocLen`      : trung bình token count, dùng trong BM25
 *   - `totalDocs`      : số document hiện tại
 */
export interface FulltextIndex {
  docs: Record<string, FulltextDocMeta>;
  terms: Record<string, PostingEntry[]>;
  avgDocLen: number;
  totalDocs: number;
}

export interface FulltextDocMeta {
  id: string;
  source: FulltextSource;
  title: string;
  path?: string;
  mtimeMs: number;
  tags?: string[];
  /** Tổng số token sau tokenize — dùng chuẩn hoá BM25. */
  length: number;
  /** Body gốc để làm snippet highlight (không index nữa). */
  body: string;
}

/**
 * 1 clause parse từ query text.
 * - `term`    : từ khoá đã normalize (đã foldVietnamese + lowercase)
 * - `phrase`  : true nếu term nằm trong cặp "..." — match toàn cụm
 * - `negate`  : true nếu prefix `-term` (exclude)
 * - `prefix`  : true nếu kết thúc `*` (startsWith match)
 * - `source`  : filter theo source (`note:` / `library:` / `file:` prefix)
 */
export interface QueryClause {
  term: string;
  phrase: boolean;
  negate: boolean;
  prefix: boolean;
  source: FulltextSource | null;
}

export interface ParsedQuery {
  /** Tất cả clause sau parse — tất cả AND với nhau. */
  clauses: QueryClause[];
  /** Source filter hiệu lực (nếu user gõ `note:abc` thì `note`). */
  sourceFilter: FulltextSource | null;
}

/**
 * 1 hit trả về từ searchIndex — đi kèm score BM25 + snippet highlight.
 */
export interface FulltextHit {
  doc: FulltextDocMeta;
  score: number;
  /** Snippet đã rút gọn ~200 ký tự quanh match, đánh dấu `<mark>…</mark>`. */
  snippet: string;
  /** Các term đã match — giúp UI hiển thị highlight bar. */
  matchedTerms: string[];
}
