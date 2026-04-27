/**
 * Phase 15.2.r9 — DetailPanel: inline edit panel bên phải table.
 *
 * Click row trong table → panel hiện thông tin file + form edit doc_title /
 * links / note. File metadata (path, name, type, size, folder) read-only.
 *
 * Auto-save khi user blur ra ngoài hoặc bấm Save (debounce qua app-level).
 */

import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  type DownloadLink,
  type LibraryFile,
  formatBytes,
  isValidUrl,
  newLinkId,
  sanitizeText,
} from '../types.js';
import { generateQrDataUrl, downloadQrPng } from '../lib/qr-gen.js';
import { openLink, openLocalPath } from '../tauri-bridge.js';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { requestCreateNoteAbout } from '../lib/module-bus.js';
import { AnnotationModal, getAnnotationsFor } from './AnnotationModal.js';
import { useAuth } from '@trishteam/auth/react';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Phase 18.5.b — Export file bundle JSON: metadata + annotations + related notes.
 */
async function exportFileBundle(file: LibraryFile, uid: string | null): Promise<void> {
  try {
    const annotations = getAnnotationsFor(file.path, uid);
    // Find related notes — search note store for path or filename references
    const relatedNotes: unknown[] = [];
    try {
      const raw = window.localStorage.getItem('trishlibrary.note.store.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
        const fname = file.file_name.toLowerCase();
        const docTitle = (file.doc_title ?? '').toLowerCase();
        const path = file.path.toLowerCase();
        for (const n of notes) {
          if (n.trashed) continue;
          const text = String(n.content_html ?? '').toLowerCase();
          const title = String(n.title ?? '').toLowerCase();
          if (
            text.includes(fname) ||
            text.includes(path) ||
            (docTitle && (text.includes(docTitle) || title.includes(docTitle)))
          ) {
            relatedNotes.push(n);
          }
        }
      }
    } catch {
      /* skip */
    }

    const bundle = {
      version: 1,
      bundle_type: 'library_file',
      created_at: new Date().toISOString(),
      file: {
        id: file.id,
        path: file.path,
        file_name: file.file_name,
        doc_title: file.doc_title,
        file_type: file.file_type,
        size_bytes: file.size_bytes,
        mtime_ms: file.mtime_ms,
        note: file.note,
        links: file.links,
      },
      annotations,
      related_notes: relatedNotes,
    };

    const stem = (file.doc_title || file.file_name)
      .replace(/[<>:"/\\|?*]/g, '_')
      .slice(0, 80);
    const date = new Date().toISOString().slice(0, 10);
    const target = await saveDialog({
      defaultPath: `${stem}_bundle_${date}.json`,
      filters: [{ name: 'TrishLibrary Bundle', extensions: ['json'] }],
    });
    if (typeof target !== 'string') return;
    await invoke('write_text_string', {
      path: target,
      content: JSON.stringify(bundle, null, 2),
    });
    window.alert(
      `✓ Đã export bundle\n` +
        `  ${annotations.length} annotation\n` +
        `  ${relatedNotes.length} note liên quan\n→ ${target}`,
    );
  } catch (e) {
    window.alert(`⚠ Export thất bại: ${String(e)}`);
  }
}

/** File types có thể preview natively trong WebView2 (Chromium PDF + img). */
function canPreview(file: LibraryFile): 'pdf' | 'image' | null {
  if (file.file_type === 'pdf') return 'pdf';
  if (file.file_type === 'image') return 'image';
  return null;
}

interface DetailPanelProps {
  file: LibraryFile | null;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onSave: (file: LibraryFile) => void;
  onDelete: (file: LibraryFile) => void;
  onClose: () => void;
}

export function DetailPanel({
  file,
  trKey,
  onSave,
  onDelete,
  onClose,
}: DetailPanelProps): JSX.Element {
  if (!file) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <div className="detail-empty-text">{trKey('detail.empty')}</div>
      </aside>
    );
  }
  return (
    <DetailPanelInner
      key={file.path}
      file={file}
      trKey={trKey}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

function DetailPanelInner({
  file,
  trKey,
  onSave,
  onDelete,
  onClose,
}: {
  file: LibraryFile;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  onSave: (file: LibraryFile) => void;
  onDelete: (file: LibraryFile) => void;
  onClose: () => void;
}): JSX.Element {
  const { profile } = useAuth();
  const uid = profile?.id ?? null;
  const [draft, setDraft] = useState<LibraryFile>(() => ({
    ...file,
    links: [...file.links],
  }));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const annotationCount = getAnnotationsFor(file.path, uid).length;

  // Reset draft when file id/path changes (different row clicked)
  useEffect(() => {
    setDraft({ ...file, links: [...file.links] });
    setError(null);
    setDirty(false);
  }, [file.path]);

  function update<K extends keyof LibraryFile>(
    key: K,
    value: LibraryFile[K],
  ): void {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function addLink(): void {
    setDraft((d) => ({
      ...d,
      links: [
        ...d.links,
        { id: newLinkId(), url: '', label: '', qr_data_url: '' },
      ],
    }));
    setDirty(true);
  }

  function updateLink(linkId: string, patch: Partial<DownloadLink>): void {
    setDraft((d) => ({
      ...d,
      links: d.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    }));
    setDirty(true);
  }

  function removeLink(linkId: string): void {
    setDraft((d) => ({
      ...d,
      links: d.links.filter((l) => l.id !== linkId),
    }));
    setDirty(true);
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
    setDirty(false);
  }

  function handleDelete(): void {
    const ok = confirm(
      trKey('form.confirm_delete', { name: file.doc_title || file.file_name }),
    );
    if (ok) onDelete(file);
  }

  return (
    <aside className="detail-panel">
      <header className="detail-head">
        <code className="detail-id">{file.id}</code>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => void openLocalPath(file.path)}
          title={trKey('detail.action.open_file_tooltip')}
        >
          📂 {trKey('detail.action.open_file')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => {
            void navigator.clipboard?.writeText(file.path);
          }}
          title={trKey('detail.action.copy_path')}
        >
          📋
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => {
            const title = file.doc_title || file.file_name;
            const content = `<p><strong>📄 Ghi chú về:</strong> ${escapeHtml(title)}</p>
<p class="muted small">File: <code>${escapeHtml(file.file_name)}</code><br>Đường dẫn: <code>${escapeHtml(file.path)}</code></p>
<p>—</p>
<p></p>`;
            requestCreateNoteAbout({
              title: `Ghi chú: ${title}`,
              content_html: content,
              category: 'personal',
              tags: ['from-library'],
            });
          }}
          title="Tạo ghi chú về file này (chuyển sang module Ghi chú)"
        >
          📝 Note
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => setShowAnnotations(true)}
          title="Chú thích / highlight (lưu localStorage)"
        >
          📝 Chú thích {annotationCount > 0 && <span className="badge-small">{annotationCount}</span>}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => void exportFileBundle(file, uid)}
          title="Export bundle JSON: file metadata + annotations + notes liên quan"
        >
          📦 Export bundle
        </button>
        <span className="actions-spacer" />
        <button
          className="detail-close"
          onClick={onClose}
          type="button"
          aria-label={trKey('settings.close')}
          title={trKey('settings.close')}
        >
          ×
        </button>
      </header>

      {/* Preview area (PDF iframe / image / placeholder) */}
      <FilePreview file={file} trKey={trKey} />

      <div className="detail-body">
        {error && (
          <div className="form-error" onClick={() => setError(null)}>
            ⚠ {error}
          </div>
        )}

        <p className="form-locked-hint">{trKey('form.field.locked_hint')}</p>

        <div className="form-row two">
          <label>
            <span className="form-label">{trKey('form.field.file_type')}</span>
            <input
              className="input input-locked"
              value={trKey(`type.${file.file_type}`)}
              readOnly
            />
          </label>
          <label>
            <span className="form-label">{trKey('form.field.size')}</span>
            <input
              className="input input-locked"
              value={formatBytes(file.size_bytes)}
              readOnly
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span className="form-label">{trKey('form.field.file_name')}</span>
            <input
              className="input input-locked"
              value={file.file_name}
              readOnly
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span className="form-label">{trKey('form.field.path')}</span>
            <input
              className="input input-locked input-mono"
              value={file.path}
              readOnly
              title={file.path}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span className="form-label">{trKey('form.field.folder')}</span>
            <input
              className="input input-locked"
              value={file.folder || '(root)'}
              readOnly
            />
          </label>
        </div>

        {/* Editable */}
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

        <div className="form-section">
          <div className="form-section-head">
            <h3>{trKey('form.links.title')}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={addLink}
            >
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
                  docTitle={draft.doc_title || file.file_name || file.id}
                  trKey={trKey}
                  onChange={(patch) => updateLink(link.id, patch)}
                  onRemove={() => removeLink(link.id)}
                />
              ))}
            </div>
          )}
        </div>

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
      </div>

      <footer className="detail-foot">
        <button
          type="button"
          className="btn btn-ghost btn-danger btn-small"
          onClick={handleDelete}
          title="Xóa khỏi DB của app (file thật trên ổ vẫn còn)"
        >
          🗑 {trKey('form.action.delete')}
        </button>
        <span className="actions-spacer" />
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => void handleSave()}
          disabled={!dirty}
        >
          {trKey('form.action.save')}
        </button>
      </footer>

      {showAnnotations && (
        <AnnotationModal
          filePath={file.path}
          fileName={file.doc_title || file.file_name}
          onClose={() => setShowAnnotations(false)}
        />
      )}
    </aside>
  );
}

