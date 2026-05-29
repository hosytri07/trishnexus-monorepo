import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { UserMenu } from '@trishteam/auth/react';
import {
  scanFonts,
  scanSystemFonts,
  installFonts,
  fetchManifest,
  installPack,
  loadInstalledPacks,
  recordPackInstalled,
  listPackFiles,
  deletePack,
  installShxFonts,
  exportFontsToFolder,
  pickExportFolder,
  checkIsAdmin,
  getAppVersion,
  pickFontDirectory,
  scanDwgPaths,
  pickDwgFiles,
  type ScanFontsStats,
  type FontPack,
  type PackManifest,
  type InstalledPackRecord,
  type PackFileEntry,
  type DwgScanSummary,
} from './tauri-bridge.js';
import type { FontMeta } from '@trishteam/core/fonts';
// Phase 78.13.10 — Badge "pack mới"
import {
  getNewPackIds,
  initSeenBaselineIfEmpty,
  markPackIdsSeen,
} from './new-packs-tracker.js';
import {
  loadSettings,
  saveSettings,
  applyTheme,
  DEFAULT_SAMPLE_TEXT,
  type Settings,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { SettingsModal } from './components/SettingsModal.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import logoUrl from './assets/logo.png';

// Phase 78 (2026-05-26 may co quan): styles.css + theme-bridge.css cu khong duoc
// import o dau --> layout 2-cot pack-list/pack-detail khong apply, fallback ve
// stacked vertical. Import explicit o day. Vi FontModule duoc lazy-load,
// CSS chi load khi user vao tab Font.
import './styles.css';
import './theme-bridge.css';

/**
 * Phase 15.1 — TrishFont v2 root component.
 *
 * 2 nguồn data:
 *  1. Library: user pick folder → scan via Rust scan_fonts
 *  2. System fonts: scan_system_fonts (Windows fonts dir auto-detect)
 *
 * UI: tabs library/system → grid cards với FontFace preview + Install button.
 * Search + filter pills (VN/serif/sans/mono). Settings modal cho theme/lang/sample.
 *
 * Install: per-user Windows %LOCALAPPDATA%\Microsoft\Windows\Fonts (no admin),
 * registry HKCU, broadcast WM_FONTCHANGE.
 */

type Tab = 'library' | 'system' | 'packs' | 'dwg';
type Filter = 'all' | 'vn' | 'serif' | 'sans' | 'mono';

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error injected
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

// Heuristic personality từ family name
function classifyFont(font: FontMeta): 'serif' | 'sans' | 'mono' | 'display' {
  if (font.monospace) return 'mono';
  const lower = font.family.toLowerCase();
  if (
    lower.includes('serif') ||
    lower.includes('times') ||
    lower.includes('georgia') ||
    lower.includes('garamond') ||
    lower.includes('cambria')
  ) {
    return 'serif';
  }
  if (
    lower.includes('script') ||
    lower.includes('display') ||
    lower.includes('decorative')
  ) {
    return 'display';
  }
  return 'sans';
}

export function FontModule(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tr = useMemo(() => makeT(settings.language), [settings.language]);

  const [version, setVersion] = useState('dev');
  const [isAdmin, setIsAdmin] = useState(false);
  // Phase 15.1.j — default tab = packs (Fontpack TrishTEAM đầu tiên)
  const [tab, setTab] = useState<Tab>('packs');
  const [libraryStats, setLibraryStats] = useState<ScanFontsStats | null>(null);
  const [systemStats, setSystemStats] = useState<ScanFontsStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [confirmInstall, setConfirmInstall] = useState<FontMeta | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Phase 15.1.h — FontPack state
  const [manifest, setManifest] = useState<PackManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  // Phase 78.13.10 — Pack ID chưa user xem (badge "mới")
  const [newPackIds, setNewPackIds] = useState<string[]>([]);
  const [installedPacks, setInstalledPacks] = useState<InstalledPackRecord[]>(
    () => loadInstalledPacks(),
  );
  const [packInstalling, setPackInstalling] = useState<Set<string>>(new Set());

  // Phase 15.1.i — Pack file list + per-file install state
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packFiles, setPackFiles] = useState<PackFileEntry[]>([]);
  const [packFilesLoading, setPackFilesLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [fileStatus, setFileStatus] = useState<
    Map<string, { status: 'pending' | 'installing' | 'done' | 'failed'; msg: string }>
  >(new Map());

  // Phase 15.1.k — Process log terminal-style
  const [installLog, setInstallLog] = useState<
    Array<{ time: string; level: 'ok' | 'fail' | 'info'; message: string }>
  >([]);

  // Phase 78 — Install progress tracked manually trong handleInstallSelected
  // (de hien overall total, khong reset theo chunk).
  const [installProgress, setInstallProgress] = useState<{
    total: number;
    done: number;
    ok: number;
    fail: number;
    phase: 'installing' | 'done';
    startedAt: number;
    finishedAt?: number;
    recentFailures?: Array<{ name: string; reason: string }>;
  } | null>(null);

  // Phase 78.6 — DWG scanner state
  const [dwgScan, setDwgScan] = useState<DwgScanSummary | null>(null);
  const [dwgScanning, setDwgScanning] = useState(false);
  const [dwgScanError, setDwgScanError] = useState<string | null>(null);
  // Phase 78.7 — live progress per file
  const [dwgScanProgress, setDwgScanProgress] = useState<{
    done: number;
    total: number;
    current: string;
  } | null>(null);

  // Phase 63 — Real-time download progress mỗi pack (event 'font:download-progress')
  const [downloadProgress, setDownloadProgress] = useState<
    Map<
      string,
      {
        downloaded_bytes: number;
        total_bytes: number;
        speed_mb_per_s: number;
        eta_sec: number;
        phase: 'download' | 'extract';
      }
    >
  >(new Map());

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{
          pack_id: string;
          downloaded_bytes: number;
          total_bytes: number;
          speed_mb_per_s: number;
          eta_sec: number;
          phase: 'download' | 'extract';
        }>('font:download-progress', (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.set(event.payload.pack_id, event.payload);
            return next;
          });
        });
      } catch {
        // Tauri event API không khả dụng (browser dev mode)
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Phase 15.1.l — Export selection cho Library + System tab
  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set());

  function toggleExportSelection(path: string): void {
    setExportSelection((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllVisible(): void {
    setExportSelection(new Set(filtered.map((f) => f.path)));
  }

  function clearExportSelection(): void {
    setExportSelection(new Set());
  }

  // Phase 15.1.p — Bulk install cho Library/System tab (dùng exportSelection)
  async function handleBulkInstallSelected(): Promise<void> {
    const selected = filtered.filter((f) => exportSelection.has(f.path));
    if (selected.length === 0) return;

    const windowsPaths: string[] = [];
    const shxPaths: string[] = [];
    for (const f of selected) {
      if (f.path.toLowerCase().endsWith('.shx')) shxPaths.push(f.path);
      else windowsPaths.push(f.path);
    }

    appendLog(
      'info',
      `Cài hàng loạt ${selected.length} font (${windowsPaths.length} Windows + ${shxPaths.length} AutoCAD)...`,
    );

    // Mark all as installing
    setInstalling((prev) => {
      const next = new Set(prev);
      for (const p of [...windowsPaths, ...shxPaths]) next.add(p);
      return next;
    });

    let okCount = 0;
    let failCount = 0;
    const fileName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

    // Windows fonts batch
    if (windowsPaths.length > 0) {
      try {
        const results = await installFonts(windowsPaths);
        for (const r of results) {
          if (r.success) {
            okCount++;
            setInstalled((prev) => new Set(prev).add(r.path));
            appendLog('ok', `${fileName(r.path)} → ${r.message}`);
          } else {
            failCount++;
            appendLog('fail', `${fileName(r.path)} — ${r.message}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('fail', `Batch Windows fail: ${msg}`);
        failCount += windowsPaths.length;
      }
    }

    // SHX fonts batch
    if (shxPaths.length > 0) {
      try {
        const results = await installShxFonts(shxPaths);
        for (const r of results) {
          if (r.success) {
            okCount++;
            setInstalled((prev) => new Set(prev).add(r.path));
            appendLog('ok', `${fileName(r.path)} → ${r.installed_to.join(', ')}`);
          } else {
            failCount++;
            appendLog('fail', `${fileName(r.path)} — ${r.message}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('fail', `Batch SHX fail: ${msg}`);
        failCount += shxPaths.length;
      }
    }

    // Clear installing flags
    setInstalling((prev) => {
      const next = new Set(prev);
      for (const p of [...windowsPaths, ...shxPaths]) next.delete(p);
      return next;
    });

    appendLog(
      failCount === 0 ? 'ok' : 'info',
      `Hoàn tất cài hàng loạt: ${okCount}/${selected.length} thành công · ${failCount} lỗi`,
    );
    setToast(
      `✓ Cài thành công ${okCount}/${selected.length}${failCount > 0 ? ` · ${failCount} lỗi` : ''}`,
    );
    setTimeout(() => setToast(null), 6000);
  }

  // Phase 15.1.m — Export = copy file font ra folder user pick (chia sẻ)
  async function handleExportToFolder(): Promise<void> {
    const selected = filtered.filter((f) => exportSelection.has(f.path));
    if (selected.length === 0) return;

    const dest = await pickExportFolder();
    if (!dest) return;

    appendLog('info', `Export ${selected.length} font → ${dest}`);
    try {
      const results = await exportFontsToFolder(
        selected.map((f) => f.path),
        dest,
      );
      let okCount = 0;
      let failCount = 0;
      for (const r of results) {
        const fileName = r.source.split(/[\\/]/).pop() ?? r.source;
        if (r.success) {
          okCount++;
          appendLog('ok', `${fileName} ${r.message}`);
        } else {
          failCount++;
          appendLog('fail', `${fileName} — ${r.message}`);
        }
      }
      appendLog(
        failCount === 0 ? 'ok' : 'info',
        `Export hoàn tất: ${okCount}/${selected.length} thành công · ${failCount} lỗi`,
      );
      setToast(
        `✓ Export ${okCount}/${selected.length} font vào ${dest}${failCount > 0 ? ` · ${failCount} lỗi` : ''}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog('fail', `Export fail: ${msg}`);
      setToast(`Export fail: ${msg}`);
    }
    setTimeout(() => setToast(null), 5000);
  }

  function appendLog(level: 'ok' | 'fail' | 'info', message: string): void {
    setInstallLog((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString('vi-VN'), level, message },
    ]);
  }

  function clearLog(): void {
    setInstallLog([]);
  }

  // Phase 51.1: Theme do App.tsx single-source-of-truth

  // Phase 55.1 — Listen for "open font settings" event từ UtilitiesSettingsModal
  useEffect(() => {
    function onOpenSettings(): void {
      setSettingsOpen(true);
    }
    window.addEventListener('trishutilities:open-font-settings', onOpenSettings);
    return () => window.removeEventListener('trishutilities:open-font-settings', onOpenSettings);
  }, []);

  useEffect(() => {
    void getAppVersion().then(setVersion);
    void checkIsAdmin().then(setIsAdmin);
    // Phase 15.1.h — fetch manifest on mount
    setManifestLoading(true);
    void fetchManifest()
      .then((m) => {
        setManifest(m);
        // Phase 78.13.10 — Compute "pack mới chưa xem"
        const allIds = m.packs.map((p) => p.id);
        const isFirstRun = initSeenBaselineIfEmpty(allIds);
        if (!isFirstRun) {
          setNewPackIds(getNewPackIds(m.packs));
        }
      })
      .finally(() => setManifestLoading(false));
  }, []);

  // Phase 78 — KHONG listen 'font:install-progress' tu Rust nua. Ly do: voi
  // per-file install loop o frontend, Rust se fire event per chunk lam progress
  // reset 0→100% theo tung chunk → confusing. Manage progress manually trong
  // handleInstallSelected.

  async function handleInstallPack(pack: FontPack): Promise<void> {
    if (packInstalling.has(pack.id)) return;
    setPackInstalling((prev) => new Set(prev).add(pack.id));
    setToast(`Đang tải pack ${pack.name} (${(pack.size_bytes / 1_048_576).toFixed(1)} MB)...`);
    try {
      const result = await installPack(pack);
      const records = recordPackInstalled(pack, result);
      setInstalledPacks(records);
      setToast(
        `✓ Đã cài pack "${pack.name}" — ${result.file_count} font tại ${result.extract_path}`,
      );
      setTimeout(() => setToast(null), 6000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast(`Cài pack fail: ${msg}`);
      setTimeout(() => setToast(null), 6000);
    } finally {
      setPackInstalling((prev) => {
        const next = new Set(prev);
        next.delete(pack.id);
        return next;
      });
    }
  }

  async function handleRefreshManifest(): Promise<void> {
    setManifestLoading(true);
    try {
      const fresh = await fetchManifest();
      setManifest(fresh);
      // Phase 78.13.10 — Recompute new packs sau refresh
      setNewPackIds(getNewPackIds(fresh.packs));
    } finally {
      setManifestLoading(false);
    }
  }

  /** Phase 78.13.10 — Khi user click vào tab Packs hoặc click PackCard, mark seen. */
  function handleAcknowledgePacksTab(): void {
    if (newPackIds.length === 0 || !manifest) return;
    markPackIdsSeen(manifest.packs.map((p) => p.id));
    setNewPackIds([]);
  }

  // Phase 15.1.i — Select pack → load file list
  async function handleSelectPack(packId: string): Promise<void> {
    setSelectedPackId(packId);
    setSelectedFiles(new Set());
    setFileStatus(new Map());
    const isInstalled = installedPacks.some((p) => p.pack_id === packId);
    if (!isInstalled) {
      setPackFiles([]);
      return;
    }
    setPackFilesLoading(true);
    try {
      const files = await listPackFiles(packId);
      setPackFiles(files);
    } catch (err) {
      console.warn('[trishfont] list pack files fail:', err);
      setPackFiles([]);
    } finally {
      setPackFilesLoading(false);
    }
  }

  function toggleFileSelection(path: string): void {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllFiles(kind: 'all' | 'windows' | 'shx'): void {
    const all = new Set<string>();
    for (const f of packFiles) {
      if (kind === 'all') all.add(f.path);
      else if (kind === 'windows' && (f.kind === 'ttf' || f.kind === 'otf' || f.kind === 'ttc' || f.kind === 'otc'))
        all.add(f.path);
      else if (kind === 'shx' && f.kind === 'shx') all.add(f.path);
    }
    setSelectedFiles(all);
  }

  // Phase 15.1.n — Select all files trong 1 folder (giữ existing selection từ folder khác)
  function selectFolderFiles(folder: string): void {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const f of packFiles) {
        if ((f.folder || '(root)') === folder) {
          next.add(f.path);
        }
      }
      return next;
    });
  }

  function clearFileSelection(): void {
    setSelectedFiles(new Set());
  }

  // Phase 15.1.j — Delete pack (xóa folder + record)
  async function handleDeletePack(packId: string): Promise<void> {
    const records = await deletePack(packId);
    setInstalledPacks(records);
    if (selectedPackId === packId) {
      setPackFiles([]);
      setSelectedFiles(new Set());
      setFileStatus(new Map());
    }
    setToast(`Đã xóa pack ${packId}`);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleInstallSelected(): Promise<void> {
    const paths = Array.from(selectedFiles);
    if (paths.length === 0) return;

    // Split by kind
    const windowsPaths: string[] = [];
    const shxPaths: string[] = [];
    for (const p of paths) {
      const ext = p.toLowerCase().split('.').pop();
      if (ext === 'shx') shxPaths.push(p);
      else windowsPaths.push(p);
    }

    const startedAt = Date.now();
    appendLog(
      'info',
      `▶ Bắt đầu cài ${paths.length} font (${windowsPaths.length} Windows + ${shxPaths.length} AutoCAD)...`,
    );

    // Phase 78 — Khoi tao install progress UI
    setInstallProgress({
      total: paths.length,
      done: 0,
      ok: 0,
      fail: 0,
      phase: 'installing',
      startedAt,
      recentFailures: [],
    });

    setFileStatus((prev) => {
      const next = new Map(prev);
      for (const p of paths) next.set(p, { status: 'installing', msg: '' });
      return next;
    });

    let okCount = 0;
    let failCount = 0;
    // Phase 78 — Track 10 failures dau de show trong summary card
    const failureList: Array<{ name: string; reason: string }> = [];
    const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

    // Phase 78.4 — Auto-detect "Access denied" tren .ttf/.otf: do Windows lock
    // file font he thong (Tahoma/Times/Palatino...) khi DWM/explorer dang dung.
    // → Coi nhu da co san, KHONG count fail.
    const isSystemFontLocked = (
      path: string,
      success: boolean,
      message: string,
    ): boolean => {
      if (success) return false;
      const ext = path.toLowerCase().split('.').pop() ?? '';
      if (ext !== 'ttf' && ext !== 'otf') return false;
      const lower = message.toLowerCase();
      return (
        lower.includes('access is denied') ||
        lower.includes('access denied') ||
        lower.includes('os error 5') ||
        lower.includes('permission denied')
      );
    };

    // Helper: ap dung 1 ket qua file. Goi NGOAI cac setState updater de tranh
    // React StrictMode double-call gay nhan doi counter.
    const applyResult = (
      path: string,
      successIn: boolean,
      messageIn: string,
    ) => {
      const name = fileName(path);
      // Phase 78.4 — reclassify system font locked thanh ok ("da co san")
      let success = successIn;
      let message = messageIn;
      if (isSystemFontLocked(path, successIn, messageIn)) {
        success = true;
        message = 'Font hệ thống Windows đang dùng, giữ nguyên (đã có)';
      }

      // 1) Update file status (idempotent set, OK trong updater)
      setFileStatus((prev) =>
        new Map(prev).set(path, {
          status: success ? 'done' : 'failed',
          msg: message,
        }),
      );
      // 2) Log entry
      if (success) appendLog('ok', `${name} → ${message}`);
      else appendLog('fail', `${name} — ${message}`);
      // 3) Bump counters (1 lan duy nhat per file)
      if (success) okCount++;
      else {
        failCount++;
        if (failureList.length < 10) {
          failureList.push({ name, reason: message });
        }
      }
      // 4) Update progress state (functional, idempotent)
      setInstallProgress((prev) =>
        prev
          ? {
              ...prev,
              done: prev.done + 1,
              ok: prev.ok + (success ? 1 : 0),
              fail: prev.fail + (success ? 0 : 1),
              recentFailures: success ? prev.recentFailures : [
                ...(prev.recentFailures ?? []).slice(-9),
                { name, reason: message },
              ],
            }
          : prev,
      );
    };

    // Phase 78 — Install per-file de log realtime giong terminal + overall progress.
    // Windows fonts: chunk 5 de giu rayon parallel speed nhung co UI updates mid-way.
    const WIN_CHUNK = 5;
    for (let i = 0; i < windowsPaths.length; i += WIN_CHUNK) {
      const chunk = windowsPaths.slice(i, i + WIN_CHUNK);
      try {
        const results = await installFonts(chunk);
        for (const r of results) {
          applyResult(r.path, r.success, r.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('fail', `Chunk Windows fail: ${msg}`);
        for (const p of chunk) {
          applyResult(p, false, `Chunk error: ${msg}`);
        }
      }
    }

    // .shx fonts: per-file de UI thay tung file 1
    for (let i = 0; i < shxPaths.length; i += 1) {
      const path = shxPaths[i];
      if (!path) continue;
      try {
        const results = await installShxFonts([path]);
        const r = results[0];
        if (r) {
          const successMsg = r.success
            ? r.installed_to.join(', ')
            : r.message;
          applyResult(r.path, r.success, successMsg);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        applyResult(path, false, msg);
      }
    }

    // Phase 78 — Switch progress sang phase 'done' de show summary card
    setInstallProgress((prev) =>
      prev
        ? { ...prev, phase: 'done', finishedAt: Date.now() }
        : prev,
    );
    // Auto-dismiss summary sau 15s (nguoi dung co the dismiss som hon)
    setTimeout(() => {
      setInstallProgress((prev) => (prev && prev.phase === 'done' ? null : prev));
    }, 15000);

    appendLog(
      failCount === 0 ? 'ok' : 'info',
      `Hoàn tất: ${okCount}/${paths.length} thành công · ${failCount} lỗi`,
    );
    setToast(
      `✓ Cài thành công ${okCount}/${paths.length}${failCount > 0 ? ` · ${failCount} lỗi` : ''}`,
    );
    setTimeout(() => setToast(null), 6000);
  }

  const currentStats = tab === 'library' ? libraryStats : systemStats;
  const currentFonts = currentStats?.entries ?? [];

  const filtered = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    return currentFonts.filter((f) => {
      if (
        search &&
        !f.family.toLowerCase().includes(search) &&
        !f.full_name.toLowerCase().includes(search)
      ) {
        return false;
      }
      if (filter === 'vn' && !f.vn_support) return false;
      if (filter !== 'all' && filter !== 'vn') {
        const cls = classifyFont(f);
        if (filter === 'mono' && cls !== 'mono') return false;
        if (filter === 'serif' && cls !== 'serif') return false;
        if (filter === 'sans' && cls !== 'sans') return false;
      }
      return true;
    });
  }, [currentFonts, searchTerm, filter]);

  async function handleScanFolder(): Promise<void> {
    if (scanning) return;
    const dir = await pickFontDirectory();
    if (!dir) return;
    setScanning(true);
    try {
      const result = await scanFonts(dir, { maxEntries: 2000 });
      setLibraryStats(result);
      setTab('library');
    } catch (err) {
      setToast(`Quét fail: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setScanning(false);
    }
  }

  async function handleScanSystem(): Promise<void> {
    if (scanning) return;
    setScanning(true);
    try {
      const result = await scanSystemFonts({ maxEntries: 2000 });
      setSystemStats(result);
      setTab('system');
    } catch (err) {
      setToast(`Quét fail: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setScanning(false);
    }
  }

  // Phase 78.8 — Scan paths (file hoac folder) tim font references
  async function handleScanDwg(mode: 'file' | 'folder'): Promise<void> {
    if (dwgScanning) return;
    setDwgScanError(null);
    setDwgScanProgress(null);
    try {
      let paths: string[] = [];
      if (mode === 'file') {
        paths = await pickDwgFiles();
      } else {
        const folder = await pickFontDirectory();
        if (folder) paths = [folder];
      }
      if (paths.length === 0) return;

      // Save last picked path cho lan sau (Phase 78.8)
      try {
        localStorage.setItem('trishfont:dwg-last-paths', JSON.stringify(paths));
      } catch { /* ignore */ }

      setDwgScanning(true);
      setDwgScan(null); // clear cu de hien progress card

      // Phase 78.7 — listen 'dwg:scan-progress' event Rust emit per file
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ done: number; total: number; current: string }>(
        'dwg:scan-progress',
        (e) => setDwgScanProgress(e.payload),
      );

      try {
        const result = await scanDwgPaths(paths);
        setDwgScan(result);
        if (result.total_dwg === 0) {
          setToast('Không tìm thấy file .dwg/.dxf trong path đã chọn');
          setTimeout(() => setToast(null), 3000);
        } else {
          setToast(
            `Quét ${result.total_dwg} file CAD · ${result.unique_missing_fonts.length} font thiếu`,
          );
          setTimeout(() => setToast(null), 4000);
        }
      } finally {
        unlisten();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDwgScanError(msg);
      setToast(`Quét fail: ${msg}`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDwgScanning(false);
      setDwgScanProgress(null);
    }
  }

  async function handleInstallConfirmed(font: FontMeta): Promise<void> {
    setInstalling((prev) => new Set(prev).add(font.path));
    const isShx = font.path.toLowerCase().endsWith('.shx');
    appendLog(
      'info',
      `Cài ${isShx ? 'AutoCAD .shx' : 'Windows font'}: ${font.path.split(/[\\/]/).pop()}`,
    );
    try {
      if (isShx) {
        const results = await installShxFonts([font.path]);
        const r = results[0];
        if (r && r.success) {
          setInstalled((prev) => new Set(prev).add(font.path));
          appendLog('ok', `${font.full_name} → ${r.installed_to.join(', ')}`);
          setToast(`✓ Đã cài AutoCAD .shx`);
        } else {
          appendLog('fail', `${font.full_name} — ${r?.message ?? 'unknown'}`);
          setToast(`Cài fail: ${r?.message ?? 'unknown'}`);
        }
      } else {
        const results = await installFonts([font.path]);
        const r = results[0];
        if (r && r.success) {
          setInstalled((prev) => new Set(prev).add(font.path));
          appendLog('ok', `${font.full_name} → ${r.message}`);
          setToast(`✓ Đã cài`);
        } else {
          appendLog('fail', `${font.full_name} — ${r?.message ?? 'unknown'}`);
          setToast(`Cài fail: ${r?.message ?? 'unknown'}`);
        }
      }
      setTimeout(() => setToast(null), 4000);
    } finally {
      setInstalling((prev) => {
        const next = new Set(prev);
        next.delete(font.path);
        return next;
      });
    }
  }

  return (
    <div className="shell">
      <header className="module-subheader">
        <div className="module-title">
          <strong>TrishFont</strong>
          <div className="sub">{tr('topbar.tagline')}</div>
        </div>
        <div className="module-subheader-actions">
          {/* Phase 78.10 — Windows Admin runtime badge (KHAC voi user role
              "Admin" o top-right). Doi label de tranh confuse. */}
          <span
            className={`admin-badge admin-badge-${isAdmin ? 'ok' : 'warn'}`}
            title={
              isAdmin
                ? 'Đang chạy quyền Windows Administrator — có thể cài font vào C:\\Windows\\Fonts'
                : 'KHÔNG có quyền Windows Administrator — cài font hệ thống sẽ fail. Bấm phải app → Run as administrator.'
            }
          >
            {isAdmin ? '🛡 Quyền cài font OK' : '⚠ Cần Run as Admin'}
          </span>
        </div>
      </header>

      <nav className="tab-bar" role="tablist">
        <TabButton
          active={tab === 'packs'}
          onClick={() => {
            setTab('packs');
            handleAcknowledgePacksTab();
          }}
          label={
            <>
              {tr('tab.packs')} ({manifest?.packs.length ?? 0})
              {newPackIds.length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: '#fbbf24',
                    color: '#000',
                    fontSize: 10,
                    fontWeight: 800,
                    verticalAlign: 'middle',
                  }}
                  title={`${newPackIds.length} pack mới chưa xem`}
                >
                  +{newPackIds.length} MỚI
                </span>
              )}
            </>
          }
        />
        <TabButton
          active={tab === 'library'}
          onClick={() => setTab('library')}
          label={`${tr('tab.library')} (${libraryStats?.entries.length ?? 0})`}
        />
        <TabButton
          active={tab === 'system'}
          onClick={() => setTab('system')}
          label={`${tr('tab.system')} (${systemStats?.entries.length ?? 0})`}
        />
        {/* Phase 78.6 — DWG scanner tab */}
        <TabButton
          active={tab === 'dwg'}
          onClick={() => setTab('dwg')}
          label={`🔍 Quét .dwg${dwgScan ? ` (${dwgScan.unique_missing_fonts.length})` : ''}`}
        />
      </nav>

      {tab !== 'packs' && tab !== 'dwg' && (
        <section className="filter-bar">
          {/* Phase 15.1.n — Scan button trong filter bar mỗi tab */}
          {tab === 'library' && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => void handleScanFolder()}
              disabled={scanning}
            >
              📂 {tr('topbar.scan_folder')}
            </button>
          )}
          {tab === 'system' && (
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => void handleScanSystem()}
              disabled={scanning}
            >
              {systemStats ? '⟳' : '🖥'} {systemStats ? 'Quét lại' : tr('topbar.scan_system')}
            </button>
          )}
          <input
            type="search"
            className="search-input"
            placeholder={tr('search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            spellCheck={false}
          />
          <div className="filter-pills">
            {(['all', 'vn', 'serif', 'sans', 'mono'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'pill pill-active' : 'pill'}
                onClick={() => setFilter(f)}
              >
                {tr(`filter.${f === 'vn' ? 'vn_only' : f}`)}
              </button>
            ))}
          </div>
        </section>
      )}

      <main className="main-content">
        {tab === 'packs' && (
          <PacksTab
            manifest={manifest}
            loading={manifestLoading}
            installedPacks={installedPacks}
            installing={packInstalling}
            downloadProgress={downloadProgress}
            onDownloadPack={(p) => void handleInstallPack(p)}
            onDeletePack={(id) => void handleDeletePack(id)}
            onRefresh={() => void handleRefreshManifest()}
            selectedPackId={selectedPackId}
            packFiles={packFiles}
            packFilesLoading={packFilesLoading}
            selectedFiles={selectedFiles}
            fileStatus={fileStatus}
            onSelectPack={(id) => void handleSelectPack(id)}
            onToggleFile={toggleFileSelection}
            onSelectAll={selectAllFiles}
            onSelectFolder={selectFolderFiles}
            onClearSelection={clearFileSelection}
            onInstallSelected={() => void handleInstallSelected()}
            trKey={tr}
          />
        )}
        {tab !== 'packs' && tab !== 'dwg' && !currentStats && (
          <div className="empty-state">
            <div className="big">{tab === 'library' ? '📂' : '🖥'}</div>
            <h3>
              {tab === 'library'
                ? 'Chưa quét thư viện font'
                : 'Chưa quét font hệ thống'}
            </h3>
            <p>
              {tab === 'library'
                ? 'Chọn 1 folder chứa font (.ttf / .otf / .shx) để quét, hiển thị danh sách + cài đặt vào Windows.'
                : 'Quét toàn bộ font đang cài trong Windows (C:\\Windows\\Fonts + user fonts) để xem, lọc, xuất ra folder.'}
            </p>
            <div className="empty-actions">
              {tab === 'library' ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => void handleScanFolder()}
                  disabled={scanning}
                  type="button"
                >
                  📂 {tr('topbar.scan_folder')}
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => void handleScanSystem()}
                  disabled={scanning}
                  type="button"
                >
                  🖥 {tr('topbar.scan_system')}
                </button>
              )}
            </div>
          </div>
        )}

        {tab !== 'packs' && tab !== 'dwg' && currentStats && (
          <>
            <div className="stats-line muted small">
              <strong>{currentStats.entries.length}</strong> {tr('stats.found')} ·{' '}
              {currentStats.errors} {tr('stats.errors')} · {currentStats.elapsed_ms}{' '}
              {tr('stats.elapsed')}
              {currentStats.truncated && (
                <span className="badge badge-warn"> ⚠ {tr('stats.truncated')}</span>
              )}
              {filtered.length !== currentStats.entries.length && (
                <span> · Hiện <strong>{filtered.length}</strong> sau filter</span>
              )}
            </div>

            {/* Phase 15.1.l/p — Action bar: select all / clear / bulk install / export */}
            <div className="pack-action-bar">
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={selectAllVisible}
              >
                {tr('export.select_all')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={clearExportSelection}
              >
                {tr('export.clear')}
              </button>
              <span className="actions-spacer" />
              <span className="muted small">
                {exportSelection.size} {tr('export.selected')}
              </span>
              {tab === 'library' && (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => void handleBulkInstallSelected()}
                  disabled={exportSelection.size === 0}
                  title="Cài tất cả font đã tick — .ttf/.otf vào Windows, .shx vào AutoCAD"
                >
                  ⬇ {tr('packs.install_selected')}
                </button>
              )}
              <button
                type="button"
                className={
                  tab === 'library'
                    ? 'btn btn-ghost btn-small'
                    : 'btn btn-primary btn-small'
                }
                onClick={() => void handleExportToFolder()}
                disabled={exportSelection.size === 0}
              >
                📁 {tr('export.copy')}
              </button>
            </div>

            <div className="font-grid font-grid-compact">
              {filtered.map((font) => (
                <FontCard
                  key={font.path}
                  font={font}
                  sample={settings.sampleText}
                  size={settings.previewSize}
                  installing={installing.has(font.path)}
                  installed={installed.has(font.path) || tab === 'system'}
                  compact={true}
                  selected={exportSelection.has(font.path)}
                  onToggleSelect={() => toggleExportSelection(font.path)}
                  onInstall={() => setConfirmInstall(font)}
                  trKey={tr}
                />
              ))}
            </div>
          </>
        )}

        {/* Phase 78.6 — DWG Scanner tab */}
        {tab === 'dwg' && (
          <DwgScannerScreen
            scan={dwgScan}
            scanning={dwgScanning}
            progress={dwgScanProgress}
            error={dwgScanError}
            onPickFile={() => void handleScanDwg('file')}
            onPickFolder={() => void handleScanDwg('folder')}
            onJumpToPack={() => {
              setTab('packs');
              setToast('Vào tab Fontpack → click pack → tab AutoCAD fonts để cài SHX');
            }}
          />
        )}
      </main>

      {/* Phase 78 — Install progress bar / summary card */}
      {installProgress && (
        <InstallProgressBar
          progress={installProgress}
          onDismiss={() => setInstallProgress(null)}
        />
      )}

      {/* Phase 15.1.o — InstallLog ALWAYS visible bottom, share giữa mọi tab */}
      <InstallLog entries={installLog} onClear={clearLog} trKey={tr} />

      <footer className="foot">
        <span className="muted small">
          {tr('footer.copyright')} · trishteam.io.vn
        </span>
      </footer>

      {settingsOpen && (
        <SettingsModal
          initial={settings}
          appVersion={version}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => {
            applyTheme(next.theme);
            setSettings(next);
            saveSettings(next);
            setSettingsOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmInstall !== null}
        title={tr('install.confirm_title')}
        message={`${tr('install.confirm_body')}\n\nFont: ${confirmInstall?.full_name ?? confirmInstall?.family ?? ''}`}
        okLabel={tr('install.confirm_ok')}
        cancelLabel={tr('settings.cancel')}
        onConfirm={() => {
          if (confirmInstall) void handleInstallConfirmed(confirmInstall);
          setConfirmInstall(null);
        }}
        onCancel={() => setConfirmInstall(null)}
      />

      {toast && (
        <div className="export-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  // Phase 78.13.10 — đổi từ string → ReactNode để render badge "MỚI" inline
  label: ReactNode;
}

function TabButton({ active, onClick, label }: TabButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'tab tab-active' : 'tab'}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

interface FontCardProps {
  font: FontMeta;
  sample: string;
  size: number;
  installing: boolean;
  installed: boolean;
  /** Phase 15.1.k — compact mode: hide preview + skip FontFace load (perf for 2000 system fonts) */
  compact?: boolean;
  /** Phase 15.1.l — Export selection checkbox */
  selected?: boolean;
  onToggleSelect?: () => void;
  onInstall: () => void;
  trKey: (key: string) => string;
}

function FontCard({
  font,
  sample,
  size,
  installing,
  installed,
  compact = false,
  selected = false,
  onToggleSelect,
  onInstall,
  trKey,
}: FontCardProps): JSX.Element {
  const familyId = useMemo(
    () => `tf-${font.path.replace(/[^a-z0-9]/gi, '_').slice(-50)}`,
    [font.path],
  );
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    if (!isInTauri() || compact) return;
    let cancelled = false;
    let face: FontFace | null = null;

    void (async () => {
      try {
        const bytes = await readFile(font.path);
        if (cancelled) return;
        face = new FontFace(familyId, bytes);
        await face.load();
        if (cancelled) return;
        document.fonts.add(face);
        setPreviewReady(true);
      } catch (err) {
        console.warn('[trishfont] FontFace load fail:', font.family, err);
      }
    })();

    return () => {
      cancelled = true;
      if (face) {
        try {
          document.fonts.delete(face);
        } catch {
          /* ignore */
        }
      }
    };
  }, [font.path, familyId, compact]);

  return (
    <PackTabFontCardImpl
      font={font}
      familyId={familyId}
      previewReady={previewReady}
      installing={installing}
      installed={installed}
      compact={compact}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onInstall={onInstall}
      trKey={trKey}
      sample={sample}
      size={size}
    />
  );
}

// Re-impl to keep code shape simple (avoid touching giant block above)
interface PackTabFontCardImplProps {
  font: FontMeta;
  familyId: string;
  previewReady: boolean;
  installing: boolean;
  installed: boolean;
  compact: boolean;
  selected: boolean;
  onToggleSelect?: () => void;
  onInstall: () => void;
  trKey: (key: string) => string;
  sample: string;
  size: number;
}

function PackTabFontCardImpl({
  font,
  familyId,
  previewReady,
  installing,
  installed,
  compact,
  selected,
  onToggleSelect,
  onInstall,
  trKey,
  sample,
  size,
}: PackTabFontCardImplProps): JSX.Element {
  return (
    <article className={`font-card ${selected ? 'font-card-selected' : ''}`}>
      <div className="font-card-head">
        {compact && onToggleSelect && (
          <input
            type="checkbox"
            className="font-card-checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label="Chọn để export"
          />
        )}
        <div className="font-card-name">
          <strong>{font.family}</strong>
          {font.subfamily && font.subfamily !== 'Regular' && (
            <span className="muted small"> · {font.subfamily}</span>
          )}
        </div>
        <div className="font-card-badges">
          {font.vn_support && <span className="badge badge-vn">{trKey('card.vn')}</span>}
          {font.monospace && <span className="badge badge-mono">{trKey('card.mono')}</span>}
          {font.italic && <span className="badge badge-italic">{trKey('card.italic')}</span>}
          <span className="badge badge-weight">w{font.weight}</span>
        </div>
      </div>
      {!compact && (
        <div
          className="font-preview"
          style={{
            fontFamily: previewReady
              ? `"${familyId}", system-ui, sans-serif`
              : 'system-ui, sans-serif',
            fontSize: `${size}px`,
            lineHeight: 1.2,
            opacity: previewReady ? 1 : 0.4,
          }}
        >
          {sample || DEFAULT_SAMPLE_TEXT}
        </div>
      )}
      <div className="font-card-foot">
        <span className="muted small font-card-path" title={font.path}>
          {font.path.split(/[\\/]/).pop()}
        </span>
        <button
          type="button"
          className={`btn btn-small ${installed ? 'btn-done' : 'btn-primary'}`}
          onClick={onInstall}
          disabled={installing || installed}
        >
          {installing
            ? trKey('card.installing')
            : installed
              ? trKey('card.installed')
              : trKey('card.install')}
        </button>
      </div>
    </article>
  );
}

// ============================================================
// Phase 15.1.h/i — PacksTab (2-column: pack list + detail panel)
// ============================================================

export interface DownloadProgressInfo {
  downloaded_bytes: number;
  total_bytes: number;
  speed_mb_per_s: number;
  eta_sec: number;
  phase: 'download' | 'extract';
}

interface PacksTabProps {
  manifest: PackManifest | null;
  loading: boolean;
  installedPacks: InstalledPackRecord[];
  installing: Set<string>;
  downloadProgress: Map<string, DownloadProgressInfo>;
  onDownloadPack: (pack: FontPack) => void;
  onDeletePack: (packId: string) => void;
  onRefresh: () => void;
  selectedPackId: string | null;
  packFiles: PackFileEntry[];
  packFilesLoading: boolean;
  selectedFiles: Set<string>;
  fileStatus: Map<string, { status: 'pending' | 'installing' | 'done' | 'failed'; msg: string }>;
  onSelectPack: (packId: string) => void;
  onToggleFile: (path: string) => void;
  onSelectAll: (kind: 'all' | 'windows' | 'shx') => void;
  onSelectFolder: (folder: string) => void;
  onClearSelection: () => void;
  onInstallSelected: () => void;
  trKey: (key: string) => string;
}

function PacksTab({
  manifest,
  loading,
  installedPacks,
  installing,
  downloadProgress,
  onDownloadPack,
  onDeletePack,
  onRefresh,
  selectedPackId,
  packFiles,
  packFilesLoading,
  selectedFiles,
  fileStatus,
  onSelectPack,
  onToggleFile,
  onSelectAll,
  onSelectFolder,
  onClearSelection,
  onInstallSelected,
  trKey,
}: PacksTabProps): JSX.Element {
  const installedMap = useMemo(() => {
    const map = new Map<string, InstalledPackRecord>();
    for (const r of installedPacks) map.set(r.pack_id, r);
    return map;
  }, [installedPacks]);

  const selectedPack = useMemo(
    () => manifest?.packs.find((p) => p.id === selectedPackId) ?? null,
    [manifest, selectedPackId],
  );
  const selectedInstalled = selectedPackId ? installedMap.get(selectedPackId) : null;

  return (
    <section className="packs-section">
      <header className="section-head-row">
        <div>
          <h2 className="packs-title">{trKey('packs.title')}</h2>
          <p className="muted small">{trKey('packs.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '⟳ ...' : `⟳ ${trKey('packs.refresh')}`}
        </button>
      </header>

      {!manifest && loading && (
        <div className="empty-state">
          <div className="big" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>⟳</div>
          <h3>Đang tải danh sách pack</h3>
          <p>Kết nối GitHub để fetch manifest mới nhất...</p>
        </div>
      )}
      {manifest && manifest.packs.length === 0 && (
        <div className="empty-state">
          <div className="big">📦</div>
          <h3>Chưa có pack nào</h3>
          <p>Manifest trống — liên hệ admin để publish pack font mới.</p>
        </div>
      )}

      {manifest && manifest.packs.length > 0 && (
        <div className="packs-layout">
          {/* Left: pack list */}
          <div className="pack-list-col">
            {manifest.packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                installed={installedMap.get(pack.id) ?? null}
                installing={installing.has(pack.id)}
                selected={selectedPackId === pack.id}
                progress={downloadProgress.get(pack.id) ?? null}
                onClick={() => onSelectPack(pack.id)}
                onDownload={() => onDownloadPack(pack)}
                onDelete={() => onDeletePack(pack.id)}
                trKey={trKey}
              />
            ))}
          </div>

          {/* Right: detail panel */}
          <div className="pack-detail-col">
            {!selectedPack && (
              <div className="pack-detail-empty">
                <div className="pack-detail-empty-icon">👈</div>
                <div className="pack-detail-empty-title">Chọn pack để xem chi tiết</div>
                <div className="pack-detail-empty-sub">
                  {trKey('packs.detail_empty')}
                </div>
              </div>
            )}
            {selectedPack && !selectedInstalled && (
              <div className="pack-detail-empty">
                <div className="pack-detail-empty-icon">⬇</div>
                <div className="pack-detail-empty-title">Pack chưa tải</div>
                <div className="pack-detail-empty-sub">
                  {trKey('packs.detail_not_downloaded')}
                </div>
              </div>
            )}
            {selectedPack && selectedInstalled && (
              <PackDetailPanel
                pack={selectedPack}
                files={packFiles}
                filesLoading={packFilesLoading}
                selectedFiles={selectedFiles}
                fileStatus={fileStatus}
                onToggleFile={onToggleFile}
                onSelectAll={onSelectAll}
                onSelectFolder={onSelectFolder}
                onClearSelection={onClearSelection}
                onInstallSelected={onInstallSelected}
                trKey={trKey}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface PackCardProps {
  pack: FontPack;
  installed: InstalledPackRecord | null;
  installing: boolean;
  selected: boolean;
  progress: DownloadProgressInfo | null;
  onClick: () => void;
  onDownload: () => void;
  onDelete: () => void;
  trKey: (key: string) => string;
}

function PackCard({
  pack,
  installed,
  installing,
  selected,
  progress,
  onClick,
  onDownload,
  onDelete,
  trKey,
}: PackCardProps): JSX.Element {
  const sizeMb = (pack.size_bytes / 1_048_576).toFixed(1);
  const isDownloaded = installed !== null;
  const needsUpdate = isDownloaded && installed.version !== pack.version;

  let buttonLabel: string;
  let buttonClass: string;
  if (installing) {
    buttonLabel = trKey('packs.installing');
    buttonClass = 'btn btn-primary';
  } else if (needsUpdate) {
    buttonLabel = `↻ ${trKey('packs.update')} → v${pack.version}`;
    buttonClass = 'btn btn-primary';
  } else if (isDownloaded) {
    buttonLabel = `✓ ${trKey('packs.downloaded')}`;
    buttonClass = 'btn btn-done';
  } else {
    buttonLabel = `⬇ ${trKey('packs.download')}`;
    buttonClass = 'btn btn-primary';
  }

  return (
    <article
      className={`pack-card ${selected ? 'pack-card-selected' : ''}`}
      onClick={onClick}
    >
      <div className="pack-card-head">
        <div>
          <h3 className="pack-card-name">{pack.name}</h3>
          <span className="muted small">
            v{pack.version} · {pack.kind} · {sizeMb} MB · {pack.file_count} font
          </span>
        </div>
      </div>
      <p className="pack-card-desc">{pack.description}</p>
      {/* Phase 78.13.9 — Release notes admin set qua TrishAdmin */}
      {pack.release_notes && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            padding: '6px 10px',
            background: 'rgba(52,211,153,0.06)',
            borderLeft: '2px solid #34d399',
            borderRadius: 3,
            margin: '6px 0',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          📝 <strong>Ghi chú từ admin:</strong> {pack.release_notes}
          {pack.release_date && (
            <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Phát hành: {new Date(pack.release_date).toLocaleDateString('vi-VN')}
            </div>
          )}
        </div>
      )}
      {pack.tags.length > 0 && (
        <div className="pack-card-tags">
          {pack.tags.slice(0, 6).map((t) => (
            <span key={t} className="pill pack-tag">
              {t}
            </span>
          ))}
          {pack.tags.length > 6 && (
            <span className="pill pack-tag">+{pack.tags.length - 6}</span>
          )}
        </div>
      )}
      {/* Phase 63 — Download progress bar */}
      {installing && progress && (
        <div className="download-progress">
          <div className="download-progress-stats">
            <span className="download-progress-phase">
              {progress.phase === 'extract' ? '📦 Đang giải nén...' : '⬇ Đang tải'}
            </span>
            <span className="download-progress-pct">
              {progress.total_bytes > 0
                ? Math.min(
                    100,
                    Math.round((progress.downloaded_bytes / progress.total_bytes) * 100),
                  )
                : 0}
              %
            </span>
          </div>
          <div className="download-progress-bar">
            <div
              className="download-progress-fill"
              style={{
                width:
                  progress.total_bytes > 0
                    ? `${Math.min(
                        100,
                        (progress.downloaded_bytes / progress.total_bytes) * 100,
                      )}%`
                    : '0%',
              }}
            />
          </div>
          <div className="download-progress-meta">
            <span>
              {(progress.downloaded_bytes / 1_048_576).toFixed(1)} /{' '}
              {(progress.total_bytes / 1_048_576).toFixed(1)} MB
            </span>
            <span>{progress.speed_mb_per_s.toFixed(1)} MB/s</span>
            <span>
              {progress.eta_sec > 0
                ? `~${Math.round(progress.eta_sec)}s còn lại`
                : 'gần xong...'}
            </span>
          </div>
        </div>
      )}

      <div className="pack-card-foot">
        <button
          type="button"
          className={`${buttonClass} btn-lg`}
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          disabled={installing || (isDownloaded && !needsUpdate)}
        >
          {buttonLabel}
        </button>
        {isDownloaded && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm(`Gỡ "${pack.name}" khỏi máy này?\n\nFolder local + cache sẽ bị xoá. Pack vẫn còn trên cloud — bấm Tải lại bất cứ lúc nào.`)) return;
              onDelete();
            }}
            title={trKey('packs.delete_tooltip')}
          >
            ⬇⨯ {trKey('packs.delete')}
          </button>
        )}
      </div>
    </article>
  );
}

// ============================================================
// PackDetailPanel — file list + checkbox + install actions
// ============================================================

interface PackDetailPanelProps {
  pack: FontPack;
  files: PackFileEntry[];
  filesLoading: boolean;
  selectedFiles: Set<string>;
  fileStatus: Map<string, { status: 'pending' | 'installing' | 'done' | 'failed'; msg: string }>;
  onToggleFile: (path: string) => void;
  onSelectAll: (kind: 'all' | 'windows' | 'shx') => void;
  onSelectFolder: (folder: string) => void;
  onClearSelection: () => void;
  onInstallSelected: () => void;
  trKey: (key: string) => string;
}

function PackDetailPanel({
  pack,
  files,
  filesLoading,
  selectedFiles,
  fileStatus,
  onToggleFile,
  onSelectAll,
  onSelectFolder,
  onClearSelection,
  onInstallSelected,
  trKey,
}: PackDetailPanelProps): JSX.Element {
  const [tab, setTab] = useState<'windows' | 'shx'>('windows');
  // Phase 78.6 — Search + filter chip cho pack file list
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'vn' | 'serif' | 'sans' | 'mono'>('all');

  const windowsFonts = files.filter((f) => f.kind !== 'shx');
  const shxFonts = files.filter((f) => f.kind === 'shx');
  const baseVisible = tab === 'windows' ? windowsFonts : shxFonts;

  // Heuristic filter: dat trong useMemo de tranh tinh lai mỗi render
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseVisible.filter((f) => {
      // Search by file name (basename) or full path
      if (q && !f.name.toLowerCase().includes(q) && !f.path.toLowerCase().includes(q)) {
        return false;
      }
      // Filter type
      if (filterType !== 'all' && tab === 'windows') {
        const lower = f.name.toLowerCase();
        switch (filterType) {
          case 'vn':
            // VN heuristic: prefix UTM/VNI/TCVN/UVN/VN/.Vn hoac chua tu Vietnamese
            return (
              lower.startsWith('utm') ||
              lower.startsWith('vni-') ||
              lower.startsWith('vni') ||
              lower.startsWith('tcvn') ||
              lower.startsWith('uvn') ||
              lower.startsWith('.vn') ||
              lower.startsWith('vn') ||
              lower.includes('vietnam') ||
              lower.includes('vntime') ||
              lower.includes('vnarial') ||
              /^[a-z]+vn/i.test(lower)
            );
          case 'serif':
            return (
              lower.includes('serif') ||
              lower.includes('times') ||
              lower.includes('garamond') ||
              lower.includes('georgia') ||
              lower.includes('book') ||
              lower.includes('cambria') ||
              lower.includes('palatino') ||
              lower.includes('bodoni')
            );
          case 'sans':
            return (
              lower.includes('sans') ||
              lower.includes('arial') ||
              lower.includes('helvetica') ||
              lower.includes('calibri') ||
              lower.includes('tahoma') ||
              lower.includes('verdana') ||
              lower.includes('roboto') ||
              lower.includes('segoe') ||
              lower.includes('inter')
            );
          case 'mono':
            return (
              lower.includes('mono') ||
              lower.includes('courier') ||
              lower.includes('console') ||
              lower.includes('code') ||
              lower.includes('cascadia') ||
              lower.includes('fira') ||
              lower.includes('source code')
            );
          default:
            return true;
        }
      }
      return true;
    });
  }, [baseVisible, search, filterType, tab]);

  const selectedCount = selectedFiles.size;

  return (
    <div className="pack-detail">
      <header className="pack-detail-head">
        <h3>{pack.name}</h3>
        <span className="muted small">
          v{pack.version} · {windowsFonts.length} Windows · {shxFonts.length} AutoCAD
        </span>
      </header>

      {/* Sub-tabs */}
      <div className="pack-subtabs">
        <button
          type="button"
          className={tab === 'windows' ? 'subtab subtab-active' : 'subtab'}
          onClick={() => setTab('windows')}
        >
          {trKey('packs.tab_windows')} ({windowsFonts.length})
        </button>
        <button
          type="button"
          className={tab === 'shx' ? 'subtab subtab-active' : 'subtab'}
          onClick={() => setTab('shx')}
        >
          {trKey('packs.tab_shx')} ({shxFonts.length})
        </button>
      </div>

      {/* Phase 78.6 — Search + Filter chips trong pack detail */}
      <div className="pack-search-filter">
        <input
          type="search"
          className="pack-search-input"
          placeholder={`🔎 Tìm trong ${baseVisible.length.toLocaleString()} font... (vd: arial, vntime, mono)`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          spellCheck={false}
        />
        {tab === 'windows' && (
          <div className="pack-filter-chips">
            {(['all', 'vn', 'serif', 'sans', 'mono'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filterType === f ? 'pill pill-active' : 'pill'}
                onClick={() => setFilterType(f)}
              >
                {f === 'all'
                  ? 'Tất cả'
                  : f === 'vn'
                    ? '🇻🇳 Tiếng Việt'
                    : f === 'serif'
                      ? 'Serif'
                      : f === 'sans'
                        ? 'Sans'
                        : 'Mono'}
              </button>
            ))}
          </div>
        )}
        {(search.trim() || filterType !== 'all') && (
          <span className="pack-search-result muted small">
            Hiện <strong>{visible.length.toLocaleString()}</strong> / {baseVisible.length.toLocaleString()}
            {(search.trim() || filterType !== 'all') && (
              <button
                type="button"
                className="pack-search-clear"
                onClick={() => {
                  setSearch('');
                  setFilterType('all');
                }}
                title="Xóa filter"
              >
                ✕
              </button>
            )}
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="pack-action-bar">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onSelectAll(tab === 'windows' ? 'windows' : 'shx')}
        >
          {trKey('packs.select_all')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onClearSelection}
        >
          {trKey('packs.clear_selection')}
        </button>
        <span className="actions-spacer" />
        <span className="muted small">
          {selectedCount} {trKey('packs.selected')}
        </span>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onInstallSelected}
          disabled={selectedCount === 0}
        >
          {trKey('packs.install_selected')}
        </button>
      </div>

      {/* File list */}
      {filesLoading && <p className="muted">{trKey('packs.files_loading')}</p>}
      {!filesLoading && visible.length === 0 && (
        <p className="muted small">{trKey('packs.tab_empty')}</p>
      )}
      {!filesLoading && visible.length > 0 && (
        <ul className="pack-file-list">
          {(() => {
            // Phase 15.1.m — Group by folder
            const groups = new Map<string, typeof visible>();
            for (const f of visible) {
              const key = f.folder || '(root)';
              const arr = groups.get(key) ?? [];
              arr.push(f);
              groups.set(key, arr);
            }
            const out: JSX.Element[] = [];
            for (const [folder, files] of groups) {
              if (groups.size > 1) {
                out.push(
                  <li key={`__group__${folder}`} className="pack-file-group">
                    <span>📁 {folder} ({files.length})</span>
                    <button
                      type="button"
                      className="pack-file-group-btn"
                      onClick={() => onSelectFolder(folder)}
                    >
                      {trKey('packs.select_folder')}
                    </button>
                  </li>,
                );
              }
              for (const f of files) {
                const checked = selectedFiles.has(f.path);
                const status = fileStatus.get(f.path);
                out.push(
                  <li key={f.path} className="pack-file-item">
                    <label className="pack-file-label">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleFile(f.path)}
                      />
                      <span className="pack-file-name" title={f.path}>
                        {f.name}
                      </span>
                      <span className="muted small pack-file-meta">
                        {f.kind} · {(f.size_bytes / 1024).toFixed(0)} KB
                      </span>
                    </label>
                    {status && (
                      <span className={`pack-file-status pack-file-status-${status.status}`}>
                        {status.status === 'installing' && '⟳'}
                        {status.status === 'done' && '✓'}
                        {status.status === 'failed' && '⚠'}
                        {status.status === 'pending' && '·'}
                      </span>
                    )}
                  </li>,
                );
              }
            }
            return out;
          })()}
        </ul>
      )}

      {/* Phase 15.1.o — Log moved to shell-level (always visible bottom) */}
    </div>
  );
}

// ============================================================
// Phase 15.1.k — InstallLog (terminal-style process log)
// ============================================================

/* ============================================================
 * Phase 78.6 — DwgScannerScreen component
 * Phase 78.8 — Pick file/folder/multi + DXF parse + export report
 * ============================================================ */

/** Export DWG scan report ra file .txt (download qua browser File API) */
function exportDwgReport(scan: DwgScanSummary): void {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════');
  lines.push('   TrishFont — Báo cáo quét font CAD');
  lines.push('═══════════════════════════════════════════════');
  lines.push(`Thời gian: ${new Date().toLocaleString('vi-VN')}`);
  lines.push(`Path:      ${scan.folder}`);
  lines.push(`File CAD:  ${scan.total_dwg}`);
  lines.push(`.shx có:   ${scan.installed_shx_count}`);
  lines.push(`Font thiếu: ${scan.unique_missing_fonts.length}`);
  lines.push('');
  if (scan.unique_missing_fonts.length > 0) {
    lines.push('────── FONT THIẾU ──────');
    for (const f of scan.unique_missing_fonts) lines.push(`  ⚠ ${f}`);
    lines.push('');
  }
  lines.push('────── CHI TIẾT TỪNG FILE ──────');
  for (const r of scan.results) {
    lines.push('');
    lines.push(`📄 ${r.file_name}  (${(r.size_bytes / 1024).toFixed(0)} KB)`);
    lines.push(`   ${r.file_path}`);
    if (r.scan_error) {
      lines.push(`   ❌ ${r.scan_error}`);
      continue;
    }
    if (r.fonts_referenced.length === 0) {
      lines.push('   ❓ Không detect được font');
      continue;
    }
    for (const f of r.fonts_referenced) {
      const missing = r.fonts_missing.includes(f);
      lines.push(`   ${missing ? '✗' : '✓'} ${f}`);
    }
  }
  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trishfont-dwg-scan-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface DwgScannerScreenProps {
  scan: DwgScanSummary | null;
  scanning: boolean;
  progress: { done: number; total: number; current: string } | null;
  error: string | null;
  onPickFile: () => void;
  onPickFolder: () => void;
  onJumpToPack: () => void;
}

function DwgScannerScreen({
  scan,
  scanning,
  progress,
  error,
  onPickFile,
  onPickFolder,
  onJumpToPack,
}: DwgScannerScreenProps): JSX.Element {
  const [filter, setFilter] = useState<'all' | 'missing' | 'has-fonts' | 'no-fonts'>('all');

  if (scanning) {
    const pct = progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;
    return (
      <div className="dwg-scanning-card">
        <div className="dwg-scanning-head">
          <span className="dwg-scanning-spin">⟳</span>
          <div className="dwg-scanning-body">
            <div className="dwg-scanning-title">Đang quét file .dwg...</div>
            <div className="dwg-scanning-meta muted small">
              {progress
                ? `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} · ${pct}%`
                : 'Khởi tạo...'}
              {progress?.current && (
                <span className="dwg-scanning-current"> · {progress.current}</span>
              )}
            </div>
          </div>
        </div>
        <div className="install-progress-bar-track" style={{ marginTop: 8 }}>
          <div
            className="install-progress-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="empty-state">
        <div className="big">🔍</div>
        <h3>Quét font sử dụng trong file CAD</h3>
        <p>
          Chọn 1 hoặc nhiều file <strong>.dwg / .dxf</strong> (hoặc cả folder) → app scan để tìm các font (.shx, .ttf)
          được file CAD reference, rồi so với AutoCAD\Fonts để liệt kê font thiếu.
        </p>
        <p className="muted small" style={{ maxWidth: 520, marginTop: 4 }}>
          📄 <strong>.dxf</strong>: text format → parse chính xác 100%.
          <br />
          📄 <strong>.dwg</strong>: binary proprietary → dùng heuristic (có thể false positives, đủ dùng để check trước khi mở file CAD đối tác gửi).
        </p>
        <div className="empty-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={onPickFile}
          >
            📄 Chọn file .dwg/.dxf
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={onPickFolder}
          >
            📁 Quét cả folder
          </button>
        </div>
        {error && (
          <p className="muted small" style={{ color: 'var(--status-fail)', marginTop: 12 }}>
            ❌ {error}
          </p>
        )}
      </div>
    );
  }

  const hasMissing = scan.unique_missing_fonts.length > 0;
  return (
    <div className="dwg-scanner-screen">
      <div className="dwg-summary-card">
        <div className="dwg-summary-stat">
          <span className="dwg-summary-num">{scan.total_dwg.toLocaleString()}</span>
          <span className="dwg-summary-label">file .dwg</span>
        </div>
        <div className="dwg-summary-stat">
          <span className="dwg-summary-num">{scan.installed_shx_count.toLocaleString()}</span>
          <span className="dwg-summary-label">.shx có sẵn</span>
        </div>
        <div className={`dwg-summary-stat ${hasMissing ? 'dwg-summary-stat-warn' : 'dwg-summary-stat-ok'}`}>
          <span className="dwg-summary-num">{scan.unique_missing_fonts.length.toLocaleString()}</span>
          <span className="dwg-summary-label">font thiếu</span>
        </div>
        <span className="actions-spacer" />
        <button type="button" className="btn btn-ghost btn-small" onClick={onPickFile}>
          📄 Chọn file
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onPickFolder}>
          📁 Chọn folder
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => exportDwgReport(scan)}
          title="Xuất báo cáo .txt"
        >
          💾 Export
        </button>
        {hasMissing && (
          <button type="button" className="btn btn-primary btn-small" onClick={onJumpToPack}>
            → Sang Pack tải SHX
          </button>
        )}
      </div>

      <div className="dwg-summary-folder muted small">
        📁 <span title={scan.folder}>{scan.folder}</span>
      </div>

      {hasMissing && (
        <div className="dwg-missing-section">
          <div className="dwg-missing-head">
            ⚠ {scan.unique_missing_fonts.length} font không có trong AutoCAD\Fonts:
          </div>
          <div className="dwg-missing-chips">
            {scan.unique_missing_fonts.map((f) => (
              <span key={f} className="dwg-missing-chip">{f}</span>
            ))}
          </div>
        </div>
      )}

      {!hasMissing && scan.total_dwg > 0 && (
        <div className="dwg-all-ok">
          ✓ Tất cả font referenced trong {scan.total_dwg} file .dwg đều đã có trong AutoCAD\Fonts
        </div>
      )}

      {(() => {
        // Phase 78.7 — Filter file rows theo loai
        const countMissing = scan.results.filter((r) => r.fonts_missing.length > 0).length;
        const countHasFonts = scan.results.filter((r) => r.fonts_referenced.length > 0).length;
        const countNoFonts = scan.results.filter(
          (r) => r.fonts_referenced.length === 0 && !r.scan_error,
        ).length;
        const filtered = scan.results.filter((r) => {
          switch (filter) {
            case 'missing': return r.fonts_missing.length > 0;
            case 'has-fonts': return r.fonts_referenced.length > 0;
            case 'no-fonts': return r.fonts_referenced.length === 0 && !r.scan_error;
            default: return true;
          }
        });
        return (
          <div className="dwg-files-list">
            <div className="dwg-files-head">
              <span>📄 Chi tiết file</span>
              <div className="dwg-file-filters">
                <button
                  type="button"
                  className={`pill pill-sm ${filter === 'all' ? 'pill-active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  Tất cả ({scan.results.length})
                </button>
                {countMissing > 0 && (
                  <button
                    type="button"
                    className={`pill pill-sm pill-danger ${filter === 'missing' ? 'pill-active' : ''}`}
                    onClick={() => setFilter('missing')}
                  >
                    ⚠ Thiếu font ({countMissing})
                  </button>
                )}
                <button
                  type="button"
                  className={`pill pill-sm ${filter === 'has-fonts' ? 'pill-active' : ''}`}
                  onClick={() => setFilter('has-fonts')}
                >
                  ✓ Có font ({countHasFonts})
                </button>
                {countNoFonts > 0 && (
                  <button
                    type="button"
                    className={`pill pill-sm ${filter === 'no-fonts' ? 'pill-active' : ''}`}
                    onClick={() => setFilter('no-fonts')}
                    title="File không detect được font ref. Có thể DWG bị compressed/encrypted hoặc thực sự không dùng SHX font."
                  >
                    ❓ Không detect ({countNoFonts})
                  </button>
                )}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="muted small" style={{ padding: 16 }}>
                {scan.results.length === 0
                  ? 'Không có file .dwg nào trong folder.'
                  : 'Không có file nào khớp filter.'}
              </div>
            ) : (
              <ul className="dwg-file-rows">
                {filtered.map((r) => (
                  <li
                    key={r.file_path}
                    className={`dwg-file-row ${r.fonts_missing.length > 0 ? 'dwg-file-row-warn' : ''}`}
                  >
                    <div className="dwg-file-row-head">
                      <span className="dwg-file-name" title={r.file_path}>
                        📄 {r.file_name}
                      </span>
                      <span className="muted small">
                        {r.dwg_version && (
                          <span className="dwg-version-badge" title="Phiên bản DWG">
                            {r.dwg_version}
                          </span>
                        )}
                        {' · '}
                        {(r.size_bytes / 1024).toFixed(0)} KB
                        {r.fonts_referenced.length > 0 && ` · ${r.fonts_referenced.length} font`}
                        {r.fonts_missing.length > 0 && (
                          <span className="dwg-file-missing-count"> · ⚠ {r.fonts_missing.length} thiếu</span>
                        )}
                      </span>
                    </div>
                    {r.scan_error ? (
                      <div className="dwg-file-error">❌ {r.scan_error}</div>
                    ) : (
                      <>
                        {r.fonts_referenced.length === 0 && r.compressed_strings && (
                          <div className="dwg-file-compressed-hint">
                            ⚠ File DWG <strong>{r.dwg_version}</strong> có nén string (LZ77).
                            Heuristic byte-scan không đọc được font name → hãy <strong>Save As trong AutoCAD</strong>:
                            <ol style={{ margin: '4px 0 0 18px', padding: 0 }}>
                              <li>Mở file trong AutoCAD</li>
                              <li>File → Save As → chọn <strong>"AutoCAD R14/LT98/LT97 (*.dwg)"</strong> (uncompressed) HOẶC <strong>"AutoCAD 2018 DXF (*.dxf)"</strong> (text — chính xác 100%)</li>
                              <li>Quét lại file mới</li>
                            </ol>
                          </div>
                        )}
                        {r.fonts_referenced.length === 0 && !r.compressed_strings && (
                          <span className="muted small">
                            ❓ Không detect được font ref (file có thể không dùng SHX font)
                          </span>
                        )}
                        {r.fonts_referenced.length > 0 && (
                          <div className="dwg-file-fonts">
                            {r.fonts_referenced.map((f) => {
                              const missing = r.fonts_missing.includes(f);
                              return (
                                <span
                                  key={f}
                                  className={`dwg-font-chip ${missing ? 'dwg-font-chip-missing' : 'dwg-font-chip-ok'}`}
                                  title={missing ? 'Font thiếu trên máy' : 'Đã có trong AutoCAD\\Fonts'}
                                >
                                  {missing ? '✗' : '✓'} {f}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ============================================================
 * Phase 78 — InstallProgressBar component
 * Hien thi:
 *   - Trong khi cai: progress bar overall + count "X/Y · N%" + ok/fail count + ETA
 *   - Khi xong (phase='done'): summary card + list 10 loi dau (neu co) voi reason
 * ============================================================ */
interface InstallProgressBarProps {
  progress: {
    total: number;
    done: number;
    ok: number;
    fail: number;
    phase: 'installing' | 'done';
    startedAt: number;
    finishedAt?: number;
    recentFailures?: Array<{ name: string; reason: string }>;
  };
  onDismiss: () => void;
}

function InstallProgressBar({ progress, onDismiss }: InstallProgressBarProps): JSX.Element {
  const { total, done, ok, fail, phase, startedAt, finishedAt, recentFailures } = progress;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const elapsedMs = (finishedAt ?? Date.now()) - startedAt;

  const formatDuration = (ms: number): string => {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
  };

  // ETA: extrapolate from current rate (avg ms/file × remaining)
  const eta = (() => {
    if (phase !== 'installing' || done === 0) return null;
    const avgMs = elapsedMs / done;
    const remainingMs = avgMs * (total - done);
    return formatDuration(remainingMs);
  })();

  if (phase === 'installing') {
    return (
      <div className="install-progress-bar">
        <div className="install-progress-bar-head">
          <span className="install-progress-bar-title">
            ⚙ Đang cài font…
          </span>
          <span className="install-progress-bar-count">
            <strong>{done.toLocaleString()}</strong>
            <span className="muted"> / {total.toLocaleString()}</span>
            <span className="install-progress-bar-pct"> · {pct}%</span>
          </span>
          {eta && (
            <span className="install-progress-bar-eta muted small">
              · Còn ~{eta}
            </span>
          )}
          <span className="actions-spacer" />
          {ok > 0 && (
            <span className="install-progress-bar-stat install-progress-bar-ok">
              ✓ {ok.toLocaleString()}
            </span>
          )}
          {fail > 0 && (
            <span className="install-progress-bar-stat install-progress-bar-fail">
              ✗ {fail.toLocaleString()}
            </span>
          )}
        </div>
        <div className="install-progress-bar-track">
          <div
            className="install-progress-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // phase === 'done' — summary card with failure details
  const allOk = fail === 0;
  const failures = recentFailures ?? [];
  return (
    <div className={`install-progress-bar install-progress-bar-done ${allOk ? 'install-progress-bar-success' : 'install-progress-bar-mixed'}`}>
      <div className="install-progress-bar-summary">
        <span className="install-progress-bar-summary-icon">
          {allOk ? '✓' : '⚠'}
        </span>
        <div className="install-progress-bar-summary-body">
          <div className="install-progress-bar-summary-title">
            {allOk
              ? `Hoàn tất! Cài thành công ${ok.toLocaleString()} font`
              : `Hoàn tất với lỗi · ${ok.toLocaleString()}/${total.toLocaleString()} thành công · ${fail.toLocaleString()} lỗi`}
          </div>
          <div className="install-progress-bar-summary-meta muted small">
            <span>⏱ {formatDuration(elapsedMs)}</span>
            {ok > 0 && (
              <span className="install-progress-bar-ok"> · ✓ {ok.toLocaleString()} cài được</span>
            )}
            {fail > 0 && (
              <span className="install-progress-bar-fail"> · ✗ {fail.toLocaleString()} lỗi</span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={onDismiss}
          title="Ẩn (tự ẩn sau 15s)"
        >
          ✕
        </button>
      </div>
      {!allOk && failures.length > 0 && (
        <details className="install-progress-bar-failures">
          <summary className="install-progress-bar-failures-head">
            ⚠ Xem chi tiết {failures.length} lỗi đầu
            {fail > failures.length && (
              <span className="muted small">
                {' '}(còn {(fail - failures.length).toLocaleString()} — xem log)
              </span>
            )}
          </summary>
          <ul className="install-progress-bar-failures-list">
            {failures.map((f, i) => (
              <li key={i} className="install-progress-bar-failures-item">
                <span className="install-progress-bar-failures-name">{f.name}</span>
                <span className="install-progress-bar-failures-arrow muted">→</span>
                <span className="install-progress-bar-failures-reason">{f.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

interface InstallLogProps {
  entries: Array<{ time: string; level: 'ok' | 'fail' | 'info'; message: string }>;
  onClear: () => void;
  trKey: (key: string) => string;
}

function InstallLog({ entries, onClear, trKey }: InstallLogProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [entries]);

  const isEmpty = entries.length === 0;
  return (
    <div className={`install-log-section ${isEmpty ? 'install-log-section-empty' : ''}`}>
      <div className="install-log-head">
        <strong className="muted small">
          {trKey('log.title')} ({entries.length})
        </strong>
        {isEmpty && (
          <span className="install-log-empty-hint muted small">
            · {trKey('log.empty')}
          </span>
        )}
        <span className="actions-spacer" />
        {!isEmpty && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={onClear}
          >
            {trKey('log.clear')}
          </button>
        )}
      </div>
      {!isEmpty && (
        <div className="install-log" ref={ref}>
          {entries.map((e, i) => (
            <div key={i} className={`log-entry log-${e.level}`}>
              <span className="log-time">[{e.time}]</span>
              <span className="log-icon">
                {e.level === 'ok' ? '✓' : e.level === 'fail' ? '✗' : '·'}
              </span>
              <span className="log-msg">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
