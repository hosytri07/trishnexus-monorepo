/**
 * Phase 16.2.d v2 — Detail panel bên phải cho Online Library + TrishTEAM.
 *
 * Click row link → show properties + QR + ghi chú trong panel right (giống
 * DetailPanel local file).
 *
 * Modes:
 *   - readOnly (user xem TrishTEAM): chỉ xem + mở link + copy URL + tải QR
 *   - edit (admin/owner Online cá nhân): sửa được title/url/description/qr
 */

import { useEffect, useState } from 'react';
import {
  type OnlineFolder,
  type OnlineLink,
  isValidUrl,
  sanitizeText,
} from '../types.js';
import { generateQrDataUrl, downloadQrPng } from '../lib/qr-gen.js';
import { openLink } from '../tauri-bridge.js';

interface OnlineLinkDetailPanelProps {
  link: OnlineLink | null;
  folder: OnlineFolder | null;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  readOnly?: boolean;
  onSave: (link: OnlineLink) => void;
  onDelete: (link: OnlineLink) => void;
  onClose: () => void;
}

export function OnlineLinkDetailPanel({
  link,
  folder,
  trKey,
  readOnly = false,
  onSave,
  onDelete,
  onClose,
}: OnlineLinkDetailPanelProps): JSX.Element {
  if (!link) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <div className="detail-empty-text">
          {readOnly
            ? '🔒 Click 1 link để xem chi tiết.\nThư viện do Admin TrishTEAM quản lý.'
            : 'Click 1 link để xem + sửa, hoặc bấm "+ Thêm link" ở trên.'}
        </div>
      </aside>
    );
  }

  return (
    <OnlineLinkDetailInner
      key={link.id}
      link={link}
      folder={folder}
      trKey={trKey}
      readOnly={readOnly}
      onSave={onSave}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

function OnlineLinkDetailInner({
  link,
  folder,
  trKey,
  readOnly,
  onSave,
  onDelete,
  onClose,
}: {
  link: OnlineLink;
  folder: OnlineFolder | null;
  trKey: (key: string, vars?: Record<string, string | number>) => string;
  readOnly: boolean;
  onSave: (link: OnlineLink) => void;
  onDelete: (link: OnlineLink) => void;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<OnlineLink>(link);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset khi click link khác
  useEffect(() => {
    setDraft(link);
    setError(null);
    setDirty(false);
  }, [link.id]);

  // Auto-gen QR khi URL đổi
  useEffect(() => {
    if (readOnly) return;
    if (!draft.url.trim() || !isValidUrl(draft.url)) return;
    if (draft.url === link.url && draft.qr_data_url) return; // không cần gen lại
    setQrLoading(true);
    const t = setTimeout(() => {
      void generateQrDataUrl(draft.url).then((qr) => {
        setDraft((d) => ({ ...d, qr_data_url: qr }));
        setQrLoading(false);
      });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.url]);

  function update<K extends keyof OnlineLink>(
    key: K,
    value: OnlineLink[K],
  ): void {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function handleSave(): void {
    if (!draft.url.trim() || !isValidUrl(draft.url)) {
      setError(trKey('form.error.url_invalid'));
      return;
    }
    if (!draft.title.trim()) {
      setError(trKey('form.error.title_required'));
      return;
    }
    onSave({
      ...draft,
      url: draft.url.trim(),
      title: sanitizeText(draft.title),
      description: sanitizeText(draft.description, 1000),
      updated_at: Date.now(),
    });
    setDirty(false);
  }

  function handleDelete(): void {
    const ok = confirm(
      trKey('online.link.delete_confirm', { title: link.title || link.url }),
    );
    if (ok) onDelete(link);
  }

  async function handleCopyUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const fileNameSafe = `qr-${(link.title || 'link').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`;

  return (
    <aside className="detail-panel">
      <header className="detail-head">
        <code className="detail-id">{link.id}</code>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => void openLink(link.url)}
          title={trKey('online.link.open')}
        >
          🔗 Mở
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => void handleCopyUrl()}
          title={trKey('online.link.copy')}
        >
          {copied ? '✓' : '📋'}
        </button>
        <span className="actions-spacer" />
        <button
          className="detail-close"
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="detail-body">
        {error && (
          <div className="form-error" onClick={() => setError(null)}>
            ⚠ {error}
          </div>
        )}

        {readOnly && (
          <p className="form-locked-hint">
            🔒 Thư viện do Admin TrishTEAM quản lý — chỉ xem.
          </p>
        )}

        {/* QR preview top */}
        <div
          className="link-qr-preview link-qr-large"
          style={{ marginBottom: 16 }}
        >
          {qrLoading ? (
            <div className="qr-placeholder">
              <span className="muted small">Đang gen QR…</span>
            </div>
          ) : draft.qr_data_url ? (
            <>
              <img src={draft.qr_data_url} alt="QR" className="qr-image" />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => void downloadQrPng(draft.qr_data_url, fileNameSafe)}
              >
                ⬇ {trKey('online.link.qr_download')}
              </button>
            </>
          ) : (
            <div className="qr-placeholder muted small">QR</div>
          )}
        </div>

        {/* Folder info */}
        {folder && (
          <div className="form-row">
            <label>
              <span className="form-label">Folder</span>
              <input
                className="input input-locked"
                value={`${folder.icon} ${folder.name}`}
                readOnly
              />
            </label>
          </div>
        )}

        <div className="form-row">
          <label>
            <span className="form-label">{trKey('online.link.title_field')} *</span>
            <input
              className={`input ${readOnly ? 'input-locked' : ''}`}
              value={draft.title}
              placeholder={trKey('online.link.title_placeholder')}
              onChange={(e) => update('title', e.target.value)}
              readOnly={readOnly}
              autoFocus={!readOnly}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span className="form-label">{trKey('online.link.url')} *</span>
            <input
              className={`input ${readOnly ? 'input-locked' : ''} input-mono`}
              value={draft.url}
              placeholder="https://…"
              onChange={(e) => update('url', e.target.value)}
              readOnly={readOnly}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            <span className="form-label">
              {trKey('online.link.description')} / Ghi chú
            </span>
            <textarea
              className={`input ${readOnly ? 'input-locked' : ''}`}
              rows={5}
              value={draft.description}
              placeholder={
                readOnly
                  ? '(không có ghi chú)'
                  : trKey('online.link.description_placeholder')
              }
              onChange={(e) => update('description', e.target.value)}
              readOnly={readOnly}
              maxLength={1000}
            />
          </label>
        </div>

        <div className="form-row two">
          <label>
            <span className="form-label">Tạo lúc</span>
            <input
              className="input input-locked"
              value={
                link.created_at
                  ? new Date(link.created_at).toLocaleString('vi-VN')
                  : '—'
              }
              readOnly
            />
          </label>
          <label>
            <span className="form-label">Cập nhật</span>
            <input
              className="input input-locked"
              value={
                link.updated_at
                  ? new Date(link.updated_at).toLocaleString('vi-VN')
                  : '—'
              }
              readOnly
            />
          </label>
        </div>
      </div>

      {!readOnly && (
        <footer className="detail-foot">
          <button
            type="button"
            className="btn btn-ghost btn-danger btn-small"
            onClick={handleDelete}
          >
            🗑 Xóa link
          </button>
          <span className="actions-spacer" />
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={handleSave}
            disabled={!dirty}
          >
            Lưu
          </button>
        </footer>
      )}
    </aside>
  );
}
