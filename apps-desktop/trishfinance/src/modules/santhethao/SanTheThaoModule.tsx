/**
 * Phase 40.5.A — Module "Quản lý sân thể thao".
 *
 * Quản lý: nhiều sân (pickleball/bóng đá/tennis/cầu lông) + lịch đặt sân + khách quen +
 * doanh thu. LocalStorage key `trishfinance:santhethao_db`.
 *
 * 3 tab:
 *  - Sân: list + thêm/sửa/xóa
 *  - Lịch: chọn ngày → grid sân × khung giờ → bấm slot để đặt
 *  - Doanh thu: tổng tiền theo ngày + theo sân
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Trophy,
  Plus,
  Calendar,
  TrendingUp,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  DollarSign,
  Clock,
  Wallet,
} from 'lucide-react';
import { addLedgerEntry, removeLedgerEntriesByRef, getBankAccounts } from '../../lib/ledger-helper';

// ============================================================
// Types
// ============================================================
type CourtType = 'pickleball' | 'football5' | 'football7' | 'tennis' | 'badminton' | 'other';

interface Court {
  id: string;
  name: string;
  type: CourtType;
  pricePerHour: number;
  note?: string;
  active: boolean;
  createdAt: number;
}

/**
 * Payment status chi tiết (Phase 40.8):
 *  - unpaid: chưa thanh toán + chưa đặt cọc
 *  - deposit: đã đặt cọc, còn nợ phần còn lại
 *  - paid: đã thanh toán đủ
 *  - debt: hết giờ chơi nhưng khách chưa trả → ghi nợ
 *  - cancelled: hủy đặt
 */
type PaymentStatus = 'unpaid' | 'deposit' | 'paid' | 'debt' | 'cancelled';

