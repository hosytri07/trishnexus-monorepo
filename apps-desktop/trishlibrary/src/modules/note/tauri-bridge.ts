/**
 * Phase 18.2.a — Note module tauri-bridge.
 *
 * Note store path: %LocalAppData%\TrishTEAM\TrishLibrary\notes.{uid}.json
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { type NoteStore, emptyStore } from './types.js';

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export function notesFilenameForUid(uid: string): string {
  return `notes.${uid}.json`;
}

/**
 * Load Note store cho user. Resolve qua:
 *   - Lấy default_store_dir
 *   - Đọc file notes.{uid}.json
 *   - Parse hoặc return emptyStore() nếu fail/không tồn tại
 */
export async function loadNoteStore(uid: string): Promise<NoteStore> {
  if (!isInTauri()) return emptyStore();
  try {
    const loc = await invoke<{ path: string }>('default_store_location');
    const dir = loc.path.replace(/[\\/][^\\/]+$/, ''); // strip filename
    const sep = dir.includes('\\') ? '\\' : '/';
    const filePath = `${dir}${sep}${notesFilenameForUid(uid)}`;
    try {
      const content = await invoke<string>('read_text_string', { path: filePath });
      const parsed = JSON.parse(content) as NoteStore;
      if (parsed && parsed.schema_version === 1) {
        // Phase 18.4 — mirror to localStorage for search index
        try {
          window.localStorage.setItem('trishlibrary.note.store.v1', content);
        } catch {
          /* skip */
        }
        return parsed;
      }
    } catch {
      // file không tồn tại — đó là OK, return empty
    }
    return emptyStore();
  } catch (err) {
    console.warn('[note] loadNoteStore fail:', err);
    return emptyStore();
  }
}

export async function saveNoteStore(uid: string, store: NoteStore): Promise<void> {
  if (!isInTauri()) return;
  try {
    const loc = await invoke<{ path: string }>('default_store_location');
    const dir = loc.path.replace(/[\\/][^\\/]+$/, '');
    const sep = dir.includes('\\') ? '\\' : '/';
    const filePath = `${dir}${sep}${notesFilenameForUid(uid)}`;
    const content = JSON.stringify(store, null, 2);
    await invoke<void>('write_text_string', { path: filePath, content });
    // Phase 18.4 — Mirror to localStorage for global Ctrl+K search index
    try {
      window.localStorage.setItem('trishlibrary.note.store.v1', content);
    } catch {
      /* quota exceeded — skip search index, file save still succeeded */
    }
  } catch (err) {
    console.warn('[note] saveNoteStore fail:', err);
    throw err;
  }
}

export async function listSystemFonts(): Promise<string[]> {
  if (!isInTauri()) return [];
  try {
    return await invoke<string[]>('list_system_fonts');
  } catch (err) {
    console.warn('[note] list_system_fonts fail:', err);
    return [];
  }
}

export async function pickFileForAttach(): Promise<string | null> {
  if (!isInTauri()) return null;
  const picked = await openDialog({
    multiple: false,
    title: 'Chọn file để đính kèm',
  });
  return typeof picked === 'string' ? picked : null;
}

export async function pickFolderForAttach(): Promise<string | null> {
  if (!isInTauri()) return null;
  const picked = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn folder để gắn link',
  });
  return typeof picked === 'string' ? picked : null;
}

export async function attachFileToNote(
  uid: string,
  srcPath: string,
): Promise<string> {
  if (!isInTauri()) throw new Error('attach chỉ trong desktop');
  return invoke<string>('attach_file', { uid, srcPath });
}

export async function removeAttachedFile(path: string): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('remove_attached_file', { path });
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isInTauri()) {
    window.alert(`(dev) Open: ${path}`);
    return;
  }
  await invoke<void>('open_local_path', { path });
}
