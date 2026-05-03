/**
 * Phase 28.14 — TrishTEAM AutoLISP curated library.
 *
 * Schema:
 *   /lisp_library/{lispId} = {
 *     name, command, description, category, filename, fileId, filePath,
 *     size, uploadedAt, uploadedBy, uploadedByEmail, note,
 *   }
 *
 * Storage: Telegram channel (tg_lisp_chat) chứa file .lsp (50MB limit per
 * Telegram bot). Firestore chứa metadata + telegram file_id.
 *
 * Permission: admin write, paid user read.
 */

import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  type Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

export interface LispLibraryEntry {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  filename: string;
  fileId: string;
  filePath: string;
  size: number;
  uploadedAt: number;
  uploadedBy: string;
  uploadedByEmail: string;
  note?: string;
}

export const LISP_CATEGORIES = [
  'Khảo sát',
  'Vẽ đường',
  'Layer',
  'Text & Dim',
  'Block',
  'Chia điểm',
  'Đo đạc',
  'Khác',
] as const;

export const lispLibraryPaths = {
  doc: (id: string) => `lisp_library/${id}`,
  collection: () => 'lisp_library',
} as const;

export async function listLispLibrary(): Promise<LispLibraryEntry[]> {
  try {
    const db = getFirebaseDb();
    const q = query(collection(db, lispLibraryPaths.collection()), orderBy('uploadedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LispLibraryEntry, 'id'>) }));
  } catch (err) {
    console.error('[admin-keys] listLispLibrary fail', err);
    return [];
  }
}

export function subscribeLispLibrary(callback: (entries: LispLibraryEntry[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, lispLibraryPaths.collection()), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LispLibraryEntry, 'id'>) }));
    callback(entries);
  }, (err) => {
    console.error('[admin-keys] subscribeLispLibrary error', err);
  });
}

export async function addLispLibraryEntry(entry: Omit<LispLibraryEntry, 'id'>): Promise<string> {
  const db = getFirebaseDb();
  const ref = await addDoc(collection(db, lispLibraryPaths.collection()), entry);
  return ref.id;
}

export async function updateLispLibraryEntry(id: string, patch: Partial<Omit<LispLibraryEntry, 'id'>>): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, lispLibraryPaths.doc(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('LISP entry không tồn tại');
  await setDoc(ref, { ...snap.data(), ...patch }, { merge: true });
}

export async function deleteLispLibraryEntry(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, lispLibraryPaths.doc(id)));
}
