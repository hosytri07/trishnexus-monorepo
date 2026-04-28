/**
 * Phase 17.6 v2 — Format conversion utilities.
 *
 * Architecture: HTML là format trung gian.
 *   - Import: source format → HTML → TipTap (setContent)
 *   - Export: TipTap → HTML → target format
 *
 * Supported formats:
 *   - .docx (mammoth: docx → html, html-docx-js-typescript: html → docx)
 *   - .md   (marked: md → html, turndown: html → md)
 *   - .html (direct passthrough)
 *   - .txt  (strip tags / wrap paragraphs)
 *   - .pdf  (html2pdf.js: html → pdf, browser-side print)
 *   - .json (TipTap native JSON, re-edit ngon nhất)
 *   - .py/.js/.ts/.rs/... (paste as code block hoặc plain text)
 */

import mammoth from 'mammoth';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export type DocFormat = 'docx' | 'md' | 'html' | 'txt' | 'pdf' | 'json' | 'code';

export const FORMAT_EXTENSIONS: Record<DocFormat, string[]> = {
  docx: ['docx'],
  md: ['md', 'markdown'],
  html: ['html', 'htm'],
  txt: ['txt', 'log'],
  pdf: ['pdf'],
  json: ['json'],
  code: [
    'py', 'js', 'jsx', 'ts', 'tsx', 'rs', 'go', 'java', 'cpp', 'c', 'h',
    'rb', 'php', 'sh', 'sql', 'yaml', 'yml', 'toml', 'xml', 'css', 'scss',
    'lua', 'r', 'kt', 'swift', 'dart',
  ],
};

export const FORMAT_LABELS: Record<DocFormat, string> = {
  docx: 'Word Document (.docx)',
  md: 'Markdown (.md)',
  html: 'HTML (.html)',
  txt: 'Plain text (.txt)',
  pdf: 'PDF (.pdf)',
  json: 'TrishType JSON (.json)',
  code: 'Code file (.py/.js/.ts/...)',
};

export function detectFormatFromName(name: string): DocFormat {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  for (const [fmt, exts] of Object.entries(FORMAT_EXTENSIONS) as [DocFormat, string[]][]) {
    if (exts.includes(ext)) return fmt;
  }
  return 'txt';
}

// ============================================================
// Turndown service (HTML → Markdown)
// ============================================================

let _turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (_turndownInstance) return _turndownInstance;
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    fence: '```',
  });
  td.use(gfm); // GitHub Flavored Markdown — tables, strikethrough, task lists
  _turndownInstance = td;
  return td;
}

// ============================================================
// Import: source format → HTML
// ============================================================

/** Load file content (Uint8Array or string) → HTML có thể setContent vào TipTap. */
export async function importToHtml(
  content: ArrayBuffer | string,
  format: DocFormat,
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];

  switch (format) {
    case 'docx': {
      if (typeof content === 'string') {
        throw new Error('Cần ArrayBuffer cho .docx');
      }
      const result = await mammoth.convertToHtml({ arrayBuffer: content });
      return {
        html: result.value,
        warnings: result.messages.map((m) => m.message),
      };
    }
    case 'md': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const html = marked.parse(text, { async: false }) as string;
      return { html, warnings };
    }
    case 'html': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      // Extract body if full document
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      const html = bodyMatch ? bodyMatch[1] : text;
      return { html: html ?? text, warnings };
    }
    case 'txt': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      // Convert newlines → <p> paragraphs (giữ blank line = paragraph break)
      const html = text
        .split(/\n\s*\n/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      return { html, warnings };
    }
    case 'json': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      // Native TrishType JSON = TipTap JSON. Cần caller xử lý setContent với JSON object.
      // Trả ra dummy HTML — caller phải dùng importTipTapJson() thay vì importToHtml() cho .json.
      throw new Error('Use importTipTapJson() for .json files');
    }
    case 'pdf': {
      if (typeof content === 'string') {
        throw new Error('Cần ArrayBuffer cho .pdf');
      }
      // Lazy load pdfjs để tránh bundle khổng lồ trên flow không cần
      const pdfjs = await import('pdfjs-dist');
      // Worker bundled qua Vite ?url
      // @ts-expect-error — Vite worker import
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(content) }).promise;
      const pages: string[] = [];
      let totalChars = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        const txt = tc.items
          .map((it) => ('str' in it ? it.str : ''))
          .filter((s) => s)
          .join(' ');
        pages.push(txt);
        totalChars += txt.length;
        if (i >= 200) {
          warnings.push(`PDF có ${pdf.numPages} trang, chỉ extract 200 trang đầu`);
          break;
        }
      }
      if (totalChars < 50) {
        warnings.push(
          'PDF có ít text — có thể là PDF scan ảnh. OCR PDF scan sẽ có ở v2.0.2.',
        );
      }
      const html = pages
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('<hr>');
      return { html: html || '<p>(PDF không có text trích được)</p>', warnings };
    }
    case 'code': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      // Wrap toàn bộ vào <pre><code>
      const html = `<pre><code>${escapeHtml(text)}</code></pre>`;
      return { html, warnings };
    }
  }
}

