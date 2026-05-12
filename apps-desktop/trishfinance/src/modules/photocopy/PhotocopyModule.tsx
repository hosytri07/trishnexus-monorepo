/**
 * Phase 40.5.C — Module "Quản lý quán photocopy".
 *
 * Quản lý: bảng giá dịch vụ (in/copy/scan/đóng cuốn) + tính tiền nhanh + thẻ sinh viên +
 * lịch sử giao dịch.
 * LocalStorage key `trishfinance:photocopy_db`.
 *
 * 3 tab:
 *  - Tính tiền: chọn dịch vụ + số lượng → ra hóa đơn
 *  - Bảng giá: CRUD services
 *  - Lịch sử: list transactions + doanh thu
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Plus,
  Trash2,
  X,
  Edit2,
  TrendingUp,
  Calculator,
  Receipt,
  CreditCard,
} from 'lucide-react';

// ============================================================
type ServiceCategory = 'print_bw' | 'print_color' | 'copy' | 'scan' | 'binding' | 'other';

interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  unitPrice: number; // per page or per item
  unit: string; // "trang", "cuốn", "lần"
  note?: string;
  active: boolean;
}

interface TxItem {
  serviceId: string;
  serviceName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

interface Tx {
  id: string;
  items: TxItem[];
  total: number;
  paid: number;
  customerName?: string;
  customerPhone?: string;
  studentCard?: string;
  note?: string;
  date: string;
  createdAt: number;
}

interface Db {
  version: string;
  services: Service[];
  txs: Tx[];
}

const DB_KEY = 'trishfinance:photocopy_db';
const EMPTY_DB: Db = {
  version: '1.0.0',
  services: [
    // Seed data
    { id: 'svc_print_bw_a4', name: 'In trắng đen A4', category: 'print_bw', unitPrice: 500, unit: 'trang', active: true },
    { id: 'svc_print_color_a4', name: 'In màu A4', category: 'print_color', unitPrice: 3000, unit: 'trang', active: true },
    { id: 'svc_copy_a4', name: 'Photo A4', category: 'copy', unitPrice: 300, unit: 'trang', active: true },
    { id: 'svc_scan_a4', name: 'Scan A4', category: 'scan', unitPrice: 1000, unit: 'trang', active: true },
    { id: 'svc_binding', name: 'Đóng cuốn (kẹp lò xo)', category: 'binding', unitPrice: 8000, unit: 'cuốn', active: true },
  ],
  txs: [],
};

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  print_bw: '🖨 In đen trắng',
  print_color: '🌈 In màu',
  copy: '📄 Photo',
  scan: '📷 Scan',
  binding: '📚 Đóng cuốn',
  other: '🔧 Khác',
};

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    const parsed = JSON.parse(raw) as Db;
    return { ...EMPTY_DB, ...parsed, services: parsed.services?.length ? parsed.services : EMPTY_DB.services };
  } catch {
    return { ...EMPTY_DB };
  }
}
function saveDb(db: Db): void { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ } }
function makeId(): string { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function formatMoney(n: number): string { return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ'; }
function todayStr(): string { return new Date().toISOString().slice(0, 10); }

// ============================================================
type Tab = 'calc' | 'services' | 'history';

export function PhotocopyModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('calc');

  useEffect(() => { saveDb(db); }, [db]);

  const stats = useMemo(() => {
    const todayTxs = db.txs.filter((t) => t.date === todayStr());
    return {
      todayRevenue: todayTxs.reduce((s, t) => s + t.total, 0),
      todayCount: todayTxs.length,
      totalServices: db.services.filter((s) => s.active).length,
    };
  }, [db]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Receipt} label="Đơn hôm nay" value={String(stats.todayCount)} color="#3B82F6" />
        <StatCard icon={TrendingUp} label="Doanh thu hôm nay" value={formatMoney(stats.todayRevenue)} color="#10B981" />
        <StatCard icon={Printer} label="Dịch vụ" value={String(stats.totalServices)} color="#F59E0B" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabButton active={tab === 'calc'} onClick={() => setTab('calc')} icon={Calculator} label="Tính tiền" />
        <TabButton active={tab === 'services'} onClick={() => setTab('services')} icon={Edit2} label="Bảng giá" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={Receipt} label="Lịch sử" />
      </div>

      {tab === 'calc' && <CalcTab db={db} setDb={setDb} />}
      {tab === 'services' && <ServicesTab db={db} setDb={setDb} />}
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
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }): JSX.Element {
  return (
    <button type="button" onClick={onClick} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent', color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1 }}>
      <Icon style={{ width: 14, height: 14 }} /> {label}
    </button>
  );
}

// ============================================================
// Calculator tab — pick services + qty → invoice
// ============================================================
function CalcTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [items, setItems] = useState<Array<{ serviceId: string; qty: number }>>([]);
  const [customerName, setCustomerName] = useState('');
  const [studentCard, setStudentCard] = useState('');
  const [paid, setPaid] = useState(0);

  function addService(serviceId: string): void {
    const existing = items.find((it) => it.serviceId === serviceId);
    if (existing) {
      setItems(items.map((it) => (it.serviceId === serviceId ? { ...it, qty: it.qty + 1 } : it)));
    } else {
      setItems([...items, { serviceId, qty: 1 }]);
    }
  }
  function updateQty(serviceId: string, qty: number): void {
    if (qty <= 0) {
      setItems(items.filter((it) => it.serviceId !== serviceId));
    } else {
      setItems(items.map((it) => (it.serviceId === serviceId ? { ...it, qty } : it)));
    }
  }

  const txItems: TxItem[] = items.map((it) => {
    const s = db.services.find((x) => x.id === it.serviceId);
    return {
      serviceId: it.serviceId,
      serviceName: s?.name ?? '(unknown)',
      qty: it.qty,
      unitPrice: s?.unitPrice ?? 0,
      subtotal: (s?.unitPrice ?? 0) * it.qty,
    };
  });
  const total = txItems.reduce((s, x) => s + x.subtotal, 0);
  const change = paid - total;

  function handleCheckout(): void {
    if (items.length === 0) return;
    const tx: Tx = {
      id: makeId(),
      items: txItems,
      total,
      paid: paid || total,
      customerName: customerName.trim() || undefined,
      studentCard: studentCard.trim() || undefined,
      date: todayStr(),
      createdAt: Date.now(),
    };
    setDb({ ...db, txs: [tx, ...db.txs] });
    setItems([]);
    setCustomerName('');
    setStudentCard('');
    setPaid(0);
  }

  const activeServices = db.services.filter((s) => s.active);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'flex-start' }}>
      {/* Service picker */}
      <div className="card" style={{ padding: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>Chọn dịch vụ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {activeServices.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addService(s.id)}
              style={{
                padding: 10,
                background: 'var(--color-surface-row)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--color-text-primary)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-soft)'; e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-row)'; e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
            >
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{CATEGORY_LABEL[s.category]}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{s.name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 4 }}>{formatMoney(s.unitPrice)}/{s.unit}</div>
            </button>
          ))}
          {activeServices.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Chưa có dịch vụ — sang tab Bảng giá để tạo
            </div>
          )}
        </div>
      </div>

      {/* Invoice */}
      <div className="card" style={{ padding: 14, position: 'sticky', top: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>🧾 Hóa đơn</h3>
        {items.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Chọn dịch vụ bên trái...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {txItems.map((it) => (
                <div key={it.serviceId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.serviceName}</div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{formatMoney(it.unitPrice)} × {it.qty}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" className="icon-btn" onClick={() => updateQty(it.serviceId, it.qty - 1)} style={{ padding: 4, fontSize: 12 }}>−</button>
                    <input type="number" value={it.qty} onChange={(e) => updateQty(it.serviceId, Number(e.target.value) || 0)} min={0} style={{ width: 44, padding: 4, textAlign: 'center', border: '1px solid var(--color-border-default)', borderRadius: 4, fontSize: 12, background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }} />
                    <button type="button" className="icon-btn" onClick={() => updateQty(it.serviceId, it.qty + 1)} style={{ padding: 4, fontSize: 12 }}>+</button>
                  </div>
                  <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{formatMoney(it.subtotal)}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Tổng cộng</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent-primary)' }}>{formatMoney(total)}</span>
              </div>
            </div>

            <FormField label="Tên khách (optional)">
              <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Khách lẻ" />
            </FormField>
            <FormField label="Mã thẻ sinh viên (optional)">
              <input className="input" value={studentCard} onChange={(e) => setStudentCard(e.target.value)} placeholder="VD: SV2026001" />
            </FormField>
            <FormField label="Tiền khách đưa">
              <input className="input" type="number" value={paid} onChange={(e) => setPaid(Number(e.target.value) || 0)} placeholder={String(total)} />
            </FormField>
            {paid > 0 && change >= 0 && (
              <div style={{ padding: 8, background: 'rgba(16,185,129,0.1)', borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                💰 Tiền thừa: <strong>{formatMoney(change)}</strong>
              </div>
            )}
            {paid > 0 && change < 0 && (
              <div style={{ padding: 8, background: 'rgba(220,38,38,0.1)', borderRadius: 8, fontSize: 12, marginBottom: 10, color: '#991B1B' }}>
                ⚠ Còn thiếu: <strong>{formatMoney(-change)}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn-secondary" onClick={() => { setItems([]); setCustomerName(''); setStudentCard(''); setPaid(0); }} style={{ flex: 1 }}>
                Xóa
              </button>
              <button type="button" className="btn-primary" onClick={handleCheckout} style={{ flex: 2 }}>
                ✓ Thanh toán {formatMoney(total)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Services tab — CRUD
// ============================================================
function ServicesTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleSave(s: Service): void {
    if (editing) {
      setDb({ ...db, services: db.services.map((x) => (x.id === s.id ? s : x)) });
    } else {
      setDb({ ...db, services: [s, ...db.services] });
    }
    setShowForm(false);
    setEditing(null);
  }
  function handleDelete(id: string): void {
    setDb({ ...db, services: db.services.filter((s) => s.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Bảng giá dịch vụ ({db.services.length})</h2>
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm dịch vụ
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Dịch vụ</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Loại</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Đơn giá</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Trạng thái</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {db.services.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.note && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.note}</div>}
                </td>
                <td style={{ padding: 10, fontSize: 12 }}>{CATEGORY_LABEL[s.category]}</td>
                <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, color: 'var(--color-accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(s.unitPrice)}<span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>/{s.unit}</span>
                </td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: s.active ? 'rgba(16,185,129,0.15)' : 'rgba(156,163,175,0.2)', color: s.active ? '#065F46' : 'var(--color-text-muted)' }}>
                    {s.active ? '✓ Bật' : '⊘ Tắt'}
                  </span>
                </td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <button type="button" className="icon-btn" onClick={() => { setEditing(s); setShowForm(true); }}>
                    <Edit2 style={{ width: 14, height: 14 }} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => handleDelete(s.id)} style={{ color: '#DC2626' }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <ServiceForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ServiceForm({ initial, onSave, onClose }: { initial: Service | null; onSave: (s: Service) => void; onClose: () => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<ServiceCategory>(initial?.category ?? 'print_bw');
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ?? 500);
  const [unit, setUnit] = useState(initial?.unit ?? 'trang');
  const [note, setNote] = useState(initial?.note ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  function handleSubmit(): void {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? makeId(),
      name: name.trim(),
      category,
      unitPrice: Math.max(0, unitPrice),
      unit: unit.trim() || 'lần',
      note: note.trim() || undefined,
      active,
    });
  }

  return (
    <ModalShell title={initial ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={onClose}>
      <FormField label="Tên dịch vụ"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: In trắng đen A4 1 mặt" autoFocus /></FormField>
      <FormField label="Loại">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
          {(Object.keys(CATEGORY_LABEL) as ServiceCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <FormField label="Đơn giá (VND)"><input className="input" type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value) || 0)} min={0} step={100} /></FormField>
        <FormField label="Đơn vị"><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="trang/cuốn/lần" /></FormField>
      </div>
      <FormField label="Ghi chú"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" /></FormField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Dịch vụ đang bán
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!name.trim()}>{initial ? 'Lưu' : 'Tạo'}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// History tab
// ============================================================
function HistoryTab({ db }: { db: Db }): JSX.Element {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayStr());

  const filtered = useMemo(() => db.txs.filter((t) => t.date >= fromDate && t.date <= toDate), [db.txs, fromDate, toDate]);
  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Từ:</label>
        <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 160 }} />
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600 }}>Đến:</label>
        <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 160 }} />
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          Tổng: <span style={{ color: 'var(--color-accent-primary)' }}>{formatMoney(totalRevenue)}</span> ({filtered.length} đơn)
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Không có giao dịch trong khoảng thời gian này
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Ngày</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Khách</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Dịch vụ</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Tổng</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Đã thu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                  <td style={{ padding: 8 }}>
                    {t.date}
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{new Date(t.createdAt).toLocaleTimeString('vi-VN')}</div>
                  </td>
                  <td style={{ padding: 8 }}>
                    {t.customerName ?? <span style={{ color: 'var(--color-text-muted)' }}>Khách lẻ</span>}
                    {t.studentCard && <div style={{ fontSize: 10, color: '#3B82F6' }}><CreditCard style={{ width: 9, height: 9, display: 'inline' }} /> {t.studentCard}</div>}
                  </td>
                  <td style={{ padding: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {t.items.map((it) => `${it.serviceName} ×${it.qty}`).join(', ')}
                  </td>
                  <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-primary)' }}>{formatMoney(t.total)}</td>
                  <td style={{ padding: 8, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(t.paid)}</td>
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
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
