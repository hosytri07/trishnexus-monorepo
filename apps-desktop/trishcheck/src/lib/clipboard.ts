/**
 * Phase 15.0.f — Copy formatted text to clipboard.
 *
 * Dùng navigator.clipboard.writeText (modern API). Tauri WebView2
 * support sẵn từ default permissions.
 *
 * Trả Promise<boolean> — true nếu copy thành công, false nếu fail.
 * UI hiện toast/badge "Đã sao chép" trong 1.5s.
 */

import { buildMarkdownReport, type ExportPayload } from './exporters.js';

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    console.warn('[trishcheck] navigator.clipboard not available');
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('[trishcheck] clipboard write failed:', err);
    return false;
  }
}

/**
 * Copy báo cáo Markdown vào clipboard — paste vào Slack/email/Notion
 * sẽ tự render bảng. Format khớp với Markdown export.
 */
export async function copyReportToClipboard(
  payload: ExportPayload,
): Promise<boolean> {
  const md = buildMarkdownReport(payload);
  return copyTextToClipboard(md);
}
