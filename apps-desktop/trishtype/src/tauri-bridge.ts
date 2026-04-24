import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

export interface FileReadResult {
  path: string;
  content: string;
  size_bytes: number;
  truncated: boolean;
}

export interface FileWriteResult {
  path: string;
  size_bytes: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/** Dev fallback: preload sample text khi chạy trong browser thuần. */
const DEV_FALLBACK_TEXT =
  'Xin chào TrishType.\n' +
  'Đây là editor multi-caret — gõ nhiều vị trí cùng lúc.\n' +
  'Các dòng sẽ merge an toàn qua CRDT khi nhiều người cùng sửa.\n';

export async function pickAndReadFile(): Promise<FileReadResult | null> {
  if (!isInTauri()) {
    return {
      path: '/tmp/dev-sample.md',
      content: DEV_FALLBACK_TEXT,
      size_bytes: DEV_FALLBACK_TEXT.length,
      truncated: false,
    };
  }
  const picked = await openDialog({
    multiple: false,
    directory: false,
    title: 'Chọn file văn bản',
    filters: [
      { name: 'Text', extensions: ['txt', 'md', 'markdown', 'log', 'json'] },
    ],
  });
  if (!picked || typeof picked !== 'string') return null;
  const res = await invoke<FileReadResult>('read_text_file', { path: picked });
  return res;
}

export async function saveAs(
  content: string,
  suggested = 'untitled.txt',
): Promise<FileWriteResult | null> {
  if (!isInTauri()) {
    console.log('[dev] saveAs skipped, content length=', content.length);
    return {
      path: '/tmp/' + suggested,
      size_bytes: content.length,
    };
  }
  const target = await saveDialog({
    title: 'Lưu file',
    defaultPath: suggested,
    filters: [
      { name: 'Text', extensions: ['txt', 'md', 'markdown', 'json'] },
    ],
  });
  if (!target) return null;
  const res = await invoke<FileWriteResult>('write_text_file', {
    path: target,
    content,
  });
  return res;
}

export async function saveTo(
  path: string,
  content: string,
): Promise<FileWriteResult | null> {
  if (!isInTauri()) {
    console.log('[dev] saveTo', path, 'length=', content.length);
    return { path, size_bytes: content.length };
  }
  const res = await invoke<FileWriteResult>('write_text_file', { path, content });
  return res;
}
