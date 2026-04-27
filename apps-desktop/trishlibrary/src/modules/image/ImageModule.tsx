/**
 * Phase 18.6.a — Module Ảnh full implementation.
 *
 * Layout: 3-col
 *   LEFT  — folder list (manageable, persist localStorage)
 *   CENTER — image grid với 5 view modes (xl/lg/md/sm/list)
 *   RIGHT — detail panel (preview lớn + meta + actions)
 *
 * Backend gọi qua list_image_files (Rust) + asset protocol cho preview.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ImageFolder,
  ImageFile,
  ImageStore,
  ImageViewMode,
} from './types.js';
import {
  loadImageStore,
  saveImageStore,
  pickImageFolder,
  listImageFiles,
  imageSrcUrl,
  openImageInOS,
  formatFileSize,
  getThumbnail,
  preloadThumbnails,
  type PreloadHandle,
  checkFolderExists,
  exportImageWithNewName,
  readImageExif,
  type ExifData,
} from './tauri-bridge.js';
import { requestCreateNoteAbout } from '../../lib/module-bus.js';
import { BatchRenameModal } from './BatchRenameModal.js';
import { ImageLightbox } from './ImageLightbox.js';
import { useAuth } from '@trishteam/auth/react';

function escapeForHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Props {
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

export function ImageModule({ tr }: Props): JSX.Element {
  const { profile } = useAuth();
  const uid = profile?.id ?? null;
  const [store, setStoreState] = useState<ImageStore>(() => loadImageStore(uid));

  // Phase 18.5.b — Re-load store khi user đổi (login/logout/switch)
  useEffect(() => {
    setStoreState(loadImageStore(uid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterKind, setFilterKind] = useState<'all' | 'image' | 'video'>('all');
  const [preload, setPreload] = useState<{
    done: number;
    total: number;
    currentName: string;
    active: boolean;
  }>({ done: 0, total: 0, currentName: '', active: false });
  const preloadHandleRef = useRef<PreloadHandle | null>(null);

  // Phase 18.6.f — Bulk selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [showBatchRename, setShowBatchRename] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  function toggleSelectionMode(): void {
    setSelectionMode((v) => {
      if (v) setSelectedPaths(new Set()); // clear when exit
      return !v;
    });
  }

  function toggleSelected(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAll(): void {
    setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
  }

  function clearSelection(): void {
    setSelectedPaths(new Set());
  }

  function applyBatchRename(newDisplayNames: Record<string, string>): void {
    setStore((s) => ({
      ...s,
      display_names: { ...s.display_names, ...newDisplayNames },
    }));
  }

  // Phase 18.6.g — Keyboard navigation in grid/list
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Skip if typing in an input/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      if (
        t?.tagName === 'INPUT' ||
        t?.tagName === 'TEXTAREA' ||
        t?.isContentEditable === true
      ) {
        return;
      }
      // Skip modifiers (Ctrl/Cmd handled elsewhere)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (filteredFiles.length === 0) return;

      const isNav =
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.key === 'PageUp' ||
        e.key === 'PageDown';
      const isAction = e.key === 'Enter' || e.key === ' ';
      if (!isNav && !isAction) return;
      e.preventDefault();

      // Find current index
      const curIdx = selectedPath
        ? filteredFiles.findIndex((f) => f.path === selectedPath)
        : -1;

      if (isAction) {
        const file = filteredFiles[curIdx >= 0 ? curIdx : 0];
        if (!file) return;
        if (e.key === ' ' && selectionMode) {
          toggleSelected(file.path);
        } else if (e.key === 'Enter') {
          // Open lightbox at current index instead of OS app
          const i = curIdx >= 0 ? curIdx : 0;
          if (lightboxIdx === null) setLightboxIdx(i);
        } else if (e.key === ' ') {
          // Space outside selection mode → just preview (already selected)
        }
        return;
      }

      // Navigation
      let nextIdx = curIdx < 0 ? 0 : curIdx;
      // Compute grid columns by inspecting DOM (only for grid modes)
      const cols = computeGridColumns();

      switch (e.key) {
        case 'ArrowLeft':
          nextIdx = Math.max(0, nextIdx - 1);
          break;
        case 'ArrowRight':
          nextIdx = Math.min(filteredFiles.length - 1, nextIdx + 1);
          break;
        case 'ArrowUp':
          nextIdx = Math.max(0, nextIdx - cols);
          break;
        case 'ArrowDown':
          nextIdx = Math.min(filteredFiles.length - 1, nextIdx + cols);
          break;
        case 'PageUp':
          nextIdx = Math.max(0, nextIdx - cols * 3);
          break;
        case 'PageDown':
          nextIdx = Math.min(filteredFiles.length - 1, nextIdx + cols * 3);
          break;
        case 'Home':
          nextIdx = 0;
          break;
        case 'End':
          nextIdx = filteredFiles.length - 1;
          break;
      }
      const nextFile = filteredFiles[nextIdx];
      if (nextFile) {
        setSelectedPath(nextFile.path);
        // Scroll into view
        window.requestAnimationFrame(() => {
          const grid = document.querySelector('.image-grid, .image-list-table tbody');
          if (!grid) return;
          const tile = grid.children[nextIdx] as HTMLElement | undefined;
          tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /**
   * Compute current visible columns of the image grid.
   * Returns 1 for list mode or when no grid is mounted.
   */
  function computeGridColumns(): number {
    if (store.view_mode === 'list') return 1;
    const grid = document.querySelector('.image-grid') as HTMLElement | null;
    if (!grid) return 4; // fallback
    const style = window.getComputedStyle(grid);
    const cols = style.gridTemplateColumns.split(' ').filter(Boolean).length;
    return Math.max(1, cols);
  }

  // Persist mỗi khi store thay đổi (per-UID)
  useEffect(() => {
    saveImageStore(store, uid);
  }, [store, uid]);

  // Phase 18.4 — Consume pending_select / pending_folder từ global search
  useEffect(() => {
    function checkPending(): void {
      try {
        const folderHint = window.localStorage.getItem(
          'trishlibrary.image.pending_folder',
        );
        if (folderHint) {
          window.localStorage.removeItem('trishlibrary.image.pending_folder');
          setStoreState((s) => ({ ...s, active_folder_id: folderHint }));
        }
        const pathHint = window.localStorage.getItem(
          'trishlibrary.image.pending_select',
        );
        if (pathHint) {
          window.localStorage.removeItem('trishlibrary.image.pending_select');
          setSelectedPath(pathHint);
        }
      } catch {
        /* ignore */
      }
    }
    checkPending();
    const onFocus = (): void => checkPending();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const setStore = (next: ImageStore | ((prev: ImageStore) => ImageStore)): void => {
    setStoreState((prev) => (typeof next === 'function' ? next(prev) : next));
  };

  const activeFolder: ImageFolder | null = useMemo(() => {
    if (!store.active_folder_id) return null;
    return store.folders.find((f) => f.id === store.active_folder_id) ?? null;
  }, [store]);

  // Cancel any in-flight preload
  function cancelPreload(): void {
    if (preloadHandleRef.current) {
      preloadHandleRef.current.cancel();
      preloadHandleRef.current = null;
    }
  }

  // Map view mode → thumb size cho preload (match grid)
  const preloadSizeForMode: Record<ImageViewMode, number> = {
    xl: 320,
    lg: 256,
    md: 200,
    sm: 144,
    list: 200,
  };

  // Load files khi đổi folder hoặc đổi recursive
  useEffect(() => {
    cancelPreload();
    if (!activeFolder) {
      setFiles([]);
      setPreload({ done: 0, total: 0, currentName: '', active: false });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    setPreload({ done: 0, total: 0, currentName: '', active: false });

    listImageFiles(activeFolder.path, store.recursive)
      .then((list) => {
        if (cancelled) return;
        setFiles(list);
        if (list.length > 0) setSelectedPath((prev) => prev ?? list[0].path);

        // Start preloading thumbnails for all images (skip videos)
        const imgPaths = list.filter((f) => !f.is_video).map((f) => f.path);
        if (imgPaths.length === 0) return;
        const target = preloadSizeForMode[store.view_mode];
        setPreload({
          done: 0,
          total: imgPaths.length,
          currentName: '',
          active: true,
        });
        const handle = preloadThumbnails(imgPaths, target, (done, total, name) => {
          if (cancelled) return;
          setPreload({
            done,
            total,
            currentName: name,
            active: done < total,
          });
        });
        preloadHandleRef.current = handle;
        handle.promise.finally(() => {
          if (cancelled) return;
          setPreload((p) => ({ ...p, active: false }));
          preloadHandleRef.current = null;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(String(err));
        setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return (): void => {
      cancelled = true;
      cancelPreload();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder, store.recursive]);

  // Cancel preload on unmount
  useEffect(() => {
    return (): void => cancelPreload();
  }, []);

  async function handleAddFolder(): Promise<void> {
    const picked = await pickImageFolder();
    if (!picked) return;
    if (store.folders.some((f) => f.path === picked)) {
      const existing = store.folders.find((f) => f.path === picked);
      if (existing) setStore((s) => ({ ...s, active_folder_id: existing.id }));
      return;
    }
    const id = `folder-${Date.now()}`;
    const name = picked.split(/[\\/]/).filter(Boolean).pop() ?? picked;
    const folder: ImageFolder = {
      id,
      name,
      path: picked,
      added_ms: Date.now(),
      recursive: false,
    };
    setStore((s) => ({
      ...s,
      folders: [...s.folders, folder],
      active_folder_id: id,
    }));
  }

  function handleRemoveFolder(id: string): void {
    if (!window.confirm(tr('image.confirm_remove_folder'))) return;
    setStore((s) => ({
      ...s,
      folders: s.folders.filter((f) => f.id !== id),
      active_folder_id: s.active_folder_id === id ? null : s.active_folder_id,
    }));
  }

  function handleSelectFolder(id: string): void {
    setStore((s) => ({ ...s, active_folder_id: id }));
    setSelectedPath(null);
  }

  function handleViewMode(v: ImageViewMode): void {
    setStore((s) => ({ ...s, view_mode: v }));
  }

  function toggleRecursive(): void {
    setStore((s) => ({ ...s, recursive: !s.recursive }));
  }

  async function handleRefresh(): Promise<void> {
    if (!activeFolder) return;
    cancelPreload();
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await listImageFiles(activeFolder.path, store.recursive);
      setFiles(list);
      const imgPaths = list.filter((f) => !f.is_video).map((f) => f.path);
      if (imgPaths.length > 0) {
        const target = preloadSizeForMode[store.view_mode];
        setPreload({
          done: 0,
          total: imgPaths.length,
          currentName: '',
          active: true,
        });
        const handle = preloadThumbnails(imgPaths, target, (done, total, name) => {
          setPreload({
            done,
            total,
            currentName: name,
            active: done < total,
          });
        });
        preloadHandleRef.current = handle;
        handle.promise.finally(() => {
          setPreload((p) => ({ ...p, active: false }));
          preloadHandleRef.current = null;
        });
      }
    } catch (err) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCancelPreload(): void {
    cancelPreload();
    setPreload((p) => ({ ...p, active: false }));
  }

  // Apply filters — search match cả tên file và ghi chú đã lưu
  const filteredFiles = useMemo(() => {
    let arr = files;
    if (filterKind === 'image') arr = arr.filter((f) => !f.is_video);
    else if (filterKind === 'video') arr = arr.filter((f) => f.is_video);
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      arr = arr.filter((f) => {
        if (f.name.toLowerCase().includes(q)) return true;
        const display = (store.display_names[f.path] ?? '').toLowerCase();
        if (display.includes(q)) return true;
        const note = (store.notes[f.path] ?? '').toLowerCase();
        return note.includes(q);
      });
    }
    return arr;
  }, [files, filterKind, filterText, store.notes, store.display_names]);

  function handleSaveImageNote(path: string, note: string): void {
    setStore((s) => {
      const next = { ...s.notes };
      if (note.trim().length === 0) delete next[path];
      else next[path] = note;
      return { ...s, notes: next };
    });
  }

  function handleRenameImage(path: string, newName: string): void {
    setStore((s) => {
      const next = { ...s.display_names };
      const trimmed = newName.trim();
      if (!trimmed) {
        delete next[path];
      } else {
        next[path] = trimmed;
      }
      return { ...s, display_names: next };
    });
  }

  /** Hiển thị tên: ưu tiên display_name nếu có, fallback file name */
  function displayNameOf(file: ImageFile): string {
    return store.display_names[file.path] ?? file.name;
  }

  async function handleExportImage(file: ImageFile): Promise<void> {
    const desired = displayNameOf(file);
    const note = store.notes[file.path] ?? '';
    try {
      const result = await exportImageWithNewName(file.path, desired, file.ext, note);
      if (!result) return;
      const noteMsg = result.noteWritten ? ' + ghi chú' : '';
      setErrorMsg(null);
      window.alert(`✓ Đã xuất: ${result.path}${noteMsg}`);
    } catch (err) {
      window.alert(`⚠ Xuất thất bại: ${String(err)}`);
    }
  }

  /** Phase 18.6.e — Thêm folder qua nhập path text (LAN/UNC) */
  async function handleAddFolderFromPath(): Promise<void> {
    const input = window.prompt(
      'Nhập đường dẫn thư mục (hỗ trợ UNC mạng LAN, ví dụ: \\\\\\\\server\\\\share\\\\photos):',
      '\\\\\\\\',
    );
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const exists = await checkFolderExists(trimmed);
    if (!exists) {
      window.alert('⚠ Không truy cập được thư mục: ' + trimmed);
      return;
    }
    if (store.folders.some((f) => f.path === trimmed)) {
      const existing = store.folders.find((f) => f.path === trimmed);
      if (existing) setStore((s) => ({ ...s, active_folder_id: existing.id }));
      return;
    }
    const id = `folder-${Date.now()}`;
    const name = trimmed.split(/[\\/]/).filter(Boolean).pop() ?? trimmed;
    setStore((s) => ({
      ...s,
      folders: [
        ...s.folders,
        { id, name, path: trimmed, added_ms: Date.now(), recursive: false },
      ],
      active_folder_id: id,
    }));
  }

  const selectedFile: ImageFile | null = useMemo(() => {
    if (!selectedPath) return null;
    return filteredFiles.find((f) => f.path === selectedPath) ?? null;
  }, [selectedPath, filteredFiles]);

  const imageCount = files.filter((f) => !f.is_video).length;
  const videoCount = files.filter((f) => f.is_video).length;

  return (
    <div className="image-module">
      {/* LEFT — Folder sidebar */}
      <aside className="image-sidebar">
        <div className="image-sidebar-head">
          <h3>📁 {tr('image.folders')}</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleAddFolder()}
              title={tr('image.add_folder')}
            >
              + {tr('image.add')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void handleAddFolderFromPath()}
              title="Thêm từ đường dẫn (mạng LAN, UNC)"
            >
              🌐
            </button>
          </div>
        </div>
        <div className="image-folder-list">
          {store.folders.length === 0 ? (
            <div className="image-empty muted small">
              {tr('image.no_folders')}
              <br />
              <button className="btn btn-ghost btn-sm" onClick={() => void handleAddFolder()}>
                + {tr('image.add_folder')}
              </button>
            </div>
          ) : (
            store.folders.map((f) => (
              <div
                key={f.id}
                className={`image-folder-item ${
                  store.active_folder_id === f.id ? 'active' : ''
                }`}
                onClick={() => handleSelectFolder(f.id)}
              >
                <span className="image-folder-icon">📂</span>
                <div className="image-folder-info">
                  <strong className="image-folder-name" title={f.path}>
                    {f.name}
                  </strong>
                  <span className="muted small image-folder-path" title={f.path}>
                    {f.path}
                  </span>
                </div>
                <button
                  className="mini btn-icon-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFolder(f.id);
                  }}
                  title={tr('image.remove_folder')}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* CENTER — Grid */}
      <main className="image-main">
        <header className="image-toolbar">
          <div className="image-toolbar-left">
            {activeFolder ? (
              <strong title={activeFolder.path}>📂 {activeFolder.name}</strong>
            ) : (
              <span className="muted">{tr('image.select_folder')}</span>
            )}
            {activeFolder && (
              <span className="muted small">
                · 🖼 {imageCount} · 🎬 {videoCount}
              </span>
            )}
          </div>
          <div className="image-toolbar-right">
            <input
              type="text"
              className="image-search"
              placeholder={tr('image.search_placeholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            <div className="segmented">
              {(
                [
                  { v: 'all', label: tr('image.kind.all') },
                  { v: 'image', label: '🖼' },
                  { v: 'video', label: '🎬' },
                ] as const
              ).map((k) => (
                <button
                  key={k.v}
                  type="button"
                  className={`seg-btn ${filterKind === k.v ? 'active' : ''}`}
                  onClick={() => setFilterKind(k.v)}
                  title={k.v}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <label className="image-recursive-toggle muted small">
              <input
                type="checkbox"
                checked={store.recursive}
                onChange={toggleRecursive}
              />{' '}
              {tr('image.recursive')}
            </label>
            <button
              className={`btn btn-sm ${selectionMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={toggleSelectionMode}
              title="Bật/tắt chế độ chọn nhiều"
              disabled={!activeFolder}
            >
              {selectionMode ? '✓ Đang chọn' : '☐ Chọn nhiều'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void handleRefresh()}
              disabled={!activeFolder || loading}
              title={tr('image.refresh')}
            >
              🔄
            </button>
            <div className="segmented" title={tr('image.view_mode')}>
              {(
                [
                  { v: 'xl', label: '⬜⬜', size: 18 },
                  { v: 'lg', label: '▣', size: 16 },
                  { v: 'md', label: '▦', size: 14 },
                  { v: 'sm', label: '▪▪', size: 12 },
                  { v: 'list', label: '☰', size: 14 },
                ] as Array<{ v: ImageViewMode; label: string; size: number }>
              ).map((vm) => (
                <button
                  key={vm.v}
                  type="button"
                  className={`seg-btn ${store.view_mode === vm.v ? 'active' : ''}`}
                  onClick={() => handleViewMode(vm.v)}
                  title={vm.v}
                  style={{ fontSize: vm.size }}
                >
                  {vm.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Phase 18.6.f — Bulk action bar */}
        {selectionMode && (
          <div className="image-bulk-bar">
            <span className="image-bulk-count">
              ✓ <strong>{selectedPaths.size}</strong> / {filteredFiles.length} ảnh được chọn
            </span>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>
              Chọn tất cả ({filteredFiles.length})
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={selectedPaths.size === 0}>
              Bỏ chọn
            </button>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowBatchRename(true)}
              disabled={selectedPaths.size === 0}
              title="Đổi tên hàng loạt theo pattern (logical, không đụng file thật)"
            >
              🏷 Đổi tên hàng loạt
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggleSelectionMode}
              title="Tắt chế độ chọn nhiều"
            >
              ✕ Thoát
            </button>
          </div>
        )}

        {/* Preload progress bar — chỉ hiện khi đang preload */}
        {preload.active && preload.total > 0 && (
          <div className="image-preload-bar">
            <div
              className="image-preload-fill"
              style={{
                width: `${(preload.done / preload.total) * 100}%`,
              }}
            />
            <div className="image-preload-text">
              <span>
                ⏳ {tr('image.preload.label')}: <strong>{preload.done}</strong>/
                <strong>{preload.total}</strong> (
                {Math.round((preload.done / preload.total) * 100)}%)
              </span>
              <span className="muted small image-preload-current" title={preload.currentName}>
                {preload.currentName}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={handleCancelPreload}>
                ✕ {tr('image.preload.cancel')}
              </button>
            </div>
          </div>
        )}

        <section className="image-grid-area">
          {!activeFolder ? (
            <div className="image-empty-big">
              <div style={{ fontSize: 64 }}>🖼</div>
              <p>{tr('image.select_or_add_folder')}</p>
              <button className="btn btn-primary" onClick={() => void handleAddFolder()}>
                + {tr('image.add_folder')}
              </button>
            </div>
          ) : loading ? (
            <div className="image-empty-big muted">⏳ {tr('image.loading')}</div>
          ) : errorMsg ? (
            <div className="image-empty-big" style={{ color: 'var(--danger, #c43)' }}>
              ⚠ {errorMsg}
            </div>
          ) : preload.active ? (
            <div className="image-empty-big">
              <div style={{ fontSize: 48 }}>⏳</div>
              <p className="muted">
                {tr('image.preload.label')}: {preload.done}/{preload.total} (
                {Math.round((preload.done / preload.total) * 100)}%)
              </p>
              <p className="muted small image-preload-current" title={preload.currentName}>
                {preload.currentName}
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="image-empty-big muted">
              {files.length === 0
                ? tr('image.no_images_in_folder')
                : tr('image.no_match_filter')}
            </div>
          ) : store.view_mode === 'list' ? (
            <ImageListView
              files={filteredFiles}
              selected={selectedPath}
              onSelect={(p) => {
                if (selectionMode) toggleSelected(p);
                else setSelectedPath(p);
              }}
              tr={tr}
              displayNameOf={displayNameOf}
              selectionMode={selectionMode}
              selectedPaths={selectedPaths}
            />
          ) : (
            <ImageGridView
              files={filteredFiles}
              mode={store.view_mode}
              selected={selectedPath}
              onSelect={(p) => {
                if (selectionMode) toggleSelected(p);
                else setSelectedPath(p);
              }}
              displayNameOf={displayNameOf}
              selectionMode={selectionMode}
              selectedPaths={selectedPaths}
            />
          )}
        </section>
      </main>

      {/* RIGHT — Detail panel */}
      <ImageDetailPanel
        file={selectedFile}
        tr={tr}
        note={selectedFile ? (store.notes[selectedFile.path] ?? '') : ''}
        displayName={selectedFile ? (store.display_names[selectedFile.path] ?? '') : ''}
        onSaveNote={handleSaveImageNote}
        onRename={handleRenameImage}
        onExport={handleExportImage}
        onOpenFullscreen={() => {
          if (selectedFile) {
            const i = filteredFiles.findIndex((f) => f.path === selectedFile.path);
            setLightboxIdx(i >= 0 ? i : 0);
          }
        }}
      />

      {/* Phase 18.6.i — Image lightbox */}
      {lightboxIdx !== null && (
        <ImageLightbox
          files={filteredFiles}
          initialIndex={lightboxIdx}
          displayNameOf={displayNameOf}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* Phase 18.6.f — Batch rename modal */}
      {showBatchRename && (
        <BatchRenameModal
          files={files}
          selectedPaths={selectedPaths}
          activeFolder={activeFolder}
          onClose={() => setShowBatchRename(false)}
          onApply={(updates) => {
            applyBatchRename(updates);
            // Optionally exit selection mode after apply
            setSelectionMode(false);
            setSelectedPaths(new Set());
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Grid view (xl, lg, md, sm)
// ============================================================

function ImageGridView({
  files,
  mode,
  selected,
  onSelect,
  displayNameOf,
  selectionMode,
  selectedPaths,
}: {
  files: ImageFile[];
  mode: Exclude<ImageViewMode, 'list'>;
  selected: string | null;
  onSelect: (p: string) => void;
  displayNameOf: (f: ImageFile) => string;
  selectionMode: boolean;
  selectedPaths: Set<string>;
}): JSX.Element {
  // Map mode → thumbnail max size (smaller = lighter memory + faster)
  const thumbSize: Record<typeof mode, number> = {
    xl: 320,
    lg: 256,
    md: 200,
    sm: 144,
  };
  const target = thumbSize[mode];

  return (
    <div className={`image-grid image-grid-${mode}`}>
      {files.map((f) => {
        const name = displayNameOf(f);
        const renamed = name !== f.name;
        const isChecked = selectedPaths.has(f.path);
        return (
          <div
            key={f.path}
            className={`image-tile ${selected === f.path && !selectionMode ? 'selected' : ''} ${selectionMode && isChecked ? 'bulk-checked' : ''}`}
            onClick={() => onSelect(f.path)}
            title={renamed ? `${name}\n(File thật: ${f.name})` : f.name}
          >
            {selectionMode && (
              <span
                className={`image-tile-checkbox ${isChecked ? 'checked' : ''}`}
                aria-label="Chọn ảnh"
              >
                {isChecked ? '✓' : ''}
              </span>
            )}
            {f.is_video ? (
              <div className="image-tile-video">
                <span className="image-video-badge">🎬</span>
                <span className="image-tile-ext">.{f.ext.toUpperCase()}</span>
              </div>
            ) : (
              <LazyThumbTile path={f.path} maxSize={target} />
            )}
            <div className="image-tile-name">
              {renamed && <span className="image-renamed-indicator">✎ </span>}
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// LazyThumbTile — IntersectionObserver-based lazy mount
// Chỉ gọi getThumbnail khi vào viewport; unmount src khi cuộn xa
// để giải phóng memory (decode JPEG → bitmap có thể >10MB/ảnh).
// ============================================================

const SHARED_OBSERVER_MAP = new WeakMap<
  Element,
  (visible: boolean) => void
>();

let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (sharedObserver) return sharedObserver;
  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const cb = SHARED_OBSERVER_MAP.get(entry.target);
        if (cb) cb(entry.isIntersecting);
      }
    },
    {
      // Pre-load tiles slightly before they enter viewport
      rootMargin: '300px 0px',
      threshold: 0.01,
    },
  );
  return sharedObserver;
}

function LazyThumbTile({
  path,
  maxSize,
}: {
  path: string;
  maxSize: number;
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  // Subscribe to shared IntersectionObserver — chỉ render <img> khi vào viewport
  // để tránh decode 200+ bitmaps cùng lúc kể cả thumb đã có cache.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = getSharedObserver();
    SHARED_OBSERVER_MAP.set(el, (isVis) => setVisible(isVis));
    observer.observe(el);
    return (): void => {
      observer.unobserve(el);
      SHARED_OBSERVER_MAP.delete(el);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!visible) {
      // Unset src after rời viewport để giải phóng decoded bitmap
      const timer = setTimeout(() => {
        if (!cancelled) setSrc(null);
      }, 3000);
      return (): void => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    setErrored(false);
    getThumbnail(path, maxSize)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return (): void => {
      cancelled = true;
    };
  }, [visible, path, maxSize]);

  return (
    <div ref={containerRef} className="image-thumb-host">
      {src ? (
        <img
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setErrored(true)}
        />
      ) : errored ? (
        <div className="image-thumb-error" title="Không decode được ảnh">
          ⚠
        </div>
      ) : (
        <div className="image-thumb-skeleton" />
      )}
    </div>
  );
}

// ============================================================
// List view (5-column table)
// ============================================================

function ImageListView({
  files,
  selected,
  onSelect,
  tr,
  displayNameOf,
  selectionMode,
  selectedPaths,
}: {
  files: ImageFile[];
  selected: string | null;
  onSelect: (p: string) => void;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  displayNameOf: (f: ImageFile) => string;
  selectionMode: boolean;
  selectedPaths: Set<string>;
}): JSX.Element {
  return (
    <table className="image-list-table">
      <thead>
        <tr>
          {selectionMode && <th style={{ width: 36 }}></th>}
          <th style={{ width: 60 }}></th>
          <th>{tr('image.list.name')}</th>
          <th style={{ width: 90 }}>{tr('image.list.kind')}</th>
          <th style={{ width: 110 }}>{tr('image.list.size')}</th>
          <th style={{ width: 170 }}>{tr('image.list.modified')}</th>
        </tr>
      </thead>
      <tbody>
        {files.map((f) => {
          const isChecked = selectedPaths.has(f.path);
          return (
          <tr
            key={f.path}
            className={`${selected === f.path && !selectionMode ? 'selected' : ''} ${selectionMode && isChecked ? 'bulk-checked' : ''}`}
            onClick={() => onSelect(f.path)}
          >
            {selectionMode && (
              <td>
                <span
                  className={`image-list-checkbox ${isChecked ? 'checked' : ''}`}
                >
                  {isChecked ? '✓' : ''}
                </span>
              </td>
            )}
            <td className="image-list-thumb">
              {f.is_video ? (
                <span style={{ fontSize: 18 }}>🎬</span>
              ) : (
                <LazyThumbTile path={f.path} maxSize={88} />
              )}
            </td>
            <td className="image-list-name" title={`${f.path}\n${f.name !== displayNameOf(f) ? '(File thật: ' + f.name + ')' : ''}`}>
              {displayNameOf(f) !== f.name && <span className="image-renamed-indicator">✎ </span>}
              {displayNameOf(f)}
            </td>
            <td>
              <code>.{f.ext}</code>
            </td>
            <td>{formatFileSize(f.size)}</td>
            <td className="muted small">{new Date(f.modified_ms).toLocaleString()}</td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ============================================================
// Detail panel (RIGHT)
// ============================================================

function ImageDetailPanel({
  file,
  tr,
  note,
  displayName,
  onSaveNote,
  onRename,
  onExport,
  onOpenFullscreen,
}: {
  file: ImageFile | null;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  note: string;
  displayName: string;
  onSaveNote: (path: string, note: string) => void;
  onRename: (path: string, newName: string) => void;
  onExport: (file: ImageFile) => void | Promise<void>;
  onOpenFullscreen: () => void;
}): JSX.Element {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState(note);
  const [savedFlash, setSavedFlash] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName || file?.name || '');
  const [renameSavedFlash, setRenameSavedFlash] = useState(false);
  const [exif, setExif] = useState<ExifData | null>(null);
  const [showExif, setShowExif] = useState(false);

  // Phase 18.6.h — Lazy fetch EXIF when file changes
  useEffect(() => {
    if (!file || file.is_video) {
      setExif(null);
      return;
    }
    let cancelled = false;
    readImageExif(file.path).then((data) => {
      if (!cancelled) setExif(data);
    });
    return (): void => {
      cancelled = true;
    };
  }, [file?.path, file?.is_video]);

  // Sync note draft khi đổi file hoặc note ngoài
  useEffect(() => {
    setNoteDraft(note);
    setSavedFlash(false);
  }, [note, file?.path]);

  // Sync rename draft khi đổi file
  useEffect(() => {
    setNameDraft(displayName || file?.name || '');
    setRenameSavedFlash(false);
  }, [displayName, file?.path, file?.name]);

  function handleSaveNote(): void {
    if (!file) return;
    onSaveNote(file.path, noteDraft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function handleSaveRename(): void {
    if (!file) return;
    const trimmed = nameDraft.trim();
    // Nếu user xóa hết tên → reset về tên gốc (clear display_name)
    onRename(file.path, trimmed === file.name ? '' : trimmed);
    setRenameSavedFlash(true);
    setTimeout(() => setRenameSavedFlash(false), 1200);
  }

  function handleResetRename(): void {
    if (!file) return;
    setNameDraft(file.name);
    onRename(file.path, '');
  }

  // Lazy load high-quality preview (1200px) when selection changes
  useEffect(() => {
    if (!file || file.is_video) {
      setPreviewSrc(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewSrc(null);
    getThumbnail(file.path, 1200)
      .then((url) => {
        if (!cancelled) setPreviewSrc(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewSrc(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return (
      <aside className="image-detail">
        <div className="image-detail-empty muted small">
          {tr('image.select_to_preview')}
        </div>
      </aside>
    );
  }

  return (
    <aside className="image-detail">
      <div className="image-detail-preview">
        {file.is_video ? (
          <video src={imageSrcUrl(file.path)} controls />
        ) : previewSrc ? (
          <img src={previewSrc} alt={file.name} decoding="async" />
        ) : (
          <div className="image-detail-loading muted small">
            {previewLoading ? '⏳' : ''}
          </div>
        )}
      </div>
      <div className="image-detail-meta">
        {/* Tên hiển thị (in-app rename) */}
        <div className="image-rename-block">
          <label className="muted small">Tên hiển thị</label>
          <div className="image-rename-row">
            <input
              type="text"
              className="image-rename-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={file.name}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleSaveRename}
              disabled={
                nameDraft.trim() === (displayName || file.name) ||
                nameDraft.trim().length === 0
              }
              title="Lưu tên hiển thị (file thật ko đổi)"
            >
              ✓
            </button>
            {displayName && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResetRename}
                title="Khôi phục tên gốc"
              >
                ↺
              </button>
            )}
          </div>
          {renameSavedFlash && (
            <span className="muted small image-note-saved-flash">
              ✓ Đã lưu tên hiển thị
            </span>
          )}
          {displayName && (
            <span className="muted small">
              File thật: <code>{file.name}</code>
            </span>
          )}
        </div>
        <h4 className="image-detail-name" title={file.name}>
          {displayName || file.name}
        </h4>
        <div className="image-detail-grid">
          <span className="muted small">{tr('image.list.kind')}</span>
          <span>
            {file.is_video ? '🎬 Video' : '🖼 Ảnh'} · <code>.{file.ext}</code>
          </span>
          <span className="muted small">{tr('image.list.size')}</span>
          <span>{formatFileSize(file.size)}</span>
          <span className="muted small">{tr('image.list.modified')}</span>
          <span className="small">{new Date(file.modified_ms).toLocaleString()}</span>
          <span className="muted small">{tr('image.detail.path')}</span>
          <code className="image-detail-path" title={file.path}>
            {file.path}
          </code>
        </div>
      </div>
      {/* EXIF section (chỉ ảnh, không video) */}
      {!file.is_video && exif && exif.has_exif && (
        <div className="image-detail-exif">
          <button
            className="image-detail-exif-toggle"
            onClick={() => setShowExif((v) => !v)}
          >
            <strong>📷 EXIF</strong>{' '}
            {exif.camera_model && <span className="muted small">{exif.camera_model}</span>}
            <span style={{ marginLeft: 'auto' }}>{showExif ? '▴' : '▾'}</span>
          </button>
          {showExif && (
            <div className="image-detail-exif-grid">
              {exif.camera_make && (
                <>
                  <span className="muted small">Hãng</span>
                  <span>{exif.camera_make}</span>
                </>
              )}
              {exif.camera_model && (
                <>
                  <span className="muted small">Máy</span>
                  <span>{exif.camera_model}</span>
                </>
              )}
              {exif.lens && (
                <>
                  <span className="muted small">Lens</span>
                  <span>{exif.lens}</span>
                </>
              )}
              {exif.datetime_original && (
                <>
                  <span className="muted small">Chụp lúc</span>
                  <span>{exif.datetime_original}</span>
                </>
              )}
              {exif.iso && (
                <>
                  <span className="muted small">ISO</span>
                  <span>{exif.iso}</span>
                </>
              )}
              {exif.aperture && (
                <>
                  <span className="muted small">Khẩu độ</span>
                  <span>{exif.aperture}</span>
                </>
              )}
              {exif.shutter_speed && (
                <>
                  <span className="muted small">Tốc độ</span>
                  <span>{exif.shutter_speed}</span>
                </>
              )}
              {exif.focal_length && (
                <>
                  <span className="muted small">Tiêu cự</span>
                  <span>{exif.focal_length}</span>
                </>
              )}
              {exif.flash && (
                <>
                  <span className="muted small">Flash</span>
                  <span>{exif.flash}</span>
                </>
              )}
              {exif.width && exif.height && (
                <>
                  <span className="muted small">Kích thước</span>
                  <span>
                    {exif.width} × {exif.height} px
                  </span>
                </>
              )}
              {(exif.gps_lat !== undefined && exif.gps_lon !== undefined) && (
                <>
                  <span className="muted small">📍 GPS</span>
                  <span>
                    {exif.gps_lat.toFixed(6)}, {exif.gps_lon.toFixed(6)}
                    {exif.gps_altitude !== undefined && ` (${exif.gps_altitude.toFixed(0)}m)`}
                    {' '}
                    <a
                      href={`https://www.google.com/maps?q=${exif.gps_lat},${exif.gps_lon}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const url = `https://www.google.com/maps?q=${exif.gps_lat},${exif.gps_lon}`;
                        void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url));
                      }}
                      style={{ color: 'var(--accent)' }}
                    >
                      Mở Maps ↗
                    </a>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ghi chú ảnh — lưu để search */}
      <div className="image-detail-note">
        <div className="image-detail-note-head">
          <strong>📝 {tr('image.note.title')}</strong>
          {savedFlash && (
            <span className="muted small image-note-saved-flash">
              ✓ {tr('image.note.saved')}
            </span>
          )}
        </div>
        <textarea
          className="image-note-textarea"
          placeholder={tr('image.note.placeholder')}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={3}
        />
        <button
          className="btn btn-ghost btn-sm image-note-save"
          onClick={handleSaveNote}
          disabled={noteDraft === note}
        >
          ✓ {tr('image.note.save')}
        </button>
      </div>

      <div className="image-detail-actions">
        <button
          className="btn btn-ghost image-export-btn"
          onClick={onOpenFullscreen}
          title="Xem toàn màn hình + slideshow (Enter)"
        >
          🔍 Xem toàn màn hình
        </button>
        <button
          className="btn btn-ghost image-export-btn"
          onClick={() => {
            const display = displayName || file.name;
            const fname = file.name;
            const noteHtml = `<p><strong>🖼 Ghi chú về ảnh:</strong> ${escapeForHtml(display)}</p>
<p class="muted small">File: <code>${escapeForHtml(fname)}</code><br>Đường dẫn: <code>${escapeForHtml(file.path)}</code></p>
${note.trim() ? `<blockquote>${escapeForHtml(note)}</blockquote>` : ''}
<p>—</p>
<p></p>`;
            requestCreateNoteAbout({
              title: `Ghi chú: ${display}`,
              content_html: noteHtml,
              category: 'personal',
              tags: ['from-image'],
            });
          }}
          title="Tạo ghi chú về ảnh này (chuyển sang module Ghi chú)"
        >
          📝 Tạo ghi chú
        </button>
        <button
          className="btn btn-ghost image-export-btn"
          onClick={() => void onExport(file)}
          title="Copy ra file mới với tên hiển thị + sidecar ghi chú"
        >
          📤 Xuất file (tên mới)
        </button>
        <button
          className="btn btn-primary image-open-os-btn"
          onClick={() => void openImageInOS(file.path)}
        >
          ↗ Mở ảnh
        </button>
      </div>
    </aside>
  );
}
