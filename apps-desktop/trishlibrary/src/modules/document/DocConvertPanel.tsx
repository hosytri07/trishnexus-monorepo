/**
 * Phase 18.5.c — DocConvertPanel.
 *
 * Sub-tab "Chuyển đổi" — 1 unified card grid:
 *   File convert (docx/md/html/txt/pdf/json) → modal
 *   PDF Tools — 13 tool cards (mỗi card mở 1 modal riêng)
 *
 * Bỏ layout 2-section + tips column. Tất cả là 1 page card-grid.
 */

import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  type DocFormat,
  FORMAT_LABELS,
  basename,
  detectFormatFromName,
} from './types.js';
import {
  exportFromHtml,
  importToHtml,
  importTipTapJson,
} from './formats.js';
import { PdfTools } from './PdfTools.js';

interface Props {
  tr: (key: string, vars?: Record<string, string | number>) => string;
  onFlash: (msg: string) => void;
  onOpenInEditor: (path: string) => void;
}

const OUTPUT_FORMATS: DocFormat[] = ['docx', 'md', 'html', 'txt', 'pdf', 'json'];

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export function DocConvertPanel({ tr, onFlash, onOpenInEditor }: Props): JSX.Element {
  const [showFileConvert, setShowFileConvert] = useState(false);

  return (
    <div className="doc-convert-panel doc-convert-grid">
      <header className="doc-convert-grid-head">
        <h2>🛠 Công cụ chuyển đổi & xử lý</h2>
        <p className="muted small">
          Tất cả công cụ offline 100% — không upload, không gửi server. Chọn 1 thẻ để bắt đầu.
        </p>
      </header>

      <div className="doc-convert-tools-grid">
        <button
          type="button"
          className="pdf-tool-card pdf-tool-clickable doc-convert-file-card"
          onClick={() => setShowFileConvert(true)}
          title="Chuyển đổi giữa các định dạng tài liệu"
        >
          <span className="pdf-tool-icon">📑</span>
          <div>
            <strong>Chuyển đổi định dạng</strong>
            <p className="muted small">.docx · .md · .html · .txt · .pdf · .json</p>
          </div>
        </button>

        <PdfTools tr={tr} variant="grid-only" />
      </div>

      {showFileConvert && (
        <FileConvertModal
          tr={tr}
          onFlash={onFlash}
          onOpenInEditor={onOpenInEditor}
          onClose={() => setShowFileConvert(false)}
        />
      )}
    </div>
  );
}

interface ModalProps {
  tr: (key: string, vars?: Record<string, string | number>) => string;
  onFlash: (msg: string) => void;
  onOpenInEditor: (path: string) => void;
  onClose: () => void;
}

