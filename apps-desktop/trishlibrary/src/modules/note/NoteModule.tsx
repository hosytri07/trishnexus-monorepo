/**
 * Phase 18.2.a — Note Module.
 *
 * Functional notes app embedded trong TrishLibrary 3.0.
 * Layout 3-col: Sidebar (folders + filter) | Note list | Editor
 *
 * Tính năng MVP:
 *  - CRUD note (TipTap rich-text editor)
 *  - Folder system (default + user-created)
 *  - Personal & Project category
 *  - Pin notes + folders
 *  - Tags
 *  - Search
 *  - Trash bin (soft-delete, restore)
 *  - Color picker
 *  - Sort: updated/created/title
 *  - Word count
 *  - File/link attachments
 *  - Auto-save 1.5s debounce
 *  - System fonts dropdown
 *
 * Persist: %LocalAppData%\TrishTEAM\TrishLibrary\notes.{uid}.json
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  type Folder,
  type Note,
  type NoteCategory,
  type NoteStatus,
  type NoteStore,
  emptyStore,
  formatRelativeTime,
  genId,
  stripHtml,
} from './types.js';
import {
  attachFileToNote,
  listSystemFonts,
  loadNoteStore,
  openLocalPath,
  pickFileForAttach,
  pickFolderForAttach,
  removeAttachedFile,
  saveNoteStore,
} from './tauri-bridge.js';
import { NoteTemplatePicker } from './NoteTemplatePicker.js';
import { exportNoteToHtml } from './note-html-export.js';
import { NoteStatsModal } from './NoteStatsModal.js';
import { InputModal, type InputModalProps } from '../../components/InputModal.js';

const AUTO_SAVE_DELAY = 1500;
const TRASH_RETAIN_DAYS = 30;

type Selection =
  | { kind: 'all' }
  | { kind: 'pinned' }
  | { kind: 'category'; category: NoteCategory }
  | { kind: 'folder'; folderId: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'trash' };

type SortMode = 'updated-desc' | 'updated-asc' | 'created-desc' | 'title-asc';

const COLOR_PALETTE = [
  null,
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
];

interface ModuleProps {
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

export function NoteModule({ tr }: ModuleProps): JSX.Element {
  const { profile } = useAuth();
  const uid = profile?.id ?? null;

  const [store, setStore] = useState<NoteStore>(() => emptyStore());
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection>({ kind: 'all' });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated-desc');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [inputModal, setInputModal] = useState<InputModalProps | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const initRef = useRef(false);

  // Phase 18.4 — Consume pending_select / pending_create hint từ cross-module bus
  useEffect(() => {
    function checkPending(): void {
      try {
        // 1) pending_select — Ctrl+K result, jump to existing note
        const selectId = window.localStorage.getItem('trishlibrary.note.pending_select');
        if (selectId) {
          window.localStorage.removeItem('trishlibrary.note.pending_select');
          setActiveNoteId(selectId);
          setSelection({ kind: 'all' });
        }

        // 2) pending_create — Library/Image button → tạo note mới prefilled
        const createRaw = window.localStorage.getItem('trishlibrary.note.pending_create');
        if (createRaw) {
          window.localStorage.removeItem('trishlibrary.note.pending_create');
          const req = JSON.parse(createRaw) as {
            title: string;
            content_html: string;
            category: 'personal' | 'project';
            tags?: string[];
          };
          const id = genId('n');
          const now = Date.now();
          const folderId = req.category === 'project' ? 'default-project' : 'default-personal';
          const newNote: Note = {
            id,
            folder_id: folderId,
            category: req.category,
            title: req.title,
            content_html: req.content_html,
            tags: req.tags ?? [],
            pinned: false,
            status: 'inbox',
            deadline: null,
            attachments: [],
            trashed: false,
            trashed_at: null,
            color: null,
            created_at: now,
            updated_at: now,
          };
          setStore((s) => ({ ...s, notes: [newNote, ...s.notes] }));
          setActiveNoteId(id);
          setSelection({ kind: 'all' });
        }
      } catch {
        /* ignore */
      }
    }
    checkPending();
    // Also check when window gains focus (in case Ctrl+K triggered a switch)
    const onFocus = (): void => checkPending();
    window.addEventListener('focus', onFocus);
    // Also listen for module-switch event to re-check immediately after AppShell switches
    const onSwitch = (): void => {
      // small delay to ensure AppShell completes the switch first
      window.setTimeout(checkPending, 50);
    };
    window.addEventListener('trishlibrary:switch-module', onSwitch);
    return (): void => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('trishlibrary:switch-module', onSwitch);
    };
  }, []);

  // ===== Initial load =====
  useEffect(() => {
    if (initRef.current || !uid) return;
    initRef.current = true;
    setLoading(true);
    void (async () => {
      try {
        const loaded = await loadNoteStore(uid);
        setStore(loaded);
      } catch (err) {
        console.warn('[note] load fail:', err);
      } finally {
        setLoading(false);
      }
    })();
    void listSystemFonts().then(setSystemFonts);
  }, [uid]);

  // Auto-purge old trash > 30 days
  useEffect(() => {
    if (loading) return;
    const cutoff = Date.now() - TRASH_RETAIN_DAYS * 24 * 60 * 60 * 1000;
    const purged = store.notes.filter(
      (n) => !n.trashed || (n.trashed_at ?? Date.now()) > cutoff,
    );
    if (purged.length !== store.notes.length) {
      setStore((s) => ({ ...s, notes: purged }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Auto-save debounced
  useEffect(() => {
    if (loading || !uid) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await saveNoteStore(uid, store);
          setSavedFlash(true);
          setTimeout(() => setSavedFlash(false), 800);
        } catch (err) {
          console.warn('[note] save fail:', err);
        }
      })();
    }, AUTO_SAVE_DELAY);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, uid, loading]);

  // ===== Derived =====
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of store.notes) {
      if (n.trashed) continue;
      for (const t of n.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [store.notes]);

  const filteredNotes = useMemo(() => {
    let list = store.notes;
    if (selection.kind === 'trash') {
      list = list.filter((n) => n.trashed);
    } else {
      list = list.filter((n) => !n.trashed);
      if (selection.kind === 'pinned') {
        list = list.filter((n) => n.pinned);
      } else if (selection.kind === 'category') {
        list = list.filter((n) => n.category === selection.category);
      } else if (selection.kind === 'folder') {
        list = list.filter((n) => n.folder_id === selection.folderId);
      } else if (selection.kind === 'tag') {
        list = list.filter((n) => n.tags.includes(selection.tag));
      }
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.content_html).toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    switch (sortMode) {
      case 'updated-desc':
        sorted.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updated_at - a.updated_at;
        });
        break;
      case 'updated-asc':
        sorted.sort((a, b) => a.updated_at - b.updated_at);
        break;
      case 'created-desc':
        sorted.sort((a, b) => b.created_at - a.created_at);
        break;
      case 'title-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
        break;
    }
    return sorted;
  }, [store.notes, selection, search, sortMode]);

  const activeNote = useMemo(
    () => store.notes.find((n) => n.id === activeNoteId) ?? null,
    [store.notes, activeNoteId],
  );

  const totalActive = store.notes.filter((n) => !n.trashed).length;
  const trashCount = store.notes.filter((n) => n.trashed).length;
  const pinnedCount = store.notes.filter((n) => n.pinned && !n.trashed).length;

  // ===== CRUD =====

  function patchNote(id: string, patch: Partial<Note>): void {
    setStore((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updated_at: Date.now() } : n,
      ),
    }));
  }

  function createNote(category: NoteCategory = 'personal'): void {
    const folderId =
      selection.kind === 'folder'
        ? selection.folderId
        : category === 'project'
          ? 'default-project'
          : 'default-personal';
    const id = genId('n');
    const now = Date.now();
    const newNote: Note = {
      id,
      folder_id: folderId,
      category,
      title: '',
      content_html: '<p></p>',
      tags: [],
      pinned: false,
      status: 'inbox',
      deadline: null,
      attachments: [],
      trashed: false,
      trashed_at: null,
      color: null,
      created_at: now,
      updated_at: now,
    };
    setStore((s) => ({ ...s, notes: [newNote, ...s.notes] }));
    setActiveNoteId(id);
  }

  /**
   * Phase 18.2.b — Daily note. Mở/Tạo note có title YYYY-MM-DD cho hôm nay.
   * Nếu đã có → focus. Nếu chưa → tạo mới (cá nhân, folder default-personal).
   */
  function openOrCreateDailyNote(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateTitle = `${yyyy}-${mm}-${dd}`;
    const existing = store.notes.find(
      (n) => !n.trashed && n.title.trim() === dateTitle,
    );
    if (existing) {
      setActiveNoteId(existing.id);
      setSelection({ kind: 'all' });
      return;
    }
    const id = genId('n');
    const now = Date.now();
    const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][today.getDay()];
    const newNote: Note = {
      id,
      folder_id: 'default-personal',
      category: 'personal',
      title: dateTitle,
      content_html: `<h2>📅 ${dateTitle} (${weekday})</h2><p></p>`,
      tags: ['daily'],
      pinned: false,
      status: 'inbox',
      deadline: null,
      attachments: [],
      trashed: false,
      trashed_at: null,
      color: null,
      created_at: now,
      updated_at: now,
    };
    setStore((s) => ({ ...s, notes: [newNote, ...s.notes] }));
    setActiveNoteId(id);
    setSelection({ kind: 'all' });
  }

  /**
   * Phase 18.2.b — Tính backlinks cho note hiện tại.
   * Tìm các note KHÁC chứa [[Title của note này]] hoặc href="#note:<id>".
   */
  function computeBacklinksFor(targetNote: Note): Note[] {
    if (!targetNote.title.trim()) return [];
    const needle = targetNote.title.trim().toLowerCase();
    const idNeedle = `#note:${targetNote.id}`;
    return store.notes.filter((n) => {
      if (n.id === targetNote.id) return false;
      if (n.trashed) return false;
      const text = (n.content_html || '').toLowerCase();
      // Match [[Title]] (case-insensitive)
      if (text.includes(`[[${needle}]]`)) return true;
      if (text.includes(idNeedle)) return true;
      return false;
    });
  }

  function softDeleteNote(id: string): void {
    setStore((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id
          ? { ...n, trashed: true, trashed_at: Date.now(), updated_at: Date.now() }
          : n,
      ),
    }));
    if (activeNoteId === id) setActiveNoteId(null);
  }

  function restoreFromTrash(id: string): void {
    patchNote(id, { trashed: false, trashed_at: null });
  }

  function permanentDelete(id: string): void {
    if (!window.confirm('Xoá vĩnh viễn note này? Không thể undo.')) return;
    setStore((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
    if (activeNoteId === id) setActiveNoteId(null);
  }

  function emptyTrash(): void {
    if (!window.confirm(`Xoá vĩnh viễn ${trashCount} note trong thùng rác?`))
      return;
    setStore((s) => ({ ...s, notes: s.notes.filter((n) => !n.trashed) }));
    if (activeNote?.trashed) setActiveNoteId(null);
  }

  function togglePin(id: string): void {
    const n = store.notes.find((x) => x.id === id);
    if (n) patchNote(id, { pinned: !n.pinned });
  }

  // ===== Folders =====

  function createFolder(): void {
    const name = window.prompt('Tên folder mới:');
    if (!name?.trim()) return;
    const newFolder: Folder = {
      id: genId('f'),
      name: name.trim(),
      pinned: false,
      color: null,
      created_at: Date.now(),
    };
    setStore((s) => ({ ...s, folders: [...s.folders, newFolder] }));
  }

  function renameFolder(folderId: string): void {
    const f = store.folders.find((x) => x.id === folderId);
    if (!f) return;
    const name = window.prompt('Đổi tên folder:', f.name);
    if (!name?.trim() || name === f.name) return;
    setStore((s) => ({
      ...s,
      folders: s.folders.map((x) =>
        x.id === folderId ? { ...x, name: name.trim() } : x,
      ),
    }));
  }

  function deleteFolder(folderId: string): void {
    const f = store.folders.find((x) => x.id === folderId);
    if (!f) return;
    if (folderId === 'default-personal' || folderId === 'default-project') {
      window.alert('Không thể xoá folder mặc định.');
      return;
    }
    const noteCount = store.notes.filter(
      (n) => n.folder_id === folderId && !n.trashed,
    ).length;
    if (
      noteCount > 0 &&
      !window.confirm(`Folder "${f.name}" có ${noteCount} note. Xoá folder + chuyển note sang Cá nhân?`)
    )
      return;
    setStore((s) => ({
      ...s,
      folders: s.folders.filter((x) => x.id !== folderId),
      notes: s.notes.map((n) =>
        n.folder_id === folderId ? { ...n, folder_id: 'default-personal' } : n,
      ),
    }));
    if (selection.kind === 'folder' && selection.folderId === folderId) {
      setSelection({ kind: 'all' });
    }
  }

  function toggleFolderPin(folderId: string): void {
    setStore((s) => ({
      ...s,
      folders: s.folders.map((f) =>
        f.id === folderId ? { ...f, pinned: !f.pinned } : f,
      ),
    }));
  }

  // ===== Attachments =====

  async function handleAttachFile(): Promise<void> {
    if (!activeNote || !uid) return;
    const src = await pickFileForAttach();
    if (!src) return;
    try {
      const target = await attachFileToNote(uid, src);
      const fileName = src.split(/[\\/]/).pop() ?? src;
      const newAtt = {
        id: genId('a'),
        kind: 'file' as const,
        name: fileName,
        target,
        added_at: Date.now(),
      };
      patchNote(activeNote.id, {
        attachments: [...activeNote.attachments, newAtt],
      });
    } catch (err) {
      window.alert(`Lỗi đính kèm: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Gắn link file: pick file path nhưng KHÔNG copy — chỉ lưu reference path */
  async function handleAttachFileLink(): Promise<void> {
    if (!activeNote) return;
    const src = await pickFileForAttach();
    if (!src) return;
    const fileName = src.split(/[\\/]/).pop() ?? src;
    const newAtt = {
      id: genId('a'),
      kind: 'file' as const,
      name: fileName,
      target: src, // path gốc, không copy
      added_at: Date.now(),
    };
    patchNote(activeNote.id, {
      attachments: [...activeNote.attachments, newAtt],
    });
  }

  /** Gắn link folder: pick folder path */
  async function handleAttachFolder(): Promise<void> {
    if (!activeNote) return;
    const src = await pickFolderForAttach();
    if (!src) return;
    const folderName = src.split(/[\\/]/).pop() ?? src;
    const newAtt = {
      id: genId('a'),
      kind: 'file' as const, // dùng kind 'file' nhưng target là folder path
      name: `📁 ${folderName}`,
      target: src,
      added_at: Date.now(),
    };
    patchNote(activeNote.id, {
      attachments: [...activeNote.attachments, newAtt],
    });
  }

  /** Manual save (Ctrl+S). Auto-save vẫn hoạt động background. */
  async function handleManualSave(): Promise<void> {
    if (!uid) return;
    try {
      await saveNoteStore(uid, store);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      window.alert(`Lỗi lưu: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Keyboard shortcuts cho note module
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        void handleManualSave();
      } else if (e.key.toLowerCase() === 'n' && !e.shiftKey && !inField) {
        e.preventDefault();
        createNote('personal');
      } else if (e.key.toLowerCase() === 'd' && e.shiftKey) {
        // Phase 18.2.b — Ctrl+Shift+D: daily note
        e.preventDefault();
        openOrCreateDailyNote();
      } else if (e.key === 'Delete' && activeNote && !inField) {
        e.preventDefault();
        if (window.confirm(`Xoá note "${activeNote.title || '(không tên)'}"?`)) {
          softDeleteNote(activeNote.id);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNote, uid, store]);

  function handleAttachLink(): void {
    if (!activeNote) return;
    setInputModal({
      title: tr('note.attach_link.title'),
      icon: '🔗',
      description: tr('note.attach_link.desc'),
      label: tr('note.attach_link.url_label'),
      placeholder: 'https://example.com/...',
      defaultValue: 'https://',
      type: 'url',
      submitLabel: tr('note.attach_link.attach'),
      validate: (v) => {
        if (!v) return tr('note.attach_link.empty');
        if (!/^https?:\/\/.+/.test(v)) return tr('note.attach_link.invalid');
        return null;
      },
      onSubmit: (url) => {
        const newAtt = {
          id: genId('a'),
          kind: 'link' as const,
          name: url,
          target: url,
          added_at: Date.now(),
        };
        patchNote(activeNote.id, {
          attachments: [...activeNote.attachments, newAtt],
        });
        setInputModal(null);
      },
      onCancel: () => setInputModal(null),
    });
  }

  async function handleRemoveAttachment(attId: string): Promise<void> {
    if (!activeNote) return;
    const att = activeNote.attachments.find((a) => a.id === attId);
    if (!att) return;
    if (att.kind === 'file') {
      try {
        await removeAttachedFile(att.target);
      } catch {
        /* ignore — file might have been deleted manually */
      }
    }
    patchNote(activeNote.id, {
      attachments: activeNote.attachments.filter((a) => a.id !== attId),
    });
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="note-loading">
        <div className="spinner" />
        <p>Đang load notes…</p>
      </div>
    );
  }

  return (
    <div className="note-module">
      {/* Sidebar */}
      <aside className="note-sidebar">
        <div className="note-sidebar-head">
          <div className="note-new-wrap" style={{ flex: 1, position: 'relative' }}>
            <button
              className="btn-action btn-action-primary"
              onClick={() => setShowNewMenu((v) => !v)}
              title="Ctrl+N"
              style={{ width: '100%' }}
            >
              <span className="btn-action-icon">＋</span>
              <span>{tr('note.new')}</span>
              <span style={{ marginLeft: 4, fontSize: 10 }}>▼</span>
            </button>
            {showNewMenu && (
              <div className="note-new-menu">
                <button
                  className="note-new-item"
                  onClick={() => {
                    createNote('personal');
                    setShowNewMenu(false);
                  }}
                >
                  📝 Cá nhân
                </button>
                <button
                  className="note-new-item"
                  onClick={() => {
                    createNote('project');
                    setShowNewMenu(false);
                  }}
                >
                  📂 Dự án
                </button>
                <div className="note-new-divider" />
                <button
                  className="note-new-item"
                  onClick={() => {
                    setShowTemplatePicker(true);
                    setShowNewMenu(false);
                  }}
                >
                  📋 Từ template…
                </button>
              </div>
            )}
          </div>
          <button
            className="btn-action"
            onClick={() => void handleManualSave()}
            title="Ctrl+S"
          >
            <span className="btn-action-icon">💾</span>
            <span>{tr('note.save_manual')}</span>
          </button>
          <button
            className="btn-action"
            onClick={() => {
              if (!activeNote) {
                window.alert('Chọn một note trước khi export');
                return;
              }
              void exportNoteToHtml({
                title: activeNote.title,
                content_html: activeNote.content_html,
                category: activeNote.category,
                tags: activeNote.tags,
                created_at: activeNote.created_at,
                updated_at: activeNote.updated_at,
              }).then((path) => {
                if (path) window.alert(`✓ Đã export HTML\n→ ${path}`);
              });
            }}
            title="Export note ra file HTML standalone"
          >
            <span className="btn-action-icon">🌐</span>
            <span>HTML</span>
          </button>
        </div>

        {/* Phase 18.2.b — Daily note quick access */}
        <ul className="nav-list">
          <li>
            <button
              className="nav-item nav-item-daily"
              onClick={openOrCreateDailyNote}
              title="Mở/tạo ghi chú cho hôm nay (YYYY-MM-DD)"
            >
              <span>📅 Hôm nay</span>
              <span className="count" style={{ fontSize: 10 }}>
                {(() => {
                  const t = new Date();
                  return `${t.getDate()}/${t.getMonth() + 1}`;
                })()}
              </span>
            </button>
          </li>
          <li>
            <button
              className="nav-item"
              onClick={() => setShowStats(true)}
              title="Thống kê notes — top words, hoạt động"
            >
              <span>📊 Thống kê</span>
            </button>
          </li>
        </ul>

        {/* All / Pinned / Trash */}
        <ul className="nav-list">
          <li>
            <button
              className={`nav-item ${selection.kind === 'all' ? 'active' : ''}`}
              onClick={() => setSelection({ kind: 'all' })}
            >
              <span>📋 {tr('note.nav.all')}</span>
              <span className="count">{totalActive}</span>
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${selection.kind === 'pinned' ? 'active' : ''}`}
              onClick={() => setSelection({ kind: 'pinned' })}
            >
              <span>📌 {tr('note.nav.pinned')}</span>
              <span className="count">{pinnedCount}</span>
            </button>
          </li>
        </ul>

        {/* Categories */}
        <ul className="nav-list">
          <li>
            <button
              className={`nav-item ${selection.kind === 'category' && selection.category === 'personal' ? 'active' : ''}`}
              onClick={() => setSelection({ kind: 'category', category: 'personal' })}
            >
              <span>🗒 {tr('note.nav.personal')}</span>
              <span className="count">
                {store.notes.filter((n) => n.category === 'personal' && !n.trashed).length}
              </span>
            </button>
          </li>
          <li>
            <button
              className={`nav-item ${selection.kind === 'category' && selection.category === 'project' ? 'active' : ''}`}
              onClick={() => setSelection({ kind: 'category', category: 'project' })}
            >
              <span>📂 {tr('note.nav.project')}</span>
              <span className="count">
                {store.notes.filter((n) => n.category === 'project' && !n.trashed).length}
              </span>
            </button>
          </li>
        </ul>

        {/* Folders */}
        <div className="sec-head">
          <h4>{tr('note.nav.folders')}</h4>
          <button className="mini-add" onClick={createFolder} title={tr('note.action.create_folder')}>
            +
          </button>
        </div>
        <ul className="nav-list">
          {store.folders.map((f) => (
            <li key={f.id}>
              <button
                className={`nav-item folder ${selection.kind === 'folder' && selection.folderId === f.id ? 'active' : ''}`}
                onClick={() => setSelection({ kind: 'folder', folderId: f.id })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (window.confirm(`"${f.name}":\nOK = đổi tên · Cancel = xoá`)) {
                    renameFolder(f.id);
                  } else {
                    deleteFolder(f.id);
                  }
                }}
              >
                <span>
                  {f.pinned ? '📌 ' : '📁 '}
                  {f.name}
                </span>
                <span className="count">
                  {store.notes.filter((n) => n.folder_id === f.id && !n.trashed).length}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Tags */}
        {allTags.length > 0 && (
          <>
            <div className="sec-head">
              <h4>{tr('note.nav.tags')}</h4>
            </div>
            <div className="tag-cloud">
              {allTags.slice(0, 20).map((t) => (
                <button
                  key={t}
                  className={`tag-pill ${selection.kind === 'tag' && selection.tag === t ? 'active' : ''}`}
                  onClick={() => setSelection({ kind: 'tag', tag: t })}
                >
                  #{t}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Trash */}
        <div className="sec-head" style={{ marginTop: 'auto' }}>
          <h4>&nbsp;</h4>
        </div>
        <button
          className={`nav-item ${selection.kind === 'trash' ? 'active' : ''}`}
          onClick={() => setSelection({ kind: 'trash' })}
        >
          <span>🗑 {tr('note.nav.trash')}</span>
          <span className="count">{trashCount}</span>
        </button>
      </aside>

      {/* Note list */}
      <section className="note-list-pane">
        <div className="note-list-head">
          <input
            type="search"
            className="search-input"
            placeholder={tr('note.search.placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="sort-select"
          >
            <option value="updated-desc">{tr('note.sort.updated_desc')}</option>
            <option value="updated-asc">{tr('note.sort.updated_asc')}</option>
            <option value="created-desc">{tr('note.sort.created_desc')}</option>
            <option value="title-asc">{tr('note.sort.title_asc')}</option>
          </select>
        </div>
        <div className="note-list-body">
          {filteredNotes.length === 0 && (
            <div className="empty">
              <p className="muted">{tr('note.empty.no_notes')}</p>
              {selection.kind === 'trash' && trashCount === 0 && (
                <p className="muted small">{tr('note.empty.trash')}</p>
              )}
              {selection.kind !== 'trash' && (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => createNote('personal')}
                >
                  {tr('note.empty.create')}
                </button>
              )}
            </div>
          )}
          {filteredNotes.length > 0 && selection.kind === 'trash' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-small" onClick={emptyTrash}>
                🗑 {tr('note.action.empty_trash')}
              </button>
            </div>
          )}
          <ul className="note-list">
            {filteredNotes.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                folder={store.folders.find((f) => f.id === n.folder_id)}
                active={activeNoteId === n.id}
                onClick={() => setActiveNoteId(n.id)}
              />
            ))}
          </ul>
        </div>
      </section>

      {inputModal && <InputModal {...inputModal} />}

      {/* Editor */}
      <section className="note-editor-pane">
        {!activeNote && (
          <div className="empty">
            <h2>📝 {tr('module.note')}</h2>
            <p className="muted">{tr('note.empty.no_notes')}</p>
            <button className="btn btn-primary btn-small" onClick={() => createNote('personal')}>
              {tr('note.empty.create')}
            </button>
          </div>
        )}
        {activeNote && (
          <>
            <NoteEditor
              note={activeNote}
              folders={store.folders}
              systemFonts={systemFonts}
              isTrash={activeNote.trashed}
              tr={tr}
              onPatch={(patch) => patchNote(activeNote.id, patch)}
              onTogglePin={() => togglePin(activeNote.id)}
              onDelete={() => softDeleteNote(activeNote.id)}
              onRestore={() => restoreFromTrash(activeNote.id)}
              onPermanentDelete={() => permanentDelete(activeNote.id)}
              onAttachFile={handleAttachFile}
              onAttachFileLink={handleAttachFileLink}
              onAttachFolder={handleAttachFolder}
              onAttachLink={handleAttachLink}
              onRemoveAttachment={handleRemoveAttachment}
              onOpenAttachment={(target) => void openLocalPath(target)}
              onTogglePinFolder={toggleFolderPin}
              showColorPicker={showColorPicker}
              setShowColorPicker={setShowColorPicker}
              savedFlash={savedFlash}
            />
            {/* Phase 18.2.b — Backlinks panel */}
            {!activeNote.trashed && (
              <BacklinksPanel
                note={activeNote}
                allNotes={store.notes}
                computeBacklinks={computeBacklinksFor}
                onJump={(id) => setActiveNoteId(id)}
              />
            )}
          </>
        )}
      </section>

      {showStats && <NoteStatsModal onClose={() => setShowStats(false)} />}

      {showTemplatePicker && (
        <NoteTemplatePicker
          onClose={() => setShowTemplatePicker(false)}
          onPick={({ title, html, template }) => {
            // Create new note pre-filled with template content
            const id = genId('n');
            const now = Date.now();
            const isProject = template.category === 'project';
            const newNote: Note = {
              id,
              folder_id: isProject ? 'default-project' : 'default-personal',
              category: isProject ? 'project' : 'personal',
              title,
              content_html: html,
              tags: [`tpl:${template.id}`],
              pinned: false,
              status: 'inbox',
              deadline: null,
              attachments: [],
              trashed: false,
              trashed_at: null,
              color: null,
              created_at: now,
              updated_at: now,
            };
            setStore((s) => ({ ...s, notes: [newNote, ...s.notes] }));
            setActiveNoteId(id);
            setSelection({ kind: 'all' });
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Phase 18.2.b — Backlinks panel
// ============================================================

function BacklinksPanel({
  note,
  computeBacklinks,
  allNotes,
  onJump,
}: {
  note: Note;
  computeBacklinks: (n: Note) => Note[];
  allNotes: Note[];
  onJump: (id: string) => void;
}): JSX.Element | null {
  const backlinks = useMemo(() => computeBacklinks(note), [note, computeBacklinks, allNotes]);

  // Outgoing links: parse [[Title]] in current note content → resolve to note IDs
  const outgoing = useMemo(() => {
    const out: Note[] = [];
    const seen = new Set<string>();
    const text = note.content_html || '';
    const re = /\[\[([^\]]+)\]\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const title = match[1].trim().toLowerCase();
      const target = allNotes.find(
        (n) => !n.trashed && n.id !== note.id && n.title.trim().toLowerCase() === title,
      );
      if (target && !seen.has(target.id)) {
        seen.add(target.id);
        out.push(target);
      }
    }
    return out;
  }, [note, allNotes]);

  if (backlinks.length === 0 && outgoing.length === 0) return null;

  return (
    <aside className="backlinks-panel">
      {outgoing.length > 0 && (
        <div className="backlinks-section">
          <h4>🔗 Liên kết ra ({outgoing.length})</h4>
          <ul>
            {outgoing.map((n) => (
              <li key={n.id}>
                <button className="backlink-item" onClick={() => onJump(n.id)} title={n.title}>
                  <span className="backlink-title">{n.title || '(Chưa đặt tiêu đề)'}</span>
                  <span className="muted small">
                    {n.category === 'project' ? '📂 Dự án' : '📝 Cá nhân'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {backlinks.length > 0 && (
        <div className="backlinks-section">
          <h4>↩ Backlinks ({backlinks.length})</h4>
          <ul>
            {backlinks.map((n) => (
              <li key={n.id}>
                <button className="backlink-item" onClick={() => onJump(n.id)} title={n.title}>
                  <span className="backlink-title">{n.title || '(Chưa đặt tiêu đề)'}</span>
                  <span className="muted small">
                    {n.category === 'project' ? '📂 Dự án' : '📝 Cá nhân'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

// ============================================================
// NoteListItem
// ============================================================

function NoteListItem({
  note,
  folder,
  active,
  onClick,
}: {
  note: Note;
  folder: Folder | undefined;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  const excerpt = useMemo(
    () => stripHtml(note.content_html).slice(0, 120),
    [note.content_html],
  );
  const isOverdue =
    note.deadline !== null && note.deadline < Date.now() && note.status !== 'done';

  return (
    <li
      className={`note-item ${active ? 'active' : ''} ${isOverdue ? 'overdue' : ''}`}
      onClick={onClick}
      style={note.color ? { borderLeftColor: note.color, borderLeftWidth: 3, borderLeftStyle: 'solid' } : undefined}
    >
      <div className="note-item-head">
        {note.pinned && <span title="Pinned">📌</span>}
        {note.category === 'project' && <span title="Dự án">📂</span>}
        <strong className="note-title">
          {note.title || <span className="muted">(Chưa đặt tiêu đề)</span>}
        </strong>
      </div>
      <div className="note-excerpt muted small">{excerpt || '(Trống)'}</div>
      <div className="note-meta muted small">
        <span>{folder?.name ?? '—'}</span>
        <span>·</span>
        <span>{formatRelativeTime(note.updated_at)}</span>
        {note.deadline !== null && (
          <>
            <span>·</span>
            <span className={isOverdue ? 'overdue-badge' : ''}>
              ⏰ {new Date(note.deadline).toLocaleDateString('vi-VN')}
            </span>
          </>
        )}
      </div>
      {note.tags.length > 0 && (
        <div className="note-tags">
          {note.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag-chip">
              #{t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// ============================================================
// NoteEditor — TipTap với toolbar
// ============================================================

function NoteEditor({
  note,
  folders,
  systemFonts,
  isTrash,
  tr,
  onPatch,
  onTogglePin,
  onDelete,
  onRestore,
  onPermanentDelete,
  onAttachFile,
  onAttachFileLink,
  onAttachFolder,
  onAttachLink,
  onRemoveAttachment,
  onOpenAttachment,
  showColorPicker,
  setShowColorPicker,
  savedFlash,
}: {
  note: Note;
  folders: Folder[];
  systemFonts: string[];
  isTrash: boolean;
  tr: (key: string, vars?: Record<string, string | number>) => string;
  onPatch: (patch: Partial<Note>) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onAttachFile: () => void;
  onAttachFileLink: () => void;
  onAttachFolder: () => void;
  onAttachLink: () => void;
  onRemoveAttachment: (attId: string) => void;
  onOpenAttachment: (target: string) => void;
  onTogglePinFolder: (folderId: string) => void;
  showColorPicker: boolean;
  setShowColorPicker: (v: boolean) => void;
  savedFlash: boolean;
}): JSX.Element {
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setTitleDraft(note.title);
  }, [note.id, note.title]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: 'tiptap-link' },
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        TaskList,
        TaskItem.configure({ nested: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({
          placeholder: 'Bắt đầu viết note…',
        }),
        CharacterCount,
      ],
      content: note.content_html,
      editorProps: {
        attributes: {
          class: 'tiptap-note-editor',
          spellcheck: 'false',
        },
      },
      onUpdate: ({ editor }) => {
        onPatch({ content_html: editor.getHTML() });
      },
    },
    [note.id], // re-create when active note changes
  );

  const handleTitleChange = useCallback(
    (v: string) => {
      setTitleDraft(v);
    },
    [],
  );

  const handleTitleBlur = useCallback(() => {
    if (titleDraft !== note.title) {
      onPatch({ title: titleDraft });
    }
  }, [titleDraft, note.title, onPatch]);

  const handleAddTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!t || note.tags.includes(t)) return;
    onPatch({ tags: [...note.tags, t] });
    setTagInput('');
  }, [tagInput, note.tags, onPatch]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onPatch({ tags: note.tags.filter((t) => t !== tag) });
    },
    [note.tags, onPatch],
  );

  const wordCount = useMemo(() => {
    const text = stripHtml(note.content_html);
    return text ? text.split(/\s+/).length : 0;
  }, [note.content_html]);

  return (
    <div className="note-editor">
      {/* Header bar */}
      <div className="note-editor-head">
        <input
          type="text"
          className="note-title-input"
          placeholder={tr('note.title.placeholder')}
          value={titleDraft}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleTitleBlur();
              editor?.commands.focus();
            }
          }}
          disabled={isTrash}
        />
        <div className="note-actions">
          {savedFlash && <span className="muted small">✓ {tr('app_settings.saved')}</span>}
          {!isTrash && (
            <>
              <button
                className={`tb-btn ${note.pinned ? 'active' : ''}`}
                onClick={onTogglePin}
                title={tr('note.action.pin')}
              >
                📌
              </button>
              <button
                className={`tb-btn ${showColorPicker ? 'active' : ''}`}
                onClick={() => setShowColorPicker(!showColorPicker)}
                title={tr('note.action.color')}
                style={note.color ? { borderColor: note.color } : undefined}
              >
                🎨
              </button>
              <button className="tb-btn loc-btn-danger" onClick={onDelete} title={tr('note.action.delete')}>
                🗑
              </button>
            </>
          )}
          {isTrash && (
            <>
              <button className="btn btn-ghost btn-small" onClick={onRestore}>
                ↺ {tr('note.action.restore')}
              </button>
              <button className="btn btn-ghost btn-small" onClick={onPermanentDelete}>
                ✕ {tr('note.action.permanent')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Color picker bar */}
      {showColorPicker && !isTrash && (
        <div className="color-picker-bar">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c ?? 'none'}
              className={`color-swatch ${note.color === c ? 'active' : ''}`}
              style={
                c
                  ? { background: c }
                  : { background: 'transparent', border: '1px dashed var(--border)' }
              }
              onClick={() => {
                onPatch({ color: c });
                setShowColorPicker(false);
              }}
              title={c ?? 'No color'}
            >
              {!c && '✕'}
            </button>
          ))}
        </div>
      )}

      {/* Folder + Category + Status (cho project) */}
      <div className="note-meta-bar">
        <select
          className="meta-select"
          value={note.folder_id}
          onChange={(e) => onPatch({ folder_id: e.target.value })}
          disabled={isTrash}
        >
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              📁 {f.name}
            </option>
          ))}
        </select>
        <select
          className="meta-select"
          value={note.category}
          onChange={(e) => onPatch({ category: e.target.value as NoteCategory })}
          disabled={isTrash}
        >
          <option value="personal">🗒 {tr('note.nav.personal')}</option>
          <option value="project">📂 {tr('note.nav.project')}</option>
        </select>
        {note.category === 'project' && (
          <>
            <select
              className="meta-select"
              value={note.status}
              onChange={(e) => onPatch({ status: e.target.value as NoteStatus })}
              disabled={isTrash}
            >
              <option value="inbox">📥 {tr('note.status.inbox')}</option>
              <option value="active">⚡ {tr('note.status.active')}</option>
              <option value="done">✓ {tr('note.status.done')}</option>
            </select>
            <input
              type="date"
              className="meta-select"
              value={
                note.deadline
                  ? new Date(note.deadline).toISOString().slice(0, 10)
                  : ''
              }
              onChange={(e) => {
                const v = e.target.value;
                onPatch({ deadline: v ? new Date(v).getTime() : null });
              }}
              disabled={isTrash}
              title="Deadline"
            />
          </>
        )}
      </div>

      {/* Format toolbar */}
      {editor && !isTrash && (
        <NoteFormatToolbar editor={editor} systemFonts={systemFonts} />
      )}

      {/* Editor body */}
      <div className="note-content-area">
        {editor ? <EditorContent editor={editor} /> : <p className="muted">Loading editor…</p>}
      </div>

      {/* Footer: tags + attachments */}
      <div className="note-footer-bar">
        <div className="note-tags-row">
          {note.tags.map((t) => (
            <span key={t} className="tag-chip">
              #{t}
              {!isTrash && (
                <button onClick={() => handleRemoveTag(t)} className="chip-x">
                  ×
                </button>
              )}
            </span>
          ))}
          {!isTrash && (
            <input
              type="text"
              className="tag-add-input"
              placeholder="+ tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              onBlur={handleAddTag}
            />
          )}
        </div>
        <div className="note-stats muted small">
          {wordCount} từ · {stripHtml(note.content_html).length} ký tự
        </div>
      </div>

      {/* Attachments */}
      {(note.attachments.length > 0 || !isTrash) && (
        <div className="note-attachments">
          <div className="att-head">
            <span className="muted small">{tr('note.attach.title')} ({note.attachments.length})</span>
            {!isTrash && (
              <div className="att-actions">
                <button
                  className="btn-att"
                  onClick={() => void onAttachFile()}
                  title={tr('note.attach.add_file')}
                >
                  <span className="btn-att-icon">📎</span>
                  <span>{tr('note.attach.add_file')}</span>
                </button>
                <button
                  className="btn-att"
                  onClick={() => void onAttachFileLink()}
                  title={tr('note.attach.link_file')}
                >
                  <span className="btn-att-icon">🔗</span>
                  <span>{tr('note.attach.link_file')}</span>
                </button>
                <button
                  className="btn-att"
                  onClick={() => void onAttachFolder()}
                  title={tr('note.attach.link_folder')}
                >
                  <span className="btn-att-icon">📁</span>
                  <span>{tr('note.attach.link_folder')}</span>
                </button>
                <button
                  className="btn-att"
                  onClick={onAttachLink}
                  title={tr('note.attach.link_url')}
                >
                  <span className="btn-att-icon">🌐</span>
                  <span>{tr('note.attach.link_url')}</span>
                </button>
              </div>
            )}
          </div>
          {note.attachments.length > 0 && (
            <ul className="att-list">
              {note.attachments.map((a) => (
                <li key={a.id} className="att-item">
                  <button
                    className="att-name"
                    onClick={() => onOpenAttachment(a.target)}
                    title={a.target}
                  >
                    {a.kind === 'file' ? '📄' : '🔗'} {a.name}
                  </button>
                  {!isTrash && (
                    <button
                      className="loc-btn loc-btn-danger"
                      onClick={() => void onRemoveAttachment(a.id)}
                      title="Xoá"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Format toolbar (TipTap)
// ============================================================

function NoteFormatToolbar({
  editor,
  systemFonts,
}: {
  editor: ReturnType<typeof useEditor>;
  systemFonts: string[];
}): JSX.Element | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => force((x) => x + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  if (!editor) return null;

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  function setColor(): void {
    if (!editor) return;
    const c = window.prompt('Màu chữ (hex):', '#ec4899');
    if (c?.trim()) editor.chain().focus().setColor(c.trim()).run();
  }

  function setHighlight(): void {
    if (!editor) return;
    const c = window.prompt('Màu highlight (hex):', '#fef08a');
    if (c?.trim()) editor.chain().focus().toggleHighlight({ color: c.trim() }).run();
  }

  function setLink(): void {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  function setFont(name: string): void {
    if (!editor) return;
    if (name === 'default') {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(name).run();
    }
  }

  return (
    <div className="format-toolbar">
      <div className="tb-group">
        <button
          className={`tb-btn ${isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={`tb-btn ${isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className={`tb-btn ${isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button
          className={`tb-btn ${isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          className={`tb-btn ${isActive('code') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          {'<>'}
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <select
          className="tb-select"
          value={
            isActive('heading', { level: 1 })
              ? 'h1'
              : isActive('heading', { level: 2 })
                ? 'h2'
                : isActive('heading', { level: 3 })
                  ? 'h3'
                  : 'p'
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else {
              const lvl = parseInt(v.slice(1), 10) as 1 | 2 | 3;
              editor.chain().focus().toggleHeading({ level: lvl }).run();
            }
          }}
        >
          <option value="p">¶</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
        </select>

        <select
          className="tb-select"
          onChange={(e) => setFont(e.target.value)}
          value={(editor.getAttributes('textStyle').fontFamily as string) ?? 'default'}
          style={{ minWidth: 120, maxWidth: 140 }}
        >
          <option value="default">Font mặc định</option>
          {systemFonts.length === 0 && (
            <>
              <option value="Georgia">Georgia</option>
              <option value="'Times New Roman'">Times</option>
              <option value="Arial">Arial</option>
            </>
          )}
          {systemFonts.map((f) => (
            <option key={f} value={`'${f}'`} style={{ fontFamily: `'${f}'` }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button
          className={`tb-btn ${isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet"
        >
          •
        </button>
        <button
          className={`tb-btn ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered"
        >
          1.
        </button>
        <button
          className={`tb-btn ${isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list"
        >
          ☐
        </button>
        <button
          className={`tb-btn ${isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          ❝
        </button>
        <button
          className={`tb-btn ${isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          {'</>'}
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button className="tb-btn" onClick={setColor} title="Màu chữ">
          <span style={{ color: 'var(--accent)' }}>A</span>
        </button>
        <button className="tb-btn" onClick={setHighlight} title="Highlight">
          🖍
        </button>
        <button className="tb-btn" onClick={setLink} title="Link">
          🔗
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          ↶
        </button>
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          ↷
        </button>
      </div>
    </div>
  );
}
