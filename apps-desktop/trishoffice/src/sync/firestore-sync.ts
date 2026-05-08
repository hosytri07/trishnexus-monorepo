/**
 * TrishOffice — Firestore sync helpers (Phase 38.18).
 *
 * Schema:
 *   /trishoffice_companies/{ownerUid}/{collection}/{docId}
 *
 * `ownerUid` = Firebase uid của admin cty (mua key). Tất cả data cty share dưới
 * ownerUid này. NV local trong cty không có firebase_uid riêng → sync qua admin's
 * Firebase auth context.
 *
 * Pattern dùng:
 *   - loadCollection: fetch toàn bộ collection từ Firestore
 *   - writeRecord: setDoc 1 record (insert/update)
 *   - deleteRecord: deleteDoc 1 record
 *   - subscribeCollection: onSnapshot real-time listener
 */

import { getFirebaseDb } from '@trishteam/auth';
import {
  collection as fsCollection,
  doc as fsDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

const ROOT = 'trishoffice_companies';

interface BaseEntity {
  id: string;
  created_at: number;
  updated_at: number;
}

/** Lấy reference tới collection của 1 cty */
function colRef(ownerUid: string, name: string) {
  const db = getFirebaseDb();
  return fsCollection(db, ROOT, ownerUid, name);
}

function docRef(ownerUid: string, name: string, id: string) {
  const db = getFirebaseDb();
  return fsDoc(db, ROOT, ownerUid, name, id);
}

/**
 * Fetch toàn bộ records của 1 collection từ Firestore.
 * Trả về [] nếu chưa có.
 */
export async function loadCollection<T extends BaseEntity>(
  ownerUid: string,
  name: string,
): Promise<T[]> {
  try {
    const snap = await getDocs(colRef(ownerUid, name));
    return snap.docs.map((d) => d.data() as T);
  } catch (err) {
    console.warn(`[sync] loadCollection ${name} failed:`, err);
    return [];
  }
}

/**
 * Ghi 1 record lên Firestore (setDoc — upsert theo id).
 */
export async function writeRecord<T extends BaseEntity>(
  ownerUid: string,
  name: string,
  item: T,
): Promise<void> {
  try {
    await setDoc(docRef(ownerUid, name, item.id), item);
  } catch (err) {
    console.warn(`[sync] writeRecord ${name}/${item.id} failed:`, err);
  }
}

/**
 * Xóa 1 record trên Firestore.
 */
export async function deleteRecord(
  ownerUid: string,
  name: string,
  id: string,
): Promise<void> {
  try {
    await deleteDoc(docRef(ownerUid, name, id));
  } catch (err) {
    console.warn(`[sync] deleteRecord ${name}/${id} failed:`, err);
  }
}

/**
 * Subscribe real-time updates cho 1 collection.
 * Callback nhận toàn bộ items mỗi lần có thay đổi.
 *
 * Trả về unsubscribe function.
 */
export function subscribeCollection<T extends BaseEntity>(
  ownerUid: string,
  name: string,
  callback: (items: T[]) => void,
): Unsubscribe {
  return onSnapshot(
    colRef(ownerUid, name),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as T);
      callback(items);
    },
    (err) => {
      console.warn(`[sync] subscribeCollection ${name} error:`, err);
    },
  );
}

/**
 * Merge 2 lists của cùng entity bằng last-write-wins theo `updated_at`.
 * Result giữ tất cả id duy nhất từ cả 2 lists, lấy bản có updated_at lớn nhất.
 */
export function mergeByUpdatedAt<T extends BaseEntity>(
  local: T[],
  remote: T[],
): T[] {
  const map = new Map<string, T>();
  for (const it of local) map.set(it.id, it);
  for (const it of remote) {
    const existing = map.get(it.id);
    if (!existing || it.updated_at > existing.updated_at) {
      map.set(it.id, it);
    }
  }
  return Array.from(map.values());
}

/** Bulk write: ghi nhiều records — fire-and-forget */
export async function writeBatch<T extends BaseEntity>(
  ownerUid: string,
  name: string,
  items: T[],
): Promise<void> {
  await Promise.all(items.map((it) => writeRecord(ownerUid, name, it)));
}
