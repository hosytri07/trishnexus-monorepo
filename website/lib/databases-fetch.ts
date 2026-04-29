/**
 * lib/databases-fetch.ts — Phase 19.22.
 *
 * Helper fetch 4 collection database từ Firestore với fallback static TS.
 * Có in-memory cache 5 phút để không refetch khi user navigate giữa các trang.
 *
 * Pattern:
 *   1. Check module-level cache (TTL 5 phút) → trả luôn nếu còn fresh
 *   2. Try fetch Firestore (admin update qua /admin/databases hoặc Firestore Console)
 *   3. Nếu Firestore trống / lỗi → fallback static TS data (đảm bảo trang
 *      luôn hiển thị data, kể cả khi chưa seed)
 *   4. Cache result + return
 *
 * Module-level cache shared cross-component → user vào /quy-chuan rồi sang
 * /dinh-muc lần đầu mới fetch network, sau đó dùng cache → instant.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from './firebase';

import { STANDARDS, type Standard } from '@/data/standards-vn';
import { CONSTRUCTION_NORMS, type ConstructionNorm } from '@/data/dinh-muc';
import { MATERIALS, type MaterialItem } from '@/data/materials';
import { ROADS, type Road } from '@/data/roads-vn';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

interface CacheEntry<T> {
  data: T[];
  fetchedAt: number;
  inflight?: Promise<T[]>;
}

const cache: Record<string, CacheEntry<unknown>> = {};

async function fetchCollectionWithFallback<T>(
  collectionName: string,
  fallback: T[],
): Promise<T[]> {
  const now = Date.now();
  const entry = cache[collectionName] as CacheEntry<T> | undefined;

  // Cache hit còn fresh
  if (entry && now - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.data;
  }
  // Đang fetch trong tab khác — share promise (race-condition guard)
  if (entry?.inflight) {
    return entry.inflight;
  }
  if (!firebaseReady || !db) {
    cache[collectionName] = { data: fallback, fetchedAt: now };
    return fallback;
  }

  const promise = (async () => {
    try {
      const snap = await getDocs(collection(db!, collectionName));
      const items = snap.empty
        ? fallback
        : (snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })) as T[]);
      cache[collectionName] = { data: items, fetchedAt: Date.now() };
      return items;
    } catch (e) {
      console.warn(`[databases-fetch] ${collectionName} fail, fallback static:`, e);
      cache[collectionName] = { data: fallback, fetchedAt: Date.now() };
      return fallback;
    }
  })();

  cache[collectionName] = {
    data: entry?.data ?? fallback,
    fetchedAt: entry?.fetchedAt ?? 0,
    inflight: promise,
  };
  return promise;
}

/** Bust cache thủ công (gọi sau khi admin sửa data). */
export function invalidateDatabasesCache(collectionName?: string) {
  if (collectionName) delete cache[collectionName];
  else Object.keys(cache).forEach((k) => delete cache[k]);
}

export const fetchStandards = (): Promise<Standard[]> =>
  fetchCollectionWithFallback<Standard>('standards', STANDARDS);

export const fetchConstructionNorms = (): Promise<ConstructionNorm[]> =>
  fetchCollectionWithFallback<ConstructionNorm>('dinh_muc', CONSTRUCTION_NORMS);

export const fetchMaterials = (): Promise<MaterialItem[]> =>
  fetchCollectionWithFallback<MaterialItem>('vat_lieu', MATERIALS);

export const fetchRoads = (): Promise<Road[]> =>
  fetchCollectionWithFallback<Road>('roads_vn', ROADS);
