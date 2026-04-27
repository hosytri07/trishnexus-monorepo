/**
 * Phase 15.2.r12 — Online Library: folders + links collection.
 *
 * 4 sub-components in 1 file (giảm tab churn):
 *   - OnlineLibrarySidebar: list folders trong sidebar
 *   - OnlineLibraryMain: bảng links trong folder đang chọn (main column)
 *   - OnlineFolderModal: form add/edit folder + icon picker
 *   - OnlineLinkModal: form add/edit link
 */

import { useEffect, useState } from 'react';
import {
  type OnlineFolder,
  type OnlineLink,
  ONLINE_ICON_PRESETS,
  isValidUrl,
  newLinkId,
  nextOnlineFolderId,
  nextOnlineLinkId,
  sanitizeText,
} from '../types.js';
import { generateQrDataUrl, downloadQrPng } from '../lib/qr-gen.js';
import { openLink } from '../tauri-bridge.js';

type Tr = (key: string, vars?: Record<string, string | number>) => string;

// ============================================================
// Sidebar section
// ============================================================

interface OnlineLibrarySidebarProps {
  folders: OnlineFolder[];
  selectedFolderId: string | null;
  trKey: Tr;
  /** Label section (vd "Thư viện Online" hoặc "Thư viện TrishTEAM") */
  label: string;
  /** Hint nhỏ dưới label (vd "Riêng của bạn..." hoặc "Admin curated...") */
  hint?: string;
  /** Read-only mode: ẩn nút "+ Thêm folder" và "✏ Edit folder". */
  readOnly?: boolean;
  onSelectFolder: (folderId: string | null) => void;
  onAddFolder: () => void;
  onEditFolder: (folder: OnlineFolder) => void;
}

