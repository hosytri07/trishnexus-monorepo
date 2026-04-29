/**
 * Phase 14.6.a — Registry loader.
 *
 * Fetch registry JSON cho launcher. Fallback về `SEED_REGISTRY` built-in khi:
 *  - Fetch fail (timeout, 4xx/5xx, network, JSON parse, schema mismatch)
 *
 * Không throw — UI phải render được dù offline hoàn toàn. Error log
 * console.warn để dev thấy nhưng user không bị block.
 *
 * Phase 14.7.g — Switch sang Rust-side fetch:
 *  - `fetchRegistryText()` từ tauri-bridge dùng `reqwest` ở Rust process,
 *    bypass hoàn toàn WebView CORS/CSP/redirect rules.
 *  - `DEFAULT_REGISTRY_URL` hardcode — production fetch từ canonical URL,
 *    không expose UI cho end user. Admin có thể override qua
 *    `settings.registryUrl` (hidden field, set qua localStorage hoặc
 *    future TrishAdmin app).
 *
 * Phase 14.6.b sẽ gắn scheduled refetch với setInterval theo
 * `settings.autoUpdateInterval`.
 */

import type { AppRegistry } from '@trishteam/core/apps';
import { SEED_REGISTRY } from './apps-seed.js';
import { fetchRegistryText } from './tauri-bridge.js';

/**
 * URL chính thức cho registry — production launcher fetch luôn từ đây
 * trừ khi `settings.registryUrl` non-empty (admin override).
 *
 * Tại sao hardcode? End user không cần biết URL này, không cần config.
 * Launcher hoạt động "out of the box" — chỉ admin/dev mới đổi qua
 * TrishAdmin (chưa build) hoặc localStorage manual.
 */
/**
 * Phase 20.2 — Endpoint live đọc Firestore `/apps_meta` (admin sửa qua
 * /admin/apps → launcher next-fetch sẽ thấy ngay). Static file
 * `/apps-registry.json` giữ làm fallback nếu API down.
 *
 * Dùng www.trishteam.io.vn (canonical) — apex redirect 307 → www.
 */
export const DEFAULT_REGISTRY_URL =
  'https://www.trishteam.io.vn/api/apps-registry';
export const FALLBACK_REGISTRY_URL =
  'https://www.trishteam.io.vn/apps-registry.json';

/**
 * Phase 20.2 — Bumped 2 → 3 sau khi `apps-registry.json` thêm field
 * `release_at_default` + `release_at` per-app + `apps_meta` Firestore mirror.
 * Validator chỉ kiểm tra `>= 2` (forward-compatible) thay vì equality strict
 * — nếu tương lai bump thêm field optional, launcher cũ vẫn parse được.
 */
const MIN_SCHEMA_VERSION = 2;

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
  // Phase 20.2 — accept >= MIN_SCHEMA_VERSION cho phép forward-compat.
  if (typeof r.schema_version !== 'number' || r.schema_version < MIN_SCHEMA_VERSION) {
    return false;
  }
  if (!Array.isArray(r.apps)) return false;
  if (!r.ecosystem || typeof r.ecosystem !== 'object') return false;
  return true;
}

/**
 * Fetch registry text qua Rust (reqwest), parse JSON, validate shape.
 * Throw nếu fail — caller wrap để fallback seed.
 */
async function fetchRemote(url: string): Promise<AppRegistry> {
  const text = await fetchRegistryText(url);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!isValidRegistry(json)) {
    throw new Error('registry shape mismatch');
  }
  return json;
}

/**
 * Load registry. URL override (admin) > DEFAULT_REGISTRY_URL > seed nếu fail.
 *
 * @param overrideUrl Nếu set + non-empty, dùng URL này thay default.
 *   App.tsx truyền `settings.registryUrl` — empty (default user) → dùng
 *   DEFAULT_REGISTRY_URL.
 */
export async function loadRegistry(
  overrideUrl?: string,
): Promise<RegistryLoadResult> {
  const url =
    overrideUrl && overrideUrl.trim() ? overrideUrl.trim() : DEFAULT_REGISTRY_URL;

  // 1. Thử endpoint live (API Firestore)
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
    console.warn('[trishlauncher] live API fail, try static fallback:', message);

    // 2. Fallback: static apps-registry.json (chỉ khi user không override URL)
    if (!overrideUrl || !overrideUrl.trim()) {
      try {
        const fallback = await fetchRemote(FALLBACK_REGISTRY_URL);
        return {
          registry: fallback,
          source: 'remote',
          fetchedAt: Date.now(),
          error: null,
        };
      } catch (err2) {
        console.warn(
          '[trishlauncher] static fallback also fail, using seed:',
          err2 instanceof Error ? err2.message : String(err2),
        );
      }
    }

    // 3. Cuối: seed built-in
    return {
      registry: SEED_REGISTRY,
      source: 'seed',
      fetchedAt: null,
      error: message,
    };
  }
}
