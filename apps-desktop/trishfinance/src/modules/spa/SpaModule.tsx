/**
 * Phase 40.12.B — Module Spa / Salon.
 *
 * Quản lý: dịch vụ (cắt/gội/nhuộm/massage) + nhân viên + lịch hẹn (đơn giản) +
 * thẻ thành viên + tính tiền. LocalStorage `trishfinance:spa_db`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, Edit2, Trash2, X, User, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { addLedgerEntry } from '../../lib/ledger-helper';

type ServiceCategory = 'haircut' | 'wash' | 'dye' | 'massage' | 'nail' | 'facial' | 'other';

interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  durationMin: number;
  active: boolean;
}

interface Staff {
  id: string;
  name: string;
  phone?: string;
  speciality?: string;
  active: boolean;
}

interface Appointment {
  id: string;
  date: string;
  time: string; // HH:MM
  customerName: string;
  customerPhone?: string;
  services: Array<{ serviceId: string; name: string; price: number }>;
  staffId?: string;
  total: number;
  paid: number;
  status: 'booked' | 'paid' | 'cancelled';
  membershipDiscount?: number;
  note?: string;
  createdAt: number;
}

interface Member {
  id: string;
  cardNumber: string;
  name: string;
  phone?: string;
  discountPercent: number;
  balance: number;
  createdAt: number;
}

interface Db {
  version: string;
  services: Service[];
  staff: Staff[];
  appointments: Appointment[];
  members: Member[];
}

const DB_KEY = 'trishfinance:spa_db';
const EMPTY_DB: Db = {
  version: '1.0.0',
  services: [
    { id: 'svc_haircut', name: 'Cắt tóc nam', category: 'haircut', price: 80000, durationMin: 30, active: true },
    { id: 'svc_haircutw', name: 'Cắt tóc nữ', category: 'haircut', price: 120000, durationMin: 45, active: true },
    { id: 'svc_wash', name: 'Gội đầu massage', category: 'wash', price: 80000, durationMin: 30, active: true },
    { id: 'svc_nail', name: 'Sơn móng cơ bản', category: 'nail', price: 150000, durationMin: 60, active: true },
  ],
  staff: [],
  appointments: [],
  members: [],
};

const SERVICE_CAT_LABEL: Record<ServiceCategory, string> = {
  haircut: '✂️ Cắt tóc', wash: '🚿 Gội', dye: '🎨 Nhuộm', massage: '💆 Massage', nail: '💅 Nail', facial: '🧖 Chăm da', other: '🔧 Khác',
};

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    const p = JSON.parse(raw) as Db;
    return { ...EMPTY_DB, ...p, services: p.services?.length ? p.services : EMPTY_DB.services };
  } catch { return { ...EMPTY_DB }; }
}
function saveDb(db: Db): void { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* */ } }
function makeId(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function fm(n: number): string { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

type Tab = 'pos' | 'services' | 'staff' | 'members' | 'history';

export function SpaModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('pos');
  useEffect(() => { saveDb(db); }, [db]);

  const today = db.appointments.filter((a) => a.date === todayStr() && a.status !== 'cancelled');
  const todayRev = today.reduce((s, a) => s + a.paid, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat icon={Sparkles} label="Dịch vụ" value={String(db.services.filter((s) => s.active).length)} color="#EC4899" />
        <Stat icon={User} label="Nhân viên" value={String(db.staff.filter((s) => s.active).length)} color="#3B82F6" />
        <Stat icon={Calendar} label="Hôm nay" value={String(today.length)} color="#F59E0B" />
        <Stat icon={DollarSign} label="Doanh thu hôm nay" value={fm(todayRev)} color="#10B981" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabBtn active={tab === 'pos'} onClick={() => setTab('pos')} icon={Sparkles} label="Tính tiền" />
        <TabBtn active={tab === 'services'} onClick={() => setTab('services')} icon={Edit2} label="Dịch vụ" />
        <TabBtn active={tab === 'staff'} onClick={() => setTab('staff')} icon={User} label="Nhân viên" />
        <TabBtn active={tab === 'members'} onClick={() => setTab('members')} icon={User} label="Thẻ thành viên" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={TrendingUp} label="Lịch sử" />
      </div>

      {tab === 'pos' && <PosTab db={db} setDb={setDb} />}
      {tab === 'services' && <SimpleListTab title="Dịch vụ" items={db.services} db={db} setDb={setDb} field="services" makeNew={(): Service => ({ id: makeId(), name: '', category: 'haircut', price: 100000, durationMin: 30, active: true })} renderRow={(s: Service) => <><td style={{ padding: 10, fontWeight: 600 }}>{s.name}</td><td style={{ padding: 10 }}>{SERVICE_CAT_LABEL[s.category]}</td><td style={{ padding: 10 }}>{s.durationMin}p</td><td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: 'var(--color-accent-primary)' }}>{fm(s.price)}</td></>} renderForm={(s: Service, setS: any) => <>
        <FormField label="Tên"><input className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus /></FormField>
        <FormField label="Loại"><select className="input" value={s.category} onChange={(e) => setS({ ...s, category: e.target.value })}>{(Object.keys(SERVICE_CAT_LABEL) as ServiceCategory[]).map((c) => <option key={c} value={c}>{SERVICE_CAT_LABEL[c]}</option>)}</select></FormField>
        <FormField label="Giá (VND)"><input className="input" type="number" value={s.price} onChange={(e) => setS({ ...s, price: Number(e.target.value) || 0 })} min={0} step={10000} /></FormField>
        <FormField label="Thời gian (phút)"><input className="input" type="number" value={s.durationMin} onChange={(e) => setS({ ...s, durationMin: Number(e.target.value) || 0 })} min={1} /></FormField>
      </>} headers={['Tên', 'Loại', 'TG', 'Giá']} />}
      {tab === 'staff' && <SimpleListTab title="Nhân viên" items={db.staff} db={db} setDb={setDb} field="staff" makeNew={(): Staff => ({ id: makeId(), name: '', active: true })} renderRow={(s: Staff) => <><td style={{ padding: 10, fontWeight: 600 }}>{s.name}</td><td style={{ padding: 10 }}>{s.speciality ?? '—'}</td><td style={{ padding: 10 }}>{s.phone ?? '—'}</td></>} renderForm={(s: Staff, setS: any) => <>
        <FormField label="Tên"><input className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus /></FormField>
        <FormField label="SĐT"><input className="input" value={s.phone ?? ''} onChange={(e) => setS({ ...s, phone: e.target.value })} /></FormField>
        <FormField label="Chuyên môn"><input className="input" value={s.speciality ?? ''} onChange={(e) => setS({ ...s, speciality: e.target.value })} placeholder="VD: Tóc nữ, Nail" /></FormField>
      </>} headers={['Tên', 'Chuyên môn', 'SĐT']} />}
      {tab === 'members' && <MembersTab db={db} setDb={setDb} />}
      {tab === 'history' && <HistoryTab db={db} />}
    </div>
  );
}

function PosTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [items, setItems] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [paid, setPaid] = useState(0);

  const services = items.map((id) => db.services.find((s) => s.id === id)!).filter(Boolean);
  const subtotal = services.reduce((s, x) => s + x.price, 0);
  const member = memberId ? db.members.find((m) => m.id === memberId) : null;
  const discount = member ? Math.round((subtotal * member.discountPercent) / 100) : 0;
  const total = subtotal - discount;

  function handleCheckout(): void {
    if (services.length === 0 || !customerName.trim()) return;
    const finalPaid = paid || total;
    const appt: Appointment = {
      id: makeId(), date: todayStr(), time: new Date().toTimeString().slice(0, 5), customerName: customerName.trim(),
      services: services.map((s) => ({ serviceId: s.id, name: s.name, price: s.price })),
      staffId: staffId || undefined, total, paid: finalPaid, status: finalPaid >= total ? 'paid' : 'booked',
      membershipDiscount: discount || undefined, createdAt: Date.now(),
    };
    setDb({ ...db, appointments: [appt, ...db.appointments] });
    addLedgerEntry({ amount: Math.min(finalPaid, total), kind: 'thu', category: 'kinh_doanh', description: `Spa — ${customerName} (${services.map((s) => s.name).join(', ')})`, source: 'spa' as any, refId: appt.id, date: appt.date });
    setItems([]); setCustomerName(''); setMemberId(''); setStaffId(''); setPaid(0);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>Chọn dịch vụ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {db.services.filter((s) => s.active).map((s) => (
            <button key={s.id} type="button" onClick={() => setItems([...items, s.id])} style={{ padding: 10, background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text-primary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{SERVICE_CAT_LABEL[s.category]}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-accent-primary)', fontWeight: 700, marginTop: 4 }}>{fm(s.price)} · {s.durationMin}p</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>🧾 Hóa đơn</h3>
        {services.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>{s.name}</div>
            <span style={{ fontWeight: 600 }}>{fm(s.price)}</span>
            <button className="icon-btn" onClick={() => setItems(items.filter((_, idx) => idx !== i))} style={{ padding: 2, marginLeft: 4 }}><X style={{ width: 12, height: 12 }} /></button>
          </div>
        ))}
        <FormField label="Khách"><input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></FormField>
        <FormField label="Thẻ thành viên (nếu có)">
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">— Khách lẻ —</option>
            {db.members.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.cardNumber}) - giảm {m.discountPercent}%</option>)}
          </select>
        </FormField>
        <FormField label="Nhân viên thực hiện">
          <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">— Chưa chỉ định —</option>
            {db.staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}{s.speciality ? ` (${s.speciality})` : ''}</option>)}
          </select>
        </FormField>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>Tạm tính</span><span>{fm(subtotal)}</span></div>
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#10B981' }}><span>Giảm {member?.discountPercent}%</span><span>−{fm(discount)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}><span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>TỔNG</span><span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent-primary)' }}>{fm(total)}</span></div>
        </div>
        <FormField label="Khách trả"><input className="input" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} placeholder={String(total)} /></FormField>
        <button type="button" className="btn-primary" onClick={handleCheckout} disabled={services.length === 0 || !customerName.trim()} style={{ width: '100%', justifyContent: 'center', padding: 12, fontWeight: 700 }}>✓ Thanh toán {fm(total)}</button>
      </div>
    </div>
  );
}

function MembersTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''); const [cardNumber, setCardNumber] = useState(''); const [phone, setPhone] = useState(''); const [discountPercent, setDiscountPercent] = useState(10); const [balance, setBalance] = useState(0);

  function reset() { setName(''); setCardNumber(''); setPhone(''); setDiscountPercent(10); setBalance(0); setEditing(null); }
  function startEdit(m: Member) { setEditing(m); setName(m.name); setCardNumber(m.cardNumber); setPhone(m.phone ?? ''); setDiscountPercent(m.discountPercent); setBalance(m.balance); setShowForm(true); }
  function save() {
    if (!name.trim() || !cardNumber.trim()) return;
    const m: Member = { id: editing?.id ?? makeId(), name: name.trim(), cardNumber: cardNumber.trim().toUpperCase(), phone: phone.trim() || undefined, discountPercent, balance, createdAt: editing?.createdAt ?? Date.now() };
    setDb(editing ? { ...db, members: db.members.map((x) => x.id === m.id ? m : x) } : { ...db, members: [m, ...db.members] });
    setShowForm(false); reset();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Thẻ thành viên ({db.members.length})</h2>
        <button type="button" className="btn-primary" onClick={() => { reset(); setShowForm(true); }}><Plus className="h-4 w-4" /> Thêm thẻ</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}>
            <th style={{ padding: 10, textAlign: 'left' }}>Tên</th><th style={{ padding: 10, textAlign: 'left' }}>Mã thẻ</th><th style={{ padding: 10, textAlign: 'left' }}>SĐT</th><th style={{ padding: 10, textAlign: 'right' }}>Giảm</th><th style={{ padding: 10, textAlign: 'right' }}>Số dư</th><th></th>
          </tr></thead>
          <tbody>{db.members.map((m) => (
            <tr key={m.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{m.name}</td>
              <td style={{ padding: 10, fontFamily: 'monospace' }}>{m.cardNumber}</td>
              <td style={{ padding: 10 }}>{m.phone ?? '—'}</td>
              <td style={{ padding: 10, textAlign: 'right', color: '#10B981', fontWeight: 700 }}>{m.discountPercent}%</td>
              <td style={{ padding: 10, textAlign: 'right' }}>{fm(m.balance)}</td>
              <td style={{ padding: 10 }}>
                <button className="icon-btn" onClick={() => startEdit(m)}><Edit2 style={{ width: 14, height: 14 }} /></button>
                <button className="icon-btn" onClick={() => setDb({ ...db, members: db.members.filter((x) => x.id !== m.id) })} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {showForm && (
        <ModalShell title={editing ? 'Sửa thẻ' : 'Thêm thẻ thành viên'} onClose={() => { setShowForm(false); reset(); }}>
          <FormField label="Tên"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
          <FormField label="Mã thẻ (auto uppercase)"><input className="input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.toUpperCase())} placeholder="VD: VIP001" style={{ fontFamily: 'monospace' }} /></FormField>
          <FormField label="SĐT"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
          <FormField label="Giảm giá (%)"><input className="input" type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)} min={0} max={100} /></FormField>
          <FormField label="Số dư trả trước (VND)"><input className="input" type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value) || 0)} min={0} step={100000} /></FormField>
          <button type="button" className="btn-primary" onClick={save} disabled={!name.trim() || !cardNumber.trim()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>{editing ? 'Lưu' : 'Tạo thẻ'}</button>
        </ModalShell>
      )}
    </div>
  );
}

