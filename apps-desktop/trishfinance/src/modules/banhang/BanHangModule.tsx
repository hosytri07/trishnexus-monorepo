/**
 * BanHangModule — Phase 23.4.
 *
 * Sub-pages: Dashboard / POS (giao dịch nhanh) / Sản phẩm / Đơn hàng / Khách hàng / Báo cáo / Cài đặt.
 *
 * Setup wizard lần đầu: chọn 1 trong 4 templates (Cafe / Tạp hóa / Siêu thị mini / Internet)
 * → seed sản phẩm mặc định + giá tham khảo.
 *
 * POS auto-feed Order paid → Ledger thu (chia sẻ với Tài chính cá nhân).
 */

import { useMemo, useState, type FormEvent } from 'react';
import {
  ShoppingCart, BarChart3 as ChartIcon, Receipt, Package, Users as UsersIcon, Settings as SettingsIcon,
  Plus, Edit3, Trash2, X, Search, AlertTriangle, CheckCircle2, Coffee, Store, ShoppingBag, Monitor,
  Printer, Minus, RefreshCcw, Sparkles, Download, Play, Square, Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { useFinanceDb, now, today, thisMonth, createId, money, moneyShort, dateVN, appendLog, escapeHtml, toCsv, downloadBlob, vietQrUrl } from '../../state';
import type { ShopTemplate, ShopProfile, Product, OrderLine, Order, OrderStatus, PayMethod, Customer, ComputerStation, StationSession, CafeTable } from '../../types';
import { VIETQR_BANKS } from '../../types';
import { useDialog } from '../../components/DialogProvider';
import { NumberInput } from '../../components/NumberInput';
import { ChevronDown } from 'lucide-react';

type SubPage = 'dashboard' | 'pos' | 'stations' | 'tables' | 'products' | 'orders' | 'customers' | 'report' | 'settings';

function getSubPages(template: ShopTemplate): Array<{ id: SubPage; icon: any; label: string }> {
  // Quán Internet → "Máy" thay cho POS
  if (template === 'internet') {
    return [
      { id: 'dashboard', icon: ChartIcon, label: 'Tổng quan' },
      { id: 'stations', icon: Monitor, label: 'Máy đang dùng' },
      { id: 'products', icon: Package, label: 'Menu phụ' },
      { id: 'orders', icon: Receipt, label: 'Đơn hàng' },
      { id: 'customers', icon: UsersIcon, label: 'Khách hàng' },
      { id: 'report', icon: ChartIcon, label: 'Báo cáo' },
      { id: 'settings', icon: SettingsIcon, label: 'Cài đặt' },
    ];
  }
  // Quán Cafe → có "Bàn" + POS (POS dùng cho mua về / khách lẻ)
  if (template === 'cafe') {
    return [
      { id: 'dashboard', icon: ChartIcon, label: 'Tổng quan' },
      { id: 'tables', icon: Coffee, label: 'Bàn' },
      { id: 'pos', icon: ShoppingCart, label: 'Order nhanh / Mua về' },
      { id: 'products', icon: Package, label: 'Sản phẩm' },
      { id: 'orders', icon: Receipt, label: 'Đơn hàng' },
      { id: 'customers', icon: UsersIcon, label: 'Khách hàng' },
      { id: 'report', icon: ChartIcon, label: 'Báo cáo' },
      { id: 'settings', icon: SettingsIcon, label: 'Cài đặt' },
    ];
  }
  // Tạp hoá / Siêu thị mini → POS bình thường
  return [
    { id: 'dashboard', icon: ChartIcon, label: 'Tổng quan' },
    { id: 'pos', icon: ShoppingCart, label: 'POS giao dịch' },
    { id: 'products', icon: Package, label: 'Sản phẩm' },
    { id: 'orders', icon: Receipt, label: 'Đơn hàng' },
    { id: 'customers', icon: UsersIcon, label: 'Khách hàng' },
    { id: 'report', icon: ChartIcon, label: 'Báo cáo' },
    { id: 'settings', icon: SettingsIcon, label: 'Cài đặt' },
  ];
}

export function BanHangModule(): JSX.Element {
  const [page, setPage] = useState<SubPage>('dashboard');
  const [wizardMode, setWizardMode] = useState(false);
  const finance = useFinanceDb();
  const { db } = finance;

  // Setup wizard nếu chưa có shop nào hoặc user trigger thêm shop mới
  if (db.shops.length === 0 || wizardMode) {
    return <SetupWizard finance={finance} onDone={() => setWizardMode(false)} hasExisting={db.shops.length > 0} />;
  }

  const activeShop = db.shops.find(s => s.id === db.activeShopId) || db.shops[0];
  const subPages = getSubPages(activeShop.template);

  // Auto-redirect nếu page không hợp lệ với template (VD đổi từ cafe sang internet)
  const validPageIds = subPages.map(p => p.id);
  if (!validPageIds.includes(page) && page !== 'dashboard') {
    setPage('dashboard');
  }

  return (
    <div>
      <ShopSwitcher finance={finance} activeShop={activeShop} onAddNew={() => setWizardMode(true)} />
      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 16, marginTop: 12 }}>
      <nav className="card" style={{ padding: 8, height: 'fit-content', position: 'sticky', top: 80 }}>
        {subPages.map(p => {
          const isActive = page === p.id;
          const Icon = p.icon;
          return (
            <button key={p.id} type="button" onClick={() => setPage(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              textAlign: 'left', border: 'none', cursor: 'pointer',
              background: isActive ? 'var(--color-accent-soft)' : 'transparent',
              color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              marginBottom: 2,
            }}>
              <Icon style={{ width: 16, height: 16 }} /> {p.label}
            </button>
          );
        })}
      </nav>

        <div style={{ minWidth: 0 }}>
          {page === 'dashboard' && <BHDashboard finance={finance} activeShop={activeShop} />}
          {page === 'pos' && activeShop.template !== 'internet' && <POSPage finance={finance} activeShop={activeShop} />}
          {page === 'stations' && activeShop.template === 'internet' && <StationsPage finance={finance} activeShop={activeShop} />}
          {page === 'tables' && activeShop.template === 'cafe' && <CafeTablesPage finance={finance} activeShop={activeShop} />}
          {page === 'products' && <ProductsPage finance={finance} activeShop={activeShop} />}
          {page === 'orders' && <OrdersPage finance={finance} activeShop={activeShop} />}
          {page === 'customers' && <CustomersPage finance={finance} />}
          {page === 'report' && <BHReportPage finance={finance} activeShop={activeShop} />}
          {page === 'settings' && <ShopSettingsPage finance={finance} activeShop={activeShop} />}
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// ShopSwitcher
// ==========================================================
function ShopSwitcher({ finance, activeShop, onAddNew }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; onAddNew: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [open, setOpen] = useState(false);

  const TEMPLATE_ICONS: Record<ShopTemplate, any> = { cafe: Coffee, taphoa: Store, sieuthi: ShoppingBag, internet: Monitor, custom: Store };
  const ActiveIcon = TEMPLATE_ICONS[activeShop.template];

  function selectShop(id: string) {
    update(d => { d.activeShopId = id; });
    setOpen(false);
  }

  async function handleDelete(id: string) {
    const shop = db.shops.find(s => s.id === id);
    if (!shop) return;
    if (db.shops.length === 1) {
      await dialog.alert('Không thể xoá cửa hàng duy nhất. Cần có ít nhất 1 cửa hàng.', { variant: 'warning' });
      return;
    }
    const ok = await dialog.confirm(`Xoá cửa hàng "${shop.name}"?\n\nTất cả sản phẩm + đơn hàng + dữ liệu liên quan của cửa hàng này sẽ BỊ XOÁ.`, { variant: 'danger', title: 'Xác nhận xoá cửa hàng', okLabel: 'Xoá vĩnh viễn' });
    if (!ok) return;
    update(d => {
      d.shops = d.shops.filter(s => s.id !== id);
      d.products = d.products.filter(p => p.shopId !== id);
      d.orders = d.orders.filter(o => o.shopId !== id);
      // Phase 23.9.G — cascade delete stations + sessions
      d.stations = d.stations.filter(s => s.shopId !== id);
      d.stationSessions = d.stationSessions.filter(s => s.shopId !== id);
      // Phase 23.9.H — cascade delete cafe tables
      d.cafeTables = d.cafeTables.filter(t => t.shopId !== id);
      if (d.activeShopId === id) d.activeShopId = d.shops[0]?.id || '';
      appendLog(d, `Xoá cửa hàng: ${shop.name}`, 'banhang');
    });
  }

  return (
    <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ActiveIcon style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04, fontWeight: 600 }}>Đang quản lý</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeShop.name}</div>
          {activeShop.address && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeShop.address}</div>}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <button className="btn-secondary" onClick={() => setOpen(v => !v)}>
          {db.shops.length > 1 ? `${db.shops.length} cửa hàng` : 'Quản lý'} <ChevronDown className="h-4 w-4" />
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 320, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 30, overflow: 'hidden' }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', padding: '4px 8px' }}>Cửa hàng ({db.shops.length})</div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {db.shops.map(s => {
                  const Icon = TEMPLATE_ICONS[s.template];
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: s.id === activeShop.id ? 'var(--color-accent-soft)' : 'transparent' }}>
                      <button type="button" onClick={() => selectShop(s.id)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon style={{ width: 16, height: 16, color: s.id === activeShop.id ? 'var(--color-accent-primary)' : 'var(--color-text-muted)', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: s.id === activeShop.id ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                            {s.template === 'cafe' && '☕ Cafe'}
                            {s.template === 'taphoa' && '🏪 Tạp hoá'}
                            {s.template === 'sieuthi' && '🛒 Siêu thị mini'}
                            {s.template === 'internet' && '🖥 Internet'}
                            {s.address ? ` · ${s.address}` : ''}
                          </div>
                        </div>
                      </button>
                      {s.id === activeShop.id && <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-accent-primary)' }} />}
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(s.id)} title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: 8 }}>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { onAddNew(); setOpen(false); }}>
                <Plus className="h-4 w-4" /> Mở cửa hàng mới (chọn template)
              </button>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 4 }}>Cửa hàng cũ vẫn được giữ nguyên</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// Setup wizard — chọn template