interface Booking {
  id: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 0-23
  endHour: number; // 0-24
  customerName: string;
  customerPhone?: string;
  totalPrice: number;
  /** Số tiền đã trả (đặt cọc hoặc thanh toán phần) — 0 = chưa trả gì */
  paid: number;
  paymentStatus: PaymentStatus;
  /** Liên kết với Tài chính cá nhân (Phase 40.9): id của entry trong ledger */
  ledgerEntryId?: string;
  note?: string;
  createdAt: number;
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: '⚪ Chưa TT', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  deposit: { label: '💰 Đặt cọc', color: '#92400E', bg: 'rgba(245,158,11,0.18)' },
  paid: { label: '✅ Đã TT đủ', color: '#065F46', bg: 'rgba(16,185,129,0.18)' },
  debt: { label: '⚠ Còn nợ', color: '#991B1B', bg: 'rgba(220,38,38,0.18)' },
  cancelled: { label: '✕ Hủy', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

/**
 * Phase 40.14 — RecurringBooking: khách đặt cố định 1 khung giờ + 1 sân
 * lặp lại mỗi tuần (vd 18h thứ 7 hàng tuần). Auto-generate booking khi mở app.
 */
interface RecurringBooking {
  id: string;
  courtId: string;
  weekday: number; // 0=Sun, 1=Mon, ..., 6=Sat
  startHour: number;
  duration: number;
  customerName: string;
  customerPhone?: string;
  /** Ngày bắt đầu áp dụng (YYYY-MM-DD) */
  startDate: string;
  /** Ngày kết thúc (optional — nếu trống là vô thời hạn) */
  endDate?: string;
  /** Mặc định payment status khi tự generate booking */
  defaultStatus: PaymentStatus;
  /** Mặc định paid (vd khách trả trước cả tháng) */
  defaultPaid?: number;
  note?: string;
  active: boolean;
  createdAt: number;
  /** Ngày cuối cùng đã generate booking → tránh duplicate */
  lastGeneratedDate?: string;
}

interface Db {
  version: string;
  courts: Court[];
  bookings: Booking[];
  recurringBookings?: RecurringBooking[];
}

const DB_KEY = 'trishfinance:santhethao_db';
const DB_VERSION = '1.0.0';
const EMPTY_DB: Db = { version: DB_VERSION, courts: [], bookings: [], recurringBookings: [] };

const WEEKDAY_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEKDAY_LABEL_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const COURT_TYPE_LABEL: Record<CourtType, string> = {
  pickleball: '🏓 Pickleball',
  football5: '⚽ Bóng đá mini 5',
  football7: '⚽ Bóng đá mini 7',
  tennis: '🎾 Tennis',
  badminton: '🏸 Cầu lông',
  other: '🏟 Khác',
};

// ============================================================
// LocalStorage helpers
// ============================================================
function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    const parsed = JSON.parse(raw) as Db;
    const merged = { ...EMPTY_DB, ...parsed };

    // Phase 40.15 — Migration data cũ: booking có `status` (booked/completed/cancelled)
    // → đổi sang `paymentStatus` (unpaid/deposit/paid/debt/cancelled) + thêm `paid` field.
    if (Array.isArray(merged.bookings)) {
      merged.bookings = merged.bookings.map((b: any) => {
        if (b.paymentStatus !== undefined) return b; // đã migrate rồi
        // Schema cũ
        const oldStatus = b.status as string | undefined;
        const oldDeposit = typeof b.deposit === 'number' ? b.deposit : 0;
        let paymentStatus: PaymentStatus = 'unpaid';
        if (oldStatus === 'cancelled') paymentStatus = 'cancelled';
        else if (oldStatus === 'completed' || oldDeposit >= (b.totalPrice ?? 0)) paymentStatus = 'paid';
        else if (oldDeposit > 0) paymentStatus = 'deposit';
        else paymentStatus = 'unpaid';
        return {
          ...b,
          paymentStatus,
          paid: oldDeposit,
        };
      });
    }
    return merged;
  } catch {
    return { ...EMPTY_DB };
  }
}
function saveDb(db: Db): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('[santhethao] save fail:', e);
  }
}
function makeId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function formatMoney(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// Main component
// ============================================================
type Tab = 'courts' | 'calendar' | 'recurring' | 'revenue';

export function SanTheThaoModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('calendar');

  // Phase 40.14 — Auto-generate recurring bookings khi mở module (1 lần / session)
  useEffect(() => {
    const rules = db.recurringBookings ?? [];
    if (rules.length === 0) return;

    const newBookings: Booking[] = [];
    const updatedRules: RecurringBooking[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDays = 14; // generate 2 tuần tới

    for (const rule of rules) {
      if (!rule.active) { updatedRules.push(rule); continue; }
      let lastGen = rule.lastGeneratedDate ? new Date(rule.lastGeneratedDate) : new Date(rule.startDate);
      lastGen.setHours(0, 0, 0, 0);
      const endDate = rule.endDate ? new Date(rule.endDate) : null;
      const horizon = new Date(today.getTime() + horizonDays * 86_400_000);

      // Loop từng ngày từ max(lastGen+1, startDate) → min(horizon, endDate)
      const start = new Date(Math.max(lastGen.getTime() + 86_400_000, new Date(rule.startDate).getTime()));
      start.setHours(0, 0, 0, 0);
      const stop = endDate ? new Date(Math.min(horizon.getTime(), endDate.getTime())) : horizon;

      let cursor = new Date(start);
      let lastDate = rule.lastGeneratedDate;
      while (cursor <= stop) {
        if (cursor.getDay() === rule.weekday) {
          const dateStr = cursor.toISOString().slice(0, 10);
          // Check chưa có booking từ rule này cho ngày này (refId match)
          const exists = (db.bookings || []).some(
            (b) =>
              b.date === dateStr &&
              b.courtId === rule.courtId &&
              b.startHour === rule.startHour &&
              b.customerName === rule.customerName &&
              b.paymentStatus !== 'cancelled',
          );
          if (!exists) {
            const court = db.courts.find((c) => c.id === rule.courtId);
            const totalPrice = (court?.pricePerHour ?? 0) * rule.duration;
            newBookings.push({
              id: makeId(),
              courtId: rule.courtId,
              date: dateStr,
              startHour: rule.startHour,
              endHour: rule.startHour + rule.duration,
              customerName: rule.customerName,
              customerPhone: rule.customerPhone,
              totalPrice,
              paid: rule.defaultPaid ?? 0,
              paymentStatus: rule.defaultStatus,
              note: rule.note ? `[Định kỳ] ${rule.note}` : '[Định kỳ tự tạo]',
              createdAt: Date.now(),
            });
          }
          lastDate = dateStr;
        }
        cursor = new Date(cursor.getTime() + 86_400_000);
      }
      updatedRules.push({ ...rule, lastGeneratedDate: lastDate });
    }

    if (newBookings.length > 0 || updatedRules.some((r, i) => r.lastGeneratedDate !== rules[i]?.lastGeneratedDate)) {
      setDb({
        ...db,
        bookings: [...newBookings, ...db.bookings],
        recurringBookings: updatedRules,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveDb(db);
  }, [db]);

  const stats = useMemo(() => {
    const todayBookings = db.bookings.filter((b) => b.date === todayStr() && b.paymentStatus !== 'cancelled');
    const todayRevenue = todayBookings.reduce((s, b) => s + b.totalPrice, 0);
    return {
      totalCourts: db.courts.filter((c) => c.active).length,
      todayBookings: todayBookings.length,
      todayRevenue,
    };
  }, [db]);

  return (
    <div>
      {/* Header + stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Trophy} label="Sân hoạt động" value={String(stats.totalCourts)} color="#10B981" />
        <StatCard icon={Calendar} label="Đơn hôm nay" value={String(stats.todayBookings)} color="#3B82F6" />
        <StatCard icon={DollarSign} label="Doanh thu hôm nay" value={formatMoney(stats.todayRevenue)} color="#F59E0B" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={Calendar} label="Lịch đặt sân" />
        <TabButton active={tab === 'courts'} onClick={() => setTab('courts')} icon={Trophy} label="Quản lý sân" />
        <TabButton active={tab === 'recurring'} onClick={() => setTab('recurring')} icon={Clock} label="Định kỳ" />
        <TabButton active={tab === 'revenue'} onClick={() => setTab('revenue')} icon={TrendingUp} label="Doanh thu" />
      </div>

      {tab === 'courts' && <CourtsTab db={db} setDb={setDb} />}
      {tab === 'calendar' && <CalendarTab db={db} setDb={setDb} />}
      {tab === 'recurring' && <RecurringTab db={db} setDb={setDb} />}
      {tab === 'revenue' && <RevenueTab db={db} />}
    </div>
  );
}

// ============================================================
// Stat card
// ============================================================
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 20, height: 20, color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: -1,
      }}
    >
      <Icon style={{ width: 14, height: 14 }} /> {label}
    </button>
  );
}

// ============================================================
// Courts tab
// ============================================================
function CourtsTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Court | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);

  function handleSave(court: Court): void {
    if (editing) {
      setDb({ ...db, courts: db.courts.map((c) => (c.id === court.id ? court : c)) });
    } else {
      setDb({ ...db, courts: [court, ...db.courts] });
    }
    setShowForm(false);
    setEditing(null);
  }
  function handleBulkSave(courts: Court[]): void {
    setDb({ ...db, courts: [...courts, ...db.courts] });
    setShowBulkForm(false);
  }
  function handleDelete(id: string): void {
    setDb({ ...db, courts: db.courts.filter((c) => c.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Danh sách sân ({db.courts.length})</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn-secondary" onClick={() => setShowBulkForm(true)}>
            📋 Nhập hàng loạt
          </button>
          <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Thêm 1 sân
          </button>
        </div>
      </div>

      {db.courts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chưa có sân nào — bấm "Thêm sân" để tạo
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {db.courts.map((c) => (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{COURT_TYPE_LABEL[c.type]}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-accent-primary)', fontWeight: 600, marginTop: 4 }}>
                    {formatMoney(c.pricePerHour)}/giờ
                  </div>
                  {c.note && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>📝 {c.note}</div>}
                  <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.active ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.2)', color: c.active ? '#065F46' : 'var(--color-text-muted)' }}>
                    {c.active ? '✓ Hoạt động' : '⊘ Tạm ngưng'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="icon-btn" onClick={() => { setEditing(c); setShowForm(true); }} title="Sửa">
                    <Edit2 style={{ width: 14, height: 14 }} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => handleDelete(c.id)} title="Xóa" style={{ color: '#DC2626' }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <CourtForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
      {showBulkForm && <BulkCourtForm onSave={handleBulkSave} onClose={() => setShowBulkForm(false)} />}
    </div>
  );
}

// ============================================================
// Bulk Court form — nhập nhiều sân 1 lúc
// ============================================================
function BulkCourtForm({ onSave, onClose }: { onSave: (courts: Court[]) => void; onClose: () => void }): JSX.Element {
  const [names, setNames] = useState('Sân 1\nSân 2\nSân 3');
  const [type, setType] = useState<CourtType>('pickleball');
  const [pricePerHour, setPricePerHour] = useState<number>(150000);

  const parsedNames = names.split('\n').map((s) => s.trim()).filter(Boolean);

  function handleSubmit(): void {
    if (parsedNames.length === 0) return;
    const now = Date.now();
    const courts: Court[] = parsedNames.map((name) => ({
      id: makeId(),
      name,
      type,
      pricePerHour: Math.max(0, pricePerHour),
      active: true,
      createdAt: now,
    }));
    onSave(courts);
  }

  return (
    <ModalShell title={`📋 Nhập hàng loạt sân (${parsedNames.length})`} onClose={onClose}>
      <FormField label="Tên các sân (mỗi dòng 1 tên)">
        <textarea
          value={names}
          onChange={(e) => setNames(e.target.value)}
          rows={10}
          className="input"
          placeholder="Sân 1&#10;Sân 2&#10;Sân pickleball A&#10;Sân pickleball B"
          style={{ fontFamily: 'monospace', fontSize: 13, width: '100%', resize: 'vertical' }}
          autoFocus
        />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          💡 Tip: copy-paste từ Excel cũng được. Tên trống / khoảng trắng sẽ tự bỏ qua.
        </div>
      </FormField>
      <FormField label="Loại sân (dùng chung cho tất cả)">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as CourtType)}>
          {(Object.keys(COURT_TYPE_LABEL) as CourtType[]).map((t) => (
            <option key={t} value={t}>{COURT_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Giá thuê / giờ (dùng chung — sửa từng sân sau cũng được)">
        <input className="input" type="number" value={pricePerHour} onChange={(e) => setPricePerHour(Number(e.target.value) || 0)} min={0} step={10000} />
      </FormField>

      <div style={{ padding: 10, background: 'var(--color-surface-row)', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
        Sẽ tạo <strong>{parsedNames.length} sân</strong> với cùng loại + giá. Có thể sửa từng sân ở danh sách sau.
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={parsedNames.length === 0}>
          ✚ Tạo {parsedNames.length} sân
        </button>
      </div>
    </ModalShell>
  );
}

function CourtForm({ initial, onSave, onClose }: { initial: Court | null; onSave: (c: Court) => void; onClose: () => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<CourtType>(initial?.type ?? 'pickleball');
  const [pricePerHour, setPricePerHour] = useState<number>(initial?.pricePerHour ?? 150000);
  const [note, setNote] = useState(initial?.note ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  function handleSubmit(): void {
    if (!name.trim()) return;
    const court: Court = {
      id: initial?.id ?? makeId(),
      name: name.trim(),
      type,
      pricePerHour: Math.max(0, pricePerHour),
      note: note.trim() || undefined,
      active,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    onSave(court);
  }

  return (
    <ModalShell title={initial ? 'Sửa sân' : 'Thêm sân mới'} onClose={onClose}>
      <FormField label="Tên sân">
        <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Sân 1, Sân pickleball A" autoFocus />
      </FormField>
      <FormField label="Loại sân">
        <select className="input" value={type} onChange={(e) => setType(e.target.value as CourtType)}>
          {(Object.keys(COURT_TYPE_LABEL) as CourtType[]).map((t) => (
            <option key={t} value={t}>{COURT_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Giá thuê / giờ (VND)">
        <input className="input" type="number" value={pricePerHour} onChange={(e) => setPricePerHour(Number(e.target.value) || 0)} min={0} step={10000} />
      </FormField>
      <FormField label="Ghi chú">
        <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" />
      </FormField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Sân đang hoạt động (uncheck = tạm ngưng nhận đặt)
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!name.trim()}>
          {initial ? 'Lưu' : 'Tạo sân'}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// Calendar tab — Grid sân × khung giờ
// ============================================================
function CalendarTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [date, setDate] = useState(todayStr());
  const [bookingForm, setBookingForm] = useState<{ courtId: string; startHour: number } | null>(null);
  const [managingBookingId, setManagingBookingId] = useState<string | null>(null);
  const managingBooking = managingBookingId ? db.bookings.find((b) => b.id === managingBookingId) : null;
  const managingCourt = managingBooking ? db.courts.find((c) => c.id === managingBooking.courtId) : null;

  // Khung giờ 6h-23h
  const hours = useMemo(() => Array.from({ length: 18 }, (_, i) => i + 6), []);
  const activeCourts = db.courts.filter((c) => c.active);

  function getBooking(courtId: string, hour: number): Booking | null {
    return (
      db.bookings.find(
        (b) =>
          b.courtId === courtId &&
          b.date === date &&
          b.paymentStatus !== 'cancelled' &&
          hour >= b.startHour &&
          hour < b.endHour,
      ) ?? null
    );
  }

  function handleAddBooking(b: Booking): void {
    setDb({ ...db, bookings: [b, ...db.bookings] });
    // Phase 40.9 — Push thu vào sổ Tài chính cá nhân nếu khách đã trả
    if (b.paid > 0) {
      addLedgerEntry({
        amount: b.paid,
        kind: 'thu',
        category: 'cho_thue',
        description: `Sân thể thao — ${b.customerName} (${db.courts.find((c) => c.id === b.courtId)?.name ?? ''})`,
        source: 'santhethao',
        refId: b.id,
        date: b.date,
      });
    }
    setBookingForm(null);
  }
  function handleCancelBooking(id: string): void {
    setDb({
      ...db,
      bookings: db.bookings.map((b) => (b.id === id ? { ...b, paymentStatus: 'cancelled' as const } : b)),
    });
    removeLedgerEntriesByRef(id);
  }
  function handleUpdatePayment(id: string, paid: number, paymentStatus: PaymentStatus): void {
    const oldBooking = db.bookings.find((b) => b.id === id);
    if (!oldBooking) return;
    setDb({
      ...db,
      bookings: db.bookings.map((b) => (b.id === id ? { ...b, paid, paymentStatus } : b)),
    });
    // Phase 40.9 — Sync ledger: xóa entry cũ, push entry mới với số tiền cập nhật
    removeLedgerEntriesByRef(id);
    if (paid > 0) {
      addLedgerEntry({
        amount: paid,
        kind: 'thu',
        category: 'cho_thue',
        description: `Sân thể thao — ${oldBooking.customerName} (${db.courts.find((c) => c.id === oldBooking.courtId)?.name ?? ''})`,
        source: 'santhethao',
        refId: id,
        date: oldBooking.date,
      });
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngày:</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        <button type="button" className="btn-secondary" onClick={() => setDate(todayStr())} style={{ padding: '6px 10px' }}>Hôm nay</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 6px', background: 'rgba(16,185,129,0.08)', color: '#065F46', borderRadius: 4 }}>🟢 Trống</span>
          <span style={{ padding: '2px 6px', background: PAYMENT_STATUS_LABEL.unpaid.bg, color: PAYMENT_STATUS_LABEL.unpaid.color, borderRadius: 4 }}>{PAYMENT_STATUS_LABEL.unpaid.label}</span>
          <span style={{ padding: '2px 6px', background: PAYMENT_STATUS_LABEL.deposit.bg, color: PAYMENT_STATUS_LABEL.deposit.color, borderRadius: 4 }}>{PAYMENT_STATUS_LABEL.deposit.label}</span>
          <span style={{ padding: '2px 6px', background: PAYMENT_STATUS_LABEL.paid.bg, color: PAYMENT_STATUS_LABEL.paid.color, borderRadius: 4 }}>{PAYMENT_STATUS_LABEL.paid.label}</span>
          <span style={{ padding: '2px 6px', background: PAYMENT_STATUS_LABEL.debt.bg, color: PAYMENT_STATUS_LABEL.debt.color, borderRadius: 4 }}>{PAYMENT_STATUS_LABEL.debt.label}</span>
        </div>
      </div>

      {activeCourts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chưa có sân nào — sang tab "Quản lý sân" để tạo trước
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)' }}>
                <th style={{ padding: 8, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--color-surface-row)', zIndex: 1 }}>Sân</th>
                {hours.map((h) => (
                  <th key={h} style={{ padding: 6, textAlign: 'center', minWidth: 56, fontSize: 11 }}>{String(h).padStart(2, '0')}h</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCourts.map((court) => (
                <tr key={court.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 8, fontWeight: 600, position: 'sticky', left: 0, background: 'var(--color-surface-card)', zIndex: 1 }}>
                    <div>{court.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{COURT_TYPE_LABEL[court.type]}</div>
                  </td>
                  {hours.map((h) => {
                    const b = getBooking(court.id, h);
                    if (b) {
                      const isStart = h === b.startHour;
                      const info = PAYMENT_STATUS_LABEL[b.paymentStatus] ?? PAYMENT_STATUS_LABEL.unpaid;
                      return (
                        <td key={h} style={{ padding: 0, background: info.bg, border: '1px solid var(--color-border-subtle)' }}>
                          {isStart && (
                            <button
                              type="button"
                              onClick={() => setManagingBookingId(b.id)}
                              title={`${b.customerName} · ${b.startHour}-${b.endHour}h · ${formatMoney(b.totalPrice)} · ${info.label}\n(click để quản lý)`}
                              style={{ width: '100%', height: '100%', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, color: info.color, fontWeight: 700 }}
                            >
                              {b.customerName.slice(0, 8)}
                              <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.85 }}>{info.label.split(' ').slice(1).join(' ') || info.label}</div>
                            </button>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td key={h} style={{ padding: 0, border: '1px solid var(--color-border-subtle)' }}>
                        <button
                          type="button"
                          onClick={() => setBookingForm({ courtId: court.id, startHour: h })}
                          style={{ width: '100%', height: 36, padding: 0, background: 'rgba(16,185,129,0.08)', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: 14 }}
                          title="Click để đặt"
                        >
                          +
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bookingForm && (
        <BookingForm
          court={db.courts.find((c) => c.id === bookingForm.courtId)!}
          date={date}
          defaultStartHour={bookingForm.startHour}
          existingBookings={db.bookings.filter((b) => b.date === date && b.paymentStatus !== 'cancelled' && b.courtId === bookingForm.courtId)}
          onSave={handleAddBooking}
          onClose={() => setBookingForm(null)}
        />
      )}

      {managingBooking && managingCourt && (
        <ManageBookingModal
          booking={managingBooking}
          court={managingCourt}
          onUpdate={(paid, status) => { handleUpdatePayment(managingBooking.id, paid, status); setManagingBookingId(null); }}
          onCancel={() => { handleCancelBooking(managingBooking.id); setManagingBookingId(null); }}
          onClose={() => setManagingBookingId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Manage booking modal — update payment / cancel
// ============================================================
function ManageBookingModal({ booking, court, onUpdate, onCancel, onClose }: { booking: Booking; court: Court; onUpdate: (paid: number, status: PaymentStatus) => void; onCancel: () => void; onClose: () => void }): JSX.Element {
  const [paid, setPaid] = useState(booking.paid ?? 0);
  const [status, setStatus] = useState<PaymentStatus>(booking.paymentStatus ?? 'unpaid');
  const remaining = booking.totalPrice - paid;

  return (
    <ModalShell title={`Đơn: ${booking.customerName}`} onClose={onClose}>
      <div style={{ padding: 12, background: 'var(--color-surface-row)', borderRadius: 10, marginBottom: 12, fontSize: 12 }}>
        <div><strong>{court.name}</strong> · {COURT_TYPE_LABEL[court.type]}</div>
        <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>📅 {booking.date} · {String(booking.startHour).padStart(2, '0')}h → {String(booking.endHour).padStart(2, '0')}h</div>
        <div style={{ color: 'var(--color-text-muted)' }}>👤 {booking.customerName}{booking.customerPhone ? ` · ${booking.customerPhone}` : ''}</div>
        <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: 'var(--color-accent-primary)' }}>{formatMoney(booking.totalPrice)}</div>
      </div>

      <FormField label="Khách đã trả (VND)">
        <input className="input" type="number" value={paid} onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))} min={0} step={10000} />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Còn lại: <strong style={{ color: remaining > 0 ? '#DC2626' : '#10B981' }}>{formatMoney(remaining)}</strong>
        </div>
      </FormField>

      <FormField label="Trạng thái thanh toán">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
          <option value="unpaid">⚪ Chưa thanh toán</option>
          <option value="deposit">💰 Đặt cọc — còn nợ</option>
          <option value="paid">✅ Đã thanh toán đủ</option>
          <option value="debt">⚠ Đã chơi xong — còn nợ</option>
        </select>
      </FormField>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" className="btn-secondary" onClick={() => { setPaid(booking.totalPrice); setStatus('paid'); }} style={{ fontSize: 11, padding: '4px 8px' }}>
          ⚡ Thu đủ ngay
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setPaid(booking.totalPrice / 2); setStatus('deposit'); }} style={{ fontSize: 11, padding: '4px 8px' }}>
          ⚡ Đặt cọc 50%
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setPaid(0); setStatus('debt'); }} style={{ fontSize: 11, padding: '4px 8px' }}>
          ⚡ Ghi nợ
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ color: '#DC2626', borderColor: '#DC2626' }}>
          🗑 Hủy đặt sân
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
          <button type="button" className="btn-primary" onClick={() => onUpdate(paid, status)}>💾 Cập nhật</button>
        </div>
      </div>
    </ModalShell>
  );
}

function BookingForm({ court, date, defaultStartHour, existingBookings, onSave, onClose }: { court: Court; date: string; defaultStartHour: number; existingBookings: Booking[]; onSave: (b: Booking) => void; onClose: () => void }): JSX.Element {
  const [startHour, setStartHour] = useState(defaultStartHour);
  const [duration, setDuration] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paid, setPaid] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [note, setNote] = useState('');

  const endHour = startHour + duration;
  const totalPrice = court.pricePerHour * duration;
  const remaining = totalPrice - paid;

  // Auto-update payment status khi paid thay đổi
  useEffect(() => {
    if (paid <= 0) setPaymentStatus('unpaid');
    else if (paid >= totalPrice) setPaymentStatus('paid');
    else setPaymentStatus('deposit');
  }, [paid, totalPrice]);

  const hasConflict = existingBookings.some((b) => !(endHour <= b.startHour || startHour >= b.endHour));

  function handleSubmit(): void {
    if (!customerName.trim() || hasConflict) return;
    const booking: Booking = {
      id: makeId(),
      courtId: court.id,
      date,
      startHour,
      endHour,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      totalPrice,
      paid,
      paymentStatus,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    };
    onSave(booking);
  }

  return (
    <ModalShell title={`Đặt sân: ${court.name}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        📅 {date} · {COURT_TYPE_LABEL[court.type]} · {formatMoney(court.pricePerHour)}/giờ
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField label="Giờ bắt đầu">
          <select className="input" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
            {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </FormField>
        <FormField label="Số giờ">
          <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[1, 1.5, 2, 2.5, 3, 4].map((d) => (
              <option key={d} value={d}>{d}h</option>
            ))}
          </select>
        </FormField>
      </div>
      {hasConflict && (
        <div style={{ padding: 10, background: 'rgba(220,38,38,0.1)', border: '1px solid #DC2626', borderRadius: 8, fontSize: 12, color: '#991B1B', marginTop: 8 }}>
          ⚠ Khung giờ này trùng với đơn khác — chọn giờ/số giờ khác
        </div>
      )}
      <FormField label="Tên khách">
        <input className="input" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nguyễn Văn A" autoFocus />
      </FormField>
      <FormField label="SĐT khách (optional)">
        <input className="input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="09xx..." />
      </FormField>
      <FormField label="Khách đã trả (đặt cọc / thanh toán đủ)">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={() => setPaid(0)} style={{ fontSize: 11, padding: '4px 8px' }}>0đ</button>
          <button type="button" className="btn-secondary" onClick={() => setPaid(Math.round(totalPrice / 2))} style={{ fontSize: 11, padding: '4px 8px' }}>50%</button>
          <button type="button" className="btn-secondary" onClick={() => setPaid(totalPrice)} style={{ fontSize: 11, padding: '4px 8px' }}>Đủ</button>
        </div>
        <input className="input" type="number" value={paid} onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))} min={0} step={50000} />
        {paid > 0 && remaining > 0 && (
          <div style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
            💰 Đặt cọc — còn nợ <strong>{formatMoney(remaining)}</strong>
          </div>
        )}
        {paid >= totalPrice && totalPrice > 0 && (
          <div style={{ fontSize: 11, color: '#065F46', marginTop: 4 }}>
            ✅ Đã thanh toán đủ
          </div>
        )}
      </FormField>
      <FormField label="Ghi chú">
        <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" />
      </FormField>

      <div style={{ padding: 12, background: 'var(--color-surface-row)', borderRadius: 10, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Tổng tiền</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-accent-primary)' }}>{formatMoney(totalPrice)}</div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right' }}>
          {String(startHour).padStart(2, '0')}h → {String(endHour).padStart(2, '0')}h<br />
          ({duration} giờ × {formatMoney(court.pricePerHour)})
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!customerName.trim() || hasConflict}>
          <CheckCircle2 className="h-4 w-4" /> Đặt sân
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// Revenue tab
// ============================================================
function RevenueTab({ db }: { db: Db }): JSX.Element {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayStr());

  const filtered = useMemo(() => {
    return db.bookings.filter((b) => b.paymentStatus !== 'cancelled' && b.date >= fromDate && b.date <= toDate);
  }, [db.bookings, fromDate, toDate]);

  const totalRevenue = filtered.reduce((s, b) => s + b.totalPrice, 0);
  const totalPaid = filtered.reduce((s, b) => s + (b.paid ?? 0), 0);
  const totalDebt = totalRevenue - totalPaid;
  const totalBookings = filtered.length;
  const paidCount = filtered.filter((b) => b.paymentStatus === 'paid').length;
  const debtCount = filtered.filter((b) => b.paymentStatus === 'debt' || b.paymentStatus === 'deposit').length;

  // Group by court
  const byCourt = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const b of filtered) {
      const cur = map.get(b.courtId) ?? { count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += b.totalPrice;
      map.set(b.courtId, cur);
    }
    return Array.from(map.entries())
      .map(([courtId, v]) => ({ court: db.courts.find((c) => c.id === courtId), ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, db.courts]);

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Từ:</label>
        <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 160 }} />
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Đến:</label>
        <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 160 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={DollarSign} label="Tổng doanh thu" value={formatMoney(totalRevenue)} color="#10B981" />
        <StatCard icon={Calendar} label="Tổng đơn" value={`${totalBookings} (${paidCount} đã TT, ${debtCount} nợ)`} color="#3B82F6" />
        <StatCard icon={Clock} label="Đã thu" value={formatMoney(totalPaid)} color="#F59E0B" />
        <StatCard icon={Clock} label="Còn nợ" value={formatMoney(totalDebt)} color={totalDebt > 0 ? '#DC2626' : '#94A3B8'} />
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Doanh thu theo sân</h3>
      {byCourt.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Không có đơn nào trong khoảng thời gian này
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Sân</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Số đơn</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Doanh thu</th>
                <th style={{ padding: 10, textAlign: 'right' }}>% tổng</th>
              </tr>
            </thead>
            <tbody>
              {byCourt.map(({ court, count, revenue }) => (
                <tr key={court?.id ?? 'unknown'} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontWeight: 600 }}>{court?.name ?? '(đã xóa)'}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{court ? COURT_TYPE_LABEL[court.type] : '—'}</div>
                  </td>
                  <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{count}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-accent-primary)' }}>{formatMoney(revenue)}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-muted)' }}>
                    {totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Phase 40.14 — Recurring tab (đặt sân định kỳ hàng tuần)
// ============================================================
function RecurringTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const rules = db.recurringBookings ?? [];
  const [editing, setEditing] = useState<RecurringBooking | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleSave(r: RecurringBooking): void {
    const next = editing
      ? rules.map((x) => (x.id === r.id ? r : x))
      : [r, ...rules];
    setDb({ ...db, recurringBookings: next });
    setShowForm(false);
    setEditing(null);
  }
  function handleDelete(id: string): void {
    setDb({ ...db, recurringBookings: rules.filter((r) => r.id !== id) });
  }
  function handleToggle(id: string): void {
    setDb({
      ...db,
      recurringBookings: rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Đặt sân định kỳ ({rules.length})</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Khách quen đặt cố định 1 khung giờ + sân lặp hàng tuần. Booking tự tạo trước 2 tuần khi mở app.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }} disabled={db.courts.length === 0}>
          <Plus className="h-4 w-4" /> Thêm lịch định kỳ
        </button>
      </div>

      {db.courts.length === 0 && (
        <div className="card" style={{ padding: 18, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 12, color: '#92400E', fontSize: 13 }}>
          ⚠ Chưa có sân — sang tab "Quản lý sân" để tạo trước
        </div>
      )}

      {rules.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chưa có lịch định kỳ nào — bấm "Thêm lịch định kỳ" để tạo
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Khách</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Sân</th>
                <th style={{ padding: 10, textAlign: 'center' }}>Thứ</th>
                <th style={{ padding: 10, textAlign: 'center' }}>Khung giờ</th>
                <th style={{ padding: 10, textAlign: 'left' }}>Hiệu lực</th>
                <th style={{ padding: 10, textAlign: 'center' }}>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const court = db.courts.find((c) => c.id === r.courtId);
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--color-border-subtle)', opacity: r.active ? 1 : 0.5 }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{r.customerName}</div>
                      {r.customerPhone && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>📱 {r.customerPhone}</div>}
                    </td>
                    <td style={{ padding: 10 }}>{court?.name ?? '(đã xóa)'}</td>
                    <td style={{ padding: 10, textAlign: 'center', fontWeight: 700 }}>{WEEKDAY_LABEL[r.weekday]}</td>
                    <td style={{ padding: 10, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {String(r.startHour).padStart(2, '0')}h → {String(r.startHour + r.duration).padStart(2, '0')}h
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{r.duration}h</div>
                    </td>
                    <td style={{ padding: 10, fontSize: 11 }}>
                      <div>Từ: {r.startDate}</div>
                      <div>{r.endDate ? `Đến: ${r.endDate}` : '∞ Vô thời hạn'}</div>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(r.id)}
                        style={{
                          padding: '2px 10px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: r.active ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.2)',
                          color: r.active ? '#065F46' : 'var(--color-text-muted)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {r.active ? '✓ Bật' : '⊘ Tắt'}
                      </button>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right' }}>
                      <button type="button" className="icon-btn" onClick={() => { setEditing(r); setShowForm(true); }} title="Sửa">
                        <Edit2 style={{ width: 14, height: 14 }} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => handleDelete(r.id)} title="Xóa" style={{ color: '#DC2626' }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <RecurringForm initial={editing} courts={db.courts.filter((c) => c.active)} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function RecurringForm({ initial, courts, onSave, onClose }: { initial: RecurringBooking | null; courts: Court[]; onSave: (r: RecurringBooking) => void; onClose: () => void }): JSX.Element {
  const [courtId, setCourtId] = useState(initial?.courtId ?? courts[0]?.id ?? '');
  const [weekday, setWeekday] = useState(initial?.weekday ?? 6); // mặc định T7
  const [startHour, setStartHour] = useState(initial?.startHour ?? 18);
  const [duration, setDuration] = useState(initial?.duration ?? 1);
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayStr());
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [defaultStatus, setDefaultStatus] = useState<PaymentStatus>(initial?.defaultStatus ?? 'unpaid');
  const [defaultPaid, setDefaultPaid] = useState(initial?.defaultPaid ?? 0);
  const [note, setNote] = useState(initial?.note ?? '');

  function handleSubmit(): void {
    if (!courtId || !customerName.trim()) return;
    const rule: RecurringBooking = {
      id: initial?.id ?? makeId(),
      courtId,
      weekday,
      startHour,
      duration,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      startDate,
      endDate: endDate || undefined,
      defaultStatus,
      defaultPaid: defaultPaid > 0 ? defaultPaid : undefined,
      note: note.trim() || undefined,
      active: initial?.active ?? true,
      createdAt: initial?.createdAt ?? Date.now(),
      lastGeneratedDate: initial?.lastGeneratedDate,
    };
    onSave(rule);
  }

  return (
    <ModalShell title={initial ? 'Sửa lịch định kỳ' : 'Tạo lịch định kỳ'} onClose={onClose}>
      <FormField label="Khách">
        <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="VD: Anh A — đội pickleball T7" autoFocus />
      </FormField>
      <FormField label="SĐT (optional)">
        <input className="input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="09xx..." />
      </FormField>
      <FormField label="Sân">
        <select className="input" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          {courts.map((c) => <option key={c.id} value={c.id}>{c.name} — {COURT_TYPE_LABEL[c.type]}</option>)}
        </select>
      </FormField>
      <FormField label="Thứ trong tuần">
        <div style={{ display: 'flex', gap: 4 }}>
          {WEEKDAY_LABEL_FULL.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setWeekday(i)}
              style={{
                flex: 1,
                padding: '8px 4px',
                background: weekday === i ? 'var(--color-accent-primary)' : 'var(--color-surface-row)',
                color: weekday === i ? '#FFF' : 'var(--color-text-primary)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {WEEKDAY_LABEL[i]}
            </button>
          ))}
        </div>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Giờ bắt đầu">
          <select className="input" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
            {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </FormField>
        <FormField label="Số giờ">
          <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[1, 1.5, 2, 2.5, 3, 4].map((d) => <option key={d} value={d}>{d}h</option>)}
          </select>
        </FormField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Bắt đầu áp dụng từ">
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="Đến ngày (trống = ∞)">
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Trạng thái mặc định khi auto tạo">
        <select className="input" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value as PaymentStatus)}>
          <option value="unpaid">⚪ Chưa thu tiền</option>
          <option value="paid">✅ Đã trả trước (vd khách trả cả tháng)</option>
        </select>
      </FormField>
      {defaultStatus === 'paid' && (
        <FormField label="Số tiền trả trước (VND)">
          <input className="input" type="number" value={defaultPaid} onChange={(e) => setDefaultPaid(Number(e.target.value) || 0)} min={0} step={50000} />
        </FormField>
      )}
      <FormField label="Ghi chú">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" />
      </FormField>

      <div style={{ padding: 10, background: 'var(--color-surface-row)', borderRadius: 8, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 12 }}>
        💡 Booking sẽ tự tạo trước 2 tuần khi mở module. Nếu có booking thủ công trùng giờ, hệ thống không tạo trùng.
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!courtId || !customerName.trim()}>
          {initial ? 'Lưu' : '✚ Tạo lịch định kỳ'}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// Modal shell + form field
// ============================================================
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
