import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { FontMeta } from '@trishteam/core/fonts';

export interface ScanFontsStats {
  entries: FontMeta[];
  truncated: boolean;
  elapsed_ms: number;
  errors: number;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/**
 * Dev fallback seed — đủ family đa dạng để test pair matrix khi
 * chưa start Tauri. Personality seed dựa trên tên family.
 */
export const DEV_FALLBACK_SCAN: ScanFontsStats = {
  entries: [
    makeFake('Inter', 'Regular', 400, 500, false, true),
    makeFake('Inter', 'Bold', 700, 500, false, true),
    makeFake('Merriweather', 'Regular', 400, 500, false, true),
    makeFake('Merriweather', 'Bold', 700, 500, false, true),
    makeFake('Roboto Slab', 'Regular', 400, 500, false, true),
    makeFake('JetBrains Mono', 'Regular', 400, 500, true, false),
    makeFake('Bebas Neue', 'Regular', 400, 500, false, false),
    makeFake('Dancing Script', 'Regular', 400, 500, false, false),
    makeFake('Playfair Display', 'Regular', 400, 500, false, true),
    makeFake('Be Vietnam Pro', 'Regular', 400, 500, false, true),
    makeFake('Be Vietnam Pro', 'Bold', 700, 500, false, true),
  ],
  truncated: false,
  elapsed_ms: 0,
  errors: 0,
};

function makeFake(
  family: string,
  subfamily: string,
  weight: number,
  glyphs: number,
  monospace: boolean,
  vn: boolean,
): FontMeta {
  return {
    path: `/Users/dev/Library/Fonts/${family.replace(/\s+/g, '')}-${subfamily}.ttf`,
    family,
    subfamily,
    full_name: `${family} ${subfamily}`,
    postscript_name: `${family.replace(/\s+/g, '')}-${subfamily}`,
    weight,
    width: 5,
    italic: subfamily.toLowerCase().includes('italic'),
    monospace,
    vn_support: vn,
    glyph_count: glyphs,
    size_bytes: 180_000,
  };
}

export async function scanFonts(
  dir: string,
  opts?: { maxEntries?: number },
): Promise<ScanFontsStats> {
  if (!isInTauri()) return DEV_FALLBACK_SCAN;
  try {
    return await invoke<ScanFontsStats>('scan_fonts', {
      dir,
      maxEntries: opts?.maxEntries,
    });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function readFont(path: string): Promise<FontMeta> {
  if (!isInTauri()) {
    // Trả fake entry đầu trong dev fallback.
    return DEV_FALLBACK_SCAN.entries[0]!;
  }
  return invoke<FontMeta>('read_font', { path });
}

/** Phase 15.1.c — Scan font hệ thống (Windows/macOS/Linux dirs). */
export async function scanSystemFonts(opts?: {
  maxEntries?: number;
}): Promise<ScanFontsStats> {
  if (!isInTauri()) return DEV_FALLBACK_SCAN;
  try {
    return await invoke<ScanFontsStats>('scan_system_fonts', {
      maxEntries: opts?.maxEntries,
    });
  } catch (err) {
    throw new Error(String(err));
  }
}

export async function pickFontDirectory(): Promise<string | null> {
  if (!isInTauri()) return '/Users/dev/Library/Fonts (dev-mode seed)';
  const res = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn thư mục font',
  });
  if (typeof res === 'string') return res;
  return null;
}

export async function getAppVersion(): Promise<string> {
  if (!isInTauri()) return 'dev';
  try {
    return await invoke<string>('app_version');
  } catch {
    return 'dev';
  }
}

/** Phase 15.1.n — Check if app running as Administrator (Windows) */
export async function checkIsAdmin(): Promise<boolean> {
  if (!isInTauri()) return false;
  try {
    return await invoke<boolean>('is_admin');
  } catch {
    return false;
  }
}

/** Phase 15.1.o — Pack folder info + clear all packs */
export interface PacksFolderInfo {
  path: string;
  exists: boolean;
  total_bytes: number;
  pack_count: number;
}

export async function getPacksFolderInfo(): Promise<PacksFolderInfo> {
  if (!isInTauri()) {
    return {
      path: '%APPDATA%\\TrishFont\\packs (dev mode)',
      exists: false,
      total_bytes: 0,
      pack_count: 0,
    };
  }
  return invoke<PacksFolderInfo>('get_packs_folder_info');
}

export async function clearAllPacks(): Promise<void> {
  if (!isInTauri()) return;
  await invoke<void>('clear_all_packs');
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PACK_STORAGE_KEY);
  }
}

