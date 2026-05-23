/**
 * Phase 15.0.l — Min-spec loader (admin-managed remote JSON).
 *
 * Pattern giống TrishLauncher registry-loader: fetch từ canonical URL,
 * fallback bundled `SOFTWARE_SPECS` nếu offline / fail.
 *
 * Admin có thể edit `website/public/min-specs.json` để thêm/sửa app
 * mà không cần ship lại TrishCheck — user bấm Refresh là cập nhật.
 *
 * Future TrishAdmin app sẽ có UI quản lý chuyên biệt thay vì edit JSON
 * tay. Lúc đó URL có thể chuyển sang API endpoint authenticated.
 */

import { fetchText } from '../tauri-bridge.js';
import {
  SOFTWARE_SPECS,
  type SoftwareSpec,
} from '../data/min-specs.js';

export const DEFAULT_SPECS_URL = 'https://trishteam.io.vn/min-specs.json';

const EXPECTED_SCHEMA_VERSION = 1;

export interface SpecsLoadResult {
  specs: SoftwareSpec[];
  source: 'remote' | 'bundled';
  fetchedAt: number | null;
  error: string | null;
}

interface RemoteSpecsFile {
  schema_version: number;
  updated_at?: string;
  specs: SoftwareSpec[];
}

function isValidSpecsFile(data: unknown): data is RemoteSpecsFile {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  if (r.schema_version !== EXPECTED_SCHEMA_VERSION) return false;
  if (!Array.isArray(r.specs)) return false;
  return true;
}

export async function loadMinSpecs(
  url: string = DEFAULT_SPECS_URL,
): Promise<SpecsLoadResult> {
  try {
    const text = await fetchText(url);
    const json = JSON.parse(text) as unknown;
    if (!isValidSpecsFile(json)) {
      throw new Error('min-specs shape mismatch');
    }
    return {
      specs: json.specs,
      source: 'remote',
      fetchedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[trishcheck] min-specs fetch fail, using bundled:', message);
    return {
      specs: SOFTWARE_SPECS,
      source: 'bundled',
      fetchedAt: null,
      error: message,
    };
  }
}
