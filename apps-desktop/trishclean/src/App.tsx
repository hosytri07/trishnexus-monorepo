/**
 * TrishClean App.tsx — Phase 17.1 (v2 with extended features).
 *
 * 3 tab UI:
 *  1. Quick Clean — preset paths Windows + bulk multi-select clean.
 *  2. Custom Scan — pick folder, classify, search filter, checkbox selection.
 *  3. History — list trash sessions, restore/purge, refresh, lifetime stats.
 *
 * Features:
 *  - Logo SVG inline (Logo.tsx)
 *  - Settings modal (theme/retention/auto-purge/auto-update/confirm)
 *  - Search filter trong file list
 *  - Bulk preset clean (multi-select + dọn 1 lượt)
 *  - Lifetime stats topbar (tổng size đã dọn, số session active)
 *  - Update badge nếu có version mới
 */

import { useEffect, useMemo, useState } from 'react';
import {
  classifyPath,
  summarizeScan,
  type CleanCategory,
  type FileEntry,
  type ScanSummary,
} from '@trishteam/core/clean';
import {
  pickDirectory,
  scanDir,
  scanAutocadJunk,
  listCleanPresets,
  moveToTrash,
  listTrashSessions,
  restoreSession,
  purgeSession,
  purgeOldSessions,
  getDiskUsage,
  getAppVersion,
  checkForUpdate,
  openExternal,
  type ScanStats,
  type CleanPreset,
  type TrashManifest,
  type DiskInfo,
} from './tauri-bridge.js';
import { SettingsModal } from './SettingsModal.js';
import { loadSettings, applyTheme, type AppSettings } from './settings.js';
import logoUrl from './assets/logo.png';

type Tab = 'quick' | 'scan' | 'history';
type Status = 'idle' | 'scanning' | 'cleaning' | 'done' | 'error';
type ToastKind = 'ok' | 'err' | 'info';

// ============================================================
// JUNK FILE DETECTION (universal, không phụ thuộc folder location)
// ============================================================

/** Extensions thuần là rác — apps tự re-create khi cần. */
const JUNK_EXTENSIONS = new Set([
  // Temp / backup
  'tmp', 'temp',
  'bak', 'bk', 'bkp', 'old', 'orig',
  // Log
  'log',
  // Cache
  'cache',
  // Incomplete downloads (browser bị huỷ)
  'crdownload', 'part', 'partial', 'download', 'opdownload', 'tdl',
  // Crash dumps
  'dmp', 'dump',
  // Editor swap
  'swp', 'swo',
  // Python bytecode
  'pyc', 'pyo',
  // AutoCAD junk
  'sv$', 'dwl', 'dwl2', 'ac$', 'err',
  // Other
  'chk', // CHKDSK file fragments
]);

/** Filenames cụ thể là rác (không phân biệt extension). */
const JUNK_FILENAMES = new Set([
  'thumbs.db',
  'desktop.ini',
  '.ds_store',
  'ehthumbs.db',
  'iconcache.db',
  '.fuse_hidden', // Linux fuse
]);

/** Prefix junk (MS Office lock files, LibreOffice locks, ...) */
const JUNK_PREFIXES = ['~$', '.~lock.', 'hs_err_pid'];

/** Suffix junk (vim backup, emacs backup) */
const JUNK_SUFFIXES = ['~', '.bak~', '.swp', '.lock'];

/** Categories được coi là rác (skip 'large' và 'old' vì có thể là file user thực). */
const JUNK_CATEGORIES: ReadonlySet<CleanCategory> = new Set<CleanCategory>([
  'cache',
  'temp',
  'recycle',
  'duplicate',
  'empty_dir',
]);

/**
 * Phán đoán file có phải rác không (universal).
 *
 * Rule (any match → junk):
 *  1. Category là cache/temp/recycle/duplicate/empty_dir
 *  2. Extension trong JUNK_EXTENSIONS
 *  3. Filename trong JUNK_FILENAMES
 *  4. Prefix là ~$ / .~lock.
 *  5. Suffix là ~ / .swp / .lock
 *
 * KHÔNG coi 'large' hoặc 'old' là rác — vì file lớn có thể là video,
 * file cũ có thể là document quan trọng. User phải explicit pick.
 */
export function isJunkFile(entry: FileEntry): boolean {
  if (JUNK_CATEGORIES.has(entry.category)) return true;

  const filename = entry.path.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (!filename) return false;
  if (JUNK_FILENAMES.has(filename)) return true;

  const ext = filename.includes('.') ? filename.split('.').pop()! : '';
  if (ext && JUNK_EXTENSIONS.has(ext)) return true;

  if (JUNK_PREFIXES.some((p) => filename.startsWith(p))) return true;
  if (JUNK_SUFFIXES.some((s) => filename.endsWith(s))) return true;

  return false;
}

const CATEGORY_LABEL: Record<CleanCategory, string> = {
  cache: 'Cache',
  temp: 'Temp',
  download: 'Downloads cũ',
  duplicate: 'Trùng lặp',
  large: 'File lớn (>100 MB)',
  old: 'Chưa mở >180 ngày',
  empty_dir: 'Thư mục rỗng',
  recycle: 'Thùng rác OS',
  other: 'Khác',
};

const CATEGORY_ORDER: CleanCategory[] = [
  'cache',
  'temp',
  'download',
  'large',
  'old',
  'empty_dir',
  'recycle',
  'duplicate',
  'other',
];

