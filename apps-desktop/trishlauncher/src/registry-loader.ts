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
import { getFirebaseDb } from '@trishteam/auth';
import { collection as fsCollection, getDocs as fsGetDocs } from 'firebase/firestore';

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
// Phase 38 — Switch primary từ /api/apps-registry (Firestore) sang static
// /apps-registry.json để registry update theo git commit + Vercel auto-deploy,
// không cần admin trigger seed-apps-meta. Static file là source of truth.
export const DEFAULT_REGISTRY_URL =
  'https://www.trishteam.io.vn/apps-registry.json';
export const FALLBACK_REGISTRY_URL =
  'https://www.trishteam.io.vn/api/apps-registry';

/**
 * Phase 38 — Bump 2 → 6 để Launcher v1.0 reject registry cũ (schema v5
 * còn `requires_key` + `key_type` deprecated, login_required sai). Fallback
 * sang local seed (đã update) nếu Vercel chưa deploy schema v6.
 *
 * Trở về `MIN_SCHEMA_VERSION = N-1` khi schema bump tiếp (forward-compat).
 */
const MIN_SCHEMA_VERSION = 6;

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
 * Phase 41 — Fetch Firestore /apps_catalog (admin-managed catalog).
 *
 * Source of truth mới, cho phép add app NGOÀI hệ sinh thái (Photoshop, AutoCAD, etc.).
 * Shape khác với AppRegistry → cần convert tại đây.
 *
 * Throw nếu fail/empty — caller fallback sang static JSON.
 */
interface CatalogDoc {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  category: 'ecosystem' | 'external' | 'utility';
  logo_url: string;
  version: string;
  status: 'draft' | 'released' | 'deprecated';
  release_at?: string;
  publisher?: string;
  homepage_url?: string;
  download_url_windows?: string;
  download_url_macos?: string;
  download_url_linux?: string;
  changelog_url?: string;
  size_mb?: number;
  login_required?: 'none' | 'trishteam' | 'key';
  display_order?: number;
}

async function fetchFirestoreCatalog(): Promise<AppRegistry> {
  const db = getFirebaseDb();
  const snap = await fsGetDocs(fsCollection(db, 'apps_catalog'));
  const docs: CatalogDoc[] = snap.docs.map((d) => d.data() as CatalogDoc);
  if (docs.length === 0) {
    throw new Error('apps_catalog empty (chưa seed)');
  }
  // Chỉ hiển thị app status=released
  const released = docs
    .filter((d) => d.status === 'released')
    .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));

  // Convert sang AppRegistry shape
  const apps = released.map((d) => {
    const dl: Record<string, { url: string; sha256: string; installer_args: string[] }> = {};
    if (d.download_url_windows) dl.windows_x64 = { url: d.download_url_windows, sha256: '', installer_args: [] };
    if (d.download_url_macos) dl.macos_arm64 = { url: d.download_url_macos, sha256: '', installer_args: [] };
    if (d.download_url_linux) dl.linux_x64 = { url: d.download_url_linux, sha256: '', installer_args: [] };
    const platforms: ('windows_x64' | 'macos_arm64' | 'linux_x64')[] = [];
    if (d.download_url_windows) platforms.push('windows_x64');
    if (d.download_url_macos) platforms.push('macos_arm64');
    if (d.download_url_linux) platforms.push('linux_x64');
    // Phase 41.2 — External app: nếu không có download URL, fake windows_x64 với homepage_url
    // để CTA "Mở trang chủ" hiển thị + nút không bị disabled "Chưa hỗ trợ máy này"
    if (d.category === 'external' && platforms.length === 0 && d.homepage_url) {
      dl.windows_x64 = { url: d.homepage_url, sha256: '', installer_args: [] };
      platforms.push('windows_x64');
    }
    // login_required: TrishTEAM convention 'user' = paid; 'none' = anyone; cẩn thận map
    const login = d.login_required === 'trishteam' ? 'user' : d.login_required === 'key' ? 'user' : 'none';
    return {
      id: d.id,
      name: d.name,
      tagline: d.tagline,
      logo_url: d.logo_url,
      version: d.version,
      size_bytes: d.size_mb ? Math.round(d.size_mb * 1024 * 1024) : 0,
      status: d.status,
      release_at: d.release_at ?? '2026-05-07T09:00:00+07:00',
      login_required: login,
      platforms: platforms.length > 0 ? platforms : ['windows_x64'],
      screenshots: [],
      changelog_url: d.changelog_url ?? '',
      download: dl,
      // Phase 41 — category/homepage/publisher từ catalog
      category: d.category,
      homepage_url: d.homepage_url,
      publisher: d.publisher,
    };
  });

  return {
    schema_version: 6,
    updated_at: new Date().toISOString(),
    ecosystem: {
      name: 'TrishTEAM',
      tagline: 'Hệ sinh thái năng suất cá nhân',
      logo_url: 'https://trishteam.io.vn/logo.svg',
      website: 'https://trishteam.io.vn',
    },
    release_at_default: '2026-05-07T09:00:00+07:00',
    apps: apps as unknown as AppRegistry['apps'],
  };
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

  // Phase 41 — Thử Firestore /apps_catalog TRƯỚC (TrishAdmin source of truth mới).
  // Cho phép Trí add app NGOÀI hệ sinh thái mà không cần redeploy Vercel.
  // Skip Firestore nếu có overrideUrl (admin debug mode).
  if (!overrideUrl || !overrideUrl.trim()) {
    try {
      const fsReg = await fetchFirestoreCatalog();
      return {
        registry: fsReg,
        source: 'remote',
        fetchedAt: Date.now(),
        error: null,
      };
    } catch (errFs) {
      console.warn(
        '[trishlauncher] Firestore /apps_catalog empty/fail → fallback static JSON:',
        errFs instanceof Error ? errFs.message : String(errFs),
      );
    }
  }

  // 1. Thử static apps-registry.json
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
