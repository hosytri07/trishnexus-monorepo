/**
 * Phase 40.12.C — Module Cafe / Bar.
 *
 * POS: menu + bàn (table tracking) + order + tính tiền.
 * LocalStorage `trishfinance:cafe_db`.
 */
import { useEffect, useMemo, useState } from 'react';
import { Coffee, Plus, Edit2, Trash2, X, Grid3x3, TrendingUp, DollarSign } from 'lucide-react';
import { addLedgerEntry } from '../../lib/ledger-helper';

type MenuCategory = 'coffee' | 'tea' | 'juice' | 'beer' | 'food' | 'dessert' | 'other';

interface MenuItem {
  id: string; name: string; category: MenuCategory; price: number; active: boolean;
}

interface Table {
  id: string; name: string; capacity: number; active: boolean;
  /** Order đang mở */
  currentOrderId?: string;
}

interface Order {
  id: string; date: string; tableId?: string;
  items: Array<{ itemId: string; name: string; qty: number; price: number; subtotal: number }>;
  total: number; paid: number;
  status: 'open' | 'paid' | 'cancelled';
  createdAt: number;
}

interface Db { version: string; menu: MenuItem[]; tables: Table[]; orders: Order[]; }

const DB_KEY = 'trishfinance:cafe_db';
const EMPTY_DB: Db = {
  version: '1.0.0',
  menu: [
    { id: 'cafe_den', name: 'Cà phê đen', category: 'coffee', price: 25000, active: true },
    { id: 'cafe_sua', name: 'Cà phê sữa', category: 'coffee', price: 28000, active: true },
    { id: 'tra_dao', name: 'Trà đào', category: 'tea', price: 35000, active: true },
    { id: 'tra_chanh', name: 'Trà chanh', category: 'tea', price: 25000, active: true },
    { id: 'banh_mi', name: 'Bánh mì pate', category: 'food', price: 25000, active: true },
  ],
  tables: [],
  orders: [],
};

const CAT_LABEL: Record<MenuCategory, string> = { coffee: '☕ Cà phê', tea: '🍵 Trà', juice: '🧃 Nước ép', beer: '🍺 Bia', food: '🍔 Đồ ăn', dessert: '🍰 Tráng miệng', other: '🍴 Khác' };

function loadDb(): Db { try { const r = localStorage.getItem(DB_KEY); if (!r) return { ...EMPTY_DB }; const p = JSON.parse(r) as Db; return { ...EMPTY_DB, ...p, menu: p.menu?.length ? p.menu : EMPTY_DB.menu }; } catch { return { ...EMPTY_DB }; } }
function saveDb(d: Db): void { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch { /* */ } }
function makeId(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function fm(n: number): string { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

type Tab = 'pos' | 'tables' | 'menu' | 'history';

export function CafeModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('pos');
  useEffect(() => { saveDb(db); }, [db]);

  const today = db.orders.filter((o) => o.date === todayStr() && o.status !== 'cancelled');
  const todayRev = today.reduce((s, o) => s + o.paid, 0);
  const openOrders = db.orders.filter((o) => o.status === 'open').length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat icon={Coffee} label="Món" value={String(db.menu.filter((m) => m.active).length)} color="#92400E" />
        <Stat icon={Grid3x3} label="Bàn" value={String(db.tables.filter((t) => t.active).length)} color="#3B82F6" />
        <Stat icon={TrendingUp} label="Đơn mở" value={String(openOrders)} color="#F59E0B" />
        <Stat icon={DollarSign} label="Doanh thu hôm nay" value={fm(todayRev)} color="#10B981" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabBtn active={tab === 'pos'} onClick={() => setTab('pos')} icon={Coffee} label="POS Order" />
        <TabBtn active={tab === 'tables'} onClick={() => setTab('tables')} icon={Grid3x3} label="Bàn" />
        <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')} icon={Edit2} label="Menu" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={TrendingUp} label="Lịch sử" />
      </div>

      {tab === 'pos' && <PosTab db={db} setDb={setDb} />}
      {tab === 'tables' && <TablesTab db={db} setDb={setDb} />}
      {tab === 'menu' && <MenuTab db={db} setDb={setDb} />}
      {tab === 'history' && <HistoryTab db={db} />}
    </div>
  );
}

function PosTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [items, setItems] = useState<Array<{ itemId: string; qty: number }>>([]);
  const [tableId, setTableId] = useState('');
  const [paid, setPaid] = useState(0);

  const orderItems = items.map((it) => { const m = db.menu.find((x) => x.id === it.itemId)!; return { itemId: it.itemId, name: m.name, qty: it.qty, price: m.price, subtotal: m.price * it.qty }; });
  const total = orderItems.reduce((s, x) => s + x.subtotal, 0);

  function addItem(id: string): void { const e = items.find((x) => x.itemId === id); if (e) setItems(items.map((x) => x.itemId === id ? { ...x, qty: x.qty + 1 } : x)); else setItems([...items, { itemId: id, qty: 1 }]); }
  function updateQty(id: string, qty: number): void { if (qty <= 0) setItems(items.filter((x) => x.itemId !== id)); else setItems(items.map((x) => x.itemId === id ? { ...x, qty } : x)); }
  function checkout(): void {
    if (items.length === 0) return;
    const finalPaid = paid || total;
    const o: Order = { id: makeId(), date: todayStr(), tableId: tableId || undefined, items: orderItems, total, paid: finalPaid, status: 'paid', createdAt: Date.now() };
    setDb({ ...db, orders: [o, ...db.orders] });
    addLedgerEntry({ amount: Math.min(finalPaid, total), kind: 'thu', category: 'kinh_doanh', description: `Cafe — ${tableId ? `Bàn ${db.tables.find((t) => t.id === tableId)?.name}` : 'Mang đi'} (${orderItems.map((it) => it.name + '×' + it.qty).join(', ')})`, source: 'cafe' as any, refId: o.id, date: o.date });
    setItems([]); setTableId(''); setPaid(0);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>Menu</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {db.menu.filter((m) => m.active).map((m) => (
            <button key={m.id} type="button" onClick={() => addItem(m.id)} style={{ padding: 10, background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text-primary)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{CAT_LABEL[m.category]}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-accent-primary)', fontWeight: 700, marginTop: 4 }}>{fm(m.price)}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 14, position: 'sticky', top: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0 }}>🧾 Đơn</h3>
        {orderItems.map((it) => (
          <div key={it.itemId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
            <div style={{ flex: 1 }}>{it.name}</div>
            <button className="icon-btn" onClick={() => updateQty(it.itemId, it.qty - 1)} style={{ padding: 2 }}>−</button>
            <span style={{ width: 24, textAlign: 'center', fontWeight: 600 }}>{it.qty}</span>
            <button className="icon-btn" onClick={() => updateQty(it.itemId, it.qty + 1)} style={{ padding: 2 }}>+</button>
            <span style={{ width: 70, textAlign: 'right', fontWeight: 600 }}>{fm(it.subtotal)}</span>
          </div>
        ))}
        <FormField label="Bàn (optional)">
          <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Mang đi / Tại quầy</option>
            {db.tables.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name} (sức chứa {t.capacity})</option>)}
          </select>
        </FormField>
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>TỔNG</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent-primary)' }}>{fm(total)}</span>
        </div>
        <FormField label="Khách trả"><input className="input" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} placeholder={String(total)} /></FormField>
        <button type="button" className="btn-primary" onClick={checkout} disabled={items.length === 0} style={{ width: '100%', justifyContent: 'center', padding: 12, fontWeight: 700 }}>✓ Thanh toán {fm(total)}</button>
      </div>
    </div>
  );
}

function TablesTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''); const [capacity, setCapacity] = useState(4); const [bulkMode, setBulkMode] = useState(false); const [bulkText, setBulkText] = useState('Bàn 1\nBàn 2\nBàn 3');

  function save() {
    if (bulkMode) {
      const names = bulkText.split('\n').map((s) => s.trim()).filter(Boolean);
      const newTables = names.map((n) => ({ id: makeId(), name: n, capacity, active: true }));
      setDb({ ...db, tables: [...newTables, ...db.tables] });
    } else {
      if (!name.trim()) return;
      setDb({ ...db, tables: [{ id: makeId(), name: name.trim(), capacity, active: true }, ...db.tables] });
    }
    setShowForm(false); setName(''); setCapacity(4); setBulkText('Bàn 1\nBàn 2\nBàn 3');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Bàn ({db.tables.length})</h2>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Thêm bàn</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {db.tables.map((t) => (
          <div key={t.id} className="card" style={{ padding: 14, textAlign: 'center' }}>
            <Grid3x3 style={{ width: 24, height: 24, color: 'var(--color-accent-primary)', margin: '0 auto' }} />
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>👥 {t.capacity}</div>
            <button className="icon-btn" onClick={() => setDb({ ...db, tables: db.tables.filter((x) => x.id !== t.id) })} style={{ color: '#DC2626', marginTop: 4 }}><Trash2 style={{ width: 12, height: 12 }} /></button>
          </div>
        ))}
      </div>
      {showForm && (
        <ModalShell title="Thêm bàn" onClose={() => setShowForm(false)}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} /> Nhập hàng loạt (mỗi dòng 1 bàn)
          </label>
          {bulkMode ? (
            <FormField label="Tên các bàn"><textarea className="input" value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace', resize: 'vertical' }} /></FormField>
          ) : (
            <FormField label="Tên bàn"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="VD: Bàn 1, B-VIP1" /></FormField>
          )}
          <FormField label="Sức chứa (chung)"><input className="input" type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 4)} min={1} /></FormField>
          <button type="button" className="btn-primary" onClick={save} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>Tạo</button>
        </ModalShell>
      )}
    </div>
  );
}

function MenuTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(''); const [category, setCategory] = useState<MenuCategory>('coffee'); const [price, setPrice] = useState(25000); const [active, setActive] = useState(true);

  function start(m: MenuItem | null) { setEditing(m); setName(m?.name ?? ''); setCategory(m?.category ?? 'coffee'); setPrice(m?.price ?? 25000); setActive(m?.active ?? true); setShowForm(true); }
  function save() { if (!name.trim()) return; const item: MenuItem = { id: editing?.id ?? makeId(), name: name.trim(), category, price, active }; setDb(editing ? { ...db, menu: db.menu.map((x) => x.id === item.id ? item : x) } : { ...db, menu: [item, ...db.menu] }); setShowForm(false); }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Menu ({db.menu.length})</h2>
        <button type="button" className="btn-primary" onClick={() => start(null)}><Plus className="h-4 w-4" /> Thêm món</button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}><th style={{ padding: 10, textAlign: 'left' }}>Tên</th><th style={{ padding: 10, textAlign: 'left' }}>Loại</th><th style={{ padding: 10, textAlign: 'right' }}>Giá</th><th></th></tr></thead>
          <tbody>{db.menu.map((m) => (
            <tr key={m.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 10, fontWeight: 600 }}>{m.name}</td>
              <td style={{ padding: 10 }}>{CAT_LABEL[m.category]}</td>
              <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: 'var(--color-accent-primary)' }}>{fm(m.price)}</td>
              <td style={{ padding: 10, textAlign: 'right' }}>
                <button className="icon-btn" onClick={() => start(m)}><Edit2 style={{ width: 14, height: 14 }} /></button>
                <button className="icon-btn" onClick={() => setDb({ ...db, menu: db.menu.filter((x) => x.id !== m.id) })} style={{ color: '#DC2626' }}><Trash2 style={{ width: 14, height: 14 }} /></button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {showForm && (
        <ModalShell title={editing ? 'Sửa món' : 'Thêm món'} onClose={() => setShowForm(false)}>
          <FormField label="Tên món"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
          <FormField label="Loại"><select className="input" value={category} onChange={(e) => setCategory(e.target.value as MenuCategory)}>{(Object.keys(CAT_LABEL) as MenuCategory[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></FormField>
          <FormField label="Giá (VND)"><input className="input" type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} min={0} step={5000} /></FormField>
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
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Lịch sử ({db.orders.length})</h2>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--color-surface-row)' }}><th style={{ padding: 8, textAlign: 'left' }}>Ngày</th><th style={{ padding: 8 }}>Bàn</th><th style={{ padding: 8 }}>Món</th><th style={{ padding: 8, textAlign: 'right' }}>Tổng</th><th style={{ padding: 8, textAlign: 'right' }}>Đã thu</th></tr></thead>
          <tbody>{db.orders.slice(0, 100).map((o) => (
            <tr key={o.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              <td style={{ padding: 8 }}>{o.date}<div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{new Date(o.createdAt).toLocaleTimeString('vi-VN')}</div></td>
              <td style={{ padding: 8 }}>{db.tables.find((t) => t.id === o.tableId)?.name ?? 'Mang đi'}</td>
              <td style={{ padding: 8, color: 'var(--color-text-muted)' }}>{o.items.map((it) => `${it.name}×${it.qty}`).join(', ')}</td>
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fm(o.total)}</td>
              <td style={{ padding: 8, textAlign: 'right', color: o.paid >= o.total ? '#10B981' : '#DC2626' }}>{fm(o.paid)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element { return <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon style={{ width: 20, height: 20, color }} /></div><div><div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{value}</div></div></div>; }
function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element { return <button type="button" onClick={onClick} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}><Icon style={{ width: 14, height: 14 }} /> {label}</button>; }
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element { return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}><div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2><button type="button" onClick={onClose} className="icon-btn"><X style={{ width: 16, height: 16 }} /></button></div>{children}</div></div>; }
function FormField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element { return <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>{children}</div>; }
