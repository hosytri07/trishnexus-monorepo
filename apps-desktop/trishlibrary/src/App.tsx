/**
 * Phase 15.2.r9 — TrishLibrary v2 root component (3-col layout).
 *
 * Layout:
 *   - Topbar (full width) + UserPanel ngay topbar
 *   - 3-column body: sidebar (search + summary + folder tree + types)
 *     | main (filter info + table) | detail panel (inline edit khi click row)
 *   - Footer copyright
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  type FileType,
  type LibraryFile,
  type OnlineFolder,
  type OnlineLink,
  formatBytes,
  mergeScanResult,
  searchFiles,
} from './types.js';
import {
  exportLibraryJson,
  getDefaultStoreLocation,
  importLibraryJson,
  libraryFilenameForUid,
  loadLibrary,
  pickLibraryRoot,
  saveLibrary,
  scanLibraryRoot,
  getAppVersion,
  type StoreLocation,
} from './tauri-bridge.js';
import {
  loadSettings,
  saveSettings,
  applyTheme,
  type Settings,
} from './settings.js';
import { makeT } from './i18n/index.js';
import { SettingsModal } from './components/SettingsModal.js';
import { FileTable } from './components/FileTable.js';
import { DetailPanel } from './components/DetailPanel.js';
import { FolderTree } from './components/FolderTree.js';
import {
  OnlineLibrarySidebar,
  OnlineLibraryMain,
  OnlineFolderModal,
  OnlineLinkModal,
} from './components/OnlineLibrary.js';
import { OnlineLinkDetailPanel } from './components/OnlineLinkDetailPanel.js';
import { LibrarySearchModal } from './components/LibrarySearchModal.js';
import { LibraryDashboard, recordFileOpened } from './components/LibraryDashboard.js';
import { useAuth } from '@trishteam/auth/react';
import {
  loadOnlineFoldersFromFirestore,
  saveOnlineFoldersToFirestore,
  subscribeOnlineFolders,
  loadTrishteamLibraryFromFirestore,
  saveTrishteamLibraryToFirestore,
  subscribeTrishteamLibrary,
} from './lib/firestore-sync.js';
import logoUrl from './assets/logo.png';

type ViewMode = 'local' | 'online' | 'trishteam';

export function App(): JSX.Element {
  const { profile, isAdmin, isPaid } = useAuth();
  const uid = profile?.id ?? null;

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullTextSearchOpen, setFullTextSearchOpen] = useState(false);
  const tr = useMemo(() => makeT(settings.language), [settings.language]);
  const [version, setVersion] = useState('dev');

  const [files, setFiles] = useState<LibraryFile[]>([]);

  // Phase 18.4 — Mirror library files cho global Ctrl+K search.
  useEffect(() => {
    try {
      const minimal = files.map((f) => ({
        name: f.doc_title || f.file_name,
        rel_path: f.path,
        path: f.path,
      }));
      localStorage.setItem('trishlibrary.lib_files.cache.v1', JSON.stringify(minimal));
    } catch {
      /* skip — quota exceeded means too many files; degrade gracefully */
    }
  }, [files]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [, setLocation] = useState<StoreLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FileType | null>(null);

  const [selectedFile, setSelectedFile] = useState<LibraryFile | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);

  // Phase 15.2.r12/r13 — Online + TrishTEAM library state
  const [onlineFolders, setOnlineFolders] = useState<OnlineFolder[]>([]);
  const [trishteamFolders, setTrishteamFolders] = useState<OnlineFolder[]>([]);
  const [view, setView] = useState<ViewMode>('local');
  const [selectedOnlineFolderId, setSelectedOnlineFolderId] = useState<
    string | null
  >(null);
  const [editingFolder, setEditingFolder] = useState<OnlineFolder | null>(null);
  const [editingFolderScope, setEditingFolderScope] = useState<
    'online' | 'trishteam'
  >('online');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [editingLink, setEditingLink] = useState<OnlineLink | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  // Phase 16.2.d — Initial load PER-UID file (đơn lẻ, không chained).
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    setLoading(true);
    setFiles([]);
    setOnlineFolders([]);
    setTrishteamFolders([]);
    (async () => {
      try {
        const loc = await getDefaultStoreLocation();
        if (!alive) return;
        setLocation(loc);
        const result = await loadLibrary(libraryFilenameForUid(uid));
        if (!alive) return;
        setFiles(result.files);
        setOnlineFolders(result.online_folders);
        setTrishteamFolders(result.trishteam_folders);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  // Auto-rescan khi files rỗng + có sẵn library_root (effect độc lập).
  // Tách khỏi initial load để loading flag không bị stuck.
  useEffect(() => {
    if (
      loading ||
      !uid ||
      scanning ||
      files.length > 0 ||
      !settings.library_root.trim()
    ) {
      return;
    }
    let alive = true;
    void (async () => {
      setScanning(true);
      try {
        const summary = await scanLibraryRoot(settings.library_root);
        if (!alive) return;
        const merged = mergeScanResult([], summary.entries);
        setFiles(merged.merged);
      } catch (err) {
        console.warn('[trishlibrary] auto rescan fail', err);
      } finally {
        if (alive) setScanning(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, uid, files.length, settings.library_root]);

  // Phase 16.2.d — Auto-save 15s debounce (đỡ rối mắt). User có thể bấm
  // "Lưu thư viện" topbar để lưu ngay, hoặc đóng app sẽ trigger beforeunload.
  useEffect(() => {
    if (loading || !uid) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          setSavingFlash(true);
          await saveLibrary(
            files,
            onlineFolders,
            trishteamFolders,
            libraryFilenameForUid(uid),
          );
          // Show "đang lưu..." 1 giây rồi ẩn
          setTimeout(() => setSavingFlash(false), 1000);
        } catch (e) {
          setError(String(e));
          setSavingFlash(false);
        }
      })();
    }, 15000); // 15 giây
    return () => clearTimeout(t);
  }, [files, onlineFolders, trishteamFolders, loading, uid]);

  // Save trước khi đóng app — fire-and-forget
  useEffect(() => {
    if (!uid) return;
    const handler = (): void => {
      // Sync save bằng navigator.sendBeacon không khả thi với Tauri,
      // nhưng saveLibrary qua Rust tauri command vẫn fire ngay khi unmount.
      void saveLibrary(
        files,
        onlineFolders,
        trishteamFolders,
        libraryFilenameForUid(uid),
      ).catch(() => {});
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [files, onlineFolders, trishteamFolders, uid]);

  // Phase 16.2.b — Firestore sync per-user online_folders.
  // Chỉ sync nếu role >= user (paid). Trial user data ở local thôi.
  // Sync khi login: load Firestore → merge với local. Sau đó đẩy lên.
  useEffect(() => {
    if (!uid || !isPaid || loading) return;
    let cancelled = false;
    void (async () => {
      const cloud = await loadOnlineFoldersFromFirestore(uid);
      if (cancelled) return;
      if (cloud === null) {
        // First time: push local → cloud
        if (onlineFolders.length > 0) {
          await saveOnlineFoldersToFirestore(uid, onlineFolders);
        }
      } else {
        // Cloud có data: merge (cloud wins on conflict by updated_at)
        // Đơn giản: replace local với cloud
        setOnlineFolders(cloud);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isPaid, loading]);

  // Subscribe realtime online_folders
  useEffect(() => {
    if (!uid || !isPaid) return;
    const unsub = subscribeOnlineFolders(uid, (folders) => {
      setOnlineFolders((prev) => {
        // Avoid update loop: only set if data actually different
        if (JSON.stringify(prev) === JSON.stringify(folders)) return prev;
        return folders;
      });
    });
    return () => unsub();
  }, [uid, isPaid]);

  // Phase 16.2.b — Save online_folders → Firestore (debounced 800ms)
  useEffect(() => {
    if (!uid || !isPaid || loading) return;
    const t = setTimeout(() => {
      void saveOnlineFoldersToFirestore(uid, onlineFolders).catch((err) => {
        console.warn('[trishlibrary] auto-sync online_folders fail', err);
      });
    }, 800);
    return () => clearTimeout(t);
  }, [onlineFolders, uid, isPaid, loading]);

  // TrishTEAM library: load + subscribe (mọi paid user thấy admin curated)
  useEffect(() => {
    if (!isPaid) return;
    let cancelled = false;
    void loadTrishteamLibraryFromFirestore().then((folders) => {
      if (!cancelled) setTrishteamFolders(folders);
    });
    const unsub = subscribeTrishteamLibrary((folders) => {
      setTrishteamFolders(folders);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [isPaid]);

  // Phase 16.2.d — KHÔNG auto-save trishteam_library (admin).
  // Auto-save bị race condition: khi admin login, state init = [] và effect
  // fire trước khi load Firestore xong → save [] đè data thật → user mất hết.
  // Thay vào đó: save explicit trong handleSaveFolder/handleDeleteFolder/etc
  // khi scope === 'trishteam' (xem các handlers bên dưới).

  // Keep selectedFile in sync khi files đổi (after save/delete)
  useEffect(() => {
    if (!selectedFile) return;
    const fresh = files.find((f) => f.path === selectedFile.path);
    if (!fresh) {
      // File bị xóa → đóng panel
      setSelectedFile(null);
    } else if (fresh !== selectedFile) {
      // Update reference
      setSelectedFile(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = files;
    if (search.trim()) list = searchFiles(list, search);
    if (folderFilter !== null) {
      // folderFilter '' = root files only (no subfolder)
      // folderFilter 'TCVN' = files trong 'TCVN' + descendants 'TCVN/*'
      if (folderFilter === '') {
        list = list.filter((f) => (f.folder.trim() || '') === '');
      } else {
        list = list.filter(
          (f) =>
            f.folder === folderFilter ||
            f.folder.startsWith(folderFilter + '/'),
        );
      }
    }
    if (typeFilter !== null) {
      list = list.filter((f) => f.file_type === typeFilter);
    }
    return list;
  }, [files, search, folderFilter, typeFilter]);

  const totalLinks = useMemo(
    () => files.reduce((sum, f) => sum + f.links.length, 0),
    [files],
  );
  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size_bytes, 0),
    [files],
  );

  const typeCounts = useMemo(() => {
    const map = new Map<FileType, number>();
    for (const f of files) {
      map.set(f.file_type, (map.get(f.file_type) ?? 0) + 1);
    }
    return map;
  }, [files]);

  // ========================================================
  // Scan handlers
  // ========================================================

  async function performScan(root: string): Promise<void> {
    setScanning(true);
    setError(null);
    try {
      const summary = await scanLibraryRoot(root);
      const { merged, stats } = mergeScanResult(files, summary.entries);
      setFiles(merged);
      const missingPart =
        stats.missing > 0
          ? tr('banner.scan_missing', { n: stats.missing })
          : '';
      const truncatedPart = summary.max_entries_reached
        ? tr('banner.scan_truncated')
        : '';
      setInfo(
        tr('banner.scanned', {
          total: stats.total,
          ms: summary.elapsed_ms,
          added: stats.added,
          updated: stats.updated,
          missing: missingPart,
        }) + truncatedPart,
      );
      setTimeout(() => setInfo(null), 6000);
    } catch (e) {
      const msg = String(e);
      setError(tr('banner.scan_fail', { err: msg }));
    } finally {
      setScanning(false);
    }
  }

  async function handlePickRoot(): Promise<void> {
    const picked = await pickLibraryRoot();
    if (!picked) return;
    const newSettings = { ...settings, library_root: picked };
    setSettings(newSettings);
    saveSettings(newSettings);
    await performScan(picked);
  }

  /** Phase 18.6.e — Mở thư mục từ đường dẫn LAN/UNC nhập tay */
  async function handlePickRootFromPath(): Promise<void> {
    const input = window.prompt(
      'Nhập đường dẫn thư mục thư viện (hỗ trợ UNC mạng LAN, ví dụ: \\\\\\\\server\\\\share\\\\library):',
      '\\\\\\\\',
    );
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      const exists = await invoke<boolean>('check_folder_exists', { path: trimmed });
      if (!exists) {
        window.alert('⚠ Không truy cập được thư mục: ' + trimmed);
        return;
      }
    } catch {
      // ignore — fall through and let scan fail with a real error
    }
    const newSettings = { ...settings, library_root: trimmed };
    setSettings(newSettings);
    saveSettings(newSettings);
    await performScan(trimmed);
  }

  async function handleRescan(): Promise<void> {
    if (!settings.library_root) {
      void handlePickRoot();
      return;
    }
    await performScan(settings.library_root);
  }

  async function handleSaveLibrary(): Promise<void> {
    if (!uid) return;
    try {
      await saveLibrary(
        files,
        onlineFolders,
        trishteamFolders,
        libraryFilenameForUid(uid),
      );
      setInfo(tr('banner.saved', { n: files.length }));
      setTimeout(() => setInfo(null), 3000);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleRenameLibrary(next: string): void {
    const trimmed = next.trim().slice(0, 100);
    if (!trimmed) return;
    const newSettings = { ...settings, library_name: trimmed };
    setSettings(newSettings);
    saveSettings(newSettings);
  }

  function handleResetLibrary(): void {
    const ok = confirm(
      tr('sidebar.library_reset_confirm', { name: settings.library_name }),
    );
    if (!ok) return;
    const newSettings = { ...settings, library_root: '' };
    setSettings(newSettings);
    saveSettings(newSettings);
    setFiles([]);
    setSelectedFile(null);
    setFolderFilter(null);
    setTypeFilter(null);
  }

  // ========================================================
  // CRUD
  // ========================================================

  function handleSaveFile(file: LibraryFile): void {
    setFiles((prev) => prev.map((f) => (f.path === file.path ? file : f)));
  }

  function handleDeleteFile(file: LibraryFile): void {
    setFiles((prev) => prev.filter((f) => f.path !== file.path));
    setSelectedFile(null);
  }

  function handleQuickDelete(file: LibraryFile): void {
    const ok = confirm(
      tr('form.confirm_delete', { name: file.doc_title || file.file_name }),
    );
    if (ok) handleDeleteFile(file);
  }

  async function handleImport(): Promise<void> {
    try {
      const imported = await importLibraryJson();
      if (!imported) return;
      setFiles((prev) => {
        const byPath = new Map(prev.map((f) => [f.path, f] as const));
        for (const f of imported.files) byPath.set(f.path, f);
        return [...byPath.values()];
      });
      setOnlineFolders((prev) => {
        const byId = new Map(prev.map((f) => [f.id, f] as const));
        for (const f of imported.online_folders) byId.set(f.id, f);
        return [...byId.values()];
      });
      setTrishteamFolders((prev) => {
        const byId = new Map(prev.map((f) => [f.id, f] as const));
        for (const f of imported.trishteam_folders) byId.set(f.id, f);
        return [...byId.values()];
      });
      setInfo(
        tr('banner.imported', {
          n:
            imported.files.length +
            imported.online_folders.length +
            imported.trishteam_folders.length,
        }),
      );
      setTimeout(() => setInfo(null), 4000);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const result = await exportLibraryJson(
        files,
        onlineFolders,
        trishteamFolders,
      );
      if (result) {
        setInfo(tr('banner.exported', { path: result.path }));
        setTimeout(() => setInfo(null), 4000);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  // ========================================================
  // Online library CRUD
  // ========================================================

  /** Lấy setter cho scope hiện tại (online vs trishteam). */
  function scopeSetter(scope: 'online' | 'trishteam') {
    return scope === 'online' ? setOnlineFolders : setTrishteamFolders;
  }
  function scopeFolders(scope: 'online' | 'trishteam'): OnlineFolder[] {
    return scope === 'online' ? onlineFolders : trishteamFolders;
  }
  /** Scope hiện tại theo view + folder đã chọn. */
  const currentScope: 'online' | 'trishteam' =
    view === 'trishteam' ? 'trishteam' : 'online';

  function handleSaveFolder(folder: OnlineFolder): void {
    const scope = editingFolderScope;
    const set = scopeSetter(scope);
    set((prev) => {
      const idx = prev.findIndex((f) => f.id === folder.id);
      const next =
        idx >= 0
          ? prev.map((f, i) => (i === idx ? folder : f))
          : [...prev, folder];
      // Phase 16.2.d — Save explicit cho TrishTEAM library (admin only)
      if (scope === 'trishteam' && isAdmin) {
        void saveTrishteamLibraryToFirestore(next).catch((err) => {
          console.warn('[trishlibrary] save trishteam fail', err);
          setError('Lỗi save TrishTEAM library: ' + String(err));
        });
      }
      return next;
    });
    setEditingFolder(null);
    setShowAddFolder(false);
  }

  function handleDeleteFolder(folder: OnlineFolder): void {
    const scope = editingFolderScope;
    const set = scopeSetter(scope);
    set((prev) => {
      const next = prev.filter((f) => f.id !== folder.id);
      if (scope === 'trishteam' && isAdmin) {
        void saveTrishteamLibraryToFirestore(next).catch((err) => {
          console.warn('[trishlibrary] save trishteam fail', err);
        });
      }
      return next;
    });
    setEditingFolder(null);
    if (selectedOnlineFolderId === folder.id) {
      setSelectedOnlineFolderId(null);
      setView('local');
    }
  }

  function handleSaveLink(link: OnlineLink): void {
    if (!selectedOnlineFolderId) return;
    const scope = currentScope;
    const set = scopeSetter(scope);
    set((prev) => {
      const next = prev.map((f) => {
        if (f.id !== selectedOnlineFolderId) return f;
        const idx = f.links.findIndex((l) => l.id === link.id);
        const links =
          idx >= 0
            ? f.links.map((l) => (l.id === link.id ? link : l))
            : [...f.links, link];
        return { ...f, links, updated_at: Date.now() };
      });
      if (scope === 'trishteam' && isAdmin) {
        void saveTrishteamLibraryToFirestore(next).catch((err) => {
          console.warn('[trishlibrary] save trishteam fail', err);
        });
      }
      return next;
    });
    setEditingLink(null);
    setShowAddLink(false);
  }

  function handleDeleteLink(link: OnlineLink): void {
    if (!selectedOnlineFolderId) return;
    const scope = currentScope;
    const set = scopeSetter(scope);
    set((prev) => {
      const next = prev.map((f) => {
        if (f.id !== selectedOnlineFolderId) return f;
        return {
          ...f,
          links: f.links.filter((l) => l.id !== link.id),
          updated_at: Date.now(),
        };
      });
      if (scope === 'trishteam' && isAdmin) {
        void saveTrishteamLibraryToFirestore(next).catch((err) => {
          console.warn('[trishlibrary] save trishteam fail', err);
        });
      }
      return next;
    });
    setEditingLink(null);
  }

  function handleQuickDeleteLink(link: OnlineLink): void {
    const ok = confirm(
      tr('online.link.delete_confirm', { title: link.title || link.url }),
    );
    if (ok) handleDeleteLink(link);
  }

  const hasRoot = !!settings.library_root.trim();

  return (
    <div className="app">
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
            <div className="brand-title">TrishLibrary</div>
            <div className="brand-sub">{tr('topbar.tagline')}</div>
          </div>
        </div>

        <div className="spacer" />

        {hasRoot ? (
          <>
            <button
              className="btn btn-primary"
              onClick={() => void handleRescan()}
              disabled={scanning}
            >
              {scanning ? tr('topbar.scanning') : tr('topbar.rescan')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void handlePickRoot()}
              disabled={scanning}
            >
              {tr('topbar.change_root')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void handlePickRootFromPath()}
              disabled={scanning}
              title="Nhập đường dẫn (LAN / UNC)"
            >
              🌐
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={() => void handlePickRoot()}
              disabled={scanning}
            >
              {scanning ? tr('topbar.scanning') : tr('topbar.pick_root')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => void handlePickRootFromPath()}
              disabled={scanning}
              title="Nhập đường dẫn (LAN / UNC)"
            >
              🌐
            </button>
          </>
        )}

        <button
          className="btn btn-ghost"
          onClick={() => void handleSaveLibrary()}
          title={tr('topbar.save_lib_tooltip')}
        >
          {tr('topbar.save_lib')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => setFullTextSearchOpen(true)}
          title="Tìm trong nội dung file (PDF/TXT/MD) qua Tantivy"
          disabled={files.length === 0}
        >
          🔎 Tìm nội dung
        </button>
        <button className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
          {tr('topbar.settings')}
        </button>

        <span className="muted small version-badge">v{version}</span>
      </header>

      {hasRoot && (
        <div className="path-bar" title={settings.library_root}>
          <span className="path-bar-label">{tr('topbar.root_label')}</span>
          <code className="path-bar-code">{settings.library_root}</code>
        </div>
      )}

      <div className="layout layout-3col">
        <aside className="sidebar">
          <section className="side-block">
            <div className="side-label">{tr('sidebar.search.label')}</div>
            <input
              className="input"
              type="search"
              placeholder={tr('sidebar.search.placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </section>

          <section className="side-block">
            <div className="side-label">{tr('sidebar.summary')}</div>
            <div className="stat-row">
              <span>{tr('sidebar.total_files')}</span>
              <strong>{files.length}</strong>
            </div>
            <div className="stat-row">
              <span>{tr('sidebar.total_links')}</span>
              <strong>{totalLinks}</strong>
            </div>
            <div className="stat-row">
              <span>{tr('sidebar.total_size')}</span>
              <strong>{formatBytes(totalSize)}</strong>
            </div>
          </section>

          <section className="side-block">
            <div className="side-label">{tr('sidebar.folders')}</div>
            <p className="side-hint muted small">{tr('sidebar.personal_hint')}</p>
            <FolderTree
              files={files}
              selectedFolder={folderFilter}
              libraryName={settings.library_name}
              hasRoot={hasRoot}
              trKey={tr}
              onSelectFolder={(folder) => {
                setView('local');
                setFolderFilter(folder);
              }}
              onRenameLibrary={handleRenameLibrary}
              onResetLibrary={handleResetLibrary}
            />
          </section>

          {/* Online Library — của user */}
          <OnlineLibrarySidebar
            folders={onlineFolders}
            selectedFolderId={view === 'online' ? selectedOnlineFolderId : null}
            trKey={tr}
            label={tr('online.label')}
            hint={tr('sidebar.online_hint')}
            onSelectFolder={(id) => {
              setView('online');
              setSelectedOnlineFolderId(id);
              setSelectedFile(null);
            }}
            onAddFolder={() => {
              setEditingFolderScope('online');
              setShowAddFolder(true);
            }}
            onEditFolder={(folder) => {
              setEditingFolderScope('online');
              setEditingFolder(folder);
            }}
          />

          {/* TrishTEAM Library — admin curated, user read-only */}
          <OnlineLibrarySidebar
            folders={trishteamFolders}
            selectedFolderId={
              view === 'trishteam' ? selectedOnlineFolderId : null
            }
            trKey={tr}
            label={tr('team.label')}
            hint={isAdmin ? tr('team.hint_admin') : tr('team.hint')}
            readOnly={!isAdmin}
            onSelectFolder={(id) => {
              setView('trishteam');
              setSelectedOnlineFolderId(id);
              setSelectedFile(null);
            }}
            onAddFolder={() => {
              setEditingFolderScope('trishteam');
              setShowAddFolder(true);
            }}
            onEditFolder={(folder) => {
              setEditingFolderScope('trishteam');
              setEditingFolder(folder);
            }}
          />

          {typeCounts.size > 0 && (
            <section className="side-block">
              <div className="side-label">{tr('sidebar.file_types')}</div>
              <div className="pill-row">
                <button
                  className={'pill ' + (typeFilter === null ? 'active' : '')}
                  onClick={() => setTypeFilter(null)}
                >
                  {tr('sidebar.all')}
                </button>
                {Array.from(typeCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <button
                      key={type}
                      className={'pill ' + (typeFilter === type ? 'active' : '')}
                      onClick={() => setTypeFilter(type)}
                    >
                      {tr(`type.${type}`)}
                      <span className="pill-count">{count}</span>
                    </button>
                  ))}
              </div>
            </section>
          )}
        </aside>

        <main className="content">
          {error && (
            <div className="banner error" onClick={() => setError(null)}>
              ⚠ {error} — {tr('banner.error.dismiss')}
            </div>
          )}
          {info && !error && (
            <div className="banner info" onClick={() => setInfo(null)}>
              {info}
            </div>
          )}

          {(view === 'online' || view === 'trishteam') &&
          selectedOnlineFolderId ? (
            (() => {
              const folder = scopeFolders(currentScope).find(
                (f) => f.id === selectedOnlineFolderId,
              );
              if (!folder) {
                return (
                  <div className="empty">
                    <p>Folder không tồn tại.</p>
                  </div>
                );
              }
              const isReadOnlyView = view === 'trishteam' && !isAdmin;
              return (
                <OnlineLibraryMain
                  folder={folder}
                  trKey={tr}
                  selectedLinkId={editingLink?.id ?? null}
                  readOnly={isReadOnlyView}
                  onAddLink={() => setShowAddLink(true)}
                  onEditLink={(link) => setEditingLink(link)}
                  onDeleteLink={handleQuickDeleteLink}
                />
              );
            })()
          ) : !hasRoot && files.length === 0 ? (
            <div className="empty empty-large">
              <p>{tr('table.empty_no_root')}</p>
              <button
                className="btn btn-primary"
                onClick={() => void handlePickRoot()}
                disabled={scanning}
              >
                {scanning ? tr('topbar.scanning') : tr('topbar.pick_root')}
              </button>
            </div>
          ) : (
            <>
              <LibraryDashboard
                files={files}
                tr={tr}
                onOpenFile={(f) => {
                  recordFileOpened(f.path, uid);
                  setSelectedFile(f);
                }}
              />

              <div className="content-toolbar">
                <div className="result-count">
                  {tr('content.showing', {
                    n: filtered.length,
                    total: files.length,
                  })}
                </div>
                <div className="spacer" />
              </div>

              {filtered.length === 0 ? (
                <div className="empty">
                  <p>
                    {scanning
                      ? '… Đang quét, chờ chút …'
                      : files.length === 0
                        ? tr('table.empty_scanned')
                        : tr('table.empty_filtered')}
                  </p>
                </div>
              ) : (
                <FileTable
                  files={filtered}
                  trKey={tr}
                  selectedPath={selectedFile?.path ?? null}
                  onEdit={(f) => {
                    recordFileOpened(f.path, uid);
                    setSelectedFile(f);
                  }}
                  onDelete={handleQuickDelete}
                />
              )}
            </>
          )}
        </main>

        {view === 'local' ? (
          <DetailPanel
            file={selectedFile}
            trKey={tr}
            onSave={handleSaveFile}
            onDelete={handleDeleteFile}
            onClose={() => setSelectedFile(null)}
          />
        ) : (
          <OnlineLinkDetailPanel
            link={editingLink}
            folder={
              scopeFolders(currentScope).find(
                (f) => f.id === selectedOnlineFolderId,
              ) ?? null
            }
            trKey={tr}
            readOnly={view === 'trishteam' && !isAdmin}
            onSave={handleSaveLink}
            onDelete={handleDeleteLink}
            onClose={() => setEditingLink(null)}
          />
        )}
      </div>

      <footer className="foot">
        <span>{tr('footer.copyright')}</span>
        {savingFlash && (
          <span className="foot-saving"> · ⟳ {tr('topbar.saving')}</span>
        )}
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
          onImportLibrary={() => void handleImport()}
          onExportLibrary={() => void handleExport()}
        />
      )}

      {fullTextSearchOpen && (
        <LibrarySearchModal
          allPaths={files.map((f) => f.path)}
          tr={tr}
          onClose={() => setFullTextSearchOpen(false)}
          onOpenFile={(p) => {
            void invoke('open_local_path', { path: p }).catch(() => {});
          }}
        />
      )}

      {(showAddFolder || editingFolder) && (
        <OnlineFolderModal
          folder={editingFolder}
          allFolders={scopeFolders(editingFolderScope)}
          trKey={tr}
          onSave={handleSaveFolder}
          onDelete={handleDeleteFolder}
          onClose={() => {
            setShowAddFolder(false);
            setEditingFolder(null);
          }}
        />
      )}

      {/* Modal chỉ dùng cho "+ Thêm link" mới. Click row → DetailPanel right. */}
      {showAddLink && selectedOnlineFolderId && (
        <OnlineLinkModal
          link={null}
          folder={
            scopeFolders(currentScope).find(
              (f) => f.id === selectedOnlineFolderId,
            ) ?? {
              id: '',
              name: '',
              icon: '',
              links: [],
              created_at: 0,
              updated_at: 0,
            }
          }
          trKey={tr}
          onSave={handleSaveLink}
          onDelete={handleDeleteLink}
          onClose={() => setShowAddLink(false)}
        />
      )}
    </div>
  );
}
