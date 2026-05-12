/**
 * Phase 40.12.A — Module Karaoke.
 *
 * Quản lý: phòng karaoke + đặt phòng theo giờ + tính tiền giờ chơi + đồ uống.
 * LocalStorage `trishfinance:karaoke_db`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Mic, Plus, Edit2, Trash2, X, Music, ShoppingBag, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { addLedgerEntry, removeLedgerEntriesByRef } from '../../lib/ledger-helper';
import { PaymentModal, type PaymentResult } from '../../components/PaymentModal';

type RoomType = 'vip' | 'small' | 'medium' | 'large' | 'family';

interface Room {
  id: string;
  name: string;
  type: RoomType;
  pricePerHour: number;
  capacity: number;
  active: boolean;
}

interface DrinkItem {
  id: string;
  name: string;
  price: number;
  category: 'beer' | 'soft' | 'food' | 'other';
  active: boolean;
}

type PaymentStatus = 'unpaid' | 'paid' | 'debt';
type SessionStatus = 'active' | 'closed';

interface Session {
  id: string;
  roomId: string;
  date: string;
  /** Phase 40.19 — track active session realtime */
  status: SessionStatus;
  /** Unix ms khi mở phòng — dùng để tính thời gian realtime */
  startAt: number;
  /** Unix ms khi đóng phòng + thanh toán (null nếu đang active) */
  endAt?: number;
  startTime: string; // HH:MM hiển thị
  endTime?: string;
  hours: number;
  customerName: string;
  customerPhone?: string;
  drinks: Array<{ drinkId: string; name: string; qty: number; price: number; subtotal: number }>;
  roomCharge: number;
  drinksCharge: number;
  total: number;
  paid: number;
  paymentStatus: PaymentStatus;
  createdAt: number;
}

interface Db {
  version: string;
  rooms: Room[];
  drinks: DrinkItem[];
  sessions: Session[];
}

