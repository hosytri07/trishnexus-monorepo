/**
 * Phase 18.8.a — TrishTEAM Library curator.
 *
 * 2-pane layout:
 *   LEFT — list folders (trishteam_library/{folderId})
 *   RIGHT — list links của folder đang chọn (subcollection /links)
 *
 * Admin CRUD cả 2 cấp. User TrishLibrary 3.0 module Thư viện section
 * "TrishTEAM" sẽ thấy các folder + link này (read-only).
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type CreateFolderInput,
  type CreateLinkInput,
  type TrishteamLibraryFolder,
  type TrishteamLibraryLink,
  createLibraryFolder,
  createLibraryLink,
  deleteLibraryFolder,
  deleteLibraryLink,
  formatRelative,
  listLibraryFolders,
  listLibraryLinks,
  updateLibraryFolder,
  updateLibraryLink,
} from '../lib/firestore-admin.js';

const LINK_TYPES: Array<{ value: NonNullable<TrishteamLibraryLink['link_type']>; label: string }> = [
  { value: 'web', label: '🌐 Web' },
  { value: 'pdf', label: '📕 PDF' },
  { value: 'docs', label: '📄 Docs' },
  { value: 'video', label: '🎬 Video' },
  { value: 'other', label: '📎 Khác' },
];

export function LibraryCuratorPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';
  const [folders, setFolders] = useState<TrishteamLibraryFolder[]>([]);
  const [links, setLinks] = useState<TrishteamLibraryLink[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrishteamLibraryFolder | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<TrishteamLibraryLink | null>(null);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) ?? null,
    [folders, activeFolderId],
  );

  async function loadFolders(): Promise<void> {
    setLoadingFolders(true);
    setError(null);
    try {
      const list = await listLibraryFolders();
      setFolders(list);
      if (!activeFolderId && list.length > 0) {
        setActiveFolderId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingFolders(false);
    }
  }

  async function loadLinks(folderId: string): Promise<void> {
    setLoadingLinks(true);
    try {
      const list = await listLibraryLinks(folderId);
      setLinks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingLinks(false);
    }
  }

  useEffect(() => {
    void loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeFolderId) {
      void loadLinks(activeFolderId);
    } else {
      setLinks([]);
    }
  }, [activeFolderId]);

  async function handleSaveFolder(input: CreateFolderInput | null): Promise<void> {
    if (!input) {
      setShowFolderModal(false);
      setEditingFolder(null);
      return;
    }
    try {
      if (editingFolder) {
        await updateLibraryFolder(editingFolder.id, {
          name: input.name,
          description: input.description,
          icon: input.icon,
        });
        setActionMsg(`✓ Cập nhật folder "${input.name}"`);
      } else {
        const f = await createLibraryFolder(input);
        setActionMsg(`✓ Tạo folder "${f.name}"`);
        setActiveFolderId(f.id);
      }
      setShowFolderModal(false);
      setEditingFolder(null);
      await loadFolders();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDeleteFolder(f: TrishteamLibraryFolder): Promise<void> {
    if (
      !window.confirm(
        `Xóa folder "${f.name}" + toàn bộ links bên trong?\nUser sẽ KHÔNG còn thấy các link này trong TrishLibrary.`,
      )
    )
      return;
    try {
      await deleteLibraryFolder(f.id);
      setActionMsg(`✓ Xóa folder "${f.name}"`);
      if (activeFolderId === f.id) setActiveFolderId(null);
      await loadFolders();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleSaveLink(input: CreateLinkInput | null): Promise<void> {
    if (!input || !activeFolderId) {
      setShowLinkModal(false);
      setEditingLink(null);
      return;
    }
    try {
      if (editingLink) {
        await updateLibraryLink(activeFolderId, editingLink.id, {
          title: input.title,
          url: input.url,
          description: input.description,
          icon: input.icon,
          link_type: input.link_type,
        });
        setActionMsg(`✓ Cập nhật "${input.title}"`);
      } else {
        await createLibraryLink({ ...input, folderId: activeFolderId });
        setActionMsg(`✓ Thêm link "${input.title}"`);
      }
      setShowLinkModal(false);
      setEditingLink(null);
      await loadLinks(activeFolderId);
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDeleteLink(l: TrishteamLibraryLink): Promise<void> {
    if (!activeFolderId) return;
    if (!window.confirm(`Xóa link "${l.title}"?`)) return;
    try {
      await deleteLibraryLink(activeFolderId, l.id);
      setActionMsg(`✓ Xóa link "${l.title}"`);
      await loadLinks(activeFolderId);
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>TrishTEAM Library</h1>
          <p className="muted small">
            Folders + links admin curate. Hiển thị cho mọi user trong TrishLibrary 3.0
            module Thư viện section "TrishTEAM" (read-only).
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void loadFolders()}
          disabled={loadingFolders}
        >
          {loadingFolders ? '⏳' : '🔄'} Refresh
        </button>
      </header>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg}
        </div>
      )}

      <div className="curator-layout">
        {/* LEFT — folders */}
        <aside className="curator-folders">
          <div className="curator-section-head">
            <strong>Folders ({folders.length})</strong>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setEditingFolder(null);
                setShowFolderModal(true);
              }}
            >
              ＋ Thêm
            </button>
          </div>
          <ul className="curator-folder-list">
            {folders.length === 0 ? (
              <li className="muted small empty-state">
                {loadingFolders ? 'Đang tải…' : 'Chưa có folder.'}
              </li>
            ) : (
              folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className={`curator-folder-item ${activeFolderId === f.id ? 'active' : ''}`}
                    onClick={() => setActiveFolderId(f.id)}
                  >
                    {f.icon && <span className="curator-folder-icon">{f.icon}</span>}
                    <div className="curator-folder-text">
                      <strong>{f.name}</strong>
                      {f.description && (
                        <span className="muted small">{f.description}</span>
                      )}
                    </div>
                  </button>
                  <div className="curator-folder-actions">
                    <button
                      type="button"
                      className="mini"
                      onClick={() => {
                        setEditingFolder(f);
                        setShowFolderModal(true);
                      }}
                      title="Sửa"
                    >
                      ✏
                    </button>
                    <button
                      type="button"
                      className="mini btn-danger"
                      onClick={() => void handleDeleteFolder(f)}
                      title="Xóa"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>

        {/* RIGHT — links */}
        <main className="curator-links">
          {!activeFolder ? (
            <div className="empty-state muted small">
              ← Chọn 1 folder bên trái để xem/sửa links.
            </div>
          ) : (
            <>
              <div className="curator-section-head">
                <div>
                  <strong>{activeFolder.icon} {activeFolder.name}</strong>
                  <span className="muted small" style={{ marginLeft: 8 }}>
                    {links.length} link · cập nhật {formatRelative(activeFolder.updated_at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setEditingLink(null);
                    setShowLinkModal(true);
                  }}
                >
                  ＋ Thêm link
                </button>
              </div>
              {activeFolder.description && (
                <p className="muted small" style={{ marginBottom: 12 }}>
                  {activeFolder.description}
                </p>
              )}
              <ul className="curator-link-list">
                {links.length === 0 ? (
                  <li className="muted small empty-state">
                    {loadingLinks ? 'Đang tải…' : 'Folder trống.'}
                  </li>
                ) : (
                  links.map((l) => (
                    <li key={l.id} className="curator-link-card">
                      <span className="curator-link-icon">
                        {l.icon ?? linkTypeIcon(l.link_type)}
                      </span>
                      <div className="curator-link-text">
                        <strong>{l.title}</strong>
                        {l.description && (
                          <span className="muted small">{l.description}</span>
                        )}
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="muted small curator-link-url"
                        >
                          🔗 {l.url}
                        </a>
                      </div>
                      <div className="curator-link-actions">
                        <button
                          type="button"
                          className="mini"
                          onClick={() => {
                            setEditingLink(l);
                            setShowLinkModal(true);
                          }}
                          title="Sửa"
                        >
                          ✏
                        </button>
                        <button
                          type="button"
                          className="mini btn-danger"
                          onClick={() => void handleDeleteLink(l)}
                          title="Xóa"
                        >
                          🗑
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </main>
      </div>

      {showFolderModal && (
        <FolderModal
          initial={editingFolder}
          adminUid={adminUid}
          onClose={(input) => void handleSaveFolder(input)}
        />
      )}
      {showLinkModal && activeFolderId && (
        <LinkModal
          initial={editingLink}
          folderId={activeFolderId}
          onClose={(input) => void handleSaveLink(input)}
        />
      )}
    </div>
  );
}

function linkTypeIcon(t: TrishteamLibraryLink['link_type']): string {
  switch (t) {
    case 'pdf': return '📕';
    case 'docs': return '📄';
    case 'video': return '🎬';
    case 'web': return '🌐';
    default: return '🔗';
  }
}

interface FolderModalProps {
  initial: TrishteamLibraryFolder | null;
  adminUid: string;
  onClose: (input: CreateFolderInput | null) => void;
}

function FolderModal({ initial, adminUid, onClose }: FolderModalProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!name.trim()) return;
    onClose({
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      createdByUid: adminUid,
    });
  }

  return (
    <div className="modal-backdrop" onClick={() => onClose(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <header className="modal-head">
          <h2>{initial ? 'Sửa folder' : '＋ Thêm folder'}</h2>
          <button className="mini" onClick={() => onClose(null)}>×</button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="form-label">
            <span>Tên folder *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Tài liệu nội bộ TrishTEAM"
              autoFocus
              required
              maxLength={80}
            />
          </label>
          <label className="form-label">
            <span>Mô tả (tuỳ chọn)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về nội dung folder"
              maxLength={200}
            />
          </label>
          <label className="form-label">
            <span>Icon (emoji — tuỳ chọn)</span>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📚"
              maxLength={4}
              style={{ width: 80 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => onClose(null)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {initial ? '💾 Lưu' : '＋ Tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface LinkModalProps {
  initial: TrishteamLibraryLink | null;
  folderId: string;
  onClose: (input: CreateLinkInput | null) => void;
}

function LinkModal({ initial, folderId, onClose }: LinkModalProps): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [linkType, setLinkType] = useState<TrishteamLibraryLink['link_type']>(
    initial?.link_type ?? 'web',
  );

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    onClose({
      folderId,
      title: title.trim(),
      url: url.trim(),
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      link_type: linkType,
    });
  }

  return (
    <div className="modal-backdrop" onClick={() => onClose(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <header className="modal-head">
          <h2>{initial ? 'Sửa link' : '＋ Thêm link'}</h2>
          <button className="mini" onClick={() => onClose(null)}>×</button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="form-label">
            <span>Tiêu đề *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
              maxLength={120}
            />
          </label>
          <label className="form-label">
            <span>URL *</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              maxLength={500}
            />
          </label>
          <label className="form-label">
            <span>Mô tả (tuỳ chọn)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </label>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 100px' }}>
            <label className="form-label">
              <span>Loại link</span>
              <select
                value={linkType}
                onChange={(e) =>
                  setLinkType(e.target.value as TrishteamLibraryLink['link_type'])
                }
              >
                {LINK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span>Icon</span>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📕"
                maxLength={4}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => onClose(null)}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || !url.trim()}
            >
              {initial ? '💾 Lưu' : '＋ Tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