/** Phase 15.1.o — Update check qua apps-registry.json */
export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  downloadUrl: string;
  changelogUrl: string;
}

export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo> {
  const APPS_REGISTRY = 'https://trishteam.io.vn/apps-registry.json';
  const fallback: UpdateInfo = {
    current: currentVersion,
    latest: currentVersion,
    hasUpdate: false,
    downloadUrl: '',
    changelogUrl: '',
  };
  if (!isInTauri()) return fallback;
  try {
    const text = await invoke<string>('fetch_text', { url: APPS_REGISTRY });
    const json = JSON.parse(text) as {
      apps?: Array<{
        id: string;
        version: string;
        download?: { windows_x64?: { url: string } };
        changelog_url?: string;
      }>;
    };
    const trishfont = json.apps?.find((a) => a.id === 'trishfont');
    if (!trishfont) return fallback;
    return {
      current: currentVersion,
      latest: trishfont.version,
      hasUpdate: trishfont.version !== currentVersion,
      downloadUrl: trishfont.download?.windows_x64?.url ?? '',
      changelogUrl: trishfont.changelog_url ?? '',
    };
  } catch (err) {
    console.warn('[trishfont] checkForUpdate fail:', err);
    return fallback;
  }
}

// ============================================================
// Phase 15.1.b — Install fonts (Windows per-user)
// ============================================================

export interface InstallResult {
  path: string;
  family: string;
  success: boolean;
  message: string;
}

export async function installFonts(paths: string[]): Promise<InstallResult[]> {
  if (!isInTauri()) {
    return paths.map((p) => ({
      path: p,
      family: 'dev-mode',
      success: false,
      message: 'Cần chạy app thật để cài (dev mode browser fallback)',
    }));
  }
  return invoke<InstallResult[]>('install_fonts', { paths });
}

// ============================================================
// Phase 15.1.h — FontPack manifest + download/install
// ============================================================

/** URL manifest cố định — repo trishnexus-fontpacks. Future: admin override qua TrishAdmin. */
export const MANIFEST_URL =
  'https://raw.githubusercontent.com/hosytri07/trishnexus-fontpacks/main/manifest.json';

export interface FontPack {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: 'windows' | 'autocad' | 'mixed';
  size_bytes: number;
  file_count: number;
  tags: string[];
  preview_image: string;
  download_url: string;
  sha256: string;
}

export interface PackManifest {
  schema_version: number;
  updated_at: string;
  packs: FontPack[];
}

export interface PackInstallResult {
  pack_id: string;
  extract_path: string;
  file_count: number;
  bytes_extracted: number;
}

const DEV_FALLBACK_MANIFEST: PackManifest = {
  schema_version: 1,
  updated_at: '2026-04-22T08:22:09.301762+00:00',
  packs: [
    {
      id: 'trishfont-origin',
      name: 'Font cơ bản (dev seed)',
      version: '1.0.0',
      description: '1716 font TCVN3 + VNI + Unicode + UTM + AutoCAD .shx (DEV FALLBACK).',
      kind: 'mixed',
      size_bytes: 54_623_423,
      file_count: 1716,
      tags: ['vietnamese', 'tcvn3', 'unicode'],
      preview_image: '',
      download_url: 'https://github.com/hosytri07/trishnexus-fontpacks/releases/download/trishfont-origin-v1.0.0/trishfont-origin.zip',
      sha256: '1dde552f6d5eff1196f9ab31f441f8e9017d273c88ea4e7237e14017c091266c',
    },
  ],
};

export async function fetchManifest(
  url: string = MANIFEST_URL,
): Promise<PackManifest> {
  if (!isInTauri()) return DEV_FALLBACK_MANIFEST;
  try {
    const text = await invoke<string>('fetch_text', { url });
    return JSON.parse(text) as PackManifest;
  } catch (err) {
    console.warn('[trishfont] fetchManifest fail, using dev fallback:', err);
    return DEV_FALLBACK_MANIFEST;
  }
}

