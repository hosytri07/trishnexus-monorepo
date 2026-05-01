/**
 * TrishFinance — Phase 23.1.B App entry.
 *
 * AppGate: AuthProvider → check loading + firebaseUser → LoginScreen hoặc MainShell.
 * MainShell: sidebar 3 module (Nhà trọ / Tài chính / Bán hàng) + header + content.
 *
 * Database: localStorage `trishfinance_db` chứa toàn bộ FinanceDb. Sync Firestore
 * /finance_database/{uid} qua Settings modal (sẽ làm ở Phase 23.5).
 *
 * Mỗi user có database riêng — multi-tenant.
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { AuthProvider, useAuth } from '@trishteam/auth/react';
import { Building2, Wallet, ShoppingCart, LogOut, Sun, Moon, Settings as SettingsIcon, Shield, ExternalLink, Bell } from 'lucide-react';
import { LoginScreen } from './pages/LoginScreen';
import { SettingsModal } from './pages/SettingsModal';
import { NhaTroModule } from './modules/nhatro/NhaTroModule';
import { TaiChinhModule } from './modules/taichinh/TaiChinhModule';
import { BanHangModule } from './modules/banhang/BanHangModule';
import { DialogProvider } from './components/DialogProvider';
import { useFinanceDb, dateVN, daysUntil, money, today } from './state';
import logoUrl from './assets/logo.png';

export type ModuleId = 'taichinh' | 'nhatro' | 'banhang';

export default function App(): JSX.Element {
  return (
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthProvider>
        <DialogProvider>
          <AppGate />
        </DialogProvider>
      </AuthProvider>
    </div>
  );
}

// Phase 23.10 — TrishFinance off-ecosystem: chỉ admin hoặc user được cấp finance_user mới vào được.
// Trial / user thường (chưa được cấp finance_user) đều bị block.
function AppGate(): JSX.Element {
  const { firebaseUser, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-muted)', fontSize: 13 }}>
        Đang kết nối...
      </div>
    );
  }
  if (!firebaseUser) return <LoginScreen />;
  const role = (profile as any)?.role;
  const financeUser = (profile as any)?.finance_user === true;
  // Admin luôn vào được. User thường cần finance_user=true. Trial/no-role/missing flag → block.
  if (role === 'admin' || financeUser) return <MainShell />;
  return <NoPermissionBlocked />;
}

function NoPermissionBlocked(): JSX.Element {
  const { profile, firebaseUser, signOut } = useAuth();
  const role = (profile as any)?.role;
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-surface-bg)' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 16, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield style={{ width: 32, height: 32, color: '#ef4444' }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 16, color: 'var(--color-text-primary)' }}>Cần quyền truy cập</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6 }}>
          TrishFinance là app riêng — không thuộc hệ sinh thái TrishTEAM.<br />
          Chỉ tài khoản được <b>admin cấp quyền TrishFinance</b> mới sử dụng được.<br />
          Liên hệ admin để được cấp quyền.
        </p>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--color-surface-row)', textAlign: 'left' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04, fontWeight: 600 }}>Tài khoản hiện tại</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 4 }}>{(profile as any)?.display_name || firebaseUser?.email}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Email: {firebaseUser?.email}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Role: <b>{role || 'trial'}</b> · TrishFinance: <b style={{ color: '#ef4444' }}>chưa được cấp</b></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => void openUrl('https://trishteam.io.vn/contact')}>
            <ExternalLink className="h-4 w-4" /> Liên hệ admin
          </button>
          <button className="btn-secondary" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

function MainShell(): JSX.Element {
  const { profile, firebaseUser, signOut } = useAuth();
  const finance = useFinanceDb();
  const [active, setActive] = useState<ModuleId>(() => {
    try { return (localStorage.getItem('trishfinance:active_module') as ModuleId) || 'taichinh'; } catch { return 'taichinh'; }
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('trishfinance_theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  // Notifications: hóa đơn quá hạn / sắp đến hạn + tồn kho thấp + mượn quá hạn
  const notifications = useMemo(() => {
    const out: Array<{ id: string; severity: 'high' | 'med' | 'low'; title: string; sub: string; module: ModuleId; }> = [];
    const tdy = today();
    // Hóa đơn nhà trọ quá hạn / sắp đến hạn
    for (const h of finance.db.hoaDons) {
      if (h.status === 'da_tt') continue;
      const days = daysUntil(h.hanTT);
      const phong = finance.db.phongs.find(p => p.id === h.phongId);
      if (days < 0) {
        out.push({ id: 'hd-' + h.id, severity: 'high', title: `Hóa đơn ${phong?.code || '?'} quá hạn ${Math.abs(days)} ngày`, sub: `${money(h.total)} · Hạn: ${dateVN(h.hanTT)}`, module: 'nhatro' });
      } else if (days <= 3) {
        out.push({ id: 'hd-' + h.id, severity: 'med', title: `HĐ ${phong?.code || '?'} sắp đến hạn (${days} ngày)`, sub: `${money(h.total)} · Hạn: ${dateVN(h.hanTT)}`, module: 'nhatro' });
      }
    }
    // Sản phẩm tồn thấp
    const lowStock = finance.db.products.filter(p => p.active && p.stock <= p.minStock).slice(0, 5);
    for (const p of lowStock) {
      out.push({ id: 'p-' + p.id, severity: p.stock === 0 ? 'high' : 'med', title: `Tồn thấp: ${p.name}`, sub: `Còn ${p.stock} ${p.unit} (min ${p.minStock})`, module: 'banhang' });
    }
    // Ngân sách vượt
    const tm = new Date();
    for (const b of finance.db.budgets.filter(b => b.thang === tm.getMonth() + 1 && b.nam === tm.getFullYear())) {
      const spent = finance.db.ledger.filter(l => {
        const ld = new Date(l.date);
        return l.kind === 'chi' && l.category === b.category && ld.getMonth() + 1 === b.thang && ld.getFullYear() === b.nam;
      }).reduce((s, l) => s + l.amount, 0);
      if (spent > b.limit) {
        out.push({ id: 'bg-' + b.id, severity: 'med', title: `Vượt budget ${b.category}`, sub: `${money(spent)} / ${money(b.limit)}`, module: 'taichinh' });
      }
    }
    return out.sort((a, b) => a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0);
  }, [finance.db]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('trishfinance_theme', theme); } catch {}
  }, [theme]);
  useEffect(() => {
    void invoke<string>('app_version').then(setAppVersion).catch(() => {});
  }, []);
  useEffect(() => {
    try { localStorage.setItem('trishfinance:active_module', active); } catch {}
  }, [active]);

  // Phase 23.6 — role badge thật (admin / user). Trial đã bị block ở AppGate.
  const role = (profile as any)?.role;
  const r = role === 'admin'
    ? { label: 'Admin', bg: 'rgba(239,68,68,0.15)', color: '#dc2626' }
    : role === 'user'
    ? { label: 'User', bg: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }
    : { label: role || 'guest', bg: 'rgba(99,102,241,0.15)', color: '#4338ca' };

  const MODULES: Array<{ id: ModuleId; icon: any; label: string; sub: string }> = [
    { id: 'taichinh', icon: Wallet, label: 'Tài chính cá nhân', sub: 'Sổ thu chi · Ví · Ngân sách' },
    { id: 'nhatro', icon: Building2, label: 'Quản lý nhà trọ', sub: 'Phòng · Khách · Hợp đồng · Hóa đơn' },
    { id: 'banhang', icon: ShoppingCart, label: 'Quản lý bán hàng', sub: 'POS · Sản phẩm · Đơn hàng' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface-bg)', color: 'var(--color-text-primary)' }}>
      <aside className="fixed inset-y-0 left-0 w-64" style={{ background: 'var(--color-surface-card)', borderRight: '1px solid var(--color-border-subtle)', padding: '16px', overflowY: 'auto' }}>
        <div className="mb-5 flex items-center gap-3" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)', borderRadius: 14, padding: 10 }}>
          <img src={logoUrl} alt="TrishFinance" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
          <div className="min-w-0">
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>TrishFinance</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>v{appVersion}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04, padding: '0 8px', marginBottom: 6 }}>Phân hệ</div>
        <nav className="space-y-1">
          {MODULES.map((m) => {
            const isActive = active === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  textAlign: 'left', transition: 'background 150ms, color 150ms',
                  border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                  color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--color-surface-row)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{m.sub}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={{ paddingLeft: 256 }}>
        <header className="sticky top-0 z-10" style={{ background: 'var(--color-surface-bg-elevated)', borderBottom: '1px solid var(--color-border-subtle)', padding: '12px 22px', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between gap-3">
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', margin: 0 }}>
                {MODULES.find(m => m.id === active)?.label || ''}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, marginTop: 2 }}>
                {MODULES.find(m => m.id === active)?.sub || ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div style={{ position: 'relative' }}>
                <button className="btn-secondary" onClick={() => setShowNotifs(v => !v)} title="Thông báo" style={{ padding: '6px 10px' }}>
                  <Bell className="h-4 w-4" />
                  {notifications.length > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 480, overflow: 'auto', background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 50 }}>
                    <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <b>Thông báo ({notifications.length})</b>
                      <button className="icon-btn" onClick={() => setShowNotifs(false)}>×</button>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                        ✓ Mọi thứ ổn — không có cảnh báo nào.
                      </div>
                    ) : (
                      <div>
                        {notifications.map(n => (
                          <button key={n.id} type="button" onClick={() => { setActive(n.module); setShowNotifs(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--color-border-subtle)', background: 'transparent', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface-row)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: n.severity === 'high' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{n.sub}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button className="btn-secondary" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Đổi giao diện" style={{ padding: '6px 10px' }}>
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </button>
              <button className="btn-secondary" onClick={() => setShowSettings(true)} title="Cài đặt" style={{ padding: '6px 10px' }}>
                <SettingsIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2" style={{ background: 'var(--color-surface-row)', borderRadius: 10, padding: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}>
                  {(profile?.display_name || firebaseUser?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{profile?.display_name || firebaseUser?.email}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, background: r.bg, color: r.color }} title={`Role: ${r.label}`}>
                      <Shield className="h-2.5 w-2.5" /> {r.label}
                    </span>
                  </div>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => void signOut()} title="Đăng xuất" style={{ padding: '6px 10px', color: '#ef4444', borderColor: '#ef4444' }}>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </header>

        <div style={{ padding: '20px 22px' }}>
          {active === 'nhatro' && <NhaTroModule />}
          {active === 'taichinh' && <TaiChinhModule />}
          {active === 'banhang' && <BanHangModule />}
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          theme={theme}
          setTheme={setTheme}
          appVersion={appVersion}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
