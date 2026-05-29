/**
 * Phase 78.13.6 — Reusable GitHub Release uploader.
 *
 * Cho phép TrishAdmin upload file binary lên GitHub Release directly từ browser
 * qua REST API + Personal Access Token (PAT). Không phụ thuộc Tauri commands —
 * mọi panel TrishAdmin đều dùng được.
 *
 * Use cases:
 *   - FontPacksPanel: upload .zip pack
 *   - AtgtBlocksPanel: upload .zip block library (đã có manual workflow)
 *   - LispLibraryPanel: upload .lsp file
 *   - Mọi panel cần host file public
 *
 * Security model:
 *   PAT lưu localStorage `trishadmin.github_pat` — visible ON admin's machine.
 *   KHÔNG sync Firestore vì PAT có quyền write tới repos.
 *   PAT scope: `repo` (full control of private repositories — needed cho release CRUD).
 */

const PAT_KEY = 'trishadmin.github_pat';
const PAT_USER_KEY = 'trishadmin.github_pat_user';

const GH_API = 'https://api.github.com';
const GH_UPLOADS = 'https://uploads.github.com';

// ============================================================
// PAT management
// ============================================================

export function getGithubPat(): string | null {
  try {
    return window.localStorage.getItem(PAT_KEY);
  } catch {
    return null;
  }
}

export function setGithubPat(pat: string): void {
  try {
    window.localStorage.setItem(PAT_KEY, pat);
  } catch {
    /* ignore */
  }
}

