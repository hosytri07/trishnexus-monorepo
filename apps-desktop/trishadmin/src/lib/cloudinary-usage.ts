/**
 * Phase 19.24.4 — Cloudinary usage helpers.
 *
 * Cloudinary Admin API:
 *   - GET /v1_1/{cloud_name}/usage  → bandwidth, storage, transformations
 *   - GET /v1_1/{cloud_name}/resources/image  → list ảnh (paginated, max 500)
 *
 * Auth: Basic base64(api_key:api_secret).
 *
 * Credentials lưu localStorage (admin nhập 1 lần). Không commit vào code.
 */

export interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface CloudinaryUsage {
  plan: string;
  last_updated: string;
  storage: { usage: number; limit: number; used_percent: number };
  bandwidth: { usage: number; limit: number; used_percent: number };
  transformations: { usage: number; limit: number; used_percent: number };
  resources: number;
  derived_resources: number;
}

export interface CloudinaryResource {
  public_id: string;
  format: string;
  resource_type: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
  secure_url: string;
  folder?: string;
  created_at: string;
}

const CRED_KEY = 'trishadmin.cloudinary_creds';

export function loadCreds(): CloudinaryCreds | null {
  try {
    const raw = window.localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CloudinaryCreds;
  } catch {
    return null;
  }
}

export function saveCreds(creds: CloudinaryCreds): void {
  window.localStorage.setItem(CRED_KEY, JSON.stringify(creds));
}

export function clearCreds(): void {
  window.localStorage.removeItem(CRED_KEY);
}

function authHeader(creds: CloudinaryCreds): string {
  const token = btoa(`${creds.apiKey}:${creds.apiSecret}`);
  return `Basic ${token}`;
}

export async function fetchUsage(creds: CloudinaryCreds): Promise<CloudinaryUsage> {
  const url = `https://api.cloudinary.com/v1_1/${creds.cloudName}/usage`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary usage fail: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudinaryUsage;
}

/**
 * List resources (paginated). Trả tối đa max_results = 500 mỗi call.
 * Để duyệt hết cần loop với next_cursor.
 */
export async function fetchResources(
  creds: CloudinaryCreds,
  options: { max_results?: number; next_cursor?: string } = {},
): Promise<{ resources: CloudinaryResource[]; next_cursor?: string }> {
  const params = new URLSearchParams();
  params.set('max_results', String(options.max_results ?? 500));
  if (options.next_cursor) params.set('next_cursor', options.next_cursor);
  const url = `https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/image?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(creds) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudinary resources fail: ${res.status} ${text}`);
  }
  return (await res.json()) as {
    resources: CloudinaryResource[];
    next_cursor?: string;
  };
}

export interface FolderStats {
  folder: string;
  count: number;
  bytes: number;
}

export interface ResourceSummary {
  total: number;
  totalBytes: number;
  byFolder: FolderStats[];
  topFiles: CloudinaryResource[];
}

/**
 * Quét tất cả resources (loop pagination), trả về stats theo folder + top 20 file lớn nhất.
 */
export async function fetchAllResourcesSummary(
  creds: CloudinaryCreds,
  onProgress?: (count: number) => void,
): Promise<ResourceSummary> {
  const all: CloudinaryResource[] = [];
  let cursor: string | undefined;
  let pages = 0;
  while (pages < 20) {
    const result = await fetchResources(creds, {
      max_results: 500,
      next_cursor: cursor,
    });
    all.push(...result.resources);
    onProgress?.(all.length);
    if (!result.next_cursor) break;
    cursor = result.next_cursor;
    pages++;
  }
  // Group by folder (lấy phần đầu trước /)
  const byFolderMap = new Map<string, FolderStats>();
  for (const r of all) {
    const folder = r.folder ?? (r.public_id.split('/').slice(0, -1).join('/') || '(root)');
    if (!byFolderMap.has(folder)) {
      byFolderMap.set(folder, { folder, count: 0, bytes: 0 });
    }
    const f = byFolderMap.get(folder)!;
    f.count++;
    f.bytes += r.bytes;
  }
  const byFolder = Array.from(byFolderMap.values()).sort((a, b) => b.bytes - a.bytes);
  const topFiles = [...all].sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  const totalBytes = all.reduce((sum, r) => sum + r.bytes, 0);
  return { total: all.length, totalBytes, byFolder, topFiles };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
