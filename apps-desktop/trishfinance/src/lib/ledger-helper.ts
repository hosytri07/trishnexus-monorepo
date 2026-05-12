/**
 * Phase 40.9 — Ledger helper.
 *
 * Cho phép các module độc lập (santhethao, khodientu, photocopy) push entry
 * vào sổ thu/chi của module "Tài chính cá nhân" — `trishfinance_db.ledger`.
 *
 * Cách dùng:
 *   addLedgerEntry({ amount: 300000, kind: 'thu', source: 'santhethao', description: '...' })
 *
 * Trả `true` nếu đã ghi thành công, `false` nếu DB tài chính chưa khởi tạo (user
 * chưa từng vào module Tài chính cá nhân).
 *
 * KHÔNG dùng useFinanceDb hook ở đây (modules mới dùng localStorage riêng) — em đọc-ghi
 * trực tiếp `trishfinance_db` để tránh circular dep + sync immediate.
 */

const DB_KEY = 'trishfinance_db';

export type LedgerKind = 'thu' | 'chi';
export type LedgerSource =
  | 'manual'
  | 'nhatro'
  | 'banhang'
  | 'santhethao'
  | 'khodientu'
  | 'photocopy'
  | 'recurring';

export interface AddLedgerInput {
  amount: number;
  kind: LedgerKind;
  /** Category trong @types LedgerCategory — vd 'kinh_doanh', 'cho_thue', 'khac_thu' */
  category?: string;
  description: string;
  /** Module nào tạo entry — để filter báo cáo theo nguồn */
  source: LedgerSource;
  /** ID gốc trong module source (vd booking.id, tx.id) — để link 2 chiều */
  refId?: string;
  /** Date YYYY-MM-DD. Default = hôm nay */
  date?: string;
  /** Tài khoản / ví. Default undefined = cash. */
  accountId?: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function makeId(): string {
  return `led_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Default category mapping theo source */
function defaultCategory(source: LedgerSource, kind: LedgerKind): string {
  if (kind === 'thu') {
    return source === 'santhethao' ? 'cho_thue' : 'kinh_doanh';
  }
  return 'khac_chi';
}

/**
 * Push 1 entry vào ledger. Trả true nếu OK.
 */
export function addLedgerEntry(input: AddLedgerInput): boolean {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      console.warn('[ledger-helper] trishfinance_db chưa init — vào module Tài chính cá nhân 1 lần để khởi tạo');
      return false;
    }
    const db = JSON.parse(raw);
    if (!Array.isArray(db.ledger)) db.ledger = [];

    const entry = {
      id: makeId(),
      date: input.date ?? todayStr(),
      kind: input.kind,
      category: input.category ?? defaultCategory(input.source, input.kind),
      amount: Math.max(0, Math.round(input.amount)),
      description: input.description,
      accountId: input.accountId,
      fromModule: input.source,
      refId: input.refId,
      createdAt: new Date().toISOString(),
    };

    db.ledger = [entry, ...db.ledger];
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch (err) {
    console.warn('[ledger-helper] add fail:', err);
    return false;
  }
}

/**
 * Xóa entry theo refId (vd khi user hủy booking).
 */
export function removeLedgerEntriesByRef(refId: string): number {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return 0;
    const db = JSON.parse(raw);
    if (!Array.isArray(db.ledger)) return 0;
    const before = db.ledger.length;
    db.ledger = db.ledger.filter((e: { refId?: string }) => e.refId !== refId);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return before - db.ledger.length;
  } catch {
    return 0;
  }
}

/**
 * Get bank accounts đã khai báo trong Tài chính cá nhân (để dropdown chọn nguồn tiền).
 */
export interface BankAccount {
  id: string;
  name: string;
  bank?: string;
  type?: string;
  balance?: number;
}
export function getBankAccounts(): BankAccount[] {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return [];
    const db = JSON.parse(raw);
    return Array.isArray(db.accounts) ? db.accounts : [];
  } catch {
    return [];
  }
}
