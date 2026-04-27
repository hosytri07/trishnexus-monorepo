/**
 * Phase 18.3.a — Document format conversion utilities.
 *
 * HTML là format trung gian:
 *   Import: source format → HTML → TipTap setContent
 *   Export: TipTap getHTML → target format
 */

import mammoth from 'mammoth';
import { marked } from 'marked';
import TurndownService from 'turndown';
// @ts-expect-error — turndown-plugin-gfm không có type declaration
import { gfm } from 'turndown-plugin-gfm';
import { type DocFormat } from './types.js';

let _turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (_turndown) return _turndown;
  const td = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    fence: '```',
  });
  td.use(gfm);
  _turndown = td;
  return td;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Import: source format bytes/text → HTML cho TipTap */
export async function importToHtml(
  content: ArrayBuffer | string,
  format: DocFormat,
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  switch (format) {
    case 'docx': {
      if (typeof content === 'string') throw new Error('Cần ArrayBuffer cho .docx');
      const result = await mammoth.convertToHtml({ arrayBuffer: content });
      return { html: result.value, warnings: result.messages.map((m) => m.message) };
    }
    case 'md': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const html = marked.parse(text, { async: false }) as string;
      return { html, warnings };
    }
    case 'html': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      return { html: (bodyMatch ? bodyMatch[1] : text) ?? text, warnings };
    }
    case 'txt': {
      const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const html = text
        .split(/\n\s*\n/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      return { html, warnings };
    }
    case 'pdf': {
      if (typeof content === 'string') throw new Error('Cần ArrayBuffer cho .pdf');
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import(
        // @ts-ignore — Vite ?url suffix returns string at runtime
        'pdfjs-dist/build/pdf.worker.min.mjs?url'
      )).default;
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
          'PDF có ít text — có thể là PDF scan ảnh. OCR PDF scan sẽ có ở Phase 18.3.b.',
        );
      }
      const html = pages
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('<hr>');
      return { html: html || '<p>(PDF không có text trích được)</p>', warnings };
    }
    case 'json':
      throw new Error('Use importTipTapJson() for .json');
  }
}

export function importTipTapJson(content: string): { html?: string } {
  return JSON.parse(content) as { html?: string };
}

export interface ExportResult {
  content: ArrayBuffer | string;
  contentType: string;
  isBinary: boolean;
}

/** Export: TipTap HTML → target format */
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
      const { asBlob } = await import('html-docx-js-typescript');
      const fullDoc = wrapHtmlDocument(html, options?.fileName ?? 'Document');
      const result = await asBlob(fullDoc, {
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      });
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
      // @ts-ignore — html2pdf.js không có type declaration
      const html2pdfMod = (await import('html2pdf.js')).default as unknown as (
        opts: unknown,
      ) => {
        from(el: HTMLElement): {
          set(opts: unknown): {
            outputPdf(type: 'arraybuffer'): Promise<unknown>;
          };
        };
      };
      const wrap = document.createElement('div');
      wrap.style.cssText =
        'position:fixed;top:-99999px;left:0;width:794px;padding:32px;background:#fff;color:#1a1a1a;font-family:Georgia,serif;font-size:14px;line-height:1.6;';
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
  }
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
blockquote { border-left: 3px solid #94a3b8; margin: 12px 0; padding: 4px 14px; color: #64748b; }
table { border-collapse: collapse; margin: 12px 0; }
th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
img { max-width: 100%; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export function countDocumentMetrics(html: string): {
  words: number;
  chars: number;
  paragraphs: number;
  readingTimeMin: number;
} {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const paragraphs = doc.querySelectorAll('p, h1, h2, h3, h4, li, blockquote').length;
  return {
    words,
    chars,
    paragraphs,
    readingTimeMin: Math.max(1, Math.ceil(words / 220)),
  };
}
