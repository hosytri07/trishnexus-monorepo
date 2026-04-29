'use client';

/**
 * /admin/library — Phase 19.22.
 *
 * Admin CRUD cho /trishteam_library (folder + links curated cho user).
 * Dùng Firestore client SDK trực tiếp — rules đã cho phép admin write
 * `match /trishteam_library/{folderId} { allow create, update, delete: if isAdmin(); }`.
 *
 * Layout: 2 cột.
 *   Trái: list folders + nút "+ Tạo folder"
 *   Phải: list links của folder selected + form CRUD link
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Folder,
  FolderPlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';

interface FolderDoc {
  id: string;
  name: string;
  description?: string;
  icon: string;
  sort_order: number;
}

interface LinkDoc {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  link_type?: string;
  sort_order?: number;
}

const ICON_OPTIONS = ['📁', '📚', '📖', '📝', '🎓', '🚦', '🌉', '🛣️', '🏗️', '⚙️', '🔧', '📊', '📐', '🗺️', '💡', '🎯', '🔗', '📎'];

export default function AdminLibraryPage() {
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [folders, setFolders] = useState<FolderDoc[]>([]);
  const [links, setLinks] = useState<LinkDoc[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderDoc | null>(null);
  const [folderModal, setFolderModal] = useState<FolderDoc | 'new' | null>(null);
  const [linkModal, setLinkModal] = useState<LinkDoc | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  function flash(tone: 'ok' | 'err', text: string) {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }

  // Subscribe folders
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, 'trishteam_library'), orderBy('sort_order', 'asc')),
      (snap) => {
        const list: FolderDoc[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: (data.name as string) ?? '(chưa có tên)',
            description: data.description as string | undefined,
            icon: (data.icon as string) ?? '📁',
            sort_order: (data.sort_order as number) ?? 0,
          };
        });
        setFolders(list);
        // Auto-select first folder if none selected
        if (!activeFolder && list.length > 0) {
          setActiveFolder(list[0]!);
        }
      },
      (err) => {
        console.warn('[admin/library] folders subscribe fail:', err);
        flash('err', `Subscribe folders fail: ${err.message}`);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe links of active folder
  useEffect(() => {
    if (!db || !activeFolder) {
      setLinks([]);
      return;
    }
    const unsub = onSnapshot(
      query(
        collection(db, 'trishteam_library', activeFolder.id, 'links'),
        orderBy('sort_order', 'asc'),
      ),
      (snap) => {
        const list: LinkDoc[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            url: (data.url as string) ?? '',
            description: data.description as string | undefined,
            icon: data.icon as string | undefined,
            link_type: data.link_type as string | undefined,
            sort_order: (data.sort_order as number) ?? 0,
          };
        });
        setLinks(list);
      },
      (err) => {
        console.warn('[admin/library] links subscribe fail:', err);
      },
    );
    return () => unsub();
  }, [activeFolder]);

  async function saveFolder(payload: Partial<FolderDoc>, isNew: boolean) {
    if (!db) return;
    setBusy(true);
    try {
      if (isNew) {
        const id = (payload.name ?? 'folder')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || `folder-${Date.now()}`;
        await setDoc(doc(db, 'trishteam_library', id), {
          name: payload.name ?? 'Folder mới',
          description: payload.description ?? '',
          icon: payload.icon ?? '📁',
          sort_order: payload.sort_order ?? folders.length,
          created_at: Date.now(),
          updated_at: Date.now(),
          _server_updated: serverTimestamp(),
        });
        flash('ok', `Tạo folder "${payload.name}" thành công.`);
      } else if (folderModal && folderModal !== 'new') {
        await updateDoc(doc(db, 'trishteam_library', folderModal.id), {
          name: payload.name,
          description: payload.description ?? '',
          icon: payload.icon,
          sort_order: payload.sort_order,
          updated_at: Date.now(),
          _server_updated: serverTimestamp(),
        });
        flash('ok', `Đã sửa folder "${payload.name}".`);
      }
      setFolderModal(null);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(f: FolderDoc) {
    const ok = await askConfirm({
      title: 'Xóa folder',
      message: `Xóa folder "${f.name}" và TẤT CẢ link bên trong? Hành động không thể undo.`,
      okLabel: 'Xóa',
      danger: true,
    });
    if (!ok || !db) return;
    setBusy(true);
    try {
      // Xóa subcollection links trước (Firestore không cascade)
      const linkSnap = await import('firebase/firestore').then((m) =>
        m.getDocs(m.collection(db!, 'trishteam_library', f.id, 'links')),
      );
      await Promise.all(
        linkSnap.docs.map((d) => deleteDoc(d.ref)),
      );
      await deleteDoc(doc(db, 'trishteam_library', f.id));
      if (activeFolder?.id === f.id) setActiveFolder(null);
      flash('ok', `Đã xóa folder "${f.name}".`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveLink(payload: Partial<LinkDoc>, isNew: boolean) {
    if (!db || !activeFolder) return;
    setBusy(true);
    try {
      if (isNew) {
        const id = `link-${Date.now()}`;
        await setDoc(
          doc(db, 'trishteam_library', activeFolder.id, 'links', id),
          {
            title: payload.title ?? 'Link mới',
            url: payload.url ?? '',
            description: payload.description ?? '',
            icon: payload.icon ?? '',
            link_type: payload.link_type ?? '',
            sort_order: payload.sort_order ?? links.length,
            created_at: Date.now(),
            updated_at: Date.now(),
            _server_updated: serverTimestamp(),
          },
        );
        flash('ok', `Tạo link "${payload.title}" thành công.`);
      } else if (linkModal && linkModal !== 'new') {
        await updateDoc(
          doc(db, 'trishteam_library', activeFolder.id, 'links', linkModal.id),
          {
            title: payload.title,
            url: payload.url,
            description: payload.description ?? '',
            icon: payload.icon ?? '',
            link_type: payload.link_type ?? '',
            sort_order: payload.sort_order,
            updated_at: Date.now(),
            _server_updated: serverTimestamp(),
          },
        );
        flash('ok', `Đã sửa link "${payload.title}".`);
      }
      setLinkModal(null);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(l: LinkDoc) {
    if (!db || !activeFolder) return;
    const ok = await askConfirm({
      title: 'Xóa link',
      message: `Xóa link "${l.title}"?`,
      okLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteDoc(
        doc(db, 'trishteam_library', activeFolder.id, 'links', l.id),
      );
      flash('ok', `Đã xóa link.`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmDialog />

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <Folder size={22} /> Thư viện TrishTEAM
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {folders.length} folder · sync real-time với /thu-vien
          </p>
        </div>
        <Link
          href="/thu-vien"
          target="_blank"
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md text-xs font-medium"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <ExternalLink size={13} /> Xem trang user
        </Link>
      </header>

      {toast ? (
        <div
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm"
          style={{
            background: toast.tone === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: toast.tone === 'ok' ? '#059669' : '#B91C1C',
            border: `1px solid ${toast.tone === 'ok' ? '#10B98155' : '#EF444455'}`,
          }}
        >
          {toast.tone === 'ok' ? <CheckCircle2 size={14} /> : <X size={14} />}
          {toast.text}
        </div>
      ) : null}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* LEFT: Folder list */}
        <aside
          className="rounded-lg overflow-hidden"
          style={{
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{
              background: 'var(--color-surface-muted)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <span
              className="text-xs uppercase font-bold tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Folders ({folders.length})
            </span>
            <button
              onClick={() => setFolderModal('new')}
              className="inline-flex items-center justify-center w-7 h-7 rounded transition-opacity hover:opacity-80"
              style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
              title="Tạo folder mới"
            >
              <Plus size={14} />
            </button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {folders.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Chưa có folder nào.<br />
                <button
                  onClick={() => setFolderModal('new')}
                  className="mt-2 text-[var(--color-accent-primary)] underline"
                >
                  + Tạo folder đầu tiên
                </button>
              </li>
            ) : (
              folders.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group"
                  style={{
                    background: activeFolder?.id === f.id ? 'var(--color-accent-soft)' : 'transparent',
                    borderLeft: activeFolder?.id === f.id
                      ? '3px solid var(--color-accent-primary)'
                      : '3px solid transparent',
                  }}
                  onClick={() => setActiveFolder(f)}
                >
                  <span className="text-base shrink-0">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {f.name}
                    </p>
                    {f.description ? (
                      <p
                        className="text-[11px] truncate"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {f.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderModal(f);
                      }}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-surface-muted)]"
                      title="Sửa"
                    >
                      <Pencil size={11} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteFolder(f);
                      }}
                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[rgba(239,68,68,0.1)]"
                      title="Xóa"
                    >
                      <Trash2 size={11} style={{ color: '#EF4444' }} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* RIGHT: Links of active folder */}
        <section
          className="rounded-lg overflow-hidden"
          style={{
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2.5"
            style={{
              background: 'var(--color-surface-muted)',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <span
              className="text-xs uppercase font-bold tracking-wide flex items-center gap-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {activeFolder ? (
                <>
                  <span className="text-base">{activeFolder.icon}</span>
                  {activeFolder.name} ({links.length} link)
                </>
              ) : (
                'Chọn folder bên trái để xem links'
              )}
            </span>
            {activeFolder ? (
              <button
                onClick={() => setLinkModal('new')}
                className="inline-flex items-center gap-1 px-2.5 h-7 rounded text-xs font-bold transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
              >
                <Plus size={12} /> Thêm link
              </button>
            ) : null}
          </div>

          {!activeFolder ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <Folder size={32} className="inline mb-2 opacity-30" />
              <br />
              Chọn 1 folder bên trái để quản lý links bên trong.
            </div>
          ) : links.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <Link2 size={32} className="inline mb-2 opacity-30" />
              <br />
              Folder này chưa có link nào.
              <br />
              <button
                onClick={() => setLinkModal('new')}
                className="mt-2 text-[var(--color-accent-primary)] underline"
              >
                + Thêm link đầu tiên
              </button>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {links.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-3 p-3 group hover:bg-[var(--color-surface-muted)]"
                >
                  <span className="text-base shrink-0 pt-0.5">{l.icon || '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:underline"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {l.title}
                    </a>
                    <p
                      className="text-xs font-mono truncate"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {l.url}
                    </p>
                    {l.description ? (
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {l.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setLinkModal(l)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[var(--color-surface-bg_elevated)]"
                      title="Sửa"
                    >
                      <Pencil size={12} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <button
                      onClick={() => void deleteLink(l)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-[rgba(239,68,68,0.1)]"
                      title="Xóa"
                    >
                      <Trash2 size={12} style={{ color: '#EF4444' }} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Folder modal */}
      {folderModal ? (
        <FolderModal
          initial={folderModal === 'new' ? null : folderModal}
          onClose={() => setFolderModal(null)}
          onSave={(payload) => void saveFolder(payload, folderModal === 'new')}
          busy={busy}
        />
      ) : null}

      {/* Link modal */}
      {linkModal && activeFolder ? (
        <LinkModal
          initial={linkModal === 'new' ? null : linkModal}
          onClose={() => setLinkModal(null)}
          onSave={(payload) => void saveLink(payload, linkModal === 'new')}
          busy={busy}
        />
      ) : null}
    </div>
  );
}

function FolderModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: FolderDoc | null;
  onClose: () => void;
  onSave: (p: Partial<FolderDoc>) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '📁');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);

  return (
    <ModalShell title={initial ? 'Sửa folder' : 'Tạo folder mới'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tên folder">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Tài liệu thiết kế"
            className="w-full px-3 h-10 rounded-md outline-none border text-sm"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
        <Field label="Mô tả (tuỳ chọn)">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn folder dùng cho gì"
            className="w-full px-3 h-10 rounded-md outline-none border text-sm"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className="w-9 h-9 rounded text-xl transition-all"
                style={{
                  background: icon === emoji ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
                  border: `1px solid ${icon === emoji ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Sort order (số nhỏ ưu tiên)">
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-32 px-3 h-10 rounded-md outline-none border text-sm"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 h-10 rounded-md text-sm font-semibold"
          style={{
            background: 'var(--color-surface-bg_elevated)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          Huỷ
        </button>
        <button
          onClick={() => onSave({ name: name.trim(), description: description.trim(), icon, sort_order: sortOrder })}
          disabled={busy || !name.trim()}
          className="px-5 h-10 rounded-md text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
        >
          {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
          {initial ? 'Lưu' : 'Tạo'}
        </button>
      </div>
    </ModalShell>
  );
}

function LinkModal({
  initial,
  onClose,
  onSave,
  busy,
}: {
  initial: LinkDoc | null;
  onClose: () => void;
  onSave: (p: Partial<LinkDoc>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '🔗');
  const [linkType, setLinkType] = useState(initial?.link_type ?? '');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);

  return (
    <ModalShell title={initial ? 'Sửa link' : 'Tạo link mới'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Tiêu đề">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: TCVN 5574:2018"
            className="w-full px-3 h-10 rounded-md outline-none border text-sm"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
        <Field label="URL">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 h-10 rounded-md outline-none border text-sm font-mono"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
        <Field label="Mô tả (tuỳ chọn)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-md outline-none border text-sm"
            style={{
              background: 'var(--color-surface-bg_elevated)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className="w-8 h-8 rounded text-lg transition-all"
                  style={{
                    background: icon === emoji ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
                    border: `1px solid ${icon === emoji ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </Field>
          <div className="space-y-3">
            <Field label="Loại (tuỳ chọn)">
              <input
                value={linkType}
                onChange={(e) => setLinkType(e.target.value)}
                placeholder="VD: pdf, video, doc"
                className="w-full px-3 h-10 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 h-10 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </Field>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-4 h-10 rounded-md text-sm font-semibold"
          style={{
            background: 'var(--color-surface-bg_elevated)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          Huỷ
        </button>
        <button
          onClick={() => onSave({ title: title.trim(), url: url.trim(), description: description.trim(), icon, link_type: linkType, sort_order: sortOrder })}
          disabled={busy || !title.trim() || !url.trim()}
          className="px-5 h-10 rounded-md text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--color-accent-gradient)', color: '#fff' }}
        >
          {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : null}
          {initial ? 'Lưu' : 'Tạo'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-lg w-full max-h-[85vh] overflow-y-auto rounded-xl border p-6"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
          borderWidth: 2,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          <FolderPlus size={18} /> {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-semibold uppercase tracking-wide mb-1.5 inline-block"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