// ============================================================
// Link editor (giống FileFormModal cũ)
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

  const fileNameSafe =
    `qr-${docTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}-${link.label || 'link'}`;

  return (
    <div className="link-editor link-editor-vertical">
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
      <div className="link-bottom-row">
        <div className="link-qr-inline">
          {qrLoading ? (
            <div className="qr-placeholder qr-small">
              <span className="muted small">…</span>
            </div>
          ) : link.qr_data_url ? (
            <img src={link.qr_data_url} alt="QR" className="qr-image qr-small" />
          ) : (
            <div className="qr-placeholder qr-small muted small">QR</div>
          )}
        </div>
        <div className="link-actions">
          {link.qr_data_url && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => void downloadQrPng(link.qr_data_url, fileNameSafe)}
            >
              ⬇ QR
            </button>
          )}
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
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// File preview area — PDF iframe / image / placeholder
// ============================================================

function FilePreview({
  file,
  trKey,
}: {
  file: LibraryFile;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
}): JSX.Element {
  const kind = canPreview(file);
  const assetUrl = useMemo(() => {
    try {
      return convertFileSrc(file.path);
    } catch {
      return '';
    }
  }, [file.path]);

  if (!kind) {
    return (
      <div className="file-preview file-preview-placeholder">
        <span className="muted small">{trKey('preview.no_support')}</span>
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => void openLocalPath(file.path)}
        >
          📂 {trKey('detail.action.open_file')}
        </button>
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div className="file-preview">
        <img src={assetUrl} alt={file.file_name} className="file-preview-img" />
      </div>
    );
  }

  // PDF — WebView2 native renderer
  return (
    <div className="file-preview">
      <iframe
        src={assetUrl}
        title={file.file_name}
        className="file-preview-iframe"
      />
    </div>
  );
}
