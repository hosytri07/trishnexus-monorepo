/**
 * Phase 18.4.d — App-wide backup/restore.
 *
 * Format: single JSON file gồm toàn bộ data của user:
 *   - localStorage values (key prefix `trishlibrary.`)
 *   - Data dir files (notes-<uid>.json, library-<uid>.json)
 *   - Metadata (version, app version, timestamp, uid)
 *
 * Restore: parse JSON, write lại vào localStorage + data dir.
 * KHÔNG bao gồm: Tantivy index (rebuildable), thumbnail cache (rebuildable).
 */

import { invoke } from '@tauri-apps/api/core';

export interface BackupBundle {
  version: 1;
  app_version: string;
  created_at: string; // ISO datetime
  uid: string | null;
  localStorage: Record<string, string>;
  data_dir_files: Record<string, string>; // filename → content
}

const LS_PREFIX = 'trishlibrary.';
const DATA_FILE_PATTERNS = ['library-', 'notes-']; // include any file starting with these

async function getDataDir(): Promise<string | null> {
  try {
    const loc = await invoke<{ path: string }>('default_store_location');
    return loc.path.replace(/[\\/][^\\/]+$/, '');
  } catch {
    return null;
  }
}

function pathSep(s: string): string {
  return s.includes('\\') ? '\\' : '/';
}

function collectLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined' || !window.localStorage) return out;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(LS_PREFIX)) continue;
      const val = window.localStorage.getItem(key);
      if (val !== null) out[key] = val;
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Try to read known data dir files for the given uid. */
async function collectDataDirFiles(uid: string | null): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!uid) return out;
  const dir = await getDataDir();
  if (!dir) return out;
  const sep = pathSep(dir);
  // Read known files (best effort; missing ones are skipped)
  const candidates = [
    `library-${uid}.json`,
    `notes-${uid}.json`,
    // Pre-Phase 18 legacy filenames just in case
    `library.json`,
    `notes.json`,
  ];
  for (const name of candidates) {
    const path = `${dir}${sep}${name}`;
    try {
      const content = await invoke<string>('read_text_string', { path });
      if (content) out[name] = content;
    } catch {
      // file doesn't exist — skip
    }
  }
  return out;
}

export async function buildBackupBundle(
  uid: string | null,
  appVersion: string,
): Promise<BackupBundle> {
  const localStorage = collectLocalStorage();
  const data_dir_files = await collectDataDirFiles(uid);
  return {
    version: 1,
    app_version: appVersion,
    created_at: new Date().toISOString(),
    uid,
    localStorage,
    data_dir_files,
  };
}

// ============================================================
// Phase 18.4.e — Auto-backup periodic
// ============================================================

const AUTOBACKUP_PREFS_KEY = 'trishlibrary.autobackup.prefs.v1';
const LAST_BACKUP_KEY = 'trishlibrary.last_backup_ms';

export interface AutoBackupPrefs {
  enabled: boolean;
  interval_hours: number; // 1 / 6 / 24
  folder: string | null;
}

export const DEFAULT_AUTOBACKUP_PREFS: AutoBackupPrefs = {
  enabled: false,
  interval_hours: 24,
  folder: null,
};

export function loadAutoBackupPrefs(): AutoBackupPrefs {
  try {
    const raw = window.localStorage.getItem(AUTOBACKUP_PREFS_KEY);
    if (!raw) return { ...DEFAULT_AUTOBACKUP_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AUTOBACKUP_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_AUTOBACKUP_PREFS };
  }
}

export function saveAutoBackupPrefs(p: AutoBackupPrefs): void {
  try {
    window.localStorage.setItem(AUTOBACKUP_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function getLastBackupMs(): number {
  try {
    const v = window.localStorage.getItem(LAST_BACKUP_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function setLastBackupMs(ms: number): void {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

/** Auto-run backup if enabled + interval exceeded. Silent — no dialog. */
export async function runAutoBackupIfDue(
  uid: string | null,
  appVersion: string,
): Promise<{ ran: boolean; path?: string; reason?: string }> {
  const prefs = loadAutoBackupPrefs();
  if (!prefs.enabled) return { ran: false, reason: 'disabled' };
  if (!prefs.folder) return { ran: false, reason: 'no folder' };
  const last = getLastBackupMs();
  const intervalMs = prefs.interval_hours * 60 * 60 * 1000;
  if (Date.now() - last < intervalMs) {
    return { ran: false, reason: 'not due' };
  }
  try {
    const bundle = await buildBackupBundle(uid, appVersion);
    const sep = prefs.folder.includes('\\') ? '\\' : '/';
    const filename = `trishlibrary-autobackup-${new Date()
      .toISOString()
      .slice(0, 13)
      .replace(/[-T:]/g, '')}.json`;
    const path = `${prefs.folder}${sep}${filename}`;
    await writeBackupTo(path, bundle);
    setLastBackupMs(Date.now());
    return { ran: true, path };
  } catch (e) {
    return { ran: false, reason: String(e) };
  }
}

/** Format suggested filename: `trishlibrary-backup-2026-04-27_1345.json` */
export function suggestBackupFilename(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hm = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `trishlibrary-backup-${ymd}_${hm}.json`;
}

export async function writeBackupTo(path: string, bundle: BackupBundle): Promise<void> {
  const json = JSON.stringify(bundle, null, 2);
  await invoke<void>('write_text_string', { path, content: json });
}

export async function readBackupFrom(path: string): Promise<BackupBundle> {
  const json = await invoke<string>('read_text_string', { path });
  const parsed = JSON.parse(json) as BackupBundle;
  if (parsed.version !== 1) {
    throw new Error(`Backup version ${parsed.version} không hỗ trợ.`);
  }
  if (typeof parsed.localStorage !== 'object' || typeof parsed.data_dir_files !== 'object') {
    throw new Error('File backup không hợp lệ.');
  }
  return parsed;
}

export interface RestoreSummary {
  ls_restored: number;
  ls_skipped: number;
  data_files_restored: number;
  data_files_failed: number;
}

/**
 * Restore: write lại localStorage + data dir files.
 * Phải reload window sau khi restore để các module re-read state.
 */
export async function restoreBackup(bundle: BackupBundle): Promise<RestoreSummary> {
  let ls_restored = 0;
  let ls_skipped = 0;
  let data_files_restored = 0;
  let data_files_failed = 0;

  // Restore localStorage
  for (const [key, val] of Object.entries(bundle.localStorage)) {
    if (!key.startsWith(LS_PREFIX)) {
      ls_skipped++;
      continue;
    }
    try {
      window.localStorage.setItem(key, val);
      ls_restored++;
    } catch {
      ls_skipped++;
    }
  }

  // Restore data dir files
  const dir = await getDataDir();
  if (dir) {
    const sep = pathSep(dir);
    for (const [name, content] of Object.entries(bundle.data_dir_files)) {
      // Safety: only allow expected file patterns
      const allowed = DATA_FILE_PATTERNS.some((pat) => name.startsWith(pat)) ||
        name === 'library.json' ||
        name === 'notes.json';
      if (!allowed) {
        data_files_failed++;
        continue;
      }
      const path = `${dir}${sep}${name}`;
      try {
        await invoke<void>('write_text_string', { path, content });
        data_files_restored++;
      } catch {
        data_files_failed++;
      }
    }
  }

  return { ls_restored, ls_skipped, data_files_restored, data_files_failed };
}
