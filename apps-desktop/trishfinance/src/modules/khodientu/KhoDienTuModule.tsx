/**
 * Phase 40.5.B — Module "Kho điện tử".
 *
 * Quản lý: sản phẩm điện tử + nhập-xuất kho + tồn kho + bảo hành theo serial.
 * LocalStorage key `trishfinance:khodientu_db`.
 *
 * 3 tab:
 *  - Sản phẩm: CRUD list
 *  - Nhập / Xuất: log transaction (in/out)
 *  - Tồn kho: list current stock + cảnh báo thấp
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Package,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Edit2,
  Trash2,
  X,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { addLedgerEntry } from '../../lib/ledger-helper';

// ============================================================
// Types
// ============================================================
type ProductCategory =
  | 'phone'
  | 'laptop'
  | 'accessory'
  | 'cable'
  | 'charger'
  | 'speaker'
  | 'other';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  costPrice: number; // giá nhập
  sellPrice: number; // giá bán
  stock: number;
  minStock: number;
  supplier?: string;
  warrantyMonths?: number;
  note?: string;
  active: boolean;
  createdAt: number;
}

interface Tx {
  id: string;
  productId: string;
  type: 'in' | 'out';
  qty: number;
  unitPrice: number;
  serials?: string[]; // serial numbers (optional)
  customerName?: string;
  customerPhone?: string;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

interface Db {
  version: string;
  products: Product[];
  txs: Tx[];
}

const DB_KEY = 'trishfinance:khodientu_db';
const EMPTY_DB: Db = { version: '1.0.0', products: [], txs: [] };

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  phone: '📱 Điện thoại',
  laptop: '💻 Laptop',
  accessory: '🎧 Phụ kiện',
  cable: '🔌 Cáp',
  charger: '🔋 Sạc',
  speaker: '🔈 Loa',
  other: '📦 Khác',
};

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...EMPTY_DB };
    return { ...EMPTY_DB, ...(JSON.parse(raw) as Db) };
  } catch {
    return { ...EMPTY_DB };
  }
}
function saveDb(db: Db): void {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* ignore */ }
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
type Tab = 'products' | 'tx' | 'stock';