export function OnlineLibrarySidebar({
  folders,
  selectedFolderId,
  trKey,
  label,
  hint,
  readOnly = false,
  onSelectFolder,
  onAddFolder,
  onEditFolder,
}: OnlineLibrarySidebarProps): JSX.Element {
  return (
    <section className="side-block">
      <div className="side-label-row">
        <span className="side-label">
          {label}
          {readOnly && ' 🔒'}
        </span>
        {!readOnly && (
          <button
            type="button"
            className="side-label-action"
            onClick={onAddFolder}
            title={trKey('online.add_folder')}
          >
            +
          </button>
        )}
      </div>
      {hint && <p className="side-hint muted small">{hint}</p>}
      {folders.length === 0 ? (
        <p className="muted small online-empty-hint">{trKey('online.empty')}</p>
      ) : (
        <div className="folder-tree">
          {folders.map((f) => (
            <div
              key={f.id}
              className={
                'tree-node tree-online-folder ' +
                (selectedFolderId === f.id ? 'active' : '')
              }
            >
              <span className="tree-toggle-spacer" />
              <span className="tree-icon">{f.icon}</span>
              <button
                type="button"
                className="tree-label-btn"
                onClick={() => onSelectFolder(f.id)}
                title={f.name}
              >
                <span className="tree-label">{f.name}</span>
                <span className="tree-count">{f.links.length}</span>
              </button>
              {!readOnly && (
                <span className="tree-actions">
                  <button
                    type="button"
                    className="tree-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(f);
                    }}
                    title="Sửa folder"
                  >
                    ✏
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// Main view (table of links in selected folder)
// ============================================================

interface OnlineLibraryMainProps {
  folder: OnlineFolder;
  trKey: Tr;
  selectedLinkId: string | null;
  /** Read-only — chỉ xem + click link, không add/edit/delete */
  readOnly?: boolean;
  onAddLink: () => void;
  onEditLink: (link: OnlineLink) => void;
  onDeleteLink: (link: OnlineLink) => void;
}

export function OnlineLibraryMain({
  folder,
  trKey,
  selectedLinkId,
  readOnly = false,
  onAddLink,
  onEditLink,
  onDeleteLink,
}: OnlineLibraryMainProps): JSX.Element {
  return (
    <div className="online-main">
      <div className="online-main-head">
        <span className="online-main-icon">{folder.icon}</span>
        <h2 className="online-main-title">{folder.name}</h2>
        <span className="muted small">
          · {folder.links.length} link
        </span>
        <span className="actions-spacer" />
        {!readOnly && (
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={onAddLink}
          >
            {trKey('online.link.add')}
          </button>
        )}
      </div>
      {!readOnly && (
        <p className="muted small online-sync-hint">
          {trKey('online.sync_hint')}
        </p>
      )}
      {readOnly && (
        <p
          className="muted small online-sync-hint"
          style={{ background: 'rgba(168,85,247,0.1)', color: 'rgb(196,124,255)' }}
        >
          🔒 Thư viện do Admin TrishTEAM quản lý — chỉ xem + mở link + tải QR.
        </p>
      )}

      {folder.links.length === 0 ? (
        <div className="empty">
          <p>{trKey('online.folder.empty_links')}</p>
        </div>
      ) : (
        <div className="file-table-wrap">
          <table className="file-table">
            <thead>
              <tr>
                <th className="col-id">{trKey('online.col.id')}</th>
                <th className="col-title">{trKey('online.col.title')}</th>
                <th>{trKey('online.col.url')}</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {folder.links.map((link) => {
                const selected = link.id === selectedLinkId;
                return (
                  <tr
                    key={link.id}
                    className={
                      'file-row ' + (selected ? 'file-row-selected' : '')
                    }
                    onClick={() => onEditLink(link)}
                  >
                    <td className="col-id">
                      <code className="file-id">{link.id}</code>
                    </td>
                    <td>
                      <strong>{link.title || '(không tiêu đề)'}</strong>
                      {link.description && (
                        <div className="muted small">{link.description}</div>
                      )}
                    </td>
                    <td>
                      <code className="online-link-url" title={link.url}>
                        {link.url}
                      </code>
                    </td>
                    <td className="col-actions">
                      <button
                        type="button"
                        className="row-btn row-btn-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openLink(link.url);
                        }}
                        title={trKey('online.link.open')}
                      >
                        🔗
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          className="row-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLink(link);
                          }}
                          title="Xóa link"
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Folder Modal (add / edit)
// ============================================================

interface OnlineFolderModalProps {
  folder: OnlineFolder | null;
  allFolders: OnlineFolder[];
  trKey: Tr;
  onSave: (folder: OnlineFolder) => void;
  onDelete: (folder: OnlineFolder) => void;
  onClose: () => void;
}

export function OnlineFolderModal({
  folder,
  allFolders,
  trKey,
  onSave,
  onDelete,
  onClose,
}: OnlineFolderModalProps): JSX.Element {
  const isEdit = folder !== null;
  const [name, setName] = useState(folder?.name ?? '');
  const [icon, setIcon] = useState(folder?.icon ?? '📁');

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleSave(): void {
    const finalName = sanitizeText(name, 100);
    if (!finalName) return;
    const now = Date.now();
    if (folder) {
      onSave({ ...folder, name: finalName, icon, updated_at: now });
    } else {
      onSave({
        id: nextOnlineFolderId(allFolders),
        name: finalName,
        icon,
        links: [],
        created_at: now,
        updated_at: now,
      });
    }
  }

  function handleDelete(): void {
    if (!folder) return;
    const ok = confirm(
      trKey('online.folder.delete_confirm', { name: folder.name }),
    );
    if (ok) onDelete(folder);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">
          ×
        </button>
        <header className="modal-head">
          <h2>
            {isEdit
              ? trKey('online.folder.title_edit')
              : trKey('online.folder.title_add')}
          </h2>
        </header>
        <section className="modal-body">
          <div className="form-row">
            <label>
              <span className="form-label">{trKey('online.folder.name')}</span>
              <input
                className="input"
                value={name}
                placeholder={trKey('online.folder.name_placeholder')}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={100}
              />
            </label>
          </div>
          <div className="form-row">
            <span className="form-label">{trKey('online.folder.icon')}</span>
            <div className="icon-grid">
              {ONLINE_ICON_PRESETS.map((preset) => (
                <button
                  key={preset.icon}
                  type="button"
                  className={
                    'icon-grid-btn ' + (icon === preset.icon ? 'active' : '')
                  }
                  onClick={() => setIcon(preset.icon)}
                  title={preset.label}
                >
                  {preset.icon}
                </button>
              ))}
            </div>
          </div>
        </section>
        <footer className="modal-foot">
          {isEdit && (
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={handleDelete}
            >
              🗑 Xóa folder
            </button>
          )}
          <span className="actions-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {trKey('settings.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {trKey('settings.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// Link Modal (add / edit)
// ============================================================

interface OnlineLinkModalProps {
  link: OnlineLink | null;
  folder: OnlineFolder;
  trKey: Tr;
  onSave: (link: OnlineLink) => void;
  onDelete: (link: OnlineLink) => void;
  onClose: () => void;
}

export function OnlineLinkModal({
  link,
  folder,
  trKey,
  onSave,
  onDelete,
  onClose,
}: OnlineLinkModalProps): JSX.Element {
  const isEdit = link !== null;
  const [url, setUrl] = useState(link?.url ?? '');
  const [title, setTitle] = useState(link?.title ?? '');
  const [description, setDescription] = useState(link?.description ?? '');
  const [qrDataUrl, setQrDataUrl] = useState(link?.qr_data_url ?? '');
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Auto-gen QR khi URL đổi
  useEffect(() => {
    if (!url.trim()) {
      setQrDataUrl('');
      return;
    }
    if (!isValidUrl(url)) return;
    setQrLoading(true);
    const t = setTimeout(() => {
      void generateQrDataUrl(url).then((q) => {
        setQrDataUrl(q);
        setQrLoading(false);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [url]);

  function handleSave(): void {
    if (!url.trim() || !isValidUrl(url)) {
      setError(trKey('form.error.url_invalid'));
      return;
    }
    if (!title.trim()) {
      setError(trKey('form.error.title_required'));
      return;
    }
    const now = Date.now();
    if (link) {
      onSave({
        ...link,
        url: url.trim(),
        title: sanitizeText(title),
        description: sanitizeText(description, 1000),
        qr_data_url: qrDataUrl,
        updated_at: now,
      });
    } else {
      onSave({
        id: nextOnlineLinkId(folder.links),
        url: url.trim(),
        title: sanitizeText(title),
        description: sanitizeText(description, 1000),
        qr_data_url: qrDataUrl,
        created_at: now,
        updated_at: now,
      });
    }
  }

  function handleDelete(): void {
    if (!link) return;
    const ok = confirm(
      trKey('online.link.delete_confirm', { title: link.title }),
    );
    if (ok) onDelete(link);
  }

  const fileNameSafe = `qr-${(title || 'link').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} type="button">
          ×
        </button>
        <header className="modal-head">
          <h2>
            {isEdit
              ? trKey('online.link.title_edit')
              : trKey('online.link.title_add')}
          </h2>
        </header>
        <section className="modal-body">
          {error && (
            <div className="form-error" onClick={() => setError(null)}>
              ⚠ {error}
            </div>
          )}
          <div className="form-row">
            <label>
              <span className="form-label">{trKey('online.link.url')} *</span>
              <input
                className="input"
                value={url}
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
                autoFocus={!isEdit}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span className="form-label">
                {trKey('online.link.title_field')} *
              </span>
              <input
                className="input"
                value={title}
                placeholder={trKey('online.link.title_placeholder')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span className="form-label">
                {trKey('online.link.description')}
              </span>
              <textarea
                className="input"
                rows={3}
                value={description}
                placeholder={trKey('online.link.description_placeholder')}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
            </label>
          </div>

          {/* QR preview + download */}
          <div className="form-row">
            <span className="form-label">QR code</span>
            <div className="link-qr-preview link-qr-large">
              {qrLoading ? (
                <div className="qr-placeholder">
                  <span className="muted small">{trKey('form.links.qr_loading')}</span>
                </div>
              ) : qrDataUrl ? (
                <>
                  <img src={qrDataUrl} alt="QR" className="qr-image" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => void downloadQrPng(qrDataUrl, fileNameSafe)}
                  >
                    ⬇ {trKey('online.link.qr_download')}
                  </button>
                </>
              ) : (
                <div className="qr-placeholder muted small">QR sẽ tự gen khi nhập URL</div>
              )}
            </div>
          </div>
        </section>
        <footer className="modal-foot">
          {isEdit && (
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={handleDelete}
            >
              🗑 Xóa link
            </button>
          )}
          {url.trim() && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void openLink(url)}
            >
              🔗 {trKey('online.link.open')}
            </button>
          )}
          <span className="actions-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {trKey('settings.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
          >
            {trKey('settings.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Helper: tránh unused import warning. */
export const _newLinkId = newLinkId;