export async function installPack(
  pack: FontPack,
): Promise<PackInstallResult> {
  if (!isInTauri()) {
    throw new Error('Cần chạy app thật để cài pack (dev mode không support download)');
  }
  return invoke<PackInstallResult>('download_and_install_pack', {
    packId: pack.id,
    url: pack.download_url,
    sha256: pack.sha256,
  });
}

// ============================================================
// localStorage track installed packs
// ============================================================

export interface InstalledPackRecord {
  pack_id: string;
  version: string;
  installed_at: string;
  extract_path: string;
  file_count: number;
}

const PACK_STORAGE_KEY = 'trishfont:installed-packs:v1';

export function loadInstalledPacks(): InstalledPackRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as InstalledPackRecord[]) : [];
  } catch {
    return [];
  }
}

export function recordPackInstalled(
  pack: FontPack,
  result: PackInstallResult,
): InstalledPackRecord[] {
  const current = loadInstalledPacks();
  const next = current.filter((p) => p.pack_id !== pack.id);
  next.push({
    pack_id: pack.id,
    version: pack.version,
    installed_at: new Date().toISOString(),
    extract_path: result.extract_path,
    file_count: result.file_count,
  });
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

// ============================================================
// Phase 15.1.i — Pack file list + AutoCAD .shx install
// ============================================================

export interface PackFileEntry {
  path: string;
  name: string;
  /** "ttf" | "otf" | "ttc" | "otc" | "shx" */
  kind: string;
  size_bytes: number;
  /** Phase 15.1.m — Folder cha relative trong pack (TCVN3, VNI, Unicode...). Empty = root */
  folder: string;
}

export async function listPackFiles(packId: string): Promise<PackFileEntry[]> {
  if (!isInTauri()) return [];
  return invoke<PackFileEntry[]>('list_pack_files', { packId });
}

/** Phase 15.1.j — Xóa pack đã tải (folder + localStorage record) */
export async function deletePack(packId: string): Promise<InstalledPackRecord[]> {
  if (isInTauri()) {
    try {
      await invoke<void>('delete_pack', { packId });
    } catch (err) {
      console.warn('[trishfont] delete_pack fail:', err);
    }
  }
  const current = loadInstalledPacks();
  const next = current.filter((p) => p.pack_id !== packId);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export interface AutoCadInstall {
  version: string;
  fonts_dir: string;
  writable: boolean;
}

export async function detectAutoCadDirs(): Promise<AutoCadInstall[]> {
  if (!isInTauri()) return [];
  return invoke<AutoCadInstall[]>('detect_autocad_dirs');
}

export interface ShxInstallResult {
  path: string;
  installed_to: string[];
  success: boolean;
  message: string;
}

export async function installShxFonts(
  paths: string[],
): Promise<ShxInstallResult[]> {
  if (!isInTauri()) {
    return paths.map((p) => ({
      path: p,
      installed_to: [],
      success: false,
      message: 'Cần chạy app thật để cài (dev mode)',
    }));
  }
  return invoke<ShxInstallResult[]>('install_shx_fonts', { paths });
}

/** Phase 15.1.m — Export font files vào folder user pick (chia sẻ). */
export interface ExportResult {
  source: string;
  dest: string;
  success: boolean;
  message: string;
}

export async function exportFontsToFolder(
  paths: string[],
  destDir: string,
): Promise<ExportResult[]> {
  if (!isInTauri()) {
    return paths.map((p) => ({
      source: p,
      dest: '',
      success: false,
      message: 'Cần chạy app thật để export (dev mode)',
    }));
  }
  return invoke<ExportResult[]>('export_fonts_to_folder', { paths, destDir });
}

export async function pickExportFolder(): Promise<string | null> {
  if (!isInTauri()) return '/Users/dev/Desktop (dev seed)';
  const res = await openDialog({
    directory: true,
    multiple: false,
    title: 'Chọn folder để export font',
  });
  if (typeof res === 'string') return res;
  return null;
}
