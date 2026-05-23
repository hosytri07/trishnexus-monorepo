/**
 * Phase 16.2.b — Firestore sync 2-way cho TrishLibrary.
 *
 * Sync 2 collection per user:
 *   - users/{uid}/trishlibrary/online_folders { items: OnlineFolder[] }
 *     (riêng user, admin TrishTEAM cũng KHÔNG đọc được — Firestore rules)
 *
 * Curated chung:
 *   - trishteam/library/{folderId} + sub-collection links/{linkId}
 *     (mọi signed-in user read; chỉ admin write)
 *
 * KHÔNG sync `files` (local scan) — path filesystem khác máy → vô nghĩa.
 *
 * Strategy:
 *   - On user login: load từ Firestore → replace local in-memory state
 *   - On state change (debounced 800ms): write Firestore
 *   - onSnapshot subscribe để pickup change từ máy khác trong vòng vài giây
 *   - Last-write-wins (updated_at). Không có CRDT phức tạp.
 */

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { paths } from '@trishteam/data';
import type { OnlineFolder } from '../types.js';

// ============================================================
// Online folders (per user)
// ============================================================

/** Load 1 lần lúc app mở. */
export async function loadOnlineFoldersFromFirestore(
  uid: string,
): Promise<OnlineFolder[] | null> {
  try {
    const db = getFirebaseDb();
    const ref = doc(db, paths.userTrishlibrary(uid, 'online_folders'));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!Array.isArray(data.items)) return null;
    return data.items as OnlineFolder[];
  } catch (err) {
    console.warn('[trishlibrary] load online_folders fail', err);
    return null;
  }
}

/** Save replace toàn bộ. Debounced ở caller. */
export async function saveOnlineFoldersToFirestore(
  uid: string,
  folders: OnlineFolder[],
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const ref = doc(db, paths.userTrishlibrary(uid, 'online_folders'));
    await setDoc(ref, {
      items: folders,
      updated_at: Date.now(),
      _server_updated_at: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[trishlibrary] save online_folders fail', err);
    throw err;
  }
}

/** Subscribe realtime — pick up changes từ máy khác. */
export function subscribeOnlineFolders(
  uid: string,
  callback: (folders: OnlineFolder[]) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  const ref = doc(db, paths.userTrishlibrary(uid, 'online_folders'));
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback([]);
        return;
      }
      const data = snap.data();
      if (Array.isArray(data.items)) {
        callback(data.items as OnlineFolder[]);
      }
    },
    (err) => {
      console.warn('[trishlibrary] subscribe online_folders error', err);
    },
  );
}

// ============================================================
// TrishTEAM curated library (chung — admin write, all read)
// ============================================================

/**
 * Phase 16.2.d v2 — Schema đơn giản: 1 doc Firestore /trishteam_library/{id}
 * chứa cả folder metadata + links array INLINE. Không subcollection.
 * Tránh race condition + sync nhanh hơn.
 */
function parseTrishteamFolderDoc(
  docId: string,
  data: Record<string, unknown>,
): OnlineFolder {
  return {
    id: docId,
    name: typeof data.name === 'string' ? data.name : '',
    icon: typeof data.icon === 'string' ? data.icon : '📁',
    links: Array.isArray(data.links) ? (data.links as OnlineFolder['links']) : [],
    created_at: typeof data.created_at === 'number' ? data.created_at : 0,
    updated_at: typeof data.updated_at === 'number' ? data.updated_at : 0,
  };
}

export async function loadTrishteamLibraryFromFirestore(): Promise<
  OnlineFolder[]
> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(
      collection(db, paths.trishteamLibraryFolders()),
    );
    return snap.docs.map((d) => parseTrishteamFolderDoc(d.id, d.data()));
  } catch (err) {
    console.warn('[trishlibrary] load trishteam library fail', err);
    return [];
  }
}

/**
 * Save TrishTEAM library — chỉ admin gọi được (Firestore rules enforce).
 * Đồng bộ inline: mỗi folder = 1 doc với links array trong field `links`.
 * Diff-based: chỉ delete folders không còn trong input, add/update folders trong input.
 */
export async function saveTrishteamLibraryToFirestore(
  folders: OnlineFolder[],
): Promise<void> {
  try {
    const db = getFirebaseDb();
    const oldSnap = await getDocs(
      collection(db, paths.trishteamLibraryFolders()),
    );
    const inputIds = new Set(folders.map((f) => f.id));
    const batch = writeBatch(db);
    // Delete folders không còn trong input
    for (const oldDoc of oldSnap.docs) {
      if (!inputIds.has(oldDoc.id)) {
        batch.delete(oldDoc.ref);
      }
    }
    // Set/update folders hiện có
    for (const folder of folders) {
      const ref = doc(db, paths.trishteamLibraryFolder(folder.id));
      batch.set(ref, {
        name: folder.name,
        icon: folder.icon,
        links: folder.links,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      });
    }
    await batch.commit();
  } catch (err) {
    console.warn('[trishlibrary] save trishteam library fail', err);
    throw err;
  }
}

/** Subscribe realtime — snapshot trả thẳng folder data có links inline. */
export function subscribeTrishteamLibrary(
  callback: (folders: OnlineFolder[]) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  return onSnapshot(
    collection(db, paths.trishteamLibraryFolders()),
    (snap) => {
      const folders = snap.docs.map((d) =>
        parseTrishteamFolderDoc(d.id, d.data()),
      );
      callback(folders);
    },
    (err) => {
      console.warn('[trishlibrary] subscribe trishteam library error', err);
    },
  );
}
