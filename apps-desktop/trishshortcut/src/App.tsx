/**
 * TrishShortcut — Phase 32.2 main App.
 *
 * Features hoàn thành:
 *   - Topbar: logo + search + theme toggle + Settings + Add shortcut
 *   - Sidebar: groups list (Tất cả / Apps / Games / ... / +Thêm nhóm) + Workspace section
 *   - Main: grid render shortcuts với click → launch (Phase 32.4 wire), right-click → context menu
 *   - Modals: ShortcutForm (thêm/sửa), ConfirmDialog (delete), GroupManager
 *   - Search filter realtime + Ctrl+K focus
 *
 * Pending phase sau:
 *   - 32.3: Icon extraction (Rust ExtractIconEx + favicon fetch)
 *   - 32.4: Launch process (Rust spawn + UAC + URL/folder open)
 *   - 32.5: Drag-drop file → auto add shortcut
 *   - 32.6: Workspace mode
 *   - 32.7: Hotkey toàn cục
 *   - 32.8: Quick launcher overlay (Ctrl+Space)
 *   - 32.9: Stats + smart suggest
 *   - 32.10: Schedule
 *   - 32.11: Backup/restore JSON
 *   - 32.12: Tray + UI polish
 *   - 32.13: Dashboard widget
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Settings, Sun, Moon, FolderPlus, Zap, ScanLine, ArrowDownAZ, Star, Upload } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import logoUrl from './assets/logo.png';
import {
  loadShortcuts, saveShortcuts,
  loadGroups, saveGroups,
  loadSettings, saveSettings,
  loadWorkspaces, saveWorkspaces,
  applyTheme, genId,
} from './storage';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { launchShortcut, openInExplorer, iconUrl, extractIconsBatch, parseLnk, extractIconFromExe } from './tauri-bridge';
import type { Shortcut, AppSettings, ShortcutGroup, ShortcutType, Workspace } from './types';
import { guessCategory } from './utils/categorize';
import { WorkspaceForm } from './components/WorkspaceForm';
import { Dashboard } from './components/Dashboard';
import { QuickLauncher } from './components/QuickLauncher';
import { SettingsModal } from './components/SettingsModal';

type SortMode = 'mru' | 'name-asc' | 'name-desc' | 'created-desc' | 'created-asc' | 'count-desc';

const SORT_LABELS: Record<SortMode, string> = {
  'mru': 'Dùng gần nhất',
  'name-asc': 'Tên A → Z',
  'name-desc': 'Tên Z → A',
  'created-desc': 'Mới thêm trước',
  'created-asc': 'Cũ trước',
  'count-desc': 'Dùng nhiều nhất',
};
import { ShortcutForm } from './components/ShortcutForm';
import { ContextMenu } from './components/ContextMenu';
import { ConfirmDialog } from './components/ConfirmDialog';
import { GroupManager } from './components/GroupManager';
import { Scanner } from './components/Scanner';

export function App(): JSX.Element {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => loadShortcuts());
  const [groups, setGroups] = useState<ShortcutGroup[]>(() => loadGroups());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sc: Shortcut } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Shortcut | null>(null);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('mru');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Phase 32.6 — Workspace state
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => loadWorkspaces());
  const [workspaceFormOpen, setWorkspaceFormOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  // Phase 32.7-12 — Settings + Quick launcher overlay
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [version] = useState('1.0.0');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  // Phase 32.3.B — auto extract icons cho shortcut chưa có icon (lần đầu mở app
  // sau update). Chạy 1 lần lúc mount, không block UI.
  useEffect(() => {
    const missing = shortcuts.filter(
      (s) => !s.icon_path && (s.type === 'app' || s.type === 'game' || s.type === 'file'),
    );
    if (missing.length === 0) return;
    void (async () => {
      const exePaths = missing.map((s) => s.target);
      const iconMap = await extractIconsBatch(exePaths);
      // Update only shortcuts có icon mới
      setShortcuts((prev) => {
        const updated = prev.map((s) => {
          const newIcon = iconMap.get(s.target);
          return newIcon ? { ...s, icon_path: newIcon } : s;
        });
        saveShortcuts(updated);
        return updated;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 32.12 — Listen window close event → check setting.
  // Cả 2 nhánh đều preventDefault rồi gọi Rust command tương ứng:
  //   - Hide → invoke('hide_to_tray') giữ tray icon + process
  //   - Tắt hẳn → invoke('exit_app') kill process (tray icon cũng tắt)
  // Lý do: Tauri 2 không tự exit khi window close vì tray icon vẫn alive.
  useEffect(() => {
    const win = getCurrentWindow();
    const unlistenPromise = win.onCloseRequested(async (event) => {
      event.preventDefault();
      if (settings.minimize_to_tray_on_close) {
        await invoke('hide_to_tray').catch(() => win.hide());
      } else {
        await invoke('exit_app');
      }
    });
    return () => { unlistenPromise.then((fn) => fn()); };
  }, [settings.minimize_to_tray_on_close]);

  // Phase 32.7 — Register hotkey toàn cục cho từng shortcut + workspace
  // + overlay hotkey từ settings. Re-register mỗi khi list/settings thay đổi.
  useEffect(() => {
    const registered: string[] = [];
    void (async () => {
      // Overlay hotkey (Quick launcher Ctrl+Space)
      if (settings.overlay_hotkey) {
        try {
          await register(settings.overlay_hotkey, () => {
            setOverlayOpen((prev) => !prev);
          });
          registered.push(settings.overlay_hotkey);
        } catch (e) {
          console.warn('[hotkey] register overlay fail:', e);
        }
      }
      // Per-shortcut hotkeys
      for (const sc of shortcuts) {
        if (sc.global_hotkey && !registered.includes(sc.global_hotkey)) {
          try {
            await register(sc.global_hotkey, () => {
              void handleLaunch(sc);
            });
            registered.push(sc.global_hotkey);
          } catch (e) {
            console.warn(`[hotkey] register ${sc.name} fail:`, e);
          }
        }
      }
      // Per-workspace hotkeys
      for (const ws of workspaces) {
        if (ws.global_hotkey && !registered.includes(ws.global_hotkey)) {
          try {
            await register(ws.global_hotkey, () => {
              void launchWorkspace(ws);
            });
            registered.push(ws.global_hotkey);
          } catch (e) {
            console.warn(`[hotkey] register workspace ${ws.name} fail:`, e);
          }
        }
      }
    })();
    return () => {
      // Cleanup: unregister all
      void (async () => {
        for (const key of registered) {
          try { await unregister(key); } catch { /* ignore */ }
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, workspaces, settings.overlay_hotkey]);

  // Phase 32.5 — listen drag-drop từ Tauri (file/folder kéo vào window)
  useEffect(() => {
    let cleanups: Array<() => void> = [];

    void (async () => {
      const u1 = await listen<{ paths?: string[] } | string[]>('tauri://drag-enter', () => {
        setDragOver(true);
      });
      const u2 = await listen<{ paths?: string[] } | string[]>('tauri://drag-leave', () => {
        setDragOver(false);
      });
      const u3 = await listen<{ paths: string[] } | string[]>('tauri://drag-drop', async (event) => {
        setDragOver(false);
        const payload = event.payload as { paths?: string[] } | string[];
        const paths = Array.isArray(payload) ? payload : (payload?.paths ?? []);
        if (paths.length === 0) return;
        await handleDropFiles(paths);
      });
      cleanups = [u1, u2, u3];
    })();

    return () => {
      cleanups.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortcuts, groups]);

  /**
   * Phase 32.5 — Convert path từ drag-drop → Shortcut object.
   * Tự đoán type từ extension, parse .lnk nếu có, auto-categorize.
   */
  async function pathToShortcut(path: string): Promise<Shortcut> {
    const fileName = path.split(/[\\/]/).pop() ?? path;
    const ext = fileName.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
    const baseName = fileName.replace(/\.[^.]+$/, '');

    let type: ShortcutType = 'file';
    let target = path;
    let workingDir: string | undefined;
    let args: string | undefined;
    let name = baseName;
    let iconPathExtracted: string | undefined;

    if (ext === 'lnk') {
      type = 'app';
      try {
        const parsed = await parseLnk(path);
        target = parsed.target || path;
        workingDir = parsed.workingDir || undefined;
        args = parsed.args || undefined;
      } catch {
        // fallback giữ path .lnk như target
      }
    } else if (ext === 'exe' || ext === 'bat' || ext === 'cmd') {
      type = 'app';
      // Working dir = parent của exe
      workingDir = path.replace(/[\\/][^\\/]+$/, '');
    } else if (ext === '') {
      type = 'folder';
    }

    // Extract icon (best-effort)
    if (type === 'app' || type === 'file') {
      iconPathExtracted = (await extractIconFromExe(target)) ?? undefined;
    }

    const fallback = groups[0] ?? 'Apps';
    const group = guessCategory(name, target, groups, fallback);

    const now = Date.now();
    return {
      id: genId('sc'),
      name,
      type,
      target,
      working_dir: workingDir,
      args,
      icon_path: iconPathExtracted,
      group,
      click_count: 0,
      created_at: now,
      updated_at: now,
    };
  }

  function showToast(msg: string): void {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDropFiles(paths: string[]): Promise<void> {
    if (paths.length === 1) {
      // 1 file → mở form prefilled
      const sc = await pathToShortcut(paths[0]);
      setEditing(sc);
      setFormOpen(true);
    } else {
      // Nhiều file → batch import + auto-categorize + auto-extract icon
      showToast(`Đang xử lý ${paths.length} mục...`);
      const created: Shortcut[] = [];
      for (const p of paths) {
        try {
          created.push(await pathToShortcut(p));
        } catch (e) {
          console.warn('[drag-drop] fail:', p, e);
        }
      }
      handleImportBatch(created);
      showToast(`Đã thêm ${created.length} shortcut từ drag-drop`);
    }
  }

  // Ctrl+K → focus search
  useEffect(() => {
    function handler(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function toggleTheme(): void {
    const next: AppSettings = {
      ...settings,
      theme: settings.theme === 'dark' ? 'light' : 'dark',
    };
    setSettings(next);
    saveSettings(next);
  }

  function openAdd(): void {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(sc: Shortcut): void {
    setEditing(sc);
    setFormOpen(true);
    setContextMenu(null);
  }

  function handleSave(sc: Shortcut): void {
    const idx = shortcuts.findIndex((s) => s.id === sc.id);
    let next: Shortcut[];
    if (idx >= 0) {
      next = [...shortcuts];
      next[idx] = sc;
    } else {
      next = [sc, ...shortcuts];
    }
    setShortcuts(next);
    saveShortcuts(next);
    setFormOpen(false);
  }

  function handleDelete(sc: Shortcut): void {
    const next = shortcuts.filter((s) => s.id !== sc.id);
    setShortcuts(next);
    saveShortcuts(next);
    setConfirmDelete(null);
  }

  function handleImportBatch(newShortcuts: Shortcut[]): void {
    if (newShortcuts.length === 0) return;
    // Dedupe theo target — không thêm duplicate
    const existingTargets = new Set(shortcuts.map((s) => s.target.toLowerCase()));
    const filtered = newShortcuts.filter((s) => !existingTargets.has(s.target.toLowerCase()));
    const next = [...filtered, ...shortcuts];
    setShortcuts(next);
    saveShortcuts(next);
  }

  async function handleLaunch(sc: Shortcut, forceAdmin = false): Promise<void> {
    // Update stats trước khi launch (optimistic)
    const updated: Shortcut = {
      ...sc,
      click_count: sc.click_count + 1,
      last_used_at: Date.now(),
    };
    const next = shortcuts.map((s) => (s.id === sc.id ? updated : s));
    setShortcuts(next);
    saveShortcuts(next);

    try {
      await launchShortcut({
        type: sc.type,
        target: sc.target,
        args: sc.args,
        workingDir: sc.working_dir,
        runAsAdmin: forceAdmin || sc.run_as_admin,
      });
    } catch (e) {
      console.error('[shortcut] launch fail:', e);
      // Phase 32.4 — proper error toast UI
    }
  }

  async function handleCopyPath(sc: Shortcut): Promise<void> {
    try {
      await navigator.clipboard.writeText(sc.target);
    } catch {
      console.warn('clipboard fail');
    }
    setContextMenu(null);
  }

  async function handleOpenLocation(sc: Shortcut): Promise<void> {
    setContextMenu(null);
    if (sc.type === 'url') {
      void launchShortcut({ type: 'url', target: sc.target });
    } else if (sc.type === 'folder') {
      void launchShortcut({ type: 'folder', target: sc.target });
    } else {
      // Mở Explorer + select file (highlight file trong folder)
      void openInExplorer(sc.target);
    }
  }

  function handleSaveGroups(newGroups: ShortcutGroup[]): void {
    // Reassign shortcut với group đã xoá → 'Apps' (default fallback)
    const fallback = newGroups[0] ?? 'Apps';
    const updatedShortcuts = shortcuts.map((s) =>
      newGroups.includes(s.group) ? s : { ...s, group: fallback },
    );
    setGroups(newGroups);
    saveGroups(newGroups);
    setShortcuts(updatedShortcuts);
    saveShortcuts(updatedShortcuts);
  }

  // Phase 32.6 — Workspace handlers

  function openAddWorkspace(): void {
    setEditingWorkspace(null);
    setWorkspaceFormOpen(true);
  }

  function openEditWorkspace(ws: Workspace): void {
    setEditingWorkspace(ws);
    setWorkspaceFormOpen(true);
  }

  function handleSaveWorkspace(ws: Workspace): void {
    const idx = workspaces.findIndex((w) => w.id === ws.id);
    let next: Workspace[];
    if (idx >= 0) {
      next = [...workspaces];
      next[idx] = ws;
    } else {
      next = [ws, ...workspaces];
    }
    setWorkspaces(next);
    saveWorkspaces(next);
    setWorkspaceFormOpen(false);
  }

  function handleDeleteWorkspace(ws: Workspace): void {
    const next = workspaces.filter((w) => w.id !== ws.id);
    setWorkspaces(next);
    saveWorkspaces(next);
  }

  /**
   * Phase 32.6 — Launch workspace: mở tất cả shortcut trong workspace với delay
   * giữa mỗi cái. Update click_count + last_used cho mỗi shortcut được launch.
   */
  async function launchWorkspace(ws: Workspace): Promise<void> {
    const items = ws.shortcut_ids
      .map((id) => shortcuts.find((s) => s.id === id))
      .filter((s): s is Shortcut => Boolean(s));

    if (items.length === 0) {
      showToast(`Workspace "${ws.name}" không có shortcut nào`);
      return;
    }

    showToast(`▶ Mở workspace "${ws.name}" — ${items.length} app...`);

    // Update stats batch trước (optimistic)
    const now = Date.now();
    const updatedShortcuts = shortcuts.map((s) => {
      if (ws.shortcut_ids.includes(s.id)) {
        return { ...s, click_count: s.click_count + 1, last_used_at: now };
      }
      return s;
    });
    setShortcuts(updatedShortcuts);
    saveShortcuts(updatedShortcuts);

    // Launch sequence với delay
    const delayMs = ws.launch_delay_ms || 500;
    for (let i = 0; i < items.length; i++) {
      const sc = items[i];
      try {
        await launchShortcut({
          type: sc.type,
          target: sc.target,
          args: sc.args,
          workingDir: sc.working_dir,
          runAsAdmin: sc.run_as_admin,
        });
      } catch (e) {
        console.warn(`[workspace] launch ${sc.name} fail:`, e);
      }
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    showToast(`✓ Đã mở ${items.length} app`);
  }

  function toggleFavorite(sc: Shortcut): void {
    const updated: Shortcut = { ...sc, favorite: !sc.favorite };
    const next = shortcuts.map((s) => (s.id === sc.id ? updated : s));
    setShortcuts(next);
    saveShortcuts(next);
    setContextMenu(null);
  }

  // Filter
  const visibleShortcuts = useMemo(() => {
    let list = shortcuts;
    if (activeGroup === '__favorite__') list = list.filter((s) => s.favorite);
    else if (activeGroup) list = list.filter((s) => s.group === activeGroup);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.target.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    switch (sortMode) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
        break;
      case 'created-desc':
        sorted.sort((a, b) => b.created_at - a.created_at);
        break;
      case 'created-asc':
        sorted.sort((a, b) => a.created_at - b.created_at);
        break;
      case 'count-desc':
        sorted.sort((a, b) => b.click_count - a.click_count);
        break;
      case 'mru':
      default:
        sorted.sort((a, b) => {
          const aT = a.last_used_at ?? a.created_at;
          const bT = b.last_used_at ?? b.created_at;
          return bT - aT;
        });
        break;
    }
    return sorted;
  }, [shortcuts, activeGroup, search, sortMode]);

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    shortcuts.forEach((s) => map.set(s.group, (map.get(s.group) ?? 0) + 1));
    return map;
  }, [shortcuts]);

  return (
    <div className="shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-brand">
          <img src={logoUrl} alt="TrishShortcut" />
          <div>
            <h1>TrishShortcut</h1>
            <div className="subtitle">Quản lý shortcut Windows · apps · games · folders · URLs</div>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="search-bar">
            <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm shortcut (Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-icon" onClick={toggleTheme} title="Đổi giao diện">
            {settings.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setScannerOpen(true)}
            title="Quét app từ Desktop / Start Menu / Đã cài"
          >
            <ScanLine size={14} /> Quét app
          </button>
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setSettingsOpen(true)}
            title="Cài đặt"
            style={{ width: 40, height: 40 }}
          >
            <Settings size={20} />
          </button>
          <button className="btn btn-primary" onClick={openAdd} title="Thêm shortcut mới">
            <Plus size={14} /> Thêm
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section-title">Nhóm</div>
          <div
            className={`sidebar-item ${activeGroup === '' ? 'active' : ''}`}
            onClick={() => setActiveGroup('')}
          >
            <span>📚</span>
            <span>Tất cả</span>
            <span className="count">{shortcuts.length}</span>
          </div>
          <div
            className={`sidebar-item ${activeGroup === '__favorite__' ? 'active' : ''}`}
            onClick={() => setActiveGroup('__favorite__')}
            style={activeGroup === '__favorite__' ? {} : { color: '#b45309' }}
          >
            <Star size={14} fill={activeGroup === '__favorite__' ? 'currentColor' : '#f59e0b'} color="#f59e0b" />
            <span>Yêu thích</span>
            <span className="count">{shortcuts.filter((s) => s.favorite).length}</span>
          </div>
          {groups.map((g) => (
            <div
              key={g}
              className={`sidebar-item ${activeGroup === g ? 'active' : ''}`}
              onClick={() => setActiveGroup(g)}
            >
              <span>{groupEmoji(g)}</span>
              <span>{g}</span>
              <span className="count">{groupCounts.get(g) ?? 0}</span>
            </div>
          ))}
          <div
            className="sidebar-item"
            style={{ color: 'var(--color-accent-primary)', marginTop: 4 }}
            onClick={() => setGroupManagerOpen(true)}
          >
            <FolderPlus size={14} />
            <span>Quản lý nhóm</span>
          </div>

          <div className="sidebar-section-title">Workspace</div>
          {workspaces.length === 0 ? (
            <div
              className="sidebar-item"
              style={{ color: 'var(--color-text-muted)', fontSize: 11 }}
              title="Workspace = nhóm shortcut launch cùng lúc"
            >
              <Zap size={14} />
              <span>Chưa có workspace</span>
            </div>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.id}
                className="sidebar-item"
                style={{ position: 'relative' }}
                onClick={() => void launchWorkspace(ws)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // Right-click: show edit/delete via window.confirm fallback
                  // (proper menu sau)
                  if (window.confirm(`Workspace "${ws.name}":\n\nOK = Sửa\nCancel = Xoá`)) {
                    openEditWorkspace(ws);
                  } else {
                    if (window.confirm(`Xoá workspace "${ws.name}"?`)) {
                      handleDeleteWorkspace(ws);
                    }
                  }
                }}
                title={`Click: launch ${ws.shortcut_ids.length} app · Right-click: sửa/xoá`}
              >
                <Zap size={14} fill="#f59e0b" color="#f59e0b" />
                <span style={{ fontSize: 13 }}>{ws.name}</span>
                <span className="count">{ws.shortcut_ids.length}</span>
              </div>
            ))
          )}
          <div
            className="sidebar-item"
            style={{ color: 'var(--color-accent-primary)', marginTop: 4 }}
            onClick={openAddWorkspace}
          >
            <Plus size={14} />
            <span>Tạo workspace</span>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="main-header">
            <h2>
              {activeGroup === '__favorite__' ? '⭐ Yêu thích' : (activeGroup || 'Tất cả shortcut')}
            </h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ArrowDownAZ size={14} style={{ color: 'var(--color-text-muted)' }} />
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  style={{
                    padding: '6px 8px',
                    fontSize: 12,
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 6,
                    background: 'var(--color-surface-card)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                  title="Sắp xếp"
                >
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                    <option key={m} value={m}>{SORT_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {visibleShortcuts.length} / {shortcuts.length} mục
              </div>
            </div>
          </div>

          {/* Phase 32.13 — Dashboard widget hiện ở tab "Tất cả" + có >0 mục */}
          {activeGroup === '' && shortcuts.length > 0 && !search && (
            <Dashboard
              shortcuts={shortcuts}
              workspaces={workspaces}
              onLaunchShortcut={(sc) => void handleLaunch(sc)}
              onLaunchWorkspace={(ws) => void launchWorkspace(ws)}
            />
          )}

          {visibleShortcuts.length === 0 ? (
            <div className="empty-state">
              <div className="big">⚡</div>
              <h3>{shortcuts.length === 0 ? 'Chưa có shortcut nào' : 'Không tìm thấy'}</h3>
              <p>
                {shortcuts.length === 0
                  ? 'Thêm shortcut đầu tiên bằng nút "+ Thêm shortcut" ở góc phải.'
                  : 'Đổi từ khoá tìm kiếm hoặc bỏ filter nhóm.'}
              </p>
              {shortcuts.length === 0 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => setScannerOpen(true)}>
                    <ScanLine size={14} /> Quét app từ máy
                  </button>
                  <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={14} /> Thêm thủ công
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={`grid size-${settings.grid_size}`}>
              {visibleShortcuts.map((s) => (
                <div
                  key={s.id}
                  className="shortcut-card"
                  title={`${s.target}${s.args ? ` ${s.args}` : ''}`}
                  onClick={() => void handleLaunch(s)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, sc: s });
                  }}
                >
                  <div className="icon">
                    {s.icon_path ? (
                      <img
                        src={iconUrl(s.icon_path) ?? ''}
                        alt=""
                        onError={(e) => {
                          // Fallback emoji nếu file biến mất khỏi cache
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      typeIcon(s.type)
                    )}
                  </div>
                  <div className="name">{s.name}</div>
                  <div className="meta">
                    {s.type} · {s.click_count} lượt
                    {s.global_hotkey && (
                      <kbd style={{
                        marginLeft: 6, padding: '0 4px', fontSize: 9,
                        background: 'var(--color-surface-row)', borderRadius: 3,
                        fontFamily: 'monospace',
                      }}>
                        {s.global_hotkey}
                      </kbd>
                    )}
                  </div>
                  {s.run_as_admin && (
                    <div className="badge" style={{ right: s.favorite ? 28 : 6 }}>UAC</div>
                  )}
                  {s.favorite && (
                    <div
                      className="badge"
                      style={{ background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 4px' }}
                      title="Yêu thích"
                    >
                      <Star size={10} fill="currentColor" color="#fff" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {formOpen && (
        <ShortcutForm
          initial={editing}
          groups={groups}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
        />
      )}
      {contextMenu && (
        <ContextMenu
          shortcut={contextMenu.sc}
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={() => openEdit(contextMenu.sc)}
          onToggleFavorite={() => toggleFavorite(contextMenu.sc)}
          onOpenLocation={() => void handleOpenLocation(contextMenu.sc)}
          onRunAsAdmin={() => {
            void handleLaunch(contextMenu.sc, true);
            setContextMenu(null);
          }}
          onCopyPath={() => void handleCopyPath(contextMenu.sc)}
          onDelete={() => {
            setConfirmDelete(contextMenu.sc);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Xoá shortcut?"
          message={`"${confirmDelete.name}" sẽ bị xoá khỏi danh sách. File gốc trên máy KHÔNG bị xoá. Action không hoàn tác được.`}
          okLabel="Xoá"
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {groupManagerOpen && (
        <GroupManager
          groups={groups}
          shortcutsCount={groupCounts}
          onSave={handleSaveGroups}
          onClose={() => setGroupManagerOpen(false)}
        />
      )}
      {scannerOpen && (
        <Scanner
          groups={groups}
          onClose={() => setScannerOpen(false)}
          onImport={handleImportBatch}
        />
      )}
      {workspaceFormOpen && (
        <WorkspaceForm
          initial={editingWorkspace}
          shortcuts={shortcuts}
          onClose={() => setWorkspaceFormOpen(false)}
          onSave={handleSaveWorkspace}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          version={version}
          onSave={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
          onRestore={() => {
            // Reload tất cả từ storage sau khi restoreBackup
            setShortcuts(loadShortcuts());
            setWorkspaces(loadWorkspaces());
            setGroups(loadGroups());
            setSettings(loadSettings());
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {overlayOpen && (
        <QuickLauncher
          shortcuts={shortcuts}
          workspaces={workspaces}
          onLaunchShortcut={(sc) => void handleLaunch(sc)}
          onLaunchWorkspace={(ws) => void launchWorkspace(ws)}
          onClose={() => setOverlayOpen(false)}
        />
      )}

      {/* Phase 32.5 — Drag-drop overlay */}
      {dragOver && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(5,150,105,0.10)',
            border: '4px dashed var(--color-accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              padding: 24,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-accent-primary)',
              borderRadius: 16,
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(5,150,105,0.30)',
            }}
          >
            <Upload size={36} color="var(--color-accent-primary)" />
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10, color: 'var(--color-accent-primary)' }}>
              Thả file để thêm shortcut
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>
              Hỗ trợ: .exe, .lnk, .bat, .cmd, folder
            </div>
          </div>
        </div>
      )}

      {/* Phase 32.5 — Toast notification (drag-drop results) */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24, right: 24,
            padding: '12px 18px',
            background: 'var(--color-accent-primary)',
            color: '#fff',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            zIndex: 300,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function groupEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('app')) return '📱';
  if (lower.includes('game')) return '🎮';
  if (lower.includes('work')) return '💼';
  if (lower.includes('web')) return '🌐';
  if (lower.includes('tool')) return '🔧';
  if (lower.includes('office') || lower.includes('văn phòng')) return '📊';
  if (lower.includes('media') || lower.includes('giải trí')) return '🎬';
  return '📁';
}

function typeIcon(t: string): string {
  switch (t) {
    case 'app': return '📱';
    case 'game': return '🎮';
    case 'folder': return '📁';
    case 'url': return '🌐';
    case 'file': return '📄';
    case 'uwp': return '🪟';
    case 'command': return '💻';
    default: return '⚡';
  }
}
