/**
 * lib/apps-server.ts — Phase 19.22.
 *
 * Server-only fetch app metadata. Dùng Admin SDK → bypass rules,
 * faster than client SDK trên server.
 *
 * Fallback static registry.json nếu Firestore lỗi/trống.
 *
 * Dùng trong:
 *   - /downloads/page.tsx (server component)
 *   - /dl/[appId]/route.ts (route handler)
 */
import 'server-only';
import { adminDb, adminReady } from './firebase-admin';
import registry from '@/public/apps-registry.json';
import { APP_META } from '@/data/apps-meta';
import { mergeRegistry, findAppById, type AppRegistry } from '@trishteam/core/apps';
import type { AppForWebsite } from './apps';

function getFallback(): AppForWebsite[] {
  return mergeRegistry(registry as unknown as AppRegistry, APP_META) as AppForWebsite[];
}

export async function fetchAppsServer(): Promise<AppForWebsite[]> {
  if (!adminReady()) return getFallback();
  try {
    const snap = await adminDb().collection('apps_meta').get();
    if (snap.empty) return getFallback();
    return snap.docs.map(
      (d) => ({ ...(d.data() as object), id: d.id }) as AppForWebsite,
    );
  } catch (e) {
    console.warn('[apps-server] fetch all fail, fallback:', e);
    return getFallback();
  }
}

export async function fetchAppByIdServer(id: string): Promise<AppForWebsite | null> {
  if (!adminReady()) {
    return findAppById(getFallback() as never, id) as AppForWebsite | null;
  }
  try {
    const snap = await adminDb().collection('apps_meta').doc(id).get();
    if (snap.exists) {
      return { ...(snap.data() as object), id } as AppForWebsite;
    }
  } catch (e) {
    console.warn(`[apps-server] ${id} fail:`, e);
  }
  return findAppById(getFallback() as never, id) as AppForWebsite | null;
}
