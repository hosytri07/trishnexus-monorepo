/**
 * TrishOffice — localStorage persistence helpers (Phase 38.6 — Phase 1).
 *
 * Phase 1: lưu localStorage với prefix `trishoffice:` cho mọi collection.
 * Phase 2+ (sau khi có Firestore key activated): sync 2-way với /trishoffice/{uid}/{collection}.
 *
 * Pattern dùng:
 *   const employees = useCollection<Employee>('employees');
 *   employees.create(...)
 *   employees.update(id, ...)
 *   employees.delete(id)
 */

import { useEffect, useState, useRef } from 'react';
import { useSync } from './sync/SyncContext';
import {
  loadCollection as fsLoadCollection,
  writeRecord as fsWriteRecord,
  deleteRecord as fsDeleteRecord,
  subscribeCollection as fsSubscribeCollection,
  mergeByUpdatedAt,
  writeBatch as fsWriteBatch,
} from './sync/firestore-sync';

const PREFIX = 'trishoffice:';

interface BaseEntity {
  id: string;
  created_at: number;
  updated_at: number;
}

function lsKey(collection: string): string {
  return PREFIX + collection;
}

export function loadAll<T>(collection: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(lsKey(collection));
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function saveAll<T>(collection: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lsKey(collection), JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Hook reactive cho 1 collection. Auto-load + auto-save khi mutate.
 *
 * Usage:
 *   const { items, create, update, remove, clear } = useCollection<Employee>('employees');
 */
export function useCollection<T extends BaseEntity>(
  collection: string,
  idPrefix?: string,
): {
  items: T[];
  create: (input: Omit<T, 'id' | 'created_at' | 'updated_at'>) => T;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  clear: () => void;
  reload: () => void;
} {
  const [items, setItems] = useState<T[]>([]);
  const { ownerUid, enabled: syncEnabled } = useSync();
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;

  // ============================================================
  // Phase 38.18 — Cloud sync Firestore
  // Khi có ownerUid (Firebase user logged in):
  //   1. On mount: load Firestore + merge với localStorage (last-write-wins)
  //   2. Subscribe onSnapshot real-time → cập nhật cả local + Firestore
  //   3. Mọi mutation (create/update/remove) tự sync 2 chiều
  // Khi không có ownerUid → fallback localStorage-only behavior
  // ============================================================
  useEffect(() => {
    // Initial load: localStorage trước (instant) → Firestore sau (async merge)
    const local = loadAll<T>(collection);
    setItems(local);

    if (!syncEnabled || !ownerUid) return;

    // Pull remote 1 lần + merge upload local-only items lên Firestore
    let cancelled = false;
    void (async () => {
      const remote = await fsLoadCollection<T>(ownerUid, collection);
      if (cancelled) return;
      const merged = mergeByUpdatedAt(local, remote);
      setItems(merged);
      saveAll<T>(collection, merged);
      // Đẩy local-only items (chưa có trên remote) lên Firestore
      const remoteIds = new Set(remote.map((r) => r.id));
      const localOnly = merged.filter((m) => !remoteIds.has(m.id));
      if (localOnly.length > 0) {
        void fsWriteBatch(ownerUid, collection, localOnly);
      }
    })();

    // Real-time subscribe
    const unsub = fsSubscribeCollection<T>(ownerUid, collection, (remote) => {
      const merged = mergeByUpdatedAt(itemsRef.current, remote);
      setItems(merged);
      saveAll<T>(collection, merged);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [collection, ownerUid, syncEnabled]);

  function persist(next: T[]): void {
    setItems(next);
    saveAll<T>(collection, next);
  }

  function create(
    input: Omit<T, 'id' | 'created_at' | 'updated_at'>,
  ): T {
    const now = Date.now();
    const entity = {
      ...input,
      id: generateId(idPrefix ?? collection.slice(0, 3)),
      created_at: now,
      updated_at: now,
    } as T;
    persist([entity, ...items]);
    // Sync up
    if (syncEnabled && ownerUid) {
      void fsWriteRecord(ownerUid, collection, entity);
    }
    return entity;
  }

  function update(id: string, patch: Partial<T>): void {
    const now = Date.now();
    let updated: T | undefined;
    persist(
      items.map((it) => {
        if (it.id === id) {
          updated = { ...it, ...patch, updated_at: now };
          return updated;
        }
        return it;
      }),
    );
    if (syncEnabled && ownerUid && updated) {
      void fsWriteRecord(ownerUid, collection, updated);
    }
  }

  function remove(id: string): void {
    persist(items.filter((it) => it.id !== id));
    if (syncEnabled && ownerUid) {
      void fsDeleteRecord(ownerUid, collection, id);
    }
  }

  function clear(): void {
    if (syncEnabled && ownerUid) {
      // Xóa từng item trên Firestore (deleteCollection ko có client SDK)
      items.forEach((it) => void fsDeleteRecord(ownerUid, collection, it.id));
    }
    persist([]);
  }

  function reload(): void {
    setItems(loadAll<T>(collection));
    // Re-trigger sync nếu enabled (call effect lại bằng cách thay đổi state ko cần)
  }

  return { items, create, update, remove, clear, reload };
}

/** Format VND số tiền: "12.345.678 đ" */
export function formatVND(amount: number): string {
  if (!isFinite(amount)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

/** Format date YYYY-MM-DD → "DD/MM/YYYY" */
export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Today YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
