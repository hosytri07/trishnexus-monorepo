/**
 * Phase 18.6.a — Module Ảnh tauri-bridge.
 *
 * Wraps Rust commands list_image_files + frontend dialog plugin.
 * Persist ImageStore vào localStorage.
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import type { ImageFile, ImageStore } from './types.js';
import { DEFAULT_IMAGE_STORE } from './types.js';

/**
 * Phase 18.5.b — Per-user store key.
 *
 * Trước Phase 18.5: tất cả user dùng chung `trishlibrary.image.store.v1`.
 * Bây giờ: mỗi user có store riêng `trishlibrary.image.store.v1::{uid}`,
 * còn mirror legacy key cho global Ctrl+K (vì Search modal đọc legacy key).
 */
const LEGACY_STORE_KEY = 'trishlibrary.image.store.v1';

function imageStoreKeyForUid(uid: string | null): string {
  if (!uid) return LEGACY_STORE_KEY;
  return `${LEGACY_STORE_KEY}::${uid}`;
}

export function loadImageStore(uid: string | null = null): ImageStore {
  try {
    const key = imageStoreKeyForUid(uid);
    let raw = localStorage.getItem(key);
    // Migration: nếu user mới + legacy key tồn tại + key mới chưa có
    // → copy legacy → key mới (chỉ chạy 1 lần)
    if (!raw && uid) {
      const legacy = localStorage.getItem(LEGACY_STORE_KEY);
      if (legacy) {
        try {
          localStorage.setItem(key, legacy);
        } catch {
          /* ignore */
        }
        raw = legacy;
      }
    }
    if (!raw) return { ...DEFAULT_IMAGE_STORE };
    const parsed = JSON.parse(raw) as Partial<ImageStore>;
    return {
      ...DEFAULT_IMAGE_STORE,
      ...parsed,
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      notes:
        parsed.notes && typeof parsed.notes === 'object'
          ? (parsed.notes as Record<string, string>)
          : {},
      display_names:
        parsed.display_names && typeof parsed.display_names === 'object'
          ? (parsed.display_names as Record<string, string>)
          : {},
    };
  } catch {
    return { ...DEFAULT_IMAGE_STORE };
  }
}

export function saveImageStore(store: ImageStore, uid: string | null = null): void {
  try {
    const key = imageStoreKeyForUid(uid);
    const json = JSON.stringify(store);
    localStorage.setItem(key, json);
    // Mirror cho global Ctrl+K (modal đọc LEGACY key)
    if (uid) {
      try {
        localStorage.setItem(LEGACY_STORE_KEY, json);
      } catch {
        /* ignore quota */
      }
    }
  } catch (err) {
    console.warn('saveImageStore fail:', err);
  }
}

export async function pickImageFolder(): Promise<string | null> {
  try {
    const picked = await openDialog({
      directory: true,
      multiple: false,
      title: 'Chọn thư mục ảnh',
    });
    if (typeof picked === 'string') return picked;
    return null;
  } catch (err) {
    console.warn('pickImageFolder fail:', err);
    return null;
  }
}

export async function listImageFiles(
  folder: string,
  recursive: boolean,
): Promise<ImageFile[]> {
  return invoke<ImageFile[]>('list_image_files', { folder, recursive });
}

export function imageSrcUrl(absolutePath: string): string {
  return convertFileSrc(absolutePath);
}

export async function openImageInOS(path: string): Promise<void> {
  await invoke('open_local_path', { path });
}

export async function checkFolderExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('check_folder_exists', { path });
  } catch {
    return false;
  }
}

export async function copyImageFile(src: string, dst: string): Promise<number> {
  return invoke<number>('copy_file', { src, dst });
}

/**
 * Phase 18.6.e — Export ảnh/video với tên mới + sidecar note.
 * - Mở save dialog (gợi ý displayName)
 * - Copy file gốc → dest path
 * - Nếu có note → ghi sidecar `<dest>.note.txt` cùng folder
 */