export function importTipTapJson(content: string): unknown {
  return JSON.parse(content);
}

// ============================================================
// Export: HTML → target format
// ============================================================

export interface ExportResult {
  /** Raw bytes hoặc string content cho file output. */
  content: ArrayBuffer | string;
  /** MIME-ish — chỉ informational. */
  contentType: string;
  /** True nếu content là binary (ArrayBuffer), false nếu text/utf-8. */
  isBinary: boolean;
}

export async function exportFromHtml(
  html: string,
  format: DocFormat,
  options?: { fileName?: string; tipTapJson?: unknown },
): Promise<ExportResult> {
  switch (format) {
    case 'html': {
      const doc = wrapHtmlDocument(html, options?.fileName ?? 'Document');
      return { content: doc, contentType: 'text/html', isBinary: false };
    }
    case 'md': {
      const md = getTurndown().turndown(html);
      return { content: md, contentType: 'text/markdown', isBinary: false };
    }
    case 'txt': {
      const txt = htmlToPlainText(html);
      return { content: txt, contentType: 'text/plain', isBinary: false };
    }
    case 'docx': {
      // html-docx-js-typescript export Buffer; load lazily để tránh bundle nặng nếu không dùng
      const { asBlob } = await import('html-docx-js-typescript');
      const fullDoc = wrapHtmlDocument(html, options?.fileName ?? 'Document');
      const result = await asBlob(fullDoc, {
        margin: {
          top: 1440, // 1 inch = 1440 twips
          right: 1440,
          bottom: 1440,
          left: 1440,
        },
      });
      // result là Blob trong browser
      const blob = result as Blob;
      const ab = await blob.arrayBuffer();
      return {
        content: ab,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        isBinary: true,
      };
    }
    case 'pdf': {
      // PDF export dùng html2pdf.js — tạo PDF từ HTML node trong DOM
      // Yêu cầu phải mount HTML vào DOM trước (offscreen)
      const html2pdfMod = (await import('html2pdf.js')).default as unknown as (
        opts: unknown,
      ) => {
        from(el: HTMLElement): {
          set(opts: unknown): {
            outputPdf(type: 'arraybuffer' | 'blob' | 'datauristring' | 'string'): Promise<unknown>;
          };
        };
      };

      const wrap = document.createElement('div');
      wrap.style.cssText =
        'position:fixed;top:-99999px;left:0;width:794px;padding:32px;background:#ffffff;color:#1a1a1a;font-family:Georgia,serif;font-size:14px;line-height:1.6;';
      wrap.innerHTML = html;
      document.body.appendChild(wrap);

      try {
        const pdfBuilder = html2pdfMod({})
          .from(wrap)
          .set({
            margin: 10,
            filename: options?.fileName ?? 'document.pdf',
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          });
        const ab = (await pdfBuilder.outputPdf('arraybuffer')) as ArrayBuffer;
        return { content: ab, contentType: 'application/pdf', isBinary: true };
      } finally {
        document.body.removeChild(wrap);
      }
    }
    case 'json': {
      const json = options?.tipTapJson ?? { html };
      return {
        content: JSON.stringify(json, null, 2),
        contentType: 'application/json',
        isBinary: false,
      };
    }
    case 'code': {
      // Extract text từ <pre><code> blocks; nếu không có code block thì plain text
      const code = htmlExtractCode(html);
      return { content: code, contentType: 'text/plain', isBinary: false };
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: Georgia, serif; max-width: 720px; margin: 24px auto; padding: 0 16px; line-height: 1.65; color: #1a1a1a; }
h1, h2, h3 { font-family: -apple-system, 'Segoe UI', sans-serif; }
code { background: #f1f3f5; padding: 1px 6px; border-radius: 3px; font-family: Consolas, monospace; }
pre { background: #f1f3f5; padding: 12px; border-radius: 6px; overflow-x: auto; }
pre code { background: transparent; padding: 0; }
blockquote { border-left: 3px solid #94a3b8; margin: 12px 0; padding: 4px 14px; color: #64748b; }
table { border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
th { background: #f1f5f9; }
img { max-width: 100%; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function htmlToPlainText(html: string): string {
  // Browser-side parse: dùng DOM để strip tags, giữ paragraph spacing
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: string[] = [];

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? '';
      if (txt.trim()) blocks[blocks.length - 1] = (blocks[blocks.length - 1] ?? '') + txt;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const isBlock =
      [
        'p',
        'div',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'li',
        'tr',
        'pre',
        'blockquote',
        'br',
        'hr',
      ].indexOf(tag) >= 0;

    if (tag === 'br') {
      blocks.push('');
      return;
    }
    if (tag === 'hr') {
      blocks.push('---');
      blocks.push('');
      return;
    }
    if (isBlock && blocks.length > 0 && blocks[blocks.length - 1] !== '') {
      blocks.push('');
    }
    if (isBlock && (blocks.length === 0 || blocks[blocks.length - 1] !== '')) {
      blocks.push('');
    }

    if (tag === 'li') {
      const marker = el.parentElement?.tagName.toLowerCase() === 'ol' ? '1. ' : '- ';
      blocks[blocks.length - 1] = marker;
    }

    for (const child of Array.from(el.childNodes)) walk(child);

    if (isBlock) blocks.push('');
  }

  for (const child of Array.from(doc.body.childNodes)) walk(child);

  return blocks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlExtractCode(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const codes = doc.querySelectorAll('pre, code');
  if (codes.length === 0) return htmlToPlainText(html);
  return Array.from(codes)
    .map((el) => el.textContent ?? '')
    .filter((s) => s.trim().length > 0)
    .join('\n\n');
}

/** Đếm word + character + đoạn từ HTML. */
export function countDocumentMetrics(html: string): {
  words: number;
  chars: number;
  charsNoSpace: number;
  paragraphs: number;
  sentences: number;
  readingTimeMin: number;
} {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const paragraphs = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').length;
  const sentences = (text.match(/[.!?]+/g) ?? []).length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 220)); // 220 WPM avg adult
  return { words, chars, charsNoSpace, paragraphs, sentences, readingTimeMin };
}

/**
 * Flesch reading-ease score (cho tiếng Anh — tiếng Việt approximate).
 * 90-100: rất dễ · 60-70: bình thường · 30-50: khó · 0-30: rất khó
 */
export function fleschScore(html: string): number {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (doc.body.textContent ?? '').trim();
  if (!text) return 0;
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  // Estimate syllables: vowel groups
  const syllables = words.reduce((sum, w) => {
    const groups = w.toLowerCase().match(/[aeiouyăâêôơưáéíóúýằầềồờừấếốớứàèìòùỳảẳẩểổởửẵẫễỗỡữạặậệộợựạịậ]+/g);
    return sum + Math.max(1, groups ? groups.length : 1);
  }, 0);
  const score =
    206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function readabilityLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Rất dễ', color: '#22c55e' };
  if (score >= 70) return { label: 'Dễ', color: '#84cc16' };
  if (score >= 60) return { label: 'Bình thường', color: '#eab308' };
  if (score >= 50) return { label: 'Hơi khó', color: '#f97316' };
  if (score >= 30) return { label: 'Khó', color: '#ef4444' };
  return { label: 'Rất khó', color: '#a21caf' };
}

/** Top từ lặp nhiều nhất (loại stopwords cơ bản VN/EN). */
export function topWords(html: string, n: number = 10): Array<{ word: string; count: number }> {
  const STOPWORDS = new Set<string>([
    'và', 'là', 'của', 'có', 'không', 'để', 'cho', 'với', 'này', 'đó',
    'một', 'các', 'những', 'được', 'trong', 'thì', 'mà', 'nhưng', 'như',
    'the', 'and', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of',
    'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as', 'this', 'that',
    'it', 'its', 'or', 'if', 'so', 'but', 'not', 'no', 'do', 'does', 'did',
  ]);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (doc.body.textContent ?? '').toLowerCase();
  const words = text.match(/[a-zA-ZÀ-ỹ]+/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}
