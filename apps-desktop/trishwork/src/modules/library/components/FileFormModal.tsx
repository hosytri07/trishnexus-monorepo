/**
 * Phase 15.2.r8 — FileFormModal: edit-only mode.
 *
 * File metadata (file_name, path, type, size, folder) lấy từ filesystem khi
 * scan — read-only trong form. User chỉ sửa: doc_title, links[], note.
 *
 * Nút Xóa = xóa file khỏi library DB (không xóa file thật trên ổ cứng).
 */

import { useEffect, useState } from 'react';
import {
  type DownloadLink,
  type LibraryFile,
  formatBytes,
  isValidUrl,
  newLinkId,
  sanitizeText,
} from '../types.js';
import { generateQrDataUrl, downloadQrPng } from '../lib/qr-gen.js';
import { openLink } from '../tauri-bridge.js';

interface FileFormModalProps {
  file: LibraryFile;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onSave: (file: LibraryFile) => void;
  onDelete: (file: LibraryFile) => void;
  onClose: () => void;
}

export function FileFormModal({
  file,
  trKey,
  onSave,
  onDelete,
  onClose,
}: FileFormModalProps): JSX.Element {
  const [draft, setDraft] = useState<LibraryFile>(() => ({
    ...file,
    links: [...file.links],
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function update<K extends keyof LibraryFile>(
    key: K,
    value: LibraryFile[K],
  ): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function addLink(): void {
    setDraft((d) => ({
      ...d,
      links: [
        ...d.links,
        { id: newLinkId(), url: '', label: '', qr_data_url: '' },
      ],
    }));
  }

  function updateLink(linkId: string, patch: Partial<DownloadLink>): void {
    setDraft((d) => ({
      ...d,
      links: d.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    }));
  }

  function removeLink(linkId: string): void {
    setDraft((d) => ({
      ...d,
      links: d.links.filter((l) => l.id !== linkId),
    }));
  }

  async function handleSave(): Promise<void> {
    if (!draft.doc_title.trim()) {
      setError(trKey('form.error.title_required'));
      return;
    }
    for (const link of draft.links) {
      if (link.url.trim() && !isValidUrl(link.url)) {
        setError(trKey('form.error.url_invalid'));
        return;
      }
    }

    const finalLinks: DownloadLink[] = [];
    for (const link of draft.links) {
      if (!link.url.trim()) continue;
      let qr = link.qr_data_url;
      if (!qr) {
        qr = await generateQrDataUrl(link.url);
      }
      finalLinks.push({
        id: link.id,
        url: link.url.trim(),
        label: sanitizeText(link.label, 50),
        qr_data_url: qr,
      });
    }

    onSave({
      ...draft,
      doc_title: sanitizeText(draft.doc_title),
      note: sanitizeText(draft.note, 5000),
      links: finalLinks,
      updated_at: Date.now(),
    });
  }

  function handleDelete(): void {
    const ok = confirm(
      trKey('form.confirm_delete', { name: file.doc_title || file.file_name }),
    );
    if (ok) onDelete(file);
  }

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
          <h2>{trKey('form.title.edit')}</h2>
        </header>

        <section className="modal-body">
          {error && (
            <div className="form-error" onClick={() => setError(null)}>
              ⚠ {error}
            </div>
          )}

          <p className="form-locked-hint">
            {trKey('form.field.locked_hint')}
          </p>

          {/* Locked filesystem fields */}
          <div className="form-row two">
            <label>
              <span className="form-label">{trKey('form.field.id')}</span>
              <input className="input input-locked" value={draft.id} readOnly />
            </label>
            <label>
              <span className="form-label">{trKey('form.field.file_type')}</span>
              <input
                className="input input-locked"
                value={trKey(`type.${draft.file_type}`)}
                readOnly
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span className="form-label">{trKey('form.field.file_name')}</span>
              <input
                className="input input-locked"
                value={draft.file_name}
                readOnly
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span className="form-label">{trKey('form.field.path')}</span>
              <input
                className="input input-locked input-mono"
                value={draft.path}
                readOnly
                title={draft.path}
              />
            </label>
          </div>

          <div className="form-row two">
            <label>
              <span className="form-label">{trKey('form.field.size')}</span>
              <input
                className="input input-locked"
                value={formatBytes(draft.size_bytes)}
                readOnly
              />
            </label>
            <label>
              <span className="form-label">{trKey('form.field.folder')}</span>
              <input
                className="input input-locked"
                value={draft.folder || '(root)'}
                readOnly
              />
            </label>
          </div>

          {/* Editable: doc_title */}
          <div className="form-row">
            <label>
              <span className="form-label">
                {trKey('form.field.doc_title')} *
              </span>
              <input
                className="input"
                value={draft.doc_title}
                placeholder={trKey('form.field.doc_title_placeholder')}
                onChange={(e) => update('doc_title', e.target.value)}
                autoFocus
              />
            </label>
          </div>

          {/* Editable: links + QR */}
          <div className="form-section">
            <div className="form-section-head">
              <h3>{trKey('form.links.title')}</h3>
              <button type="button" className="btn btn-ghost btn-small" onClick={addLink}>
                {trKey('form.links.add')}
              </button>
            </div>
            {draft.links.length === 0 ? (
              <p className="muted small">{trKey('form.links.empty')}</p>
            ) : (
              <div className="links-list">
                {draft.links.map((link) => (
                  <LinkEditor
                    key={link.id}
                    link={link}
                    docTitle={draft.doc_title || draft.file_name || draft.id}
                    trKey={trKey}
                    onChange={(patch) => updateLink(link.id, patch)}
                    onRemove={() => removeLink(link.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Editable: note */}
          <div className="form-row">
            <label>
              <span className="form-label">{trKey('form.field.note')}</span>
              <textarea
                className="input"
                rows={4}
                value={draft.note}
                placeholder={trKey('form.field.note_placeholder')}
                onChange={(e) => update('note', e.target.value)}
                maxLength={5000}
              />
            </label>
          </div>
        </section>

        <footer className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={handleDelete}
            title="Xóa khỏi library DB (không xóa file thật)"
          >
            🗑 {trKey('form.action.delete')}
          </button>
          <span className="actions-spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {trKey('form.action.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
          >
            {trKey('form.action.save')}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// Link editor
// ============================================================

interface LinkEditorProps {
  link: DownloadLink;
  docTitle: string;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onChange: (patch: Partial<DownloadLink>) => void;
  onRemove: () => void;
}

function LinkEditor({
  link,
  docTitle,
  trKey,
  onChange,
  onRemove,
}: LinkEditorProps): JSX.Element {
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (!link.url.trim()) {
      if (link.qr_data_url) onChange({ qr_data_url: '' });
      return;
    }
    if (!isValidUrl(link.url)) return;

    setQrLoading(true);
    const timer = setTimeout(() => {
      void generateQrDataUrl(link.url).then((qr) => {
        onChange({ qr_data_url: qr });
        setQrLoading(false);
      });
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.url]);

  const fileNameSafe = `qr-${docTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}-${link.label || 'link'}`;

  return (
    <div className="link-editor">
      <div className="link-editor-fields">
        <div className="form-row two">
          <input
            className="input"
            placeholder={trKey('form.links.label_placeholder')}
            value={link.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
          <input
            className="input"
            placeholder={trKey('form.links.url_placeholder')}
            value={link.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>
        <div className="link-actions">
          {link.url.trim() && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => void openLink(link.url)}
            >
              🔗 Mở
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-small btn-danger"
            onClick={onRemove}
          >
            🗑 {trKey('form.links.remove')}
          </button>
        </div>
      </div>
      <div className="link-qr-preview">
        {qrLoading ? (
          <div className="qr-placeholder">
            <span className="muted small">{trKey('form.links.qr_loading')}</span>
          </div>
        ) : link.qr_data_url ? (
          <>
            <img src={link.qr_data_url} alt="QR" className="qr-image" />
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => void downloadQrPng(link.qr_data_url, fileNameSafe)}
            >
              ⬇ QR
            </button>
          </>
        ) : (
          <div className="qr-placeholder muted small">QR</div>
        )}
      </div>
    </div>
  );
}
