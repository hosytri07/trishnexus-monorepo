/**
 * @trishteam/core/qr — QR payload validation + codec helpers.
 *
 * KHÔNG render QR ở đây (depend vào lib `qrcode` DOM). Caller tự render —
 * core chỉ lo: validate text, classify loại (URL/vcard/wifi), gợi ý
 * filename khi save.
 *
 * Phase 14.0 scaffold.
 */

export type QrKind = 'url' | 'text' | 'email' | 'phone' | 'wifi' | 'vcard';

export const MAX_QR_TEXT_LENGTH = 2953; // QR v40 level L numeric max

export function classifyQr(text: string): QrKind {
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return 'url';
  if (/^mailto:/i.test(t) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'email';
  if (/^tel:/i.test(t) || /^\+?\d[\d\s-]{6,}$/.test(t)) return 'phone';
  if (/^WIFI:/i.test(t)) return 'wifi';
  if (/^BEGIN:VCARD/i.test(t)) return 'vcard';
  return 'text';
}

export function validateQrText(text: string): string | null {
  if (!text.trim()) return 'Nội dung QR không được trống';
  if (text.length > MAX_QR_TEXT_LENGTH) {
    return `Nội dung vượt ${MAX_QR_TEXT_LENGTH} ký tự — QR sẽ quá dày để quét`;
  }
  return null;
}

/**
 * Gợi ý filename khi user save QR thành PNG. Không chứa ký tự đặc biệt để
 * an toàn trên cả Windows/macOS.
 */
export function suggestFilename(text: string): string {
  const kind = classifyQr(text);
  const slug = text
    .slice(0, 40)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const ts = new Date().toISOString().slice(0, 10);
  return `trishqr-${kind}-${slug || 'untitled'}-${ts}.png`;
}