export function clearGithubPat(): void {
  try {
    window.localStorage.removeItem(PAT_KEY);
    window.localStorage.removeItem(PAT_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function getCachedPatUser(): string | null {
  try {
    return window.localStorage.getItem(PAT_USER_KEY);
  } catch {
    return null;
  }
}

/** Test PAT validity bằng cách gọi /user. Trả về username nếu valid. */
export async function testGithubPat(pat: string): Promise<{ login: string; name?: string }> {
  const res = await fetch(`${GH_API}/user`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`PAT invalid (${res.status}): ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as { login: string; name?: string };
  try {
    window.localStorage.setItem(PAT_USER_KEY, data.login);
  } catch {
    /* ignore */
  }
  return data;
}

// ============================================================
// Release operations
// ============================================================

export interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  upload_url: string;
  assets: Array<{ id: number; name: string; browser_download_url: string; size: number }>;
}

function authHeaders(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Tìm release theo tag. Trả null nếu chưa tồn tại. */
export async function getReleaseByTag(
  pat: string,
  owner: string,
  repo: string,
  tag: string,
): Promise<ReleaseInfo | null> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`, {
    headers: authHeaders(pat),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`getReleaseByTag failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as ReleaseInfo;
}

export interface CreateReleaseOpts {
  tag: string;
  name?: string;
  body?: string;
  /** Tạo release dạng draft (admin có thể publish sau qua GitHub UI). */
  draft?: boolean;
  prerelease?: boolean;
}

/** Tạo release mới. */
export async function createRelease(
  pat: string,
  owner: string,
  repo: string,
  opts: CreateReleaseOpts,
): Promise<ReleaseInfo> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: { ...authHeaders(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: opts.tag,
      name: opts.name ?? opts.tag,
      body: opts.body ?? '',
      draft: opts.draft ?? false,
      prerelease: opts.prerelease ?? false,
    }),
  });
  if (!res.ok) {
    throw new Error(`createRelease failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as ReleaseInfo;
}

/** Helper: tìm release, tạo mới nếu không có. */
export async function findOrCreateRelease(
  pat: string,
  owner: string,
  repo: string,
  opts: CreateReleaseOpts,
): Promise<ReleaseInfo> {
  const existing = await getReleaseByTag(pat, owner, repo, opts.tag);
  if (existing) return existing;
  return createRelease(pat, owner, repo, opts);
}

/** Xoá 1 asset (dùng khi re-upload cùng tên file). */
export async function deleteAsset(pat: string, owner: string, repo: string, assetId: number): Promise<void> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}/releases/assets/${assetId}`, {
    method: 'DELETE',
    headers: authHeaders(pat),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteAsset failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
}

// ============================================================
// Asset upload (the main thing)
// ============================================================

export interface UploadAssetOpts {
  pat: string;
  owner: string;
  repo: string;
  releaseTag: string;
  /** File binary (từ <input type="file"> hoặc File object). */
  file: File;
  /** Tên asset trên GitHub (mặc định = file.name). */
  assetName?: string;
  /** Mô tả release (chỉ apply khi tạo release mới). */
  releaseBody?: string;
  /** Nếu asset cùng tên đã có thì xoá rồi upload lại. Default true. */
  overwrite?: boolean;
  /** Progress 0..1 (xấp xỉ — fetch không hỗ trợ upload progress chuẩn). */
  onProgress?: (pct: number) => void;
}

export interface UploadAssetResult {
  asset_id: number;
  asset_name: string;
  download_url: string;
  size_bytes: number;
  release_url: string;
  release_id: number;
}

/**
 * Upload 1 file lên GitHub Release. Tự tạo release nếu chưa có.
 *
 * Lưu ý: fetch API không hỗ trợ upload progress native trên browser hiện đại.
 * Hàm dùng XMLHttpRequest cho upload step để có progress callback.
 */
export async function uploadAssetToRelease(opts: UploadAssetOpts): Promise<UploadAssetResult> {
  const { pat, owner, repo, releaseTag, file, releaseBody, overwrite = true, onProgress } = opts;
  const assetName = opts.assetName ?? file.name;

  // 1. Find or create release
  const release = await findOrCreateRelease(pat, owner, repo, {
    tag: releaseTag,
    name: releaseTag,
    body: releaseBody,
  });

  // 2. If asset cùng tên đã có → xoá (nếu overwrite=true)
  const existing = release.assets.find((a) => a.name === assetName);
  if (existing) {
    if (!overwrite) {
      throw new Error(`Asset "${assetName}" đã tồn tại trong release "${releaseTag}". Set overwrite=true để ghi đè.`);
    }
    await deleteAsset(pat, owner, repo, existing.id);
  }

  // 3. Upload
  // upload_url GitHub trả về có template "{?name,label}" — strip ra dùng URL thật
  const baseUploadUrl = release.upload_url.replace(/\{\?[^}]+\}$/, '');
  const uploadUrl = `${baseUploadUrl}?name=${encodeURIComponent(assetName)}`;

  const result = await uploadWithProgress({
    url: uploadUrl,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
    onProgress,
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status}): ${result.responseText.slice(0, 300)}`);
  }

  const asset = JSON.parse(result.responseText) as {
    id: number;
    name: string;
    browser_download_url: string;
    size: number;
  };
  // Fallback URL (browser_download_url) chỉ hoạt động sau khi release published — works for non-draft.
  // Với draft release dùng API URL có authentication. Hiện default draft=false nên OK.
  return {
    asset_id: asset.id,
    asset_name: asset.name,
    download_url: asset.browser_download_url,
    size_bytes: asset.size,
    release_url: release.html_url,
    release_id: release.id,
  };
}

interface XhrResult {
  status: number;
  responseText: string;
}

interface XhrOpts {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Blob | File;
  onProgress?: (pct: number) => void;
}

function uploadWithProgress(opts: XhrOpts): Promise<XhrResult> {
  return new Promise<XhrResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, opts.url);
    for (const [k, v] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(k, v);
    }
    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && opts.onProgress) {
          opts.onProgress(e.loaded / e.total);
        }
      };
    }
    xhr.onload = () => resolve({ status: xhr.status, responseText: xhr.responseText });
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timeout'));
    xhr.send(opts.body);
  });
}

// ============================================================
// Convenience helpers
// ============================================================

/** Compute SHA256 của file qua WebCrypto. Trả hex string. */
export async function computeSha256(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