function SimpleListTab<T extends { id: string; name: string; active: boolean }>(
  { title, items, db, setDb, field, makeNew, renderRow, renderForm, headers }:
  { title: string; items: T[]; db: Db; setDb: (d: Db) => void; field: 'services' | 'staff'; makeNew: () => T; renderRow: (item: T) => JSX.Element; renderForm: (item: T, setItem: (i: T) => void) => JSX.Element; headers: string[] }
): JSX.Element {
  const [editing, setEditing] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);

  function start(item: T | null) { const d = item ?? makeNew(); setEditing(item); setDraft(d); }
  function save() { if (!draft || !draft.name.trim()) return; const next = editing ? items.map((x) => x.id === draft.id ? draft : x) : [draft, ...items]; setDb({ ...db, [field]: next } as any); setEditing(null); setDraft(null); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title} ({items.length})</h2>
        <button type="button" className="btn-primary" onClick={() => start(null)}><Plus className="h-4 w-4" /> Thêm</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}>{headers.map((h) => <th key={h} style={{ padding: 10, textAlign: 'left' }}>{h}</th>)}<th></th></tr></thead>
          <tbody>{items.map((it) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              {renderRow(it)}
              <td style={{ padding: 10, textAlign: 'right' }}>
                <button className="icon-btn" onClick={() => start(it)}><Edit2 style={{ width: 14, height: 14 }} /></button>
                <button className="icon-btn" onClick={() => setDb({ ...db, [field]: items.filter((x) => x.id !== it.id) } as any)} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {draft && (
        <ModalShell title={editing ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`} onClose={() => { setEditing(null); setDraft(null); }}>
          {renderForm(draft, setDraft)}
          <button type="button" className="btn-primary" onClick={save} disabled={!draft.name.trim()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>{editing ? 'Lưu' : 'Tạo'}</button>
        </ModalShell>
      )}
    </div>
  );
}

function HistoryTab({ db }: { db: Db }): JSX.Element {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Lịch sử ({db.appointments.length})</h2>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}><th style={{ padding: 8, textAlign: 'left' }}>Ngày</th><th style={{ padding: 8 }}>Khách</th><th style={{ padding: 8 }}>Dịch vụ</th><th style={{ padding: 8 }}>NV</th><th style={{ padding: 8, textAlign: 'right' }}>Tổng</th><th style={{ padding: 8, textAlign: 'right' }}>Đã thu</th></tr></thead>
          <tbody>{db.appointments.slice(0, 100).map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 8 }}>{a.date} {a.time}</td>
              <td style={{ padding: 8, fontWeight: 600 }}>{a.customerName}</td>
              <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>{a.services.map((s) => s.name).join(', ')}</td>
              <td style={{ padding: 8 }}>{db.staff.find((s) => s.id === a.staffId)?.name ?? '—'}</td>
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fm(a.total)}</td>
              <td style={{ padding: 8, textAlign: 'right', color: a.paid >= a.total ? '#10B981' : '#DC2626' }}>{fm(a.paid)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element { return <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon style={{ width: 20, height: 20, color }} /></div><div><div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div></div></div>; }
function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element { return <button type="button" onClick={onClick} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}><Icon style={{ width: 14, height: 14 }} /> {label}</button>; }
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}><div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2><button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button></div>{children}</div></div>; }
function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element { return <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>{children}</div>; }
