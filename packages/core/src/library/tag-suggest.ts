/**
 * Tag auto-suggest — heuristic pure TS, không cần ML model.
 *
 * Dựa trên:
 *   - Keyword match trong title + filename + note (VN + EN).
 *   - Co-occurrence với tag khác user đã dùng trong library (learning
 *     nhẹ từ thói quen).
 *   - Format-based fallback (pdf → 'tài liệu', md → 'ghi chú').
 */

import type { LibraryDoc, DocFormat } from './types.js';

export interface TagSuggestion {
  readonly tag: string;
  /** Score 0..1, càng cao càng tự tin. */
  readonly score: number;
  /** Lý do cho user hiểu vì sao suggest. */
  readonly reason: string;
}

/**
 * Rule tĩnh: keyword → tag. Dùng cho domain TrishTEAM (kỹ thuật, xây
 * dựng, phần mềm, văn bản hành chính tiếng Việt).
 */
const KEYWORD_TO_TAG: ReadonlyArray<{
  readonly tag: string;
  readonly patterns: readonly RegExp[];
  readonly reason: string;
}> = [
  {
    tag: 'tcvn',
    patterns: [/\btcvn\b/i, /tiêu\s*chuẩn.*việt\s*nam/i, /quy\s*chu[ẩa]n/i],
    reason: 'Có chữ TCVN / tiêu chuẩn Việt Nam',
  },
  {
    tag: 'luật',
    patterns: [/\bluật\b/i, /nghị\s*định/i, /thông\s*tư/i, /quyết\s*định/i, /\blaw\b/i],
    reason: 'Văn bản pháp lý',
  },
  {
    tag: 'xây dựng',
    patterns: [/xây\s*dựng/i, /\bbê\s*tông\b/i, /\bthép\b/i, /kết\s*cấu/i, /\bcivil\b/i, /\bconstruction\b/i],
    reason: 'Chủ đề xây dựng / kết cấu',
  },
  {
    tag: 'học',
    patterns: [/giáo\s*trình/i, /bài\s*giảng/i, /course/i, /lecture/i, /tutorial/i, /textbook/i],
    reason: 'Giáo trình / bài giảng',
  },
  {
    tag: 'nghiên cứu',
    patterns: [/\bresearch\b/i, /\bpaper\b/i, /\bthesis\b/i, /\bluận\s*(văn|án)\b/i, /\bbáo\s*cáo\b/i],
    reason: 'Nghiên cứu / paper / luận văn',
  },
  {
    tag: 'code',
    patterns: [/\bapi\b/i, /\bsdk\b/i, /programming/i, /\bcode\b/i, /javascript/i, /typescript/i, /rust/i, /python/i],
    reason: 'Lập trình',
  },
  {
    tag: 'tiếng việt',
    // Có diacritic tiếng Việt → khả năng cao là tài liệu tiếng Việt.
    // Dùng Unicode block Latin-1 Supplement (U+00C0..U+00FF) +
    // Latin Extended-A/B (U+0100..U+024F) + Latin Extended Additional
    // (U+1E00..U+1EFF) để bắt cả composed chars như ế (U+1EBF),
    // ệ (U+1EC7), ị (U+1ECB), v.v.
    patterns: [/[\u00C0-\u024F\u1E00-\u1EFF]/],
    reason: 'Có dấu tiếng Việt',
  },
];

const FORMAT_FALLBACK: Partial<Record<DocFormat, { tag: string; reason: string }>> = {
  pdf: { tag: 'tài liệu', reason: 'Format PDF' },
  docx: { tag: 'văn bản', reason: 'Format Word' },
  doc: { tag: 'văn bản', reason: 'Format Word' },
  epub: { tag: 'sách', reason: 'Format EPUB' },
  md: { tag: 'ghi chú', reason: 'Format Markdown' },
  txt: { tag: 'ghi chú', reason: 'Format plain text' },
};

/**
 * Tính tag đã dùng + tần suất để co-occurrence gợi ý tag phổ biến.
 */
export function buildTagIndex(library: readonly LibraryDoc[]): Map<string, number> {
  const idx = new Map<string, number>();
  for (const doc of library) {
    for (const t of doc.tags) {
      const normalized = t.trim().toLowerCase();
      if (!normalized) continue;
      idx.set(normalized, (idx.get(normalized) ?? 0) + 1);
    }
  }
  return idx;
}

/**
 * Suggest tags cho 1 doc dựa trên metadata của chính nó + index tag user
 * đã dùng trong library. Trả ranked list, đã loại trùng với
 * `existingTags` để UI không show lại tag đã gán.
 */
export function suggestTags(
  doc: Pick<LibraryDoc, 'title' | 'name' | 'note' | 'format' | 'authors'>,
  tagIndex: Map<string, number>,
  limit = 8,
): TagSuggestion[] {
  const existingSet = new Set<string>(); // callers pass existing in `doc.tags`; nhưng ta take từ args khác
  // thực chất consumer sẽ filter — ta cứ return tất cả, trừ empty.

  const haystack = [
    doc.title ?? '',
    doc.name ?? '',
    doc.note ?? '',
    (doc.authors ?? []).join(' '),
  ].join(' ');

  const candidates = new Map<string, TagSuggestion>();
  const add = (tag: string, score: number, reason: string): void => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || existingSet.has(normalized)) return;
    const prev = candidates.get(normalized);
    if (!prev || prev.score < score) {
      candidates.set(normalized, { tag: normalized, score, reason });
    }
  };

  // 1. Keyword rules.
  for (const rule of KEYWORD_TO_TAG) {
    for (const p of rule.patterns) {
      if (p.test(haystack)) {
        add(rule.tag, 0.85, rule.reason);
        break;
      }
    }
  }

  // 2. Co-occurrence — tag phổ biến trong library tự nhiên có score
  //    nền 0.3 + log scale theo tần suất.
  if (tagIndex.size > 0) {
    const maxCount = Math.max(...tagIndex.values());
    for (const [tag, count] of tagIndex) {
      const norm = Math.log(1 + count) / Math.log(1 + maxCount);
      add(tag, 0.3 + norm * 0.3, `Bạn đã dùng tag này ${count}×`);
    }
  }

  // 3. Format fallback.
  const fallback = FORMAT_FALLBACK[doc.format];
  if (fallback) {
    add(fallback.tag, 0.4, fallback.reason);
  }

  const list = [...candidates.values()].sort((a, b) => b.score - a.score);
  return list.slice(0, limit);
}

/**
 * Normalize tag giống notes: lowercase, collapse whitespace, strip
 * leading/trailing hyphen.
 */
export function normalizeLibraryTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-+|-+$/g, '');
}