function FileConvertModal({
  tr,
  onFlash,
  onOpenInEditor,
  onClose,
}: ModalProps): JSX.Element {
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<DocFormat>('pdf');
  const [running, setRunning] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !running) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, onClose]);

  async function handlePickSource(): Promise<void> {
    if (!isInTauri()) return;
    const picked = await openDialog({
      multiple: false,
      filters: [
        {
          name: 'Tất cả định dạng',
          extensions: ['docx', 'md', 'markdown', 'html', 'htm', 'txt', 'json', 'pdf'],
        },
      ],
    });
    if (typeof picked === 'string') {
      setSourcePath(picked);
      setResultPath(null);
    }
  }

  async function handleConvert(): Promise<void> {
    if (!sourcePath) return;
    setRunning(true);
    setResultPath(null);
    try {
      const srcFmt = detectFormatFromName(sourcePath);
      let html: string;
      let tipTapJson: unknown = null;
      if (srcFmt === 'docx' || srcFmt === 'pdf') {
        const bytes = await invoke<number[]>('read_binary_file', { path: sourcePath });
        const ab = new Uint8Array(bytes).buffer;
        const r = await importToHtml(ab, srcFmt);
        html = r.html;
      } else if (srcFmt === 'json') {
        const text = await invoke<string>('read_text_string', { path: sourcePath });
        const json = importTipTapJson(text);
        html = json.html ?? '<p></p>';
        tipTapJson = json;
      } else {
        const text = await invoke<string>('read_text_string', { path: sourcePath });
        const r = await importToHtml(text, srcFmt);
        html = r.html;
      }

      const baseName = basename(sourcePath).replace(/\.[^.]+$/, '');
      const ext = outputFormat;
      const suggested = `${baseName}.${ext}`;
      const target = await saveDialog({
        defaultPath: suggested,
        filters: [{ name: FORMAT_LABELS[outputFormat], extensions: [ext] }],
      });
      if (typeof target !== 'string') {
        setRunning(false);
        return;
      }

      const result = await exportFromHtml(html, outputFormat, {
        fileName: basename(target),
        tipTapJson: tipTapJson ?? { html },
      });
      if (result.isBinary) {
        const arr = Array.from(new Uint8Array(result.content as ArrayBuffer));
        await invoke<void>('write_binary_file', { path: target, bytes: arr });
      } else {
        await invoke<void>('write_text_string', {
          path: target,
          content: result.content as string,
        });
      }
      setResultPath(target);
      onFlash(`✓ Convert xong: ${basename(target)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onFlash(`⚠ Lỗi convert: ${msg}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={running ? undefined : onClose}>
      <div
        className="modal pdf-tool-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, width: '92vw' }}
      >
        <header className="modal-head">
          <h2 style={{ margin: 0 }}>📑 {tr('doc.convert.title')}</h2>
          <button className="mini" onClick={onClose} title="Đóng (Esc)">
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="muted small" style={{ marginTop: 0 }}>
            {tr('doc.convert.support')} <strong>.docx · .md · .html · .txt · .pdf · .json</strong>
          </p>

          <section className="convert-step">
            <div className="step-head">
              <span className="step-num">1</span>
              <h3>{tr('doc.convert.step1')}</h3>
            </div>
            <button className="btn btn-ghost" onClick={() => void handlePickSource()}>
              📂 {tr('doc.convert.pick_file')}
            </button>
            {sourcePath && (
              <div className="src-display">
                <code>{basename(sourcePath)}</code>{' '}
                <span className="muted small">.{detectFormatFromName(sourcePath)}</span>
              </div>
            )}
          </section>

          <section className="convert-step">
            <div className="step-head">
              <span className="step-num">2</span>
              <h3>{tr('doc.convert.step2')}</h3>
            </div>
            <div className="format-grid">
              {OUTPUT_FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  className={`format-card ${outputFormat === fmt ? 'active' : ''}`}
                  onClick={() => setOutputFormat(fmt)}
                >
                  <strong>.{fmt}</strong>
                  <span className="muted small">{FORMAT_LABELS[fmt].split(' (')[0]}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="convert-actions">
            <button
              className="btn btn-primary"
              onClick={() => void handleConvert()}
              disabled={running || !sourcePath}
            >
              {running
                ? `⏳ ${tr('doc.convert.running')}`
                : `⇄ ${tr('doc.convert.button')} .${outputFormat}`}
            </button>
            {resultPath && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  onOpenInEditor(resultPath);
                  onClose();
                }}
              >
                ✏ {tr('doc.convert.open_in_editor')}
              </button>
            )}
          </div>

          {resultPath && (
            <div className="result-display">
              <p className="muted small">
                ✓ File output: <code>{resultPath}</code>
              </p>
            </div>
          )}

          <details className="convert-tips-details">
            <summary>💡 Mẹo dùng</summary>
            <ul>
              <li>
                <strong>.docx → .md</strong>: heading/list/bold/italic/table preserve tốt
              </li>
              <li>
                <strong>.pdf → .docx</strong>: text-only (PDF scan ảnh cần OCR — dùng công cụ OCR PDF scan)
              </li>
              <li>
                <strong>.md → .pdf</strong>: render đẹp nhất, dùng cho print
              </li>
              <li>
                <strong>.json</strong> = TrishLibrary native, giữ nguyên format
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
