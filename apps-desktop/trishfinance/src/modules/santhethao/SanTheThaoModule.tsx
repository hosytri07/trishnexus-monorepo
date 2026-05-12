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
} from 'lucide-react';

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

interface Booking {
  id: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 0-23
  endHour: number; // 0-24
  customerName: string;
  customerPhone?: string;
  totalPrice: number;
  deposit?: number;
  status: 'booked' | 'completed' | 'cancelled';
  note?: string;
  createdAt: number;
}

interface Db {
  version: string;
  courts: Court[];
  bookings: Booking[];
}

const DB_KEY = 'trishfinance:santhethao_db';
const DB_VERSION = '1.0.0';
const EMPTY_DB: Db = { version: DB_VERSION, courts: [], bookings: [] };

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
    return { ...EMPTY_DB, ...parsed };
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
type Tab = 'courts' | 'calendar' | 'revenue';

export function SanTheThaoModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('calendar');

  useEffect(() => {
    saveDb(db);
  }, [db]);

  const stats = useMemo(() => {
    const todayBookings = db.bookings.filter((b) => b.date === todayStr() && b.status !== 'cancelled');
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
        <TabButton active={tab === 'revenue'} onClick={() => setTab('revenue')} icon={TrendingUp} label="Doanh thu" />
      </div>

      {tab === 'courts' && <CourtsTab db={db} setDb={setDb} />}
      {tab === 'calendar' && <CalendarTab db={db} setDb={setDb} />}
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

  function handleSave(court: Court): void {
    if (editing) {
      setDb({ ...db, courts: db.courts.map((c) => (c.id === court.id ? court : c)) });
    } else {
      setDb({ ...db, courts: [court, ...db.courts] });
    }
    setShowForm(false);
    setEditing(null);
  }
  function handleDelete(id: string): void {
    if (!window.confirm) return;
    setDb({ ...db, courts: db.courts.filter((c) => c.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Danh sách sân ({db.courts.length})</h2>
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm sân
        </button>
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
    </div>
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

  // Khung giờ 6h-23h
  const hours = useMemo(() => Array.from({ length: 18 }, (_, i) => i + 6), []);
  const activeCourts = db.courts.filter((c) => c.active);

  function getBooking(courtId: string, hour: number): Booking | null {
    return (
      db.bookings.find(
        (b) =>
          b.courtId === courtId &&
          b.date === date &&
          b.status !== 'cancelled' &&
          hour >= b.startHour &&
          hour < b.endHour,
      ) ?? null
    );
  }

  function handleAddBooking(b: Booking): void {
    setDb({ ...db, bookings: [b, ...db.bookings] });
    setBookingForm(null);
  }
  function handleCancelBooking(id: string): void {
    setDb({
      ...db,
      bookings: db.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)),
    });
  }

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Ngày:</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        <button type="button" className="btn-secondary" onClick={() => setDate(todayStr())} style={{ padding: '6px 10px' }}>Hôm nay</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          🟢 Trống · 🔴 Đã đặt · Click slot để đặt sân
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
                      return (
                        <td key={h} style={{ padding: 0, background: 'rgba(220,38,38,0.18)', border: '1px solid var(--color-border-subtle)' }}>
                          {isStart && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(b.id)}
                              title={`${b.customerName} · ${b.startHour}-${b.endHour}h · ${formatMoney(b.totalPrice)}\n(click để hủy)`}
                              style={{ width: '100%', height: '100%', padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10, color: '#991B1B', fontWeight: 700 }}
                            >
                              {b.customerName.slice(0, 8)}
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
          existingBookings={db.bookings.filter((b) => b.date === date && b.status !== 'cancelled' && b.courtId === bookingForm.courtId)}
          onSave={handleAddBooking}
          onClose={() => setBookingForm(null)}
        />
      )}
    </div>
  );
}

function BookingForm({ court, date, defaultStartHour, existingBookings, onSave, onClose }: { court: Court; date: string; defaultStartHour: number; existingBookings: Booking[]; onSave: (b: Booking) => void; onClose: () => void }): JSX.Element {
  const [startHour, setStartHour] = useState(defaultStartHour);
  const [duration, setDuration] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deposit, setDeposit] = useState(0);
  const [note, setNote] = useState('');

  const endHour = startHour + duration;
  const totalPrice = court.pricePerHour * duration;

  // Check conflict
  const hasConflict = existingBookings.some((b) => {
    return !(endHour <= b.startHour || startHour >= b.endHour);
  });

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
      deposit: deposit > 0 ? deposit : undefined,
      status: 'booked',
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
      <FormField label="Đặt cọc (VND)">
        <input className="input" type="number" value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} min={0} step={50000} />
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
    return db.bookings.filter((b) => b.status !== 'cancelled' && b.date >= fromDate && b.date <= toDate);
  }, [db.bookings, fromDate, toDate]);

  const totalRevenue = filtered.reduce((s, b) => s + b.totalPrice, 0);
  const totalDeposit = filtered.reduce((s, b) => s + (b.deposit ?? 0), 0);
  const totalBookings = filtered.length;

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
        <StatCard icon={Calendar} label="Tổng đơn" value={String(totalBookings)} color="#3B82F6" />
        <StatCard icon={Clock} label="Đã thu cọc" value={formatMoney(totalDeposit)} color="#F59E0B" />
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