// ==========================================================
function SetupWizard({ finance, onDone, hasExisting }: { finance: ReturnType<typeof useFinanceDb>; onDone?: () => void; hasExisting?: boolean }): JSX.Element {
  const { update } = finance;
  const dialog = useDialog();
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');

  async function selectTemplate(template: ShopTemplate, info: { icon: any; name: string }) {
    const finalName = shopName.trim() || info.name;
    const ok = await dialog.confirm(`Mở cửa hàng "${finalName}"? App sẽ seed sản phẩm mặc định + giá tham khảo. Có thể xoá/chỉnh sửa sau.`, { variant: 'success', okLabel: 'Mở cửa hàng', title: 'Chọn template' });
    if (!ok) return;
    update(d => {
      const shopId = createId('shop');
      d.shops.push({
        id: shopId,
        template,
        name: finalName,
        address: shopAddress.trim(),
        phone: '',
        active: true,
        createdAt: now(),
      });
      d.activeShopId = shopId;
      const seedProds = SEED_PRODUCTS[template].map(p => ({
        ...p,
        id: createId('prod'),
        shopId,
        active: true,
        createdAt: now(),
      }));
      d.products.push(...seedProds);
      // Phase 23.9.G — Internet shop: seed 10 máy mặc định 8.000đ/giờ
      if (template === 'internet') {
        for (let i = 1; i <= 10; i++) {
          d.stations.push({
            id: createId('stn'),
            shopId,
            code: `M${String(i).padStart(2, '0')}`,
            ratePerHour: 8000,
            status: 'free',
            createdAt: now(),
          });
        }
        appendLog(d, `Mở quán Internet "${finalName}" — seed ${seedProds.length} sản phẩm + 10 máy`, 'banhang');
      } else if (template === 'cafe') {
        // Phase 23.9.H — Cafe: seed 8 bàn mặc định
        for (let i = 1; i <= 8; i++) {
          d.cafeTables.push({
            id: createId('tbl'),
            shopId,
            code: `B${String(i).padStart(2, '0')}`,
            capacity: 4,
            status: 'free',
            createdAt: now(),
          });
        }
        appendLog(d, `Mở quán Cafe "${finalName}" — seed ${seedProds.length} sản phẩm + 8 bàn`, 'banhang');
      } else {
        appendLog(d, `Mở cửa hàng "${finalName}" — seed ${seedProds.length} sản phẩm`, 'banhang');
      }
    });
    if (onDone) onDone();
  }

  const templates: Array<{ id: ShopTemplate; icon: any; name: string; desc: string; products: number }> = [
    { id: 'cafe', icon: Coffee, name: 'Quán Cafe', desc: 'Cà phê · Trà · Sinh tố · Đồ ăn nhẹ', products: SEED_PRODUCTS.cafe.length },
    { id: 'taphoa', icon: Store, name: 'Tạp hoá', desc: 'Nước ngọt · Mì gói · Bánh kẹo · Đồ dùng nhỏ', products: SEED_PRODUCTS.taphoa.length },
    { id: 'sieuthi', icon: ShoppingBag, name: 'Siêu thị mini', desc: 'Rau củ · Thịt · Gia vị · Đồ tươi · Hàng tiêu dùng', products: SEED_PRODUCTS.sieuthi.length },
    { id: 'internet', icon: Monitor, name: 'Quán Internet / Cyber', desc: 'Tính giờ máy · Đồ ăn vặt · Nước uống', products: SEED_PRODUCTS.internet.length },
  ];

  return (
    <div className="space-y-4">
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <Sparkles style={{ width: 48, height: 48, color: 'var(--color-accent-primary)', margin: '0 auto', display: 'block' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>{hasExisting ? 'Mở thêm cửa hàng mới' : 'Chào mừng tới Quản lý bán hàng!'}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>Chọn loại hình kinh doanh để app tự seed sản phẩm + giá tham khảo cho bạn. Có thể chỉnh sửa toàn bộ sau.</p>
        {hasExisting && onDone && (
          <button type="button" className="btn-secondary" onClick={onDone} style={{ marginTop: 12 }}>← Quay lại danh sách cửa hàng</button>
        )}
      </div>

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Đặt tên cho cửa hàng (tùy chọn)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Tên cửa hàng</label>
            <input className="input-field" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="VD: Cafe Trí, Tạp hoá Anh Hai..." />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Địa chỉ</label>
            <input className="input-field" value={shopAddress} onChange={e => setShopAddress(e.target.value)} placeholder="VD: 123 Lê Lợi, Q.1, TP.HCM" />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>Bỏ trống → dùng tên template mặc định</div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {templates.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => selectTemplate(t.id, { icon: t.icon, name: t.name })} className="card" style={{ padding: 20, textAlign: 'left', cursor: 'pointer', border: '2px solid var(--color-border-subtle)', transition: 'all 200ms' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.background = 'var(--color-accent-soft)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; e.currentTarget.style.background = 'var(--color-surface-card)'; }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 28, height: 28 }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: 'var(--color-accent-primary)', marginTop: 8, fontWeight: 600 }}>{t.products} sản phẩm mẫu</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================================
// Seed products theo template
// ==========================================================
type SeedProduct = Omit<Product, 'id' | 'active' | 'createdAt'>;

const SEED_PRODUCTS: Record<ShopTemplate, SeedProduct[]> = {
  cafe: [
    { sku: 'CF001', name: 'Cà phê đen', category: 'Cà phê', unit: 'ly', costPrice: 8000, salePrice: 18000, stock: 100, minStock: 20 },
    { sku: 'CF002', name: 'Cà phê sữa', category: 'Cà phê', unit: 'ly', costPrice: 10000, salePrice: 22000, stock: 100, minStock: 20 },
    { sku: 'CF003', name: 'Bạc xỉu', category: 'Cà phê', unit: 'ly', costPrice: 12000, salePrice: 25000, stock: 100, minStock: 20 },
    { sku: 'TR001', name: 'Trà sữa trân châu', category: 'Trà', unit: 'ly', costPrice: 15000, salePrice: 30000, stock: 80, minStock: 15 },
    { sku: 'TR002', name: 'Trà đào cam sả', category: 'Trà', unit: 'ly', costPrice: 12000, salePrice: 28000, stock: 80, minStock: 15 },
    { sku: 'TR003', name: 'Trà chanh', category: 'Trà', unit: 'ly', costPrice: 8000, salePrice: 20000, stock: 100, minStock: 20 },
    { sku: 'ST001', name: 'Sinh tố bơ', category: 'Sinh tố', unit: 'ly', costPrice: 18000, salePrice: 35000, stock: 50, minStock: 10 },
    { sku: 'ST002', name: 'Sinh tố xoài', category: 'Sinh tố', unit: 'ly', costPrice: 15000, salePrice: 32000, stock: 50, minStock: 10 },
    { sku: 'BG001', name: 'Bánh mì pate', category: 'Bánh', unit: 'ổ', costPrice: 10000, salePrice: 20000, stock: 30, minStock: 5 },
    { sku: 'BG002', name: 'Bánh ngọt', category: 'Bánh', unit: 'cái', costPrice: 12000, salePrice: 25000, stock: 30, minStock: 5 },
  ],
  taphoa: [
    { sku: 'NG001', name: 'Coca-cola lon 330ml', category: 'Nước ngọt', unit: 'lon', costPrice: 8000, salePrice: 12000, stock: 100, minStock: 20 },
    { sku: 'NG002', name: 'Pepsi lon 330ml', category: 'Nước ngọt', unit: 'lon', costPrice: 8000, salePrice: 12000, stock: 100, minStock: 20 },
    { sku: 'NG003', name: 'Sting đỏ', category: 'Nước ngọt', unit: 'chai', costPrice: 9000, salePrice: 14000, stock: 80, minStock: 15 },
    { sku: 'NS001', name: 'Nước suối Lavie 500ml', category: 'Nước suối', unit: 'chai', costPrice: 4500, salePrice: 7000, stock: 200, minStock: 30 },
    { sku: 'MG001', name: 'Mì Hảo Hảo', category: 'Mì gói', unit: 'gói', costPrice: 3500, salePrice: 5000, stock: 100, minStock: 20 },
    { sku: 'MG002', name: 'Mì 3 Miền', category: 'Mì gói', unit: 'gói', costPrice: 3000, salePrice: 4500, stock: 100, minStock: 20 },
    { sku: 'MG003', name: 'Phở Vifon', category: 'Mì gói', unit: 'tô', costPrice: 8000, salePrice: 13000, stock: 50, minStock: 10 },
    { sku: 'BK001', name: 'Bánh quy Cosy', category: 'Bánh kẹo', unit: 'gói', costPrice: 12000, salePrice: 18000, stock: 50, minStock: 10 },
    { sku: 'BK002', name: 'Kẹo dẻo Haribo', category: 'Bánh kẹo', unit: 'gói', costPrice: 18000, salePrice: 25000, stock: 30, minStock: 5 },
    { sku: 'TT001', name: 'Bao thuốc lá Vinataba', category: 'Thuốc lá', unit: 'bao', costPrice: 22000, salePrice: 28000, stock: 50, minStock: 10 },
    { sku: 'GD001', name: 'Bột giặt OMO 800g', category: 'Đồ dùng', unit: 'gói', costPrice: 45000, salePrice: 58000, stock: 30, minStock: 5 },
    { sku: 'GD002', name: 'Nước rửa chén Sunlight', category: 'Đồ dùng', unit: 'chai', costPrice: 25000, salePrice: 35000, stock: 30, minStock: 5 },
  ],
  sieuthi: [
    { sku: 'RC001', name: 'Rau muống', category: 'Rau củ', unit: 'bó', costPrice: 5000, salePrice: 10000, stock: 30, minStock: 10 },
    { sku: 'RC002', name: 'Cà chua', category: 'Rau củ', unit: 'kg', costPrice: 15000, salePrice: 25000, stock: 20, minStock: 5 },
    { sku: 'RC003', name: 'Khoai tây', category: 'Rau củ', unit: 'kg', costPrice: 18000, salePrice: 28000, stock: 30, minStock: 8 },
    { sku: 'RC004', name: 'Cà rốt', category: 'Rau củ', unit: 'kg', costPrice: 12000, salePrice: 22000, stock: 25, minStock: 8 },
    { sku: 'TT001', name: 'Thịt heo ba chỉ', category: 'Thịt tươi', unit: 'kg', costPrice: 130000, salePrice: 160000, stock: 15, minStock: 5 },
    { sku: 'TT002', name: 'Thịt bò bít tết', category: 'Thịt tươi', unit: 'kg', costPrice: 280000, salePrice: 350000, stock: 10, minStock: 3 },
    { sku: 'TT003', name: 'Cá hồi philê', category: 'Hải sản', unit: 'kg', costPrice: 350000, salePrice: 450000, stock: 8, minStock: 2 },
    { sku: 'GV001', name: 'Nước mắm Nam Ngư 750ml', category: 'Gia vị', unit: 'chai', costPrice: 35000, salePrice: 48000, stock: 30, minStock: 8 },
    { sku: 'GV002', name: 'Dầu ăn Tường An 1L', category: 'Gia vị', unit: 'chai', costPrice: 45000, salePrice: 58000, stock: 30, minStock: 8 },
    { sku: 'GV003', name: 'Bột ngọt Ajinomoto', category: 'Gia vị', unit: 'gói', costPrice: 22000, salePrice: 30000, stock: 25, minStock: 5 },
    { sku: 'GS001', name: 'Sữa tươi Vinamilk hộp 1L', category: 'Sữa', unit: 'hộp', costPrice: 28000, salePrice: 38000, stock: 40, minStock: 10 },
    { sku: 'GS002', name: 'Sữa chua Vinamilk', category: 'Sữa', unit: 'lốc', costPrice: 25000, salePrice: 32000, stock: 30, minStock: 8 },
    { sku: 'GD001', name: 'Giấy vệ sinh Pulppy 10 cuộn', category: 'Đồ dùng', unit: 'túi', costPrice: 38000, salePrice: 48000, stock: 25, minStock: 5 },
    { sku: 'GD002', name: 'Khăn giấy ăn Watersilk', category: 'Đồ dùng', unit: 'gói', costPrice: 12000, salePrice: 18000, stock: 50, minStock: 10 },
  ],
  internet: [
    { sku: 'GIO01', name: 'Giờ máy thường (1h)', category: 'Giờ máy', unit: 'giờ', costPrice: 0, salePrice: 8000, stock: 9999, minStock: 0 },
    { sku: 'GIO02', name: 'Giờ máy VIP (1h)', category: 'Giờ máy', unit: 'giờ', costPrice: 0, salePrice: 12000, stock: 9999, minStock: 0 },
    { sku: 'GIO03', name: 'Combo 3h máy thường', category: 'Giờ máy', unit: 'gói', costPrice: 0, salePrice: 20000, stock: 9999, minStock: 0 },
    { sku: 'GIO04', name: 'Combo 5h máy thường', category: 'Giờ máy', unit: 'gói', costPrice: 0, salePrice: 30000, stock: 9999, minStock: 0 },
    { sku: 'NU001', name: 'Coca-cola lon', category: 'Nước uống', unit: 'lon', costPrice: 8000, salePrice: 12000, stock: 50, minStock: 10 },
    { sku: 'NU002', name: 'Sting đỏ', category: 'Nước uống', unit: 'chai', costPrice: 9000, salePrice: 14000, stock: 50, minStock: 10 },
    { sku: 'NU003', name: 'Bò húc Red Bull', category: 'Nước uống', unit: 'lon', costPrice: 12000, salePrice: 18000, stock: 40, minStock: 10 },
    { sku: 'NU004', name: 'Nước suối Lavie', category: 'Nước uống', unit: 'chai', costPrice: 4500, salePrice: 7000, stock: 100, minStock: 20 },
    { sku: 'AV001', name: 'Mì tô Hảo Hảo (úp ly)', category: 'Đồ ăn', unit: 'tô', costPrice: 5000, salePrice: 12000, stock: 50, minStock: 10 },
    { sku: 'AV002', name: 'Bim bim Oishi', category: 'Đồ ăn', unit: 'gói', costPrice: 4000, salePrice: 8000, stock: 80, minStock: 15 },
    { sku: 'AV003', name: 'Hạt hướng dương', category: 'Đồ ăn', unit: 'gói', costPrice: 6000, salePrice: 10000, stock: 50, minStock: 10 },
    { sku: 'TL001', name: 'Thuốc lá Vinataba', category: 'Khác', unit: 'bao', costPrice: 22000, salePrice: 28000, stock: 30, minStock: 5 },
  ],
  custom: [],
};

// ==========================================================
// Dashboard Bán hàng
// ==========================================================
function BHDashboard({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db } = finance;
  const tm = thisMonth();

  const stats = useMemo(() => {
    const monthOrders = db.orders.filter(o => {
      if (o.shopId !== activeShop.id) return false;
      const d = new Date(o.date);
      return d.getMonth() + 1 === tm.thang && d.getFullYear() === tm.nam && o.status === 'paid';
    });
    const todayOrders = db.orders.filter(o => o.shopId === activeShop.id && o.date === today() && o.status === 'paid');
    const lowStock = db.products.filter(p => p.shopId === activeShop.id && p.active && p.stock <= p.minStock);
    const revenue = monthOrders.reduce((s, o) => s + o.total, 0);
    const cogs = monthOrders.reduce((s, o) => s + o.lines.reduce((x, l) => {
      const p = db.products.find(pr => pr.id === l.productId);
      return x + (p ? p.costPrice * l.quantity : 0);
    }, 0), 0);
    return {
      orders: monthOrders.length,
      revenue,
      profit: revenue - cogs,
      todayRevenue: todayOrders.reduce((s, o) => s + o.total, 0),
      lowStock: lowStock.length,
      products: db.products.filter(p => p.shopId === activeShop.id && p.active).length,
    };
  }, [db.orders, db.products, tm.thang, tm.nam, activeShop.id]);

  const dailyData = useMemo(() => {
    const out: any[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const ord = db.orders.filter(o => o.shopId === activeShop.id && o.date === iso && o.status === 'paid');
      out.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        revenue: ord.reduce((s, o) => s + o.total, 0),
        orders: ord.length,
      });
    }
    return out;
  }, [db.orders, activeShop.id]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of db.orders.filter(o => o.shopId === activeShop.id && o.status === 'paid')) {
      for (const l of o.lines) {
        const x = map.get(l.productId) || { name: l.productName, qty: 0, revenue: 0 };
        x.qty += l.quantity;
        x.revenue += l.amount;
        map.set(l.productId, x);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [db.orders, activeShop.id]);

  return (
    <div className="space-y-4">
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat icon={Receipt} label="Doanh thu hôm nay" value={money(stats.todayRevenue)} hint={today()} color="emerald" />
        <Stat icon={Receipt} label={`Doanh thu T${tm.thang}`} value={money(stats.revenue)} hint={`${stats.orders} đơn`} color="emerald" />
        <Stat icon={ChartIcon} label={`Lãi gộp T${tm.thang}`} value={money(stats.profit)} hint="Doanh thu - Giá vốn" color="emerald" />
        <Stat icon={Package} label="Sản phẩm" value={stats.products} hint={`${stats.lowStock} tồn thấp`} color={stats.lowStock > 0 ? 'amber' : 'blue'} />
      </div>

      <div className="card">
        <h2 className="card-title">Doanh thu 7 ngày qua</h2>
        <div style={{ height: 220, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
              <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
              <ReTooltip formatter={(v: number) => money(v)} contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, color: 'var(--color-text-primary)', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <div className="card">
          <h2 className="card-title">Top sản phẩm bán chạy</h2>
          {topProducts.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>Chưa có đơn hàng nào.</div>
          ) : (
            <div className="space-y-2 mt-2">
              {topProducts.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 100px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-row)' }}>
                  <span style={{ fontSize: 18 }}>{['🥇', '🥈', '🥉', '🏅', '🏅'][i]}</span>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>{p.qty} bán</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{money(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Cảnh báo tồn kho thấp</h2>
          {stats.lowStock === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>✓ Tất cả sản phẩm đủ tồn.</div>
          ) : (
            <div className="space-y-2 mt-2">
              {db.products.filter(p => p.shopId === activeShop.id && p.active && p.stock <= p.minStock).slice(0, 5).map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ textAlign: 'right', fontSize: 12, color: '#ef4444' }}>Còn {p.stock} {p.unit}</span>
                  <span style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-muted)' }}>Min {p.minStock}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, color }: { icon: any; label: string; value: any; hint?: string; color: 'emerald' | 'red' | 'amber' | 'blue' }): JSX.Element {
  const colors: Record<string, { bg: string; fg: string }> = {
    emerald: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981' },
    red: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' },
    amber: { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b' },
    blue: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6' },
  };
  const c = colors[color];
  return (
    <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4 }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</div>}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

// ==========================================================
// POS — giao dịch nhanh
// ==========================================================
function POSPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || '');
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState(0);
  const [note, setNote] = useState('');
  // Phase 23.9.F — Cafe dual mode
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout'>('takeout');
  const [tableNumber, setTableNumber] = useState('');

  const shopProducts = useMemo(() => db.products.filter(p => p.shopId === activeShop.id), [db.products, activeShop.id]);
  const categories = useMemo(() => Array.from(new Set(shopProducts.filter(p => p.active).map(p => p.category))), [shopProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shopProducts.filter(p => {
      if (!p.active) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return [p.name, p.sku].some(x => x.toLowerCase().includes(q));
    });
  }, [shopProducts, search, category]);

  function addToCart(p: Product) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1, amount: (next[idx].quantity + 1) * next[idx].unitPrice - next[idx].discount };
        return next;
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.salePrice, discount: 0, amount: p.salePrice }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.productId === productId);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter(l => l.productId !== productId);
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty, amount: newQty * next[idx].unitPrice - next[idx].discount };
      return next;
    });
  }

  function removeLine(productId: string) {
    setCart(prev => prev.filter(l => l.productId !== productId));
  }

  const subtotal = cart.reduce((s, l) => s + l.amount, 0);
  const discount = discountMode === 'percent'
    ? Math.round(subtotal * Math.min(100, Math.max(0, discountInput)) / 100)
    : Math.min(subtotal, Math.max(0, discountInput));
  const total = Math.max(0, subtotal - discount);

  const [showQrModal, setShowQrModal] = useState(false);

  async function handleCheckout() {
    if (cart.length === 0) { await dialog.alert('Giỏ hàng trống', { variant: 'warning' }); return; }
    // Nếu chuyển khoản + có tài khoản ngân hàng → hiển thị QR VietQR
    const acc = accountId ? db.accounts.find(a => a.id === accountId) : null;
    if (payMethod === 'transfer' && acc && acc.kind === 'bank' && acc.bankCode && acc.accountNumber) {
      setShowQrModal(true);
      return;
    }
    const ok = await dialog.confirm(`Xác nhận đơn ${money(total)}?`, { variant: 'success', okLabel: 'Thanh toán' });
    if (!ok) return;
    finalizeOrder();
  }

  function finalizeOrder() {
    const orderCode = `ORD${Date.now()}`;
    update(d => {
      const order: Order = {
        id: createId('ord'),
        shopId: activeShop.id,
        code: orderCode,
        date: today(),
        customerId: customerId || undefined,
        lines: cart,
        subtotal, discount, tax: 0, total,
        payMethod, paidAccountId: accountId || undefined,
        status: 'paid', note,
        orderType: activeShop.template === 'cafe' ? orderType : undefined,
        tableNumber: activeShop.template === 'cafe' && orderType === 'dine_in' ? tableNumber.trim() : undefined,
        createdAt: now(),
      };
      d.orders.unshift(order);
      // Trừ tồn kho
      for (const l of cart) {
        const idx = d.products.findIndex(p => p.id === l.productId);
        if (idx >= 0) d.products[idx].stock -= l.quantity;
      }
      // Update khách
      if (customerId) {
        const cidx = d.customers.findIndex(c => c.id === customerId);
        if (cidx >= 0) {
          d.customers[cidx].totalSpent += total;
          d.customers[cidx].loyaltyPoints += Math.floor(total / 10000);
        }
      }
      // Auto Ledger thu
      if (payMethod !== 'debt') {
        d.ledger.unshift({
          id: createId('ledg'), date: today(), kind: 'thu', category: 'kinh_doanh',
          amount: total, description: `[POS] Đơn ${orderCode}`,
          accountId: accountId || undefined, fromModule: 'banhang', refId: order.id, createdAt: now(),
        });
      }
      appendLog(d, `POS đơn ${orderCode}: ${cart.length} món, ${money(total)}`, 'banhang');
    });
    // Reset cart
    const finalTotal = total;
    setCart([]);
    setDiscountInput(0);
    setDiscountMode('amount');
    setCustomerId('');
    setNote('');
    setTableNumber('');
    setOrderType('takeout');
    setShowQrModal(false);
    dialog.alert(`✓ Đã ghi nhận đơn ${money(finalTotal)}`, { variant: 'success', title: 'Thành công' });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      {/* Product grid */}
      <div className="space-y-3">
        <div className="card">
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 200px' }}>
            <div style={{ position: 'relative' }}>
              <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
              <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm sản phẩm, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select-field" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">Tất cả category</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {filteredProducts.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <Package style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Không có sản phẩm nào.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {filteredProducts.map(p => (
              <button key={p.id} type="button" onClick={() => addToCart(p)} style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{p.sku} · {p.category}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 4 }}>{money(p.salePrice)}</div>
                <div style={{ fontSize: 10, color: p.stock <= p.minStock ? '#ef4444' : 'var(--color-text-muted)' }}>Tồn: {p.stock}{p.stock <= p.minStock ? ' ⚠' : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="card" style={{ position: 'sticky', top: 80, height: 'fit-content', maxHeight: 'calc(100vh - 100px)', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-2">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>🛒 Giỏ hàng ({cart.length})</h3>
          {cart.length > 0 && <button className="btn-secondary" onClick={() => setCart([])} style={{ padding: '4px 8px', fontSize: 11 }}>Xoá hết</button>}
        </div>

        {cart.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>Click sản phẩm để thêm vào giỏ.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cart.map(l => (
              <div key={l.productId} style={{ background: 'var(--color-surface-row)', borderRadius: 8, padding: 8 }}>
                <div className="flex justify-between items-start">
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, marginRight: 8 }}>{l.productName}</span>
                  <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => removeLine(l.productId)}><X className="h-3 w-3" /></button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2">
                    <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => changeQty(l.productId, -1)}><Minus className="h-3 w-3" /></button>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{l.quantity}</span>
                    <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => changeQty(l.productId, 1)}><Plus className="h-3 w-3" /></button>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent-primary)' }}>{money(l.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <>
            {activeShop.template === 'cafe' && (
              <div className="rounded-xl p-2 mt-3" style={{ background: 'var(--color-surface-row)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Loại đơn</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <button type="button" onClick={() => setOrderType('dine_in')} style={{ padding: '8px', borderRadius: 8, border: '2px solid ' + (orderType === 'dine_in' ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'), background: orderType === 'dine_in' ? 'var(--color-accent-soft)' : 'transparent', color: orderType === 'dine_in' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    🪑 Tại quán
                  </button>
                  <button type="button" onClick={() => setOrderType('takeout')} style={{ padding: '8px', borderRadius: 8, border: '2px solid ' + (orderType === 'takeout' ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'), background: orderType === 'takeout' ? 'var(--color-accent-soft)' : 'transparent', color: orderType === 'takeout' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    🥡 Mua về
                  </button>
                </div>
                {orderType === 'dine_in' && (
                  <input className="input-field" style={{ marginTop: 6 }} placeholder="Bàn số (VD: B1, B2...)" value={tableNumber} onChange={e => setTableNumber(e.target.value)} />
                )}
              </div>
            )}
            <div className="space-y-2 mt-3">
              <div className="flex justify-between text-sm">
                <span>Tạm tính</span><b>{money(subtotal)}</b>
              </div>
              <Field label="Giảm giá">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 6 }}>
                  <NumberInput
                    value={discountInput}
                    onChange={n => setDiscountInput(n)}
                    min={0}
                    max={discountMode === 'percent' ? 100 : subtotal}
                    suffix={discountMode === 'percent' ? '%' : 'đ'}
                  />
                  <select className="select-field" value={discountMode} onChange={e => { setDiscountMode(e.target.value as any); setDiscountInput(0); }}>
                    <option value="amount">đ</option>
                    <option value="percent">%</option>
                  </select>
                </div>
                {discount > 0 && (
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                    {discountMode === 'percent' ? `${discountInput}% = ` : ''}-{money(discount)}
                  </div>
                )}
              </Field>
              <div className="rounded-xl p-3" style={{ background: 'var(--color-accent-soft)' }}>
                <div className="flex justify-between" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                  <span>TỔNG</span><span>{money(total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-3">
              <Field label="Khách hàng (tuỳ chọn)">
                <select className="select-field" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Khách lẻ</option>
                  {db.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </Field>
              <Field label="Hình thức TT">
                <select className="select-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PayMethod)}>
                  <option value="cash">💵 Tiền mặt</option>
                  <option value="transfer">🏦 Chuyển khoản</option>
                  <option value="wallet">👛 Ví điện tử</option>
                  <option value="debt">⏳ Ghi nợ</option>
                </select>
              </Field>
              {payMethod !== 'debt' && (
                <Field label="Tài khoản nhận">
                  <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    <option value="">--</option>
                    {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Ghi chú"><input className="input-field" value={note} onChange={e => setNote(e.target.value)} /></Field>
            </div>

            <button className="btn-primary mt-3" onClick={handleCheckout} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}>
              <CheckCircle2 className="h-5 w-5" /> Thanh toán {money(total)}
            </button>
          </>
        )}
      </div>

      {showQrModal && (() => {
        const acc = db.accounts.find(a => a.id === accountId);
        if (!acc || !acc.bankCode || !acc.accountNumber) { setShowQrModal(false); return null; }
        const bankName = VIETQR_BANKS.find(b => b.code === acc.bankCode)?.name || acc.bankCode;
        const qrUrl = vietQrUrl({ bankCode: acc.bankCode, accountNumber: acc.accountNumber, accountName: acc.accountName || '', amount: total, message: `POS ${activeShop.name}` });
        return (
          <Modal title="Quét QR để thanh toán" onClose={() => setShowQrModal(false)}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: 12, borderRadius: 12, display: 'inline-block', marginBottom: 12 }}>
                <img src={qrUrl} alt="VietQR" style={{ width: 240, height: 240, display: 'block' }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{bankName} · {acc.accountNumber}</div>
              {acc.accountName && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{acc.accountName}</div>}
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 8 }}>{money(total)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Khách quét QR → kiểm tra app NH nhận → click "Đã nhận tiền"</div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn-secondary" onClick={() => setShowQrModal(false)} style={{ flex: 1 }}>Huỷ</button>
              <button type="button" className="btn-primary" onClick={finalizeOrder} style={{ flex: 2, justifyContent: 'center' }}>
                <CheckCircle2 className="h-4 w-4" /> Đã nhận tiền — Ghi đơn
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// ==========================================================
// Sản phẩm
// ==========================================================
function ProductsPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const shopProducts = useMemo(() => db.products.filter(p => p.shopId === activeShop.id), [db.products, activeShop.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shopProducts.filter(p => !q || [p.name, p.sku, p.category].some(x => x.toLowerCase().includes(q)));
  }, [shopProducts, search]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá sản phẩm?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.products = d.products.filter(p => p.id !== id); appendLog(d, 'Xoá sản phẩm', 'banhang'); });
  }

  function toggleActive(id: string) {
    update(d => { const idx = d.products.findIndex(p => p.id === id); if (idx >= 0) d.products[idx].active = !d.products[idx].active; });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sản phẩm</h2>
            <p className="card-subtitle">{shopProducts.length} sản phẩm · {shopProducts.filter(p => p.active).length} đang bán · {shopProducts.filter(p => p.active && p.stock <= p.minStock).length} tồn thấp</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm SP</button>
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm tên, SKU, category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Package style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Không có sản phẩm.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>SKU</th><th>Tên</th><th>Category</th><th>Đơn vị</th><th>Giá nhập</th><th>Giá bán</th><th>Lãi</th><th>Tồn</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {filtered.map(p => {
                  const profit = p.salePrice - p.costPrice;
                  const lowStock = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.sku}</td>
                      <td><b>{p.name}</b></td>
                      <td style={{ fontSize: 12 }}>{p.category}</td>
                      <td style={{ fontSize: 12 }}>{p.unit}</td>
                      <td>{money(p.costPrice)}</td>
                      <td><b>{money(p.salePrice)}</b></td>
                      <td style={{ color: '#10b981', fontWeight: 600 }}>+{money(profit)}</td>
                      <td><b style={{ color: lowStock ? '#ef4444' : undefined }}>{p.stock}{lowStock && ' ⚠'}</b><div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>min {p.minStock}</div></td>
                      <td>{p.active ? <span className="badge badge-green">Đang bán</span> : <span className="badge badge-gray">Tạm dừng</span>}</td>
                      <td><div className="flex gap-1">
                        <button className="icon-btn" onClick={() => toggleActive(p.id)} title={p.active ? 'Tạm dừng' : 'Bán lại'}>{p.active ? <X className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</button>
                        <button className="icon-btn" onClick={() => setEditing(p)}><Edit3 className="h-3.5 w-3.5" /></button>
                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editing) && <ProductModal finance={finance} activeShop={activeShop} editing={editing} onClose={() => { setShowCreate(false); setEditing(null); }} />}
    </div>
  );
}

function ProductModal({ finance, activeShop, editing, onClose }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; editing: Product | null; onClose: () => void }): JSX.Element {
  const { update } = finance;
  const dialog = useDialog();
  const [form, setForm] = useState<Product>(editing ?? {
    id: '', shopId: activeShop.id, sku: '', name: '', category: '', unit: 'cái', costPrice: 0, salePrice: 0, stock: 0, minStock: 5, imageUrl: '', active: true, createdAt: '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) { await dialog.alert('Nhập SKU + tên', { variant: 'warning' }); return; }
    update(d => {
      if (editing) {
        d.products = d.products.map(p => p.id === editing.id ? { ...form } : p);
        appendLog(d, `Cập nhật SP: ${form.name}`, 'banhang');
      } else {
        d.products.push({ ...form, id: createId('prod'), shopId: activeShop.id, createdAt: now() });
        appendLog(d, `Thêm SP: ${form.name}`, 'banhang');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa SP: ${editing.name}` : 'Thêm sản phẩm'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label="SKU *"><input className="input-field" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="CF001" /></Field>
          <Field label="Đơn vị"><input className="input-field" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="ly, kg, gói" /></Field>
        </div>
        <Field label="Tên sản phẩm *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Category"><input className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Cà phê, Đồ ăn" /></Field>
        <div className="form-grid">
          <Field label="Giá nhập"><NumberInput value={form.costPrice} onChange={n => setForm({ ...form, costPrice: n })} suffix="đ" min={0} /></Field>
          <Field label="Giá bán *"><NumberInput value={form.salePrice} onChange={n => setForm({ ...form, salePrice: n })} suffix="đ" min={0} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Tồn kho"><NumberInput value={form.stock} onChange={n => setForm({ ...form, stock: n })} min={0} /></Field>
          <Field label="Min tồn (cảnh báo)"><NumberInput value={form.minStock} onChange={n => setForm({ ...form, minStock: n })} min={0} /></Field>
        </div>
        <Field label="Ảnh sản phẩm (link Drive)"><input className="input-field" value={form.imageUrl || ''} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://trishteam.io.vn/share/..." /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm SP'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Đơn hàng
// ==========================================================
function OrdersPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [viewing, setViewing] = useState<Order | null>(null);

  const shopOrders = useMemo(() => db.orders.filter(o => o.shopId === activeShop.id), [db.orders, activeShop.id]);
  const filtered = useMemo(() => filterStatus === 'all' ? shopOrders : shopOrders.filter(o => o.status === filterStatus), [shopOrders, filterStatus]);

  async function cancelOrder(o: Order) {
    if (o.status === 'canceled') return;
    const ok = await dialog.confirm(`Huỷ đơn ${o.code}? Tồn kho sẽ được trả lại.`, { variant: 'danger', okLabel: 'Huỷ đơn' });
    if (!ok) return;
    update(d => {
      const idx = d.orders.findIndex(x => x.id === o.id);
      if (idx < 0) return;
      d.orders[idx].status = 'canceled';
      // Trả tồn kho
      for (const l of o.lines) {
        const pidx = d.products.findIndex(p => p.id === l.productId);
        if (pidx >= 0) d.products[pidx].stock += l.quantity;
      }
      // Xoá ledger nếu có
      d.ledger = d.ledger.filter(l => l.refId !== o.id);
      appendLog(d, `Huỷ đơn ${o.code}`, 'banhang');
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Đơn hàng</h2>
            <p className="card-subtitle">{shopOrders.length} đơn · {shopOrders.filter(o => o.status === 'paid').length} đã TT · Tổng DT: <b>{money(shopOrders.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0))}</b></p>
          </div>
        </div>
        <select className="select-field" style={{ marginTop: 10, maxWidth: 240 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
          <option value="all">Tất cả</option>
          <option value="paid">Đã TT</option>
          <option value="pending">Chờ TT (nợ)</option>
          <option value="canceled">Đã huỷ</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Receipt style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có đơn nào ở cửa hàng "{activeShop.name}".</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Mã</th><th>Ngày</th>{activeShop.template === 'cafe' && <th>Loại</th>}<th>Khách</th><th>Số món</th><th>Tổng</th><th>TT</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {filtered.map(o => {
                  const cust = o.customerId ? db.customers.find(c => c.id === o.customerId) : null;
                  return (
                    <tr key={o.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{o.code}</td>
                      <td>{dateVN(o.date)}</td>
                      {activeShop.template === 'cafe' && (
                        <td style={{ fontSize: 12 }}>{o.orderType === 'dine_in' ? `🪑 Tại quán${o.tableNumber ? ` ${o.tableNumber}` : ''}` : '🥡 Mua về'}</td>
                      )}
                      <td>{cust?.name || 'Khách lẻ'}</td>
                      <td>{o.lines.length}</td>
                      <td><b>{money(o.total)}</b></td>
                      <td style={{ fontSize: 12 }}>{o.payMethod === 'cash' ? '💵' : o.payMethod === 'transfer' ? '🏦' : o.payMethod === 'wallet' ? '👛' : '⏳'} {o.payMethod}</td>
                      <td><span className={`badge ${o.status === 'paid' ? 'badge-green' : o.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>{o.status === 'paid' ? 'Đã TT' : o.status === 'pending' ? 'Chờ' : 'Huỷ'}</span></td>
                      <td><div className="flex gap-1">
                        <button className="icon-btn" onClick={() => setViewing(o)} title="Xem / In"><Receipt className="h-3.5 w-3.5" /></button>
                        {o.status !== 'canceled' && <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => cancelOrder(o)} title="Huỷ đơn"><X className="h-3.5 w-3.5" /></button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && <OrderViewModal finance={finance} order={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function OrderViewModal({ finance, order, onClose }: { finance: ReturnType<typeof useFinanceDb>; order: Order; onClose: () => void }): JSX.Element {
  const { db } = finance;
  const cust = order.customerId ? db.customers.find(c => c.id === order.customerId) : null;
  const shop = db.shops.find(s => s.id === order.shopId) || db.shops[0];

  function handlePrint() {
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.code}</title>
    <style>@page{size:80mm auto;margin:5mm}body{font-family:'Courier New',monospace;font-size:11px;width:70mm}h1{text-align:center;font-size:14px;margin:0}h2{text-align:center;font-size:11px;margin:2px 0;color:#666}table{width:100%;border-collapse:collapse;margin-top:6px;font-size:10px}td,th{padding:3px 0;border-bottom:1px dashed #ccc}.total{font-weight:700;font-size:13px;border-top:2px solid #000;border-bottom:2px solid #000}</style></head><body>
    <h1>${escapeHtml(shop?.name || 'CỬA HÀNG')}</h1>
    ${shop?.address ? `<h2>${escapeHtml(shop.address)}</h2>` : ''}
    ${shop?.phone ? `<h2>ĐT: ${escapeHtml(shop.phone)}</h2>` : ''}
    <h2 style="font-weight:700">HOÁ ĐƠN BÁN HÀNG</h2>
    <div>Mã: <b>${escapeHtml(order.code)}</b></div>
    <div>Ngày: ${dateVN(order.date)} ${new Date(order.createdAt).toLocaleTimeString('vi-VN')}</div>
    ${cust ? `<div>Khách: ${escapeHtml(cust.name)} ${cust.phone ? `(${escapeHtml(cust.phone)})` : ''}</div>` : ''}
    <table>
      <tr><th style="text-align:left">Sản phẩm</th><th>SL</th><th style="text-align:right">T.Tiền</th></tr>
      ${order.lines.map(l => `<tr><td>${escapeHtml(l.productName)}<br/>${l.quantity} × ${moneyShort(l.unitPrice)}đ</td><td style="text-align:center">${l.quantity}</td><td style="text-align:right">${moneyShort(l.amount)}đ</td></tr>`).join('')}
    </table>
    <div style="margin-top:6px;display:flex;justify-content:space-between"><span>Tạm tính:</span><b>${money(order.subtotal)}</b></div>
    ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Giảm giá:</span><b>-${money(order.discount)}</b></div>` : ''}
    <div class="total" style="display:flex;justify-content:space-between;padding:6px 0;margin-top:6px"><span>TỔNG:</span><span>${money(order.total)}</span></div>
    <div style="margin-top:6px">TT: ${order.payMethod === 'cash' ? 'Tiền mặt' : order.payMethod === 'transfer' ? 'Chuyển khoản' : order.payMethod === 'wallet' ? 'Ví điện tử' : 'Ghi nợ'}</div>
    <div style="text-align:center;margin-top:14px;font-size:10px">Cảm ơn quý khách!</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    win.document.write(html);
    win.document.close();
  }

  return (
    <Modal title={`Đơn ${order.code}`} onClose={onClose}>
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)' }}>
        <div className="flex justify-between text-sm"><span>Ngày</span><b>{dateVN(order.date)}</b></div>
        <div className="flex justify-between text-sm"><span>Khách</span><b>{cust?.name || 'Khách lẻ'}</b></div>
        <div className="flex justify-between text-sm"><span>Trạng thái</span><span className={`badge ${order.status === 'paid' ? 'badge-green' : order.status === 'pending' ? 'badge-yellow' : 'badge-gray'}`}>{order.status}</span></div>
      </div>
      <div className="space-y-1 mt-3" style={{ fontSize: 13 }}>
        {order.lines.map((l, i) => (
          <div key={i} className="flex justify-between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--color-border-subtle)' }}>
            <div><b>{l.productName}</b><div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{l.quantity} × {money(l.unitPrice)}</div></div>
            <b>{money(l.amount)}</b>
          </div>
        ))}
        <div className="flex justify-between mt-2"><span>Tạm tính</span><b>{money(order.subtotal)}</b></div>
        {order.discount > 0 && <div className="flex justify-between"><span>Giảm giá</span><b>-{money(order.discount)}</b></div>}
        <div className="flex justify-between p-2 mt-2 rounded-lg" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', fontSize: 16, fontWeight: 700 }}>
          <span>TỔNG</span><span>{money(order.total)}</span>
        </div>
      </div>
      {order.note && <div className="rounded-xl p-2 mt-3" style={{ fontSize: 12, background: 'var(--color-surface-row)' }}><b>Ghi chú:</b> {order.note}</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
        <button type="button" className="btn-primary" onClick={handlePrint}><Printer className="h-4 w-4" /> In hoá đơn</button>
      </div>
    </Modal>
  );
}

// ==========================================================
// Phase 23.9.H — Quán Cafe: Tables Page
// ==========================================================
function CafeTablesPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showAddTable, setShowAddTable] = useState(false);
  const [tableModal, setTableModal] = useState<CafeTable | null>(null);

  const tables = useMemo(() => db.cafeTables.filter(t => t.shopId === activeShop.id), [db.cafeTables, activeShop.id]);
  const occupied = tables.filter(t => t.status !== 'free').length;
  const free = tables.length - occupied;

  function getOrderForTable(t: CafeTable): Order | null {
    if (!t.currentOrderId) return null;
    return db.orders.find(o => o.id === t.currentOrderId) || null;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Bàn ({tables.length})</h2>
            <p className="card-subtitle">{free} bàn trống · {occupied} bàn đang dùng · {tables.filter(t => t.status === 'pending_payment').length} chờ TT</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAddTable(true)}><Plus className="h-4 w-4" /> Thêm bàn</button>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Coffee style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có bàn nào. Click "Thêm bàn" để tạo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {tables.map(t => {
            const order = getOrderForTable(t);
            const linesCount = order?.lines.length || 0;
            const total = order?.total || 0;
            const borderColor = t.status === 'free' ? '#10b981' : t.status === 'pending_payment' ? '#f59e0b' : '#ef4444';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTableModal(t)}
                className="card"
                style={{ padding: 14, borderLeft: '4px solid ' + borderColor, cursor: 'pointer', textAlign: 'left', background: 'var(--color-surface-card)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-row)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface-card)'; }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>🪑 {t.code}</div>
                    {t.capacity && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.capacity} ghế</div>}
                  </div>
                  <span className={`badge ${t.status === 'free' ? 'badge-green' : t.status === 'pending_payment' ? 'badge-yellow' : 'badge-red'}`}>
                    {t.status === 'free' ? 'Trống' : t.status === 'pending_payment' ? 'Chờ TT' : 'Đang dùng'}
                  </span>
                </div>
                {order && (
                  <div className="rounded-xl p-2 mt-2" style={{ background: 'var(--color-surface-row)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{linesCount} món</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 2 }}>{money(total)}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Mở: {new Date(order.createdAt).toLocaleTimeString('vi-VN')}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {showAddTable && <AddCafeTableModal finance={finance} activeShop={activeShop} onClose={() => setShowAddTable(false)} />}
      {tableModal && <CafeTableOrderModal finance={finance} activeShop={activeShop} table={tableModal} onClose={() => setTableModal(null)} />}
    </div>
  );
}

function AddCafeTableModal({ finance, activeShop, onClose }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; onClose: () => void }): JSX.Element {
  const { update, db } = finance;
  const dialog = useDialog();
  const existingCodes = db.cafeTables.filter(t => t.shopId === activeShop.id).map(t => t.code);
  const nextNum = existingCodes.length + 1;
  const [code, setCode] = useState(`B${String(nextNum).padStart(2, '0')}`);
  const [capacity, setCapacity] = useState(4);
  const [count, setCount] = useState(1);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (count < 1 || count > 50) { await dialog.alert('Số bàn 1-50', { variant: 'warning' }); return; }
    update(d => {
      for (let i = 0; i < count; i++) {
        const num = nextNum + i;
        const tableCode = count === 1 ? code : `B${String(num).padStart(2, '0')}`;
        if (existingCodes.includes(tableCode)) continue;
        d.cafeTables.push({
          id: createId('tbl'),
          shopId: activeShop.id,
          code: tableCode,
          capacity,
          status: 'free',
          createdAt: now(),
        });
      }
      appendLog(d, `Thêm ${count} bàn vào "${activeShop.name}"`, 'banhang');
    });
    onClose();
  }

  return (
    <Modal title="Thêm bàn" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label={count === 1 ? 'Mã bàn' : 'Mã bàn bắt đầu'}>
            <input className="input-field" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={count > 1} />
          </Field>
          <Field label="Số bàn thêm"><NumberInput value={count} onChange={n => setCount(n || 1)} min={1} max={50} /></Field>
        </div>
        <Field label="Số ghế / bàn"><NumberInput value={capacity} onChange={n => setCapacity(n || 1)} min={1} max={20} /></Field>
        {count > 1 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sẽ tạo {count} bàn: B{String(nextNum).padStart(2, '0')} → B{String(nextNum + count - 1).padStart(2, '0')}</div>}
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary"><Plus className="h-4 w-4" /> Thêm bàn</button>
        </div>
      </form>
    </Modal>
  );
}

function CafeTableOrderModal({ finance, activeShop, table, onClose }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; table: CafeTable; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const existingOrder = table.currentOrderId ? db.orders.find(o => o.id === table.currentOrderId) : null;
  const [lines, setLines] = useState<OrderLine[]>(existingOrder?.lines ?? []);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState(existingOrder?.customerId || '');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || '');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const shopProducts = useMemo(() => db.products.filter(p => p.shopId === activeShop.id && p.active), [db.products, activeShop.id]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shopProducts.filter(p => !q || [p.name, p.sku, p.category].some(x => x.toLowerCase().includes(q)));
  }, [shopProducts, search]);

  function addLine(p: Product) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1, amount: (next[idx].quantity + 1) * next[idx].unitPrice };
        return next;
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.salePrice, discount: 0, amount: p.salePrice }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setLines(prev => {
      const idx = prev.findIndex(l => l.productId === productId);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter(l => l.productId !== productId);
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty, amount: newQty * next[idx].unitPrice };
      return next;
    });
  }

  function removeLine(productId: string) {
    setLines(prev => prev.filter(l => l.productId !== productId));
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);

  // Lưu để TT sau (Order status=pending, gắn tableId, table → pending_payment)
  async function saveAsPending() {
    if (lines.length === 0) { await dialog.alert('Chưa chọn món', { variant: 'warning' }); return; }
    update(d => {
      let order: Order;
      if (existingOrder) {
        const idx = d.orders.findIndex(o => o.id === existingOrder.id);
        if (idx >= 0) {
          d.orders[idx] = { ...d.orders[idx], lines, subtotal: total, total, customerId: customerId || undefined };
          order = d.orders[idx];
        } else {
          return;
        }
      } else {
        const orderCode = `ORD${Date.now()}`;
        order = {
          id: createId('ord'),
          shopId: activeShop.id,
          code: orderCode,
          date: today(),
          customerId: customerId || undefined,
          lines,
          subtotal: total, discount: 0, tax: 0, total,
          payMethod: 'cash',
          status: 'pending',
          orderType: 'dine_in',
          tableId: table.id,
          tableNumber: table.code,
          createdAt: now(),
        };
        d.orders.unshift(order);
      }
      // Update bàn → pending_payment + gắn currentOrderId
      const tIdx = d.cafeTables.findIndex(t => t.id === table.id);
      if (tIdx >= 0) {
        d.cafeTables[tIdx].status = 'pending_payment';
        d.cafeTables[tIdx].currentOrderId = order.id;
      }
      appendLog(d, `Bàn ${table.code}: lưu ${lines.length} món chờ TT (${money(total)})`, 'banhang');
    });
    onClose();
    dialog.alert(`✓ Bàn ${table.code} đã lưu order ${money(total)} — KH thanh toán sau.`, { variant: 'success', title: 'Đã lưu' });
  }

  // Đóng bàn không tính tiền
  async function cancelTable() {
    const ok = await dialog.confirm(`Đóng bàn ${table.code} và HỦY order? Mọi món đã chọn sẽ mất.`, { variant: 'danger', okLabel: 'Hủy bàn' });
    if (!ok) return;
    update(d => {
      if (existingOrder) {
        const idx = d.orders.findIndex(o => o.id === existingOrder.id);
        if (idx >= 0) d.orders[idx].status = 'canceled';
      }
      const tIdx = d.cafeTables.findIndex(t => t.id === table.id);
      if (tIdx >= 0) {
        d.cafeTables[tIdx].status = 'free';
        d.cafeTables[tIdx].currentOrderId = undefined;
      }
      appendLog(d, `Hủy bàn ${table.code}`, 'banhang');
    });
    onClose();
  }

  // Thanh toán ngay
  async function payNow() {
    if (lines.length === 0) { await dialog.alert('Chưa chọn món', { variant: 'warning' }); return; }
    setShowCheckout(true);
  }

  function finalizePayment() {
    const acc = accountId ? db.accounts.find(a => a.id === accountId) : null;
    update(d => {
      if (existingOrder) {
        const idx = d.orders.findIndex(o => o.id === existingOrder.id);
        if (idx >= 0) {
          d.orders[idx] = {
            ...d.orders[idx],
            lines, subtotal: total, total,
            customerId: customerId || undefined,
            payMethod, paidAccountId: accountId || undefined,
            status: 'paid',
          };
        }
      } else {
        const orderCode = `ORD${Date.now()}`;
        d.orders.unshift({
          id: createId('ord'),
          shopId: activeShop.id,
          code: orderCode,
          date: today(),
          customerId: customerId || undefined,
          lines,
          subtotal: total, discount: 0, tax: 0, total,
          payMethod, paidAccountId: accountId || undefined,
          status: 'paid',
          orderType: 'dine_in',
          tableId: table.id,
          tableNumber: table.code,
          createdAt: now(),
        });
      }
      // Trừ tồn kho
      for (const l of lines) {
        const idx = d.products.findIndex(p => p.id === l.productId);
        if (idx >= 0) d.products[idx].stock -= l.quantity;
      }
      // Customer loyalty
      if (customerId) {
        const cidx = d.customers.findIndex(c => c.id === customerId);
        if (cidx >= 0) {
          d.customers[cidx].totalSpent += total;
          d.customers[cidx].loyaltyPoints += Math.floor(total / 10000);
        }
      }
      // Auto Ledger
      const finalOrderId = existingOrder ? existingOrder.id : d.orders[0].id;
      if (payMethod !== 'debt') {
        d.ledger.unshift({
          id: createId('ledg'), date: today(), kind: 'thu', category: 'kinh_doanh',
          amount: total, description: `[Cafe Bàn ${table.code}] ${lines.length} món`,
          accountId: accountId || undefined, fromModule: 'banhang', refId: finalOrderId, createdAt: now(),
        });
      }
      // Free table
      const tIdx = d.cafeTables.findIndex(t => t.id === table.id);
      if (tIdx >= 0) {
        d.cafeTables[tIdx].status = 'free';
        d.cafeTables[tIdx].currentOrderId = undefined;
      }
      appendLog(d, `Bàn ${table.code} TT: ${lines.length} món, ${money(total)}`, 'banhang');
    });
    onClose();
    dialog.alert(`✓ Đã thanh toán bàn ${table.code} - ${money(total)}`, { variant: 'success' });
  }

  async function handleCheckoutClick() {
    const acc = accountId ? db.accounts.find(a => a.id === accountId) : null;
    if (payMethod === 'transfer' && acc && acc.kind === 'bank' && acc.bankCode && acc.accountNumber) {
      setShowQrModal(true);
      return;
    }
    const ok = await dialog.confirm(`Xác nhận TT bàn ${table.code} - ${money(total)}?`, { variant: 'success', okLabel: 'Thanh toán' });
    if (!ok) return;
    finalizePayment();
  }

  return (
    <Modal title={`Bàn ${table.code}${table.capacity ? ` · ${table.capacity} ghế` : ''}${existingOrder ? ' · ' + (table.status === 'pending_payment' ? '⏳ Chờ TT' : '🪑 Đang dùng') : ''}`} onClose={onClose}>
      {!showCheckout ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Chọn món ({lines.length})</div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
            <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm món..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.length > 0 && (
            <div style={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
              {filtered.map(p => (
                <button key={p.id} type="button" onClick={() => addLine(p)} style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 6, padding: 6, cursor: 'pointer', textAlign: 'left', fontSize: 11 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ color: 'var(--color-accent-primary)', fontWeight: 700 }}>{money(p.salePrice)}</div>
                </button>
              ))}
            </div>
          )}

          {lines.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {lines.map(l => (
                <div key={l.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', padding: 6, background: 'var(--color-surface-row)', borderRadius: 6, fontSize: 12 }}>
                  <span>{l.productName}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => changeQty(l.productId, -1)}><Minus className="h-3 w-3" /></button>
                    <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{l.quantity}</span>
                    <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => changeQty(l.productId, 1)}><Plus className="h-3 w-3" /></button>
                  </div>
                  <b style={{ minWidth: 70, textAlign: 'right', color: 'var(--color-accent-primary)' }}>{money(l.amount)}</b>
                  <button type="button" className="icon-btn" style={{ color: '#ef4444' }} onClick={() => removeLine(l.productId)}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--color-accent-soft)' }}>
            <div className="flex justify-between" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
              <span>TỔNG</span><span>{money(total)}</span>
            </div>
          </div>

          <Field label="Khách hàng (tuỳ chọn)">
            <select className="select-field" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">Khách lẻ</option>
              {db.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={saveAsPending} disabled={lines.length === 0} style={{ justifyContent: 'center', padding: '10px' }}>
              ⏳ Lưu, TT sau
            </button>
            <button type="button" className="btn-primary" onClick={payNow} disabled={lines.length === 0} style={{ justifyContent: 'center', padding: '10px' }}>
              <CheckCircle2 className="h-4 w-4" /> Thanh toán ngay
            </button>
          </div>
          <div className="flex justify-between mt-2">
            <button type="button" onClick={cancelTable} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 11, cursor: 'pointer', padding: '4px 6px' }}>
              Hủy bàn (không tính tiền)
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ fontSize: 11, padding: '4px 12px' }}>Đóng</button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl p-3" style={{ background: 'var(--color-accent-soft)' }}>
            <div className="flex justify-between" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
              <span>Tổng TT</span><span>{money(total)}</span>
            </div>
          </div>
          <div className="space-y-2 mt-3">
            <Field label="Hình thức TT">
              <select className="select-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PayMethod)}>
                <option value="cash">💵 Tiền mặt</option>
                <option value="transfer">🏦 Chuyển khoản</option>
                <option value="wallet">👛 Ví điện tử</option>
                <option value="debt">⏳ Ghi nợ</option>
              </select>
            </Field>
            {payMethod !== 'debt' && (
              <Field label="Tài khoản nhận">
                <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
                  <option value="">--</option>
                  {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setShowCheckout(false)}>← Quay lại</button>
            <button type="button" className="btn-primary" onClick={handleCheckoutClick}><CheckCircle2 className="h-4 w-4" /> Xác nhận TT {money(total)}</button>
          </div>

          {showQrModal && (() => {
            const acc = db.accounts.find(a => a.id === accountId);
            if (!acc || !acc.bankCode || !acc.accountNumber) { setShowQrModal(false); return null; }
            const bankName = VIETQR_BANKS.find(b => b.code === acc.bankCode)?.name || acc.bankCode;
            const qrUrl = vietQrUrl({ bankCode: acc.bankCode, accountNumber: acc.accountNumber, accountName: acc.accountName || '', amount: total, message: `Bàn ${table.code}` });
            return (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowQrModal(false)}>
                <div className="card" style={{ maxWidth: 380, width: '100%', padding: 22 }} onClick={e => e.stopPropagation()}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quét QR thanh toán bàn {table.code}</h2>
                  <div style={{ textAlign: 'center', background: '#fff', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                    <img src={qrUrl} alt="VietQR" style={{ width: 220, height: 220, display: 'block', margin: '0 auto' }} />
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{bankName} · {acc.accountNumber}</div>
                  <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 6 }}>{money(total)}</div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" className="btn-secondary" onClick={() => setShowQrModal(false)} style={{ flex: 1 }}>Huỷ</button>
                    <button type="button" className="btn-primary" onClick={() => { setShowQrModal(false); finalizePayment(); }} style={{ flex: 2, justifyContent: 'center' }}>
                      <CheckCircle2 className="h-4 w-4" /> Đã nhận tiền
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </Modal>
  );
}

// ==========================================================
// Phase 23.9.G — Quán Internet: Stations Page
// ==========================================================
function StationsPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showAddStation, setShowAddStation] = useState(false);
  const [checkoutSession, setCheckoutSession] = useState<StationSession | null>(null);
  const [tick, setTick] = useState(0);

  // Re-render mỗi 30s để cập nhật giờ chạy
  useMemo(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const stations = useMemo(() => db.stations.filter(s => s.shopId === activeShop.id), [db.stations, activeShop.id, tick]);
  const activeSessions = useMemo(() => db.stationSessions.filter(s => s.shopId === activeShop.id && !s.endedAt), [db.stationSessions, activeShop.id, tick]);

  function calcMinutes(startedAt: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  }
  function calcCharge(station: ComputerStation, mins: number): number {
    return Math.round(station.ratePerHour * (mins / 60));
  }

  async function startSession(station: ComputerStation) {
    if (station.status === 'occupied') {
      await dialog.alert('Máy đang được dùng', { variant: 'warning' });
      return;
    }
    const ok = await dialog.confirm(`Bắt đầu sử dụng máy ${station.code}?\n\nGiá: ${money(station.ratePerHour)}/giờ`, { variant: 'success', okLabel: 'Bắt đầu' });
    if (!ok) return;
    update(d => {
      const sessionId = createId('sess');
      d.stationSessions.push({
        id: sessionId,
        shopId: activeShop.id,
        stationId: station.id,
        startedAt: now(),
        extras: [],
      });
      const idx = d.stations.findIndex(s => s.id === station.id);
      if (idx >= 0) {
        d.stations[idx].status = 'occupied';
        d.stations[idx].currentSessionId = sessionId;
      }
      appendLog(d, `Bắt đầu máy ${station.code}`, 'banhang');
    });
  }

  function openCheckout(session: StationSession) {
    setCheckoutSession(session);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Máy đang dùng</h2>
            <p className="card-subtitle">{stations.length} máy · {activeSessions.length} đang sử dụng · {stations.length - activeSessions.length} máy trống</p>
          </div>
          <button className="btn-primary" onClick={() => setShowAddStation(true)}><Plus className="h-4 w-4" /> Thêm máy</button>
        </div>
      </div>

      {stations.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Monitor style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có máy nào. Click "Thêm máy" để tạo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {stations.map(s => {
            const session = s.currentSessionId ? db.stationSessions.find(ss => ss.id === s.currentSessionId) : null;
            const isOccupied = s.status === 'occupied' && session && !session.endedAt;
            const mins = isOccupied && session ? calcMinutes(session.startedAt) : 0;
            const charge = isOccupied ? calcCharge(s, mins) : 0;
            const extrasTotal = session ? session.extras.reduce((sum, e) => sum + e.amount, 0) : 0;
            return (
              <div key={s.id} className="card" style={{ padding: 14, borderLeft: '4px solid ' + (isOccupied ? '#ef4444' : '#10b981') }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>🖥 {s.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{money(s.ratePerHour)}/giờ</div>
                  </div>
                  <span className={`badge ${isOccupied ? 'badge-red' : 'badge-green'}`}>{isOccupied ? 'Đang dùng' : 'Trống'}</span>
                </div>
                {isOccupied && session && (
                  <div className="rounded-xl p-2 mt-2" style={{ background: 'var(--color-surface-row)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>BẮT ĐẦU</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(session.startedAt).toLocaleTimeString('vi-VN')}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12 }}>
                      <span><Clock style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle' }} /> {Math.floor(mins / 60)}h{mins % 60}p</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-accent-primary)', marginTop: 4 }}>
                      {money(charge + extrasTotal)}
                    </div>
                    {extrasTotal > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>+ Menu {money(extrasTotal)} ({session.extras.length} món)</div>
                    )}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  {!isOccupied ? (
                    <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '6px' }} onClick={() => startSession(s)}>
                      <Play className="h-3.5 w-3.5" /> Bắt đầu
                    </button>
                  ) : (
                    <>
                      <button className="btn-secondary" style={{ flex: 1, fontSize: 11, padding: '6px' }} onClick={() => session && openCheckout(session)}>
                        <Plus className="h-3 w-3" /> Menu
                      </button>
                      <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '6px', background: '#ef4444' }} onClick={() => session && openCheckout(session)}>
                        <Square className="h-3.5 w-3.5" /> Kết thúc
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddStation && <AddStationModal finance={finance} activeShop={activeShop} onClose={() => setShowAddStation(false)} />}
      {checkoutSession && <StationCheckoutModal finance={finance} activeShop={activeShop} session={checkoutSession} onClose={() => setCheckoutSession(null)} />}
    </div>
  );
}

function AddStationModal({ finance, activeShop, onClose }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; onClose: () => void }): JSX.Element {
  const { update, db } = finance;
  const dialog = useDialog();
  const existingCodes = db.stations.filter(s => s.shopId === activeShop.id).map(s => s.code);
  const nextNum = existingCodes.length + 1;
  const [code, setCode] = useState(`M${String(nextNum).padStart(2, '0')}`);
  const [ratePerHour, setRatePerHour] = useState(8000);
  const [count, setCount] = useState(1);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (count < 1 || count > 50) { await dialog.alert('Số máy 1-50', { variant: 'warning' }); return; }
    update(d => {
      for (let i = 0; i < count; i++) {
        const num = nextNum + i;
        const stationCode = count === 1 ? code : `M${String(num).padStart(2, '0')}`;
        if (existingCodes.includes(stationCode)) continue;
        d.stations.push({
          id: createId('stn'),
          shopId: activeShop.id,
          code: stationCode,
          ratePerHour,
          status: 'free',
          createdAt: now(),
        });
      }
      appendLog(d, `Thêm ${count} máy vào "${activeShop.name}"`, 'banhang');
    });
    onClose();
  }

  return (
    <Modal title="Thêm máy" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label={count === 1 ? 'Mã máy' : 'Mã máy bắt đầu'}>
            <input className="input-field" value={code} onChange={e => setCode(e.target.value.toUpperCase())} disabled={count > 1} />
          </Field>
          <Field label="Số máy thêm cùng lúc"><NumberInput value={count} onChange={n => setCount(n || 1)} min={1} max={50} /></Field>
        </div>
        <Field label="Giá / giờ"><NumberInput value={ratePerHour} onChange={n => setRatePerHour(n)} suffix="đ" min={0} placeholder="8.000" /></Field>
        {count > 1 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Sẽ tạo {count} máy: M{String(nextNum).padStart(2, '0')} → M{String(nextNum + count - 1).padStart(2, '0')}</div>}
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary"><Plus className="h-4 w-4" /> Thêm máy</button>
        </div>
      </form>
    </Modal>
  );
}

function StationCheckoutModal({ finance, activeShop, session, onClose }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile; session: StationSession; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const station = db.stations.find(s => s.id === session.stationId);
  const [extras, setExtras] = useState<OrderLine[]>(session.extras);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || '');
  const [search, setSearch] = useState('');

  const minutes = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000));
  const timeCharge = station ? Math.round(station.ratePerHour * (minutes / 60)) : 0;
  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);
  const total = timeCharge + extrasTotal;

  const shopProducts = useMemo(() => db.products.filter(p => p.shopId === activeShop.id && p.active), [db.products, activeShop.id]);
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shopProducts.filter(p => !q || [p.name, p.sku, p.category].some(x => x.toLowerCase().includes(q)));
  }, [shopProducts, search]);

  function addExtra(p: Product) {
    setExtras(prev => {
      const idx = prev.findIndex(l => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1, amount: (next[idx].quantity + 1) * next[idx].unitPrice };
        return next;
      }
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: p.salePrice, discount: 0, amount: p.salePrice }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setExtras(prev => {
      const idx = prev.findIndex(l => l.productId === productId);
      if (idx < 0) return prev;
      const newQty = prev[idx].quantity + delta;
      if (newQty <= 0) return prev.filter(l => l.productId !== productId);
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: newQty, amount: newQty * next[idx].unitPrice };
      return next;
    });
  }

  async function handleCheckout() {
    if (!station) return;
    const ok = await dialog.confirm(`Kết thúc máy ${station.code}?\n\nThời gian: ${Math.floor(minutes / 60)}h${minutes % 60}p\nTiền giờ: ${money(timeCharge)}\nMenu phụ: ${money(extrasTotal)}\nTỔNG: ${money(total)}`, { variant: 'success', okLabel: 'Tính tiền' });
    if (!ok) return;
    const orderCode = `ORD${Date.now()}`;
    update(d => {
      // Build order lines
      const timeLine: OrderLine = {
        productId: 'station-time',
        productName: `Máy ${station.code} - ${Math.floor(minutes / 60)}h${minutes % 60}p × ${money(station.ratePerHour)}/h`,
        quantity: 1,
        unitPrice: timeCharge,
        discount: 0,
        amount: timeCharge,
      };
      const order: Order = {
        id: createId('ord'),
        shopId: activeShop.id,
        code: orderCode,
        date: today(),
        lines: [timeLine, ...extras],
        subtotal: total, discount: 0, tax: 0, total,
        payMethod,
        paidAccountId: accountId || undefined,
        status: 'paid',
        createdAt: now(),
      };
      d.orders.unshift(order);
      // Trừ tồn kho cho extras
      for (const l of extras) {
        const idx = d.products.findIndex(p => p.id === l.productId);
        if (idx >= 0) d.products[idx].stock -= l.quantity;
      }
      // Update session
      const sIdx = d.stationSessions.findIndex(s => s.id === session.id);
      if (sIdx >= 0) {
        d.stationSessions[sIdx].endedAt = now();
        d.stationSessions[sIdx].extras = extras;
        d.stationSessions[sIdx].finalOrderId = order.id;
      }
      // Free station
      const stIdx = d.stations.findIndex(s => s.id === station.id);
      if (stIdx >= 0) {
        d.stations[stIdx].status = 'free';
        d.stations[stIdx].currentSessionId = undefined;
      }
      // Auto Ledger thu
      if (payMethod !== 'debt') {
        d.ledger.unshift({
          id: createId('ledg'), date: today(), kind: 'thu', category: 'kinh_doanh',
          amount: total, description: `[Internet] Máy ${station.code} - ${minutes}p`,
          accountId: accountId || undefined, fromModule: 'banhang', refId: order.id, createdAt: now(),
        });
      }
      appendLog(d, `Kết thúc máy ${station.code}: ${money(total)}`, 'banhang');
    });
    onClose();
    await dialog.alert(`✓ Đã ghi nhận đơn ${money(total)}`, { variant: 'success' });
  }

  return (
    <Modal title={`Kết thúc máy ${station?.code || ''}`} onClose={onClose}>
      <div className="rounded-xl p-3" style={{ background: 'var(--color-accent-soft)' }}>
        <div className="flex justify-between text-sm"><span>Bắt đầu</span><b>{new Date(session.startedAt).toLocaleString('vi-VN')}</b></div>
        <div className="flex justify-between text-sm"><span>Thời gian</span><b>{Math.floor(minutes / 60)}h{minutes % 60}p</b></div>
        <div className="flex justify-between text-sm"><span>Giá/giờ</span><b>{money(station?.ratePerHour || 0)}</b></div>
        <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-accent-primary)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 6, marginTop: 6 }}>
          <span>Tiền giờ</span><span>{money(timeCharge)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>+ Menu phụ ({extras.length})</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm món thêm..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filteredProducts.length > 0 && (
          <div style={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', maxHeight: 140, overflowY: 'auto', marginBottom: 8 }}>
            {filteredProducts.map(p => (
              <button key={p.id} type="button" onClick={() => addExtra(p)} style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 6, padding: 6, cursor: 'pointer', textAlign: 'left', fontSize: 11 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ color: 'var(--color-accent-primary)', fontWeight: 700 }}>{money(p.salePrice)}</div>
              </button>
            ))}
          </div>
        )}
        {extras.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {extras.map(l => (
              <div key={l.productId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', padding: 6, background: 'var(--color-surface-row)', borderRadius: 6, fontSize: 12 }}>
                <span>{l.productName}</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => changeQty(l.productId, -1)}><Minus className="h-3 w-3" /></button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{l.quantity}</span>
                  <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => changeQty(l.productId, 1)}><Plus className="h-3 w-3" /></button>
                </div>
                <b style={{ minWidth: 70, textAlign: 'right', color: 'var(--color-accent-primary)' }}>{money(l.amount)}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--color-accent-soft)' }}>
        <div className="flex justify-between" style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
          <span>TỔNG</span><span>{money(total)}</span>
        </div>
      </div>

      <div className="space-y-2 mt-3">
        <Field label="Hình thức TT">
          <select className="select-field" value={payMethod} onChange={e => setPayMethod(e.target.value as PayMethod)}>
            <option value="cash">💵 Tiền mặt</option>
            <option value="transfer">🏦 Chuyển khoản</option>
            <option value="wallet">👛 Ví điện tử</option>
            <option value="debt">⏳ Ghi nợ</option>
          </select>
        </Field>
        {payMethod !== 'debt' && (
          <Field label="Tài khoản nhận">
            <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">--</option>
              {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
        <button type="button" className="btn-primary" onClick={handleCheckout}><CheckCircle2 className="h-4 w-4" /> Tính tiền {money(total)}</button>
      </div>
    </Modal>
  );
}

// ==========================================================
// Khách hàng thân thiết
// ==========================================================
function CustomersPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.customers.filter(c => !q || [c.name, c.phone, c.email].some(x => (x || '').toLowerCase().includes(q)))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [db.customers, search]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá khách hàng?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.customers = d.customers.filter(c => c.id !== id); appendLog(d, 'Xoá KH', 'banhang'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Khách hàng thân thiết</h2>
            <p className="card-subtitle">{db.customers.length} khách · Tự cộng điểm khi mua hàng (1 điểm / 10k đồng)</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm KH</button>
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm tên, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <UsersIcon style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có khách thân thiết nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>#</th><th>Tên</th><th>SĐT</th><th>Email</th><th>Tổng chi</th><th>Điểm</th><th></th></tr></thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td>{['🥇', '🥈', '🥉'][i] || (i + 1)}</td>
                    <td><b>{c.name}</b></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.phone || '-'}</td>
                    <td style={{ fontSize: 12 }}>{c.email || '-'}</td>
                    <td><b>{money(c.totalSpent)}</b></td>
                    <td><span className="badge badge-green">{c.loyaltyPoints} điểm</span></td>
                    <td><div className="flex gap-1">
                      <button className="icon-btn" onClick={() => setEditing(c)}><Edit3 className="h-3.5 w-3.5" /></button>
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editing) && <CustomerModal finance={finance} editing={editing} onClose={() => { setShowCreate(false); setEditing(null); }} />}
    </div>
  );
}

function CustomerModal({ finance, editing, onClose }: { finance: ReturnType<typeof useFinanceDb>; editing: Customer | null; onClose: () => void }): JSX.Element {
  const { update } = finance;
  const [form, setForm] = useState<Customer>(editing ?? {
    id: '', name: '', phone: '', email: '', address: '', loyaltyPoints: 0, totalSpent: 0, createdAt: '',
  });

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { await dialog.alert('Nhập tên KH', { variant: 'warning' }); return; }
    update(d => {
      if (editing) {
        d.customers = d.customers.map(c => c.id === editing.id ? form : c);
        appendLog(d, `Cập nhật KH: ${form.name}`, 'banhang');
      } else {
        d.customers.push({ ...form, id: createId('cust'), createdAt: now() });
        appendLog(d, `Thêm KH: ${form.name}`, 'banhang');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa KH: ${editing.name}` : 'Thêm khách hàng'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Tên *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="SĐT"><input className="input-field" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><input className="input-field" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <Field label="Địa chỉ"><input className="input-field" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm KH'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Báo cáo bán hàng
// ==========================================================
function BHReportPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { db } = finance;
  const tm = thisMonth();
  const [thang, setThang] = useState(tm.thang);
  const [nam, setNam] = useState(tm.nam);

  const monthOrders = useMemo(() => db.orders.filter(o => {
    if (o.shopId !== activeShop.id) return false;
    if (o.status !== 'paid') return false;
    const d = new Date(o.date);
    return d.getMonth() + 1 === thang && d.getFullYear() === nam;
  }), [db.orders, thang, nam, activeShop.id]);

  const stats = useMemo(() => {
    const revenue = monthOrders.reduce((s, o) => s + o.total, 0);
    const cogs = monthOrders.reduce((s, o) => s + o.lines.reduce((x, l) => {
      const p = db.products.find(pr => pr.id === l.productId);
      return x + (p ? p.costPrice * l.quantity : 0);
    }, 0), 0);
    return { revenue, cogs, profit: revenue - cogs, orders: monthOrders.length };
  }, [monthOrders, db.products]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of monthOrders) {
      for (const l of o.lines) {
        const p = db.products.find(pr => pr.id === l.productId);
        const cat = p?.category || 'Khác';
        map.set(cat, (map.get(cat) || 0) + l.amount);
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthOrders, db.products]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of monthOrders) {
      for (const l of o.lines) {
        const x = map.get(l.productId) || { name: l.productName, qty: 0, revenue: 0 };
        x.qty += l.quantity;
        x.revenue += l.amount;
        map.set(l.productId, x);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [monthOrders]);

  // Phase 23.9.E — Breakdown theo phương thức TT
  const byPayment = useMemo(() => {
    const cash = monthOrders.filter(o => o.payMethod === 'cash');
    const transfer = monthOrders.filter(o => o.payMethod === 'transfer');
    const wallet = monthOrders.filter(o => o.payMethod === 'wallet');
    const debt = monthOrders.filter(o => o.payMethod === 'debt');
    const sum = (arr: Order[]) => arr.reduce((s, o) => s + o.total, 0);
    return { cash: { count: cash.length, total: sum(cash) }, transfer: { count: transfer.length, total: sum(transfer) }, wallet: { count: wallet.length, total: sum(wallet) }, debt: { count: debt.length, total: sum(debt) } };
  }, [monthOrders]);

  const byAccount = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of monthOrders) {
      if (!o.paidAccountId) continue;
      const x = map.get(o.paidAccountId) || { count: 0, total: 0 };
      x.count++;
      x.total += o.total;
      map.set(o.paidAccountId, x);
    }
    return Array.from(map.entries()).map(([accountId, x]) => {
      const acc = db.accounts.find(a => a.id === accountId);
      return { accountId, name: acc?.name || '?', kind: acc?.kind || 'cash', bankCode: acc?.bankCode, count: x.count, total: x.total };
    }).sort((a, b) => b.total - a.total);
  }, [monthOrders, db.accounts]);

  // Phase 23.9.F — Breakdown dine_in vs takeout (chỉ với cafe template)
  const byOrderType = useMemo(() => {
    const dine = monthOrders.filter(o => (o as any).orderType === 'dine_in');
    const take = monthOrders.filter(o => (o as any).orderType !== 'dine_in');
    const sum = (arr: Order[]) => arr.reduce((s, o) => s + o.total, 0);
    return { dineIn: { count: dine.length, total: sum(dine) }, takeout: { count: take.length, total: sum(take) } };
  }, [monthOrders]);

  function handleExportCsv() {
    const rows: any[][] = [
      [`Báo cáo bán hàng — Cửa hàng "${activeShop.name}" — T${thang}/${nam}`],
      [],
      ['Doanh thu', stats.revenue],
      ['Giá vốn', stats.cogs],
      ['Lãi gộp', stats.profit],
      ['Số đơn', stats.orders],
      [],
      ['DANH SÁCH ĐƠN HÀNG'],
      ['Mã đơn', 'Ngày', 'Khách', 'Số món', 'Tổng (đ)', 'TT'],
      ...monthOrders.map(o => [
        o.code,
        o.date,
        (o.customerId ? db.customers.find(c => c.id === o.customerId)?.name : '') || 'Khách lẻ',
        o.lines.length,
        o.total,
        o.payMethod,
      ]),
      [],
      ['TOP SẢN PHẨM BÁN CHẠY'],
      ['Sản phẩm', 'Số lượng', 'Doanh thu (đ)'],
      ...topProducts.map(p => [p.name, p.qty, p.revenue]),
      [],
      ['DOANH THU THEO CATEGORY'],
      ['Category', 'Doanh thu (đ)'],
      ...byCategory.map(c => [c.name, c.value]),
    ];
    const csv = toCsv(rows);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `BaoCao_BanHang_${activeShop.name}_T${thang}-${nam}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Báo cáo bán hàng</h2>
            <p className="card-subtitle">T{thang}/{nam} · {stats.orders} đơn đã TT</p>
          </div>
          <div className="flex gap-2">
            <select className="select-field" style={{ width: 100 }} value={thang} onChange={e => setThang(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T.{i + 1}</option>)}
            </select>
            <input className="input-field" style={{ width: 100 }} type="number" value={nam} onChange={e => setNam(Number(e.target.value) || tm.nam)} />
            <button className="btn-secondary" onClick={handleExportCsv} title="Xuất Excel CSV"><Download className="h-4 w-4" /> Xuất Excel</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat icon={Receipt} label="Doanh thu" value={money(stats.revenue)} hint={`${stats.orders} đơn`} color="emerald" />
        <Stat icon={Package} label="Giá vốn" value={money(stats.cogs)} color="red" />
        <Stat icon={ChartIcon} label="Lãi gộp" value={money(stats.profit)} hint={stats.revenue > 0 ? `${Math.round((stats.profit / stats.revenue) * 100)}% margin` : ''} color="emerald" />
      </div>

      {byCategory.length > 0 && (
        <div className="card">
          <h2 className="card-title">Doanh thu theo category</h2>
          <div style={{ height: 240, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory} margin={{ top: 10, right: 20, bottom: 30, left: 0 }} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" width={100} />
                <ReTooltip formatter={(v: number) => money(v)} contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, color: 'var(--color-text-primary)', fontSize: 12 }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {monthOrders.length > 0 && (
        <div className="card">
          <h2 className="card-title">💳 Tổng kết theo phương thức thanh toán</h2>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 10 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-row)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>💵 TIỀN MẶT</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{money(byPayment.cash.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byPayment.cash.count} đơn</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-row)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>🏦 CHUYỂN KHOẢN</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{money(byPayment.transfer.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byPayment.transfer.count} đơn</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-row)' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>👛 VÍ ĐIỆN TỬ</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{money(byPayment.wallet.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byPayment.wallet.count} đơn</div>
            </div>
            {byPayment.debt.count > 0 && (
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.1)' }}>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⏳ GHI NỢ</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#f59e0b' }}>{money(byPayment.debt.total)}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byPayment.debt.count} đơn</div>
              </div>
            )}
          </div>

          {byAccount.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Theo tài khoản nhận</div>
              <div className="space-y-2">
                {byAccount.map(a => (
                  <div key={a.accountId} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 140px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-row)' }}>
                    <span>{a.kind === 'cash' ? '💵' : a.kind === 'bank' ? '🏦' : '👛'}</span>
                    <span style={{ fontWeight: 500 }}>{a.name}{a.bankCode ? <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 6 }}>{a.bankCode}</span> : null}</span>
                    <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>{a.count} đơn</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{money(a.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeShop.template === 'cafe' && (byOrderType.dineIn.count > 0 || byOrderType.takeout.count > 0) && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Tại quán vs Mua về</div>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-row)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>🪑 TẠI QUÁN (Dine-in)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{money(byOrderType.dineIn.total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byOrderType.dineIn.count} đơn</div>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-surface-row)' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>🥡 MUA VỀ (Takeout)</div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{money(byOrderType.takeout.total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{byOrderType.takeout.count} đơn</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="card">
          <h2 className="card-title">Top 10 sản phẩm bán chạy</h2>
          <div className="space-y-2 mt-3">
            {topProducts.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 120px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-row)' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)' }}>{i + 1}.</span>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>{p.qty} bán</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{money(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================
// Cài đặt shop
// ==========================================================
function ShopSettingsPage({ finance, activeShop }: { finance: ReturnType<typeof useFinanceDb>; activeShop: ShopProfile }): JSX.Element {
  const { update } = finance;
  const dialog = useDialog();
  const [form, setForm] = useState<ShopProfile>(activeShop);
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update(d => {
      d.shops = d.shops.map(s => s.id === activeShop.id ? form : s);
      appendLog(d, `Cập nhật cấu hình shop: ${form.name}`, 'banhang');
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changeTemplate() {
    const ok = await dialog.confirm(`Đổi template sẽ XOÁ TOÀN BỘ sản phẩm + đơn hàng của cửa hàng "${activeShop.name}". Tiếp tục?`, { variant: 'danger', okLabel: 'Đổi template' });
    if (!ok) return;
    update(d => {
      d.shops = d.shops.filter(s => s.id !== activeShop.id);
      d.products = d.products.filter(p => p.shopId !== activeShop.id);
      d.orders = d.orders.filter(o => o.shopId !== activeShop.id);
      if (d.activeShopId === activeShop.id) d.activeShopId = d.shops[0]?.id || '';
      appendLog(d, `Xoá cửa hàng "${activeShop.name}" để chọn template mới`, 'banhang');
    });
  }

  return (
    <form onSubmit={handleSave} className="card space-y-3">
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>🏪 Thông tin cửa hàng</h3>
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>TEMPLATE HIỆN TẠI</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
          {form.template === 'cafe' && '☕ Quán Cafe'}
          {form.template === 'taphoa' && '🏪 Tạp hoá'}
          {form.template === 'sieuthi' && '🛒 Siêu thị mini'}
          {form.template === 'internet' && '🖥 Quán Internet'}
          {form.template === 'custom' && '⚙ Tuỳ chỉnh'}
        </div>
        <button type="button" className="btn-secondary mt-2" onClick={changeTemplate} style={{ fontSize: 11 }}>
          <RefreshCcw className="h-3.5 w-3.5" /> Đổi template (xoá data hiện tại)
        </button>
      </div>
      <div className="form-grid">
        <Field label="Tên cửa hàng *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Số điện thoại"><input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
      </div>
      <Field label="Địa chỉ"><input className="input-field" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
      <Field label="Mã số thuế (nếu có)"><input className="input-field" value={form.taxCode || ''} onChange={e => setForm({ ...form, taxCode: e.target.value })} /></Field>
      <Field label="Logo (link Drive)"><input className="input-field" value={form.logoUrl || ''} onChange={e => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://trishteam.io.vn/share/..." /></Field>
      <div className="flex justify-end gap-2">
        {saved && <span style={{ fontSize: 12, color: '#10b981', alignSelf: 'center' }}>✓ Đã lưu</span>}
        <button type="submit" className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Lưu</button>
      </div>
    </form>
  );
}

// ==========================================================
// Reusable
// ==========================================================
function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }): JSX.Element {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ maxHeight: '90vh', width: '100%', maxWidth: 560, overflow: 'auto', background: 'var(--color-surface-card)', color: 'var(--color-text-primary)', borderRadius: 16, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: '1px solid var(--color-border-subtle)' }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }): JSX.Element {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>{label}</span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}
