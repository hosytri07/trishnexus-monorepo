/**
 * TrishNote App.tsx — Phase 17.2 v4.
 *
 * Thay đổi v4 (theo phản hồi user):
 *  - Bỏ Review feature toàn app (ReviewModal, dueCount, sidebar "Cần review",
 *    button "Đã review", row "Review gần nhất").
 *  - Bỏ Kanban view + view-toggle. Chỉ còn List view; project list có
 *    divider phân loại + color tag.
 *  - Lối tắt giờ chỉ hiển thị note + folder được pin.
 *  - Sidebar "Dự án" highlight folder chứa note status='active' có deadline.
 *  - Note cá nhân + dự án mới đều dùng RichTextEditor (font format, B/I/U,
 *    list 1.2.3 / a.b.c) + đính kèm file/link.
 *  - Font dropdown lấy từ Windows-installed fonts (Rust list_system_fonts).
 *  - Cỡ chữ 6-48 px.
 */

import { useEffect, useMemo, useState } from 'react';
import { notes } from '@trishteam/core';
import type { NoteStatus } from '@trishteam/core/notes';
import { useAuth } from '@trishteam/auth/react';
import {
  getDefaultStoreLocation,
  loadStore,
  saveStore,
  notesFilenameForUid,
  attachFile,
  openLocalPath,
  pickFileForAttach,
  pickPathForLink,
  removeAttachedFile,
  listSystemFonts,
  type StoreLocation,
} from './tauri-bridge.js';
import {
  defaultFolders,
  genFolderId,
  genTaskId,
  genAttachmentId,
  type Attachment,
  type Folder,
  type NoteCategory,
  type NoteV2,
  type StoreV2,
  type Task,
} from './types.js';
import {
  loadSettings,
  applySettings,
  type AppSettings,
} from './settings.js';
import { SettingsModal } from './components/SettingsModal.js';
import { UserPanel } from './components/UserPanel.js';
import { useDialog } from './components/Dialog.js';
import { RichTextEditor } from './components/RichTextEditor.js';
import logoUrl from './assets/logo.png';

// Phase 17.2 v2 — 3 cột status cho project
const PROJECT_STATUS_LABEL: Record<string, string> = {
  inbox: 'Chưa làm',
  active: 'Đang làm',
  done: 'Đã xong',
};
const PROJECT_STATUSES: NoteStatus[] = ['inbox', 'active', 'done'];

const PROJECT_STATUS_COLOR: Record<string, string> = {
  inbox: 'var(--status-inbox, #94a3b8)',
  active: 'var(--status-active, #3b82f6)',
  done: 'var(--status-done, #10b981)',
};

type Selection =
  | { kind: 'all' }
  | { kind: 'category'; category: NoteCategory }
  | { kind: 'folder'; folderId: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'pinned' }
  | { kind: 'trash' };

type SortMode = 'updated-desc' | 'updated-asc' | 'created-desc' | 'title-asc';

const SORT_LABEL: Record<SortMode, string> = {
  'updated-desc': '🕒 Mới sửa',
  'updated-asc': '🕘 Cũ sửa',
  'created-desc': '➕ Mới tạo',
  'title-asc': '🔤 Tên A-Z',
};

const TRASH_RETENTION_DAYS = 30;

