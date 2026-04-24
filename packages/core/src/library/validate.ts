/**
 * Validate LibraryDraft trước khi add vào library.
 */

import type { LibraryDraft, ReadStatus } from './types.js';
import { READ_STATUSES } from './types.js';
import { normalizeLibraryTag } from './tag-suggest.js';

export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly normalizedTags: readonly string[];
}

const MAX_TITLE = 300;
const MAX_NOTE = 5_000;
const MAX_AUTHOR = 200;
const MAX_TAG = 50;
const MAX_TAGS_PER_DOC = 32;
const MIN_YEAR = 0;
const MAX_YEAR = 3000;

export function validateDraft(draft: LibraryDraft): ValidationResult {
  const errors: string[] = [];

  if (!draft.path || typeof draft.path !== 'string' || !draft.path.trim()) {
    errors.push('Thiếu đường dẫn file (path).');
  }

  if (draft.title != null) {
    if (typeof draft.title !== 'string') errors.push('Tiêu đề không hợp lệ.');
    else if (draft.title.length > MAX_TITLE)
      errors.push(`Tiêu đề quá dài (> ${MAX_TITLE} ký tự).`);
  }

  if (draft.note != null) {
    if (typeof draft.note !== 'string') errors.push('Ghi chú không hợp lệ.');
    else if (draft.note.length > MAX_NOTE)
      errors.push(`Ghi chú quá dài (> ${MAX_NOTE} ký tự).`);
  }

  if (draft.authors != null) {
    if (!Array.isArray(draft.authors)) {
      errors.push('Danh sách tác giả không hợp lệ.');
    } else {
      for (const a of draft.authors) {
        if (typeof a !== 'string') {
          errors.push('Tên tác giả không hợp lệ.');
          break;
        }
        if (a.length > MAX_AUTHOR) {
          errors.push(`Tên tác giả quá dài (> ${MAX_AUTHOR} ký tự).`);
          break;
        }
      }
    }
  }

  if (draft.year != null) {
    if (!Number.isFinite(draft.year))
      errors.push('Năm xuất bản không hợp lệ.');
    else if (draft.year < MIN_YEAR || draft.year > MAX_YEAR)
      errors.push(`Năm xuất bản nằm ngoài khoảng ${MIN_YEAR}..${MAX_YEAR}.`);
  }

  if (draft.publisher != null && draft.publisher !== '') {
    if (typeof draft.publisher !== 'string')
      errors.push('Nhà xuất bản không hợp lệ.');
    else if (draft.publisher.length > MAX_AUTHOR)
      errors.push(`Nhà xuất bản quá dài (> ${MAX_AUTHOR} ký tự).`);
  }

  if (draft.status != null && !READ_STATUSES.includes(draft.status as ReadStatus)) {
    errors.push('Trạng thái đọc không hợp lệ.');
  }

  const normalized: string[] = [];
  if (draft.tags != null) {
    if (!Array.isArray(draft.tags)) {
      errors.push('Tag không hợp lệ.');
    } else {
      const seen = new Set<string>();
      for (const t of draft.tags) {
        if (typeof t !== 'string') {
          errors.push('Tag không hợp lệ.');
          continue;
        }
        const n = normalizeLibraryTag(t);
        if (!n) continue;
        if (n.length > MAX_TAG) {
          errors.push(`Tag quá dài (> ${MAX_TAG} ký tự).`);
          continue;
        }
        if (!seen.has(n)) {
          seen.add(n);
          normalized.push(n);
        }
      }
      if (normalized.length > MAX_TAGS_PER_DOC)
        errors.push(`Quá nhiều tag (> ${MAX_TAGS_PER_DOC}).`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedTags: normalized,
  };
}
