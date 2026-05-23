/**
 * Phase 15.2.r5 — QR generation từ link.
 * Phase 16.2.e — Fix download QR trong Tauri WebView2:
 *   `<a download>` với data: URL bị WebView2 chặn → dùng native save dialog
 *   + Rust command `save_qr_file` decode base64 và ghi file.
 *
 * Quality: M (15% error correction). Size 256px square base.
 */

import QRCode from 'qrcode';
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

export async function generateQrDataUrl(text: string): Promise<string> {
  if (!text.trim()) return '';
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 256,
      color: {
        dark: '#0e1419',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.warn('[trishlibrary] QR gen fail:', err);
    return '';
  }
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error — __TAURI_INTERNALS__ injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

/**
 * Tải QR PNG về máy.
 *
 * - Trong Tauri (production): mở native save dialog → invoke Rust ghi file.
 * - Trong browser (dev mode): dùng anchor click trick.
 */
export async function downloadQrPng(
  dataUrl: string,
  fileName: string,
): Promise<void> {
  if (!dataUrl) return;
  const safeName = fileName.endsWith('.png') ? fileName : `${fileName}.png`;

  // === Browser dev mode ===
  if (!isInTauri()) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // === Tauri production ===
  try {
    const picked = await saveDialog({
      defaultPath: safeName,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
    });
    if (typeof picked !== 'string' || !picked.trim()) return; // user cancel

    // Strip `data:image/png;base64,` prefix nếu có (Rust cũng strip,
    // nhưng làm ở đây cho rõ ràng).
    const commaIdx = dataUrl.indexOf('base64,');
    const base64Data = commaIdx >= 0 ? dataUrl.slice(commaIdx + 7) : dataUrl;

    await invoke<number>('save_qr_file', {
      path: picked,
      base64Data: base64Data,
    });
  } catch (err) {
    console.warn('[trishlibrary] downloadQrPng fail:', err);
    alert(`Không tải được QR: ${err instanceof Error ? err.message : err}`);
  }
}
