/**
 * NhaTroModule — Phase 23.2.B.
 *
 * Sub-nav 10 pages: Dashboard / Phòng / Khách thuê / Hợp đồng / Chi phí /
 *                    Điện-Nước / Hóa đơn / Thanh toán / Sự cố / Cài đặt.
 *
 * Phase 23.2.B build: Dashboard + Phòng + Khách thuê + Hợp đồng (basic).
 * Phase 23.2.C: Hóa đơn QR + Print HĐ Word + Điện-Nước + Thanh toán.
 * Phase 23.2.D: Chi phí + Sự cố + Cài đặt 6 sub-modal.
 */

import { useMemo, useState, type FormEvent, type ChangeEvent } from 'react';
import {
  Home, Building2, Users, FileText, Wallet, Zap, Receipt, CreditCard, AlertTriangle, Settings as SettingsIcon,
  Plus, Edit3, Trash2, Search, X, Printer, Download as DownloadIcon, ExternalLink,
  TrendingUp, Wrench, FolderOpen, AlertCircle as AlertIcon, CheckCircle2, RotateCcw,
  Building, Tag as TagIcon, Landmark, FileText as FileIcon, Users as UsersIcon, QrCode as QrCodeIcon,
  ChevronDown, MapPin, Calendar, Phone, IdCard, Briefcase, Sparkles, Eye, Mail,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { useFinanceDb, now, today, thisMonth, createId, money, moneyShort, dateVN, appendLog, vietQrUrl, escapeHtml, downloadBlob, daysUntil } from '../../state';
import type { Phong, KhachThue, HopDong, PhongStatus, HopDongStatus, NhaTroProperty, DienNuocReading, HoaDonNhaTro, ThanhToan, ChiPhi, SuCo, HoaDonStatus, SuCoStatus } from '../../types';
import { useDialog } from '../../components/DialogProvider';
import { NumberInput } from '../../components/NumberInput';

type SubPage = 'dashboard' | 'phong' | 'khach' | 'hopdong' | 'chiphi' | 'diennuoc' | 'hoadon' | 'thanhtoan' | 'suco' | 'caidat';

const SUB_PAGES: Array<{ id: SubPage; icon: any; label: string }> = [
  { id: 'dashboard', icon: Home, label: 'Tổng quan' },
  { id: 'phong', icon: Building2, label: 'Phòng' },
  { id: 'khach', icon: Users, label: 'Khách thuê' },
  { id: 'hopdong', icon: FileText, label: 'Hợp đồng' },
  { id: 'chiphi', icon: Wallet, label: 'Chi phí' },
  { id: 'diennuoc', icon: Zap, label: 'Điện - Nước' },
  { id: 'hoadon', icon: Receipt, label: 'Hóa đơn' },
  { id: 'thanhtoan', icon: CreditCard, label: 'Thanh toán' },
  { id: 'suco', icon: AlertTriangle, label: 'Sự cố' },
  { id: 'caidat', icon: SettingsIcon, label: 'Cài đặt' },
];

export function NhaTroModule(): JSX.Element {
  const [page, setPage] = useState<SubPage>('dashboard');
  const finance = useFinanceDb();
  const { db } = finance;

  // Phase 23.8.C — Multi-property: nếu chưa có property nào → setup wizard
  if (db.properties.length === 0) {
    return <FirstPropertyWizard finance={finance} />;
  }

  // Active property (fallback đầu tiên nếu activePropertyId invalid)
  const activeProperty = db.properties.find(p => p.id === db.activePropertyId) || db.properties[0];

  return (
    <div>
      <PropertySwitcher finance={finance} activeProperty={activeProperty} />
      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 16, marginTop: 12 }}>
        <nav className="card" style={{ padding: 8, height: 'fit-content', position: 'sticky', top: 80 }}>
          {SUB_PAGES.map(p => {
            const isActive = page === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPage(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  textAlign: 'left', border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  marginBottom: 2,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-surface-row)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon style={{ width: 16, height: 16 }} /> {p.label}
              </button>
            );
          })}
        </nav>

        <div style={{ minWidth: 0 }}>
          {page === 'dashboard' && <DashboardPage finance={finance} setPage={setPage} activeProperty={activeProperty} />}
          {page === 'phong' && <PhongPage finance={finance} activeProperty={activeProperty} />}
          {page === 'khach' && <KhachPage finance={finance} />}
          {page === 'hopdong' && <HopDongPage finance={finance} activeProperty={activeProperty} />}
          {page === 'diennuoc' && <DienNuocPage finance={finance} activeProperty={activeProperty} />}
          {page === 'hoadon' && <HoaDonPage finance={finance} activeProperty={activeProperty} />}
          {page === 'thanhtoan' && <ThanhToanPage finance={finance} />}
          {page === 'chiphi' && <ChiPhiPage finance={finance} activeProperty={activeProperty} />}
          {page === 'suco' && <SuCoPage finance={finance} activeProperty={activeProperty} />}
          {page === 'caidat' && <CaiDatPage finance={finance} activeProperty={activeProperty} />}
        </div>
      </div>
    </div>
  );
}

// ==========================================================
// FirstPropertyWizard — setup nhà trọ đầu tiên
// ==========================================================
function FirstPropertyWizard({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { update } = finance;
  const [name, setName] = useState('Nhà Trọ Của Tôi');
  const [address, setAddress] = useState('');

  function handleStart(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    update(d => {
      const id = createId('prop');
      d.properties.push({
        id, name: name.trim(), address: address.trim(),
        repName: '', repAddress: '', repPhone: '', repBirth: '', repCccd: '', repCccdDate: '', repCccdPlace: '',
        active: true, createdAt: now(),
      });
      d.activePropertyId = id;
      appendLog(d, `Tạo nhà trọ đầu tiên: ${name}`, 'nhatro');
    });
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <Sparkles style={{ width: 48, height: 48, color: 'var(--color-accent-primary)', margin: '0 auto', display: 'block' }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Chào mừng tới Quản lý nhà trọ!</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>Tạo nhà trọ đầu tiên để bắt đầu. Sau này có thể thêm nhiều nhà trọ và swap qua lại.</p>
        <form onSubmit={handleStart} className="space-y-3" style={{ marginTop: 20, textAlign: 'left' }}>
          <Field label="Tên nhà trọ *"><input className="input-field" value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
          <Field label="Địa chỉ"><input className="input-field" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 đường X, Phường Y, TP Z" /></Field>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
            <Plus className="h-5 w-5" /> Tạo nhà trọ
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================================
// PropertySwitcher — dropdown swap nhà trọ
// ==========================================================
function PropertySwitcher({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  function selectProperty(id: string) {
    update(d => { d.activePropertyId = id; });
    setOpen(false);
  }

  function handleAddProperty(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    update(d => {
      const id = createId('prop');
      d.properties.push({
        id, name: newName.trim(), address: newAddress.trim(),
        repName: '', repAddress: '', repPhone: '', repBirth: '', repCccd: '', repCccdDate: '', repCccdPlace: '',
        active: true, createdAt: now(),
      });
      d.activePropertyId = id;
      appendLog(d, `Thêm nhà trọ: ${newName}`, 'nhatro');
    });
    setNewName(''); setNewAddress('');
    setShowAdd(false); setOpen(false);
  }

  async function handleDeleteProperty(id: string) {
    const prop = db.properties.find(p => p.id === id);
    if (!prop) return;
    if (db.properties.length === 1) {
      await dialog.alert('Không thể xoá nhà trọ duy nhất. Cần có ít nhất 1 nhà trọ.', { variant: 'warning' });
      return;
    }
    const phongCount = db.phongs.filter(p => p.propertyId === id).length;
    const ok = await dialog.confirm(
      `Xoá nhà trọ "${prop.name}"?\n\nTất cả ${phongCount} phòng + hợp đồng + hóa đơn + dữ liệu liên quan sẽ BỊ XOÁ vĩnh viễn.\n\nKhông thể hoàn tác.`,
      { variant: 'danger', okLabel: 'Xoá vĩnh viễn', title: 'Xác nhận xoá nhà trọ' }
    );
    if (!ok) return;
    update(d => {
      d.properties = d.properties.filter(p => p.id !== id);
      // Cascade delete: tất cả phong + hopDong + hoaDon + dienNuoc + chiPhi + suCo + thanhToan thuộc property này
      const phongIds = d.phongs.filter(p => p.propertyId === id).map(p => p.id);
      d.phongs = d.phongs.filter(p => p.propertyId !== id);
      d.hopDongs = d.hopDongs.filter(h => !phongIds.includes(h.phongId));
      d.dienNuoc = d.dienNuoc.filter(r => !phongIds.includes(r.phongId));
      const hoaDonIds = d.hoaDons.filter(h => phongIds.includes(h.phongId)).map(h => h.id);
      d.hoaDons = d.hoaDons.filter(h => !phongIds.includes(h.phongId));
      d.thanhToans = d.thanhToans.filter(t => !hoaDonIds.includes(t.hoaDonId));
      d.suCos = d.suCos.filter(s => !s.phongId || !phongIds.includes(s.phongId));
      // Switch active
      if (d.activePropertyId === id) d.activePropertyId = d.properties[0]?.id || '';
      appendLog(d, `Xoá nhà trọ: ${prop.name}`, 'nhatro');
    });
  }

  return (
    <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 style={{ width: 22, height: 22 }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04, fontWeight: 600 }}>Đang quản lý</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProperty.name}</div>
          {activeProperty.address && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProperty.address}</div>}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <button className="btn-secondary" onClick={() => setOpen(v => !v)}>
          {db.properties.length > 1 ? `${db.properties.length} nhà trọ` : 'Quản lý'} <ChevronDown className="h-4 w-4" />
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 320, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 30, overflow: 'hidden' }}>
            <div style={{ padding: 8, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', padding: '4px 8px' }}>Nhà trọ ({db.properties.length})</div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {db.properties.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, background: p.id === activeProperty.id ? 'var(--color-accent-soft)' : 'transparent' }}>
                    <button type="button" onClick={() => selectProperty(p.id)} style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: p.id === activeProperty.id ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.address && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</div>}
                    </button>
                    {p.id === activeProperty.id && <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-accent-primary)' }} />}
                    <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDeleteProperty(p.id)} title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 8 }}>
              {!showAdd ? (
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4" /> Thêm nhà trọ mới
                </button>
              ) : (
                <form onSubmit={handleAddProperty} className="space-y-2">
                  <input className="input-field" placeholder="Tên nhà trọ *" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                  <input className="input-field" placeholder="Địa chỉ" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)} style={{ flex: 1 }}>Huỷ</button>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }}>Tạo</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// Dashboard
