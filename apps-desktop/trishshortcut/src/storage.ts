/**
 * TrishShortcut — Local storage (localStorage + Tauri fs cho backup/restore).
 *
 * Strategy:
 *   - Runtime data: localStorage (synchronous, fast). Mỗi update save lại.
 *   - Backup/restore: Tauri save_dialog → JSON file user chọn.
 *
 * KHÔNG cloud sync — app standalone, không login.
 */

import type {
  Shortcut, Workspace, ScheduleRule, AppSettings, ShortcutGroup, BackupBundle,
} from './types';
import { DEFAULT_SETTINGS, DEFAULT_GROUPS } from './types';

const KEY_SHORTCUTS = 'trishshortcut.shortcuts';
const KEY_WORKSPACES = 'trishshortcut.workspaces';
const KEY_SCHEDULES = 'trishshortcut.schedules';
const KEY_SETTINGS = 'trishshortcut.settings';
const KEY_GROUPS = 'trishshortcut.groups';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storage] write ${key} fail:`, e);
  }
}

// ===== Shortcuts =====

export function loadShortcuts(): Shortcut[] {
  return read<Shortcut[]>(KEY_SHORTCUTS, []);
}

export function saveShortcuts(list: Shortcut[]): void {
  write(KEY_SHORTCUTS, list);
}

// ===== Workspaces =====

export function loadWorkspaces(): Workspace[] {
  return read<Workspace[]>(KEY_WORKSPACES, []);
}

export function saveWorkspaces(list: Workspace[]): void {
  write(KEY_WORKSPACES, list);
}

// ===== Schedules =====

export function loadSchedules(): ScheduleRule[] {
  return read<ScheduleRule[]>(KEY_SCHEDULES, []);
}

export function saveSchedules(list: ScheduleRule[]): void {
  write(KEY_SCHEDULES, list);
}

// ===== Settings =====

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<AppSettings>>(KEY_SETTINGS, {}) };
}

export function saveSettings(settings: AppSettings): void {
  write(KEY_SETTINGS, settings);
}

// ===== Groups =====

export function loadGroups(): ShortcutGroup[] {
  const stored = read<ShortcutGroup[]>(KEY_GROUPS, []);
  if (stored.length === 0) return [...DEFAULT_GROUPS];
  return stored;
}

export function saveGroups(groups: ShortcutGroup[]): void {
  write(KEY_GROUPS, groups);
}

// ===== Backup bundle =====

export function buildBackup(): BackupBundle {
  return {
    version: 1,
    exported_at: Date.now(),
    shortcuts: loadShortcuts(),
    workspaces: loadWorkspaces(),
    schedules: loadSchedules(),
    settings: loadSettings(),
    groups: loadGroups(),
  };
}

export function restoreBackup(bundle: BackupBundle): void {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported backup version: ${bundle.version}`);
  }
  saveShortcuts(bundle.shortcuts);
  saveWorkspaces(bundle.workspaces);
  saveSchedules(bundle.schedules);
  saveSettings(bundle.settings);
  saveGroups(bundle.groups);
}

// ===== Theme apply =====

export function applyTheme(theme: AppSettings['theme']): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', theme);
}

// ===== Helpers =====

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