const DB_KEY = 'trishfinance:karaoke_db';
const EMPTY_DB: Db = {
  version: '1.0.0',
  rooms: [],
  drinks: [
    { id: 'drink_beer', name: 'Bia Tiger', price: 25000, category: 'beer', active: true },
    { id: 'drink_coke', name: 'Coca cola', price: 15000, category: 'soft', active: true },
    { id: 'drink_water', name: 'Nước suối', price: 10000, category: 'soft', active: true },
    { id: 'drink_pn', name: 'Phô mai que', price: 35000, category: 'food', active: true },
  ],
  sessions: [],
};

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  vip: '👑 VIP', small: '🔹 Phòng nhỏ', medium: '🔸 Phòng vừa', large: '🔶 Phòng lớn', family: '👨‍👩‍👧 Gia đình',
};

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    const parsed = JSON.parse(raw) as Db;
    return { ...EMPTY_DB, ...parsed, drinks: parsed.drinks?.length ? parsed.drinks : EMPTY_DB.drinks };
  } catch { return { ...EMPTY_DB }; }
}
function saveDb(db: Db): void { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* */ } }
function makeId(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function formatMoney(n: number): string { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

type Tab = 'active' | 'open' | 'rooms' | 'drinks' | 'history';

export function KaraokeModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('active');

  // Phase 40.19 — Migration: session cũ không có status → mặc định 'closed'
  useEffect(() => {
    const needMigrate = db.sessions.some((s: any) => s.status === undefined);
    if (needMigrate) {
      setDb({
        ...db,
        sessions: db.sessions.map((s: any) => ({
          ...s,
          status: s.status ?? 'closed',
          startAt: s.startAt ?? (s.createdAt ?? Date.now()),
          endAt: s.endAt ?? (s.createdAt ?? Date.now()),
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { saveDb(db); }, [db]);

  const todayRev = db.sessions.filter((s) => s.date === todayStr() && s.paymentStatus !== 'unpaid').reduce((sum, s) => sum + s.paid, 0);
  const debtSessions = db.sessions.filter((s) => s.paymentStatus === 'debt' || (s.paymentStatus === 'unpaid' && s.paid < s.total));
  const activeSessions = db.sessions.filter((s) => s.status === 'active');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Mic} label="Phòng" value={String(db.rooms.filter((r) => r.active).length)} color="#A855F7" />
        <StatCard icon={Clock} label="Đơn hôm nay" value={String(db.sessions.filter((s) => s.date === todayStr()).length)} color="#3B82F6" />
        <StatCard icon={DollarSign} label="Doanh thu hôm nay" value={formatMoney(todayRev)} color="#10B981" />
        <StatCard icon={TrendingUp} label="Còn nợ" value={String(debtSessions.length)} color={debtSessions.length > 0 ? '#DC2626' : '#94A3B8'} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabBtn active={tab === 'active'} onClick={() => setTab('active')} icon={Clock} label={`🟢 Phòng đang hát${activeSessions.length > 0 ? ` (${activeSessions.length})` : ''}`} />
        <TabBtn active={tab === 'open'} onClick={() => setTab('open')} icon={Mic} label="Mở phòng mới" />
        <TabBtn active={tab === 'rooms'} onClick={() => setTab('rooms')} icon={Edit2} label="Quản lý phòng" />
        <TabBtn active={tab === 'drinks'} onClick={() => setTab('drinks')} icon={ShoppingBag} label="Bảng giá đồ uống" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={TrendingUp} label="Lịch sử" />
      </div>

      {tab === 'active' && <ActiveSessionsTab db={db} setDb={setDb} />}
      {tab === 'open' && <OpenRoomTab db={db} setDb={setDb} onOpened={() => setTab('active')} />}
      {tab === 'rooms' && <RoomsTab db={db} setDb={setDb} />}
      {tab === 'drinks' && <DrinksTab db={db} setDb={setDb} />}
      {tab === 'history' && <HistoryTab db={db} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element {
  return (
    <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: 20, height: 20, color }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element {
  return (
    <button type="button" onClick={onClick} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
      <Icon style={{ width: 14, height: 14 }} /> {label}
    </button>
  );
}

// ============================================================
// Phase 40.19 — OpenRoomTab: mở phòng mới (status='active')
// ============================================================
function OpenRoomTab({ db, setDb, onOpened }: { db: Db; setDb: (d: Db) => void; onOpened: () => void }): JSX.Element {
  const [roomId, setRoomId] = useState(db.rooms.find((r) => r.active)?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const busyRoomIds = new Set(db.sessions.filter((s) => s.status === 'active').map((s) => s.roomId));
  const availableRooms = db.rooms.filter((r) => r.active && !busyRoomIds.has(r.id));

  function openRoom(): void {
    if (!roomId || !customerName.trim()) return;
    if (busyRoomIds.has(roomId)) { alert('Phòng này đang có khách'); return; }
    const now = Date.now();
    const startTime = new Date(now).toTimeString().slice(0, 5);
    const session: Session = {
      id: makeId(), roomId, date: todayStr(), status: 'active', startAt: now, startTime,
      hours: 0, customerName: customerName.trim(), customerPhone: customerPhone.trim() || undefined,
      drinks: [], roomCharge: 0, drinksCharge: 0, total: 0, paid: 0, paymentStatus: 'unpaid', createdAt: now,
    };
    setDb({ ...db, sessions: [session, ...db.sessions] });
    setCustomerName(''); setCustomerPhone('');
    onOpened();
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>🎤 Mở phòng cho khách mới</h3>
        {availableRooms.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            {db.rooms.length === 0 ? 'Chưa có phòng — sang tab Quản lý phòng để tạo trước' : '⚠ Tất cả phòng đang có khách — đợi đóng phòng cũ hoặc thêm phòng'}
          </div>
        ) : (
          <>
            <FormField label="Phòng (chỉ hiện phòng trống)">
              <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} — {ROOM_TYPE_LABEL[r.type]} — {formatMoney(r.pricePerHour)}/h</option>
                ))}
              </select>
            </FormField>
            <FormField label="Tên khách">
              <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="VD: Anh A bàn 1" autoFocus />
            </FormField>
            <FormField label="SĐT (optional)">
              <input className="input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="09xx..." />
            </FormField>
            <div style={{ padding: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: 12, color: '#065F46', marginBottom: 12 }}>
              💡 Phòng bắt đầu tính giờ NGAY khi bấm nút bên dưới. Khách xong → vào tab "🟢 Phòng đang hát" → bấm "Đóng phòng & Thanh toán".
            </div>
            <button type="button" className="btn-primary" onClick={openRoom} disabled={!roomId || !customerName.trim()} style={{ width: '100%', justifyContent: 'center', padding: 14, fontWeight: 700, fontSize: 14 }}>
              🎤 MỞ PHÒNG — Bắt đầu tính giờ
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Phase 40.19 — ActiveSessionsTab: phòng đang hát realtime
function ActiveSessionsTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const [managingId, setManagingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const active = db.sessions.filter((s) => s.status === 'active');
  const managing = managingId ? db.sessions.find((s) => s.id === managingId) : null;

  function onAddDrink(drinkId: string): void {
    if (!managing) return;
    const d = db.drinks.find((x) => x.id === drinkId);
    if (!d) return;
    const existing = managing.drinks.find((x) => x.drinkId === drinkId);
    const newDrinks = existing
      ? managing.drinks.map((x) => x.drinkId === drinkId ? { ...x, qty: x.qty + 1, subtotal: (x.qty + 1) * x.price } : x)
      : [...managing.drinks, { drinkId, name: d.name, qty: 1, price: d.price, subtotal: d.price }];
    setDb({ ...db, sessions: db.sessions.map((s) => s.id === managing.id ? { ...s, drinks: newDrinks } : s) });
  }
  function onUpdateDrink(drinkId: string, qty: number): void {
    if (!managing) return;
    const newDrinks = qty <= 0
      ? managing.drinks.filter((x) => x.drinkId !== drinkId)
      : managing.drinks.map((x) => x.drinkId === drinkId ? { ...x, qty, subtotal: qty * x.price } : x);
    setDb({ ...db, sessions: db.sessions.map((s) => s.id === managing.id ? { ...s, drinks: newDrinks } : s) });
  }
  function onCloseSession(paid: number): void {
    if (!managing) return;
    const room = db.rooms.find((r) => r.id === managing.roomId);
    const endAt = Date.now();
    const elapsedHours = (endAt - managing.startAt) / 3_600_000;
    const roomCharge = (room?.pricePerHour ?? 0) * elapsedHours;
    const drinksCharge = managing.drinks.reduce((s, x) => s + x.subtotal, 0);
    const total = roomCharge + drinksCharge;
    const endTime = new Date(endAt).toTimeString().slice(0, 5);
    const closed: Session = {
      ...managing, status: 'closed', endAt, endTime, hours: elapsedHours,
      roomCharge, drinksCharge, total, paid,
      paymentStatus: paid >= total ? 'paid' : paid > 0 ? 'unpaid' : 'debt',
    };
    setDb({ ...db, sessions: db.sessions.map((s) => s.id === managing.id ? closed : s) });
    if (paid > 0 && room) {
      addLedgerEntry({
        amount: Math.min(paid, total),
        kind: 'thu',
        category: 'kinh_doanh',
        description: `Karaoke — ${managing.customerName} · ${room.name} (${elapsedHours.toFixed(1)}h)`,
        source: 'karaoke' as any,
        refId: managing.id,
        date: managing.date,
      });
    }
    setManagingId(null);
  }

  return (
    <div>
      {active.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Mic style={{ width: 36, height: 36, color: 'var(--color-text-muted)', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Chưa có phòng nào đang hát</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Sang tab "Mở phòng mới" để bắt đầu</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {active.map((s) => {
            const room = db.rooms.find((r) => r.id === s.roomId);
            const elapsedMin = (now - s.startAt) / 60_000;
            const elapsedHours = elapsedMin / 60;
            const elapsedRoomCharge = (room?.pricePerHour ?? 0) * elapsedHours;
            const drinksTotal = s.drinks.reduce((sum, d) => sum + d.subtotal, 0);
            const currentTotal = elapsedRoomCharge + drinksTotal;
            return (
              <button key={s.id} type="button" onClick={() => setManagingId(s.id)} className="card" style={{ padding: 14, textAlign: 'left', cursor: 'pointer', background: 'linear-gradient(135deg, rgba(168,85,247,0.05), rgba(16,185,129,0.05))', border: '1px solid rgba(168,85,247,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 0 4px rgba(16,185,129,0.2)' }} />
                  <strong style={{ color: '#065F46', fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>ĐANG HÁT</strong>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{room?.name ?? '?'}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>👤 {s.customerName}</div>
                <div style={{ marginTop: 10, padding: 10, background: 'var(--color-surface-row)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Mở lúc:</span><strong>{s.startTime}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Đã hát:</span>
                    <strong style={{ color: 'var(--color-accent-primary)' }}>{Math.floor(elapsedMin / 60)}h{String(Math.floor(elapsedMin % 60)).padStart(2, '0')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Đồ uống:</span>
                    <strong>{s.drinks.length} món · {formatMoney(drinksTotal)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>Tạm tính:</span>
                    <strong style={{ fontSize: 16, color: 'var(--color-accent-primary)', fontWeight: 800 }}>{formatMoney(currentTotal)}</strong>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  → Click để gọi đồ / đóng phòng
                </div>
              </button>
            );
          })}
        </div>
      )}

      {managing && (
        <ActiveSessionModal
          session={managing}
          room={db.rooms.find((r) => r.id === managing.roomId)!}
          allDrinks={db.drinks}
          onAddDrink={onAddDrink}
          onUpdateDrink={onUpdateDrink}
          onCloseSession={onCloseSession}
          onClose={() => setManagingId(null)}
        />
      )}
    </div>
  );
}

function ActiveSessionModal({ session, room, allDrinks, onAddDrink, onUpdateDrink, onCloseSession, onClose }: {
  session: Session; room: Room; allDrinks: DrinkItem[];
  onAddDrink: (drinkId: string) => void;
  onUpdateDrink: (drinkId: string, qty: number) => void;
  onCloseSession: (paid: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const [showPayment, setShowPayment] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedMs = now - session.startAt;
  const elapsedHours = elapsedMs / 3_600_000;
  const elapsedMin = elapsedMs / 60_000;
  const roomCharge = room.pricePerHour * elapsedHours;
  const drinksCharge = session.drinks.reduce((s, x) => s + x.subtotal, 0);
  const total = roomCharge + drinksCharge;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 720, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: 0 }}>
        <div style={{ padding: 18, background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(16,185,129,0.06))', borderRadius: '14px 14px 0 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, color: '#065F46', fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>🟢 ĐANG HÁT</div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{room.name}</h2>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>👤 {session.customerName} · Mở {session.startTime}</div>
            </div>
            <button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div style={{ padding: 10, background: 'var(--color-surface-card)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Đã hát</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-accent-primary)', marginTop: 2 }}>{Math.floor(elapsedMin / 60)}h{String(Math.floor(elapsedMin % 60)).padStart(2, '0')}</div>
            </div>
            <div style={{ padding: 10, background: 'var(--color-surface-card)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Phòng</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{formatMoney(roomCharge)}</div>
            </div>
            <div style={{ padding: 10, background: 'var(--color-surface-card)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tổng tạm</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', marginTop: 2 }}>{formatMoney(total)}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>🍹 Gọi thêm</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
              {allDrinks.filter((d) => d.active).map((d) => (
                <button key={d.id} type="button" onClick={() => onAddDrink(d.id)} style={{ padding: 8, background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, cursor: 'pointer', fontSize: 10, color: 'var(--color-text-primary)', textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ color: 'var(--color-accent-primary)', fontWeight: 700, marginTop: 2 }}>{formatMoney(d.price)}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 0, marginBottom: 8 }}>🧾 Đã gọi ({session.drinks.length})</h3>
            {session.drinks.length === 0 ? (
              <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>Chưa gọi gì</div>
            ) : session.drinks.map((it) => (
              <div key={it.drinkId} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 0' }}>
                <div style={{ flex: 1, minWidth: 0 }}>{it.name}</div>
                <button className="icon-btn" onClick={() => onUpdateDrink(it.drinkId, it.qty - 1)} style={{ padding: 2 }}>−</button>
                <span style={{ width: 20, textAlign: 'center', fontWeight: 600 }}>{it.qty}</span>
                <button className="icon-btn" onClick={() => onUpdateDrink(it.drinkId, it.qty + 1)} style={{ padding: 2 }}>+</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, borderTop: '1px solid var(--color-border-subtle)' }}>
          <button type="button" className="btn-primary" onClick={() => setShowPayment(true)} style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, justifyContent: 'center' }}>
            💳 Đóng phòng & Thanh toán {formatMoney(total)}
          </button>
        </div>

        {showPayment && (
          <PaymentModal
            total={total}
            description={`Karaoke ${room.name} ${elapsedHours.toFixed(1)}h`}
            customerName={session.customerName}
            onConfirm={(result) => { setShowPayment(false); onCloseSession(result.paid); }}
            onClose={() => setShowPayment(false)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// @deprecated Phase 40.19 — PosTab cũ giữ lại không dùng (sẽ xóa phiên sau)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PosTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [roomId, setRoomId] = useState(db.rooms.find((r) => r.active)?.id ?? '');
  const [hours, setHours] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [drinkItems, setDrinkItems] = useState<Array<{ drinkId: string; qty: number }>>([]);
  const [paid, setPaid] = useState(0);
  const [showPayment, setShowPayment] = useState(false);

  const room = db.rooms.find((r) => r.id === roomId);
  const roomCharge = (room?.pricePerHour ?? 0) * hours;
  const drinksList = drinkItems.map((it) => {
    const d = db.drinks.find((x) => x.id === it.drinkId)!;
    return { drinkId: it.drinkId, name: d.name, qty: it.qty, price: d.price, subtotal: d.price * it.qty };
  });
  const drinksCharge = drinksList.reduce((s, x) => s + x.subtotal, 0);
  const total = roomCharge + drinksCharge;

  function addDrink(id: string): void {
    const exist = drinkItems.find((x) => x.drinkId === id);
    if (exist) setDrinkItems(drinkItems.map((x) => x.drinkId === id ? { ...x, qty: x.qty + 1 } : x));
    else setDrinkItems([...drinkItems, { drinkId: id, qty: 1 }]);
  }
  function updateDrinkQty(id: string, qty: number): void {
    if (qty <= 0) setDrinkItems(drinkItems.filter((x) => x.drinkId !== id));
    else setDrinkItems(drinkItems.map((x) => x.drinkId === id ? { ...x, qty } : x));
  }

  function handleCheckout(): void {
    if (!room || !customerName.trim()) return;
    const finalPaid = paid || total;
    const status: PaymentStatus = finalPaid >= total ? 'paid' : finalPaid > 0 ? 'unpaid' : 'unpaid';
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const endTimeDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const endTime = `${String(endTimeDate.getHours()).padStart(2, '0')}:${String(endTimeDate.getMinutes()).padStart(2, '0')}`;

    const session: Session = {
      id: makeId(),
      roomId,
      date: todayStr(),
      startTime,
      endTime,
      hours,
      customerName: customerName.trim(),
      drinks: drinksList,
      roomCharge,
      drinksCharge,
      total,
      paid: finalPaid,
      paymentStatus: status,
      createdAt: Date.now(),
    };
    setDb({ ...db, sessions: [session, ...db.sessions] });

    if (finalPaid > 0) {
      addLedgerEntry({
        amount: Math.min(finalPaid, total),
        kind: 'thu',
        category: 'kinh_doanh',
        description: `Karaoke — ${customerName} · ${room.name} (${hours}h)`,
        source: 'karaoke' as any,
        refId: session.id,
        date: session.date,
      });
    }

    setCustomerName('');
    setDrinkItems([]);
    setPaid(0);
    setHours(2);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>Đặt phòng</h3>
        <FormField label="Phòng">
          <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {db.rooms.filter((r) => r.active).map((r) => (
              <option key={r.id} value={r.id}>{r.name} — {ROOM_TYPE_LABEL[r.type]} — {formatMoney(r.pricePerHour)}/h</option>
            ))}
          </select>
        </FormField>
        <FormField label="Số giờ chơi">
          <input className="input" type="number" value={hours} min={1} max={24} onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))} />
        </FormField>
        <FormField label="Tên khách">
          <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Khách lẻ" />
        </FormField>

        <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 8 }}>🍹 Gọi đồ uống / món ăn</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
          {db.drinks.filter((d) => d.active).map((d) => (
            <button key={d.id} type="button" onClick={() => addDrink(d.id)} style={{ padding: 8, background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: 'var(--color-text-primary)', textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>{d.name}</div>
              <div style={{ color: 'var(--color-accent-primary)', fontWeight: 700, marginTop: 2 }}>{formatMoney(d.price)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 14, position: 'sticky', top: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>🧾 Hóa đơn</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
          <span>Phòng × {hours}h</span><span style={{ fontWeight: 600 }}>{formatMoney(roomCharge)}</span>
        </div>
        {drinksList.map((it) => (
          <div key={it.drinkId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
            <div style={{ flex: 1 }}>{it.name}</div>
            <button className="icon-btn" onClick={() => updateDrinkQty(it.drinkId, it.qty - 1)} style={{ padding: 2 }}>−</button>
            <span style={{ width: 24, textAlign: 'center', fontWeight: 600 }}>{it.qty}</span>
            <button className="icon-btn" onClick={() => updateDrinkQty(it.drinkId, it.qty + 1)} style={{ padding: 2 }}>+</button>
            <span style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>{formatMoney(it.subtotal)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>TỔNG</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent-primary)' }}>{formatMoney(total)}</span>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowPayment(true)} disabled={!room || !customerName.trim() || total <= 0} style={{ width: '100%', justifyContent: 'center', padding: 12, fontWeight: 700 }}>
          💳 Thanh toán {formatMoney(total)}
        </button>
        {showPayment && (
          <PaymentModal
            total={total}
            description={`Karaoke ${room?.name ?? ''} ${hours}h`}
            customerName={customerName}
            onConfirm={(result) => { setPaid(result.paid); setShowPayment(false); setTimeout(() => handleCheckout(), 50); }}
            onClose={() => setShowPayment(false)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
function RoomsTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Room | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleSave(r: Room): void {
    setDb(editing ? { ...db, rooms: db.rooms.map((x) => x.id === r.id ? r : x) } : { ...db, rooms: [r, ...db.rooms] });
    setShowForm(false); setEditing(null);
  }
  function handleDelete(id: string): void { setDb({ ...db, rooms: db.rooms.filter((r) => r.id !== id) }); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Phòng karaoke ({db.rooms.length})</h2>
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Thêm phòng</button>
      </div>
      {db.rooms.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Chưa có phòng — bấm "Thêm phòng" để tạo</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {db.rooms.map((r) => (
            <div key={r.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ROOM_TYPE_LABEL[r.type]}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-accent-primary)', fontWeight: 600, marginTop: 4 }}>{formatMoney(r.pricePerHour)}/h</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>👥 {r.capacity} người</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="icon-btn" onClick={() => { setEditing(r); setShowForm(true); }}><Edit2 style={{ width: 14, height: 14 }} /></button>
                  <button className="icon-btn" onClick={() => handleDelete(r.id)} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <RoomForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function RoomForm({ initial, onSave, onClose }: { initial: Room | null; onSave: (r: Room) => void; onClose: () => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<RoomType>(initial?.type ?? 'medium');
  const [pricePerHour, setPricePerHour] = useState(initial?.pricePerHour ?? 200000);
  const [capacity, setCapacity] = useState(initial?.capacity ?? 8);
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <ModalShell title={initial ? 'Sửa phòng' : 'Thêm phòng'} onClose={onClose}>
      <FormField label="Tên phòng"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phòng 101" autoFocus /></FormField>
      <FormField label="Loại"><select className="input" value={type} onChange={(e) => setType(e.target.value as RoomType)}>{(Object.keys(ROOM_TYPE_LABEL) as RoomType[]).map((t) => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}</select></FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Giá / giờ (VND)"><input className="input" type="number" value={pricePerHour} onChange={(e) => setPricePerHour(Number(e.target.value) || 0)} min={0} step={10000} /></FormField>
        <FormField label="Sức chứa"><input className="input" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 0)} min={1} /></FormField>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Phòng đang hoạt động</label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={() => name.trim() && onSave({ id: initial?.id ?? makeId(), name: name.trim(), type, pricePerHour, capacity, active })} disabled={!name.trim()}>{initial ? 'Lưu' : 'Tạo'}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
function DrinksTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<DrinkItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Đồ uống / Món ăn ({db.drinks.length})</h2>
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Thêm món</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
            <th style={{ padding: 10, textAlign: 'left' }}>Tên</th><th style={{ padding: 10, textAlign: 'left' }}>Loại</th><th style={{ padding: 10, textAlign: 'right' }}>Giá</th><th style={{ padding: 10, textAlign: 'right' }}></th>
          </tr></thead>
          <tbody>{db.drinks.map((d) => (
            <tr key={d.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{d.name}</td>
              <td style={{ padding: 10, color: 'var(--color-text-muted)' }}>{d.category}</td>
              <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: 'var(--color-accent-primary)' }}>{formatMoney(d.price)}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>
                <button className="icon-btn" onClick={() => { setEditing(d); setShowForm(true); }}><Edit2 style={{ width: 14, height: 14 }} /></button>
                <button className="icon-btn" onClick={() => setDb({ ...db, drinks: db.drinks.filter((x) => x.id !== d.id) })} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {showForm && (
        <ModalShell title={editing ? 'Sửa món' : 'Thêm món'} onClose={() => { setShowForm(false); setEditing(null); }}>
          <DrinkForm initial={editing} onSave={(item) => {
            setDb(editing ? { ...db, drinks: db.drinks.map((x) => x.id === item.id ? item : x) } : { ...db, drinks: [item, ...db.drinks] });
            setShowForm(false); setEditing(null);
          }} />
        </ModalShell>
      )}
    </div>
  );
}

function DrinkForm({ initial, onSave }: { initial: DrinkItem | null; onSave: (d: DrinkItem) => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial?.price ?? 25000);
  const [category, setCategory] = useState<DrinkItem['category']>(initial?.category ?? 'beer');
  const [active, setActive] = useState(initial?.active ?? true);
  return (
    <>
      <FormField label="Tên"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
      <FormField label="Loại"><select className="input" value={category} onChange={(e) => setCategory(e.target.value as DrinkItem['category'])}>
        <option value="beer">🍺 Bia / Rượu</option><option value="soft">🥤 Nước ngọt</option><option value="food">🍕 Đồ ăn</option><option value="other">Khác</option>
      </select></FormField>
      <FormField label="Giá (VND)"><input className="input" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} min={0} step={5000} /></FormField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang bán</label>
      <button type="button" className="btn-primary" onClick={() => name.trim() && onSave({ id: initial?.id ?? makeId(), name: name.trim(), price, category, active })} style={{ marginTop: 12 }}>{initial ? 'Lưu' : 'Tạo'}</button>
    </>
  );
}

// ============================================================
function HistoryTab({ db }: { db: Db }): JSX.Element {
  const sessions = [...db.sessions].slice(0, 100);
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Lịch sử ({db.sessions.length})</h2>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>Ngày</th><th style={{ padding: 8, textAlign: 'left' }}>Phòng</th><th style={{ padding: 8, textAlign: 'left' }}>Khách</th><th style={{ padding: 8, textAlign: 'left' }}>Giờ</th><th style={{ padding: 8, textAlign: 'right' }}>Tổng</th><th style={{ padding: 8, textAlign: 'right' }}>Đã thu</th>
          </tr></thead>
          <tbody>{sessions.map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 8 }}>{s.date}</td>
              <td style={{ padding: 8 }}>{db.rooms.find((r) => r.id === s.roomId)?.name ?? '?'}</td>
              <td style={{ padding: 8 }}>{s.customerName}</td>
              <td style={{ padding: 8 }}>{s.startTime}→{s.endTime} ({s.hours}h)</td>
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{formatMoney(s.total)}</td>
              <td style={{ padding: 8, textAlign: 'right', color: s.paid >= s.total ? '#10B981' : '#DC2626' }}>{formatMoney(s.paid)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>{children}</div>;
}