// ==========================================================
function DashboardPage({ finance, setPage, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; setPage: (p: SubPage) => void; activeProperty: NhaTroProperty }): JSX.Element {
  const { db } = finance;
  // Phase 23.8.C — filter theo activeProperty
  const phongIdsOfProp = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);
  const stats = useMemo(() => {
    const phongs = db.phongs.filter(p => p.propertyId === activeProperty.id);
    const phongDangThue = phongs.filter(p => p.status === 'dang_thue').length;
    const phongTrong = phongs.filter(p => p.status === 'trong').length;
    const totalRevenueThisMonth = db.hoaDons.filter(h => {
      const d = new Date();
      return phongIdsOfProp.includes(h.phongId) && h.thang === d.getMonth() + 1 && h.nam === d.getFullYear() && h.status === 'da_tt';
    }).reduce((s, h) => s + h.total, 0);
    const totalCongNo = db.hoaDons.filter(h => phongIdsOfProp.includes(h.phongId) && h.status !== 'da_tt').reduce((s, h) => s + h.total, 0);
    const totalChi = db.chiPhis.filter(c => {
      const d = new Date(c.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && c.fromModule === 'nhatro';
    }).reduce((s, c) => s + c.amount, 0);
    return { phongs: phongs.length, phongDangThue, phongTrong, totalRevenueThisMonth, totalCongNo, totalChi, profit: totalRevenueThisMonth - totalChi };
  }, [db, activeProperty.id, phongIdsOfProp]);

  // 6-month profit bar
  const monthlyData = useMemo(() => {
    const out: { label: string; thu: number; chi: number; loi: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1, y = d.getFullYear();
      const thu = db.hoaDons.filter(h => h.thang === m && h.nam === y && h.status === 'da_tt').reduce((s, h) => s + h.total, 0);
      const chi = db.chiPhis.filter(c => {
        const cd = new Date(c.date);
        return cd.getMonth() + 1 === m && cd.getFullYear() === y;
      }).reduce((s, c) => s + c.amount, 0);
      out.push({ label: `${m}/${String(y).slice(2)}`, thu, chi, loi: thu - chi });
    }
    return out;
  }, [db]);

  const recentInvoices = db.hoaDons.slice(0, 5);
  const sucoChoXuLy = db.suCos.filter(s => s.status !== 'da_xong').slice(0, 5);

  return (
    <div className="space-y-4">
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat icon={TrendingUp} label="Tổng thu tháng" value={moneyShort(stats.totalRevenueThisMonth) + 'đ'} hint="Hóa đơn đã thanh toán" color="emerald" />
        <Stat icon={Wallet} label="Tổng chi tháng" value={moneyShort(stats.totalChi) + 'đ'} hint="Mọi chi phí phát sinh" color="red" />
        <Stat icon={TrendingUp} label="Lợi nhuận" value={moneyShort(stats.profit) + 'đ'} hint="Thu - Chi" color="emerald" />
        <Stat icon={AlertIcon} label="Công nợ" value={moneyShort(stats.totalCongNo) + 'đ'} hint="Hóa đơn chưa thu" color="amber" />
        <Stat icon={Building2} label="Phòng đang thuê" value={`${stats.phongDangThue}/${stats.phongs}`} hint={`${stats.phongTrong} phòng trống`} color="emerald" />
        <Stat icon={Users} label="Khách thuê" value={db.khachs.length} hint={`${db.hopDongs.filter(h => h.status === 'dang_hd').length} HĐ đang hiệu lực`} color="emerald" />
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="card">
          <h2 className="card-title">Lợi nhuận 6 tháng qua</h2>
          <p className="card-subtitle">Thu - Chi từng tháng (đã thanh toán)</p>
          <div style={{ height: 220, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
                <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
                <ReTooltip
                  formatter={(v: number) => money(v)}
                  contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, color: 'var(--color-text-primary)', fontSize: 12 }}
                />
                <Bar dataKey="loi" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Tình trạng phòng</h2>
          <div className="space-y-3" style={{ marginTop: 10 }}>
            <RoomStatusRow label="Đang thuê" count={stats.phongDangThue} total={db.phongs.length} color="#10b981" />
            <RoomStatusRow label="Trống" count={stats.phongTrong} total={db.phongs.length} color="#3b82f6" />
            <RoomStatusRow label="Đặt cọc" count={db.phongs.filter(p => p.status === 'dat_coc').length} total={db.phongs.length} color="#f59e0b" />
            <RoomStatusRow label="Bảo trì" count={db.phongs.filter(p => p.status === 'bao_tri').length} total={db.phongs.length} color="#ef4444" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Hóa đơn gần đây</h2>
            <p className="card-subtitle">5 hóa đơn mới nhất</p>
          </div>
          <button className="btn-secondary" onClick={() => setPage('hoadon')}>Xem tất cả</button>
        </div>
        {recentInvoices.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>Chưa có hóa đơn nào.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentInvoices.map(h => {
              const phong = db.phongs.find(p => p.id === h.phongId);
              return (
                <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr 100px 110px', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--color-surface-row)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent-primary)' }}>{phong?.code || '?'}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{h.thang}/{h.nam}</span>
                  <span style={{ fontWeight: 600 }}>{money(h.total)}</span>
                  <span className={`badge ${h.status === 'da_tt' ? 'badge-green' : h.status === 'qua_han' ? 'badge-red' : 'badge-yellow'}`}>{h.status === 'da_tt' ? 'Đã TT' : h.status === 'qua_han' ? 'Quá hạn' : 'Chưa TT'}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Hạn: {dateVN(h.hanTT)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CalendarWidget finance={finance} activeProperty={activeProperty} setPage={setPage} />

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sự cố chờ xử lý</h2>
            <p className="card-subtitle">Yêu cầu sửa chữa từ khách thuê</p>
          </div>
          <button className="btn-secondary" onClick={() => setPage('suco')}><Wrench className="h-4 w-4" /> Quản lý</button>
        </div>
        {sucoChoXuLy.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>Không có sự cố nào cần xử lý.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sucoChoXuLy.map(s => {
              const phong = db.phongs.find(p => p.id === s.phongId);
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 100px', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 10, background: 'var(--color-surface-row)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-accent-primary)' }}>{phong?.code || '-'}</span>
                  <span>{s.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{dateVN(s.reportedAt)}</span>
                  <span className={`badge ${s.status === 'cho_xu_ly' ? 'badge-yellow' : 'badge-blue'}`}>{s.status === 'cho_xu_ly' ? 'Chờ' : 'Đang xử lý'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// CalendarWidget — Phase 23.8.D
// Hiển thị calendar tháng hiện tại với markers:
//   - red dot: hóa đơn quá hạn / chưa TT past hạn
//   - amber dot: hóa đơn sắp hạn (≤3 ngày)
//   - blue dot: HĐ thuê hết hạn (≤30 ngày)
//   - green dot: lịch sự cố
// ==========================================================
interface DayEvent { type: 'invoice_due' | 'invoice_overdue' | 'contract_end' | 'suco'; label: string; color: string; }
function CalendarWidget({ finance, activeProperty, setPage }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty; setPage: (p: SubPage) => void }): JSX.Element {
  const { db } = finance;
  const todayD = new Date();
  const [year, setYear] = useState(todayD.getFullYear());
  const [month, setMonth] = useState(todayD.getMonth() + 1); // 1-12
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const phongIds = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);

  // Build events map (key=YYYY-MM-DD → DayEvent[])
  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const push = (key: string, ev: DayEvent) => {
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    };
    // Hoá đơn (filter by property)
    for (const h of db.hoaDons) {
      if (!phongIds.includes(h.phongId)) continue;
      if (h.status === 'da_tt') continue;
      const phong = db.phongs.find(p => p.id === h.phongId);
      const days = daysUntil(h.hanTT);
      if (days < 0) push(h.hanTT, { type: 'invoice_overdue', label: `HĐ ${phong?.code} quá hạn`, color: '#ef4444' });
      else push(h.hanTT, { type: 'invoice_due', label: `HĐ ${phong?.code} đến hạn`, color: '#f59e0b' });
    }
    // Hợp đồng kết thúc
    for (const h of db.hopDongs) {
      if (h.status !== 'dang_hd') continue;
      if (!phongIds.includes(h.phongId)) continue;
      const phong = db.phongs.find(p => p.id === h.phongId);
      const days = daysUntil(h.endDate);
      if (days <= 60 && days >= -7) {
        push(h.endDate, { type: 'contract_end', label: `Hết HĐ ${phong?.code}`, color: '#3b82f6' });
      }
    }
    // Sự cố chưa xong
    for (const s of db.suCos) {
      if (s.status === 'da_xong') continue;
      if (s.phongId && !phongIds.includes(s.phongId)) continue;
      const date = s.reportedAt.slice(0, 10);
      const phong = s.phongId ? db.phongs.find(p => p.id === s.phongId) : null;
      push(date, { type: 'suco', label: `Sự cố ${phong?.code || ''}: ${s.title}`, color: '#10b981' });
    }
    return map;
  }, [db.hoaDons, db.hopDongs, db.suCos, db.phongs, phongIds]);

  // Build days for the month grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
  const monthLabel = `${String(month).padStart(2, '0')}/${year}`;

  function navMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
    setSelectedDate(null);
  }

  function dayKey(day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const cells: Array<{ day: number | null; key: string; events: DayEvent[]; isToday: boolean }> = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: null, key: `pad-${i}`, events: [], isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dayKey(d);
    const isToday = year === todayD.getFullYear() && month === todayD.getMonth() + 1 && d === todayD.getDate();
    cells.push({ day: d, key, events: eventsByDate.get(key) || [], isToday });
  }

  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">📅 Lịch nhắc tháng {monthLabel}</h2>
          <p className="card-subtitle">Đỏ: quá hạn · Cam: HĐ đến hạn · Xanh dương: hết HĐ thuê · Xanh lá: sự cố</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navMonth(-1)} style={{ padding: '6px 10px' }}>‹</button>
          <button className="btn-secondary" onClick={() => { const t = new Date(); setMonth(t.getMonth() + 1); setYear(t.getFullYear()); setSelectedDate(null); }} style={{ padding: '6px 10px', fontSize: 11 }}>Hôm nay</button>
          <button className="btn-secondary" onClick={() => navMonth(1)} style={{ padding: '6px 10px' }}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 12 }}>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', padding: 4 }}>{d}</div>
        ))}
        {cells.map(c => {
          if (c.day === null) return <div key={c.key} />;
          const isSelected = selectedDate === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setSelectedDate(c.events.length > 0 ? (isSelected ? null : c.key) : null)}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                background: isSelected ? 'var(--color-accent-soft)' : c.isToday ? 'rgba(59,130,246,0.08)' : 'var(--color-surface-row)',
                border: c.isToday ? '1px solid #3b82f6' : '1px solid transparent',
                borderRadius: 8,
                cursor: c.events.length > 0 ? 'pointer' : 'default',
                color: c.isToday ? '#3b82f6' : 'var(--color-text-primary)',
                fontSize: 12,
                fontWeight: c.isToday ? 700 : 500,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                gap: 2,
              }}
            >
              <span>{c.day}</span>
              {c.events.length > 0 && (
                <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                  {Array.from(new Set(c.events.map(e => e.color))).slice(0, 3).map((color, i) => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--color-surface-row)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 6 }}>Sự kiện ngày {dateVN(selectedDate)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedEvents.map((e, i) => (
              <div key={i}
                onClick={() => { if (e.type === 'invoice_due' || e.type === 'invoice_overdue') setPage('hoadon'); else if (e.type === 'contract_end') setPage('hopdong'); else if (e.type === 'suco') setPage('suco'); }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--color-surface-card)', borderRadius: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{e.label}</span>
                <ExternalLink style={{ width: 12, height: 12, color: 'var(--color-text-muted)' }} />
              </div>
            ))}
          </div>
        </div>
      )}
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
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 4, lineHeight: 1.1 }}>{value}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{hint}</div>}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function RoomStatusRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }): JSX.Element {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--color-text-primary)' }}>{count}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface-row)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 200ms' }} />
      </div>
    </div>
  );
}

