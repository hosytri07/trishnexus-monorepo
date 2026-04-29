/**
 * Phase 19.24.2 — Database VN editor helpers.
 *
 * Generic CRUD cho 4 collection database VN:
 *   - standards   (Quy chuẩn / TCVN)
 *   - dinh_muc    (Định mức xây dựng)
 *   - vat_lieu    (Vật liệu)
 *   - roads_vn    (Đường VN)
 *
 * Vì schema khác nhau, em dùng generic Record<string, unknown> + JSON editor
 * trên UI thay vì build 4 form chuyên biệt.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

export type DatabaseCollection = 'standards' | 'dinh_muc' | 'vat_lieu' | 'roads_vn';

export interface DatabaseCollectionMeta {
  id: DatabaseCollection;
  label: string;
  description: string;
  icon: string;
  /** Schema chính — chỉ để người dùng tham khảo, không enforce */
  schemaHint: string;
}

export const DB_COLLECTIONS: DatabaseCollectionMeta[] = [
  {
    id: 'standards',
    label: 'Quy chuẩn / TCVN',
    description: 'QCVN · TCVN · Thông tư · Nghị định · Quyết định ngành XD-GT',
    icon: '📚',
    schemaHint:
      '{ id, code, type, name, year, issuer, scope, category, tags[], url?, replaces? }',
  },
  {
    id: 'dinh_muc',
    label: 'Định mức XD',
    description: 'Định mức hao phí vật liệu / nhân công / máy theo QĐ 1776/2007',
    icon: '📐',
    schemaHint:
      '{ id, code, category, name, unit, description, resources[{type, name, unit, qty, grade?}], source }',
  },
  {
    id: 'vat_lieu',
    label: 'Vật liệu XD',
    description: 'Catalog vật liệu xây dựng phổ thông + thông số kỹ thuật',
    icon: '🧱',
    schemaHint: '{ id, name, category, spec, standard?, brands?[], ... }',
  },
  {
    id: 'roads_vn',
    label: 'Đường VN',
    description: 'Quốc lộ + cao tốc + đường vành đai chính',
    icon: '🛣️',
    schemaHint:
      '{ id, code, name, type, start_point, end_point, length_km?, provinces[], ... }',
  },
];

export interface DbItem {
  /** Doc ID */
  _id: string;
  /** Toàn bộ data (variable schema) */
  [key: string]: unknown;
}

export async function listItems(col: DatabaseCollection): Promise<DbItem[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, col));
  return snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
}

export async function saveItem(
  col: DatabaseCollection,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getFirebaseDb();
  // Bỏ _id ra khỏi payload (lưu thành doc ID, không phải field)
  const { _id, ...rest } = data as { _id?: string; [k: string]: unknown };
  void _id;
  await setDoc(doc(db, col, id), rest, { merge: false });
}

export async function deleteItem(
  col: DatabaseCollection,
  id: string,
): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, col, id));
}

/** Lấy human-readable preview cho list view (title từ field tên/code). */
export function getItemTitle(item: DbItem, col: DatabaseCollection): string {
  if (col === 'standards') {
    return `${(item.code as string) ?? '?'} — ${(item.name as string) ?? '(chưa có)'}`;
  }
  if (col === 'dinh_muc') {
    return `${(item.code as string) ?? '?'} — ${(item.name as string) ?? '(chưa có)'}`;
  }
  if (col === 'vat_lieu') {
    return (item.name as string) ?? `(${item._id})`;
  }
  if (col === 'roads_vn') {
    return `${(item.code as string) ?? '?'} — ${(item.name as string) ?? '(chưa có)'}`;
  }
  return item._id;
}

/** Lấy 1 dòng mô tả ngắn (sub-title trong list). */
export function getItemSubtitle(item: DbItem, col: DatabaseCollection): string {
  if (col === 'standards') return (item.scope as string) ?? '';
  if (col === 'dinh_muc') return (item.description as string) ?? '';
  if (col === 'vat_lieu') return (item.spec as string) ?? '';
  if (col === 'roads_vn') {
    const start = item.start_point as string | undefined;
    const end = item.end_point as string | undefined;
    return start && end ? `${start} → ${end}` : '';
  }
  return '';
}
