/**
 * Phase 78.13 — Config Sync.
 *
 * Sync 5 module settings (clean, check, font, shortcut, drive*) lên Firestore
 * collection `synced_configs/{uid_deviceId}`. Hỗ trợ user multi-device.
 *
 * Sync = manual button trong Settings → Account. Không tự động backup mỗi save
 * để tránh write quota Firestore. User chủ động push / pull.
 */
import { getFirebaseDb } from '@trishteam/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDeviceId, getDeviceName } from '../scheduled-tasks/device.js';
import {
  loadSettings as loadCleanSettings,
  saveSettings as saveCleanSettings,
  type AppSettings as CleanSettings,
} from '../../modules/clean/settings.js';
import {
  loadSettings as loadCheckSettings,
  saveSettings as saveCheckSettings,
  type Settings as CheckSettings,
} from '../../modules/check/settings.js';
import {
  loadSettings as loadFontSettings,
  saveSettings as saveFontSettings,
  type Settings as FontSettings,
} from '../../modules/font/settings.js';
import {
  loadSettings as loadShortcutSettings,
  saveSettings as saveShortcutSettings,
} from '../../modules/shortcut/storage.js';
import type { AppSettings as ShortcutSettings } from '../../modules/shortcut/types.js';

const COLLECTION = 'synced_configs';

export interface SyncedConfig {
  uid: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  lastSyncedAt: number;
  configs: {
    clean: CleanSettings;
    check: CheckSettings;
    font: FontSettings;
    shortcut: ShortcutSettings;
  };
}

function docId(uid: string, deviceId: string): string {
  return `${uid}_${deviceId}`;
}

/** Push settings local → Firestore. */
export async function syncToCloud(uid: string, appVersion: string): Promise<SyncedConfig> {
  const deviceId = getDeviceId();
  const config: SyncedConfig = {
    uid,
    deviceId,
    deviceName: getDeviceName(),
    appVersion,
    lastSyncedAt: Date.now(),
    configs: {
      clean: loadCleanSettings(),
      check: loadCheckSettings(),
      font: loadFontSettings(),
      shortcut: loadShortcutSettings(),
    },
  };
  const db = getFirebaseDb();
  await setDoc(doc(db, COLLECTION, docId(uid, deviceId)), {
    ...config,
    serverUpdatedAt: serverTimestamp(),
  });
  return config;
}

/** Pull settings cloud → local. */
export async function restoreFromCloud(uid: string, sourceDeviceId?: string): Promise<SyncedConfig | null> {
  const db = getFirebaseDb();
  const targetDeviceId = sourceDeviceId ?? getDeviceId();
  const snap = await getDoc(doc(db, COLLECTION, docId(uid, targetDeviceId)));
  if (!snap.exists()) {
    // Fallback: lấy bất kỳ device gần nhất của user.
    const allSnap = await getDocs(
      query(collection(db, COLLECTION), where('uid', '==', uid)),
    );
    if (allSnap.empty) return null;
    const sorted = allSnap.docs
      .map((d) => d.data() as SyncedConfig)
      .sort((a, b) => (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0));
    const latest = sorted[0];
    applyConfigs(latest);
    return latest;
  }
  const data = snap.data() as SyncedConfig;
  applyConfigs(data);
  return data;
}

function applyConfigs(c: SyncedConfig): void {
  if (c.configs.clean) saveCleanSettings(c.configs.clean);
  if (c.configs.check) saveCheckSettings(c.configs.check);
  if (c.configs.font) saveFontSettings(c.configs.font);
  if (c.configs.shortcut) saveShortcutSettings(c.configs.shortcut);
}

/** Liệt kê tất cả device đã sync của user (cho UI chọn device để restore). */
export async function listSyncedDevices(uid: string): Promise<SyncedConfig[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, COLLECTION), where('uid', '==', uid)));
  return snap.docs
    .map((d) => d.data() as SyncedConfig)
    .sort((a, b) => (b.lastSyncedAt ?? 0) - (a.lastSyncedAt ?? 0));
}

/** Admin: liệt kê tất cả synced_configs (giới hạn 500). */
export async function listAllSyncedConfigs(): Promise<SyncedConfig[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.slice(0, 500).map((d) => d.data() as SyncedConfig);
}
