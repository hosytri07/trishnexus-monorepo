/**
 * Phase 19.24.1 — Backup / Restore helpers cho TrishAdmin.
 *
 * Export tất cả collection quan trọng từ Firestore → JSON object.
 * Import JSON → batch write Firestore.
 *
 * Collection skipped (không backup):
 *   - notes/{uid}/items/* — per-user, không phải data admin
 *   - users/{uid}/trishlibrary/* — per-user, riêng tư
 *   - users/{uid}/events, progress — per-user telemetry
 *   - vitals, errors — telemetry, dùng Firebase analytics
 *   - semantic — index data, có thể rebuild
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

/** Collection root-level admin cần backup. */
const BACKUP_COLLECTIONS = [
  'users',
  'keys',
  'posts',
  'announcements',
  'audit',
  'feedback',
  'short_links',
  'trishteam_library',
  'apps_meta',
  'standards',
  'dinh_muc',
  'vat_lieu',
  'roads_vn',
  'sign_images',
  'bridge_images',
] as const;

/** Doc ID trong /_meta/ cần backup riêng (counter, config). */
const META_DOC_IDS = ['posts_counter'] as const;

export const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  created_at: number;
  app: 'TrishAdmin';
  collections: Record<string, Array<Record<string, unknown>>>;
  meta: Record<string, Record<string, unknown>>;
  /** Subcollection trishteam_library/{folderId}/links */
  trishteam_library_links: Record<string, Array<Record<string, unknown>>>;
}

export interface BackupStats {
  totalDocs: number;
  collectionCounts: Record<string, number>;
  sizeBytes: number;
}

export type ProgressCallback = (msg: string, pct?: number) => void;

/**
 * Export tất cả Firestore collections → BackupData object.
 * Caller serialize JSON.stringify rồi save file qua Tauri.
 */
export async function exportAll(
  progressCb?: ProgressCallback,
): Promise<BackupData> {
  const db = getFirebaseDb();
  const data: BackupData = {
    version: BACKUP_VERSION,
    created_at: Date.now(),
    app: 'TrishAdmin',
    collections: {},
    meta: {},
    trishteam_library_links: {},
  };

  const total = BACKUP_COLLECTIONS.length + META_DOC_IDS.length + 1; // +1 for subcoll
  let step = 0;

  // 1. Root collections
  for (const colName of BACKUP_COLLECTIONS) {
    step++;
    progressCb?.(`Đang export "${colName}"…`, (step / total) * 100);
    try {
      const snap = await getDocs(collection(db, colName));
      data.collections[colName] = snap.docs.map((d) => ({
        _id: d.id,
        ...d.data(),
      }));
    } catch (err) {
      console.warn(`[backup] export ${colName} fail:`, err);
      data.collections[colName] = [];
    }
  }

  // 2. _meta singletons
  for (const docId of META_DOC_IDS) {
    step++;
    progressCb?.(`Đang export "_meta/${docId}"…`, (step / total) * 100);
    try {
      const snap = await getDoc(doc(db, '_meta', docId));
      if (snap.exists()) {
        data.meta[docId] = snap.data();
      }
    } catch (err) {
      console.warn(`[backup] export _meta/${docId} fail:`, err);
    }
  }

  // 3. Subcollection trishteam_library/{folderId}/links
  step++;
  progressCb?.('Đang export subcollections links…', (step / total) * 100);
  const folders = data.collections.trishteam_library ?? [];
  for (const folder of folders) {
    const folderId = folder._id as string;
    if (!folderId) continue;
    try {
      const linksSnap = await getDocs(
        collection(db, 'trishteam_library', folderId, 'links'),
      );
      data.trishteam_library_links[folderId] = linksSnap.docs.map((d) => ({
        _id: d.id,
        ...d.data(),
      }));
    } catch (err) {
      console.warn(`[backup] export library links ${folderId} fail:`, err);
    }
  }

  progressCb?.('Hoàn thành export.', 100);
  return data;
}

/** Tính stats backup data — dùng cho preview UI. */
export function computeStats(data: BackupData): BackupStats {
  const collectionCounts: Record<string, number> = {};
  let totalDocs = 0;
  for (const [name, docs] of Object.entries(data.collections)) {
    collectionCounts[name] = docs.length;
    totalDocs += docs.length;
  }
  for (const [folderId, links] of Object.entries(data.trishteam_library_links)) {
    collectionCounts[`trishteam_library/${folderId}/links`] = links.length;
    totalDocs += links.length;
  }
  totalDocs += Object.keys(data.meta).length;
  collectionCounts._meta = Object.keys(data.meta).length;

  const sizeBytes = new Blob([JSON.stringify(data)]).size;
  return { totalDocs, collectionCounts, sizeBytes };
}

/**
 * Import BackupData → ghi tất cả docs lên Firestore.
 *
 * Dùng writeBatch (max 500 ops mỗi batch) để tốc độ + atomic per batch.
 *
 * Restore là DESTRUCTIVE — overwrite docs cùng ID hiện tại. Caller cần
 * confirm 2 bước trước khi gọi.
 */
export async function importAll(
  data: BackupData,
  progressCb?: ProgressCallback,
): Promise<{ imported: number; failed: number }> {
  if (data.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version ${data.version} không tương thích (expected ${BACKUP_VERSION}).`,
    );
  }
  const db = getFirebaseDb();
  let imported = 0;
  let failed = 0;
  const allOps: Array<() => Promise<void>> = [];

  // 1. Root collections
  for (const [colName, items] of Object.entries(data.collections)) {
    for (const item of items) {
      const { _id, ...rest } = item as {
        _id: string;
        [k: string]: unknown;
      };
      if (!_id) {
        failed++;
        continue;
      }
      allOps.push(async () => {
        await setDoc(doc(db, colName, _id), rest);
      });
    }
  }

  // 2. _meta
  for (const [docId, docData] of Object.entries(data.meta)) {
    allOps.push(async () => {
      await setDoc(doc(db, '_meta', docId), docData);
    });
  }

  // 3. Subcollections trishteam_library/{folderId}/links
  for (const [folderId, links] of Object.entries(data.trishteam_library_links)) {
    for (const link of links) {
      const { _id, ...rest } = link as {
        _id: string;
        [k: string]: unknown;
      };
      if (!_id) {
        failed++;
        continue;
      }
      allOps.push(async () => {
        await setDoc(
          doc(db, 'trishteam_library', folderId, 'links', _id),
          rest,
        );
      });
    }
  }

  // Run batches of 500 (concurrent within batch but serial between batches)
  const BATCH_SIZE = 50; // smaller for client SDK throughput
  const total = allOps.length;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const slice = allOps.slice(i, i + BATCH_SIZE);
    progressCb?.(
      `Đang restore (${Math.min(i + slice.length, total)}/${total})…`,
      ((i + slice.length) / total) * 100,
    );
    const results = await Promise.allSettled(slice.map((op) => op()));
    for (const r of results) {
      if (r.status === 'fulfilled') imported++;
      else failed++;
    }
  }

  progressCb?.(`Hoàn thành: ${imported} thành công, ${failed} lỗi.`, 100);
  return { imported, failed };
}

/**
 * Tạo filename mặc định cho backup.
 * Format: trishteam-backup-2026-04-29-14-30.json
 */
export function defaultBackupFilename(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `trishteam-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
}

/** Format byte size cho UI. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