export async function exportImageWithNewName(
  srcPath: string,
  suggestedName: string,
  ext: string,
  note: string,
): Promise<{ path: string; noteWritten: boolean } | null> {
  const target = await saveDialog({
    defaultPath: suggestedName,
    filters: [
      { name: ext.toUpperCase(), extensions: [ext] },
      { name: 'Tất cả', extensions: ['*'] },
    ],
  });
  if (typeof target !== 'string') return null;
  await invoke('copy_file', { src: srcPath, dst: target });
  let noteWritten = false;
  if (note.trim().length > 0) {
    // Sidecar note: <dest>.note.txt — lấy dest, bỏ ext rồi thêm .note.txt
    const lastDot = target.lastIndexOf('.');
    const baseNoExt = lastDot > 0 ? target.slice(0, lastDot) : target;
    const notePath = `${baseNoExt}.note.txt`;
    try {
      await invoke('write_text_string', { path: notePath, content: note });
      noteWritten = true;
    } catch (err) {
      console.warn('write note sidecar fail:', err);
    }
  }
  return { path: target, noteWritten };
}

// ============================================================
// Thumbnail cache + concurrency-limited queue
// ============================================================

const thumbMemoryCache = new Map<string, string>(); // path::size -> asset URL
const inFlight = new Map<string, Promise<string>>();

const MAX_PARALLEL = 6;
let active = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_PARALLEL) {
      active++;
      resolve();
    } else {
      waitQueue.push(() => {
        active++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  active--;
  const next = waitQueue.shift();
  if (next) next();
}

export async function getThumbnail(
  path: string,
  maxSize: number = 240,
): Promise<string> {
  const key = `${path}::${maxSize}`;
  const cached = thumbMemoryCache.get(key);
  if (cached) return cached;

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<string> => {
    await acquireSlot();
    try {
      const thumbPath = await invoke<string>('get_thumbnail', {
        path,
        maxSize,
      });
      const url = convertFileSrc(thumbPath);
      thumbMemoryCache.set(key, url);
      return url;
    } finally {
      releaseSlot();
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function clearThumbnailMemoryCache(): void {
  thumbMemoryCache.clear();
}

// ============================================================
// Phase 18.6.h — EXIF metadata
// ============================================================

export interface ExifData {
  camera_make?: string;
  camera_model?: string;
  lens?: string;
  datetime_original?: string;
  iso?: string;
  aperture?: string;
  shutter_speed?: string;
  focal_length?: string;
  flash?: string;
  width?: number;
  height?: number;
  orientation?: string;
  gps_lat?: number;
  gps_lon?: number;
  gps_altitude?: number;
  has_exif: boolean;
}

const exifCache = new Map<string, ExifData>();

export async function readImageExif(path: string): Promise<ExifData> {
  const cached = exifCache.get(path);
  if (cached) return cached;
  try {
    const data = await invoke<ExifData>('read_image_exif', { path });
    exifCache.set(path, data);
    return data;
  } catch {
    return { has_exif: false };
  }
}

// Pre-warm thumbnail cache for an entire folder with a progress callback.
// Uses the same MAX_PARALLEL queue inside getThumbnail.
export interface PreloadHandle {
  cancel: () => void;
  promise: Promise<void>;
}

export function preloadThumbnails(
  paths: string[],
  maxSize: number,
  onProgress: (done: number, total: number, currentName: string) => void,
): PreloadHandle {
  let cancelled = false;
  const total = paths.length;
  let done = 0;

  const promise = (async (): Promise<void> => {
    if (total === 0) return;
    onProgress(0, total, '');
    const tasks = paths.map((p) =>
      getThumbnail(p, maxSize)
        .catch(() => null)
        .then(() => {
          done++;
          if (!cancelled) {
            const name = p.split(/[\\/]/).pop() ?? '';
            onProgress(done, total, name);
          }
        }),
    );
    await Promise.all(tasks);
  })();

  return {
    cancel: (): void => {
      cancelled = true;
    },
    promise,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
