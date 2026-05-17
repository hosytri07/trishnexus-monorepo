/**
 * TrishDesign Phase 43 wave 15.3 — Incremental sync block ATGT từ Firestore /atgt_files.
 *
 * Workflow:
 *   1. Fetch list `/atgt_files` từ Firestore (mỗi doc = 1 file .dwg với metadata)
 *   2. Get folder local + list file local (Rust `list_local_atgt_files`)
 *   3. Diff: file mới (chưa có local) + file updated (uploaded_at > local mtime)
 *   4. Download per-file qua Rust `download_atgt_file`
 *   5. Trả về { added, updated, skipped, errors }
 */

import { invoke } from '@tauri-apps/api/core';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export interface AtgtFileMeta {
  fileName: string;
  url: string;
  size: number;
  uploaded_at: number;
  uploaded_by?: string;
  version?: string;
}

interface LocalAtgtFile {
  name: string;
  size: number;
  mtimeMs: number;
}

export interface SyncResult {
  folder: string;
  totalRemote: number;
  added: string[];      // file mới download
  updated: string[];    // file cập nhật (uploaded_at > local mtime)
  skipped: string[];    // file đã up-to-date
  errors: Array<{ fileName: string; message: string }>;
}

/**
 * Đồng bộ block ATGT từ Firestore.
 * Optional callback `onProgress(current, total, fileName)` để hiển thị tiến độ.
 */
export async function syncAtgtBlocks(
  onProgress?: (current: number, total: number, fileName: string) => void,
): Promise<SyncResult> {
  // 1. Get folder local
  const folder = await invoke<string>('default_atgt_blocks_folder');

  // 2. Fetch list remote từ Firestore
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, 'atgt_files'), limit(2000)));
  const remoteFiles: AtgtFileMeta[] = snap.docs.map((d) => d.data() as AtgtFileMeta);

  // 3. List local files
  const localFiles = await invoke<LocalAtgtFile[]>('list_local_atgt_files', { folder });
  const localMap = new Map<string, LocalAtgtFile>();
  localFiles.forEach((f) => localMap.set(f.name.toLowerCase(), f));

  // 4. Diff + download
  const result: SyncResult = {
    folder,
    totalRemote: remoteFiles.length,
    added: [], updated: [], skipped: [], errors: [],
  };

  for (let i = 0; i < remoteFiles.length; i++) {
    const r = remoteFiles[i]!;
    const local = localMap.get(r.fileName.toLowerCase());
    const needs = !local
      || (r.uploaded_at && local.mtimeMs && r.uploaded_at > local.mtimeMs)
      || (r.size && local.size && r.size !== local.size);

    if (!needs) {
      result.skipped.push(r.fileName);
      continue;
    }

    onProgress?.(i + 1, remoteFiles.length, r.fileName);
    try {
      await invoke<{ destPath: string; bytes: number }>('download_atgt_file', {
        url: r.url,
        folder,
        fileName: r.fileName,
      });
      if (local) result.updated.push(r.fileName);
      else result.added.push(r.fileName);
    } catch (e) {
      result.errors.push({ fileName: r.fileName, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return result;
}
