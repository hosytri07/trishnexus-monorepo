import {
  MAX_BODY_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  type NoteDraft,
} from './types.js';

/**
 * Validate + normalize draft trước khi write. Trả về error string hoặc null.
 */
export function validateDraft(draft: NoteDraft): string | null {
  if (!draft.title.trim() && !draft.body.trim()) {
    return 'Ghi chú không được trống';
  }
  if (draft.title.length > MAX_TITLE_LENGTH) {
    return `Tiêu đề vượt ${MAX_TITLE_LENGTH} ký tự`;
  }
  if (draft.body.length > MAX_BODY_LENGTH) {
    return `Nội dung vượt ${MAX_BODY_LENGTH} ký tự`;
  }
  if (draft.tags.length > MAX_TAGS) {
    return `Tối đa ${MAX_TAGS} tag`;
  }
  for (const tag of draft.tags) {
    if (tag.length > MAX_TAG_LENGTH) {
      return `Tag "${tag.slice(0, 20)}..." vượt ${MAX_TAG_LENGTH} ký tự`;
    }
  }
  if (draft.dueAt != null && !Number.isFinite(draft.dueAt)) {
    return 'Deadline không hợp lệ';
  }
  return null;
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}
