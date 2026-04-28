/**
 * Phase 17.6 v2.1 — ConvertPanel.
 *
 * Standalone file converter với 6 features mới:
 *  A. Drag & drop file/folder vào panel
 *  B. Multi-target convert (tick nhiều format đích cùng lúc)
 *  D. Auto-open output sau convert
 *  G. Convert URL → file (fetch HTML qua Rust reqwest)
 *  K. PDF input (text extraction, OCR scan dời v2.0.2)
 *  N. Convert preview (xem trước khi save)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  detectFormatFromName,
  exportFromHtml,
  importToHtml,
  importTipTapJson,
  type DocFormat,
  FORMAT_LABELS,
} from './formats.js';

interface Props {
  onFlash: (msg: string) => void;
  onSwitchToEditor: () => void;
  onOpenInEditor: (path: string) => void;
}

interface FileSource {
  kind: 'file';
  path: string;
  format: DocFormat;
}

interface UrlSource {
  kind: 'url';
  url: string;
  fetchedHtml?: string;
  finalUrl?: string;
  status?: 'pending' | 'fetching' | 'ready' | 'error';
  error?: string;
}

type Source = FileSource | UrlSource;

interface ConvertJob {
  id: string;
  sourceLabel: string;
  target: string;
  format: DocFormat;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

const OUTPUT_FORMATS: DocFormat[] = ['docx', 'md', 'html', 'txt', 'pdf', 'json'];

function basename(path: string): string {
  const m = path.split(/[\\/]/);
  return m[m.length - 1] ?? path;
}

function stripExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function formatExt(fmt: DocFormat): string {
  return fmt;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function applyPattern(pattern: string, baseName: string, ext: string): string {
  const safe = pattern.trim() || '{name}';
  return safe
    .replace(/\{name\}/g, baseName)
    .replace(/\{date\}/g, todayStr())
    .replace(/\{ext\}/g, ext);
}

function joinPath(folder: string, name: string): string {
  const sep = folder.includes('\\') ? '\\' : '/';
  const trimmed = folder.replace(/[\\/]+$/, '');
  return `${trimmed}${sep}${name}`;
}

export function ConvertPanel({ onFlash, onOpenInEditor }: Props): JSX.Element {
  const [sources, setSources] = useState<Source[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [outputFormats, setOutputFormats] = useState<Set<DocFormat>>(new Set(['docx']));
  const [outputFolder, setOutputFolder] = useState('');
  const [filenamePattern, setFilenamePattern] = useState('{name}');
  const [autoOpen, setAutoOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobs, setJobs] = useState<ConvertJob[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ html: string; format: DocFormat; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ===== Tauri drag-drop event listener =====
  useEffect(() => {
    if (!isInTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        const win = getCurrentWindow();
        // @ts-expect-error — Tauri 2 API
        const off = await win.onDragDropEvent((event) => {
          const t = event.payload.type;
          if (t === 'over' || t === 'enter') {
            setDragOver(true);
          } else if (t === 'leave') {
            setDragOver(false);
          } else if (t === 'drop') {
            setDragOver(false);
            const paths = (event.payload.paths ?? []) as string[];
            if (paths.length > 0) {
              void handleDroppedPaths(paths);
            }
          }
        });
        unlisten = off;
      } catch (err) {
        console.warn('[trishtype] drag-drop listen fail:', err);
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDroppedPaths(paths: string[]): Promise<void> {
    try {
      // Expand folders → file lists
      const expanded: string[] = [];
      for (const p of paths) {
        try {
          const files = await invoke<string[]>('expand_folder_to_files', { path: p });
          expanded.push(...files);
        } catch (err) {
          console.warn('[trishtype] expand fail:', err);
        }
      }
      if (expanded.length === 0) {
        onFlash('⚠ Không có file định dạng hỗ trợ trong drop');
        return;
      }
      const newSources: FileSource[] = expanded.map((path) => ({
        kind: 'file',
        path,
        format: detectFormatFromName(path),
      }));
      setSources((prev) => [...prev, ...newSources]);
      onFlash(`✓ Đã thêm ${expanded.length} file qua drag-drop`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onFlash(`⚠ Drop fail: ${msg}`);
    }
  }

  // ===== Source management =====

  async function handlePickSources(): Promise<void> {
    if (!isInTauri()) {
      onFlash('Pick file chỉ trong desktop.');
      return;
    }
    const picked = await openDialog({
      multiple: true,
      filters: [
        {
          name: 'Tất cả định dạng hỗ trợ',
          extensions: ['docx', 'md', 'markdown', 'html', 'htm', 'txt', 'json', 'pdf'],
        },
        { name: 'Word', extensions: ['docx'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'TrishType JSON', extensions: ['json'] },
      ],
    });
    if (!picked) return;
    const arr = Array.isArray(picked) ? picked : [picked];
    const newSources: FileSource[] = arr.map((path) => ({
      kind: 'file',
      path,
      format: detectFormatFromName(path),
    }));
    setSources((prev) => [...prev, ...newSources]);
  }

  async function handlePickFolder(): Promise<void> {
    if (!isInTauri()) return;
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string') return;
    try {
      const files = await invoke<string[]>('expand_folder_to_files', { path: picked });
      if (files.length === 0) {
        onFlash('⚠ Folder không có file hỗ trợ');
        return;
      }
      const newSources: FileSource[] = files.map((path) => ({
        kind: 'file',
        path,
        format: detectFormatFromName(path),
      }));
      setSources((prev) => [...prev, ...newSources]);
      onFlash(`✓ Đã thêm ${files.length} file từ folder`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onFlash(`⚠ Lỗi mở folder: ${msg}`);
    }
  }

  async function handleAddUrl(): Promise<void> {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//.test(trimmed)) {
      onFlash('⚠ URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    const urlSrc: UrlSource = { kind: 'url', url: trimmed, status: 'fetching' };
    setSources((prev) => [...prev, urlSrc]);
    setUrlInput('');
    try {
      const result = await invoke<{ url: string; final_url: string; html: string }>(
        'fetch_html',
        { url: trimmed },
      );
      setSources((prev) =>
        prev.map((s) =>
          s.kind === 'url' && s.url === trimmed
            ? {
                ...s,
                fetchedHtml: result.html,
                finalUrl: result.final_url,
                status: 'ready',
              }
            : s,
        ),
      );
      onFlash(`✓ Đã tải URL (${(result.html.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSources((prev) =>
        prev.map((s) =>
          s.kind === 'url' && s.url === trimmed
            ? { ...s, status: 'error', error: msg }
            : s,
        ),
      );
      onFlash(`⚠ Lỗi fetch URL: ${msg}`);
    }
  }

  async function handlePickOutputFolder(): Promise<void> {
    if (!isInTauri()) return;
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') setOutputFolder(picked);
  }

  function removeSource(idx: number): void {
    setSources((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearAll(): void {
    setSources([]);
    setJobs([]);
  }

  function toggleFormat(fmt: DocFormat): void {
    setOutputFormats((prev) => {
      const next = new Set(prev);
      if (next.has(fmt)) next.delete(fmt);
      else next.add(fmt);
      if (next.size === 0) next.add('docx'); // không cho rỗng
      return next;
    });
  }

  // ===== Source → HTML helper =====

  async function sourceToHtml(src: Source): Promise<{ html: string; tipTapJson: unknown; baseName: string }> {
    if (src.kind === 'url') {
      if (!src.fetchedHtml) throw new Error('URL chưa fetch xong');
      const r = await importToHtml(src.fetchedHtml, 'html');
      const baseName = (() => {
        try {
          const u = new URL(src.finalUrl ?? src.url);
          const path = u.pathname.replace(/\/$/, '').split('/').pop();
          return stripExt(path || u.hostname);
        } catch {
          return 'webpage';
        }
      })();
      return { html: r.html, tipTapJson: { html: r.html }, baseName };
    }
    // File
    const fmt = src.format;
    const baseName = stripExt(basename(src.path));
    if (fmt === 'docx' || fmt === 'pdf') {
      const bytes = await invoke<number[]>('read_binary_file', { path: src.path });
      const ab = new Uint8Array(bytes).buffer;
      const r = await importToHtml(ab, fmt);
      return { html: r.html, tipTapJson: { html: r.html }, baseName };
    }
    if (fmt === 'json') {
      const text = await invoke<string>('read_text_string', { path: src.path });
      const json = importTipTapJson(text) as { html?: string };
      const html = json.html ?? '<p></p>';
      return { html, tipTapJson: json, baseName };
    }
    const text = await invoke<string>('read_text_string', { path: src.path });
    const r = await importToHtml(text, fmt);
    return { html: r.html, tipTapJson: { html: r.html }, baseName };
  }

  // ===== Convert action =====

  async function handleConvert(): Promise<void> {
    if (sources.length === 0) {
      onFlash('Chưa có nguồn để convert.');
      return;
    }
    if (outputFormats.size === 0) {
      onFlash('Chưa chọn format đích.');
      return;
    }

    const formatsList = Array.from(outputFormats);
    const totalJobs = sources.length * formatsList.length;
    const needFolder = totalJobs > 1 || sources.some((s) => s.kind === 'url');

    let folder = outputFolder;
    if (needFolder && !folder) {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked !== 'string') return;
      folder = picked;
      setOutputFolder(picked);
    }

    setRunning(true);
    const initialJobs: ConvertJob[] = [];
    for (const src of sources) {
      for (const fmt of formatsList) {
        let baseName = '';
        if (src.kind === 'file') baseName = stripExt(basename(src.path));
        else {
          try {
            const u = new URL(src.finalUrl ?? src.url);
            baseName = stripExt(u.pathname.split('/').pop() || u.hostname);
          } catch {
            baseName = 'webpage';
          }
        }
        const ext = formatExt(fmt);
        const outName = applyPattern(filenamePattern, baseName, ext);
        const finalName = outName.endsWith(`.${ext}`) ? outName : `${outName}.${ext}`;
        const target = totalJobs === 1 && !needFolder
          ? '' // sẽ pick save dialog riêng
          : joinPath(folder, finalName);
        initialJobs.push({
          id: `j${Date.now()}-${initialJobs.length}`,
          sourceLabel: src.kind === 'file' ? basename(src.path) : `🌐 ${src.url}`,
          target,
          format: fmt,
          status: 'pending',
        });
      }
    }
    setJobs(initialJobs);

    let pairIdx = 0;
    for (const src of sources) {
      let cached: { html: string; tipTapJson: unknown; baseName: string } | null = null;
      try {
        cached = await sourceToHtml(src);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const _fmt of formatsList) {
          const i = pairIdx;
          setJobs((prev) =>
            prev.map((j, idx) => (idx === i ? { ...j, status: 'error', message: msg } : j)),
          );
          pairIdx++;
        }
        continue;
      }

      for (const fmt of formatsList) {
        const i = pairIdx;
        setJobs((prev) => prev.map((j, idx) => (idx === i ? { ...j, status: 'running' } : j)));
        try {
          const result = await exportFromHtml(cached.html, fmt, {
            fileName: cached.baseName,
            tipTapJson: cached.tipTapJson,
          });
          let finalTarget = initialJobs[i].target;
          if (!finalTarget) {
            // Single file mode → pick save dialog
            const ext = formatExt(fmt);
            const suggested = `${cached.baseName}.${ext}`;
            const picked = await saveDialog({
              defaultPath: suggested,
              filters: [{ name: FORMAT_LABELS[fmt], extensions: [ext] }],
            });
            if (typeof picked !== 'string') {
              setJobs((prev) =>
                prev.map((j, idx) =>
                  idx === i ? { ...j, status: 'error', message: 'Huỷ save' } : j,
                ),
              );
              pairIdx++;
              continue;
            }
            finalTarget = picked;
          }
          if (result.isBinary) {
            const arr = Array.from(new Uint8Array(result.content as ArrayBuffer));
            await invoke<void>('write_binary_file', { path: finalTarget, bytes: arr });
          } else {
            await invoke<void>('write_text_string', {
              path: finalTarget,
              content: result.content as string,
            });
          }
          setJobs((prev) =>
            prev.map((j, idx) =>
              idx === i ? { ...j, status: 'done', target: finalTarget } : j,
            ),
          );
          if (autoOpen) {
            void invoke('open_file', { path: finalTarget }).catch((e) =>
              console.warn('[trishtype] auto-open fail:', e),
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setJobs((prev) =>
            prev.map((j, idx) =>
              idx === i ? { ...j, status: 'error', message: msg } : j,
            ),
          );
        }
        pairIdx++;
      }
    }
    setRunning(false);

    const success = initialJobs.filter((_, i) => true).length;
    const errs = jobs.filter((j) => j.status === 'error').length;
    void success;
    void errs;
    setTimeout(() => {
      setJobs((curr) => {
        const ok = curr.filter((j) => j.status === 'done').length;
        const er = curr.filter((j) => j.status === 'error').length;
        onFlash(`✓ Convert: ${ok} OK · ${er} lỗi`);
        return curr;
      });
    }, 100);
  }

  // ===== Preview =====

  async function handlePreview(): Promise<void> {
    if (sources.length === 0) {
      onFlash('Chưa có nguồn.');
      return;
    }
    const fmt = Array.from(outputFormats)[0] ?? 'html';
    if (fmt === 'docx' || fmt === 'pdf') {
      onFlash('⚠ Preview chỉ hỗ trợ MD/HTML/TXT/JSON. Format binary phải save mới xem được.');
      return;
    }
    const src = sources[0];
    setPreviewing(true);
    try {
      const { html, tipTapJson, baseName } = await sourceToHtml(src);
      const result = await exportFromHtml(html, fmt, {
        fileName: baseName,
        tipTapJson,
      });
      const text = typeof result.content === 'string' ? result.content : '(binary)';
      setPreview({
        html: fmt === 'html' ? text : `<pre>${escapeHtml(text)}</pre>`,
        format: fmt,
        name: `${baseName}.${formatExt(fmt)}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onFlash(`⚠ Preview fail: ${msg}`);
    } finally {
      setPreviewing(false);
    }
  }

  function reConvertJob(j: ConvertJob): void {
    if (j.status === 'running') return;
    // Tìm source tương ứng
    const src = sources.find(
      (s) =>
        (s.kind === 'file' && basename(s.path) === j.sourceLabel) ||
        (s.kind === 'url' && `🌐 ${s.url}` === j.sourceLabel),
    );
    if (!src) {
      onFlash('Nguồn đã bị xoá khỏi list.');
      return;
    }
    // Single re-convert
    void (async () => {
      try {
        const { html, tipTapJson, baseName } = await sourceToHtml(src);
        const result = await exportFromHtml(html, j.format, {
          fileName: baseName,
          tipTapJson,
        });
        if (result.isBinary) {
          const arr = Array.from(new Uint8Array(result.content as ArrayBuffer));
          await invoke<void>('write_binary_file', { path: j.target, bytes: arr });
        } else {
          await invoke<void>('write_text_string', {
            path: j.target,
            content: result.content as string,
          });
        }
        setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: 'done' } : x)));
        onFlash(`✓ Re-convert: ${basename(j.target)}`);
        if (autoOpen) {
          void invoke('open_file', { path: j.target }).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onFlash(`⚠ Re-convert fail: ${msg}`);
      }
    })();
  }

  // ===== Render =====

  const totalJobs = sources.length * outputFormats.size;
  const totalAvailable = sources.filter(
    (s) => s.kind === 'file' || (s.kind === 'url' && s.status === 'ready'),
  ).length;

  return (
    <div className="convert-panel">
      <div className="convert-card">
        <h2>⇄ Chuyển đổi định dạng file</h2>
        <p className="muted small">
          Hỗ trợ: <strong>.docx · .md · .html · .txt · .pdf · .json</strong>. Kéo thả file/folder
          vào panel hoặc nhập URL.
        </p>

        {/* Step 1 — Sources với drop zone */}
        <section className="convert-step">
          <div className="step-head">
            <span className="step-num">1</span>
            <h3>Nguồn ({sources.length})</h3>
          </div>

          <div
            ref={dropZoneRef}
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
          >
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>📥 Kéo thả file/folder vào đây</strong>
            </p>
            <p className="muted small" style={{ margin: '4px 0 8px' }}>
              hoặc dùng các nút bên dưới
            </p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-small" onClick={() => void handlePickSources()}>
                📄 Chọn file
              </button>
              <button className="btn btn-ghost btn-small" onClick={() => void handlePickFolder()}>
                📁 Chọn folder
              </button>
              {sources.length > 0 && (
                <button className="btn btn-ghost btn-small" onClick={clearAll}>
                  ✕ Xoá tất cả
                </button>
              )}
            </div>
          </div>

          {/* URL input */}
          <div className="url-input-row">
            <input
              type="url"
              className="url-input"
              placeholder="🌐 Hoặc nhập URL trang web (https://...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleAddUrl();
              }}
            />
            <button
              className="btn btn-ghost btn-small"
              onClick={() => void handleAddUrl()}
              disabled={!urlInput.trim()}
            >
              ⤓ Tải URL
            </button>
          </div>

          {/* Source list */}
          {sources.length > 0 && (
            <ul className="source-list">
              {sources.map((s, i) => (
                <li key={i}>
                  {s.kind === 'file' ? (
                    <>
                      <span className="src-icon">📄</span>
                      <span className="src-name" title={s.path}>
                        {basename(s.path)}
                      </span>
                      <span className="src-fmt muted small">.{s.format}</span>
                    </>
                  ) : (
                    <>
                      <span className="src-icon">🌐</span>
                      <span className="src-name" title={s.url}>
                        {s.url}
                      </span>
                      <span className="src-fmt muted small">
                        {s.status === 'fetching' && '⏳ tải...'}
                        {s.status === 'ready' && '✓ ready'}
                        {s.status === 'error' && `✗ ${s.error?.slice(0, 30)}`}
                      </span>
                    </>
                  )}
                  <button
                    className="loc-btn"
                    onClick={() => removeSource(i)}
                    title="Xoá nguồn này"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Step 2 — Output formats (multi checkbox) */}
        <section className="convert-step">
          <div className="step-head">
            <span className="step-num">2</span>
            <h3>Định dạng đích ({outputFormats.size})</h3>
          </div>
          <p className="muted small" style={{ marginTop: -2 }}>
            Tick nhiều format để xuất nhiều file 1 lúc
          </p>
          <div className="format-grid">
            {OUTPUT_FORMATS.map((fmt) => (
              <label
                key={fmt}
                className={`format-card ${outputFormats.has(fmt) ? 'active' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={outputFormats.has(fmt)}
                  onChange={() => toggleFormat(fmt)}
                  style={{ marginRight: 6 }}
                />
                <strong>.{fmt}</strong>
                <span className="muted small">{FORMAT_LABELS[fmt].split(' (')[0]}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Step 3 — Output options */}
        <section className="convert-step">
          <div className="step-head">
            <span className="step-num">3</span>
            <h3>Tùy chọn</h3>
          </div>

          <div className="opt-row">
            <label className="opt-label">Folder đích</label>
            <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-small" onClick={() => void handlePickOutputFolder()}>
                📁 Chọn…
              </button>
              {outputFolder ? (
                <code className="muted small" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {outputFolder}
                </code>
              ) : (
                <span className="muted small">
                  {totalJobs <= 1 ? '(sẽ hỏi save dialog)' : '(bắt buộc cho bulk)'}
                </span>
              )}
            </div>
          </div>

          <div className="opt-row">
            <label className="opt-label">Pattern tên file</label>
            <input
              type="text"
              className="url-input"
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
              placeholder="{name}"
              style={{ flex: 1 }}
            />
            <span className="muted small" style={{ fontSize: 10.5 }}>
              {`{name}`} {`{date}`} {`{ext}`}
            </span>
          </div>

          <div className="opt-row">
            <label className="opt-label">Tự động mở</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={autoOpen}
                onChange={(e) => setAutoOpen(e.target.checked)}
              />
              <span className="toggle-track" />
            </label>
            <span className="muted small">Mở file output sau khi convert xong</span>
          </div>
        </section>

        {/* Convert + Preview buttons */}
        <div className="convert-actions">
          <button
            className="btn btn-primary"
            onClick={() => void handleConvert()}
            disabled={running || totalAvailable === 0 || outputFormats.size === 0}
          >
            {running
              ? '⏳ Đang chuyển đổi…'
              : `⇄ Chuyển đổi · ${totalAvailable} nguồn × ${outputFormats.size} format = ${totalAvailable * outputFormats.size} file`}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void handlePreview()}
            disabled={previewing || sources.length === 0}
            title="Preview output mà không lưu (chỉ MD/HTML/TXT/JSON)"
          >
            {previewing ? '⏳' : '👁'} Preview
          </button>
        </div>

        {/* Job list */}
        {jobs.length > 0 && (
          <section className="convert-step">
            <h3>Kết quả ({jobs.length})</h3>
            <ul className="job-list">
              {jobs.map((j) => (
                <li key={j.id} className={`job-item job-${j.status}`}>
                  <span className="job-icon">
                    {j.status === 'pending' && '○'}
                    {j.status === 'running' && '⏳'}
                    {j.status === 'done' && '✓'}
                    {j.status === 'error' && '✗'}
                  </span>
                  <div className="job-info">
                    <div className="job-source">
                      <span className="muted small">{j.sourceLabel}</span>
                      <span className="muted small"> → </span>
                      <span>{j.target ? basename(j.target) : `.${j.format}`}</span>
                    </div>
                    {j.message && <div className="job-error muted small">{j.message}</div>}
                  </div>
                  {j.status === 'done' && (
                    <>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => void invoke('open_file', { path: j.target })}
                        title="Mở file"
                      >
                        📂
                      </button>
                      <button
                        className="btn btn-ghost btn-small"
                        onClick={() => onOpenInEditor(j.target)}
                        title="Mở trong editor"
                      >
                        ✏
                      </button>
                    </>
                  )}
                  {j.status === 'error' && (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => reConvertJob(j)}
                      title="Thử lại"
                    >
                      ↻
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Tips sidebar */}
      <div className="convert-tips">
        <h4>💡 Mẹo</h4>
        <ul>
          <li><strong>Drag & drop</strong>: Kéo file/folder vào ô lớn ở trên</li>
          <li><strong>URL</strong>: Nhập link trang web → fetch HTML → convert</li>
          <li><strong>Multi-target</strong>: Tick nhiều format để xuất 1 lúc nhiều file</li>
          <li><strong>Pattern</strong>: <code>{`{name}_{date}.{ext}`}</code> tạo file có ngày</li>
          <li><strong>Auto-open</strong>: Bật để xem file ngay sau convert</li>
          <li><strong>Preview</strong>: Xem MD/HTML/TXT trước khi save</li>
          <li>.docx ↔ .md: bold/italic/heading/list/table preserve tốt</li>
          <li>PDF text-only — OCR PDF scan dời v2.0.2</li>
        </ul>
      </div>

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          html={preview.html}
          format={preview.format}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Preview modal
// ============================================================

function PreviewModal({
  html,
  format,
  name,
  onClose,
}: {
  html: string;
  format: DocFormat;
  name: string;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 900, width: '90vw', maxHeight: '85vh' }}
      >
        <header className="modal-head">
          <h2>
            👁 Preview: <code style={{ fontSize: 13 }}>{name}</code>{' '}
            <span className="muted small">.{format}</span>
          </h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body" style={{ background: 'var(--editor-paper)' }}>
          <div
            className="preview-content"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        <footer className="modal-foot">
          <span className="muted small">Preview chỉ render — chưa lưu file. Bấm "Chuyển đổi" để save.</span>
          <button className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
