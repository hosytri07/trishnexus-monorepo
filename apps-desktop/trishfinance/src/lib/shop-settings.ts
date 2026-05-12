/**
 * Phase 40.16 — Shop settings: thông tin cửa hàng + bank account để hiển thị QR.
 *
 * Lưu localStorage `trishfinance:shop_settings`. Dùng cho mọi module có POS.
 */

const KEY = 'trishfinance:shop_settings';

/**
 * VietQR bank codes (subset phổ biến). Full list: https://api.vietqr.io/v2/banks
 */
export const VIETQR_BANKS = [
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'MB', name: 'MB Bank' },
  { code: 'ACB', name: 'ACB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VTB', name: 'Vietinbank' },
  { code: 'AGRIBANK', name: 'Agribank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'SHB', name: 'SHB' },
  { code: 'SACOMBANK', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'MSB', name: 'MSB' },
  { code: 'OCB', name: 'OCB' },
  { code: 'VIB', name: 'VIB' },
  { code: 'EIB', name: 'Eximbank' },
  { code: 'NAMABANK', name: 'Nam A Bank' },
  { code: 'BVB', name: 'BaoVietBank' },
  { code: 'NCB', name: 'NCB' },
  { code: 'PVCOMBANK', name: 'PVcomBank' },
];

export interface ShopSettings {
  shopName: string;
  /** Bank code theo VietQR (vd 'VCB', 'TCB') */
  bankCode: string;
  /** Số tài khoản (chỉ số, không khoảng cách) */
  bankAccount: string;
  /** Tên chủ tài khoản — in hoa, không dấu */
  bankAccountName: string;
  /** Optional: số điện thoại / địa chỉ */
  phone?: string;
  address?: string;
}

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: '',
  bankCode: 'VCB',
  bankAccount: '',
  bankAccountName: '',
};

export function loadShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveShopSettings(s: ShopSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/**
 * Tạo URL VietQR image cho amount + description cụ thể.
 * https://www.vietqr.io/danh-sach-api/link-tao-ma-nhanh
 *
 * Format: https://img.vietqr.io/image/{BANK}-{ACC}-print.png?amount=X&addInfo=Y&accountName=Z
 *
 * Trả null nếu chưa cấu hình bank info.
 */
export function makeVietQRUrl(amount: number, description: string): string | null {
  const s = loadShopSettings();
  if (!s.bankCode || !s.bankAccount || !s.bankAccountName) return null;
  const acc = s.bankAccount.replace(/\s+/g, '');
  const desc = description.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, ''); // VietQR allow alphanumeric only
  const name = encodeURIComponent(s.bankAccountName);
  return `https://img.vietqr.io/image/${s.bankCode}-${acc}-print.png?amount=${Math.round(amount)}&addInfo=${encodeURIComponent(desc)}&accountName=${name}`;
}

export function hasShopBankInfo(): boolean {
  const s = loadShopSettings();
  return !!(s.bankCode && s.bankAccount && s.bankAccountName);
}