function uid(): string {
  return 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DEADLINE_WARN_DAYS = 7;
const DAY_MS = 86_400_000;

export function App(): JSX.Element {
  const { profile } = useAuth();
  const dialog = useDialog();
  const userFilename = useMemo(
    () => notesFilenameForUid(profile?.id ?? null),
    [profile?.id],
  );

  const [items, setItems] = useState<NoteV2[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [storePath, setStorePath] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerCategory, setComposerCategory] = useState<NoteCategory | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddNoteMenu, setShowAddNoteMenu] = useState(false);
  const [savingFlash, setSavingFlash] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettings());
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');

  // Apply theme + typography on mount + khi thay đổi
  useEffect(() => {
    applySettings(appSettings);
  }, [appSettings]);

  // Phase 17.2 v5 — Keyboard shortcuts: Ctrl+N (new), Esc (close detail), Ctrl+F (focus search)
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Skip nếu đang trong input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !inField) {
        e.preventDefault();
        setComposerCategory('personal');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const searchEl = document.querySelector<HTMLInputElement>('input.search');
        searchEl?.focus();
      } else if (e.key === 'Escape' && !inField) {
        if (selectedId) setSelectedId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  // Initial load — per-UID store + system fonts
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loc = await getDefaultStoreLocation();
        if (!alive) return;
        setLocation(loc);
        const result = await loadStore(userFilename);
        if (!alive) return;
        setStorePath(result.path);
        setItems(result.store.notes);
        if (result.store.folders.length === 0) {
          setFolders(defaultFolders());
        } else {
          setFolders(result.store.folders);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // Load fonts in parallel
    (async () => {
      try {
        const list = await listSystemFonts();
        if (alive) setSystemFonts(list);
      } catch (e) {
        console.warn('[trishnote] list fonts fail:', e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userFilename]);

  // Auto-save 400ms debounce
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          setSavingFlash(true);
          const store: StoreV2 = { schema: 2, notes: items, folders };
          await saveStore(store, userFilename);
          setTimeout(() => setSavingFlash(false), 300);
        } catch (e) {
          setError(String(e));
          setSavingFlash(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [items, folders, loading, userFilename]);

  const now = Date.now();

  // Active = chưa deleted
  const activeItems = useMemo(() => items.filter((n) => n.deletedAt == null), [items]);

  /** Note đã xoá còn trong thùng rác (chưa quá 30 ngày). */
  const trashedItems = useMemo(
    () =>
      items.filter(
        (n) => n.deletedAt != null && now - n.deletedAt < TRASH_RETENTION_DAYS * DAY_MS,
      ),
    [items, now],
  );

  // Auto-purge note quá 30 ngày trong thùng rác
  useEffect(() => {
    if (loading) return;
    const expired = items.filter(
      (n) => n.deletedAt != null && now - n.deletedAt >= TRASH_RETENTION_DAYS * DAY_MS,
    );
    if (expired.length === 0) return;
    const expiredIds = new Set(expired.map((n) => n.id));
    setItems((prev) => prev.filter((n) => !expiredIds.has(n.id)));
  }, [items, now, loading]);

  const pinnedNotes = useMemo(
    () => activeItems.filter((n) => n.pinned),
    [activeItems],
  );
  const pinnedFolders = useMemo(
    () => folders.filter((f) => f.pinned),
    [folders],
  );

  // Folders dự án có note đang làm + có deadline ≤ 7 ngày → highlight
  const folderHasUrgent = useMemo(() => {
    const map = new Map<string, { count: number; minDays: number }>();
    for (const n of activeItems) {
      if (n.category !== 'project') continue;
      if (n.status !== 'active') continue;
      if (!n.deadline) continue;
      const days = Math.floor((n.deadline - now) / DAY_MS);
      if (days > DEADLINE_WARN_DAYS) continue;
      if (!n.folderId) continue;
      const cur = map.get(n.folderId);
      if (!cur || days < cur.minDays) {
        map.set(n.folderId, { count: (cur?.count ?? 0) + 1, minDays: days });
      } else {
        cur.count += 1;
      }
    }
    return map;
  }, [activeItems, now]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of activeItems) for (const t of n.tags) set.add(t);
    return Array.from(set).sort();
  }, [activeItems]);

  // Filter theo selection + search
  const filtered = useMemo(() => {
    let list: NoteV2[];
    if (selection.kind === 'trash') {
      list = trashedItems;
    } else {
      list = activeItems;
      if (selection.kind === 'pinned') {
        list = list.filter((n) => n.pinned);
      } else if (selection.kind === 'category') {
        list = list.filter((n) => (n.category ?? 'personal') === selection.category);
      } else if (selection.kind === 'folder') {
        list = list.filter((n) => n.folderId === selection.folderId);
      } else if (selection.kind === 'tag') {
        list = list.filter((n) => n.tags.includes(selection.tag));
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [activeItems, trashedItems, selection, search]);

  const selected = useMemo(
    () => items.find((n) => n.id === selectedId) ?? null,
    [items, selectedId],
  );

  // ===== Note CRUD =====

  function handleCreate(draft: {
    title: string;
    body: string;
    bodyFormat: 'plain' | 'html';
    tagsInput: string;
    status: NoteStatus;
    category: NoteCategory;
    folderId: string | null;
    deadline: number | null;
    tasks: Task[];
    attachments: Attachment[];
    style: NoteV2['style'];
  }): void {
    const tags = draft.tagsInput
      .split(',')
      .map((t) => notes.normalizeTag(t))
      .filter((t) => t.length > 0);
    const err = notes.validateDraft({
      title: draft.title,
      body: draft.body,
      tags,
    });
    if (err !== null) {
      alert(err);
      return;
    }
    const note: NoteV2 = {
      id: uid(),
      title: draft.title.trim(),
      body: draft.body,
      bodyFormat: draft.bodyFormat,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      status: draft.status,
      lastReviewedAt: null,
      dueAt: null,
      category: draft.category,
      folderId: draft.folderId,
      deadline: draft.deadline,
      tasks: draft.tasks,
      attachments: draft.attachments,
      style: draft.style,
    };
    setItems((prev) => [note, ...prev]);
    setComposerCategory(null);
    setSelectedId(note.id);
  }

  function handleEdit(id: string, patch: Partial<NoteV2>): void {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
    );
  }

  function handleMove(id: string, status: NoteStatus): void {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? notes.moveNote(n, status, Date.now()) : n)),
    );
  }

  async function handleDelete(id: string): Promise<void> {
    const note = items.find((n) => n.id === id);
    if (!note) return;
    const ok = await dialog.confirm({
      title: 'Xoá note',
      message: `Xoá note "${note.title || '(không tiêu đề)'}"?`,
      okLabel: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deletedAt: Date.now(), updatedAt: Date.now() } : n,
      ),
    );
    if (selectedId === id) setSelectedId(null);
  }

  function handleTogglePin(id: string): void {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n,
      ),
    );
  }

  /** Khôi phục note từ thùng rác. */
  function handleRestore(id: string): void {
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deletedAt: null, updatedAt: Date.now() } : n,
      ),
    );
  }

  /** Xoá vĩnh viễn (purge khỏi thùng rác). */
  async function handlePurge(id: string): Promise<void> {
    const note = items.find((n) => n.id === id);
    if (!note) return;
    const ok = await dialog.confirm({
      title: 'Xoá vĩnh viễn',
      message: `Xoá hẳn "${note.title || '(không tiêu đề)'}" — không thể khôi phục.`,
      okLabel: 'Xoá vĩnh viễn',
      danger: true,
    });
    if (!ok) return;
    // Cleanup attachments file
    if (note.attachments) {
      for (const att of note.attachments) {
        if (att.kind === 'file') {
          try {
            await removeAttachedFile(att.path);
          } catch {
            /* ignore */
          }
        }
      }
    }
    setItems((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function handleEmptyTrash(): Promise<void> {
    if (trashedItems.length === 0) return;
    const ok = await dialog.confirm({
      title: 'Đổ thùng rác',
      message: `Xoá vĩnh viễn ${trashedItems.length} note? Không thể khôi phục.`,
      okLabel: 'Đổ thùng rác',
      danger: true,
    });
    if (!ok) return;
    for (const note of trashedItems) {
      if (note.attachments) {
        for (const att of note.attachments) {
          if (att.kind === 'file') {
            try {
              await removeAttachedFile(att.path);
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
    const trashIds = new Set(trashedItems.map((n) => n.id));
    setItems((prev) => prev.filter((n) => !trashIds.has(n.id)));
  }

  /** Duplicate note — copy với title "(copy)". */
  function handleDuplicate(id: string): void {
    const src = items.find((n) => n.id === id);
    if (!src) return;
    const copy: NoteV2 = {
      ...src,
      id: uid(),
      title: `${src.title || '(không tiêu đề)'} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      pinned: false,
      // Attachments không copy file vật lý — clone metadata thôi (link sẽ dùng path cũ)
      attachments: src.attachments?.map((a) => ({ ...a, id: genAttachmentId() })) ?? [],
      tasks: src.tasks?.map((t) => ({ ...t, id: genTaskId() })) ?? [],
    };
    setItems((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
  }

  function handleToggleFolderPin(folderId: string): void {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, pinned: !f.pinned, updatedAt: Date.now() } : f,
      ),
    );
  }

  // ===== Folder CRUD =====

  async function handleAddFolder(category: NoteCategory): Promise<void> {
    const isProject = category === 'project';
    const name = await dialog.prompt({
      title: isProject ? '💼 Tạo dự án mới' : '📁 Tạo folder mới',
      message: isProject
        ? 'Đặt tên cho dự án (ví dụ: Website redesign, Mobile app...)'
        : 'Đặt tên cho folder cá nhân (ví dụ: Học tập, Mua sắm...)',
      defaultValue: '',
      placeholder: isProject ? 'Tên dự án' : 'Tên folder',
      okLabel: 'Tạo',
    });
    if (!name?.trim()) return;
    // Pick random color tag cho project
    const folder: Folder = {
      id: genFolderId(),
      name: name.trim(),
      category,
      color: isProject
        ? FOLDER_COLOR_PALETTE[Math.floor(Math.random() * FOLDER_COLOR_PALETTE.length)]
        : undefined,
      icon: category === 'project' ? '📂' : '📁',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setFolders((prev) => [...prev, folder]);
    setSelection({ kind: 'folder', folderId: folder.id });
  }

  function handleSetFolderColor(folderId: string, color: string | null): void {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, color: color ?? undefined, updatedAt: Date.now() }
          : f,
      ),
    );
  }

  async function handleRenameFolder(folderId: string): Promise<void> {
    const f = folders.find((x) => x.id === folderId);
    if (!f) return;
    const name = await dialog.prompt({
      title: 'Đổi tên folder',
      defaultValue: f.name,
      placeholder: 'Tên mới',
      okLabel: 'Đổi tên',
    });
    if (!name?.trim() || name.trim() === f.name) return;
    setFolders((prev) =>
      prev.map((x) =>
        x.id === folderId ? { ...x, name: name.trim(), updatedAt: Date.now() } : x,
      ),
    );
  }

  async function handleDeleteFolder(folderId: string): Promise<void> {
    const f = folders.find((x) => x.id === folderId);
    if (!f) return;
    const inFolder = activeItems.filter((n) => n.folderId === folderId);
    const ok = await dialog.confirm({
      title: 'Xoá folder',
      message: `Xoá folder "${f.name}"?\n\n${inFolder.length} note bên trong sẽ KHÔNG bị xoá — chỉ bị gỡ khỏi folder.`,
      okLabel: 'Xoá folder',
      danger: true,
    });
    if (!ok) return;
    setItems((prev) =>
      prev.map((n) =>
        n.folderId === folderId ? { ...n, folderId: null, updatedAt: Date.now() } : n,
      ),
    );
    setFolders((prev) => prev.filter((x) => x.id !== folderId));
    if (selection.kind === 'folder' && selection.folderId === folderId) {
      setSelection({ kind: 'all' });
    }
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-inner">Đang tải notes…</div>
      </div>
    );
  }

  const personalFolders = folders.filter((f) => f.category === 'personal');
  const projectFolders = folders.filter((f) => f.category === 'project');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="TrishNote" className="brand-logo" />
          <strong>TrishNote</strong>
        </div>
        <div className="actions">
          <input
            className="search"
            type="search"
            placeholder="Tìm… (Ctrl+F)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Sort dropdown */}
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            title="Sắp xếp"
          >
            {(Object.keys(SORT_LABEL) as SortMode[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>

          {/* + Note dropdown */}
          <div className="add-note-wrap">
            <button onClick={() => setShowAddNoteMenu((v) => !v)}>
              + Note ▾
            </button>
            {showAddNoteMenu && (
              <div
                className="add-note-menu"
                onMouseLeave={() => setShowAddNoteMenu(false)}
              >
                <button
                  className="add-note-item"
                  onClick={() => {
                    setShowAddNoteMenu(false);
                    setComposerCategory('personal');
                  }}
                >
                  📝 Note cá nhân
                  <span className="muted small">Ghi chú nhanh · Ctrl+N</span>
                </button>
                <button
                  className="add-note-item"
                  onClick={() => {
                    setShowAddNoteMenu(false);
                    setComposerCategory('project');
                  }}
                >
                  💼 Note dự án
                  <span className="muted small">Có deadline + tasks</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="topbar-icon"
            onClick={() => setShowSettings(true)}
            title="Cài đặt"
          >
            ⚙
          </button>

          <UserPanel />
        </div>
      </header>

      {error && <div className="error-banner">Lỗi: {error}</div>}

      <div className="main">
        <aside className="sidebar">
          {/* Lối tắt — chỉ pinned items */}
          <section>
            <div className="section-head">
              <h3>📌 Lối tắt</h3>
            </div>
            {pinnedNotes.length === 0 && pinnedFolders.length === 0 && (
              <p className="muted small" style={{ padding: '6px 10px', fontSize: 11 }}>
                Ghim note hoặc folder để xem nhanh ở đây.
                <br />
                Click 📌 trong note hoặc folder.
              </p>
            )}
            {pinnedFolders.map((f) => (
              <FolderItem
                key={f.id}
                folder={f}
                count={activeItems.filter((n) => n.folderId === f.id).length}
                active={selection.kind === 'folder' && selection.folderId === f.id}
                pinned
                urgent={folderHasUrgent.get(f.id)}
                onSelect={() => setSelection({ kind: 'folder', folderId: f.id })}
                onRename={() => void handleRenameFolder(f.id)}
                onDelete={() => void handleDeleteFolder(f.id)}
                onTogglePin={() => handleToggleFolderPin(f.id)}
              />
            ))}
            {pinnedNotes.map((n) => (
              <PinnedNoteRow
                key={n.id}
                note={n}
                active={selectedId === n.id}
                onSelect={() => setSelectedId(n.id)}
                onUnpin={() => handleTogglePin(n.id)}
              />
            ))}
          </section>

          {/* Tất cả */}
          <section>
            <SidebarItem
              active={selection.kind === 'all'}
              count={activeItems.length}
              onClick={() => setSelection({ kind: 'all' })}
            >
              📥 Tất cả note
            </SidebarItem>
          </section>

          {/* Cá nhân */}
          <section>
            <div className="section-head">
              <h3>📝 Cá nhân</h3>
              <button
                className="mini-add"
                onClick={() => void handleAddFolder('personal')}
                title="Thêm folder cá nhân"
              >
                +
              </button>
            </div>
            <SidebarItem
              active={
                selection.kind === 'category' && selection.category === 'personal'
              }
              count={
                activeItems.filter((n) => (n.category ?? 'personal') === 'personal')
                  .length
              }
              onClick={() => setSelection({ kind: 'category', category: 'personal' })}
            >
              <em className="muted">Tất cả note cá nhân</em>
            </SidebarItem>
            {personalFolders.map((f) => (
              <FolderItem
                key={f.id}
                folder={f}
                count={activeItems.filter((n) => n.folderId === f.id).length}
                active={selection.kind === 'folder' && selection.folderId === f.id}
                pinned={f.pinned}
                onSelect={() => setSelection({ kind: 'folder', folderId: f.id })}
                onRename={() => void handleRenameFolder(f.id)}
                onDelete={() => void handleDeleteFolder(f.id)}
                onTogglePin={() => handleToggleFolderPin(f.id)}
                onSetColor={(color) => handleSetFolderColor(f.id, color)}
              />
            ))}
          </section>

          {/* Dự án */}
          <section>
            <div className="section-head">
              <h3>💼 Dự án</h3>
              <button
                className="mini-add"
                onClick={() => void handleAddFolder('project')}
                title="Thêm dự án mới"
              >
                +
              </button>
            </div>
            <SidebarItem
              active={
                selection.kind === 'category' && selection.category === 'project'
              }
              count={activeItems.filter((n) => n.category === 'project').length}
              onClick={() => setSelection({ kind: 'category', category: 'project' })}
            >
              <em className="muted">Tất cả note dự án</em>
            </SidebarItem>
            {projectFolders.length === 0 && (
              <p className="muted small" style={{ padding: '6px 10px' }}>
                Chưa có dự án nào. Click + để tạo.
              </p>
            )}
            {projectFolders.map((f) => (
              <FolderItem
                key={f.id}
                folder={f}
                count={activeItems.filter((n) => n.folderId === f.id).length}
                active={selection.kind === 'folder' && selection.folderId === f.id}
                pinned={f.pinned}
                urgent={folderHasUrgent.get(f.id)}
                onSelect={() => setSelection({ kind: 'folder', folderId: f.id })}
                onRename={() => void handleRenameFolder(f.id)}
                onDelete={() => void handleDeleteFolder(f.id)}
                onTogglePin={() => handleToggleFolderPin(f.id)}
              />
            ))}
          </section>

          {/* Tags */}
          {allTags.length > 0 && (
            <section>
              <h3>🏷 Tags</h3>
              <div className="tag-list">
                {allTags.slice(0, 20).map((t) => (
                  <button
                    key={t}
                    className={
                      selection.kind === 'tag' && selection.tag === t
                        ? 'tag active'
                        : 'tag'
                    }
                    onClick={() => setSelection({ kind: 'tag', tag: t })}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Thùng rác */}
          <section>
            <SidebarItem
              active={selection.kind === 'trash'}
              count={trashedItems.length}
              onClick={() => setSelection({ kind: 'trash' })}
            >
              🗑 Thùng rác
            </SidebarItem>
            {trashedItems.length > 0 && (
              <p className="muted small" style={{ padding: '4px 10px', fontSize: 10 }}>
                Xoá vĩnh viễn sau {TRASH_RETENTION_DAYS} ngày
              </p>
            )}
          </section>
        </aside>

        <main className="content">
          <div className="content-head">
            <h2>{describeSelection(selection, folders)}</h2>
            <span className="muted small">{filtered.length} note</span>
            {selection.kind === 'trash' && trashedItems.length > 0 && (
              <button
                className="btn btn-ghost mini-btn danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => void handleEmptyTrash()}
              >
                🗑 Đổ thùng rác
              </button>
            )}
          </div>
          <ListView
            items={filtered}
            folders={folders}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTogglePin={handleTogglePin}
            onRestore={handleRestore}
            onPurge={handlePurge}
            onDuplicate={handleDuplicate}
            now={now}
            isProjectView={isProjectView(selection, folders)}
            isTrashView={selection.kind === 'trash'}
            sortMode={sortMode}
            search={search}
          />
        </main>

        {selected && (
          <aside className="detail">
            <DetailPane
              note={selected}
              folders={folders}
              uid={profile?.id ?? ''}
              systemFonts={systemFonts}
              onEdit={handleEdit}
              onMove={handleMove}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        )}
      </div>

      <footer className="statusbar">
        <span className="path" title={location?.path ?? ''}>
          {location?.path ?? '—'}
        </span>
        <span>
          {savingFlash ? 'Đang lưu…' : `${activeItems.length} note · ${folders.length} folder`}
        </span>
      </footer>

      {composerCategory && (
        <ComposerModal
          category={composerCategory}
          folders={folders.filter((f) => f.category === composerCategory)}
          systemFonts={systemFonts}
          uid={profile?.id ?? ''}
          defaultFolderId={
            selection.kind === 'folder' ? selection.folderId : null
          }
          onSubmit={handleCreate}
          onClose={() => setComposerCategory(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          store={{ schema: 2, notes: items, folders }}
          storePath={storePath}
          settings={appSettings}
          systemFonts={systemFonts}
          onSettingsChange={setAppSettings}
          onClose={() => setShowSettings(false)}
          onImported={(imported) => {
            const noteMap = new Map<string, NoteV2>();
            for (const n of items) noteMap.set(n.id, n);
            for (const n of imported.notes) {
              const ex = noteMap.get(n.id);
              if (!ex || (n.updatedAt ?? 0) >= (ex.updatedAt ?? 0))
                noteMap.set(n.id, n);
            }
            const folderMap = new Map<string, Folder>();
            for (const f of folders) folderMap.set(f.id, f);
            for (const f of imported.folders) {
              const ex = folderMap.get(f.id);
              if (!ex || (f.updatedAt ?? 0) >= (ex.updatedAt ?? 0))
                folderMap.set(f.id, f);
            }
            setItems(Array.from(noteMap.values()));
            setFolders(Array.from(folderMap.values()));
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function isProjectView(selection: Selection, folders: Folder[]): boolean {
  if (selection.kind === 'category') return selection.category === 'project';
  if (selection.kind === 'folder') {
    const f = folders.find((x) => x.id === selection.folderId);
    return f?.category === 'project';
  }
  return false;
}

function describeSelection(selection: Selection, folders: Folder[]): string {
  if (selection.kind === 'all') return 'Tất cả note';
  if (selection.kind === 'pinned') return '📌 Đã ghim';
  if (selection.kind === 'category')
    return selection.category === 'project' ? '💼 Tất cả dự án' : '📝 Tất cả note cá nhân';
  if (selection.kind === 'folder') {
    const f = folders.find((x) => x.id === selection.folderId);
    return f ? `${f.icon ?? '📁'} ${f.name}` : 'Folder không tồn tại';
  }
  if (selection.kind === 'tag') return `#${selection.tag}`;
  return '';
}

interface SidebarItemProps {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}
function SidebarItem({
  active,
  count,
  onClick,
  children,
}: SidebarItemProps): JSX.Element {
  return (
    <button className={`status-pill ${active ? 'active' : ''}`} onClick={onClick}>
      <span>{children}</span>
      <span className="count">{count}</span>
    </button>
  );
}

const FOLDER_COLOR_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#64748b',
];

interface FolderItemProps {
  folder: Folder;
  count: number;
  active: boolean;
  pinned?: boolean;
  urgent?: { count: number; minDays: number };
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSetColor?: (color: string | null) => void;
}
function FolderItem({
  folder,
  count,
  active,
  pinned,
  urgent,
  onSelect,
  onRename,
  onDelete,
  onTogglePin,
  onSetColor,
}: FolderItemProps): JSX.Element {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isProject = folder.category === 'project';
  const className = [
    'folder-row',
    active ? 'active' : '',
    pinned ? 'pinned' : '',
    urgent ? 'urgent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={folder.color ? { '--folder-color': folder.color } as React.CSSProperties : undefined}>
      {folder.color && <span className="folder-color-tag" style={{ background: folder.color }} />}
      <button className="folder-main" onClick={onSelect}>
        <span>{folder.icon ?? '📁'}</span>
        <span className="folder-name">{folder.name}</span>
        {urgent && (
          <span
            className="urgent-badge"
            title={`${urgent.count} note đang làm có deadline gần (${urgent.minDays}n nữa)`}
          >
            ⏰{urgent.count}
          </span>
        )}
        <span className="count">{count}</span>
      </button>
      <button
        className={`folder-action ${pinned ? 'is-pinned' : ''}`}
        onClick={onTogglePin}
        title={pinned ? 'Bỏ ghim' : 'Ghim lên Lối tắt'}
      >
        📌
      </button>
      {isProject && onSetColor && (
        <div className="folder-color-wrap">
          <button
            className="folder-action"
            onClick={() => setShowColorPicker((v) => !v)}
            title="Đổi màu nhãn"
            style={folder.color ? { color: folder.color } : undefined}
          >
            ●
          </button>
          {showColorPicker && (
            <div
              className="color-picker"
              onMouseLeave={() => setShowColorPicker(false)}
            >
              {FOLDER_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="color-swatch"
                  style={{ background: c }}
                  title={c}
                  onClick={() => {
                    onSetColor(c);
                    setShowColorPicker(false);
                  }}
                />
              ))}
              <button
                type="button"
                className="color-swatch color-clear"
                title="Xoá màu"
                onClick={() => {
                  onSetColor(null);
                  setShowColorPicker(false);
                }}
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}
      <button className="folder-action" onClick={onRename} title="Đổi tên">
        ✎
      </button>
      <button
        className="folder-action folder-action-danger"
        onClick={onDelete}
        title="Xoá folder"
      >
        ×
      </button>
    </div>
  );
}

function PinnedNoteRow({
  note,
  active,
  onSelect,
  onUnpin,
}: {
  note: NoteV2;
  active: boolean;
  onSelect: () => void;
  onUnpin: () => void;
}): JSX.Element {
  return (
    <div className={`folder-row pinned-note ${active ? 'active' : ''}`}>
      <button className="folder-main" onClick={onSelect}>
        <span>{note.category === 'project' ? '💼' : '📝'}</span>
        <span className="folder-name">{note.title || '(không tiêu đề)'}</span>
      </button>
      <button
        className="folder-action is-pinned"
        onClick={onUnpin}
        title="Bỏ ghim"
      >
        📌
      </button>
    </div>
  );
}

function applySortMode(list: NoteV2[], mode: SortMode): NoteV2[] {
  const out = [...list];
  switch (mode) {
    case 'updated-desc':
      out.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    case 'updated-asc':
      out.sort((a, b) => a.updatedAt - b.updatedAt);
      break;
    case 'created-desc':
      out.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'title-asc':
      out.sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', 'vi', { sensitivity: 'base' }),
      );
      break;
  }
  return out;
}

function ListView({
  items,
  folders,
  selectedId,
  onSelect,
  onTogglePin,
  onRestore,
  onPurge,
  onDuplicate,
  now,
  isProjectView,
  isTrashView,
  sortMode,
  search,
}: {
  items: NoteV2[];
  folders: Folder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => Promise<void>;
  onDuplicate: (id: string) => void;
  now: number;
  isProjectView: boolean;
  isTrashView: boolean;
  sortMode: SortMode;
  search: string;
}): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="empty-pane">
        {isTrashView
          ? '🗑 Thùng rác trống.'
          : 'Không có note nào. Tạo note mới ở topbar (Ctrl+N).'}
      </div>
    );
  }

  // Trash view — flat sorted by deletedAt desc
  if (isTrashView) {
    const sorted = [...items].sort(
      (a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0),
    );
    return (
      <ul className="note-list">
        {sorted.map((n) => (
          <TrashRow
            key={n.id}
            note={n}
            now={now}
            onRestore={() => onRestore(n.id)}
            onPurge={() => void onPurge(n.id)}
          />
        ))}
      </ul>
    );
  }

  // Project view → group theo status, pinned first trong từng group
  if (isProjectView) {
    const groups: Record<string, NoteV2[]> = {
      active: [],
      inbox: [],
      done: [],
    };
    for (const n of items) {
      const s = (n.status ?? 'inbox') as string;
      if (groups[s]) groups[s].push(n);
      else groups.inbox.push(n);
    }
    for (const k of Object.keys(groups)) {
      const sorted = applySortMode(groups[k], sortMode);
      groups[k] = sorted.sort(
        (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
      );
    }
    const order: NoteStatus[] = ['active', 'inbox', 'done'];
    return (
      <ul className="note-list note-list-grouped">
        {order.map((status) => {
          const list = groups[status];
          if (!list || list.length === 0) return null;
          return (
            <li key={status} className="note-group">
              <div
                className="note-group-divider"
                style={{ '--group-color': PROJECT_STATUS_COLOR[status] } as React.CSSProperties}
              >
                <span className="group-color-tag" />
                <span className="group-label">{PROJECT_STATUS_LABEL[status]}</span>
                <span className="muted small">{list.length}</span>
              </div>
              <ul className="note-list">
                {list.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    folder={folders.find((f) => f.id === n.folderId) ?? null}
                    selected={selectedId === n.id}
                    search={search}
                    onClick={() => onSelect(n.id)}
                    onTogglePin={() => onTogglePin(n.id)}
                    onDuplicate={() => onDuplicate(n.id)}
                    now={now}
                  />
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    );
  }

  // Personal/all/tag → flat list, pinned first then sortMode
  const sorted = applySortMode(items, sortMode).sort(
    (a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false),
  );
  return (
    <ul className="note-list">
      {sorted.map((n) => (
        <NoteRow
          key={n.id}
          note={n}
          folder={folders.find((f) => f.id === n.folderId) ?? null}
          selected={selectedId === n.id}
          search={search}
          onClick={() => onSelect(n.id)}
          onTogglePin={() => onTogglePin(n.id)}
          onDuplicate={() => onDuplicate(n.id)}
          now={now}
        />
      ))}
    </ul>
  );
}

function TrashRow({
  note,
  now,
  onRestore,
  onPurge,
}: {
  note: NoteV2;
  now: number;
  onRestore: () => void;
  onPurge: () => void;
}): JSX.Element {
  const deletedDays = note.deletedAt
    ? Math.floor((now - note.deletedAt) / DAY_MS)
    : 0;
  const remainingDays = TRASH_RETENTION_DAYS - deletedDays;
  return (
    <li className="note-row trash-row">
      <div className="note-row-top">
        <strong className="title">{note.title || '(không tiêu đề)'}</strong>
        <span className="muted small">
          xoá {deletedDays}n trước · còn {remainingDays}n
        </span>
      </div>
      <div className="note-row-bottom">
        <button className="btn btn-ghost mini-btn" onClick={onRestore}>
          ↺ Khôi phục
        </button>
        <button
          className="btn btn-ghost mini-btn danger"
          onClick={onPurge}
        >
          🗑 Xoá vĩnh viễn
        </button>
      </div>
    </li>
  );
}

function NoteRow({
  note,
  folder,
  selected,
  search,
  onClick,
  onTogglePin,
  onDuplicate,
  now,
}: {
  note: NoteV2;
  folder: Folder | null;
  selected: boolean;
  search: string;
  onClick: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
  now: number;
}): JSX.Element {
  const status = note.status ?? 'inbox';
  const isProject = note.category === 'project';
  // Plain preview: strip HTML tags
  const preview = stripHtml(note.body || '').slice(0, 120);
  const deadlineInfo = note.deadline
    ? formatDeadline(note.deadline, now)
    : null;
  const taskProgress = isProject && note.tasks && note.tasks.length > 0
    ? `${note.tasks.filter((t) => t.done).length}/${note.tasks.length}`
    : null;
  return (
    <li
      className={`note-row ${selected ? 'selected' : ''} ${note.pinned ? 'pinned' : ''}`}
      data-status={status}
      data-category={note.category ?? 'personal'}
      onClick={onClick}
      style={folder?.color ? ({ '--note-color': folder.color } as React.CSSProperties) : undefined}
    >
      {folder?.color && <span className="note-color-strip" style={{ background: folder.color }} />}
      <div className="note-row-top">
        <strong className="title">
          {highlightSearch(note.title || '(không tiêu đề)', search)}
        </strong>
        {isProject && (
          <span className="status-badge" data-status={status}>
            {PROJECT_STATUS_LABEL[status] ?? notes.statusLabel(status)}
          </span>
        )}
        <button
          type="button"
          className="row-action"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Nhân đôi"
        >
          ⎘
        </button>
        <button
          type="button"
          className={`row-pin ${note.pinned ? 'is-pinned' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          title={note.pinned ? 'Bỏ ghim' : 'Ghim lên Lối tắt'}
        >
          📌
        </button>
      </div>
      {preview && (
        <div className="preview muted">
          {highlightSearch(preview, search)}
        </div>
      )}
      <div className="note-row-bottom">
        {note.tags.map((t) => (
          <span key={t} className="tag-chip">
            #{t}
          </span>
        ))}
        {taskProgress && (
          <span className="task-chip">✓ {taskProgress}</span>
        )}
        {deadlineInfo && (
          <span className={`deadline-chip ${deadlineInfo.urgent ? 'urgent' : ''}`}>
            {deadlineInfo.label}
          </span>
        )}
      </div>
    </li>
  );
}

/** Highlight chuỗi search trong text, return React fragment với <mark>. */
function highlightSearch(text: string, search: string): React.ReactNode {
  const q = search.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(qLower, i);
  let key = 0;
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={`m${key++}`} className="search-hit">
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
    idx = lower.indexOf(qLower, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts.length > 0 ? <>{parts}</> : text;
}

function stripHtml(s: string): string {
  if (!s) return '';
  if (!/<[a-z\/!][^>]*>/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDeadline(
  deadlineMs: number,
  nowMs: number,
): { label: string; urgent: boolean } {
  const days = Math.floor((deadlineMs - nowMs) / DAY_MS);
  if (days < 0) return { label: `⏰ Quá hạn ${-days}n`, urgent: true };
  if (days === 0) return { label: '⏰ Hôm nay', urgent: true };
  if (days === 1) return { label: '⏰ Mai', urgent: true };
  if (days <= 3) return { label: `⏰ ${days}n nữa`, urgent: true };
  if (days <= 7) return { label: `⏰ ${days}n nữa`, urgent: false };
  return { label: `⏰ ${days}n nữa`, urgent: false };
}

function DetailPane({
  note,
  folders,
  uid,
  systemFonts,
  onEdit,
  onMove,
  onTogglePin,
  onDelete,
  onClose,
}: {
  note: NoteV2;
  folders: Folder[];
  uid: string;
  systemFonts: string[];
  onEdit: (id: string, patch: Partial<NoteV2>) => void;
  onMove: (id: string, status: NoteStatus) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const dialog = useDialog();
  const isProject = note.category === 'project';
  const tasks = note.tasks ?? [];
  const compatFolders = folders.filter(
    (f) => f.category === (note.category ?? 'personal'),
  );

  async function addTask(): Promise<void> {
    const text = await dialog.prompt({
      title: '✓ Thêm task mới',
      placeholder: 'Mô tả task',
      okLabel: 'Thêm',
    });
    if (!text?.trim()) return;
    const t: Task = {
      id: genTaskId(),
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
    };
    onEdit(note.id, { tasks: [...tasks, t] });
  }

  // ===== Attachments =====
  const attachments = note.attachments ?? [];

  async function handleAttachFile(): Promise<void> {
    const src = await pickFileForAttach();
    if (!src) return;
    try {
      const result = await attachFile(uid, note.id, src);
      const att: Attachment = {
        id: genAttachmentId(),
        kind: 'file',
        name: result.original_name,
        path: result.stored_path,
        sizeBytes: result.size_bytes,
        addedAt: Date.now(),
      };
      onEdit(note.id, { attachments: [...attachments, att] });
    } catch (err) {
      await dialog.confirm({
        title: '⚠ Lỗi đính kèm',
        message: err instanceof Error ? err.message : String(err),
        okLabel: 'OK',
        cancelLabel: '',
      });
    }
  }

  async function handleAttachLink(isDirectory: boolean): Promise<void> {
    const path = await pickPathForLink(isDirectory);
    if (!path?.trim()) return;
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const att: Attachment = {
      id: genAttachmentId(),
      kind: 'link',
      name,
      path,
      addedAt: Date.now(),
    };
    onEdit(note.id, { attachments: [...attachments, att] });
  }

  async function handleOpenAttachment(att: Attachment): Promise<void> {
    try {
      await openLocalPath(att.path);
    } catch {
      await dialog.confirm({
        title: '⚠ Không mở được',
        message: `Path không tồn tại hoặc bị di chuyển:\n${att.path}`,
        okLabel: 'OK',
        cancelLabel: '',
      });
    }
  }

  async function handleRemoveAttachment(att: Attachment): Promise<void> {
    const ok = await dialog.confirm({
      title: 'Gỡ đính kèm',
      message:
        att.kind === 'file'
          ? `Gỡ + xoá file đã copy "${att.name}"?\n\nFile gốc trên máy KHÔNG bị xoá.`
          : `Gỡ link "${att.name}"?\n\nFile/folder gốc KHÔNG bị xoá.`,
      okLabel: 'Gỡ',
      danger: true,
    });
    if (!ok) return;
    if (att.kind === 'file') {
      try {
        await removeAttachedFile(att.path);
      } catch {
        /* ignore */
      }
    }
    onEdit(note.id, {
      attachments: attachments.filter((a) => a.id !== att.id),
    });
  }

  function toggleTask(taskId: string): void {
    onEdit(note.id, {
      tasks: tasks.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t,
      ),
    });
  }
  function deleteTask(taskId: string): void {
    onEdit(note.id, { tasks: tasks.filter((t) => t.id !== taskId) });
  }
  function setDeadline(input: string): void {
    if (!input) {
      onEdit(note.id, { deadline: null });
      return;
    }
    const ts = new Date(input).getTime();
    if (Number.isNaN(ts)) return;
    onEdit(note.id, { deadline: ts });
  }

  return (
    <div className="detail-inner">
      <header className="detail-head">
        <h2>
          {note.category === 'project' ? '💼 Dự án' : '📝 Cá nhân'}
        </h2>
        <button
          className={`mini ${note.pinned ? 'is-pinned' : ''}`}
          onClick={() => onTogglePin(note.id)}
          title={note.pinned ? 'Bỏ ghim' : 'Ghim lên Lối tắt'}
        >
          📌
        </button>
        <button className="mini" onClick={onClose}>
          ×
        </button>
      </header>
      <label className="field">
        <span>Tiêu đề</span>
        <input
          value={note.title}
          onChange={(e) => onEdit(note.id, { title: e.target.value })}
          maxLength={200}
        />
      </label>
      <div className="field">
        <span>Nội dung</span>
        <RichTextEditor
          value={note.body}
          onChange={(html) =>
            onEdit(note.id, { body: html, bodyFormat: 'html' })
          }
          systemFonts={systemFonts}
          fontFamily={note.style?.fontFamily}
          onFontFamilyChange={(family) =>
            onEdit(note.id, {
              style: { ...note.style, fontFamily: family || undefined },
            })
          }
          fontSize={note.style?.fontSize}
          onFontSizeChange={(size) =>
            onEdit(note.id, {
              style: { ...note.style, fontSize: size > 0 ? size : undefined },
            })
          }
          showReset={Boolean(note.style?.fontFamily || note.style?.fontSize)}
          onReset={() => onEdit(note.id, { style: undefined })}
          minHeight={220}
        />
      </div>

      {isProject && (
        <>
          <label className="field">
            <span>⏰ Deadline</span>
            <input
              type="datetime-local"
              value={
                note.deadline
                  ? new Date(note.deadline).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>

          <div className="field">
            <span>✓ Tasks ({tasks.filter((t) => t.done).length}/{tasks.length})</span>
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id} className={t.done ? 'task-done' : ''}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                  />
                  <span>{t.text}</span>
                  <button className="mini" onClick={() => deleteTask(t.id)}>×</button>
                </li>
              ))}
            </ul>
            <button className="btn-add-task" onClick={addTask}>
              + Thêm task
            </button>
          </div>
        </>
      )}

      {/* Status — chỉ hiện cho note dự án */}
      {isProject && (
        <div className="detail-row">
          <span>Trạng thái</span>
          <select
            value={note.status ?? 'inbox'}
            onChange={(e) => onMove(note.id, e.target.value as NoteStatus)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Folder — chỉ hiện khi đã có ≥1 folder */}
      {compatFolders.length > 0 && (
        <div className="detail-row">
          <span>Folder</span>
          <select
            value={note.folderId ?? ''}
            onChange={(e) =>
              onEdit(note.id, { folderId: e.target.value || null })
            }
          >
            <option value="">— Chưa xếp folder —</option>
            {compatFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon ?? '📁'} {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="detail-row">
        <span>Tags</span>
        <input
          value={note.tags.join(', ')}
          onChange={(e) =>
            onEdit(note.id, {
              tags: e.target.value
                .split(',')
                .map((t) => notes.normalizeTag(t))
                .filter((t) => t.length > 0),
            })
          }
          placeholder="vd: study, blog"
        />
      </div>

      <div className="detail-row">
        <span>Tạo</span>
        <span className="muted tiny">{formatDate(note.createdAt)}</span>
      </div>

      {/* Phase 17.2 v3 — Attachments + links */}
      <div className="field">
        <span>📎 Đính kèm ({attachments.length})</span>
        {attachments.length === 0 && (
          <p className="muted small" style={{ margin: '4px 0 8px' }}>
            Đính kèm file (copy vào TrishNote) hoặc gắn link folder/file local.
          </p>
        )}
        {attachments.length > 0 && (
          <ul className="attachment-list">
            {attachments.map((att) => (
              <li key={att.id} className={`attachment-row att-kind-${att.kind}`}>
                <span className="att-icon">
                  {att.kind === 'file' ? '📎' : '🔗'}
                </span>
                <button
                  type="button"
                  className="att-name"
                  onClick={() => void handleOpenAttachment(att)}
                  title={att.path}
                >
                  {att.name}
                  {att.sizeBytes ? (
                    <span className="muted small"> · {formatBytes(att.sizeBytes)}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="mini"
                  onClick={() => void handleRemoveAttachment(att)}
                  title={att.kind === 'file' ? 'Gỡ + xoá file' : 'Gỡ link'}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="attachment-add-row">
          <button className="btn-add-task" onClick={() => void handleAttachFile()}>
            📎 Thêm file
          </button>
          <button
            className="btn-add-task"
            onClick={() => void handleAttachLink(false)}
          >
            🔗 Gắn link file
          </button>
          <button
            className="btn-add-task"
            onClick={() => void handleAttachLink(true)}
          >
            📁 Gắn link folder
          </button>
        </div>
      </div>

      {/* Stats: word + char count */}
      <div className="detail-row detail-stats">
        <span className="muted small">
          {countWords(note.body)} từ · {countChars(note.body)} ký tự
        </span>
      </div>

      <div className="detail-actions">
        <button className="danger" onClick={() => onDelete(note.id)}>
          🗑 Xoá vào thùng rác
        </button>
      </div>
    </div>
  );
}

/** Đếm số từ trong HTML body. */
function countWords(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/** Đếm số ký tự visible trong HTML body. */
function countChars(html: string): number {
  if (!html) return 0;
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .length;
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

function ComposerModal({
  category,
  folders,
  systemFonts,
  uid: userUid,
  defaultFolderId,
  onSubmit,
  onClose,
}: {
  category: NoteCategory;
  folders: Folder[];
  systemFonts: string[];
  uid: string;
  defaultFolderId: string | null;
  onSubmit: (draft: {
    title: string;
    body: string;
    bodyFormat: 'plain' | 'html';
    tagsInput: string;
    status: NoteStatus;
    category: NoteCategory;
    folderId: string | null;
    deadline: number | null;
    tasks: Task[];
    attachments: Attachment[];
    style: NoteV2['style'];
  }) => void;
  onClose: () => void;
}): JSX.Element {
  const dialog = useDialog();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<NoteStatus>('inbox');
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [deadline, setDeadlineStr] = useState('');
  const [tasksDraft, setTasksDraft] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [draftStyle, setDraftStyle] = useState<NoteV2['style']>(undefined);

  // Pre-generate id để attach file vào dir của note này (chưa được persist
  // nhưng Rust chỉ care về path, sẽ flush qua dir attachments/{uid}/{tmpId}/)
  const [draftId] = useState<string>(() => 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36));

  const isProject = category === 'project';

  function addTaskDraft(): void {
    if (!taskInput.trim()) return;
    setTasksDraft((prev) => [
      ...prev,
      {
        id: genTaskId(),
        text: taskInput.trim(),
        done: false,
        createdAt: Date.now(),
      },
    ]);
    setTaskInput('');
  }

  async function handleAttachFile(): Promise<void> {
    const src = await pickFileForAttach();
    if (!src) return;
    try {
      const result = await attachFile(userUid, draftId, src);
      const att: Attachment = {
        id: genAttachmentId(),
        kind: 'file',
        name: result.original_name,
        path: result.stored_path,
        sizeBytes: result.size_bytes,
        addedAt: Date.now(),
      };
      setDraftAttachments((prev) => [...prev, att]);
    } catch (err) {
      await dialog.confirm({
        title: '⚠ Lỗi đính kèm',
        message: err instanceof Error ? err.message : String(err),
        okLabel: 'OK',
        cancelLabel: '',
      });
    }
  }

  async function handleAttachLink(isDirectory: boolean): Promise<void> {
    const path = await pickPathForLink(isDirectory);
    if (!path?.trim()) return;
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const att: Attachment = {
      id: genAttachmentId(),
      kind: 'link',
      name,
      path,
      addedAt: Date.now(),
    };
    setDraftAttachments((prev) => [...prev, att]);
  }

  function removeDraftAttachment(att: Attachment): void {
    if (att.kind === 'file') {
      void removeAttachedFile(att.path).catch(() => {});
    }
    setDraftAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  async function cancelComposer(): Promise<void> {
    // Cleanup attached files đã copy nhưng note chưa save
    for (const att of draftAttachments) {
      if (att.kind === 'file') {
        try {
          await removeAttachedFile(att.path);
        } catch {
          /* ignore */
        }
      }
    }
    onClose();
  }

  function submit(): void {
    onSubmit({
      title,
      body,
      bodyFormat: 'html',
      tagsInput,
      status,
      category,
      folderId,
      deadline: deadline ? new Date(deadline).getTime() : null,
      tasks: tasksDraft,
      attachments: draftAttachments,
      style: draftStyle,
    });
  }

  return (
    <div className="modal-backdrop" onClick={() => void cancelComposer()}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{isProject ? '💼 Note dự án mới' : '📝 Note cá nhân mới'}</h2>
          <button className="mini" onClick={() => void cancelComposer()}>×</button>
        </header>

        <div className="modal-body">
          <label className="field">
            <span>Tiêu đề</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={isProject ? 'Tên dự án / việc cần làm' : 'Tiêu đề ngắn'}
            />
          </label>

          <div className="field">
            <span>Nội dung</span>
            <RichTextEditor
              value={body}
              onChange={setBody}
              systemFonts={systemFonts}
              fontFamily={draftStyle?.fontFamily}
              onFontFamilyChange={(family) =>
                setDraftStyle((prev) => ({ ...prev, fontFamily: family || undefined }))
              }
              fontSize={draftStyle?.fontSize}
              onFontSizeChange={(size) =>
                setDraftStyle((prev) => ({ ...prev, fontSize: size > 0 ? size : undefined }))
              }
              showReset={Boolean(draftStyle?.fontFamily || draftStyle?.fontSize)}
              onReset={() => setDraftStyle(undefined)}
              minHeight={isProject ? 140 : 200}
              placeholder="Nội dung — dùng toolbar để in đậm, list..."
            />
          </div>

          {isProject && (
            <>
              <label className="field">
                <span>⏰ Deadline (tuỳ chọn)</span>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadlineStr(e.target.value)}
                />
              </label>
              <div className="field">
                <span>✓ Tasks (có thể thêm sau)</span>
                <ul className="task-list">
                  {tasksDraft.map((t, i) => (
                    <li key={t.id}>
                      <span>•</span>
                      <span>{t.text}</span>
                      <button
                        className="mini"
                        onClick={() =>
                          setTasksDraft((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTaskDraft();
                      }
                    }}
                    placeholder="Tên task — Enter để thêm"
                  />
                  <button onClick={addTaskDraft}>+</button>
                </div>
              </div>
            </>
          )}

          {/* Folder */}
          {folders.length > 0 && (
            <label className="field">
              <span>Folder</span>
              <select
                value={folderId ?? ''}
                onChange={(e) => setFolderId(e.target.value || null)}
              >
                <option value="">— Chưa xếp folder —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.icon ?? '📁'} {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field">
            <span>Tags (phân cách dấu phẩy)</span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="vd: study, blog"
            />
          </label>

          {isProject && (
            <label className="field">
              <span>Trạng thái</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as NoteStatus)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABEL[s] ?? s}</option>
                ))}
              </select>
            </label>
          )}

          {/* Attachments — giống DetailPane */}
          <div className="field">
            <span>📎 Đính kèm ({draftAttachments.length})</span>
            {draftAttachments.length > 0 && (
              <ul className="attachment-list">
                {draftAttachments.map((att) => (
                  <li key={att.id} className={`attachment-row att-kind-${att.kind}`}>
                    <span className="att-icon">
                      {att.kind === 'file' ? '📎' : '🔗'}
                    </span>
                    <span className="att-name" title={att.path}>
                      {att.name}
                      {att.sizeBytes ? (
                        <span className="muted small"> · {formatBytes(att.sizeBytes)}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="mini"
                      onClick={() => removeDraftAttachment(att)}
                      title="Gỡ"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="attachment-add-row">
              <button
                type="button"
                className="btn-add-task"
                onClick={() => void handleAttachFile()}
              >
                📎 Thêm file
              </button>
              <button
                type="button"
                className="btn-add-task"
                onClick={() => void handleAttachLink(false)}
              >
                🔗 Gắn link file
              </button>
              <button
                type="button"
                className="btn-add-task"
                onClick={() => void handleAttachLink(true)}
              >
                📁 Gắn link folder
              </button>
            </div>
          </div>
        </div>

        <div className="review-actions">
          <button onClick={() => void cancelComposer()}>Huỷ</button>
          <button className="primary" onClick={submit}>Tạo</button>
        </div>
      </div>
    </div>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

