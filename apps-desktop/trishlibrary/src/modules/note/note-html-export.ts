/**
 * Phase 18.2.e — Note export to standalone HTML.
 *
 * Build single HTML file với inline CSS, có thể mở trên browser bất kỳ
 * hoặc share qua email/Slack.
 */

import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

interface NoteToExport {
  title: string;
  content_html: string;
  category?: string;
  tags?: string[];
  created_at?: number;
  updated_at?: number;
}

const STYLES = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    line-height: 1.65;
    color: #222;
    max-width: 760px;
    margin: 40px auto;
    padding: 24px 32px;
    background: #fff;
  }
  h1 { font-size: 28px; font-weight: 700; margin-top: 0; }
  h2 { font-size: 22px; font-weight: 600; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 1.5em; }
  h3 { font-size: 18px; font-weight: 600; margin-top: 1.3em; }
  h4 { font-size: 16px; font-weight: 600; }
  p { margin: 0.6em 0; }
  ul, ol { padding-left: 24px; }
  li { margin: 0.2em 0; }
  blockquote {
    border-left: 3px solid #4dabf7;
    margin: 0.6em 0;
    padding: 4px 14px;
    color: #555;
    background: #f8f9fa;
  }
  code {
    background: #f1f3f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.9em;
  }
  pre {
    background: #2b2b2b;
    color: #e8e8e8;
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  a { color: #1971c2; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  table th, table td { border: 1px solid #ccc; padding: 6px 10px; }
  table th { background: #f1f3f5; font-weight: 600; text-align: left; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
  img { max-width: 100%; height: auto; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 6px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #eee; }
  .tags { display: inline-flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .tag { background: #f1f3f5; padding: 2px 8px; border-radius: 12px; font-size: 11px; color: #495057; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1a1a; color: #e0e0e0; }
    h2 { border-bottom-color: #444; }
    blockquote { background: #252525; border-color: #4dabf7; color: #bbb; }
    code { background: #2a2a2a; }
    .meta { border-color: #333; color: #999; }
    .tag { background: #2a2a2a; color: #bbb; }
    table th { background: #2a2a2a; }
    table th, table td { border-color: #444; }
  }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(note: NoteToExport): string {
  const title = note.title || 'Untitled note';
  const created = note.created_at ? new Date(note.created_at).toLocaleString('vi-VN') : '';
  const updated = note.updated_at ? new Date(note.updated_at).toLocaleString('vi-VN') : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="TrishLibrary 3.0">
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    ${note.category ? `<span>📁 ${note.category === 'project' ? 'Dự án' : 'Cá nhân'}</span>` : ''}
    ${created ? `<span> · 📅 Tạo: ${escapeHtml(created)}</span>` : ''}
    ${updated && updated !== created ? `<span> · ✎ Sửa: ${escapeHtml(updated)}</span>` : ''}
    ${note.tags && note.tags.length > 0
      ? `<div class="tags">${note.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
      : ''}
  </div>
  ${note.content_html || '<p><em>(Empty)</em></p>'}
  <hr>
  <footer style="text-align: center; color: #aaa; font-size: 11px; margin-top: 40px;">
    Exported by TrishLibrary 3.0 · ${new Date().toISOString().slice(0, 10)}
  </footer>
</body>
</html>
`;
}

function suggestFilename(title: string): string {
  const safe = (title || 'note')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim()
    .slice(0, 80) || 'note';
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}_${date}.html`;
}

export async function exportNoteToHtml(note: NoteToExport): Promise<string | null> {
  const html = buildHtml(note);
  const target = await saveDialog({
    defaultPath: suggestFilename(note.title),
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  });
  if (typeof target !== 'string') return null;
  await invoke<void>('write_text_string', { path: target, content: html });
  return target;
}
