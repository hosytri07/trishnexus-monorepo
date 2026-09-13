/**
 * TrishFinance — ĐỒNG BỘ ĐÁM MÂY toàn bộ dữ liệu (02-09, anh Trí).
 *
 * Mục đích: dùng TrishFinance trên NHIỀU THIẾT BỊ (desktop + điện thoại
 * Android) mà thấy CÙNG một dữ liệu — đặc biệt module Công tác ghi chi tiêu
 * ngay trên đường.
 *
 * KIẾN TRÚC — vì sao chia PHẦN chứ không đẩy nguyên cục db:
 *   Firestore giới hạn 1MB/tài liệu. Đẩy nguyên FinanceDb là một quả bom hẹn
 *   giờ — sổ bán hàng phình đến đâu nổ đến đó, và nổ ÂM THẦM (ghi fail, bắt
 *   lỗi, bỏ qua). Chia mỗi mảng top-level một tài liệu
 *   `finance_sync/{uid}/parts/{tên}` thì từng phần khó chạm trần hơn nhiều,
 *   và phần nào hỏng chỉ phần đó không đồng bộ.
 *
 * CƠ CHẾ:
 *   - ĐẨY: saveDb (state.ts) gọi scheduleFinancePush(db) — debounce 2.5s,
 *     CHỈ đẩy phần có nội dung đổi so với lần đẩy trước (so hash, khỏi tốn
 *     write Firestore mỗi lần gõ phím).
 *   - KÉO: pullFinanceFromCloud() chạy MỘT LẦN lúc mở app (App.tsx, sau
 *     đăng nhập, TRƯỚC khi render các module — module đọc localStorage lúc
 *     mount nên kéo xong mới render là thấy ngay bản mới). Phần nào mây mới
 *     hơn lần thấy cuối thì áp về local (last-write-wins THEO PHẦN); nếu
 *     local đang có sửa chưa đẩy thì bản local được giữ vào khoá conflict
 *     trước khi áp — không mất âm thầm.
 *   - Không đồng bộ: logs (nhật ký thao tác là chuyện của từng máy),
 *     dbVersion (chuyện schema của từng máy).
 *
 * Mất mạng / chưa đăng nhập: mọi hàm im lặng bỏ qua — app local-first như cũ.
 */

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@trishteam/auth';
import { EMPTY_DB, type FinanceDb } from '../types';

const DB_KEY = 'trishfinance_db';
const SEEN = 'tf_sync:seen:';      // updated_at của phần đã thấy từ mây
const PUSHED = 'tf_sync:pushed:';  // hash nội dung phần đã đẩy thành công
const CONFLICT = 'tf_sync:conflict:'; // bản local bị mây đè (cứu tay nếu cần)

/** Các phần đồng bộ — mỗi phần một tài liệu. 'meta' gom các giá trị lẻ. */
const ARRAY_PARTS = [
  'accounts', 'properties', 'phongs', 'khachs', 'hopDongs', 'dienNuoc',
  'hoaDons', 'thanhToans', 'suCos', 'chiPhis', 'ledger', 'budgets',
  'recurrings', 'congtacTrips', 'outsideJobs', 'shops', 'products', 'orders',
  'customers', 'stations', 'stationSessions', 'cafeTables',
] as const;
type ArrayPart = (typeof ARRAY_PARTS)[number];
const META_FIELDS = ['activePropertyId', 'activeShopId', 'contractTemplate', 'invoiceConfig'] as const;

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string): void {
  try { localStorage.setItem(k, v); } catch { /* quota — bỏ qua */ }
}

/** Hash nhanh (djb2) — chỉ để biết "có đổi so với lần đẩy trước không". */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

function uid(): string | null {
  try { return getFirebaseAuth().currentUser?.uid ?? null; } catch { return null; }
}

function partPayload(db: FinanceDb, part: string): string {
  if (part === 'meta') {
    const m: Record<string, unknown> = {};
    for (const f of META_FIELDS) m[f] = db[f];
    return JSON.stringify(m);
  }
  return JSON.stringify(db[part as ArrayPart] ?? []);
}

