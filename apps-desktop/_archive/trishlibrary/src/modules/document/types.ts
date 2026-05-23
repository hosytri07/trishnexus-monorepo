/**
 * Phase 18.3.a — Document module types.
 */

export type DocFormat = 'docx' | 'md' | 'html' | 'txt' | 'pdf' | 'json';

export interface DocTab {
  id: string;
  /** Disk path nếu đã save, null nếu untitled */
  path: string | null;
  /** Hiển thị (basename hoặc untitled-N) */
  name: string;
  /** TipTap HTML content */
  html: string;
  /** Để compare dirty */
  savedHtml: string;
  /** Format detect from path/extension */
  format: DocFormat;
  created_ms: number;
}

export const FORMAT_LABELS: Record<DocFormat, string> = {
  docx: 'Word Document (.docx)',
  md: 'Markdown (.md)',
  html: 'HTML (.html)',
  txt: 'Plain text (.txt)',
  pdf: 'PDF (.pdf)',
  json: 'TrishType JSON (.json)',
};

export const FORMAT_EXTENSIONS: Record<DocFormat, string[]> = {
  docx: ['docx'],
  md: ['md', 'markdown'],
  html: ['html', 'htm'],
  txt: ['txt', 'log'],
  pdf: ['pdf'],
  json: ['json'],
};

export function detectFormatFromName(name: string): DocFormat {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  for (const [fmt, exts] of Object.entries(FORMAT_EXTENSIONS) as [DocFormat, string[]][]) {
    if (exts.includes(ext)) return fmt;
  }
  return 'txt';
}

export function basename(path: string): string {
  const m = path.split(/[\\/]/);
  return m[m.length - 1] ?? path;
}

let _tabId = 1;
export function genTabId(): string {
  return `dt${_tabId++}-${Date.now().toString(36)}`;
}