export function KhoDienTuModule(): JSX.Element {
  const [db, setDb] = useState<Db>(() => loadDb());
  const [tab, setTab] = useState<Tab>('stock');

  useEffect(() => { saveDb(db); }, [db]);

  const stats = useMemo(() => {
    const activeProducts = db.products.filter((p) => p.active);
    const totalStockValue = activeProducts.reduce((s, p) => s + p.stock * p.costPrice, 0);
    const lowStock = activeProducts.filter((p) => p.stock <= p.minStock).length;
    const todayTxs = db.txs.filter((t) => t.date === todayStr());
    return {
      totalProducts: activeProducts.length,
      totalStockValue,
      lowStock,
      todayTxCount: todayTxs.length,
    };
  }, [db]);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Package} label="Sản phẩm" value={String(stats.totalProducts)} color="#3B82F6" />
        <StatCard icon={TrendingUp} label="Giá trị tồn" value={formatMoney(stats.totalStockValue)} color="#10B981" />
        <StatCard icon={AlertTriangle} label="Tồn thấp" value={String(stats.lowStock)} color={stats.lowStock > 0 ? '#DC2626' : '#94A3B8'} />
        <StatCard icon={ArrowDownToLine} label="Giao dịch hôm nay" value={String(stats.todayTxCount)} color="#F59E0B" />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border-subtle)' }}>
        <TabButton active={tab === 'stock'} onClick={() => setTab('stock')} icon={Package} label="Tồn kho" />
        <TabButton active={tab === 'products'} onClick={() => setTab('products')} icon={Edit2} label="Sản phẩm" />
        <TabButton active={tab === 'tx'} onClick={() => setTab('tx')} icon={ArrowDownToLine} label="Nhập / Xuất" />
      </div>

      {tab === 'products' && <ProductsTab db={db} setDb={setDb} />}
      {tab === 'tx' && <TxTab db={db} setDb={setDb} />}
      {tab === 'stock' && <StockTab db={db} />}
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
// Products tab
// ============================================================
function ProductsTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return db.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [db.products, filter]);

  function handleSave(p: Product): void {
    if (editing) {
      setDb({ ...db, products: db.products.map((x) => (x.id === p.id ? p : x)) });
    } else {
      setDb({ ...db, products: [p, ...db.products] });
    }
    setShowForm(false);
    setEditing(null);
  }
  function handleDelete(id: string): void {
    setDb({ ...db, products: db.products.filter((p) => p.id !== id) });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input className="input" type="search" placeholder="🔍 Tìm sản phẩm / SKU..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1, maxWidth: 320 }} />
        <button type="button" className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm sản phẩm
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chưa có sản phẩm — bấm "Thêm sản phẩm" để tạo
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 10, textAlign: 'left' }}>Sản phẩm</th>
                <th style={{ padding: 10, textAlign: 'left' }}>SKU</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Giá nhập</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Giá bán</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Tồn</th>
                <th style={{ padding: 10, textAlign: 'center' }}>BH</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const lowStock = p.stock <= p.minStock;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{CATEGORY_LABEL[p.category]}{p.supplier ? ` · ${p.supplier}` : ''}</div>
                    </td>
                    <td style={{ padding: 10, fontFamily: 'monospace', fontSize: 12 }}>{p.sku}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.costPrice)}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.sellPrice)}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: lowStock ? '#DC2626' : 'inherit', fontWeight: lowStock ? 700 : 400 }}>
                        {p.stock} {lowStock && '⚠'}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}> / min {p.minStock}</span>
                    </td>
                    <td style={{ padding: 10, textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {p.warrantyMonths ? `${p.warrantyMonths}m` : '—'}
                    </td>
                    <td style={{ padding: 10, textAlign: 'right' }}>
                      <button type="button" className="icon-btn" onClick={() => { setEditing(p); setShowForm(true); }} title="Sửa">
                        <Edit2 style={{ width: 14, height: 14 }} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => handleDelete(p.id)} title="Xóa" style={{ color: '#DC2626' }}>
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

      {showForm && <ProductForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function ProductForm({ initial, onSave, onClose }: { initial: Product | null; onSave: (p: Product) => void; onClose: () => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [sku, setSku] = useState(initial?.sku ?? '');
  const [category, setCategory] = useState<ProductCategory>(initial?.category ?? 'phone');
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? 0);
  const [sellPrice, setSellPrice] = useState(initial?.sellPrice ?? 0);
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [minStock, setMinStock] = useState(initial?.minStock ?? 5);
  const [supplier, setSupplier] = useState(initial?.supplier ?? '');
  const [warrantyMonths, setWarrantyMonths] = useState(initial?.warrantyMonths ?? 12);
  const [note, setNote] = useState(initial?.note ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  function handleSubmit(): void {
    if (!name.trim()) return;
    const p: Product = {
      id: initial?.id ?? makeId(),
      name: name.trim(),
      sku: sku.trim() || `SKU${Date.now()}`,
      category,
      costPrice: Math.max(0, costPrice),
      sellPrice: Math.max(0, sellPrice),
      stock: Math.max(0, stock),
      minStock: Math.max(0, minStock),
      supplier: supplier.trim() || undefined,
      warrantyMonths: warrantyMonths > 0 ? warrantyMonths : undefined,
      note: note.trim() || undefined,
      active,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    onSave(p);
  }

  return (
    <ModalShell title={initial ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <FormField label="Tên sản phẩm"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: iPhone 15 Pro 256GB" autoFocus /></FormField>
        <FormField label="SKU"><input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="(auto)" /></FormField>
      </div>
      <FormField label="Loại">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ProductCategory)}>
          {(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Giá nhập (VND)"><input className="input" type="number" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value) || 0)} min={0} step={10000} /></FormField>
        <FormField label="Giá bán (VND)"><input className="input" type="number" value={sellPrice} onChange={(e) => setSellPrice(Number(e.target.value) || 0)} min={0} step={10000} /></FormField>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <FormField label="Tồn ban đầu"><input className="input" type="number" value={stock} onChange={(e) => setStock(Number(e.target.value) || 0)} min={0} /></FormField>
        <FormField label="Min stock"><input className="input" type="number" value={minStock} onChange={(e) => setMinStock(Number(e.target.value) || 0)} min={0} /></FormField>
        <FormField label="Bảo hành (tháng)"><input className="input" type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(Number(e.target.value) || 0)} min={0} /></FormField>
      </div>
      <FormField label="Nhà cung cấp"><input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="(optional)" /></FormField>
      <FormField label="Ghi chú"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" /></FormField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Sản phẩm đang bán
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!name.trim()}>{initial ? 'Lưu' : 'Tạo'}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// TX tab (Nhập / Xuất)
// ============================================================
function TxTab({ db, setDb }: { db: Db; setDb: (d: Db) => void }): JSX.Element {
  const [txForm, setTxForm] = useState<'in' | 'out' | null>(null);

  function handleAdd(tx: Tx): void {
    // Update stock
    const products = db.products.map((p) => {
      if (p.id !== tx.productId) return p;
      const delta = tx.type === 'in' ? tx.qty : -tx.qty;
      return { ...p, stock: Math.max(0, p.stock + delta) };
    });
    setDb({ ...db, txs: [tx, ...db.txs], products });
    setTxForm(null);

    // Phase 40.9 — Push vào sổ Tài chính
    const product = db.products.find((p) => p.id === tx.productId);
    const productName = product?.name ?? '(unknown)';
    const total = tx.qty * tx.unitPrice;
    addLedgerEntry({
      amount: total,
      kind: tx.type === 'in' ? 'chi' : 'thu',
      category: tx.type === 'in' ? 'khac_chi' : 'kinh_doanh',
      description:
        tx.type === 'in'
          ? `Nhập kho ${productName} × ${tx.qty}${tx.customerName ? ` (NCC: ${tx.customerName})` : ''}`
          : `Bán ${productName} × ${tx.qty}${tx.customerName ? ` (Khách: ${tx.customerName})` : ''}`,
      source: 'khodientu',
      refId: tx.id,
      date: tx.date,
    });
  }

  const recentTxs = useMemo(() => db.txs.slice(0, 50), [db.txs]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className="btn-primary" onClick={() => setTxForm('in')} style={{ background: '#10B981' }}>
          <ArrowDownToLine className="h-4 w-4" /> Nhập kho
        </button>
        <button type="button" className="btn-primary" onClick={() => setTxForm('out')} style={{ background: '#F59E0B' }}>
          <ArrowUpFromLine className="h-4 w-4" /> Xuất kho
        </button>
      </div>

      {recentTxs.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Chưa có giao dịch nào — bấm Nhập kho / Xuất kho để bắt đầu
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-row)' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Ngày</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Loại</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Sản phẩm</th>
                <th style={{ padding: 8, textAlign: 'right' }}>SL</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Đơn giá</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Tổng</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Khách / Note</th>
              </tr>
            </thead>
            <tbody>
              {recentTxs.map((tx) => {
                const p = db.products.find((pr) => pr.id === tx.productId);
                return (
                  <tr key={tx.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 8 }}>{tx.date}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tx.type === 'in' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: tx.type === 'in' ? '#065F46' : '#92400E' }}>
                        {tx.type === 'in' ? '⬇ NHẬP' : '⬆ XUẤT'}
                      </span>
                    </td>
                    <td style={{ padding: 8, fontWeight: 600 }}>{p?.name ?? '(deleted)'}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{tx.qty}</td>
                    <td style={{ padding: 8, textAlign: 'right', color: 'var(--color-text-muted)' }}>{formatMoney(tx.unitPrice)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{formatMoney(tx.qty * tx.unitPrice)}</td>
                    <td style={{ padding: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {tx.customerName ?? ''}{tx.note ? ` · ${tx.note}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {txForm && <TxForm type={txForm} db={db} onSave={handleAdd} onClose={() => setTxForm(null)} />}
    </div>
  );
}

function TxForm({ type, db, onSave, onClose }: { type: 'in' | 'out'; db: Db; onSave: (tx: Tx) => void; onClose: () => void }): JSX.Element {
  const [productId, setProductId] = useState(db.products[0]?.id ?? '');
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayStr());

  const product = db.products.find((p) => p.id === productId);

  // Auto-fill price
  useEffect(() => {
    if (product) {
      setUnitPrice(type === 'in' ? product.costPrice : product.sellPrice);
    }
  }, [productId, type, product]);

  function handleSubmit(): void {
    if (!productId || qty <= 0) return;
    if (type === 'out' && product && qty > product.stock) {
      alert(`Xuất ${qty} nhưng chỉ còn ${product.stock} trong kho!`);
      return;
    }
    const tx: Tx = {
      id: makeId(),
      productId,
      type,
      qty,
      unitPrice,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      note: note.trim() || undefined,
      date,
      createdAt: Date.now(),
    };
    onSave(tx);
  }

  return (
    <ModalShell title={type === 'in' ? '⬇ Nhập kho' : '⬆ Xuất kho'} onClose={onClose}>
      <FormField label="Sản phẩm">
        <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
          {db.products.filter((p) => p.active).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Tồn: {p.stock}</option>
          ))}
        </select>
      </FormField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FormField label="Số lượng"><input className="input" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} min={1} /></FormField>
        <FormField label="Đơn giá (VND)"><input className="input" type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value) || 0)} min={0} step={10000} /></FormField>
      </div>
      <FormField label="Ngày"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      <FormField label={type === 'in' ? 'Nhà cung cấp' : 'Khách hàng'}>
        <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="(optional)" />
      </FormField>
      <FormField label="SĐT"><input className="input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(optional)" /></FormField>
      <FormField label="Ghi chú"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="(optional)" /></FormField>

      <div style={{ padding: 12, background: 'var(--color-surface-row)', borderRadius: 10, marginTop: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Tổng tiền</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: type === 'in' ? '#065F46' : '#92400E' }}>{formatMoney(qty * unitPrice)}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!productId || qty <= 0} style={{ background: type === 'in' ? '#10B981' : '#F59E0B' }}>
          {type === 'in' ? '⬇ Nhập' : '⬆ Xuất'}
        </button>
      </div>
    </ModalShell>
  );
}

// ============================================================
// Stock tab
// ============================================================
function StockTab({ db }: { db: Db }): JSX.Element {
  const active = db.products.filter((p) => p.active);
  const lowStock = active.filter((p) => p.stock <= p.minStock);
  const sorted = [...active].sort((a, b) => a.stock - b.stock);

  return (
    <div>
      {lowStock.length > 0 && (
        <div className="card" style={{ padding: 14, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626' }} />
            <strong style={{ color: '#991B1B' }}>Cảnh báo: {lowStock.length} sản phẩm tồn thấp</strong>
          </div>
          <div style={{ fontSize: 12, color: '#991B1B' }}>
            {lowStock.slice(0, 5).map((p) => `${p.name} (${p.stock}/${p.minStock})`).join(' · ')}
            {lowStock.length > 5 && ` · +${lowStock.length - 5} khác`}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-row)', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Sản phẩm</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Tồn</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Giá nhập</th>
              <th style={{ padding: 10, textAlign: 'right' }}>Giá trị tồn</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>Chưa có sản phẩm</td></tr>
            ) : (
              sorted.map((p) => {
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{CATEGORY_LABEL[p.category]} · {p.sku}</div>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: low ? '#DC2626' : 'inherit' }}>{p.stock}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.costPrice)}</td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(p.stock * p.costPrice)}</td>
                    <td style={{ padding: 10, textAlign: 'center' }}>
                      {low ? (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(220,38,38,0.15)', color: '#991B1B' }}>⚠ Thấp</span>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#065F46' }}>✓ Đủ</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
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
