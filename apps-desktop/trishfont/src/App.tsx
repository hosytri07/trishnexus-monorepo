import { useEffect, useMemo, useRef, useState } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
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
  type ScanFontsStats,
  type FontPack,
  type PackManifest,
  type InstalledPackRecord,
  type PackFileEntry,
} from './tauri-bridge.js';
import type { FontMeta } from '@trishteam/core/fonts';
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

type Tab = 'library' | 'system' | 'packs';
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

export function App(): JSX.Element {
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

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    void getAppVersion().then(setVersion);
    void checkIsAdmin().then(setIsAdmin);
    // Phase 15.1.h — fetch manifest on mount
    setManifestLoading(true);
    void fetchManifest()
      .then(setManifest)
      .finally(() => setManifestLoading(false));
  }, []);

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
    } finally {
      setManifestLoading(false);
    }
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

    appendLog(
      'info',
      `Bắt đầu cài ${paths.length} font (${windowsPaths.length} Windows + ${shxPaths.length} AutoCAD)...`,
    );

    setFileStatus((prev) => {
      const next = new Map(prev);
      for (const p of paths) next.set(p, { status: 'installing', msg: '' });
      return next;
    });

    let okCount = 0;
    let failCount = 0;
    const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

    // Install Windows fonts batch
    if (windowsPaths.length > 0) {
      try {
        const results = await installFonts(windowsPaths);
        setFileStatus((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            next.set(r.path, {
              status: r.success ? 'done' : 'failed',
              msg: r.message,
            });
            if (r.success) {
              okCount++;
              appendLog('ok', `${fileName(r.path)} → ${r.message}`);
            } else {
              failCount++;
              appendLog('fail', `${fileName(r.path)} — ${r.message}`);
            }
          }
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('fail', `Batch Windows fail: ${msg}`);
        setFileStatus((prev) => {
          const next = new Map(prev);
          for (const p of windowsPaths) next.set(p, { status: 'failed', msg });
          return next;
        });
        failCount += windowsPaths.length;
      }
    }

    // Install .shx batch
    if (shxPaths.length > 0) {
      try {
        const results = await installShxFonts(shxPaths);
        setFileStatus((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            next.set(r.path, {
              status: r.success ? 'done' : 'failed',
              msg: r.message,
            });
            if (r.success) {
              okCount++;
              const dests = r.installed_to.join(', ');
              appendLog('ok', `${fileName(r.path)} → ${dests}`);
            } else {
              failCount++;
              appendLog('fail', `${fileName(r.path)} — ${r.message}`);
            }
          }
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendLog('fail', `Batch SHX fail: ${msg}`);
        setFileStatus((prev) => {
          const next = new Map(prev);
          for (const p of shxPaths) next.set(p, { status: 'failed', msg });
          return next;
        });
        failCount += shxPaths.length;
      }
    }

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
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src={logoUrl}
            alt=""
            aria-hidden
            width={40}
            height={40}
          />
          <div>
            <strong>TrishFont</strong>
            <div className="sub">{tr('topbar.tagline')}</div>
          </div>
        </div>
        <div className="topbar-actions">
          {/* Phase 15.1.n — Admin badge thay scan buttons (đã move xuống filter bar mỗi tab) */}
          <span
            className={`admin-badge admin-badge-${isAdmin ? 'ok' : 'warn'}`}
            title={
              isAdmin
                ? 'Đang chạy quyền Administrator — có thể cài font hệ thống'
                : 'Không có quyền Administrator — cần Run as administrator để cài font'
            }
          >
            {isAdmin ? '🛡 Admin' : '⚠ Không Admin'}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            ⚙ {tr('topbar.settings')}
          </button>
          <span className="muted small">v{version}</span>
        </div>
      </header>

      <nav className="tab-bar" role="tablist">
        <TabButton
          active={tab === 'packs'}
          onClick={() => setTab('packs')}
          label={`${tr('tab.packs')} (${manifest?.packs.length ?? 0})`}
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
      </nav>

      {tab !== 'packs' && (
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
        {tab !== 'packs' && !currentStats && (
          <div className="empty-state">
            <p>{tr('preview.empty')}</p>
            <div className="empty-actions">
              <button
                className="btn btn-primary"
                onClick={() => void handleScanFolder()}
                disabled={scanning}
                type="button"
              >
                📂 {tr('topbar.scan_folder')}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void handleScanSystem()}
                disabled={scanning}
                type="button"
              >
                🖥 {tr('topbar.scan_system')}
              </button>
            </div>
          </div>
        )}

        {tab !== 'packs' && currentStats && (
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
                  className="btn btn-primary btn-small"
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
      </main>

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
  label: string;
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

interface PacksTabProps {
  manifest: PackManifest | null;
  loading: boolean;
  installedPacks: InstalledPackRecord[];
  installing: Set<string>;
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

      {!manifest && loading && <p className="muted">{trKey('packs.loading')}</p>}
      {manifest && manifest.packs.length === 0 && (
        <p className="muted">{trKey('packs.empty')}</p>
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
              <div className="pack-detail-empty muted">
                {trKey('packs.detail_empty')}
              </div>
            )}
            {selectedPack && !selectedInstalled && (
              <div className="pack-detail-empty muted">
                {trKey('packs.detail_not_downloaded')}
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
      <div className="pack-card-foot">
        <button
          type="button"
          className={`${buttonClass} btn-small`}
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
            className="btn btn-ghost btn-small btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={trKey('packs.delete_tooltip')}
          >
            🗑 {trKey('packs.delete')}
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

  const windowsFonts = files.filter((f) => f.kind !== 'shx');
  const shxFonts = files.filter((f) => f.kind === 'shx');
  const visible = tab === 'windows' ? windowsFonts : shxFonts;

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
          className="btn btn-primary btn-small"
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

  return (
    <div className="install-log-section">
      <div className="install-log-head">
        <strong className="muted small">
          {trKey('log.title')} ({entries.length})
        </strong>
        <span className="actions-spacer" />
        {entries.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={onClear}
          >
            {trKey('log.clear')}
          </button>
        )}
      </div>
      <div className="install-log" ref={ref}>
        {entries.length === 0 ? (
          <div className="log-entry log-info">
            <span className="log-icon">·</span>
            <span className="log-msg">{trKey('log.empty')}</span>
          </div>
        ) : (
          entries.map((e, i) => (
            <div key={i} className={`log-entry log-${e.level}`}>
              <span className="log-time">[{e.time}]</span>
              <span className="log-icon">
                {e.level === 'ok' ? '✓' : e.level === 'fail' ? '✗' : '·'}
              </span>
              <span className="log-msg">{e.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
