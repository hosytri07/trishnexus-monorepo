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

interface ProgressState {
  stage: 'analyze' | 'ocr' | 'merge_ocr' | 'libreoffice' | 'save' | 'done';
  pct: number;
  detail: string;
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
  // Phase 39 — LibreOffice integration
  const [loStatus, setLoStatus] = useState<{
    available: boolean;
    version?: string;
    hint: string;
  } | null>(null);
  const [useLibreOffice, setUseLibreOffice] = useState(true);
  // Phase 39.fix — Progress + auto-OCR scan PDF
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [autoOcr, setAutoOcr] = useState(true);
  // Phase 38.2.0 fix — Default 'vie' only (vie+eng confuses Tesseract → mất dấu).
  // Đã verify với test thật: vie+eng output "BIEN BAN" (sai), vie ra "BIÊN BẢN" (đúng).
  const [ocrLang, setOcrLang] = useState('vie');
  const [tessAvailable, setTessAvailable] = useState(false);
  // Phase 39.fix10 — MS Word direct PDF→DOCX
  const [wordAvailable, setWordAvailable] = useState(false);
  // Phase 39.fix12 — tessdata_best status (accuracy +10% cho text Việt)
  const [tessdataBest, setTessdataBest] = useState<{
    vie: boolean;
    eng: boolean;
  }>({ vie: false, eng: false });
  const [downloadingTessdata, setDownloadingTessdata] = useState<string | null>(null);
  // Phase 38.2.0 — Pre-select đường dẫn xuất (folder + filename) trước khi convert
  // null = dùng cùng folder source. Filename auto = baseName + .ext output.
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [customFilename, setCustomFilename] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState(false);
  const [filenameDraft, setFilenameDraft] = useState('');
  // Phase 38.2.0 — Pipeline DUY NHẤT cho PDF scan → DOCX:
  // text plain (Tesseract PSM 6 + grayscale preprocess + tessdata_best vie)
  // → buildDocxFromText paragraph clean.
  // Output: file nhẹ, Tiếng Việt chuẩn, paragraph + heading mỗi trang.

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !running) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running, onClose]);

  useEffect(() => {
    void invoke<{ available: boolean }>('check_tesseract')
      .then((s) => setTessAvailable(!!s?.available))
      .catch(() => setTessAvailable(false));
    void invoke<{ available: boolean }>('check_msword')
      .then((s) => setWordAvailable(!!s?.available))
      .catch(() => setWordAvailable(false));
    void Promise.all([
      invoke<boolean>('check_tessdata_best', { langCode: 'vie' }).catch(() => false),
      invoke<boolean>('check_tessdata_best', { langCode: 'eng' }).catch(() => false),
    ]).then(([vie, eng]) => setTessdataBest({ vie, eng }));
  }, []);

  async function handleDownloadTessdata(lang: 'vie' | 'eng'): Promise<void> {
    setDownloadingTessdata(lang);
    try {
      await invoke('download_tessdata_best', { langCode: lang });
      onFlash(`✓ Đã tải tessdata_best ${lang} (accuracy +10%)`);
      setTessdataBest((prev) => ({ ...prev, [lang]: true }));
    } catch (err) {
      onFlash(`⚠ Lỗi tải tessdata_best ${lang}: ${err}`);
    } finally {
      setDownloadingTessdata(null);
    }
  }

  useEffect(() => {
    void invoke<typeof loStatus>('check_libreoffice')
      .then((s) => {
        setLoStatus(s);
        if (!s?.available) setUseLibreOffice(false);
      })
      .catch(() => {
        setLoStatus({ available: false, hint: 'Lỗi check LibreOffice' });
        setUseLibreOffice(false);
      });
  }, []);

  // LibreOffice supports PDF→DOCX/ODT/RTF/HTML/TXT, DOCX→PDF/ODT/HTML/TXT, etc.
  const sourceFmt = sourcePath ? detectFormatFromName(sourcePath) : null;
  // Combinations LibreOffice handle tốt + giữ format
  const LIBREOFFICE_PAIRS: Record<string, DocFormat[]> = {
    pdf: ['docx', 'html', 'txt'],
    docx: ['pdf', 'html', 'txt'],
    html: ['pdf', 'docx', 'txt'],
  };
  const canUseLO =
    loStatus?.available &&
    sourceFmt !== null &&
    LIBREOFFICE_PAIRS[sourceFmt]?.includes(outputFormat);

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
      // Reset custom output khi đổi source (filename auto theo source mới)
      setCustomFilename(null);
    }
  }

  // Phase 38.2.0 — Helpers cho pre-select output path
  function dirname(p: string): string {
    const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
    return idx >= 0 ? p.slice(0, idx) : '';
  }

  function joinPath(dir: string, file: string): string {
    if (!dir) return file;
    const sep = dir.includes('\\') ? '\\' : '/';
    return dir.endsWith(sep) ? `${dir}${file}` : `${dir}${sep}${file}`;
  }

  // Folder thực tế sẽ ghi output: outputDir override → fallback parent của source
  const effectiveOutputDir =
    outputDir ?? (sourcePath ? dirname(sourcePath) : '');

  // Filename mặc định = baseName của source + .extOutput
  const defaultFilename =
    sourcePath
      ? `${basename(sourcePath).replace(/\.[^.]+$/, '')}.${outputFormat}`
      : `output.${outputFormat}`;

  const effectiveFilename = customFilename ?? defaultFilename;

  async function handlePickOutputDir(): Promise<void> {
    if (!isInTauri()) return;
    const picked = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: effectiveOutputDir || undefined,
    });
    if (typeof picked === 'string') {
      setOutputDir(picked);
    }
  }

  function handleEditFilename(): void {
    setFilenameDraft(effectiveFilename);
    setEditingFilename(true);
  }

  function handleCommitFilename(): void {
    const trimmed = filenameDraft.trim();
    if (trimmed.length > 0) {
      setCustomFilename(trimmed);
    }
    setEditingFilename(false);
  }

  function handleCancelFilename(): void {
    setEditingFilename(false);
    setFilenameDraft('');
  }

  /**
   * Resolve target path: nếu user đã pre-select outputDir → dùng luôn (file
   * sẽ ghi đè nếu tồn tại — user đã chủ động chọn path). Fallback: mở save
   * dialog cũ (Windows tự confirm overwrite).
   */
  async function resolveTarget(suggested: string, ext: string): Promise<string | null> {
    if (effectiveOutputDir) {
      const fname = customFilename ?? suggested;
      const finalName = fname.toLowerCase().endsWith(`.${ext}`)
        ? fname
        : `${fname.replace(/\.[^.]+$/, '')}.${ext}`;
      return joinPath(effectiveOutputDir, finalName);
    }
    const target = await saveDialog({
      defaultPath: suggested,
      filters: [{ name: FORMAT_LABELS[outputFormat], extensions: [ext] }],
    });
    return typeof target === 'string' ? target : null;
  }

  /**
   * Phase 39.fix — Detect PDF có text layer hay là scan ảnh.
   * Đọc 3 page đầu, count text chars. Nếu < 30 chars/page average → scan.
   */
  async function detectPdfIsScan(buffer: ArrayBuffer): Promise<{
    isScan: boolean;
    numPages: number;
    avgChars: number;
  }> {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (
      await import(
        // @ts-ignore
        'pdfjs-dist/build/pdf.worker.min.mjs?url'
      )
    ).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const sample = Math.min(3, pdf.numPages);
    let totalChars = 0;
    for (let i = 1; i <= sample; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const txt = tc.items
        .map((it: unknown) => ((it as { str?: string }).str ?? ''))
        .join('')
        .trim();
      totalChars += txt.length;
    }
    const avg = totalChars / sample;
    return { isScan: avg < 30, numPages: pdf.numPages, avgChars: avg };
  }


  /**
   * Phase 39.fix6 — OCR PDF → text concatenated (cho mode text-only DOCX).
   * Render từng page → OCR text only → concat với page breaks.
   * Trả raw text. Không qua LibreOffice → DOCX clean, nhỏ, mở nhanh.
   */
  async function ocrPdfToText(
    pdfBuffer: ArrayBuffer,
    lang: string,
    onPageProgress: (done: number, total: number) => void,
  ): Promise<string> {
    const pdfjs = await import('pdfjs-dist');
    // Phase 38.2.0 fix — Set workerSrc trước khi getDocument (bắt buộc).
    // Bug cũ: function này gọi pdfjs trước khi detectPdfIsScan set worker →
    // crash "No GlobalWorkerOptions.workerSrc specified".
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      const workerUrl = (
        await import(
          // @ts-ignore
          'pdfjs-dist/build/pdf.worker.min.mjs?url'
        )
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    const total = pdf.numPages;
    const dpiScale = 3.125;
    const pageTexts: string[] = new Array(total);

    // Phase 38.2.0 fix — Parallel OCR (6 workers)
    const concurrency = Math.min(6, Math.max(1, total));
    let done = 0;
    let nextPage = 1;

    async function processPage(pageIdx: number): Promise<void> {
      const page = await pdf.getPage(pageIdx);
      const viewport = page.getViewport({ scale: dpiScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context fail');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/png'),
      );
      if (!blob) throw new Error('toBlob fail');
      const ab = await blob.arrayBuffer();
      const imageBytes = Array.from(new Uint8Array(ab));
      // Phase 38.2.0 fix — PSM 6 (single uniform block) cho text Việt:
      // accuracy +5-10% so với PSM 3 cho biên bản, công văn (text uniform paragraph).
      // Phase 38.2.0 fix — PSM 1 (auto + OSD) thay PSM 6:
      // - Page text only: OK
      // - Page bảng: detect layout columns
      // - Page con dấu / 2 cột: rotation detect tốt, không output garbage
      // Đã test thực tế trên CamScanner PDF: PSM 1 cho output đúng cả 3 trường hợp,
      // PSM 6 fail trên page con dấu (output binary garbage).
      const text = await invoke<string>('ocr_image_bytes', {
        imageBytes,
        lang,
        psm: 1,
      });

      // Phase 38.2.0 — Sanity check: chỉ throw nếu PDF binary thực sự
      // (skip kiểm tra trên page ngắn — có thể là page chỉ có ảnh/bảng nhỏ,
      // text Tesseract trả về ít, không phải lỗi).
      const sample = text.slice(0, 500);
      console.log(`[OCR p${pageIdx}] (${text.length} chars) sample:`, sample.slice(0, 120));
      if (sample.includes('%PDF-') || sample.includes('FlateDecode')) {
        throw new Error(
          `OCR page ${pageIdx} trả về PDF binary thay vì text! ` +
          `Có thể Tesseract bị corrupted hoặc canvas render thất bại. ` +
          `Sample: ${sample.slice(0, 80)}`,
        );
      }
      // Skip non-printable check cho text ngắn (< 100 chars có thể là page
      // gần trống hoặc ảnh table — Tesseract trả formfeed \x0c hợp lệ).
      // Cho text dài, allow tới 30% non-printable (nhiều page break + tab OK).
      if (text.length > 100) {
        // Loại whitespace control chars khỏi binary count (TAB, LF, CR, FF, VT)
        const nonPrintable = (text.match(/[\x00-\x08\x0E-\x1F\x7F]/g) ?? []).length;
        if (nonPrintable / text.length > 0.3) {
          throw new Error(
            `OCR page ${pageIdx} có ${Math.round((nonPrintable / text.length) * 100)}% ký tự binary corrupted. ` +
            `Kiểm tra tessdata tại %APPDATA%\\TrishLibrary\\tessdata_best\\`,
          );
        }
      }

      pageTexts[pageIdx - 1] = text.trim();
      done++;
      onPageProgress(done, total);
    }

    async function worker(): Promise<void> {
      while (true) {
        const myPage = nextPage++;
        if (myPage > total) return;
        try {
          await processPage(myPage);
        } catch (err) {
          throw new Error(`OCR page ${myPage}: ${String(err)}`);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return pageTexts.join('\n\n');
  }

  /**
   * Phase 39.fix6 — Build DOCX text-only từ raw text (không qua LibreOffice).
   * Format mỗi page với heading + paragraphs. Output clean, nhỏ, mở nhanh.
   */
  async function buildDocxFromText(
    fullText: string,
    title: string,
  ): Promise<ArrayBuffer> {
    const escapeHtml = (s: string): string =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Split theo page boundaries (double newline)
    const pageTexts = fullText.split(/\n\n+/);
    const htmlPages = pageTexts
      .map((p, idx) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        const paras = trimmed
          .split(/\n+/)
          .filter((line) => line.trim())
          .map((line) => `<p>${escapeHtml(line.trim())}</p>`)
          .join('');
        return `<h2>Trang ${idx + 1}</h2>${paras}`;
      })
      .filter(Boolean)
      .join('\n');
    const html = `<h1>${escapeHtml(title)}</h1>\n${htmlPages}`;
    const result = await exportFromHtml(html, 'docx', {
      fileName: title,
      tipTapJson: { html },
    });
    return result.content as ArrayBuffer;
  }

  /**
   * Phase 39.fix — Run OCR pipeline trên PDF: render từng page → OCR → merge searchable PDF.
   * Returns: temp path của searchable PDF mới.
   *
   * Phase 39.fix4 — Performance optimizations:
   *   - DPI 200 (thay vì 300) cho convert pipeline — vẫn đủ accuracy + giảm 55% size
   *   - JPEG quality 0.85 thay vì PNG — giảm 70% file size, OCR vẫn ổn
   *   - Yield UI thread mỗi 5 page để React render progress smooth
   */
  async function ocrPdfToSearchable(
    pdfBuffer: ArrayBuffer,
    lang: string,
    onPageProgress: (done: number, total: number) => void,
  ): Promise<string> {
    const pdfjs = await import('pdfjs-dist');
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      const workerUrl = (
        await import(
          // @ts-ignore
          'pdfjs-dist/build/pdf.worker.min.mjs?url'
        )
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }
    const pdf = await pdfjs.getDocument({ data: pdfBuffer }).promise;
    const total = pdf.numPages;
    // Phase 39.fix9 — DPI 300 + JPEG 0.92 cho searchable PDF chất lượng cao
    const dpiScale = 3.125; // ~300 DPI
    const pdfPagesBytes: number[][] = new Array(total);

    // Phase 38.2.0 fix — Parallel OCR worker pool. Default 6 workers thay 4 →
    // tăng tốc thêm ~50% trên CPU 4-8 cores (Tesseract IO-bound nhiều, không phải
    // CPU-bound thuần — page render + JPEG encode trên main thread, OCR trên worker).
    const concurrency = Math.min(6, Math.max(1, total));
    let done = 0;
    let nextPage = 1;

    async function processPage(pageIdx: number): Promise<void> {
      const page = await pdf.getPage(pageIdx);
      const viewport = page.getViewport({ scale: dpiScale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context fail');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('toBlob fail');
      const ab = await blob.arrayBuffer();
      const imageBytes = Array.from(new Uint8Array(ab));
      // Phase 38.2.0 fix — text_only=true: PDF chỉ có text layer, KHÔNG embed
      // ảnh scan → DOCX output nhẹ, không bị mix ảnh + text đè lên nhau.
      const pageBytes = await invoke<number[]>('ocr_image_to_pdf_page', {
        imageBytes,
        lang,
        textOnly: true,
      });
      pdfPagesBytes[pageIdx - 1] = pageBytes;
      done++;
      onPageProgress(done, total);
    }

    async function worker(): Promise<void> {
      while (true) {
        const myPage = nextPage++;
        if (myPage > total) return;
        try {
          await processPage(myPage);
        } catch (err) {
          // Re-throw để Promise.all() reject toàn batch
          throw new Error(`OCR page ${myPage}: ${String(err)}`);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const tempDir = await invoke<string>('get_temp_dir');
    const sep = tempDir.includes('\\') ? '\\' : '/';
    const tempFile = `${tempDir}${sep}trishlib_ocr_${Date.now()}.pdf`;
    await invoke('merge_pdf_pages_bytes', {
      pages: pdfPagesBytes,
      outputPath: tempFile,
    });
    return tempFile;
  }

  async function handleConvert(): Promise<void> {
    if (!sourcePath) return;
    setRunning(true);
    setResultPath(null);
    setProgress({ stage: 'analyze', pct: 2, detail: 'Đang phân tích file…' });
    try {
      const srcFmt = detectFormatFromName(sourcePath);
      const baseName = basename(sourcePath).replace(/\.[^.]+$/, '');
      const ext = outputFormat;
      const suggested = `${baseName}.${ext}`;

      // Phase 39.fix12 — PDF→DOCX combined pipeline:
      //   1. Detect scan vs digital
      //   2. Scan: Tesseract OCR (vie best) → searchable PDF tạm → Word convert
      //   3. Digital: Word direct convert
      // Output: 1 file DOCX, save dialog chỉ 1 lần.
      if (
        srcFmt === 'pdf' &&
        ext === 'docx' &&
        wordAvailable
      ) {
        const target = await resolveTarget(suggested, ext);
        if (target === null) {
          setRunning(false);
          setProgress(null);
          return;
        }

        // Phase 38.2.0 fix — Smart routing:
        // - PDF SCAN (avg < 30 chars/page) → OCR pipeline (Tesseract → text → DOCX)
        // - PDF DIGITAL (text layer dày) → LibreOffice direct → DOCX giữ format + image
        // Detect logic dựa pdfjs.getTextContent — phân biệt rất chuẩn:
        //   CamScanner scan: 0-1 chars/page → isScan true
        //   CV in từ Word: 2000+ chars/page → isScan false
        const actualPdfPath = sourcePath;
        let isScan = false;
        if (autoOcr && tessAvailable) {
          try {
            const pdfBytes2 = await invoke<number[]>('read_binary_file', {
              path: sourcePath,
            });
            const detect = await detectPdfIsScan(new Uint8Array(pdfBytes2).buffer);
            isScan = detect.isScan;
            console.log(
              `[detect] ${detect.numPages} pages, avg ${detect.avgChars.toFixed(0)} chars/page → ${isScan ? 'SCAN' : 'DIGITAL'}`,
            );
          } catch (e) {
            console.warn('[detect] fail, default treat as digital:', e);
          }
        }
        const useOcrPipeline = autoOcr && tessAvailable && isScan;
        void actualPdfPath;

        if (useOcrPipeline) {
          // Pipeline DUY NHẤT: Tesseract OCR text plain → buildDocxFromText
          // Tessdata best vie + PSM 6 + grayscale preprocess + DPI 300.
          // Output: file nhẹ, Tiếng Việt chuẩn, không có ảnh scan.
          setProgress({
            stage: 'ocr',
            pct: 10,
            detail: `📷 OCR PDF scan — ${ocrLang}…`,
          });
          try {
            const pdfBytes = await invoke<number[]>('read_binary_file', {
              path: sourcePath,
            });
            const fullText = await ocrPdfToText(
              new Uint8Array(pdfBytes).buffer,
              ocrLang,
              (done, total) => {
                const ocrPct = 10 + (done / total) * 80;
                setProgress({
                  stage: 'ocr',
                  pct: Math.round(ocrPct),
                  detail: `🔍 OCR trang ${done}/${total} (${ocrLang})`,
                });
              },
            );
            setProgress({
              stage: 'save',
              pct: 92,
              detail: '📝 Đang build DOCX…',
            });
            const docxBuffer = await buildDocxFromText(fullText, baseName);
            const arr = Array.from(new Uint8Array(docxBuffer));
            await invoke('write_binary_file', { path: target, bytes: arr });
            setProgress({ stage: 'done', pct: 100, detail: '✓ Convert hoàn tất!' });
            setResultPath(target);
            onFlash(`✓ OCR + DOCX: ${basename(target)}`);
            return;
          } catch (e) {
            console.warn('[ocr-pipeline] fail:', e);
            throw new Error(`Convert fail: ${String(e)}`);
          }
        }

        // Path digital PDF: ưu tiên LibreOffice (giữ format + tách image embedded
        // tốt hơn Word). Nếu LibreOffice không có thì fallback Word direct.
        if (!canUseLO) {
          setProgress({
            stage: 'libreoffice',
            pct: 30,
            detail: '🚀 MS Word đang convert PDF → DOCX (LibreOffice không có)…',
          });
          await new Promise((r) => setTimeout(r, 50));

          const wordHeartbeatStart = Date.now();
          const wordHeartbeat = setInterval(() => {
            const elapsed = (Date.now() - wordHeartbeatStart) / 1000;
            const ratio = Math.min(0.95, elapsed / 20);
            const pct = 30 + Math.floor(ratio * 65);
            setProgress({
              stage: 'libreoffice',
              pct,
              detail: `🚀 MS Word đang convert PDF → DOCX (${elapsed.toFixed(0)}s)…`,
            });
          }, 1000);

          try {
            await invoke('convert_via_msword', {
              inputPath: actualPdfPath,
              outputPath: target,
            });
            clearInterval(wordHeartbeat);
            setProgress({ stage: 'done', pct: 100, detail: '✓ MS Word convert hoàn tất!' });
            setResultPath(target);
            onFlash(`✓ MS Word convert PDF→DOCX: ${basename(target)}`);
            return;
          } catch (e) {
            clearInterval(wordHeartbeat);
            console.warn('[ms-word] fail:', e);
            throw new Error(`Word convert fail: ${String(e)}`);
          }
        }
        // Else: digital PDF + có LibreOffice → fall through xuống LibreOffice path
        // (LibreOffice convert PDF digital giữ format perfect + tách 3 ảnh con dấu/
        // chữ ký vào word/media/. Đã verify với file CV 2343 thực tế.)
      }

      // Phase 39 — LibreOffice path: preserve format khi PDF↔DOCX↔HTML
      if (useLibreOffice && canUseLO) {
        const target = await resolveTarget(suggested, ext);
        if (target === null) {
          setRunning(false);
          setProgress(null);
          return;
        }

        let actualSourcePath = sourcePath;

        // Phase 39.fix — Auto-OCR PDF scan trước khi convert sang DOCX/DOC/ODT/RTF
        const writerTargets = ['docx', 'doc', 'odt', 'rtf', 'html', 'htm', 'txt'];
        if (
          srcFmt === 'pdf' &&
          autoOcr &&
          tessAvailable &&
          writerTargets.includes(ext)
        ) {
          setProgress({
            stage: 'analyze',
            pct: 5,
            detail: 'Đang đọc PDF + phân tích text layer…',
          });
          const pdfBytes = await invoke<number[]>('read_binary_file', {
            path: sourcePath,
          });
          const detect = await detectPdfIsScan(new Uint8Array(pdfBytes).buffer);
          if (detect.isScan) {
            setProgress({
              stage: 'ocr',
              pct: 10,
              detail: `📷 PDF scan (${detect.avgChars.toFixed(0)} chars/page) — bắt đầu OCR ${detect.numPages} trang`,
            });

            // Phase 39.fix11 — PDF scan + target=DOCX → fallback text-only DOCX
            // (Word đã được try ở step trước. Tới đây nghĩa là Word KHÔNG có hoặc fail.)
            if (ext === 'docx') {
              const fullText = await ocrPdfToText(
                new Uint8Array(pdfBytes).buffer,
                ocrLang,
                (done, total) => {
                  const ocrPct = 10 + (done / total) * 80; // 10-90%
                  setProgress({
                    stage: 'ocr',
                    pct: Math.round(ocrPct),
                    detail: `🔍 OCR trang ${done}/${total} (${ocrLang})`,
                  });
                },
              );
              setProgress({
                stage: 'save',
                pct: 92,
                detail: '📝 Đang build DOCX text-only…',
              });
              const docxBytes = await buildDocxFromText(fullText, baseName);
              const arr = Array.from(new Uint8Array(docxBytes));
              await invoke('write_binary_file', { path: target, bytes: arr });
              setProgress({ stage: 'done', pct: 100, detail: '✓ DOCX text-only hoàn tất!' });
              setResultPath(target);
              onFlash(
                `✓ OCR + DOCX text-only xong (${detect.numPages} trang): ${basename(target)}`,
              );
              return;
            }

            // Path cũ cho target khác docx (txt/html/odt): dùng searchable PDF + LibreOffice
            actualSourcePath = await ocrPdfToSearchable(
              new Uint8Array(pdfBytes).buffer,
              ocrLang,
              (done, total) => {
                const ocrPct = 10 + (done / total) * 60; // 10-70%
                setProgress({
                  stage: 'ocr',
                  pct: Math.round(ocrPct),
                  detail: `🔍 OCR trang ${done}/${total} (${ocrLang})`,
                });
              },
            );
            setProgress({
              stage: 'merge_ocr',
              pct: 72,
              detail: `✓ OCR ${detect.numPages} trang xong — searchable PDF tạo thành công`,
            });
            await new Promise((r) => setTimeout(r, 100));
          } else {
            setProgress({
              stage: 'analyze',
              pct: 70,
              detail: `✓ PDF có text layer (${detect.avgChars.toFixed(0)} chars/page) — skip OCR`,
            });
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        // Estimate LibreOffice convert time dựa trên file size
        const inputSizeMB = await invoke<number[]>('read_binary_file', {
          path: actualSourcePath,
        }).then((b) => b.length / (1024 * 1024)).catch(() => 0);
        const estMin = Math.ceil(inputSizeMB / 10); // ~10MB/phút cho LibreOffice
        setProgress({
          stage: 'libreoffice',
          pct: 78,
          detail:
            inputSizeMB > 30
              ? `📄 LibreOffice đang convert (${inputSizeMB.toFixed(0)}MB, dự kiến ${estMin}-${estMin * 2} phút)…`
              : `📄 LibreOffice đang convert (${inputSizeMB.toFixed(1)}MB)…`,
        });
        await new Promise((r) => setTimeout(r, 100));

        // Phase 38.2.0 fix — Heartbeat: tăng % từ 78→93 trong khi LibreOffice spawn
        // (tránh user thấy đứng ở 78% — LibreOffice không stream progress).
        // Tốc độ tăng tỉ lệ với file size: file lớn → tăng chậm hơn.
        const heartbeatStartTime = Date.now();
        const expectedSec = Math.max(15, inputSizeMB * 6); // ~6s/MB
        const heartbeat = setInterval(() => {
          const elapsed = (Date.now() - heartbeatStartTime) / 1000;
          const ratio = Math.min(0.95, elapsed / expectedSec);
          const pct = 78 + Math.floor(ratio * 15); // 78→93 max
          setProgress({
            stage: 'libreoffice',
            pct,
            detail: `📄 LibreOffice đang convert (${elapsed.toFixed(0)}s elapsed, ${inputSizeMB.toFixed(1)}MB)…`,
          });
        }, 1000);

        // LibreOffice ghi vào output_dir; sau đó move/rename về target
        const targetDir = target.replace(/[\\/][^\\/]+$/, '');
        let outPath: string;
        try {
          outPath = await invoke<string>('convert_via_libreoffice', {
            inputPath: actualSourcePath,
            outputFormat: ext,
            outputDir: targetDir,
          });
        } finally {
          clearInterval(heartbeat);
        }

        setProgress({
          stage: 'save',
          pct: 95,
          detail: 'Đang lưu file output…',
        });

        // Nếu LO ghi tên khác target (vì LO đặt theo input filename), copy sang
        if (outPath !== target) {
          const bytes = await invoke<number[]>('read_binary_file', { path: outPath });
          await invoke('write_binary_file', { path: target, bytes });
        }

        setProgress({ stage: 'done', pct: 100, detail: '✓ Hoàn tất!' });
        setResultPath(target);
        onFlash(`✓ LibreOffice convert xong (giữ format): ${basename(target)}`);
        return;
      }

      // Fallback: HTML pipeline (text-only, không giữ format)
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

      const target = await resolveTarget(suggested, ext);
      if (target === null) {
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
      onFlash(`✓ Convert xong (text-only): ${basename(target)}`);
      setProgress({ stage: 'done', pct: 100, detail: '✓ Hoàn tất!' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onFlash(`⚠ Lỗi convert: ${msg}`);
      setProgress(null);
    } finally {
      setRunning(false);
      setTimeout(() => setProgress(null), 2000);
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

          {/* Phase 38.2.0 — Pre-select output path (folder + filename) */}
          {sourcePath && (
            <section
              style={{
                padding: '10px 12px',
                marginBottom: 10,
                background: 'rgba(16,185,129,0.10)',
                border: '2px solid rgba(16,185,129,0.55)',
                borderRadius: 10,
                fontSize: 12,
                boxShadow: '0 1px 4px rgba(16,185,129,0.15)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                  fontWeight: 700,
                  color: '#059669',
                  fontSize: 13,
                }}
              >
                📁 Lưu vào
              </div>

              {editingFilename ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
                    Tên file:
                  </span>
                  <input
                    type="text"
                    value={filenameDraft}
                    onChange={(e) => setFilenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitFilename();
                      if (e.key === 'Escape') handleCancelFilename();
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCommitFilename}
                    className="btn btn-primary"
                    style={{ padding: '3px 10px', fontSize: 11 }}
                  >
                    ✓ OK
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelFilename}
                    className="btn btn-ghost"
                    style={{ padding: '3px 10px', fontSize: 11 }}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <code
                    title={joinPath(effectiveOutputDir, effectiveFilename)}
                    style={{
                      flex: 1,
                      minWidth: 200,
                      fontSize: 12,
                      padding: '4px 8px',
                      background: 'rgba(255,255,255,0.6)',
                      color: '#065F46',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      direction: 'rtl',
                      textAlign: 'left',
                      fontWeight: 500,
                    }}
                  >
                    {joinPath(effectiveOutputDir, effectiveFilename)}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handlePickOutputDir()}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      border: '1px solid #10B981',
                      borderRadius: 5,
                      background: 'rgba(16,185,129,0.15)',
                      color: '#065F46',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title="Chọn thư mục khác để lưu file output"
                  >
                    📂 Đổi thư mục
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditFilename()}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      border: '1px solid #10B981',
                      borderRadius: 5,
                      background: 'rgba(16,185,129,0.15)',
                      color: '#065F46',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    title="Đổi tên file output"
                  >
                    ✏ Đổi tên
                  </button>
                  {(outputDir || customFilename) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOutputDir(null);
                        setCustomFilename(null);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        border: '1px solid var(--border)',
                        borderRadius: 5,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#6B7280',
                      }}
                      title="Reset về cùng folder source + tên auto"
                    >
                      ↺
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Phase 39.fix10 — MS Word banner (compact 1-line) */}
          {sourcePath &&
            sourceFmt === 'pdf' &&
            outputFormat === 'docx' &&
            wordAvailable && (
              <div
                title="Word có built-in PDF reflow + OCR scan → preserve table, layout, format gần như hoàn hảo. Tốt hơn LibreOffice + Tesseract."
                style={{
                  padding: '4px 10px',
                  marginBottom: 6,
                  background: 'rgba(37,99,235,0.08)',
                  border: '1px solid rgba(37,99,235,0.3)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                🚀 <strong>MS Word</strong> sẽ convert PDF→DOCX (chất lượng cao nhất)
              </div>
            )}
          {sourcePath &&
            sourceFmt === 'pdf' &&
            outputFormat === 'docx' &&
            !wordAvailable && (
              <div
                style={{
                  padding: '4px 10px',
                  marginBottom: 6,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: '#D97706',
                }}
              >
                ⚠ Không có MS Word — sẽ dùng LibreOffice + Tesseract OCR
              </div>
            )}

          {/* Phase 39.fix12 — tessdata_best download banner */}
          {sourcePath &&
            sourceFmt === 'pdf' &&
            tessAvailable &&
            (!tessdataBest.vie || !tessdataBest.eng) && (
              <div
                style={{
                  padding: 10,
                  marginBottom: 10,
                  background: 'rgba(168,85,247,0.08)',
                  border: '1px solid rgba(168,85,247,0.3)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <div>
                  <strong>📚 Tăng accuracy text Việt +10% (tessdata_best)</strong>
                </div>
                <div style={{ marginTop: 4, color: '#6B7280', fontSize: 11 }}>
                  Default UB-Mannheim cài tessdata regular (~8MB/lang). Best version{' '}
                  ~50MB/lang accuracy cao hơn ~10% cho text Việt scan. Tải 1 lần, cache offline.
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {!tessdataBest.vie && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadTessdata('vie')}
                      disabled={downloadingTessdata !== null}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        background: '#A855F7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {downloadingTessdata === 'vie' ? '⏳ Đang tải vie…' : '📥 Tải vie best (~45MB)'}
                    </button>
                  )}
                  {!tessdataBest.eng && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadTessdata('eng')}
                      disabled={downloadingTessdata !== null}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        background: '#A855F7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {downloadingTessdata === 'eng' ? '⏳ Đang tải eng…' : '📥 Tải eng best (~22MB)'}
                    </button>
                  )}
                </div>
              </div>
            )}
          {sourcePath &&
            sourceFmt === 'pdf' &&
            tessAvailable &&
            tessdataBest.vie &&
            tessdataBest.eng && (
              <div
                title="tessdata_best version cho accuracy text Việt cao nhất"
                style={{
                  padding: '3px 10px',
                  marginBottom: 6,
                  background: 'rgba(168,85,247,0.08)',
                  border: '1px solid rgba(168,85,247,0.25)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: '#7C3AED',
                }}
              >
                ✓ tessdata_best vie+eng sẵn sàng
              </div>
            )}

          {/* Phase 39 — LibreOffice option (compact) */}
          {sourcePath && canUseLO && (
            <div
              title={
                useLibreOffice
                  ? 'Convert qua LibreOffice headless — giữ layout, font, image, table.'
                  : 'Tắt LibreOffice = text-only convert (mất layout/image/format).'
              }
              style={{
                padding: '5px 10px',
                marginBottom: 6,
                background: useLibreOffice ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${useLibreOffice ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  margin: 0,
                }}
              >
                <input
                  type="checkbox"
                  checked={useLibreOffice}
                  onChange={(e) => setUseLibreOffice(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <strong style={{ fontSize: 12 }}>🎯 Dùng LibreOffice (giữ layout/image)</strong>
              </label>
            </div>
          )}

          {/* Phase 39.fix — Auto-OCR toggle (compact: checkbox + lang chip cùng 1 row) */}
          {sourcePath &&
            useLibreOffice &&
            canUseLO &&
            sourceFmt === 'pdf' &&
            ['docx', 'doc', 'odt', 'rtf', 'html', 'txt'].includes(outputFormat) && (
              <div
                title={
                  !tessAvailable
                    ? 'Chưa có Tesseract — PDF scan convert sẽ chỉ có ảnh, không có text.'
                    : autoOcr
                      ? 'App detect PDF scan → render page → OCR → searchable PDF → LibreOffice convert. PDF có text layer skip OCR.'
                      : 'Tắt auto-OCR — PDF scan convert sẽ chỉ có ảnh không có text.'
                }
                style={{
                  padding: '5px 10px',
                  marginBottom: 6,
                  background:
                    autoOcr && tessAvailable
                      ? 'rgba(99,102,241,0.08)'
                      : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${autoOcr && tessAvailable ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'}`,
                  borderRadius: 6,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    margin: 0,
                    flex: 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoOcr && tessAvailable}
                    onChange={(e) => setAutoOcr(e.target.checked)}
                    disabled={!tessAvailable}
                    style={{ margin: 0 }}
                  />
                  <strong style={{ fontSize: 12 }}>🔍 Auto-OCR nếu PDF là scan</strong>
                </label>
                {autoOcr && tessAvailable && (
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['vie+eng', 'vie', 'eng'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setOcrLang(s)}
                        style={{
                          padding: '1px 8px',
                          fontSize: 11,
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: ocrLang === s ? '#10B981' : 'transparent',
                          color: ocrLang === s ? '#fff' : 'inherit',
                          cursor: 'pointer',
                          lineHeight: 1.6,
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}


          {/* Phase 39.fix — Progress bar realtime */}
          {progress && (
            <div
              style={{
                padding: 12,
                marginBottom: 12,
                background: 'rgba(16,185,129,0.05)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  fontSize: 12,
                }}
              >
                <span>{progress.detail}</span>
                <strong>{progress.pct}%</strong>
              </div>
              <div
                style={{
                  height: 8,
                  background: 'rgba(0,0,0,0.1)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress.pct}%`,
                    height: '100%',
                    background:
                      progress.stage === 'done'
                        ? '#10B981'
                        : progress.stage === 'ocr'
                          ? '#6366F1'
                          : '#10B981',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: '#9CA3AF' }}>
                Stage: <code>{progress.stage}</code>
              </div>
            </div>
          )}
          {sourcePath && !canUseLO && loStatus && !loStatus.available && (
            <div
              style={{
                padding: 10,
                marginBottom: 10,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 8,
                fontSize: 11,
                color: '#D97706',
              }}
            >
              ⚠ <strong>LibreOffice chưa cài</strong> → convert sẽ chỉ extract text plain (mất
              format/image).
              <div style={{ marginTop: 4, color: '#6B7280' }}>
                Cài tại{' '}
                <a
                  href="https://www.libreoffice.org/download/download/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#10B981' }}
                >
                  libreoffice.org
                </a>{' '}
                để giữ định dạng PDF↔DOCX.
              </div>
            </div>
          )}

          <div className="convert-actions">
            <button
              className="btn btn-primary"
              onClick={() => void handleConvert()}
              disabled={running || !sourcePath}
            >
              {running
                ? `⏳ ${tr('doc.convert.running')}`
                : `⇄ ${tr('doc.convert.button')} .${outputFormat}${useLibreOffice && canUseLO ? ' (LO)' : ''}`}
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
