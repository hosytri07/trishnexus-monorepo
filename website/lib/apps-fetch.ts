/**
 * lib/apps-fetch.ts — Phase 19.22.
 *
 * Helper fetch /apps_meta từ Firestore với fallback static registry.json.
 * Có in-memory cache 5 phút (giống databases-fetch.ts).
 *
 * 2 entry:
 *   - fetchAppsClient(): client SDK (React component dùng useEffect)
 *   - fetchAppByIdClient(id): single app
 *
 * Server fetch (Admin SDK) ở `lib/apps-server.ts` riêng để tránh bundle
 * firebase-admin vào client.
 */
'use client';

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from './firebase';
import registry from '@/public/apps-registry.json';
import { APP_META } from '@/data/apps-meta';
import { mergeRegistry, findAppById, type AppRegistry } from '@trishteam/core/apps';
import type { AppForWebsite } from './apps';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  data: AppForWebsite[];
  fetchedAt: number;
  inflight?: Promise<AppForWebsite[]>;
}

let cache: CacheEntry | null = null;

function getFallback(): AppForWebsite[] {
  return mergeRegistry(registry as unknown as AppRegistry, APP_META) as AppForWebsite[];
}

/** Fetch tất cả app từ Firestore /apps_meta + fallback registry.json. */
export async function fetchAppsClient(): Promise<AppForWebsite[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (cache?.inflight) return cache.inflight;

  if (!firebaseReady || !db) {
    const data = getFallback();
    cache = { data, fetchedAt: now };
    return data;
  }

  const promise = (async () => {
    try {
      const snap = await getDocs(collection(db!, 'apps_meta'));
      if (snap.empty) {
        const data = getFallback();
        cache = { data, fetchedAt: Date.now() };
        return data;
      }
      const items = snap.docs.map(
        (d) => ({ ...(d.data() as object), id: d.id }) as AppForWebsite,
      );
      cache = { data: items, fetchedAt: Date.now() };
      return items;
    } catch (e) {
      console.warn('[apps-fetch] fail, fallback:', e);
      const data = getFallback();
      cache = { data, fetchedAt: Date.now() };
      return data;
    }
  })();

  cache = {
    data: cache?.data ?? getFallback(),
    fetchedAt: cache?.fetchedAt ?? 0,
    inflight: promise,
  };
  return promise;
}

/** Fetch 1 app theo id. */
export async function fetchAppByIdClient(id: string): Promise<AppForWebsite | null> {
  // Check cache trước
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return findAppById(cache.data as never, id) as AppForWebsite | null;
  }
  if (!firebaseReady || !db) {
    return findAppById(getFallback() as never, id) as AppForWebsite | null;
  }
  try {
    const ref = doc(db, 'apps_meta', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...(snap.data() as object), id } as AppForWebsite;
    }
  } catch (e) {
    console.warn(`[apps-fetch] ${id} fail:`, e);
  }
  return findAppById(getFallback() as never, id) as AppForWebsite | null;
}

/** Force invalidate cache. */
export function invalidateAppsCache() {
  cache = null;
}
