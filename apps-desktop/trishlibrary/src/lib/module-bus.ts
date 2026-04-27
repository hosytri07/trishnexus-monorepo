/**
 * Phase 18.4.b — Cross-module event bus.
 *
 * Một số tương tác giữa các module (Library, Note, Document, Image) cần switch
 * tab + truyền payload (vd: tạo ghi chú từ một file thư viện). AppShell quản lý
 * active module state, các module con không có tham chiếu trực tiếp tới setter.
 *
 * Solution: CustomEvent global.
 *   - Module phát: `requestSwitchModule('note')` hoặc `requestCreateNoteAbout({...})`
 *   - AppShell + NoteModule listen event tương ứng
 */

import type { ModuleId } from '../AppShell.js';

export type NoteCategory = 'personal' | 'project';

export interface CreateNoteRequest {
  title: string;
  /** HTML content. Có thể chứa link, formatting đơn giản. */
  content_html: string;
  category: NoteCategory;
  /** Optional: tags để dễ tìm sau (vd ["from-library", "from-image"]). */
  tags?: string[];
}

/** Switch app to a specific module. */
export function requestSwitchModule(target: ModuleId): void {
  window.dispatchEvent(
    new CustomEvent<ModuleId>('trishlibrary:switch-module', { detail: target }),
  );
}

/**
 * Create note pre-filled with given content + switch to Note module.
 * NoteModule consumer reads this hint on mount/focus and creates the note.
 */
export function requestCreateNoteAbout(req: CreateNoteRequest): void {
  try {
    window.localStorage.setItem(
      'trishlibrary.note.pending_create',
      JSON.stringify(req),
    );
  } catch {
    /* quota — proceed anyway */
  }
  requestSwitchModule('note');
}

/** Switch to Library module + open Library full-text search overlay. */
export function requestLibrarySearch(initialQuery?: string): void {
  if (initialQuery) {
    try {
      window.localStorage.setItem('trishlibrary.lib.pending_search', initialQuery);
    } catch {
      /* ignore */
    }
  }
  requestSwitchModule('library');
}

/** Switch to Image module + select a specific image path. */
export function requestOpenImage(path: string): void {
  try {
    window.localStorage.setItem('trishlibrary.image.pending_select', path);
  } catch {
    /* ignore */
  }
  requestSwitchModule('image');
}