export function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('quick');
  const [appVersion, setAppVersion] = useState('dev');
  const [updateBadge, setUpdateBadge] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);

  // Lifetime stats (compute từ list_trash_sessions)
  const [lifetime, setLifetime] = useState<{
    sessionsActive: number;
    totalCleaned: number;
  }>({ sessionsActive: 0, totalCleaned: 0 });

  // Disk usage (Phase 17.1.h)
  const [disk, setDisk] = useState<DiskInfo | null>(null);

  async function refreshDisk(): Promise<void> {
    const info = await getDiskUsage();
    setDisk(info);
  }

  function showToast(msg: string, kind: ToastKind = 'info'): void {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  }

  async function refreshLifetimeStats(): Promise<void> {
    const sessions = await listTrashSessions();
    const total = sessions.reduce((sum, s) => sum + s.total_size_bytes, 0);
    setLifetime({ sessionsActive: sessions.length, totalCleaned: total });
  }

  // App init
  useEffect(() => {
    applyTheme(settings.theme);
    void (async () => {
      const v = await getAppVersion();
      setAppVersion(v);
      // Auto-purge sessions cũ
      if (settings.autoPurgeOnLaunch) {
        try {
          const purged = await purgeOldSessions(settings.retentionDays);
          if (purged > 0) {
            console.log(`[trishclean] auto-purged ${purged} old sessions`);
          }
        } catch {
          /* ignore */
        }
      }
      // Check update
      if (settings.autoCheckUpdate) {
        try {
          const info = await checkForUpdate(v);
          if (info.hasUpdate) setUpdateBadge(info.latest);
        } catch {
          /* ignore */
        }
      }
      // Compute lifetime stats
      await refreshLifetimeStats();
      // Disk usage
      await refreshDisk();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="TrishClean" className="brand-logo" />
          <div>
            <strong>TrishClean</strong>
            <div className="sub">Dọn dẹp máy an toàn · undo {settings.retentionDays} ngày</div>
          </div>
        </div>

        {/* Topbar mid: lifetime + disk stats */}
        <div className="topbar-stats">
          {disk && (
            <div
              className={`stat-pill stat-pill-disk ${
                disk.used_percent > 90 ? 'stat-pill-warn' : ''
              }`}
              title={`${disk.mount} — ${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)} đã dùng (${disk.used_percent.toFixed(0)}%)`}
            >
              <div className="stat-pill-label">
                💽 {disk.mount} còn
              </div>
              <div className="stat-pill-value">
                {formatBytes(disk.free_bytes)}
              </div>
              <div className="disk-bar">
                <div
                  className="disk-bar-fill"
                  style={{ width: `${Math.min(100, disk.used_percent)}%` }}
                />
              </div>
            </div>
          )}
          <div className="stat-pill">
            <div className="stat-pill-label">Đã dọn</div>
            <div className="stat-pill-value">{formatBytes(lifetime.totalCleaned)}</div>
          </div>
          <div className="stat-pill">
            <div className="stat-pill-label">Trash session</div>
            <div className="stat-pill-value">{lifetime.sessionsActive}</div>
          </div>
        </div>

        <div className="topbar-right">
          {updateBadge && (
            <button
              type="button"
              className="btn btn-update"
              onClick={() =>
                void openExternal(
                  'https://github.com/hosytri07/trishnexus-monorepo/releases',
                )
              }
              title={`Có bản v${updateBadge} mới`}
            >
              ⬆ v{updateBadge}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setShowSettings(true)}
            title="Cài đặt"
          >
            ⚙
          </button>
          <span className="version-tag">v{appVersion}</span>
        </div>
      </header>

      <nav className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'quick' ? 'active' : ''}`}
          onClick={() => setTab('quick')}
        >
          ⚡ Quick Clean
        </button>
        <button
          type="button"
          className={`tab ${tab === 'scan' ? 'active' : ''}`}
          onClick={() => setTab('scan')}
        >
          🔍 Quét tuỳ chỉnh
        </button>
        <button
          type="button"
          className={`tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          📜 Lịch sử {lifetime.sessionsActive > 0 && (
            <span className="tab-badge">{lifetime.sessionsActive}</span>
          )}
        </button>
      </nav>

      <main className="content">
        {tab === 'quick' && (
          <QuickCleanTab
            showToast={showToast}
            settings={settings}
            onCleaned={refreshLifetimeStats}
          />
        )}
        {tab === 'scan' && (
          <ScanTab
            showToast={showToast}
            settings={settings}
            onCleaned={refreshLifetimeStats}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            showToast={showToast}
            settings={settings}
            onChanged={refreshLifetimeStats}
          />
        )}
      </main>

      {showSettings && (
        <SettingsModal
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSave={(s) => setSettings(s)}
        />
      )}

      {toast && (
        <div
          className={`toast toast-${toast.kind}`}
          role="status"
          onClick={() => setToast(null)}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Quick Clean Tab — multi-select bulk
// ============================================================

interface QuickCleanProps {
  showToast: (msg: string, kind?: ToastKind) => void;
  settings: AppSettings;
  onCleaned: () => Promise<void>;
}

interface PresetAnalysis {
  fileCount: number;
  totalBytes: number;
  /** Tất cả files (sorted desc by size) — dùng cho table chi tiết + clean */
  files: { path: string; size: number }[];
  scanError?: string;
}

type QuickPhase = 'idle' | 'analyzing' | 'analyzed' | 'cleaning';

// Phase 17.1.j — Custom folders user thêm vào Quick Clean (persist localStorage)
const CUSTOM_FOLDERS_KEY = 'trishclean:quick_custom_folders:v1';

function loadCustomFolders(): string[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_FOLDERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

function saveCustomFolders(list: string[]): void {
  try {
    window.localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Build virtual preset cho 1 custom folder. */
function customFolderToPreset(path: string, idx: number): CleanPreset {
  const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  return {
    id: `custom_${idx}`,
    label: `📁 ${name}`,
    description: `Quét folder này — chỉ dọn JUNK (.tmp/.bak/.log/cache/...) — KHÔNG động data`,
    path,
    exists: true, // assume exists vì user pick
    icon: '📁',
  };
}

function QuickCleanTab({ showToast, settings, onCleaned }: QuickCleanProps): JSX.Element {
  const [builtInPresets, setBuiltInPresets] = useState<CleanPreset[] | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>(() => loadCustomFolders());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<QuickPhase>('idle');
  const [analysis, setAnalysis] = useState<Map<string, PresetAnalysis>>(new Map());
  const [analyzeProgress, setAnalyzeProgress] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Combine built-in presets + custom folders thành 1 list duy nhất
  const presets: CleanPreset[] | null = useMemo(() => {
    if (!builtInPresets) return null;
    const customs = customFolders.map((path, i) => customFolderToPreset(path, i));
    return [...customs, ...builtInPresets];
  }, [builtInPresets, customFolders]);

  useEffect(() => {
    void listCleanPresets().then((list) => {
      setBuiltInPresets(list);
      // Default check tất cả presets + customs
      const initial = new Set<string>(
        list.filter((p) => p.exists).map((p) => p.id),
      );
      // Tick custom folders cũng default
      const customs = loadCustomFolders();
      customs.forEach((_, i) => initial.add(`custom_${i}`));
      setSelected(initial);
    });
  }, []);

  async function handleAddCustomFolder(): Promise<void> {
    if (phase !== 'idle') return;
    const picked = await pickDirectory();
    if (!picked) return;
    if (customFolders.includes(picked)) {
      showToast('Folder đã có trong list rồi.', 'info');
      return;
    }
    const next = [...customFolders, picked];
    setCustomFolders(next);
    saveCustomFolders(next);
    // Auto tick folder mới thêm
    setSelected((prev) => {
      const s = new Set(prev);
      s.add(`custom_${next.length - 1}`);
      return s;
    });
    showToast(`✓ Đã thêm "${picked}" vào Quick Clean.`, 'ok');
  }

  function handleRemoveCustomFolder(idx: number): void {
    if (phase !== 'idle') return;
    const next = customFolders.filter((_, i) => i !== idx);
    setCustomFolders(next);
    saveCustomFolders(next);
    // Re-build selected ids vì index thay đổi
    setSelected((prev) => {
      const s = new Set(prev);
      // Remove current custom_*, re-add với index mới
      for (let i = 0; i < customFolders.length; i++) {
        s.delete(`custom_${i}`);
      }
      next.forEach((_, i) => s.add(`custom_${i}`));
      return s;
    });
  }

  function togglePreset(id: string): void {
    if (phase === 'analyzing' || phase === 'cleaning') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllAvailable(): void {
    if (!presets || phase === 'analyzing' || phase === 'cleaning') return;
    setSelected(new Set(presets.filter((p) => p.exists).map((p) => p.id)));
  }

  function clearSelection(): void {
    if (phase === 'analyzing' || phase === 'cleaning') return;
    setSelected(new Set());
  }

  /** Step 1: Phân tích — scan tất cả presets selected. */
  async function handleAnalyze(): Promise<void> {
    if (!presets || selected.size === 0) return;
    const targets = presets.filter((p) => selected.has(p.id) && p.exists);
    if (targets.length === 0) {
      showToast('Không có preset nào để phân tích.', 'err');
      return;
    }

    setPhase('analyzing');
    setAnalysis(new Map());
    const newAnalysis = new Map<string, PresetAnalysis>();

    for (const p of targets) {
      setAnalyzeProgress(`Đang quét: ${p.label}…`);
      try {
        // Phase 17.1.i — preset autocad_junk dùng command riêng (scan recursive
        // nhiều roots với extension filter)
        const isAutocad = p.id === 'autocad_junk' || p.path.startsWith('<autocad>::');
        // Phase 17.1.k — Custom folder phải filter chỉ junk (tránh xoá user data)
        const isCustom = p.id.startsWith('custom_');

        const scan = isAutocad
          ? await scanAutocadJunk()
          : await scanDir(p.path, { maxEntries: 50_000, maxDepth: 8 });

        // Built-in cache presets (chrome_cache, etc.): folder ĐÃ là cache thuần
        // → mọi file trong đó là rác → KHÔNG cần filter
        // Custom folder: phải FILTER chỉ junk extensions/categories
        const nowMs = Date.now();
        let filtered = scan.entries.filter((e) => !e.is_dir);
        if (isCustom) {
          filtered = filtered.filter((e) => {
            const cat = classifyPath({
              path: e.path,
              size_bytes: e.size_bytes,
              accessed_at_ms: e.accessed_at_ms,
              is_dir: e.is_dir,
              nowMs,
            });
            const fakeEntry: FileEntry = {
              path: e.path,
              size_bytes: e.size_bytes,
              modified_at_ms: e.modified_at_ms,
              accessed_at_ms: e.accessed_at_ms,
              is_dir: e.is_dir,
              category: cat,
            };
            return isJunkFile(fakeEntry);
          });
        }

        const files = filtered.map((e) => ({ path: e.path, size: e.size_bytes }));
        const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
        const sorted = files.slice().sort((a, b) => b.size - a.size);
        newAnalysis.set(p.id, {
          fileCount: files.length,
          totalBytes,
          files: sorted,
        });
      } catch (err) {
        newAnalysis.set(p.id, {
          fileCount: 0,
          totalBytes: 0,
          files: [],
          scanError: err instanceof Error ? err.message : String(err),
        });
      }
    }

    setAnalysis(newAnalysis);
    setAnalyzeProgress(null);
    setPhase('analyzed');

    const totalFiles = Array.from(newAnalysis.values()).reduce(
      (sum, a) => sum + a.fileCount,
      0,
    );
    const totalBytes = Array.from(newAnalysis.values()).reduce(
      (sum, a) => sum + a.totalBytes,
      0,
    );
    showToast(
      `✓ Phân tích xong ${targets.length} preset: ${totalFiles.toLocaleString('vi-VN')} file (${formatBytes(totalBytes)}).`,
      'ok',
    );
  }

  /** Step 2: Dọn 1 preset cụ thể. */
  async function handleCleanOne(preset: CleanPreset): Promise<void> {
    if (phase === 'cleaning') return;
    const a = analysis.get(preset.id);
    if (!a || a.fileCount === 0) {
      showToast(`${preset.label}: chưa phân tích hoặc rỗng.`, 'info');
      return;
    }
    if (settings.confirmBeforeClean) {
      const ok = window.confirm(
        `Dọn "${preset.label}"?\n\n` +
          `${a.fileCount} file (${formatBytes(a.totalBytes)})\n\n` +
          `File chuyển sang trash, giữ ${settings.retentionDays} ngày.`,
      );
      if (!ok) return;
    }

    setPhase('cleaning');
    try {
      // AutoCAD junk: paths nằm rải rác (Documents/Downloads/Desktop) → KHÔNG
      // truyền cleanupRoot vì sẽ xóa nhầm folder cha của user files.
      const isAutocad = preset.id === 'autocad_junk' || preset.path.startsWith('<autocad>::');
      const result = await moveToTrash(
        a.files.map((f) => f.path),
        `Quick Clean — ${preset.label}`,
        isAutocad ? undefined : preset.path,
      );
      showToast(
        `✓ Dọn ${preset.label}: ${result.items_moved} file (${formatBytes(result.total_size_bytes)}).`,
        'ok',
      );
      // Reset analysis for this preset (đã dọn → 0)
      const next = new Map(analysis);
      next.delete(preset.id);
      setAnalysis(next);
      await onCleaned();
    } catch (err) {
      showToast(`⚠ ${err instanceof Error ? err.message : err}`, 'err');
    } finally {
      setPhase('analyzed');
    }
  }

  /** Step 2: Dọn tất cả preset đã phân tích. */
  async function handleCleanAll(): Promise<void> {
    if (phase === 'cleaning' || !presets) return;
    const ready = presets.filter((p) => {
      const a = analysis.get(p.id);
      return a && a.fileCount > 0;
    });
    if (ready.length === 0) {
      showToast('Không có gì để dọn.', 'info');
      return;
    }

    const totalFiles = ready.reduce(
      (s, p) => s + (analysis.get(p.id)?.fileCount ?? 0),
      0,
    );
    const totalBytes = ready.reduce(
      (s, p) => s + (analysis.get(p.id)?.totalBytes ?? 0),
      0,
    );

    if (settings.confirmBeforeClean) {
      const ok = window.confirm(
        `Dọn TẤT CẢ ${ready.length} preset?\n\n` +
          `Tổng: ${totalFiles.toLocaleString('vi-VN')} file (${formatBytes(totalBytes)})\n\n` +
          ready.map((p) => `• ${p.label} — ${analysis.get(p.id)!.fileCount} file`).join('\n') +
          `\n\nFile chuyển sang trash, giữ ${settings.retentionDays} ngày.`,
      );
      if (!ok) return;
    }

    setPhase('cleaning');
    let cleaned = 0;
    let cleanedBytes = 0;
    const errors: string[] = [];
    try {
      for (const p of ready) {
        const a = analysis.get(p.id)!;
        try {
          const isAutocad = p.id === 'autocad_junk' || p.path.startsWith('<autocad>::');
          const result = await moveToTrash(
            a.files.map((f) => f.path),
            `Quick Clean All — ${p.label}`,
            isAutocad ? undefined : p.path,
          );
          cleaned += result.items_moved;
          cleanedBytes += result.total_size_bytes;
        } catch (err) {
          errors.push(`${p.label}: ${err instanceof Error ? err.message : err}`);
        }
      }
      if (errors.length > 0) {
        showToast(
          `⚠ Dọn ${cleaned} file (${formatBytes(cleanedBytes)}). ${errors.length} preset lỗi.`,
          'err',
        );
      } else {
        showToast(
          `✓ Đã dọn ${cleaned.toLocaleString('vi-VN')} file (${formatBytes(cleanedBytes)}) từ ${ready.length} preset!`,
          'ok',
        );
      }
      // Reset analysis sau khi dọn xong
      setAnalysis(new Map());
      setPhase('idle');
      await onCleaned();
    } catch (err) {
      // Lỗi không lường trước (Tauri command crash, etc.) — recover về analyzed
      console.error('[trishclean] handleCleanAll uncaught:', err);
      showToast(`⚠ Lỗi: ${err instanceof Error ? err.message : err}`, 'err');
      setPhase('analyzed');
    }
  }

  function resetAnalysis(): void {
    setAnalysis(new Map());
    setPhase('idle');
    setExpandedId(null);
  }

  if (presets === null) {
    return <div className="empty muted">Đang tải presets…</div>;
  }
  if (presets.length === 0) {
    return (
      <div className="empty">
        <p className="muted">Không tìm thấy preset nào trên máy này.</p>
        <p className="muted small">
          Dùng tab "Quét tuỳ chỉnh" để chỉ định folder cụ thể.
        </p>
      </div>
    );
  }

  const availableCount = presets.filter((p) => p.exists).length;
  const selectedCount = selected.size;
  const isAnalyzed = phase === 'analyzed' || phase === 'cleaning';
  const totalAnalyzedBytes = Array.from(analysis.values()).reduce(
    (sum, a) => sum + a.totalBytes,
    0,
  );
  const totalAnalyzedFiles = Array.from(analysis.values()).reduce(
    (sum, a) => sum + a.fileCount,
    0,
  );

  return (
    <section className="quick-clean">
      <div className="quick-head">
        <div>
          <h2>{isAnalyzed ? 'Kết quả phân tích' : '1-click Cleanup'}</h2>
          <p className="muted">
            {phase === 'idle' &&
              `${availableCount} preset có sẵn${customFolders.length > 0 ? ` + ${customFolders.length} folder tùy chỉnh` : ''} → bấm "Phân tích" xem chi tiết.`}
            {phase === 'analyzing' && (analyzeProgress ?? 'Đang quét…')}
            {isAnalyzed &&
              `${totalAnalyzedFiles.toLocaleString('vi-VN')} file (${formatBytes(totalAnalyzedBytes)}) sẵn sàng dọn.`}
          </p>
        </div>
        <div className="quick-bulk-controls">
          {phase === 'idle' && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => void handleAddCustomFolder()}
                title="Thêm folder tùy chỉnh để quét + dọn (ổ D:, G:, ... đều OK)"
              >
                📁 Thêm folder
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={selectAllAvailable}
              >
                ☑ Chọn tất cả ({availableCount})
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={clearSelection}
                disabled={selectedCount === 0}
              >
                ☐ Bỏ chọn
              </button>
            </>
          )}
          {isAnalyzed && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={resetAnalysis}
              disabled={phase === 'cleaning'}
            >
              ↺ Phân tích lại
            </button>
          )}
        </div>
      </div>

      {/* Summary stats card — chỉ hiện sau khi phân tích */}
      {isAnalyzed && totalAnalyzedBytes > 0 && (
        <AnalysisSummary
          presets={presets}
          analysis={analysis}
          totalBytes={totalAnalyzedBytes}
          totalFiles={totalAnalyzedFiles}
        />
      )}

      <div className="preset-grid">
        {presets.map((p) => {
          const isSelected = selected.has(p.id);
          const a = analysis.get(p.id);
          const isExpanded = expandedId === p.id;
          return (
            <div
              key={p.id}
              className={`preset-card ${!p.exists ? 'preset-disabled' : ''} ${isSelected ? 'preset-selected' : ''} ${isAnalyzed && a && a.fileCount > 0 ? 'preset-ready' : ''}`}
            >
              {!isAnalyzed && (
                <input
                  type="checkbox"
                  className="preset-check"
                  checked={isSelected}
                  disabled={!p.exists || phase !== 'idle'}
                  onChange={() => togglePreset(p.id)}
                />
              )}
              <div className="preset-icon">{p.icon}</div>
              <div className="preset-body">
                <div className="preset-label">{p.label}</div>
                <div className="preset-desc muted small">{p.description}</div>
                {!isAnalyzed && (
                  <div
                    className="preset-path muted small"
                    title={p.path.startsWith('<autocad>::') ? 'Documents + Downloads + Desktop + Autodesk folders' : p.path}
                  >
                    {p.path.startsWith('<autocad>::')
                      ? 'Documents · Downloads · Desktop · Autodesk'
                      : p.path}
                  </div>
                )}
                {isAnalyzed && a && (
                  <div className="preset-analysis">
                    {a.scanError ? (
                      <span className="preset-error">⚠ {a.scanError}</span>
                    ) : a.fileCount === 0 ? (
                      <span className="muted small">Trống — không có gì dọn</span>
                    ) : (
                      <>
                        <span className="preset-size">
                          {formatBytes(a.totalBytes)}
                        </span>
                        <span className="muted small">
                          {' '}· {a.fileCount.toLocaleString('vi-VN')} file
                        </span>
                        <button
                          type="button"
                          className="btn-link-small"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : p.id)
                          }
                        >
                          {isExpanded ? '▾ Ẩn' : '▸ Top 10'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {isAnalyzed && a && a.fileCount > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-small preset-btn"
                  disabled={phase === 'cleaning'}
                  onClick={() => void handleCleanOne(p)}
                >
                  🧹 Dọn
                </button>
              )}
              {!isAnalyzed && p.id.startsWith('custom_') && (
                <button
                  type="button"
                  className="preset-remove-btn"
                  onClick={() =>
                    handleRemoveCustomFolder(parseInt(p.id.slice(7), 10))
                  }
                  title="Xoá folder này khỏi Quick Clean"
                  disabled={phase !== 'idle'}
                >
                  ✕
                </button>
              )}
              {isExpanded && a && a.files.length > 0 && (
                <div className="preset-topfiles">
                  <div className="preset-topfiles-head muted small">
                    Top 10 file lớn nhất:
                  </div>
                  {a.files.slice(0, 10).map((f, idx) => (
                    <div key={idx} className="preset-topfile-row">
                      <span className="preset-topfile-path" title={f.path}>
                        {f.path.split(/[\\/]/).slice(-2).join('/')}
                      </span>
                      <span className="preset-topfile-size">
                        {formatBytes(f.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed files table — chỉ hiện sau phân tích */}
      {isAnalyzed && totalAnalyzedFiles > 0 && (
        <DetailedFilesTable presets={presets} analysis={analysis} />
      )}

      <div className="action-bar">
        {phase === 'idle' && selectedCount > 0 && (
          <>
            <span className="action-info">
              Đã chọn <strong>{selectedCount}</strong> preset
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleAnalyze()}
            >
              🔍 Phân tích
            </button>
          </>
        )}
        {phase === 'analyzing' && (
          <>
            <span className="action-info">
              ⏳ {analyzeProgress ?? 'Đang quét…'}
            </span>
          </>
        )}
        {isAnalyzed && totalAnalyzedFiles > 0 && (
          <>
            <span className="action-info">
              Tổng <strong>{formatBytes(totalAnalyzedBytes)}</strong> sẵn sàng
              dọn
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={phase === 'cleaning'}
              onClick={() => void handleCleanAll()}
            >
              {phase === 'cleaning'
                ? '⏳ Đang dọn…'
                : `🧹 Dọn tất cả (${formatBytes(totalAnalyzedBytes)})`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Custom Scan Tab — search filter + checkbox + clean button
// ============================================================

interface ScanTabProps {
  showToast: (msg: string, kind?: ToastKind) => void;
  settings: AppSettings;
  onCleaned: () => Promise<void>;
}

const RECENT_SCANS_KEY = 'trishclean:recent_scans:v1';
const RECENT_SCANS_MAX = 8;

function loadRecentScans(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SCANS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as string[]).slice(0, RECENT_SCANS_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecentScan(path: string): void {
  try {
    const list = loadRecentScans().filter((p) => p !== path);
    list.unshift(path);
    window.localStorage.setItem(
      RECENT_SCANS_KEY,
      JSON.stringify(list.slice(0, RECENT_SCANS_MAX)),
    );
  } catch {
    /* ignore */
  }
}

function ScanTab({ showToast, settings, onCleaned }: ScanTabProps): JSX.Element {
  const [dir, setDir] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [selectedCat, setSelectedCat] = useState<CleanCategory | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'size' | 'age' | 'name'>('size');
  const [recentScans, setRecentScans] = useState<string[]>(() => loadRecentScans());
  // Phase 17.1.k — Default chỉ hiện file rác (TrishClean is a junk cleaner, not file manager)
  const [showOnlyJunk, setShowOnlyJunk] = useState(true);

  const nowMs = Date.now();

  const classified: FileEntry[] = useMemo(() => {
    if (!stats) return [];
    return stats.entries.map((e) => ({
      path: e.path,
      size_bytes: e.size_bytes,
      modified_at_ms: e.modified_at_ms,
      accessed_at_ms: e.accessed_at_ms,
      is_dir: e.is_dir,
      category: classifyPath({
        path: e.path,
        size_bytes: e.size_bytes,
        accessed_at_ms: e.accessed_at_ms,
        is_dir: e.is_dir,
        nowMs,
      }),
    }));
  }, [stats, nowMs]);

  const summary: ScanSummary | null = useMemo(() => {
    if (!classified.length) return null;
    return summarizeScan(classified, nowMs);
  }, [classified, nowMs]);

  async function scanPath(path: string): Promise<void> {
    setError(null);
    setChecked(new Set());
    setSearchQuery('');
    setDir(path);
    setStatus('scanning');
    try {
      const res = await scanDir(path, { maxEntries: 20_000, maxDepth: 6 });
      setStats(res);
      setStatus('done');
      saveRecentScan(path);
      setRecentScans(loadRecentScans());
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }

  async function handlePickAndScan(): Promise<void> {
    const picked = await pickDirectory();
    if (!picked) return;
    await scanPath(picked);
  }

  function handleExportCsv(): void {
    if (!stats || classified.length === 0) return;
    const rows: string[] = [];
    rows.push('path,category,size_bytes,is_dir,age_days,modified_at_ms,accessed_at_ms');
    for (const e of classified) {
      const ageDays = Math.max(
        0,
        Math.floor((nowMs - e.accessed_at_ms) / 86_400_000),
      );
      const safePath = `"${e.path.replace(/"/g, '""')}"`;
      rows.push(
        `${safePath},${e.category},${e.size_bytes},${e.is_dir},${ageDays},${e.modified_at_ms},${e.accessed_at_ms}`,
      );
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeDirName = (dir ?? 'scan')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 40);
    a.href = url;
    a.download = `trishclean-scan-${safeDirName}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✓ Exported CSV (${classified.length} rows).`, 'ok');
  }

  function clearRecentScans(): void {
    try {
      window.localStorage.removeItem(RECENT_SCANS_KEY);
    } catch {
      /* ignore */
    }
    setRecentScans([]);
  }

  // Apply junk filter (default ON)
  const junkFiltered = useMemo(() => {
    if (!showOnlyJunk) return classified;
    return classified.filter((e) => isJunkFile(e));
  }, [classified, showOnlyJunk]);

  const visibleEntries = useMemo(() => {
    let list = junkFiltered;
    if (selectedCat) list = list.filter((e) => e.category === selectedCat);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) => e.path.toLowerCase().includes(q));
    }
    // Sort
    const sorted = list.slice();
    if (sortBy === 'size') {
      sorted.sort((a, b) => b.size_bytes - a.size_bytes);
    } else if (sortBy === 'age') {
      sorted.sort((a, b) => a.accessed_at_ms - b.accessed_at_ms);
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.path.localeCompare(b.path));
    }
    return sorted;
  }, [junkFiltered, selectedCat, searchQuery, sortBy]);

  // Stats khi có filter junk: count + size của junk only
  const junkStats = useMemo(() => {
    const total = junkFiltered.reduce((s, e) => s + e.size_bytes, 0);
    return { count: junkFiltered.length, totalBytes: total };
  }, [junkFiltered]);

  function toggleCheck(path: string): void {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function checkAllVisible(): void {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const e of visibleEntries) {
        if (!e.is_dir) next.add(e.path);
      }
      return next;
    });
  }

  function uncheckAllVisible(): void {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const e of visibleEntries) {
        next.delete(e.path);
      }
      return next;
    });
  }

  // Phase 17.1.j — Quick-select theo category
  function checkByCategory(cats: CleanCategory[]): void {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const e of classified) {
        if (e.is_dir) continue;
        if (cats.includes(e.category)) next.add(e.path);
      }
      return next;
    });
  }

  const checkedSize = useMemo(() => {
    let total = 0;
    for (const e of classified) {
      if (checked.has(e.path)) total += e.size_bytes;
    }
    return total;
  }, [classified, checked]);

  async function handleCleanChecked(): Promise<void> {
    if (status === 'cleaning' || checked.size === 0) return;
    if (settings.confirmBeforeClean) {
      const sizeMb = (checkedSize / 1024 ** 2).toFixed(1);
      const ok = window.confirm(
        `Dọn ${checked.size} file (${sizeMb} MB)?\n\n` +
          `File sẽ chuyển sang trash, giữ ${settings.retentionDays} ngày trước khi xoá vĩnh viễn.`,
      );
      if (!ok) return;
    }

    setStatus('cleaning');
    try {
      const paths = Array.from(checked);
      const result = await moveToTrash(
        paths,
        `Custom Scan — ${dir ?? 'unknown'}`,
        dir ?? undefined, // cleanupRoot
      );
      const sizeMb2 = (result.total_size_bytes / 1024 ** 2).toFixed(1);
      showToast(
        `✓ Dọn ${result.items_moved} file (${sizeMb2} MB).`,
        'ok',
      );
      setChecked(new Set());
      if (dir) {
        const res = await scanDir(dir, { maxEntries: 20_000, maxDepth: 6 });
        setStats(res);
      }
      await onCleaned();
      setStatus('done');
    } catch (err) {
      showToast(`⚠ ${err instanceof Error ? err.message : err}`, 'err');
      setStatus('done');
    }
  }

  return (
    <section className="scan-tab">
      <div className="scan-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handlePickAndScan()}
          disabled={status === 'scanning' || status === 'cleaning'}
        >
          {status === 'scanning' ? '⏳ Đang quét…' : '📁 Chọn thư mục & quét'}
        </button>
        {dir && (
          <>
            <span className="muted small scan-dir-pill" title={dir}>
              {dir}
            </span>
            {stats && classified.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={handleExportCsv}
                title="Export scan results sang CSV"
              >
                💾 Export CSV
              </button>
            )}
            {dir && status === 'done' && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => void scanPath(dir)}
                title="Quét lại folder hiện tại"
              >
                ↻ Re-scan
              </button>
            )}
          </>
        )}
      </div>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}
      {stats?.truncated && (
        <div className="alert alert-warn">
          Đã quét tối đa ({stats.entries.length} file). Chọn thư mục nhỏ hơn.
        </div>
      )}

      {!stats && status !== 'scanning' && (
        <div className="empty">
          <p>Chọn 1 thư mục để quét. Gợi ý:</p>
          <ul>
            <li>Downloads (installer cũ, file ít mở)</li>
            <li>%TEMP% / /tmp (cache phiên làm việc)</li>
            <li>~/.cache hoặc AppData\Local\Cache</li>
            <li>Thư mục project cũ chưa dùng nữa</li>
          </ul>
          <p className="muted small">
            💡 Tab Quick Clean ở trên có sẵn 5 preset Windows phổ biến — không
            cần pick folder.
          </p>

          {recentScans.length > 0 && (
            <div className="recent-scans">
              <div className="recent-scans-head">
                <strong>📂 Quét gần đây</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={clearRecentScans}
                  title="Xoá lịch sử quét"
                >
                  Xoá
                </button>
              </div>
              <ul className="recent-list">
                {recentScans.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      className="recent-item"
                      onClick={() => void scanPath(path)}
                      title={`Quét lại: ${path}`}
                    >
                      <span className="recent-icon">↻</span>
                      <span className="recent-path">{path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {summary && stats && (
        <>
          <section className="stats-panel stats-panel-with-pie">
            <div className="stats-grid">
              <Stat
                label={showOnlyJunk ? '🗑 File rác' : 'Tổng file'}
                value={
                  showOnlyJunk
                    ? `${junkStats.count.toLocaleString('vi-VN')} / ${summary.total_files.toLocaleString('vi-VN')}`
                    : summary.total_files.toLocaleString('vi-VN')
                }
              />
              <Stat
                label={showOnlyJunk ? '🗑 Size rác' : 'Tổng size'}
                value={
                  showOnlyJunk
                    ? formatBytes(junkStats.totalBytes)
                    : formatBytes(summary.total_size_bytes)
                }
              />
              <Stat
                label="Thời gian quét"
                value={`${(stats.elapsed_ms / 1000).toFixed(1)} s`}
              />
              {stats.errors > 0 && (
                <Stat label="Lỗi đọc" value={`${stats.errors} file`} warn />
              )}
            </div>
            <CategoryPie summary={summary} />
          </section>

          {/* Phase 17.1.k — Junk filter toggle */}
          <section className="junk-filter-bar">
            <label className="junk-filter-toggle">
              <input
                type="checkbox"
                checked={showOnlyJunk}
                onChange={(e) => {
                  setShowOnlyJunk(e.target.checked);
                  setChecked(new Set()); // reset selection khi đổi filter
                }}
              />
              <span>
                <strong>🗑 Chỉ hiện file rác</strong>{' '}
                <span className="muted small">
                  (cache · temp · empty dirs · .bak/.tmp/.log/.cache/.crdownload/...)
                </span>
              </span>
            </label>
            {!showOnlyJunk && (
              <span className="junk-filter-warn small">
                ⚠ Đang hiện TẤT CẢ files. Cẩn thận chọn — có file user data!
              </span>
            )}
          </section>

          <section className="categories">
            <div className="cat-grid">
              <CatPill
                label="Tất cả"
                count={summary.total_files}
                size={summary.total_size_bytes}
                active={selectedCat === null}
                onClick={() => setSelectedCat(null)}
              />
              {CATEGORY_ORDER.map((c) => {
                const s = summary.by_category[c];
                if (!s || s.count === 0) return null;
                return (
                  <CatPill
                    key={c}
                    label={CATEGORY_LABEL[c]}
                    count={s.count}
                    size={s.size_bytes}
                    active={selectedCat === c}
                    onClick={() => setSelectedCat(c)}
                  />
                );
              })}
            </div>

            {/* Quick-select buttons */}
            <div className="quick-select-row">
              <span className="muted small">⚡ Tick nhanh:</span>
              {summary.by_category.large?.count > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => checkByCategory(['large'])}
                  title="Chọn tất cả file > 100 MB"
                >
                  📦 File lớn ({summary.by_category.large.count})
                </button>
              )}
              {summary.by_category.old?.count > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => checkByCategory(['old'])}
                  title="Chọn tất cả file chưa mở > 180 ngày"
                >
                  🕐 Cũ ({summary.by_category.old.count})
                </button>
              )}
              {(summary.by_category.cache?.count ?? 0) +
                (summary.by_category.temp?.count ?? 0) >
                0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => checkByCategory(['cache', 'temp'])}
                  title="Chọn tất cả Cache + Temp"
                >
                  🧹 Cache+Temp (
                  {(summary.by_category.cache?.count ?? 0) +
                    (summary.by_category.temp?.count ?? 0)}
                  )
                </button>
              )}
              {summary.by_category.duplicate?.count > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => checkByCategory(['duplicate'])}
                  title="Chọn tất cả file trùng lặp"
                >
                  🔀 Trùng lặp ({summary.by_category.duplicate.count})
                </button>
              )}
            </div>
          </section>

          <section className="file-list">
            <div className="list-header">
              <h3>
                {selectedCat ? CATEGORY_LABEL[selectedCat] : 'Tất cả file'}
                <span className="muted small"> ({visibleEntries.length})</span>
              </h3>
              <div className="list-tools">
                <input
                  type="text"
                  className="search-input"
                  placeholder="🔍 Tìm theo tên file..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  title="Sắp xếp"
                >
                  <option value="size">Sort: size desc</option>
                  <option value="age">Sort: cũ nhất</option>
                  <option value="name">Sort: A-Z</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={checkAllVisible}
                  disabled={visibleEntries.length === 0}
                >
                  ☑ Tất cả
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={uncheckAllVisible}
                  disabled={checked.size === 0}
                >
                  ☐ Bỏ chọn
                </button>
              </div>
            </div>
            <div className="list-scroll">
              {visibleEntries.slice(0, 200).map((e) => (
                <FileRow
                  key={e.path}
                  entry={e}
                  nowMs={nowMs}
                  checked={checked.has(e.path)}
                  onToggle={() => toggleCheck(e.path)}
                />
              ))}
              {visibleEntries.length > 200 && (
                <div className="row muted small">
                  … {visibleEntries.length - 200} file nữa không hiển thị
                </div>
              )}
              {visibleEntries.length === 0 && (
                <div className="empty muted small" style={{ padding: 20 }}>
                  {searchQuery
                    ? `Không có file nào khớp "${searchQuery}"`
                    : 'Không có file nào'}
                </div>
              )}
            </div>
          </section>

          <div className="action-bar">
            <span className="action-info">
              {checked.size > 0 ? (
                <>
                  Đã chọn <strong>{checked.size}</strong> file ·{' '}
                  <strong>{formatBytes(checkedSize)}</strong>
                </>
              ) : (
                <span className="muted">
                  💡 Tick checkbox file để dọn — hoặc dùng "Tick nhanh" ở trên
                </span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-danger"
              disabled={status === 'cleaning' || checked.size === 0}
              onClick={() => void handleCleanChecked()}
            >
              {status === 'cleaning'
                ? '⏳ Đang dọn…'
                : checked.size === 0
                  ? '🧹 Dọn (chưa chọn file)'
                  : `🧹 Dọn ${formatBytes(checkedSize)}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================
// History Tab — list + restore + purge + refresh
// ============================================================

interface HistoryProps {
  showToast: (msg: string, kind?: ToastKind) => void;
  settings: AppSettings;
  onChanged: () => Promise<void>;
}

function HistoryTab({ showToast, settings, onChanged }: HistoryProps): JSX.Element {
  const [sessions, setSessions] = useState<TrashManifest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function refresh(): Promise<void> {
    const list = await listTrashSessions();
    setSessions(list);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.session_id.toLowerCase().includes(q),
    );
  }, [sessions, searchQuery]);

  const totalActive = useMemo(() => {
    if (!sessions) return 0;
    return sessions.reduce((sum, s) => sum + s.total_size_bytes, 0);
  }, [sessions]);

  async function handleRestore(s: TrashManifest): Promise<void> {
    if (settings.confirmBeforeClean) {
      const ok = window.confirm(
        `Khôi phục ${s.items.length} file của session "${s.label}"?\n\n` +
          `File sẽ được trả về vị trí gốc.`,
      );
      if (!ok) return;
    }
    setBusyId(s.session_id);
    try {
      const restored = await restoreSession(s.session_id);
      showToast(`✓ Khôi phục ${restored} file.`, 'ok');
      await refresh();
      await onChanged();
    } catch (err) {
      showToast(`⚠ ${err instanceof Error ? err.message : err}`, 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(s: TrashManifest): Promise<void> {
    const ok = window.confirm(
      `Xoá VĨNH VIỄN session "${s.label}"?\n\n` +
        `${s.items.length} file (${formatBytes(s.total_size_bytes)}) sẽ KHÔNG khôi phục được.`,
    );
    if (!ok) return;
    setBusyId(s.session_id);
    try {
      await purgeSession(s.session_id);
      showToast(`✓ Xoá vĩnh viễn session.`, 'ok');
      await refresh();
      await onChanged();
    } catch (err) {
      showToast(`⚠ ${err instanceof Error ? err.message : err}`, 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurgeAll(): Promise<void> {
    if (!sessions || sessions.length === 0) return;
    const ok = window.confirm(
      `Xoá VĨNH VIỄN TẤT CẢ ${sessions.length} session?\n\n` +
        `Tổng ${formatBytes(totalActive)} sẽ bị xoá KHÔNG khôi phục được.`,
    );
    if (!ok) return;
    for (const s of sessions) {
      try {
        await purgeSession(s.session_id);
      } catch {
        /* ignore individual errors */
      }
    }
    showToast(`✓ Xoá tất cả session.`, 'ok');
    await refresh();
    await onChanged();
  }

  if (sessions === null) {
    return <div className="empty muted">Đang tải lịch sử…</div>;
  }
  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p>📦 Lịch sử trống</p>
        <p className="muted small">
          Các session dọn dẹp sẽ hiện ở đây. Tự động xoá vĩnh viễn sau{' '}
          {settings.retentionDays} ngày.
        </p>
      </div>
    );
  }

  const nowMs = Date.now();

  return (
    <section className="history-tab">
      <div className="history-head">
        <div>
          <p className="muted small">
            <strong>{sessions.length}</strong> session đang giữ ·{' '}
            <strong>{formatBytes(totalActive)}</strong> tổng cộng · auto-purge
            sau {settings.retentionDays} ngày
          </p>
        </div>
        <div className="history-tools">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Tìm session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => void refresh()}
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            className="btn btn-danger btn-small"
            onClick={() => void handlePurgeAll()}
            disabled={busyId !== null}
            title="Xoá vĩnh viễn TẤT CẢ session"
          >
            🗑 Xoá tất cả
          </button>
        </div>
      </div>

      {filtered.length === 0 && searchQuery && (
        <div className="empty muted small" style={{ padding: 20 }}>
          Không có session nào khớp "{searchQuery}"
        </div>
      )}

      <div className="session-list">
        {filtered.map((s) => {
          const ageMs = nowMs - s.created_at_ms;
          const ageDays = Math.floor(ageMs / 86_400_000);
          const ageHours = Math.floor(ageMs / 3_600_000);
          const ageLabel =
            ageDays >= 1
              ? `${ageDays} ngày trước`
              : ageHours >= 1
                ? `${ageHours} giờ trước`
                : 'vài phút trước';
          const remainDays = Math.max(0, settings.retentionDays - ageDays);
          const isExpiring = remainDays <= 1;
          return (
            <div
              key={s.session_id}
              className={`session-card ${isExpiring ? 'session-expiring' : ''}`}
            >
              <div className="session-info">
                <div className="session-label">{s.label}</div>
                <div className="session-meta muted small">
                  {s.items.length} file · {formatBytes(s.total_size_bytes)} ·{' '}
                  {ageLabel} ·{' '}
                  <span className={isExpiring ? 'session-expire-warn' : ''}>
                    còn {remainDays} ngày
                  </span>
                </div>
                <div className="session-id muted small">
                  ID: {s.session_id}
                </div>
              </div>
              <div className="session-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={busyId === s.session_id}
                  onClick={() => void handleRestore(s)}
                >
                  ↩ Khôi phục
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  disabled={busyId === s.session_id}
                  onClick={() => void handlePurge(s)}
                >
                  🗑 Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================
// Helpers
// ============================================================

interface StatProps {
  label: string;
  value: string;
  warn?: boolean;
}
function Stat({ label, value, warn }: StatProps): JSX.Element {
  return (
    <div className={`stat ${warn ? 'warn' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

/**
 * DetailedFilesTable — bảng chi tiết tất cả files sau khi phân tích.
 * Search + sort, virtualize bằng cách limit 500 row hiển thị.
 */
interface DetailedFilesTableProps {
  presets: CleanPreset[];
  analysis: Map<string, PresetAnalysis>;
}
function DetailedFilesTable({
  presets,
  analysis,
}: DetailedFilesTableProps): JSX.Element | null {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'size' | 'name' | 'group'>('size');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Combine all files từ tất cả presets có data
  const allFiles = useMemo(() => {
    const list: {
      presetId: string;
      presetLabel: string;
      presetIcon: string;
      path: string;
      size: number;
    }[] = [];
    for (const p of presets) {
      const a = analysis.get(p.id);
      if (!a || a.files.length === 0) continue;
      for (const f of a.files) {
        list.push({
          presetId: p.id,
          presetLabel: p.label,
          presetIcon: p.icon,
          path: f.path,
          size: f.size,
        });
      }
    }
    return list;
  }, [presets, analysis]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const f of allFiles) set.add(f.presetId);
    return presets.filter((p) => set.has(p.id));
  }, [allFiles, presets]);

  const filtered = useMemo(() => {
    let list = allFiles;
    if (groupFilter !== 'all') {
      list = list.filter((f) => f.presetId === groupFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.path.toLowerCase().includes(q));
    }
    const sorted = list.slice();
    if (sortBy === 'size') sorted.sort((a, b) => b.size - a.size);
    else if (sortBy === 'name') sorted.sort((a, b) => a.path.localeCompare(b.path));
    else if (sortBy === 'group')
      sorted.sort((a, b) => a.presetLabel.localeCompare(b.presetLabel));
    return sorted;
  }, [allFiles, search, sortBy, groupFilter]);

  if (allFiles.length === 0) return null;

  const totalSize = filtered.reduce((s, f) => s + f.size, 0);
  const RENDER_LIMIT = 500;

  return (
    <section className="files-table-section">
      <div className="files-table-head">
        <h3>
          📋 Chi tiết file{' '}
          <span className="muted small">
            ({filtered.length.toLocaleString('vi-VN')} file ·{' '}
            {formatBytes(totalSize)})
          </span>
        </h3>
        <div className="files-table-tools">
          <select
            className="sort-select"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            title="Lọc theo nhóm"
          >
            <option value="all">Nhóm: Tất cả ({groups.length})</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Tìm path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="size">Sort: Size desc</option>
            <option value="group">Sort: Nhóm</option>
            <option value="name">Sort: A-Z</option>
          </select>
        </div>
      </div>
      <div className="files-table">
        <div className="files-table-row files-table-header-row">
          <div className="ft-group">Nhóm</div>
          <div className="ft-path">Đường dẫn</div>
          <div className="ft-size">Size</div>
        </div>
        <div className="files-table-body">
          {filtered.length === 0 ? (
            <div className="files-table-empty muted small">
              {search ? `Không có file nào khớp "${search}"` : 'Không có file nào'}
            </div>
          ) : (
            <>
              {filtered.slice(0, RENDER_LIMIT).map((f, i) => (
                <div key={`${f.presetId}-${i}`} className="files-table-row">
                  <div className="ft-group" title={f.presetLabel}>
                    <span className="ft-group-icon">{f.presetIcon}</span>
                    <span className="ft-group-label">{f.presetLabel}</span>
                  </div>
                  <div className="ft-path" title={f.path}>
                    {f.path}
                  </div>
                  <div className="ft-size">{formatBytes(f.size)}</div>
                </div>
              ))}
              {filtered.length > RENDER_LIMIT && (
                <div className="files-table-row files-table-more muted small">
                  … {(filtered.length - RENDER_LIMIT).toLocaleString('vi-VN')} file
                  nữa không hiển thị (sort theo size desc — file lớn ở trên đầu)
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Summary card hiện sau khi phân tích Quick Clean.
 * Show: total size, donut chart breakdown, top groups.
 */
interface AnalysisSummaryProps {
  presets: CleanPreset[];
  analysis: Map<string, PresetAnalysis>;
  totalBytes: number;
  totalFiles: number;
}
function AnalysisSummary({
  presets,
  analysis,
  totalBytes,
  totalFiles,
}: AnalysisSummaryProps): JSX.Element {
  // Build segments: 1 per preset có data, sort desc by size
  const segments = presets
    .filter((p) => {
      const a = analysis.get(p.id);
      return a && a.fileCount > 0;
    })
    .map((p) => {
      const a = analysis.get(p.id)!;
      return { id: p.id, label: p.label, icon: p.icon, size: a.totalBytes, count: a.fileCount };
    })
    .sort((s1, s2) => s2.size - s1.size);

  // Donut chart pure CSS conic-gradient
  const PRESET_COLORS = [
    '#0891b2', '#06b6d4', '#22c55e', '#f59e0b', '#ec4899',
    '#8b5cf6', '#f43f5e', '#14b8a6', '#a855f7', '#3b82f6',
    '#ef4444', '#10b981', '#fbbf24', '#6366f1', '#84cc16',
  ];

  let offset = 0;
  const stops: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const color = PRESET_COLORS[i % PRESET_COLORS.length];
    const start = (offset / totalBytes) * 360;
    offset += seg.size;
    const end = (offset / totalBytes) * 360;
    stops.push(`${color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
  }
  const bg = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'var(--accent)';

  return (
    <section className="analysis-summary">
      <div className="summary-pie">
        <div className="cat-pie" style={{ width: 88, height: 88, background: bg }}>
          <div className="cat-pie-hole">
            <div className="cat-pie-total" style={{ fontSize: 11 }}>{formatBytes(totalBytes)}</div>
            <div className="cat-pie-sub muted">tổng</div>
          </div>
        </div>
      </div>
      <div className="summary-info">
        <div className="summary-headline">
          <strong>{totalFiles.toLocaleString('vi-VN')} file</strong> sẵn sàng dọn
          {' '}<span className="muted">·</span>{' '}
          <strong>{segments.length}</strong> nhóm cache
        </div>
        <div className="summary-bars">
          {segments.slice(0, 5).map((seg, i) => {
            const pct = (seg.size / totalBytes) * 100;
            const color = PRESET_COLORS[i % PRESET_COLORS.length];
            return (
              <div key={seg.id} className="summary-bar-row">
                <span className="summary-bar-label">
                  {seg.icon} {seg.label}
                </span>
                <div className="summary-bar-track">
                  <div
                    className="summary-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className="summary-bar-size">{formatBytes(seg.size)}</span>
                <span className="summary-bar-pct muted small">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
          {segments.length > 5 && (
            <div className="muted small" style={{ marginTop: 4 }}>
              + {segments.length - 5} nhóm nhỏ hơn
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Pie chart visualize phân bổ size theo category.
 * Pure CSS conic-gradient — không cần chart lib.
 */
const CATEGORY_COLOR: Record<CleanCategory, string> = {
  cache: '#6366f1',
  temp: '#8b5cf6',
  download: '#0ea5e9',
  duplicate: '#f43f5e',
  large: '#ea580c',
  old: '#a16207',
  empty_dir: '#64748b',
  recycle: '#14b8a6',
  other: '#6b7280',
};

interface CategoryPieProps {
  summary: ScanSummary;
  size?: number;
}
function CategoryPie({ summary, size = 110 }: CategoryPieProps): JSX.Element | null {
  const segments: { cat: CleanCategory; color: string; size: number }[] = [];
  for (const cat of CATEGORY_ORDER) {
    const s = summary.by_category[cat];
    if (!s || s.size_bytes === 0) continue;
    segments.push({ cat, color: CATEGORY_COLOR[cat], size: s.size_bytes });
  }
  if (segments.length === 0) return null;
  const total = segments.reduce((sum, s) => sum + s.size, 0);
  if (total === 0) return null;

  let offset = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = (offset / total) * 360;
    offset += seg.size;
    const end = (offset / total) * 360;
    stops.push(`${seg.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`);
  }
  const bg = `conic-gradient(${stops.join(', ')})`;

  return (
    <div className="cat-pie-wrap">
      <div
        className="cat-pie"
        style={{ width: size, height: size, background: bg }}
        title={`Phân bổ ${segments.length} category, tổng ${formatBytes(total)}`}
      >
        <div className="cat-pie-hole">
          <div className="cat-pie-total">{formatBytes(total)}</div>
          <div className="cat-pie-sub muted">tổng</div>
        </div>
      </div>
      <div className="cat-pie-legend">
        {segments.slice(0, 5).map((seg) => (
          <div key={seg.cat} className="cat-pie-legend-item">
            <span
              className="cat-pie-swatch"
              style={{ background: seg.color }}
              aria-hidden
            />
            <span className="cat-pie-legend-label">
              {CATEGORY_LABEL[seg.cat]}
            </span>
            <span className="cat-pie-legend-size muted">
              {((seg.size / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CatPillProps {
  label: string;
  count: number;
  size: number;
  active: boolean;
  onClick: () => void;
}
function CatPill({ label, count, size, active, onClick }: CatPillProps): JSX.Element {
  return (
    <button
      type="button"
      className={`cat-pill ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="cat-label">{label}</div>
      <div className="cat-count">
        {count.toLocaleString('vi-VN')} · {formatBytes(size)}
      </div>
    </button>
  );
}

interface FileRowProps {
  entry: FileEntry;
  nowMs: number;
  checked: boolean;
  onToggle: () => void;
}
function FileRow({ entry, nowMs, checked, onToggle }: FileRowProps): JSX.Element {
  const ageDays = Math.max(
    0,
    Math.floor((nowMs - entry.accessed_at_ms) / 86_400_000),
  );
  return (
    <div className={`row ${checked ? 'row-checked' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={entry.is_dir}
        className="row-check"
        title={entry.is_dir ? 'Folder không thể chọn' : 'Chọn để dọn'}
      />
      <div className="row-main">
        <div className="row-path" title={entry.path}>
          {entry.path}
        </div>
        <div className="row-meta">
          <span className={`tag tag-${entry.category}`}>
            {CATEGORY_LABEL[entry.category]}
          </span>
          <span className="muted small">
            {entry.is_dir ? 'thư mục' : `chưa mở ${ageDays} ngày`}
          </span>
        </div>
      </div>
      <div className="row-size">{formatBytes(entry.size_bytes)}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}