// ==========================================================
// Phòng — cards by floor
// ==========================================================
function PhongPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | PhongStatus>('all');
  const [editing, setEditing] = useState<Phong | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<Phong | null>(null);

  const phongsOfProp = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id), [db.phongs, activeProperty.id]);

  const byFloor = useMemo(() => {
    const map = new Map<number, Phong[]>();
    for (const p of phongsOfProp) {
      if (search && !p.code.toLowerCase().includes(search.toLowerCase()) && !p.note?.toLowerCase().includes(search.toLowerCase())) continue;
      if (filterStatus !== 'all' && p.status !== filterStatus) continue;
      const list = map.get(p.floor) || [];
      list.push(p);
      map.set(p.floor, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [phongsOfProp, search, filterStatus]);

  async function handleDelete(id: string) {
    const phong = db.phongs.find(p => p.id === id);
    if (!phong) return;
    const ok = await dialog.confirm(`Xoá phòng ${phong.code}? Tất cả hợp đồng + hóa đơn của phòng này cũng sẽ bị xoá.`, { variant: 'danger', title: 'Xác nhận xoá phòng', okLabel: 'Xoá phòng' });
    if (!ok) return;
    update(d => {
      d.phongs = d.phongs.filter(p => p.id !== id);
      d.hopDongs = d.hopDongs.filter(h => h.phongId !== id);
      d.dienNuoc = d.dienNuoc.filter(r => r.phongId !== id);
      const hoaDonIds = d.hoaDons.filter(h => h.phongId === id).map(h => h.id);
      d.hoaDons = d.hoaDons.filter(h => h.phongId !== id);
      d.thanhToans = d.thanhToans.filter(t => !hoaDonIds.includes(t.hoaDonId));
      appendLog(d, `Xoá phòng: ${phong.code}`, 'nhatro');
    });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Quản lý phòng</h2>
            <p className="card-subtitle">{db.phongs.length} phòng · {db.phongs.filter(p => p.status === 'dang_thue').length} đang thuê · {db.phongs.filter(p => p.status === 'trong').length} trống</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm phòng</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 200px', marginTop: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
            <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm phòng..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="trong">Trống</option>
            <option value="dang_thue">Đang thuê</option>
            <option value="dat_coc">Đặt cọc</option>
            <option value="bao_tri">Bảo trì</option>
          </select>
        </div>
      </div>

      {byFloor.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Building2 style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có phòng nào. Bấm "Thêm phòng" để bắt đầu.</p>
        </div>
      ) : (
        byFloor.map(([floor, phongs]) => (
          <div key={floor} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>Tầng {floor}</h3>
                <p className="card-subtitle">{phongs.length} phòng · {phongs.filter(p => p.status === 'trong').length} trống · {phongs.filter(p => p.status === 'dang_thue').length} thuê</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {phongs.map(p => <PhongCard key={p.id} phong={p} onClick={() => setViewing(p)} onEdit={() => setEditing(p)} onDelete={() => handleDelete(p.id)} />)}
            </div>
          </div>
        ))
      )}

      {(showCreate || editing) && (
        <PhongModal
          editing={editing}
          finance={finance}
          activeProperty={activeProperty}
          onClose={() => { setShowCreate(false); setEditing(null); }}
        />
      )}
      {viewing && <PhongDetailModal finance={finance} phong={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
    </div>
  );
}

function PhongCard({ phong, onClick, onEdit, onDelete }: { phong: Phong; onClick: () => void; onEdit: () => void; onDelete: () => void }): JSX.Element {
  const STATUS_COLORS: Record<PhongStatus, { bg: string; border: string; label: string; iconColor: string }> = {
    trong: { bg: 'rgba(59,130,246,0.08)', border: '#3b82f6', label: 'Trống', iconColor: '#3b82f6' },
    dang_thue: { bg: 'rgba(16,185,129,0.08)', border: '#10b981', label: 'Đang thuê', iconColor: '#10b981' },
    dat_coc: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', label: 'Đặt cọc', iconColor: '#f59e0b' },
    bao_tri: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', label: 'Bảo trì', iconColor: '#ef4444' },
  };
  const s = STATUS_COLORS[phong.status];
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${s.border}`, background: s.bg, padding: 12, position: 'relative', cursor: 'pointer', transition: 'transform 100ms' }}
      onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>{phong.code}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: s.iconColor, marginTop: 2 }}>{s.label}</div>
        </div>
        <Building2 style={{ width: 18, height: 18, color: s.iconColor }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 700 }}>{money(phong.rentPrice)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>/tháng</span></div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
        <Users className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />{phong.maxOccupants} người
        {phong.area ? <> · {phong.area}m²</> : null}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Sửa"><Edit3 className="h-3.5 w-3.5" /></button>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ color: '#ef4444' }} title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

// ==========================================================
// PhongDetailModal — chi tiết phòng (Phase 23.8.B)
// ==========================================================
function PhongDetailModal({ finance, phong, onClose, onEdit }: { finance: ReturnType<typeof useFinanceDb>; phong: Phong; onClose: () => void; onEdit: () => void }): JSX.Element {
  const { db } = finance;
  const hd = db.hopDongs.find(h => h.phongId === phong.id && h.status === 'dang_hd');
  const khach = hd ? db.khachs.find(k => k.id === hd.khachId) : null;
  const hoaDons = db.hoaDons.filter(h => h.phongId === phong.id).slice(0, 5);
  const congNo = db.hoaDons.filter(h => h.phongId === phong.id && h.status !== 'da_tt').reduce((s, h) => s + h.total, 0);
  const lastReading = db.dienNuoc.filter(r => r.phongId === phong.id).sort((a, b) => (b.nam * 12 + b.thang) - (a.nam * 12 + a.thang))[0];

  const STATUS_COLORS: Record<PhongStatus, { color: string; label: string }> = {
    trong: { color: '#3b82f6', label: 'Trống' },
    dang_thue: { color: '#10b981', label: 'Đang thuê' },
    dat_coc: { color: '#f59e0b', label: 'Đặt cọc' },
    bao_tri: { color: '#ef4444', label: 'Bảo trì' },
  };
  const s = STATUS_COLORS[phong.status];

  return (
    <Modal title={`Chi tiết phòng ${phong.code}`} onClose={onClose}>
      {/* Status + giá */}
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Trạng thái</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Giá thuê</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)', marginTop: 2 }}>{money(phong.rentPrice)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-text-muted)' }}>/tháng</span></div>
        </div>
      </div>

      {/* Info phòng */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <Info icon={Building2} label="Tầng" value={`Tầng ${phong.floor}`} />
        <Info icon={Users} label="Sức chứa" value={`${phong.maxOccupants} người tối đa`} />
        {phong.area ? <Info icon={MapPin} label="Diện tích" value={`${phong.area} m²`} /> : null}
        <Info icon={Calendar} label="Tạo ngày" value={dateVN(phong.createdAt)} />
      </div>

      {/* Hợp đồng đang hiệu lực */}
      <div style={{ marginTop: 14 }}>
        <SectionLabel>Hợp đồng đang hiệu lực</SectionLabel>
        {hd && khach ? (
          <div className="rounded-xl p-3 mt-2" style={{ background: 'var(--color-surface-row)', borderLeft: '3px solid #10b981' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{khach.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {khach.phone && <><Phone className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />{khach.phone}</>}
              {khach.cccd && <> · <IdCard className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />{khach.cccd}</>}
              {khach.job && <> · <Briefcase className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />{khach.job}</>}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <span>Bắt đầu: <b>{dateVN(hd.startDate)}</b></span>
              <span>Kết thúc: <b>{dateVN(hd.endDate)}</b></span>
              <span>Tiền cọc: <b>{money(hd.deposit)}</b></span>
              <span>Hình thức TT: <b>{hd.paymentMethod}</b></span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl p-3 mt-2" style={{ background: 'var(--color-surface-row)', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Chưa có hợp đồng nào đang hiệu lực
          </div>
        )}
      </div>

      {/* Chỉ số đồng hồ gần nhất */}
      {lastReading && (
        <div style={{ marginTop: 14 }}>
          <SectionLabel>Chỉ số đồng hồ T{lastReading.thang}/{lastReading.nam}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>⚡ ĐIỆN</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{lastReading.dienCu} → {lastReading.dienMoi}</div>
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Dùng: {lastReading.dienMoi - lastReading.dienCu} kWh</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6' }}>💧 NƯỚC</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{lastReading.nuocCu} → {lastReading.nuocMoi}</div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Dùng: {lastReading.nuocMoi - lastReading.nuocCu} m³</div>
            </div>
          </div>
        </div>
      )}

      {/* Hóa đơn gần đây + công nợ */}
      <div style={{ marginTop: 14 }}>
        <SectionLabel>Hóa đơn gần đây ({hoaDons.length}) {congNo > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>· Công nợ: {money(congNo)}</span>}</SectionLabel>
        {hoaDons.length === 0 ? (
          <div className="rounded-xl p-3 mt-2" style={{ background: 'var(--color-surface-row)', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>Chưa có hóa đơn nào</div>
        ) : (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hoaDons.map(h => (
              <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 100px 80px', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-row)' }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>T{h.thang}/{h.nam}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-muted)' }}>{h.invCode}</span>
                <b style={{ fontSize: 13, textAlign: 'right' }}>{money(h.total)}</b>
                <span className={`badge ${h.status === 'da_tt' ? 'badge-green' : h.status === 'qua_han' ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: 10, justifySelf: 'end' }}>{h.status === 'da_tt' ? 'Đã TT' : h.status === 'qua_han' ? 'Quá hạn' : 'Chưa TT'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ghi chú */}
      {phong.note && <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--color-surface-row)', fontSize: 12 }}>📝 {phong.note}</div>}

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
        <button type="button" className="btn-primary" onClick={onEdit}><Edit3 className="h-4 w-4" /> Sửa phòng</button>
      </div>
    </Modal>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: any }): JSX.Element {
  return (
    <div className="rounded-xl p-2" style={{ background: 'var(--color-surface-row)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon style={{ width: 16, height: 16, color: 'var(--color-accent-primary)', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: any }): JSX.Element {
  return <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>{children}</div>;
}

function PhongModal({ editing, finance, activeProperty, onClose }: { editing: Phong | null; finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty; onClose: () => void }): JSX.Element {
  const { update } = finance;
  const dialog = useDialog();
  const [form, setForm] = useState<Phong>(editing ?? {
    id: '', propertyId: activeProperty.id, code: '', floor: 1, area: 0, rentPrice: 0, maxOccupants: 2,
    status: 'trong', note: '', imageUrl: '',
    createdAt: '', updatedAt: '',
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { await dialog.alert('Nhập mã phòng (VD: P101)', { variant: 'warning' }); return; }
    update(d => {
      if (editing) {
        d.phongs = d.phongs.map(p => p.id === editing.id ? { ...form, updatedAt: now() } : p);
        appendLog(d, `Cập nhật phòng: ${form.code}`, 'nhatro');
      } else {
        d.phongs.push({ ...form, id: createId('phong'), propertyId: activeProperty.id, createdAt: now(), updatedAt: now() });
        appendLog(d, `Thêm phòng mới: ${form.code}`, 'nhatro');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa phòng ${editing.code}` : 'Thêm phòng mới'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label="Mã phòng *"><input className="input-field" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="P101" /></Field>
          <Field label="Tầng"><NumberInput value={form.floor} onChange={n => setForm({ ...form, floor: n || 1 })} min={1} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Diện tích"><NumberInput value={form.area || 0} onChange={n => setForm({ ...form, area: n })} suffix="m²" min={0} /></Field>
          <Field label="Số người tối đa"><NumberInput value={form.maxOccupants} onChange={n => setForm({ ...form, maxOccupants: n || 1 })} min={1} /></Field>
        </div>
        <Field label="Giá thuê / tháng"><NumberInput value={form.rentPrice} onChange={n => setForm({ ...form, rentPrice: n })} suffix="đ" min={0} placeholder="2.000.000" /></Field>
        <Field label="Trạng thái">
          <select className="select-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as PhongStatus })}>
            <option value="trong">Trống</option>
            <option value="dang_thue">Đang thuê</option>
            <option value="dat_coc">Đặt cọc</option>
            <option value="bao_tri">Bảo trì</option>
          </select>
        </Field>
        <Field label="Ảnh phòng (link share TrishDrive)"><input className="input-field" value={form.imageUrl || ''} onChange={e => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://trishteam.io.vn/share/..." /></Field>
        <Field label="Ghi chú"><input className="input-field" value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu thay đổi' : 'Thêm phòng'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Khách thuê — table
// ==========================================================
function KhachPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<KhachThue | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.khachs.filter(k => !q || [k.name, k.phone, k.cccd, k.job].some(x => (x || '').toLowerCase().includes(q)));
  }, [db.khachs, search]);

  async function handleDelete(id: string) {
    const k = db.khachs.find(x => x.id === id);
    if (!k) return;
    const ok = await dialog.confirm(`Xoá khách "${k.name}"?`, { variant: 'danger' });
    if (!ok) return;
    update(d => {
      d.khachs = d.khachs.filter(x => x.id !== id);
      appendLog(d, `Xoá khách: ${k.name}`, 'nhatro');
    });
  }

  function getDangO(khachId: string): string | null {
    const hd = db.hopDongs.find(h => h.khachId === khachId && h.status === 'dang_hd');
    if (!hd) return null;
    const phong = db.phongs.find(p => p.id === hd.phongId);
    return phong?.code || null;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Khách thuê</h2>
            <p className="card-subtitle">{db.khachs.length} khách · {filtered.length} đang hiển thị</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm khách</button>
        </div>
        <div style={{ position: 'relative', marginTop: 10 }}>
          <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm tên, SĐT, CCCD..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Users style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có khách thuê nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Họ tên</th><th>Đang ở</th><th>SĐT</th><th>CCCD</th><th>Nghề nghiệp</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k, idx) => {
                  const phongCode = getDangO(k.id);
                  return (
                    <tr key={k.id}>
                      <td>{idx + 1}</td>
                      <td><b>{k.name}</b></td>
                      <td>{phongCode ? <span className="badge badge-blue">{phongCode}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Chưa thuê</span>}</td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{k.phone || '-'}</td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{k.cccd || '-'}</td>
                      <td style={{ fontSize: 12 }}>{k.job || '-'}</td>
                      <td><div className="flex gap-1">
                        <button className="icon-btn" onClick={() => setEditing(k)}><Edit3 className="h-3.5 w-3.5" /></button>
                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(k.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editing) && (
        <KhachModal editing={editing} finance={finance} onClose={() => { setShowCreate(false); setEditing(null); }} />
      )}
    </div>
  );
}

function KhachModal({ editing, finance, onClose }: { editing: KhachThue | null; finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { update } = finance;
  const [form, setForm] = useState<KhachThue>(editing ?? {
    id: '', name: '', phone: '', cccd: '', cccdDate: '', cccdPlace: '',
    birth: '', job: '', address: '', cccdImageUrl: '', createdAt: '',
  });

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { await dialog.alert('Nhập họ tên', { variant: 'warning' }); return; }
    update(d => {
      if (editing) {
        d.khachs = d.khachs.map(k => k.id === editing.id ? form : k);
        appendLog(d, `Cập nhật khách: ${form.name}`, 'nhatro');
      } else {
        d.khachs.push({ ...form, id: createId('khach'), createdAt: now() });
        appendLog(d, `Thêm khách mới: ${form.name}`, 'nhatro');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa khách: ${editing.name}` : 'Thêm khách thuê'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Họ tên *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Số điện thoại"><input className="input-field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Ngày sinh"><input className="input-field" type="date" value={form.birth || ''} onChange={e => setForm({ ...form, birth: e.target.value })} /></Field>
        </div>
        <Field label="CCCD/CMND"><input className="input-field" value={form.cccd} onChange={e => setForm({ ...form, cccd: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Ngày cấp"><input className="input-field" type="date" value={form.cccdDate || ''} onChange={e => setForm({ ...form, cccdDate: e.target.value })} /></Field>
          <Field label="Nơi cấp"><input className="input-field" value={form.cccdPlace || ''} onChange={e => setForm({ ...form, cccdPlace: e.target.value })} placeholder="Cục cảnh sát..." /></Field>
        </div>
        <Field label="Nghề nghiệp"><input className="input-field" value={form.job || ''} onChange={e => setForm({ ...form, job: e.target.value })} /></Field>
        <Field label="Địa chỉ thường trú"><input className="input-field" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Ảnh CCCD (link share TrishDrive)"><input className="input-field" value={form.cccdImageUrl || ''} onChange={e => setForm({ ...form, cccdImageUrl: e.target.value })} placeholder="https://trishteam.io.vn/share/..." /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm khách'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Hợp đồng — table + create modal
// ==========================================================
function HopDongPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | HopDongStatus>('all');
  const [editing, setEditing] = useState<HopDong | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const phongIds = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.hopDongs.filter(h => {
      if (!phongIds.includes(h.phongId)) return false;
      const phong = db.phongs.find(p => p.id === h.phongId);
      const khach = db.khachs.find(k => k.id === h.khachId);
      if (filterStatus !== 'all' && h.status !== filterStatus) return false;
      if (!q) return true;
      return [phong?.code, khach?.name, khach?.phone].some(x => (x || '').toLowerCase().includes(q));
    });
  }, [db, search, filterStatus, phongIds]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá hợp đồng này?', { variant: 'danger' });
    if (!ok) return;
    update(d => {
      d.hopDongs = d.hopDongs.filter(h => h.id !== id);
      appendLog(d, 'Xoá hợp đồng', 'nhatro');
    });
  }

  async function handleEnd(id: string) {
    const ok = await dialog.confirm('Kết thúc hợp đồng này? Phòng sẽ chuyển về trạng thái Trống.', { variant: 'warning', okLabel: 'Kết thúc HĐ' });
    if (!ok) return;
    update(d => {
      const hd = d.hopDongs.find(h => h.id === id);
      if (!hd) return;
      hd.status = 'ket_thuc';
      hd.updatedAt = now();
      const phong = d.phongs.find(p => p.id === hd.phongId);
      if (phong) phong.status = 'trong';
      appendLog(d, `Kết thúc HĐ phòng ${phong?.code}`, 'nhatro');
    });
  }

  function handlePrintWord(h: HopDong) {
    const phong = db.phongs.find(p => p.id === h.phongId);
    const khach = db.khachs.find(k => k.id === h.khachId);
    if (!phong || !khach) { dialog.alert('Thiếu phòng hoặc khách', { variant: 'warning' }); return; }
    const todayD = new Date();
    const replacements: Record<string, string> = {
      '{{property_address}}':    activeProperty.address || '',
      '{{property_rep_name}}':   activeProperty.repName || '',
      '{{property_rep_address}}':activeProperty.repAddress || '',
      '{{property_phone}}':      activeProperty.repPhone || '',
      '{{property_birth}}':      activeProperty.repBirth ? dateVN(activeProperty.repBirth) : '',
      '{{property_cccd}}':       activeProperty.repCccd || '',
      '{{property_cccd_date}}':  activeProperty.repCccdDate ? dateVN(activeProperty.repCccdDate) : '',
      '{{property_cccd_place}}': activeProperty.repCccdPlace || '',
      '{{tenant_name}}':         khach.name,
      '{{tenant_phone}}':        khach.phone,
      '{{tenant_birth}}':        khach.birth ? dateVN(khach.birth) : '',
      '{{tenant_address}}':      khach.address || '',
      '{{tenant_cccd}}':         khach.cccd,
      '{{tenant_cccd_date}}':    khach.cccdDate ? dateVN(khach.cccdDate) : '',
      '{{tenant_cccd_place}}':   khach.cccdPlace || '',
      '{{room_code}}':           phong.code,
      '{{rent_price}}':          new Intl.NumberFormat('vi-VN').format(h.rentPrice),
      '{{deposit}}':             new Intl.NumberFormat('vi-VN').format(h.deposit),
      '{{payment_method}}':      h.paymentMethod || 'Tiền mặt',
      '{{elec_price}}':          new Intl.NumberFormat('vi-VN').format(db.invoiceConfig.defaultDienPrice),
      '{{water_price}}':         new Intl.NumberFormat('vi-VN').format(db.invoiceConfig.defaultNuocPrice),
      '{{custom_services}}':     h.customServices || '',
      '{{start_date}}':          dateVN(h.startDate),
      '{{end_date}}':            dateVN(h.endDate),
      '{{today_day}}':           String(todayD.getDate()),
      '{{today_month}}':         String(todayD.getMonth() + 1),
      '{{today_year}}':          String(todayD.getFullYear()),
    };
    let body = db.contractTemplate;
    for (const [k, v] of Object.entries(replacements)) {
      body = body.split(k).join(v);
    }
    const bodyHtml = escapeHtml(body)
      .split('\n')
      .map(line => `<p style="margin:0;line-height:1.55">${line || '&nbsp;'}</p>`)
      .join('');
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>HĐ ${escapeHtml(phong.code)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page WordSection1 { size:21cm 29.7cm; margin:2cm 2cm 2cm 2.5cm; mso-page-orientation:portrait; } div.WordSection1 { page:WordSection1; }
body { font-family: 'Times New Roman', serif; font-size: 13pt; }
</style>
</head><body><div class="WordSection1">${bodyHtml}</div></body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    downloadBlob(blob, `HopDong_${phong.code}_${khach.name.replace(/\s+/g,'_')}.doc`);
    appendLog(db, `Xuất HĐ Word phòng ${phong.code} — ${khach.name}`, 'nhatro');
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Hợp đồng</h2>
            <p className="card-subtitle">{db.hopDongs.length} HĐ · {db.hopDongs.filter(h => h.status === 'dang_hd').length} đang hiệu lực</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} disabled={db.phongs.length === 0 || db.khachs.length === 0}>
            <Plus className="h-4 w-4" /> Tạo HĐ
          </button>
        </div>
        {(db.phongs.length === 0 || db.khachs.length === 0) && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
            Cần có ít nhất 1 phòng + 1 khách trước khi tạo hợp đồng.
          </p>
        )}
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 200px', marginTop: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
            <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm phòng, khách, SĐT..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="dang_hd">Đang hiệu lực</option>
            <option value="ket_thuc">Đã kết thúc</option>
            <option value="huy">Đã huỷ</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <FileText style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có hợp đồng nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Phòng</th><th>Khách thuê</th><th>Bắt đầu</th><th>Kết thúc</th><th>Giá thuê</th><th>Cọc</th><th>Trạng thái</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => {
                  const phong = db.phongs.find(p => p.id === h.phongId);
                  const khach = db.khachs.find(k => k.id === h.khachId);
                  return (
                    <tr key={h.id}>
                      <td><b style={{ color: 'var(--color-accent-primary)' }}>{phong?.code || '?'}</b></td>
                      <td>{khach?.name || '?'}</td>
                      <td>{dateVN(h.startDate)}</td>
                      <td>{dateVN(h.endDate)}</td>
                      <td>{money(h.rentPrice)}</td>
                      <td>{money(h.deposit)}</td>
                      <td><span className={`badge ${h.status === 'dang_hd' ? 'badge-blue' : h.status === 'ket_thuc' ? 'badge-gray' : 'badge-red'}`}>
                        {h.status === 'dang_hd' ? 'Đang HĐ' : h.status === 'ket_thuc' ? 'Kết thúc' : 'Đã huỷ'}
                      </span></td>
                      <td><div className="flex gap-1">
                        <button className="icon-btn" title="Xuất Word (.doc)" onClick={() => handlePrintWord(h)}><DownloadIcon className="h-3.5 w-3.5" /></button>
                        {h.status === 'dang_hd' && <button className="icon-btn" style={{ color: '#f59e0b' }} onClick={() => handleEnd(h.id)} title="Kết thúc HĐ"><X className="h-3.5 w-3.5" /></button>}
                        <button className="icon-btn" onClick={() => setEditing(h)}><Edit3 className="h-3.5 w-3.5" /></button>
                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(h.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || editing) && (
        <HopDongModal editing={editing} finance={finance} onClose={() => { setShowCreate(false); setEditing(null); }} />
      )}
    </div>
  );
}

function HopDongModal({ editing, finance, onClose }: { editing: HopDong | null; finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  // Filter phong theo activeProperty (lookup từ db.activePropertyId)
  const phongsActive = db.phongs.filter(p => p.propertyId === db.activePropertyId);
  const [form, setForm] = useState<HopDong>(editing ?? {
    id: '', phongId: phongsActive.filter(p => p.status === 'trong')[0]?.id || phongsActive[0]?.id || '',
    khachId: db.khachs[0]?.id || '',
    startDate: today(), endDate: '', rentPrice: 0, deposit: 0,
    paymentMethod: 'Chuyển khoản / Tiền mặt', customServices: '',
    status: 'dang_hd', contractFileUrl: '',
    createdAt: '', updatedAt: '',
  });

  function selectPhong(phongId: string) {
    const p = db.phongs.find(x => x.id === phongId);
    setForm(f => ({ ...f, phongId, rentPrice: p?.rentPrice || f.rentPrice }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.phongId || !form.khachId) { await dialog.alert('Chọn Phòng + Khách thuê', { variant: 'warning' }); return; }
    update(d => {
      if (editing) {
        d.hopDongs = d.hopDongs.map(h => h.id === editing.id ? { ...form, updatedAt: now() } : h);
        appendLog(d, `Cập nhật HĐ phòng ${d.phongs.find(p => p.id === form.phongId)?.code}`, 'nhatro');
      } else {
        d.hopDongs.push({ ...form, id: createId('hd'), createdAt: now(), updatedAt: now() });
        // Auto đổi phòng sang dang_thue
        const phong = d.phongs.find(p => p.id === form.phongId);
        if (phong && form.status === 'dang_hd') phong.status = 'dang_thue';
        appendLog(d, `Tạo HĐ phòng ${phong?.code}`, 'nhatro');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? 'Sửa hợp đồng' : 'Tạo hợp đồng mới'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label="Phòng *">
            <select className="select-field" value={form.phongId} onChange={e => selectPhong(e.target.value)}>
              <option value="">-- Chọn phòng --</option>
              {phongsActive.map(p => <option key={p.id} value={p.id}>{p.code} ({p.status === 'trong' ? 'Trống' : p.status === 'dang_thue' ? 'Đang thuê' : p.status}) - {money(p.rentPrice)}</option>)}
            </select>
          </Field>
          <Field label="Khách thuê *">
            <select className="select-field" value={form.khachId} onChange={e => setForm({ ...form, khachId: e.target.value })}>
              <option value="">-- Chọn khách --</option>
              {db.khachs.map(k => <option key={k.id} value={k.id}>{k.name} ({k.phone || k.cccd || '-'})</option>)}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Ngày bắt đầu *"><input className="input-field" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Ngày kết thúc"><input className="input-field" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
        <div className="form-grid">
          <Field label="Giá thuê / tháng *"><NumberInput value={form.rentPrice} onChange={n => setForm({ ...form, rentPrice: n })} suffix="đ" min={0} /></Field>
          <Field label="Tiền cọc"><NumberInput value={form.deposit} onChange={n => setForm({ ...form, deposit: n })} suffix="đ" min={0} /></Field>
        </div>
        <Field label="Hình thức thanh toán"><input className="input-field" value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} /></Field>
        <Field label="Chi phí dịch vụ phụ (ghi chú)"><input className="input-field" value={form.customServices || ''} onChange={e => setForm({ ...form, customServices: e.target.value })} placeholder="VD: trông xe 100k/tháng, gửi thư 20k/tháng" /></Field>
        <Field label="File HĐ scan (link share TrishDrive)"><input className="input-field" value={form.contractFileUrl || ''} onChange={e => setForm({ ...form, contractFileUrl: e.target.value })} placeholder="https://trishteam.io.vn/share/..." /></Field>
        <Field label="Trạng thái">
          <select className="select-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as HopDongStatus })}>
            <option value="dang_hd">Đang hiệu lực</option>
            <option value="ket_thuc">Đã kết thúc</option>
            <option value="huy">Đã huỷ</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Tạo HĐ'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Reusable
// ==========================================================
function ComingSoon({ title, desc }: { title: string; desc: string }): JSX.Element {
  return (
    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
      <FolderOpen style={{ width: 48, height: 48, color: 'var(--color-accent-primary)', margin: '0 auto', display: 'block' }} />
      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>{title}</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>{desc}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }): JSX.Element {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ maxHeight: '90vh', width: '100%', maxWidth: 640, overflow: 'auto', background: 'var(--color-surface-card)', color: 'var(--color-text-primary)', borderRadius: 16, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: '1px solid var(--color-border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{title}</h2>
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

// ==========================================================
// Phase 23.2.C — Điện - Nước (chỉ số đồng hồ)
// ==========================================================
function DienNuocPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const tm = thisMonth();
  const [thang, setThang] = useState(tm.thang);
  const [nam, setNam] = useState(tm.nam);
  const [showCreate, setShowCreate] = useState(false);

  const phongIds = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);
  const readings = useMemo(() => db.dienNuoc.filter(r => phongIds.includes(r.phongId) && r.thang === thang && r.nam === nam), [db.dienNuoc, thang, nam, phongIds]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá chỉ số này?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.dienNuoc = d.dienNuoc.filter(r => r.id !== id); appendLog(d, 'Xoá chỉ số điện-nước', 'nhatro'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Điện - Nước</h2>
            <p className="card-subtitle">Ghi nhận chỉ số công tơ đầu/cuối kỳ. Số dùng = mới - cũ. Hóa đơn sẽ tự lookup.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} disabled={db.phongs.length === 0}><Plus className="h-4 w-4" /> Nhập chỉ số</button>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '120px 120px 1fr', marginTop: 10 }}>
          <select className="select-field" value={thang} onChange={e => setThang(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T.{i + 1}</option>)}
          </select>
          <input className="input-field" type="number" value={nam} onChange={e => setNam(Number(e.target.value) || tm.nam)} />
          <div style={{ alignSelf: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>{readings.length} phòng đã nhập chỉ số</div>
        </div>
      </div>

      {readings.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Zap style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có chỉ số nào trong T{thang}/{nam}.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Phòng</th><th>Tháng</th><th>Đ.cũ</th><th>Đ.mới</th><th style={{ color: '#f59e0b' }}>⚡ Dùng</th><th>N.cũ</th><th>N.mới</th><th style={{ color: '#3b82f6' }}>💧 Dùng</th><th></th></tr></thead>
              <tbody>
                {readings.map(r => {
                  const phong = db.phongs.find(p => p.id === r.phongId);
                  const dien = r.dienMoi - r.dienCu;
                  const nuoc = r.nuocMoi - r.nuocCu;
                  return (
                    <tr key={r.id}>
                      <td><b style={{ color: 'var(--color-accent-primary)' }}>{phong?.code || '?'}</b></td>
                      <td>{r.thang}/{r.nam}</td>
                      <td>{r.dienCu}</td><td>{r.dienMoi}</td><td><b style={{ color: '#f59e0b' }}>{dien} kWh</b></td>
                      <td>{r.nuocCu}</td><td>{r.nuocMoi}</td><td><b style={{ color: '#3b82f6' }}>{nuoc} m³</b></td>
                      <td><button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <DienNuocModal finance={finance} thang={thang} nam={nam} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function DienNuocModal({ finance, thang, nam, onClose }: { finance: ReturnType<typeof useFinanceDb>; thang: number; nam: number; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const phongsActive = db.phongs.filter(p => p.propertyId === db.activePropertyId);
  const phongDangThue = phongsActive.filter(p => p.status === 'dang_thue');
  const [phongId, setPhongId] = useState(phongDangThue[0]?.id || phongsActive[0]?.id || '');
  // Auto-fill chỉ số cũ từ tháng trước
  const lastReading = useMemo(() => {
    const list = db.dienNuoc
      .filter(r => r.phongId === phongId)
      .sort((a, b) => (b.nam * 12 + b.thang) - (a.nam * 12 + a.thang));
    return list[0];
  }, [db.dienNuoc, phongId]);
  const [dienCu, setDienCu] = useState(lastReading?.dienMoi || 0);
  const [dienMoi, setDienMoi] = useState(0);
  const [nuocCu, setNuocCu] = useState(lastReading?.nuocMoi || 0);
  const [nuocMoi, setNuocMoi] = useState(0);

  // Recompute when phongId changes
  useMemo(() => {
    setDienCu(lastReading?.dienMoi || 0);
    setNuocCu(lastReading?.nuocMoi || 0);
  }, [lastReading?.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phongId) { await dialog.alert('Chọn phòng', { variant: 'warning' }); return; }
    if (dienMoi < dienCu || nuocMoi < nuocCu) {
      await dialog.alert('Chỉ số mới không được nhỏ hơn chỉ số cũ.', { variant: 'warning' });
      return;
    }
    update(d => {
      const existed = d.dienNuoc.findIndex(r => r.phongId === phongId && r.thang === thang && r.nam === nam);
      const reading: DienNuocReading = {
        id: existed >= 0 ? d.dienNuoc[existed].id : createId('dn'),
        phongId, thang, nam, dienCu, dienMoi, nuocCu, nuocMoi,
        createdAt: now(),
      };
      if (existed >= 0) d.dienNuoc[existed] = reading;
      else d.dienNuoc.push(reading);
      const phong = d.phongs.find(p => p.id === phongId);
      appendLog(d, `Nhập chỉ số ${phong?.code} T${thang}/${nam}: điện ${dienMoi - dienCu} kWh, nước ${nuocMoi - nuocCu} m³`, 'nhatro');
    });
    onClose();
  }

  return (
    <Modal title={`Nhập chỉ số T${thang}/${nam}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Phòng *">
          <select className="select-field" value={phongId} onChange={e => setPhongId(e.target.value)}>
            {phongsActive.map(p => <option key={p.id} value={p.id}>{p.code} ({p.status === 'dang_thue' ? 'Đang thuê' : p.status === 'trong' ? 'Trống' : p.status})</option>)}
          </select>
        </Field>
        <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>⚡ ĐIỆN (kWh)</div>
          <div className="form-grid">
            <Field label="Chỉ số cũ"><NumberInput value={dienCu} onChange={n => setDienCu(n)} min={0} suffix="kWh" /></Field>
            <Field label="Chỉ số mới *"><NumberInput value={dienMoi} onChange={n => setDienMoi(n)} min={dienCu} suffix="kWh" /></Field>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>Số dùng: <b style={{ color: '#f59e0b' }}>{Math.max(0, dienMoi - dienCu)} kWh</b> × {money(db.invoiceConfig.defaultDienPrice)} = <b>{money(Math.max(0, dienMoi - dienCu) * db.invoiceConfig.defaultDienPrice)}</b></div>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', marginBottom: 6 }}>💧 NƯỚC (m³)</div>
          <div className="form-grid">
            <Field label="Chỉ số cũ"><NumberInput value={nuocCu} onChange={n => setNuocCu(n)} min={0} suffix="m³" /></Field>
            <Field label="Chỉ số mới *"><NumberInput value={nuocMoi} onChange={n => setNuocMoi(n)} min={nuocCu} suffix="m³" /></Field>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-muted)' }}>Số dùng: <b style={{ color: '#3b82f6' }}>{Math.max(0, nuocMoi - nuocCu)} m³</b> × {money(db.invoiceConfig.defaultNuocPrice)} = <b>{money(Math.max(0, nuocMoi - nuocCu) * db.invoiceConfig.defaultNuocPrice)}</b></div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Lưu chỉ số</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Phase 23.2.C — Hóa đơn (table + create + print VietQR)
// ==========================================================
function HoaDonPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [filterStatus, setFilterStatus] = useState<'all' | HoaDonStatus>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<HoaDonNhaTro | null>(null);

  const phongIds = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.hoaDons.filter(h => {
      if (!phongIds.includes(h.phongId)) return false;
      if (filterStatus !== 'all' && h.status !== filterStatus) return false;
      const phong = db.phongs.find(p => p.id === h.phongId);
      return !q || [phong?.code, h.invCode].some(x => (x || '').toLowerCase().includes(q));
    });
  }, [db, filterStatus, search, phongIds]);

  async function markPaid(h: HoaDonNhaTro) {
    const ok = await dialog.confirm('Đánh dấu đã thanh toán?', { variant: 'success' });
    if (!ok) return;
    update(d => {
      d.hoaDons = d.hoaDons.map(x => x.id === h.id ? { ...x, status: 'da_tt', paidAt: now() } : x);
      appendLog(d, `Đánh dấu HĐ ${h.invCode} đã TT`, 'nhatro');
    });
  }

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá hóa đơn này?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.hoaDons = d.hoaDons.filter(h => h.id !== id); appendLog(d, 'Xoá hóa đơn', 'nhatro'); });
  }

  async function handleAutoBatch() {
    const tm = thisMonth();
    const rentedPhongs = db.phongs.filter(p => p.propertyId === activeProperty.id && p.status === 'dang_thue');
    if (rentedPhongs.length === 0) {
      await dialog.alert('Không có phòng nào đang thuê', { variant: 'warning' });
      return;
    }
    // Đếm phòng đã có HĐ tháng này
    const existing = db.hoaDons.filter(h => h.thang === tm.thang && h.nam === tm.nam && rentedPhongs.some(p => p.id === h.phongId));
    const willCreate = rentedPhongs.filter(p => !existing.some(h => h.phongId === p.id));
    if (willCreate.length === 0) {
      await dialog.alert(`Tất cả ${rentedPhongs.length} phòng đã có hóa đơn T${tm.thang}/${tm.nam}`, { variant: 'info' });
      return;
    }
    const ok = await dialog.confirm(
      `Tự động tạo ${willCreate.length} hóa đơn cho T${tm.thang}/${tm.nam}?\n\n` +
      `• ${willCreate.length} phòng sẽ có HĐ mới (${willCreate.map(p => p.code).join(', ')})\n` +
      (existing.length > 0 ? `• ${existing.length} phòng đã có HĐ (bỏ qua)\n` : '') +
      `\nLưu ý: phòng nào chưa có chỉ số điện-nước tháng này sẽ tạo HĐ không tính điện-nước.`,
      { variant: 'success', okLabel: 'Tạo hàng loạt' }
    );
    if (!ok) return;

    let created = 0, skipped = 0;
    update(d => {
      for (const phong of willCreate) {
        const hd = d.hopDongs.find(h => h.phongId === phong.id && h.status === 'dang_hd');
        if (!hd) { skipped++; continue; }
        const reading = d.dienNuoc.find(r => r.phongId === phong.id && r.thang === tm.thang && r.nam === tm.nam);
        const dienKwh = reading ? reading.dienMoi - reading.dienCu : 0;
        const nuocM3 = reading ? reading.nuocMoi - reading.nuocCu : 0;
        const dienAmount = dienKwh * d.invoiceConfig.defaultDienPrice;
        const nuocAmount = nuocM3 * d.invoiceConfig.defaultNuocPrice;
        const internet = d.invoiceConfig.defaultInternet;
        const veSinh = d.invoiceConfig.defaultVeSinh;
        const total = hd.rentPrice + dienAmount + nuocAmount + internet + veSinh;
        const tFirst = new Date(tm.nam, tm.thang - 1, d.invoiceConfig.hanTTDayInMonth);
        const hanTT = tFirst.toISOString().slice(0, 10);
        d.hoaDons.unshift({
          id: createId('hd'),
          invCode: `${d.invoiceConfig.invoicePrefix}${Date.now()}-${created}`,
          phongId: phong.id, khachId: hd.khachId, thang: tm.thang, nam: tm.nam,
          rentPrice: hd.rentPrice, dienKwh, dienAmount, nuocM3, nuocAmount, internet, veSinh,
          custom: [], total, status: 'chua_tt', hanTT, createdAt: now(),
        });
        created++;
      }
      appendLog(d, `[Auto-batch] Tạo ${created} HĐ T${tm.thang}/${tm.nam}${skipped > 0 ? ` (bỏ qua ${skipped})` : ''}`, 'nhatro');
    });
    await dialog.alert(`✓ Đã tạo ${created} hóa đơn${skipped > 0 ? ` (${skipped} phòng không có HĐ thuê → bỏ qua)` : ''}`, { variant: 'success' });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Hóa đơn</h2>
            <p className="card-subtitle">{db.hoaDons.length} hóa đơn · {db.hoaDons.filter(h => h.status === 'chua_tt').length} chưa TT · {db.hoaDons.filter(h => h.status === 'qua_han').length} quá hạn</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={handleAutoBatch} disabled={db.phongs.filter(p => p.propertyId === activeProperty.id && p.status === 'dang_thue').length === 0} title="Tạo HĐ hàng loạt cho tháng này"><Sparkles className="h-4 w-4" /> Tự động tạo HĐ tháng này</button>
            <button className="btn-primary" onClick={() => setShowCreate(true)} disabled={db.phongs.filter(p => p.propertyId === activeProperty.id && p.status === 'dang_thue').length === 0}><Plus className="h-4 w-4" /> Tạo HĐ</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 200px', marginTop: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search className="h-4 w-4" style={{ position: 'absolute', left: 12, top: 12, color: 'var(--color-text-muted)' }} />
            <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Tìm phòng, mã HĐ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="chua_tt">Chưa TT</option>
            <option value="da_tt">Đã TT</option>
            <option value="qua_han">Quá hạn</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Receipt style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có hóa đơn nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Phòng</th><th>Tháng</th><th>Tiền phòng</th><th>Điện</th><th>Nước</th><th>Tổng</th><th>Trạng thái</th><th>Hạn TT</th><th></th></tr></thead>
              <tbody>
                {filtered.map(h => {
                  const phong = db.phongs.find(p => p.id === h.phongId);
                  return (
                    <tr key={h.id}>
                      <td><b style={{ color: 'var(--color-accent-primary)' }}>{phong?.code || '?'}</b></td>
                      <td>{h.thang}/{h.nam}</td>
                      <td>{money(h.rentPrice)}</td>
                      <td>{money(h.dienAmount)}</td>
                      <td>{money(h.nuocAmount)}</td>
                      <td><b>{money(h.total)}</b></td>
                      <td><span className={`badge ${h.status === 'da_tt' ? 'badge-green' : h.status === 'qua_han' ? 'badge-red' : 'badge-yellow'}`}>{h.status === 'da_tt' ? 'Đã TT' : h.status === 'qua_han' ? 'Quá hạn' : 'Chưa TT'}</span></td>
                      <td>{dateVN(h.hanTT)}</td>
                      <td><div className="flex gap-1">
                        <button className="icon-btn" onClick={() => setViewing(h)} title="Xem / In"><Receipt className="h-3.5 w-3.5" /></button>
                        {h.status !== 'da_tt' && <button className="icon-btn" style={{ color: '#10b981' }} onClick={() => markPaid(h)} title="Đánh dấu TT"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(h.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <HoaDonModal finance={finance} onClose={() => setShowCreate(false)} />}
      {viewing && <HoaDonViewModal finance={finance} hoadon={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function HoaDonModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const tm = thisMonth();
  const phongDangThue = db.phongs.filter(p => p.propertyId === db.activePropertyId && p.status === 'dang_thue');
  const [phongId, setPhongId] = useState(phongDangThue[0]?.id || '');
  const [thang, setThang] = useState(tm.thang);
  const [nam, setNam] = useState(tm.nam);
  const [internet, setInternet] = useState(db.invoiceConfig.defaultInternet);
  const [veSinh, setVeSinh] = useState(db.invoiceConfig.defaultVeSinh);
  const [customLabel, setCustomLabel] = useState('');
  const [customAmount, setCustomAmount] = useState(0);

  // Lookup HĐ + chỉ số điện nước
  const hd = useMemo(() => db.hopDongs.find(h => h.phongId === phongId && h.status === 'dang_hd'), [db.hopDongs, phongId]);
  const reading = useMemo(() => db.dienNuoc.find(r => r.phongId === phongId && r.thang === thang && r.nam === nam), [db.dienNuoc, phongId, thang, nam]);
  const dienKwh = reading ? reading.dienMoi - reading.dienCu : 0;
  const nuocM3 = reading ? reading.nuocMoi - reading.nuocCu : 0;
  const dienAmount = dienKwh * db.invoiceConfig.defaultDienPrice;
  const nuocAmount = nuocM3 * db.invoiceConfig.defaultNuocPrice;
  const rentPrice = hd?.rentPrice || 0;
  const customs = customLabel && customAmount > 0 ? [{ label: customLabel, amount: customAmount }] : [];
  const total = rentPrice + dienAmount + nuocAmount + internet + veSinh + customs.reduce((s, c) => s + c.amount, 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!phongId || !hd) { await dialog.alert('Phòng cần có hợp đồng đang hiệu lực.', { variant: 'warning' }); return; }
    if (!reading) {
      const ok = await dialog.confirm('Chưa có chỉ số điện-nước tháng này. Tạo hóa đơn không tính điện-nước?', { variant: 'warning' });
      if (!ok) return;
    }
    const tFirst = new Date(nam, thang - 1, db.invoiceConfig.hanTTDayInMonth);
    const hanTT = tFirst.toISOString().slice(0, 10);
    update(d => {
      const newH: HoaDonNhaTro = {
        id: createId('hd'),
        invCode: `${db.invoiceConfig.invoicePrefix}${Date.now()}`,
        phongId, khachId: hd.khachId, thang, nam,
        rentPrice, dienKwh, dienAmount, nuocM3, nuocAmount, internet, veSinh,
        custom: customs, total, status: 'chua_tt', hanTT,
        createdAt: now(),
      };
      d.hoaDons.unshift(newH);
      const phong = d.phongs.find(p => p.id === phongId);
      appendLog(d, `Tạo HĐ ${newH.invCode} phòng ${phong?.code} T${thang}/${nam}: ${money(total)}`, 'nhatro');
    });
    onClose();
  }

  return (
    <Modal title="Tạo hóa đơn tiền phòng" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label="Phòng *">
            <select className="select-field" value={phongId} onChange={e => setPhongId(e.target.value)}>
              {phongDangThue.length === 0 && <option value="">Chưa có phòng nào đang thuê</option>}
              {phongDangThue.map(p => <option key={p.id} value={p.id}>{p.code} - {money(p.rentPrice)}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Tháng"><select className="select-field" value={thang} onChange={e => setThang(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T.{i + 1}</option>)}</select></Field>
            <Field label="Năm"><input className="input-field" type="number" value={nam} onChange={e => setNam(Number(e.target.value) || tm.nam)} /></Field>
          </div>
        </div>

        <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface-row)' }}>
          <div className="flex justify-between" style={{ fontSize: 13 }}><span>Tiền thuê phòng</span><b>{money(rentPrice)}</b></div>
          <div className="flex justify-between" style={{ fontSize: 13 }}><span>Điện ({dienKwh} kWh × {moneyShort(db.invoiceConfig.defaultDienPrice)}đ)</span><b style={{ color: '#f59e0b' }}>{money(dienAmount)}</b></div>
          <div className="flex justify-between" style={{ fontSize: 13 }}><span>Nước ({nuocM3} m³ × {moneyShort(db.invoiceConfig.defaultNuocPrice)}đ)</span><b style={{ color: '#3b82f6' }}>{money(nuocAmount)}</b></div>
          {!reading && <div style={{ fontSize: 11, color: '#f59e0b' }}>⚠ Chưa nhập chỉ số T{thang}/{nam} → điện/nước = 0</div>}
        </div>

        <div className="form-grid">
          <Field label="Internet"><NumberInput value={internet} onChange={n => setInternet(n)} suffix="đ" min={0} /></Field>
          <Field label="Vệ sinh"><NumberInput value={veSinh} onChange={n => setVeSinh(n)} suffix="đ" min={0} /></Field>
        </div>

        <div className="form-grid">
          <Field label="Khoản phụ thu (tên)"><input className="input-field" value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="VD: Trông xe" /></Field>
          <Field label="Số tiền phụ thu"><NumberInput value={customAmount} onChange={n => setCustomAmount(n)} suffix="đ" min={0} /></Field>
        </div>

        <div className="rounded-xl p-3" style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-primary)' }}>
          <div className="flex justify-between" style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-accent-primary)' }}><span>TỔNG CỘNG</span><span>{money(total)}</span></div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Tạo hóa đơn</button>
        </div>
      </form>
    </Modal>
  );
}

function HoaDonViewModal({ finance, hoadon, onClose }: { finance: ReturnType<typeof useFinanceDb>; hoadon: HoaDonNhaTro; onClose: () => void }): JSX.Element {
  const { db } = finance;
  const phong = db.phongs.find(p => p.id === hoadon.phongId);
  const khach = hoadon.khachId ? db.khachs.find(k => k.id === hoadon.khachId) : null;
  const property = phong ? db.properties.find(pr => pr.id === phong.propertyId) || null : null;
  const defaultAcc = db.accounts.find(a => a.isDefault) || db.accounts.find(a => a.kind === 'bank');
  const qrUrl = defaultAcc && defaultAcc.kind === 'bank' && defaultAcc.bankCode && defaultAcc.accountNumber
    ? vietQrUrl({ bankCode: defaultAcc.bankCode, accountNumber: defaultAcc.accountNumber, accountName: defaultAcc.accountName || '', amount: hoadon.total, message: `${hoadon.invCode} ${phong?.code || ''} T${hoadon.thang}-${hoadon.nam}` })
    : '';

  function handlePrint() {
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>HD ${hoadon.invCode}</title>
    <style>@page{size:A5;margin:10mm}body{font-family:Arial,sans-serif;font-size:13px}h1{text-align:center;font-size:18px;margin:0}h2{text-align:center;font-size:14px;margin:4px 0;color:#666}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #aaa;padding:5px;font-size:12px}th{background:#eee}.total{background:#fef3c7;font-weight:700;font-size:14px}.qr{text-align:center;margin-top:14px}.qr img{width:200px;height:200px}.foot{display:flex;justify-content:space-around;margin-top:20px;font-size:11px}</style></head><body>
    <h1>${escapeHtml(property?.name || 'NHÀ TRỌ')}</h1>
    <div style="text-align:center;font-size:11px;color:#666">${escapeHtml(property?.address || '')}${property?.repPhone ? ' · ĐT: ' + escapeHtml(property.repPhone) : ''}</div>
    <h2>HÓA ĐƠN TIỀN PHÒNG T${hoadon.thang}/${hoadon.nam}</h2>
    <div style="font-size:11px"><b>Mã HĐ:</b> ${escapeHtml(hoadon.invCode)} · <b>Phòng:</b> ${escapeHtml(phong?.code || '')} · <b>Khách:</b> ${escapeHtml(khach?.name || '')}</div>
    <div style="font-size:11px;color:#dc2626"><b>Hạn TT:</b> ${dateVN(hoadon.hanTT)}</div>
    <table>
      <thead><tr><th style="text-align:left">KHOẢN MỤC</th><th style="text-align:right">THÀNH TIỀN</th></tr></thead>
      <tbody>
        <tr><td>Tiền thuê phòng</td><td style="text-align:right">${money(hoadon.rentPrice)}</td></tr>
        <tr><td>Điện (${hoadon.dienKwh} kWh × ${moneyShort(db.invoiceConfig.defaultDienPrice)}đ)</td><td style="text-align:right">${money(hoadon.dienAmount)}</td></tr>
        <tr><td>Nước (${hoadon.nuocM3} m³ × ${moneyShort(db.invoiceConfig.defaultNuocPrice)}đ)</td><td style="text-align:right">${money(hoadon.nuocAmount)}</td></tr>
        ${hoadon.internet ? `<tr><td>Internet</td><td style="text-align:right">${money(hoadon.internet)}</td></tr>` : ''}
        ${hoadon.veSinh ? `<tr><td>Vệ sinh</td><td style="text-align:right">${money(hoadon.veSinh)}</td></tr>` : ''}
        ${hoadon.custom.map(c => `<tr><td>${escapeHtml(c.label)}</td><td style="text-align:right">${money(c.amount)}</td></tr>`).join('')}
        <tr class="total"><td>TỔNG CỘNG</td><td style="text-align:right">${money(hoadon.total)}</td></tr>
      </tbody>
    </table>
    ${qrUrl ? `<div class="qr"><div style="font-size:11px;margin-bottom:4px"><b>QUÉT MÃ ĐỂ THANH TOÁN</b></div><img src="${qrUrl}" /><div style="font-size:10px;margin-top:4px">${escapeHtml(defaultAcc?.name || '')} · STK: <b>${escapeHtml(defaultAcc?.accountNumber || '')}</b> · ${escapeHtml(defaultAcc?.accountName || '')}</div></div>` : ''}
    <div class="foot">
      <div style="text-align:center"><div><b>Khách thuê</b></div><div style="margin-top:30px">(Ký tên)</div></div>
      <div style="text-align:center"><div><b>Chủ nhà</b></div><div style="margin-top:30px">(Ký tên)</div></div>
    </div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    win.document.write(html);
    win.document.close();
  }

  return (
    <Modal title={`Hóa đơn ${hoadon.invCode}`} onClose={onClose}>
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>NHÀ TRỌ</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{property?.name || '(Chưa có thông tin nhà trọ)'}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{property?.address || ''}</div>
      </div>
      <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--color-surface-row)' }}>
        <div className="flex justify-between text-sm"><span>Phòng</span><b>{phong?.code} ({khach?.name || '-'})</b></div>
        <div className="flex justify-between text-sm"><span>Tháng</span><b>{hoadon.thang}/{hoadon.nam}</b></div>
        <div className="flex justify-between text-sm"><span>Hạn TT</span><b style={{ color: '#dc2626' }}>{dateVN(hoadon.hanTT)}</b></div>
      </div>
      <div className="space-y-1 mt-3" style={{ fontSize: 13 }}>
        <div className="flex justify-between"><span>Tiền thuê phòng</span><b>{money(hoadon.rentPrice)}</b></div>
        <div className="flex justify-between"><span>Điện ({hoadon.dienKwh} kWh)</span><b>{money(hoadon.dienAmount)}</b></div>
        <div className="flex justify-between"><span>Nước ({hoadon.nuocM3} m³)</span><b>{money(hoadon.nuocAmount)}</b></div>
        {hoadon.internet > 0 && <div className="flex justify-between"><span>Internet</span><b>{money(hoadon.internet)}</b></div>}
        {hoadon.veSinh > 0 && <div className="flex justify-between"><span>Vệ sinh</span><b>{money(hoadon.veSinh)}</b></div>}
        {hoadon.custom.map((c, i) => <div key={i} className="flex justify-between"><span>{c.label}</span><b>{money(c.amount)}</b></div>)}
        <div className="flex justify-between p-2 mt-2 rounded-lg" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', fontSize: 16, fontWeight: 700 }}>
          <span>TỔNG CỘNG</span><span>{money(hoadon.total)}</span>
        </div>
      </div>
      {qrUrl && (
        <div className="mt-3 text-center">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}><QrCodeIcon className="h-4 w-4" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> QR Thanh toán VietQR</div>
          <img src={qrUrl} style={{ width: 180, height: 180, display: 'inline-block', borderRadius: 8 }} alt="VietQR" />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{defaultAcc?.name} · STK: {defaultAcc?.accountNumber} · {defaultAcc?.accountName}</div>
        </div>
      )}
      {!qrUrl && <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', fontSize: 12, color: '#b45309' }}>⚠ Chưa cấu hình tài khoản ngân hàng. Vào <b>Cài đặt → Tài khoản & Ví</b> để bật QR thanh toán tự động.</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
        <button type="button" className="btn-primary" onClick={handlePrint}><Printer className="h-4 w-4" /> In hóa đơn</button>
      </div>
    </Modal>
  );
}

// ==========================================================
// Phase 23.2.C — Thanh toán (chỉ list, đối soát)
// ==========================================================
function ThanhToanPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá phiếu thanh toán?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.thanhToans = d.thanhToans.filter(t => t.id !== id); appendLog(d, 'Xoá thanh toán', 'nhatro'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Thanh toán</h2>
            <p className="card-subtitle">Lịch sử thanh toán hóa đơn — auto ghi nhận khi đánh dấu HĐ "Đã TT".</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)} disabled={db.hoaDons.filter(h => h.status !== 'da_tt').length === 0}><Plus className="h-4 w-4" /> Ghi nhận TT</button>
        </div>
      </div>

      {db.thanhToans.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <CreditCard style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có phiếu thanh toán nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ngày</th><th>Hóa đơn</th><th>Số tiền</th><th>Tài khoản nhận</th><th>Ghi chú</th><th></th></tr></thead>
              <tbody>
                {db.thanhToans.map(t => {
                  const hd = db.hoaDons.find(h => h.id === t.hoaDonId);
                  const phong = hd ? db.phongs.find(p => p.id === hd.phongId) : null;
                  const acc = db.accounts.find(a => a.id === t.accountId);
                  return (
                    <tr key={t.id}>
                      <td>{dateVN(t.date)}</td>
                      <td><b style={{ color: 'var(--color-accent-primary)' }}>{phong?.code || '?'}</b> · {hd?.invCode || '?'}</td>
                      <td><b>{money(t.amount)}</b></td>
                      <td>{acc?.name || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.note || '-'}</td>
                      <td><button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <ThanhToanModal finance={finance} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function ThanhToanModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const unpaidHd = db.hoaDons.filter(h => h.status !== 'da_tt');
  const [hoaDonId, setHoaDonId] = useState(unpaidHd[0]?.id || '');
  const hd = db.hoaDons.find(h => h.id === hoaDonId);
  const [amount, setAmount] = useState(hd?.total || 0);
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || db.accounts[0]?.id || '');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');

  useMemo(() => { setAmount(hd?.total || 0); }, [hd?.id]);

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hoaDonId || !accountId) { await dialog.alert('Chọn HĐ + tài khoản nhận', { variant: 'warning' }); return; }
    update(d => {
      d.thanhToans.unshift({ id: createId('tt'), hoaDonId, amount, accountId, date, note });
      const idx = d.hoaDons.findIndex(h => h.id === hoaDonId);
      if (idx >= 0) {
        d.hoaDons[idx].status = 'da_tt';
        d.hoaDons[idx].paidAt = date;
        d.hoaDons[idx].paidAccountId = accountId;
      }
      // Auto ghi vào ledger thu
      d.ledger.unshift({
        id: createId('ledg'), date, kind: 'thu', category: 'cho_thue',
        amount, description: `Thu HĐ ${d.hoaDons[idx]?.invCode || ''}`,
        accountId, fromModule: 'nhatro', refId: hoaDonId, createdAt: now(),
      });
      appendLog(d, `Thu tiền HĐ ${d.hoaDons[idx]?.invCode}: ${money(amount)}`, 'nhatro');
    });
    onClose();
  }

  return (
    <Modal title="Ghi nhận thanh toán" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Hóa đơn cần TT *">
          <select className="select-field" value={hoaDonId} onChange={e => setHoaDonId(e.target.value)}>
            {unpaidHd.length === 0 && <option value="">Không có HĐ nào chưa TT</option>}
            {unpaidHd.map(h => {
              const phong = db.phongs.find(p => p.id === h.phongId);
              return <option key={h.id} value={h.id}>{phong?.code} T{h.thang}/{h.nam} - {money(h.total)}</option>;
            })}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Số tiền *"><NumberInput value={amount} onChange={n => setAmount(n)} suffix="đ" min={0} /></Field>
          <Field label="Ngày thu"><input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Tài khoản nhận tiền *">
          <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
            {db.accounts.length === 0 && <option value="">Chưa có TK — vào Cài đặt → Tài khoản</option>}
            {db.accounts.map(a => <option key={a.id} value={a.id}>{a.kind === 'cash' ? '💵' : a.kind === 'bank' ? '🏦' : '👛'} {a.name}{a.accountNumber ? ` (${a.accountNumber})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú"><input className="input-field" value={note} onChange={e => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Ghi nhận</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Phase 23.2.D — Chi phí
// ==========================================================
function ChiPhiPage({ finance, activeProperty: _ap }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showCreate, setShowCreate] = useState(false);
  const onlyNhaTro = useMemo(() => db.chiPhis.filter(c => c.fromModule === 'nhatro' || c.fromModule === 'manual'), [db.chiPhis]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá chi phí?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.chiPhis = d.chiPhis.filter(c => c.id !== id); appendLog(d, 'Xoá chi phí', 'nhatro'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Chi phí nhà trọ</h2>
            <p className="card-subtitle">{onlyNhaTro.length} khoản · Tổng: <b>{money(onlyNhaTro.reduce((s, c) => s + c.amount, 0))}</b></p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm chi phí</button>
        </div>
      </div>

      {onlyNhaTro.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Wallet style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có chi phí nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ngày</th><th>Danh mục</th><th>Mô tả</th><th>Tài khoản</th><th>Số tiền</th><th></th></tr></thead>
              <tbody>
                {onlyNhaTro.map(c => {
                  const acc = c.accountId ? db.accounts.find(a => a.id === c.accountId) : null;
                  return (
                    <tr key={c.id}>
                      <td>{dateVN(c.date)}</td>
                      <td><span className="badge badge-blue">{c.category}</span></td>
                      <td>{c.description}</td>
                      <td style={{ fontSize: 12 }}>{acc?.name || '-'}</td>
                      <td><b style={{ color: '#ef4444' }}>-{money(c.amount)}</b></td>
                      <td><button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <ChiPhiModal finance={finance} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function ChiPhiModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('Sửa chữa');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || db.accounts[0]?.id || '');

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || amount <= 0) { await dialog.alert('Nhập mô tả + số tiền', { variant: 'warning' }); return; }
    update(d => {
      const cp: ChiPhi = { id: createId('cp'), date, category, description, amount, accountId, fromModule: 'nhatro', createdAt: now() };
      d.chiPhis.unshift(cp);
      d.ledger.unshift({
        id: createId('ledg'), date, kind: 'chi', category: 'khac_chi',
        amount, description: `[Nhà trọ] ${description}`, accountId,
        fromModule: 'nhatro', refId: cp.id, createdAt: now(),
      });
      appendLog(d, `Thêm chi phí: ${description} - ${money(amount)}`, 'nhatro');
    });
    onClose();
  }

  return (
    <Modal title="Thêm chi phí nhà trọ" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="form-grid">
          <Field label="Ngày"><input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Danh mục">
            <select className="select-field" value={category} onChange={e => setCategory(e.target.value)}>
              {['Sửa chữa', 'Vệ sinh', 'Internet', 'Điện chung', 'Nước chung', 'Bảo trì', 'Mua sắm', 'Khác'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Mô tả *"><input className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="VD: Sửa máy bơm tầng 2" /></Field>
        <div className="form-grid">
          <Field label="Số tiền *"><NumberInput value={amount} onChange={n => setAmount(n)} suffix="đ" min={0} /></Field>
          <Field label="Tài khoản chi">
            <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Không gắn TK</option>
              {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Thêm chi phí</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Phase 23.2.D — Sự cố
// ==========================================================
function SuCoPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showCreate, setShowCreate] = useState(false);
  const phongIds = useMemo(() => db.phongs.filter(p => p.propertyId === activeProperty.id).map(p => p.id), [db.phongs, activeProperty.id]);
  const sucoFiltered = useMemo(() => db.suCos.filter(s => !s.phongId || phongIds.includes(s.phongId)), [db.suCos, phongIds]);

  function setStatus(id: string, status: SuCoStatus) {
    update(d => {
      const idx = d.suCos.findIndex(s => s.id === id);
      if (idx < 0) return;
      d.suCos[idx].status = status;
      if (status === 'da_xong') d.suCos[idx].resolvedAt = today();
      appendLog(d, `Sự cố ${d.suCos[idx].title}: ${status === 'da_xong' ? 'hoàn thành' : status === 'dang_xu_ly' ? 'đang xử lý' : 'chờ xử lý'}`, 'nhatro');
    });
  }

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá sự cố?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.suCos = d.suCos.filter(s => s.id !== id); appendLog(d, 'Xoá sự cố', 'nhatro'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sự cố / Yêu cầu sửa chữa</h2>
            <p className="card-subtitle">{sucoFiltered.filter(s => s.status === 'cho_xu_ly').length} chờ · {sucoFiltered.filter(s => s.status === 'dang_xu_ly').length} đang xử lý · {sucoFiltered.filter(s => s.status === 'da_xong').length} đã xong</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Báo sự cố</button>
        </div>
      </div>

      {sucoFiltered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Wrench style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Không có sự cố nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Phòng</th><th>Sự cố</th><th>Ngày báo</th><th>Chi phí sửa</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {sucoFiltered.map(s => {
                  const phong = s.phongId ? db.phongs.find(p => p.id === s.phongId) : null;
                  return (
                    <tr key={s.id}>
                      <td>{phong ? <b style={{ color: 'var(--color-accent-primary)' }}>{phong.code}</b> : '-'}</td>
                      <td>{s.title}{s.description && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.description}</div>}</td>
                      <td>{dateVN(s.reportedAt)}</td>
                      <td>{s.cost ? <b>{money(s.cost)}</b> : '-'}</td>
                      <td><span className={`badge ${s.status === 'da_xong' ? 'badge-green' : s.status === 'dang_xu_ly' ? 'badge-blue' : 'badge-yellow'}`}>{s.status === 'da_xong' ? 'Đã xong' : s.status === 'dang_xu_ly' ? 'Đang xử lý' : 'Chờ xử lý'}</span></td>
                      <td><div className="flex gap-1">
                        {s.status === 'cho_xu_ly' && <button className="icon-btn" style={{ color: '#3b82f6' }} onClick={() => setStatus(s.id, 'dang_xu_ly')} title="Bắt đầu xử lý"><RotateCcw className="h-3.5 w-3.5" /></button>}
                        {s.status !== 'da_xong' && <button className="icon-btn" style={{ color: '#10b981' }} onClick={() => setStatus(s.id, 'da_xong')} title="Đánh dấu xong"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <SuCoModal finance={finance} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function SuCoModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const phongsActive = db.phongs.filter(p => p.propertyId === db.activePropertyId);
  const [phongId, setPhongId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(0);
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || '');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { await dialog.alert('Nhập tiêu đề sự cố', { variant: 'warning' }); return; }
    update(d => {
      const sc: SuCo = { id: createId('sc'), phongId: phongId || undefined, title, description, reportedAt: today(), status: 'cho_xu_ly', cost: cost || undefined };
      d.suCos.unshift(sc);
      // Nếu nhập chi phí → tự push ChiPhi + Ledger
      if (cost > 0) {
        const cp: ChiPhi = { id: createId('cp'), date: today(), category: 'Sửa chữa', description: `[Sự cố] ${title}`, amount: cost, accountId, fromModule: 'nhatro', refId: sc.id, createdAt: now() };
        d.chiPhis.unshift(cp);
        d.ledger.unshift({ id: createId('ledg'), date: today(), kind: 'chi', category: 'khac_chi', amount: cost, description: `[Sự cố] ${title}`, accountId, fromModule: 'nhatro', refId: sc.id, createdAt: now() });
      }
      appendLog(d, `Báo sự cố: ${title}${cost > 0 ? ' (chi phí ' + money(cost) + ')' : ''}`, 'nhatro');
    });
    onClose();
  }

  return (
    <Modal title="Báo sự cố / yêu cầu sửa chữa" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Phòng">
          <select className="select-field" value={phongId} onChange={e => setPhongId(e.target.value)}>
            <option value="">Khu vực chung</option>
            {phongsActive.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Sự cố / yêu cầu *"><input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Vòi nước rò rỉ, máy lạnh không lạnh" /></Field>
        <Field label="Mô tả chi tiết"><textarea className="input-field" rows={3} value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="Chi phí sửa (nếu đã biết)"><NumberInput value={cost} onChange={n => setCost(n)} suffix="đ" min={0} /></Field>
          {cost > 0 && (
            <Field label="Tài khoản chi">
              <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">Không gắn TK</option>
                {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {cost > 0 && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>💡 Tự động ghi vào Chi phí + Sổ thu chi tài chính cá nhân.</div>}
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Báo sự cố</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Phase 23.2.D + 23.8.B — Cài đặt nhà trọ (3 sub-tab, bỏ Bank → move sang TaiChinh)
// ==========================================================
type SettingsTab = 'info' | 'service' | 'invoice';

function CaiDatPage({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('info');

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="card-title">Cài đặt: {activeProperty.name}</h2>
        <p className="card-subtitle">Thông tin nhà trọ + giá dịch vụ + cấu hình hóa đơn. <b>Tài khoản ngân hàng / ví</b> chuyển sang <b>Tài chính cá nhân → Tài khoản & Ví</b> để dùng chung 3 module.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4, background: 'var(--color-surface-row)', borderRadius: 10, marginTop: 12 }}>
          {[
            { id: 'info' as const, icon: Building, label: 'Thông tin nhà trọ' },
            { id: 'service' as const, icon: TagIcon, label: 'Giá dịch vụ' },
            { id: 'invoice' as const, icon: FileIcon, label: 'Hóa đơn & Hạn TT' },
          ].map(t => {
            const isActive = tab === t.id;
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: isActive ? 'var(--color-surface-card)' : 'transparent', color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer', boxShadow: isActive ? 'var(--shadow-xs)' : 'none' }}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'info' && <CaiDatInfo finance={finance} activeProperty={activeProperty} />}
      {tab === 'service' && <CaiDatService finance={finance} />}
      {tab === 'invoice' && <CaiDatInvoice finance={finance} />}
    </div>
  );
}

function CaiDatInfo({ finance, activeProperty }: { finance: ReturnType<typeof useFinanceDb>; activeProperty: NhaTroProperty }): JSX.Element {
  const { update } = finance;
  const [form, setForm] = useState<NhaTroProperty>(activeProperty);
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update(d => {
      d.properties = d.properties.map(p => p.id === activeProperty.id ? form : p);
      appendLog(d, `Cập nhật thông tin nhà trọ: ${form.name}`, 'nhatro');
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="card space-y-3">
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Nhà trọ</h3>
        <div className="form-grid mt-2">
          <Field label="Tên nhà trọ *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhà Trọ Tâm An" /></Field>
          <Field label="Địa chỉ"><input className="input-field" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 đường X, Phường Y, TP Z" /></Field>
        </div>
      </div>
      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>📋 Đại diện pháp luật (chủ nhà)</h3>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Thông tin in vào hợp đồng + biên nhận.</p>
        <div className="form-grid mt-2">
          <Field label="Họ tên"><input className="input-field" value={form.repName} onChange={e => setForm({ ...form, repName: e.target.value })} /></Field>
          <Field label="Ngày sinh"><input className="input-field" type="date" value={form.repBirth} onChange={e => setForm({ ...form, repBirth: e.target.value })} /></Field>
        </div>
        <div className="form-grid mt-2">
          <Field label="Số điện thoại"><input className="input-field" value={form.repPhone} onChange={e => setForm({ ...form, repPhone: e.target.value })} /></Field>
          <Field label="CCCD"><input className="input-field" value={form.repCccd} onChange={e => setForm({ ...form, repCccd: e.target.value })} /></Field>
        </div>
        <div className="form-grid mt-2">
          <Field label="Ngày cấp"><input className="input-field" type="date" value={form.repCccdDate} onChange={e => setForm({ ...form, repCccdDate: e.target.value })} /></Field>
          <Field label="Nơi cấp"><input className="input-field" value={form.repCccdPlace} onChange={e => setForm({ ...form, repCccdPlace: e.target.value })} /></Field>
        </div>
        <div className="mt-2"><Field label="Địa chỉ thường trú"><input className="input-field" value={form.repAddress} onChange={e => setForm({ ...form, repAddress: e.target.value })} /></Field></div>
      </div>
      <div className="flex justify-end gap-2">
        {saved && <span style={{ fontSize: 12, color: '#10b981', alignSelf: 'center' }}>✓ Đã lưu</span>}
        <button type="submit" className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Lưu thông tin</button>
      </div>
    </form>
  );
}

function CaiDatService({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const [form, setForm] = useState({ ...db.invoiceConfig });
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update(d => { d.invoiceConfig = { ...form }; appendLog(d, 'Cập nhật giá dịch vụ', 'nhatro'); });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="card space-y-3">
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>💡 Giá dịch vụ mặc định</h3>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Áp dụng khi tạo hóa đơn mới. Có thể override từng hóa đơn.</p>
      <div className="form-grid">
        <Field label="Giá điện / kWh *"><NumberInput value={form.defaultDienPrice} onChange={n => setForm({ ...form, defaultDienPrice: n })} suffix="đ" min={0} /></Field>
        <Field label="Giá nước / m³ *"><NumberInput value={form.defaultNuocPrice} onChange={n => setForm({ ...form, defaultNuocPrice: n })} suffix="đ" min={0} /></Field>
      </div>
      <div className="form-grid">
        <Field label="Internet mặc định"><NumberInput value={form.defaultInternet} onChange={n => setForm({ ...form, defaultInternet: n })} suffix="đ" min={0} /></Field>
        <Field label="Vệ sinh mặc định"><NumberInput value={form.defaultVeSinh} onChange={n => setForm({ ...form, defaultVeSinh: n })} suffix="đ" min={0} /></Field>
      </div>
      <div className="flex justify-end gap-2">
        {saved && <span style={{ fontSize: 12, color: '#10b981', alignSelf: 'center' }}>✓ Đã lưu</span>}
        <button type="submit" className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Lưu giá dịch vụ</button>
      </div>
    </form>
  );
}

function CaiDatBank({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function setDefault(id: string) {
    update(d => { d.accounts = d.accounts.map(a => ({ ...a, isDefault: a.id === id })); appendLog(d, `Đặt mặc định TK: ${d.accounts.find(a => a.id === id)?.name}`, 'system'); });
  }

  function deleteAccount(id: string) {
    if (!confirm('Xoá tài khoản này?')) return;
    update(d => { d.accounts = d.accounts.filter(a => a.id !== id); appendLog(d, 'Xoá tài khoản', 'system'); });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>🏦 Tài khoản & Ví (chia sẻ với mọi module)</h3>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{db.accounts.length} tài khoản. Tài khoản bank tự gen QR VietQR vào hóa đơn.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm TK</button>
      </div>

      {db.accounts.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>Chưa có tài khoản. Thêm để dùng cho mọi module.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {db.accounts.map(a => (
            <div key={a.id} style={{ background: a.isDefault ? 'var(--color-accent-soft)' : 'var(--color-surface-row)', border: '1px solid ' + (a.isDefault ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'), borderRadius: 10, padding: 12 }}>
              <div className="flex items-start justify-between">
                <div>
                  <div style={{ fontSize: 18 }}>{a.kind === 'cash' ? '💵' : a.kind === 'bank' ? '🏦' : '👛'} <b>{a.name}</b></div>
                  {a.accountNumber && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginTop: 2 }}>{a.accountNumber}</div>}
                  {a.accountName && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.accountName}</div>}
                </div>
                {a.isDefault && <span className="badge badge-green">Mặc định</span>}
              </div>
              <div className="flex gap-1 mt-2 justify-end">
                {!a.isDefault && <button className="icon-btn" onClick={() => setDefault(a.id)} title="Đặt mặc định"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                <button className="icon-btn" onClick={() => setEditing(a.id)}><Edit3 className="h-3.5 w-3.5" /></button>
                <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => deleteAccount(a.id)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editing) && <AccountModal finance={finance} editingId={editing} onClose={() => { setShowCreate(false); setEditing(null); }} />}
    </div>
  );
}

function AccountModal({ finance, editingId, onClose }: { finance: ReturnType<typeof useFinanceDb>; editingId: string | null; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const editing = editingId ? db.accounts.find(a => a.id === editingId) : null;
  const [form, setForm] = useState({
    kind: editing?.kind || 'bank' as const,
    name: editing?.name || '',
    bankCode: editing?.bankCode || 'VCB',
    accountNumber: editing?.accountNumber || '',
    accountName: editing?.accountName || '',
    note: editing?.note || '',
    isDefault: editing?.isDefault || db.accounts.length === 0,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { alert('Nhập tên TK'); return; }
    update(d => {
      // Nếu set isDefault → bỏ default cũ
      if (form.isDefault) d.accounts = d.accounts.map(a => ({ ...a, isDefault: false }));
      if (editing) {
        d.accounts = d.accounts.map(a => a.id === editing.id ? { ...a, ...form, active: true } : a);
        appendLog(d, `Cập nhật TK: ${form.name}`, 'system');
      } else {
        d.accounts.push({ id: createId('acc'), ...form, active: true, createdAt: now() });
        appendLog(d, `Thêm TK mới: ${form.name}`, 'system');
      }
    });
    onClose();
  }

  return (
    <Modal title={editing ? `Sửa TK: ${editing.name}` : 'Thêm tài khoản / ví'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Loại *">
          <select className="select-field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })}>
            <option value="cash">💵 Tiền mặt</option>
            <option value="bank">🏦 Ngân hàng (có VietQR)</option>
            <option value="wallet">👛 Ví điện tử (Momo / ZaloPay / ViettelPay...)</option>
          </select>
        </Field>
        <Field label="Tên hiển thị *"><input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={form.kind === 'cash' ? 'Tiền mặt két' : form.kind === 'bank' ? 'VietinBank chính' : 'Momo'} /></Field>
        {form.kind === 'bank' && (
          <Field label="Ngân hàng">
            <select className="select-field" value={form.bankCode} onChange={e => setForm({ ...form, bankCode: e.target.value })}>
              {VIETQR_BANKS.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
            </select>
          </Field>
        )}
        {(form.kind === 'bank' || form.kind === 'wallet') && (
          <div className="form-grid">
            <Field label={form.kind === 'bank' ? 'Số tài khoản' : 'Số điện thoại / SĐT'}><input className="input-field" value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} /></Field>
            <Field label={form.kind === 'bank' ? 'Chủ TK' : 'Tên chủ ví'}><input className="input-field" value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value.toUpperCase() })} placeholder="NGUYEN VAN A" /></Field>
          </div>
        )}
        <Field label="Ghi chú"><input className="input-field" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
          Đặt làm tài khoản mặc định nhận tiền (in QR vào hóa đơn)
        </label>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">{editing ? 'Lưu' : 'Thêm TK'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CaiDatInvoice({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const [form, setForm] = useState({ ...db.invoiceConfig });
  const [saved, setSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update(d => { d.invoiceConfig = { ...form }; appendLog(d, 'Cập nhật cấu hình hóa đơn', 'nhatro'); });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="card space-y-3">
      <h3 style={{ fontSize: 14, fontWeight: 700 }}>🧾 Cấu hình hóa đơn</h3>
      <div className="form-grid">
        <Field label="Prefix mã HĐ"><input className="input-field" value={form.invoicePrefix} onChange={e => setForm({ ...form, invoicePrefix: e.target.value })} /></Field>
        <Field label="Hạn TT (ngày trong tháng)"><input className="input-field" type="number" min={1} max={28} value={form.hanTTDayInMonth} onChange={e => setForm({ ...form, hanTTDayInMonth: Number(e.target.value) || 5 })} /></Field>
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>VD prefix "INV" → mã HĐ tự gen "INV1734567...". Hạn TT = ngày X tháng kế tiếp tháng hóa đơn.</div>
      <div className="flex justify-end gap-2">
        {saved && <span style={{ fontSize: 12, color: '#10b981', alignSelf: 'center' }}>✓ Đã lưu</span>}
        <button type="submit" className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Lưu cấu hình</button>
      </div>
    </form>
  );
}