/* ── ĐẨY ─────────────────────────────────────────────────────────────────── */

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: FinanceDb | null = null;
let pushing = false;

/** Gọi từ saveDb (state.ts) sau MỖI lần lưu local — debounce rồi đẩy phần đổi. */
export function scheduleFinancePush(db: FinanceDb): void {
  pending = db;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void pushNow(); }, 2500);
}

async function pushNow(): Promise<void> {
  const u = uid();
  const db = pending;
  if (!u || !db || pushing) return;
  pushing = true;
  try {
    const fs = getFirebaseDb();
    const parts: string[] = [...ARRAY_PARTS, 'meta'];
    for (const part of parts) {
      const payload = partPayload(db, part);
      const h = hash(payload);
      if (lsGet(PUSHED + part) === h) continue; // không đổi — khỏi tốn write
      try {
        const ts = Date.now();
        // eslint-disable-next-line no-await-in-loop
        await setDoc(doc(fs, 'finance_sync', u, 'parts', part), {
          payload, updated_at: ts, device: navigator.userAgent.slice(0, 60),
        });
        lsSet(PUSHED + part, h);
        lsSet(SEEN + part, String(ts));
      } catch (e) {
        // mất mạng / rules chưa deploy — để hash cũ, lần lưu sau tự thử lại
        console.warn('[tf-sync] push', part, 'fail:', e);
      }
    }
  } finally {
    pushing = false;
  }
}

/* ── KÉO ─────────────────────────────────────────────────────────────────── */

/**
 * Kéo về lúc mở app (sau đăng nhập, TRƯỚC khi render module).
 * Trả true nếu có áp dữ liệu mới từ mây vào localStorage.
 */
export async function pullFinanceFromCloud(): Promise<boolean> {
  const u = uid();
  if (!u) return false;
  let snap;
  try {
    snap = await getDocs(collection(getFirebaseDb(), 'finance_sync', u, 'parts'));
  } catch (e) {
    console.warn('[tf-sync] pull fail (mất mạng / rules?):', e);
    return false;
  }

  // Đọc db local hiện tại (merge với EMPTY_DB cho đủ key mới)
  let local: FinanceDb;
  try {
    const raw = lsGet(DB_KEY);
    local = raw ? { ...EMPTY_DB, ...(JSON.parse(raw) as FinanceDb) } : { ...EMPTY_DB };
  } catch {
    local = { ...EMPTY_DB };
  }

  let changed = false;
  let cloudEmpty = true;
  snap.forEach((d) => {
    cloudEmpty = false;
    const part = d.id;
    const data = d.data() as { payload?: string; updated_at?: number };
    const ts = data.updated_at ?? 0;
    if (ts <= Number(lsGet(SEEN + part) ?? '0')) return; // mây không mới hơn
    if (!data.payload) return;
    let value: unknown;
    try { value = JSON.parse(data.payload); } catch { return; }

    // Local có sửa CHƯA đẩy? — giữ bản local vào khoá conflict trước khi áp mây.
    const localPayload = partPayload(local, part);
    if (lsGet(PUSHED + part) !== null && lsGet(PUSHED + part) !== hash(localPayload)) {
      lsSet(CONFLICT + part, JSON.stringify({ at: Date.now(), payload: localPayload }));
    }

    if (part === 'meta' && value && typeof value === 'object') {
      Object.assign(local, value as Partial<FinanceDb>);
    } else if (Array.isArray(value)) {
      (local as unknown as Record<string, unknown>)[part] = value;
    } else {
      return;
    }
    lsSet(SEEN + part, String(ts));
    lsSet(PUSHED + part, hash(data.payload));
    changed = true;
  });

  if (changed) {
    lsSet(DB_KEY, JSON.stringify(local));
  }
  if (cloudEmpty) {
    // Mây trống mà máy này có dữ liệu → đẩy làm bản đầu tiên.
    scheduleFinancePush(local);
  }
  return changed;
}
