/**
 * Phase 14.6.a — Registry loader.
 *
 * Fetch registry JSON từ URL config trong Settings. Fallback về
 * `SEED_REGISTRY` built-in khi:
 *  - URL rỗng / không set
 *  - Fetch fail (timeout, 4xx/5xx, CORS, offline)
 *  - JSON parse fail
 *  - Schema mismatch (schema_version != 2 hoặc `apps` không phải array)
 *
 * Không throw — UI phải render được dù offline hoàn toàn. Error log
 * console.warn để dev thấy nhưng user không bị block.
 *
 * Phase 14.6.b sẽ gắn scheduled refetch với setInterval theo
 * `settings.autoUpdateInterval`.
 */

import type { AppRegistry } from '@trishteam/core/apps';
import { SEED_REGISTRY } from './apps-seed.js';

const FETCH_TIMEOUT_MS = 8_000;
const EXPECTED_SCHEMA_VERSION = 2;

export interface RegistryLoadResult {
  registry: AppRegistry;
  /** Nguồn thực tế sử dụng — UI có thể hiện badge "seed"/"remote". */
  source: 'seed' | 'remote';
  /** Epoch ms khi fetch thành công. null nếu dùng seed. */
  fetchedAt: number | null;
  /** Error message nếu fetch fail (đã fallback về seed). */
  error: string | null;
}

/**
 * Check runtime shape. TypeScript không validate ở runtime nên tự
 * check các field quan trọng. Không deep-validate từng app — UI code
 * đã defensive với optional fields.
 */
function isValidRegistry(data: unknown): data is AppRegistry {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  if (r.schema_version !== EXPECTED_SCHEMA_VERSION) return false;
  if (!Array.isArray(r.apps)) return false;
  if (!r.ecosystem || typeof r.ecosystem !== 'object') return false;
  return true;
}

/**
 * Fetch registry với AbortController timeout 8s. Trả kết quả đã resolve
 * hoặc throw lỗi (gọi wrap ngoài để fallback).
 */
async function fetchRemote(url: string): Promise<AppRegistry> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Cache: no-cache để luôn check etag/last-modified mà không miss
      // completely (browser vẫn 304 được).
      cache: 'no-cache',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as unknown;
    if (!isValidRegistry(json)) {
      throw new Error('registry shape mismatch');
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load registry theo config. Rỗng URL = dùng seed luôn (không network).
 * Fail URL = seed + error message.
 *
 * Registry URL có thể là:
 *  - Full JSON path: `https://cdn.example.com/apps-registry.json`
 *  - Base path (auto append): `https://cdn.example.com/` → sẽ append
 *    `apps-registry.json`. Detect bằng heuristic trailing `/` hoặc
 *    không có extension.
 */
export async function loadRegistry(
  configUrl: string,
): Promise<RegistryLoadResult> {
  const trimmed = configUrl.trim();
  if (!trimmed) {
    return {
      registry: SEED_REGISTRY,
      source: 'seed',
      fetchedAt: null,
      error: null,
    };
  }

  const url = resolveRegistryUrl(trimmed);
  try {
    const remote = await fetchRemote(url);
    return {
      registry: remote,
      source: 'remote',
      fetchedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[trishlauncher] registry fetch fail, using seed:', message);
    return {
      registry: SEED_REGISTRY,
      source: 'seed',
      fetchedAt: null,
      error: message,
    };
  }
}

/**
 * Trả URL cuối để fetch. Trailing `/` hoặc không kết thúc `.json` →
 * append `apps-registry.json`. Convention: CDN cấu trúc theo folder
 * nên user chỉ set prefix được.
 */
function resolveRegistryUrl(raw: string): string {
  if (raw.endsWith('.json')) return raw;
  if (raw.endsWith('/')) return raw + 'apps-registry.json';
  return raw + '/apps-registry.json';
}
