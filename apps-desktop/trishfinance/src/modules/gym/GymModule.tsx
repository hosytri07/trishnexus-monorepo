/**
 * Phase 40.12.D — Module Gym / Fitness.
 *
 * Quản lý: thẻ tập (gói tháng/quý/năm) + lịch tập + PT booking + check-in.
 * LocalStorage `trishfinance:gym_db`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Plus, Edit2, Trash2, X, User, CalendarCheck, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { addLedgerEntry } from '../../lib/ledger-helper';
import { PaymentModal, type PaymentResult } from '../../components/PaymentModal';

type PackageType = 'month1' | 'month3' | 'month6' | 'year1' | 'pt_pack' | 'custom';

interface Package {
  id: string; name: string; type: PackageType; durationDays: number; price: number; ptSessions?: number; active: boolean;
}

interface Member {
  id: string; cardNumber: string; name: string; phone?: string; email?: string;
  packageId?: string; startDate?: string; endDate?: string; ptSessionsLeft?: number;
  active: boolean; createdAt: number;
}

interface CheckIn { id: string; memberId: string; date: string; time: string; createdAt: number; }

interface PurchaseTx { id: string; memberId: string; packageId: string; price: number; date: string; createdAt: number; }

interface Db { version: string; packages: Package[]; members: Member[]; checkIns: CheckIn[]; purchases: PurchaseTx[]; }

const DB_KEY = 'trishfinance:gym_db';
const EMPTY_DB: Db = {
  version: '1.0.0',
  packages: [
    { id: 'pkg_1m', name: 'Thẻ 1 tháng', type: 'month1', durationDays: 30, price: 400000, active: true },
    { id: 'pkg_3m', name: 'Thẻ 3 tháng', type: 'month3', durationDays: 90, price: 1100000, active: true },
    { id: 'pkg_6m', name: 'Thẻ 6 tháng', type: 'month6', durationDays: 180, price: 2000000, active: true },
    { id: 'pkg_1y', name: 'Thẻ 1 năm', type: 'year1', durationDays: 365, price: 3500000, active: true },
    { id: 'pkg_pt10', name: 'Gói PT 10 buổi', type: 'pt_pack', durationDays: 90, price: 2500000, ptSessions: 10, active: true },
  ],
  members: [], checkIns: [], purchases: [],
};

const PKG_TYPE_LABEL: Record<PackageType, string> = { month1: '📅 1 tháng', month3: '📅 3 tháng', month6: '📅 6 tháng', year1: '🗓 1 năm', pt_pack: '💪 PT', custom: '🔧 Tùy chỉnh' };

function loadDb(): Db { try { const r = localStorage.getItem(DB_KEY); if (!r) return { ...EMPTY_DB }; const p = JSON.parse(r) as Db; return { ...EMPTY_DB, ...p, packages: p.packages?.length ? p.packages : EMPTY_DB.packages }; } catch { return { ...EMPTY_DB }; } }
function saveDb(d: Db): void { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch { /* */ } }
function makeId(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function fm(n: number): string { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function addDays(date: string, days: number): string { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function daysBetween(from: string, to: string): number { return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)); }

type Tab = 'members' | 'checkin' | 'packages' | 'history';

export function GymModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('checkin');
  useEffect(() => { saveDb(db); }, [db]);

  const todayStr_ = todayStr();
  const activeMembers = db.members.filter((m) => m.active && m.endDate && m.endDate >= todayStr_).length;
  const expiringSoon = db.members.filter((m) => m.active && m.endDate && daysBetween(todayStr_, m.endDate) > 0 && daysBetween(todayStr_, m.endDate) <= 7).length;
  const todayCheckIns = db.checkIns.filter((c) => c.date === todayStr_).length;
  const todayRev = db.purchases.filter((p) => p.date === todayStr_).reduce((s, p) => s + p.price, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat icon={User} label="Thành viên active" value={String(activeMembers)} color="#10B981" />
        <Stat icon={CalendarCheck} label="Sắp hết hạn (7d)" value={String(expiringSoon)} color={expiringSoon > 0 ? '#F59E0B' : '#94A3B8'} />
        <Stat icon={Dumbbell} label="Check-in hôm nay" value={String(todayCheckIns)} color="#3B82F6" />
        <Stat icon={DollarSign} label="Doanh thu hôm nay" value={fm(todayRev)} color="#A855F7" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabBtn active={tab === 'checkin'} onClick={() => setTab('checkin')} icon={CalendarCheck} label="Check-in" />
        <TabBtn active={tab === 'members'} onClick={() => setTab('members')} icon={User} label="Thành viên" />
        <TabBtn active={tab === 'packages'} onClick={() => setTab('packages')} icon={CreditCard} label="Gói tập" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={TrendingUp} label="Lịch sử" />
      </div>

      {tab === 'checkin' && <CheckInTab db={db} setDb={setDb} />}
      {tab === 'members' && <MembersTab db={db} setDb={setDb} />}
      {tab === 'packages' && <PackagesTab db={db} setDb={setDb} />}
      {tab === 'history' && <HistoryTab db={db} />}
    </div>
  );
}

function CheckInTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [search, setSearch] = useState('');
  const today = todayStr();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return db.members.filter((m) => m.active).slice(0, 12);
    return db.members.filter((m) => m.active && (m.cardNumber.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.phone ?? '').includes(q))).slice(0, 12);
  }, [db.members, search]);

  function checkIn(memberId: string): void {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setDb({ ...db, checkIns: [{ id: makeId(), memberId, date: today, time, createdAt: Date.now() }, ...db.checkIns] });
  }

  return (
    <div>
      <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Tìm theo tên / mã thẻ / SĐT..." style={{ width: '100%', maxWidth: 400, marginBottom: 14 }} autoFocus />

      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Chọn thành viên để check-in</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            Không tìm thấy — bấm tab "Thành viên" để tạo thẻ mới
          </div>
        ) : filtered.map((m) => {
          const expired = m.endDate && m.endDate < today;
          const daysLeft = m.endDate ? daysBetween(today, m.endDate) : null;
          return (
            <button key={m.id} type="button" onClick={() => !expired && checkIn(m.id)} disabled={!!expired} className="card" style={{ padding: 14, textAlign: 'left', cursor: expired ? 'not-allowed' : 'pointer', border: expired ? '1px solid #DC2626' : '1px solid var(--color-border-subtle)', opacity: expired ? 0.6 : 1, background: 'var(--color-surface-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>{m.cardNumber}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
                  {m.phone && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>📱 {m.phone}</div>}
                </div>
              </div>
              {m.endDate && (
                <div style={{ marginTop: 8, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: expired ? 'rgba(220,38,38,0.15)' : daysLeft! <= 7 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)', color: expired ? '#991B1B' : daysLeft! <= 7 ? '#92400E' : '#065F46', display: 'inline-block' }}>
                  {expired ? '⚠ Hết hạn' : daysLeft! <= 7 ? `⏰ Còn ${daysLeft}d` : `✓ Còn ${daysLeft}d`}
                </div>
              )}
              {m.ptSessionsLeft !== undefined && m.ptSessionsLeft > 0 && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#A855F7' }}>💪 PT: còn {m.ptSessionsLeft} buổi</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MembersTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [cardNumber, setCardNumber] = useState(''); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [packageId, setPackageId] = useState(''); const [paid, setPaid] = useState(0);

  function start(m: Member | null) { setEditing(m); setCardNumber(m?.cardNumber ?? ''); setName(m?.name ?? ''); setPhone(m?.phone ?? ''); setPackageId(m?.packageId ?? ''); setPaid(0); setShowForm(true); }
  function save() {
    if (!name.trim() || !cardNumber.trim()) return;
    const pkg = db.packages.find((p) => p.id === packageId);
    const today = todayStr();
    const member: Member = {
      id: editing?.id ?? makeId(),
      cardNumber: cardNumber.trim().toUpperCase(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      packageId: pkg?.id,
      startDate: pkg ? today : undefined,
      endDate: pkg ? addDays(today, pkg.durationDays) : undefined,
      ptSessionsLeft: pkg?.ptSessions,
      active: true,
      createdAt: editing?.createdAt ?? Date.now(),
    };
    const newMembers = editing ? db.members.map((x) => x.id === member.id ? member : x) : [member, ...db.members];
    const newPurchases = pkg && !editing ? [{ id: makeId(), memberId: member.id, packageId: pkg.id, price: pkg.price, date: today, createdAt: Date.now() }, ...db.purchases] : db.purchases;
    setDb({ ...db, members: newMembers, purchases: newPurchases });
    if (pkg && !editing) {
      addLedgerEntry({ amount: paid > 0 ? paid : pkg.price, kind: 'thu', category: 'kinh_doanh', description: `Gym — ${name} mua ${pkg.name}`, source: 'gym' as any, refId: member.id, date: today });
    }
    setShowForm(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Thành viên ({db.members.length})</h2>
        <button type="button" className="btn-primary" onClick={() => start(null)}><Plus className="h-4 w-4" /> Thêm thẻ</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}><th style={{ padding: 10, textAlign: 'left' }}>Mã thẻ</th><th style={{ padding: 10 }}>Tên</th><th style={{ padding: 10 }}>SĐT</th><th style={{ padding: 10 }}>Gói</th><th style={{ padding: 10 }}>Hạn</th><th></th></tr></thead>
          <tbody>{db.members.map((m) => {
            const pkg = db.packages.find((p) => p.id === m.packageId);
            const today = todayStr();
            const expired = m.endDate && m.endDate < today;
            return (
              <tr key={m.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 10, fontFamily: 'monospace' }}>{m.cardNumber}</td>
                <td style={{ padding: 10, fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: 10 }}>{m.phone ?? '—'}</td>
                <td style={{ padding: 10 }}>{pkg?.name ?? '—'}</td>
                <td style={{ padding: 10, color: expired ? '#DC2626' : 'inherit', fontWeight: expired ? 700 : 400 }}>{m.endDate ?? '—'}{expired && ' ⚠'}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <button className="icon-btn" onClick={() => start(m)}><Edit2 style={{ width: 14, height: 14 }} /></button>
                  <button className="icon-btn" onClick={() => setDb({ ...db, members: db.members.filter((x) => x.id !== m.id) })} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {showForm && (
        <ModalShell title={editing ? 'Sửa thẻ' : 'Thêm thẻ thành viên'} onClose={() => setShowForm(false)}>
          <FormField label="Mã thẻ"><input className="input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.toUpperCase())} placeholder="VD: GYM001" style={{ fontFamily: 'monospace' }} autoFocus /></FormField>
          <FormField label="Tên"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></FormField>
          <FormField label="SĐT"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></FormField>
          {!editing && (
            <>
              <FormField label="Gói tập (đăng ký luôn)">
                <select className="input" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  <option value="">— Chưa mua gói —</option>
                  {db.packages.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.durationDays}d) — {fm(p.price)}</option>)}
                </select>
              </FormField>
              {packageId && <FormField label="Tiền khách trả (default = giá gói)"><input className="input" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} placeholder={String(db.packages.find((p) => p.id === packageId)?.price ?? 0)} /></FormField>}
            </>
          )}
          {!editing && packageId ? (
            <button type="button" className="btn-primary" onClick={() => setShowPayment(true)} disabled={!name.trim() || !cardNumber.trim()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
              💳 Tạo thẻ & Thanh toán
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={save} disabled={!name.trim() || !cardNumber.trim()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
              {editing ? 'Lưu' : 'Tạo thẻ'}
            </button>
          )}
        </ModalShell>
      )}
      {showPayment && packageId && (
        <PaymentModal
          total={db.packages.find((p) => p.id === packageId)?.price ?? 0}
          description={`Gym ${name} - ${db.packages.find((p) => p.id === packageId)?.name ?? ''}`.slice(0, 50)}
          customerName={name}
          onConfirm={(result) => { setShowPayment(false); setTimeout(() => save(), 50); }}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}

function PackagesTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Package | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState<PackageType>('month1'); const [durationDays, setDurationDays] = useState(30); const [price, setPrice] = useState(400000); const [ptSessions, setPtSessions] = useState(0); const [active, setActive] = useState(true);

  function start(p: Package | null) { setEditing(p); setName(p?.name ?? ''); setType(p?.type ?? 'month1'); setDurationDays(p?.durationDays ?? 30); setPrice(p?.price ?? 400000); setPtSessions(p?.ptSessions ?? 0); setActive(p?.active ?? true); setShowForm(true); }
  function save() { if (!name.trim()) return; const pkg: Package = { id: editing?.id ?? makeId(), name: name.trim(), type, durationDays, price, ptSessions: ptSessions > 0 ? ptSessions : undefined, active }; setDb(editing ? { ...db, packages: db.packages.map((x) => x.id === pkg.id ? pkg : x) } : { ...db, packages: [pkg, ...db.packages] }); setShowForm(false); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Gói tập ({db.packages.length})</h2>
        <button type="button" className="btn-primary" onClick={() => start(null)}><Plus className="h-4 w-4" /> Thêm gói</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {db.packages.map((p) => (
          <div key={p.id} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{PKG_TYPE_LABEL[p.type]}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{p.durationDays} ngày{p.ptSessions ? ` · ${p.ptSessions} buổi PT` : ''}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-accent-primary)', marginTop: 6 }}>{fm(p.price)}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="icon-btn" onClick={() => start(p)}><Edit2 style={{ width: 14, height: 14 }} /></button>
              <button className="icon-btn" onClick={() => setDb({ ...db, packages: db.packages.filter((x) => x.id !== p.id) })} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
            </div>
          </div>
        ))}
      </div>
      {showForm && (
        <ModalShell title={editing ? 'Sửa gói' : 'Thêm gói tập'} onClose={() => setShowForm(false)}>
          <FormField label="Tên gói"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
          <FormField label="Loại"><select className="input" value={type} onChange={(e) => setType(e.target.value as PackageType)}>{(Object.keys(PKG_TYPE_LABEL) as PackageType[]).map((t) => <option key={t} value={t}>{PKG_TYPE_LABEL[t]}</option>)}</select></FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="Thời hạn (ngày)"><input className="input" type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value) || 0)} min={1} /></FormField>
            <FormField label="Giá (VND)"><input className="input" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} min={0} step={50000} /></FormField>
          </div>
          <FormField label="Số buổi PT (0 nếu không có)"><input className="input" type="number" value={ptSessions} onChange={(e) => setPtSessions(Number(e.target.value) || 0)} min={0} /></FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang bán</label>
          <button type="button" className="btn-primary" onClick={save} disabled={!name.trim()} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>{editing ? 'Lưu' : 'Tạo'}</button>
        </ModalShell>
      )}
    </div>
  );
}

function HistoryTab({ db }: { db: Db }): JSX.Element {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Mua thẻ ({db.purchases.length}) · Check-in ({db.checkIns.length})</h2>
      <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}><th style={{ padding: 8, textAlign: 'left' }}>Ngày</th><th style={{ padding: 8 }}>Thành viên</th><th style={{ padding: 8 }}>Gói</th><th style={{ padding: 8, textAlign: 'right' }}>Tiền</th></tr></thead>
          <tbody>{db.purchases.slice(0, 50).map((p) => {
            const m = db.members.find((x) => x.id === p.memberId);
            const pkg = db.packages.find((x) => x.id === p.packageId);
            return (
              <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 8 }}>{p.date}</td>
                <td style={{ padding: 8, fontWeight: 600 }}>{m?.name ?? '?'} <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--color-text-muted)' }}>{m?.cardNumber}</span></td>
                <td style={{ padding: 8 }}>{pkg?.name ?? '?'}</td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fm(p.price)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element { return <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon style={{ width: 20, height: 20, color }} /></div><div><div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div></div></div>; }
function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element { return <button type="button" onClick={onClick} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}><Icon style={{ width: 14, height: 14 }} /> {label}</button>; }
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}><div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2><button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button></div>{children}</div></div>; }
function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element { return <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>{children}</div>; }
