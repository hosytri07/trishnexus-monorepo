/**
 * TaiChinhModule — Phase 23.3.
 *
 * Sub-pages: Dashboard / Sổ thu chi / Tài khoản / Ngân sách / Định kỳ / Báo cáo.
 *
 * Thu chi auto-feed từ Nhà trọ (Thanh toán → ledger thu) + Bán hàng (Order paid → thu).
 * User cũng có thể thêm tay (lương, ăn uống, đi lại...).
 */

import { useMemo, useState, type FormEvent } from 'react';
import {
  Wallet, BookOpen, Landmark, Target, RefreshCw, BarChart3 as ChartIcon,
  Plus, Edit3, Trash2, X, TrendingUp, TrendingDown, CheckCircle2, Download,
} from 'lucide-react';
// Dialog đã import ở trên
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinanceDb, now, today, thisMonth, createId, money, moneyShort, dateVN, appendLog, toCsv, downloadBlob } from '../../state';
import type { LedgerEntry, LedgerKind, LedgerCategory, Budget, RecurringTxn, Account, AccountKind } from '../../types';
import { LEDGER_CATEGORY_LABEL, isExpenseCategory, VIETQR_BANKS } from '../../types';
import { useDialog } from '../../components/DialogProvider';
import { NumberInput } from '../../components/NumberInput';
import { Plus as PlusIcon } from 'lucide-react';

type SubPage = 'dashboard' | 'ledger' | 'accounts' | 'budgets' | 'recurring' | 'report';

const SUB_PAGES: Array<{ id: SubPage; icon: any; label: string }> = [
  { id: 'dashboard', icon: Wallet, label: 'Tổng quan' },
  { id: 'ledger', icon: BookOpen, label: 'Sổ thu chi' },
  { id: 'accounts', icon: Landmark, label: 'Tài khoản & Ví' },
  { id: 'budgets', icon: Target, label: 'Ngân sách' },
  { id: 'recurring', icon: RefreshCw, label: 'Định kỳ' },
  { id: 'report', icon: ChartIcon, label: 'Báo cáo' },
];

export function TaiChinhModule(): JSX.Element {
  const [page, setPage] = useState<SubPage>('dashboard');
  const finance = useFinanceDb();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 16 }}>
      <nav className="card" style={{ padding: 8, height: 'fit-content', position: 'sticky', top: 80 }}>
        {SUB_PAGES.map(p => {
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
        {page === 'dashboard' && <TCDashboard finance={finance} />}
        {page === 'ledger' && <LedgerPage finance={finance} />}
        {page === 'accounts' && <AccountsPage finance={finance} />}
        {page === 'budgets' && <BudgetsPage finance={finance} />}
        {page === 'recurring' && <RecurringPage finance={finance} />}
        {page === 'report' && <ReportPage finance={finance} />}
      </div>
    </div>
  );
}

// ==========================================================
// Dashboard
// ==========================================================
function TCDashboard({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db } = finance;
  const tm = thisMonth();
  const stats = useMemo(() => {
    const monthLedger = db.ledger.filter(l => {
      const d = new Date(l.date);
      return d.getMonth() + 1 === tm.thang && d.getFullYear() === tm.nam;
    });
    const thu = monthLedger.filter(l => l.kind === 'thu').reduce((s, l) => s + l.amount, 0);
    const chi = monthLedger.filter(l => l.kind === 'chi').reduce((s, l) => s + l.amount, 0);
    return { thu, chi, net: thu - chi };
  }, [db.ledger, tm.thang, tm.nam]);

  const totalBalance = db.accounts.reduce((s, a) => {
    const accThu = db.ledger.filter(l => l.accountId === a.id && l.kind === 'thu').reduce((x, l) => x + l.amount, 0);
    const accChi = db.ledger.filter(l => l.accountId === a.id && l.kind === 'chi').reduce((x, l) => x + l.amount, 0);
    return s + accThu - accChi;
  }, 0);

  // 6-month trend
  const monthlyData = useMemo(() => {
    const out: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1, y = d.getFullYear();
      const ml = db.ledger.filter(l => {
        const ld = new Date(l.date);
        return ld.getMonth() + 1 === m && ld.getFullYear() === y;
      });
      out.push({
        label: `${m}/${String(y).slice(2)}`,
        thu: ml.filter(l => l.kind === 'thu').reduce((s, l) => s + l.amount, 0),
        chi: ml.filter(l => l.kind === 'chi').reduce((s, l) => s + l.amount, 0),
      });
    }
    return out;
  }, [db.ledger]);

  const recent = db.ledger.slice(0, 8);

  return (
    <div className="space-y-4">
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Stat icon={TrendingUp} label="Tổng thu tháng" value={money(stats.thu)} hint={`T${tm.thang}/${tm.nam}`} color="emerald" />
        <Stat icon={TrendingDown} label="Tổng chi tháng" value={money(stats.chi)} hint={`T${tm.thang}/${tm.nam}`} color="red" />
        <Stat icon={Wallet} label="Net (Thu - Chi)" value={money(stats.net)} hint={stats.net >= 0 ? 'Tiết kiệm' : 'Bội chi'} color={stats.net >= 0 ? 'emerald' : 'red'} />
        <Stat icon={Landmark} label="Số dư các TK" value={money(totalBalance)} hint={`${db.accounts.length} tài khoản`} color="blue" />
      </div>

      <div className="card">
        <h2 className="card-title">Thu chi 6 tháng qua</h2>
        <div style={{ height: 240, marginTop: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
              <YAxis tickFormatter={(v) => moneyShort(v)} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} stroke="var(--color-border-subtle)" />
              <ReTooltip formatter={(v: number) => money(v)} contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, color: 'var(--color-text-primary)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="thu" name="Thu" fill="#10b981" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="chi" name="Chi" fill="#ef4444" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Giao dịch gần đây</h2>
        {recent.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>Chưa có giao dịch nào.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {recent.map(l => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px 110px', gap: 12, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-row)' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{dateVN(l.date)}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{LEDGER_CATEGORY_LABEL[l.category] || l.category}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: l.kind === 'thu' ? '#10b981' : '#ef4444' }}>{l.kind === 'thu' ? '+' : '-'}{money(l.amount)}</span>
              </div>
            ))}
          </div>
        )}
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
// Sổ thu chi
// ==========================================================
function LedgerPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [filterKind, setFilterKind] = useState<'all' | LedgerKind>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | LedgerCategory>('all');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    return db.ledger.filter(l => {
      if (filterKind !== 'all' && l.kind !== filterKind) return false;
      if (filterCategory !== 'all' && l.category !== filterCategory) return false;
      return true;
    });
  }, [db.ledger, filterKind, filterCategory]);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá giao dịch?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.ledger = d.ledger.filter(l => l.id !== id); appendLog(d, 'Xoá giao dịch tài chính', 'taichinh'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Sổ thu chi</h2>
            <p className="card-subtitle">{db.ledger.length} giao dịch · Auto-feed từ Nhà trọ + Bán hàng</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm giao dịch</button>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '160px 1fr', marginTop: 10 }}>
          <select className="select-field" value={filterKind} onChange={e => setFilterKind(e.target.value as any)}>
            <option value="all">Tất cả</option><option value="thu">Thu</option><option value="chi">Chi</option>
          </select>
          <select className="select-field" value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}>
            <option value="all">Mọi danh mục</option>
            {Object.entries(LEDGER_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <BookOpen style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có giao dịch nào.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Mô tả</th><th>Tài khoản</th><th>Số tiền</th><th></th></tr></thead>
              <tbody>
                {filtered.map(l => {
                  const acc = l.accountId ? db.accounts.find(a => a.id === l.accountId) : null;
                  return (
                    <tr key={l.id}>
                      <td>{dateVN(l.date)}</td>
                      <td>{l.kind === 'thu' ? <span className="badge badge-green">Thu</span> : <span className="badge badge-red">Chi</span>}</td>
                      <td style={{ fontSize: 12 }}>{LEDGER_CATEGORY_LABEL[l.category] || l.category}</td>
                      <td>{l.description}{l.fromModule !== 'manual' && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>{l.fromModule}</span>}</td>
                      <td style={{ fontSize: 12 }}>{acc?.name || '-'}</td>
                      <td><b style={{ color: l.kind === 'thu' ? '#10b981' : '#ef4444' }}>{l.kind === 'thu' ? '+' : '-'}{money(l.amount)}</b></td>
                      <td><button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(l.id)} disabled={l.fromModule !== 'manual'} title={l.fromModule !== 'manual' ? 'Auto từ ' + l.fromModule + ' — không xoá trực tiếp' : 'Xoá'}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <LedgerModal finance={finance} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function LedgerModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const [kind, setKind] = useState<LedgerKind>('chi');
  const [category, setCategory] = useState<LedgerCategory>('an_uong');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState(db.accounts.find(a => a.isDefault)?.id || '');

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || amount <= 0) { await dialog.alert('Nhập mô tả + số tiền', { variant: 'warning' }); return; }
    update(d => {
      d.ledger.unshift({ id: createId('ledg'), date, kind, category, amount, description, accountId, fromModule: 'manual', createdAt: now() });
      appendLog(d, `Thêm GD ${kind === 'thu' ? 'thu' : 'chi'}: ${description} - ${money(amount)}`, 'taichinh');
    });
    onClose();
  }

  // Filter category theo kind
  const cats: LedgerCategory[] = kind === 'thu'
    ? ['luong', 'thuong', 'dau_tu', 'kinh_doanh', 'cho_thue', 'khac_thu']
    : ['an_uong', 'di_lai', 'mua_sam', 'hoa_don', 'giai_tri', 'suc_khoe', 'giao_duc', 'qua_tang', 'khac_chi'];

  // Auto-set category đầu khi đổi kind
  useMemo(() => { if (!cats.includes(category)) setCategory(cats[0]); }, [kind]);

  return (
    <Modal title="Thêm giao dịch" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={() => setKind('thu')} style={{ padding: '12px', borderRadius: 10, border: '2px solid ' + (kind === 'thu' ? '#10b981' : 'var(--color-border-subtle)'), background: kind === 'thu' ? 'rgba(16,185,129,0.1)' : 'transparent', color: kind === 'thu' ? '#10b981' : 'var(--color-text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <TrendingUp className="h-4 w-4" /> Thu
          </button>
          <button type="button" onClick={() => setKind('chi')} style={{ padding: '12px', borderRadius: 10, border: '2px solid ' + (kind === 'chi' ? '#ef4444' : 'var(--color-border-subtle)'), background: kind === 'chi' ? 'rgba(239,68,68,0.1)' : 'transparent', color: kind === 'chi' ? '#ef4444' : 'var(--color-text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <TrendingDown className="h-4 w-4" /> Chi
          </button>
        </div>
        <Field label="Danh mục *">
          <select className="select-field" value={category} onChange={e => setCategory(e.target.value as LedgerCategory)}>
            {cats.map(c => <option key={c} value={c}>{LEDGER_CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Ngày"><input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Số tiền *"><NumberInput value={amount} onChange={n => setAmount(n)} suffix="đ" min={0} /></Field>
        </div>
        <Field label="Mô tả *"><input className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder={kind === 'thu' ? 'VD: Lương tháng 5' : 'VD: Cơm trưa, xăng xe'} /></Field>
        <Field label="Tài khoản">
          <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Không gắn TK</option>
            {db.accounts.map(a => <option key={a.id} value={a.id}>{a.kind === 'cash' ? '💵' : a.kind === 'bank' ? '🏦' : '👛'} {a.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Thêm</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Tài khoản & Ví
// ==========================================================
function AccountsPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [editing, setEditing] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function setDefault(id: string) {
    update(d => { d.accounts = d.accounts.map(a => ({ ...a, isDefault: a.id === id })); appendLog(d, `Đặt mặc định TK: ${d.accounts.find(a => a.id === id)?.name}`, 'system'); });
  }

  async function deleteAccount(id: string) {
    const acc = db.accounts.find(a => a.id === id);
    if (!acc) return;
    const ok = await dialog.confirm(`Xoá tài khoản "${acc.name}"? Các giao dịch đã liên kết sẽ giữ nguyên nhưng mất tham chiếu.`, { variant: 'danger' });
    if (!ok) return;
    update(d => { d.accounts = d.accounts.filter(a => a.id !== id); appendLog(d, `Xoá TK: ${acc.name}`, 'system'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Tài khoản & Ví — chia sẻ với 3 module</h2>
            <p className="card-subtitle">Định nghĩa 1 lần, dùng khắp Nhà trọ (thanh toán) + Bán hàng (POS) + Tài chính (sổ thu chi). TK ngân hàng tự gen QR VietQR cho hóa đơn.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><PlusIcon className="h-4 w-4" /> Thêm TK</button>
        </div>

        {db.accounts.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Chưa có tài khoản nào. Thêm để dùng cho mọi module.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', marginTop: 12 }}>
            {db.accounts.map(a => {
              const accThu = db.ledger.filter(l => l.accountId === a.id && l.kind === 'thu').reduce((s, l) => s + l.amount, 0);
              const accChi = db.ledger.filter(l => l.accountId === a.id && l.kind === 'chi').reduce((s, l) => s + l.amount, 0);
              const balance = accThu - accChi;
              return (
                <div key={a.id} style={{ background: a.isDefault ? 'var(--color-accent-soft)' : 'var(--color-surface-card)', border: '1px solid ' + (a.isDefault ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'), borderRadius: 12, padding: 14 }}>
                  <div className="flex items-start justify-between">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18 }}>{a.kind === 'cash' ? '💵' : a.kind === 'bank' ? '🏦' : '👛'} <b>{a.name}</b></div>
                      {a.accountNumber && <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginTop: 2 }}>{a.accountNumber}</div>}
                      {a.accountName && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.accountName}</div>}
                    </div>
                    {a.isDefault && <span className="badge badge-green">Mặc định</span>}
                  </div>
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--color-surface-row)' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>SỐ DƯ</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: balance >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>{money(balance)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Thu: {moneyShort(accThu)}đ · Chi: {moneyShort(accChi)}đ</div>
                  </div>
                  <div className="flex gap-1 mt-2 justify-end">
                    {!a.isDefault && <button className="icon-btn" onClick={() => setDefault(a.id)} title="Đặt mặc định"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                    <button className="icon-btn" onClick={() => setEditing(a.id)} title="Sửa"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => deleteAccount(a.id)} title="Xoá"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {(showCreate || editing) && <AccountModal finance={finance} editingId={editing} onClose={() => { setShowCreate(false); setEditing(null); }} />}
    </div>
  );
}

function AccountModal({ finance, editingId, onClose }: { finance: ReturnType<typeof useFinanceDb>; editingId: string | null; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const editing = editingId ? db.accounts.find(a => a.id === editingId) : null;
  const [form, setForm] = useState({
    kind: editing?.kind || 'bank' as AccountKind,
    name: editing?.name || '',
    bankCode: editing?.bankCode || 'VCB',
    accountNumber: editing?.accountNumber || '',
    accountName: editing?.accountName || '',
    note: editing?.note || '',
    isDefault: editing?.isDefault || db.accounts.length === 0,
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { await dialog.alert('Nhập tên TK', { variant: 'warning' }); return; }
    update(d => {
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
          <select className="select-field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as AccountKind })}>
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

// ==========================================================
// Ngân sách
// ==========================================================
function BudgetsPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const tm = thisMonth();
  const [thang, setThang] = useState(tm.thang);
  const [nam, setNam] = useState(tm.nam);
  const [showCreate, setShowCreate] = useState(false);

  const monthBudgets = db.budgets.filter(b => b.thang === thang && b.nam === nam);

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá ngân sách?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.budgets = d.budgets.filter(b => b.id !== id); appendLog(d, 'Xoá ngân sách', 'taichinh'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Ngân sách hàng tháng</h2>
            <p className="card-subtitle">Đặt giới hạn chi tiêu theo từng category. App cảnh báo khi vượt.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Đặt budget</button>
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '120px 120px 1fr', marginTop: 10 }}>
          <select className="select-field" value={thang} onChange={e => setThang(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>T.{i + 1}</option>)}
          </select>
          <input className="input-field" type="number" value={nam} onChange={e => setNam(Number(e.target.value) || tm.nam)} />
        </div>
      </div>

      {monthBudgets.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Target style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa đặt ngân sách nào cho T{thang}/{nam}.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {monthBudgets.map(b => {
            const spent = db.ledger.filter(l => {
              const ld = new Date(l.date);
              return l.kind === 'chi' && l.category === b.category && ld.getMonth() + 1 === b.thang && ld.getFullYear() === b.nam;
            }).reduce((s, l) => s + l.amount, 0);
            const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
            const overBudget = spent > b.limit;
            return (
              <div key={b.id} className="card" style={{ background: overBudget ? 'rgba(239,68,68,0.05)' : undefined, borderColor: overBudget ? 'rgba(239,68,68,0.3)' : undefined }}>
                <div className="flex justify-between items-start">
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{LEDGER_CATEGORY_LABEL[b.category]}</div>
                  <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: overBudget ? '#ef4444' : 'var(--color-text-primary)' }}>{money(spent)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-muted)' }}>/ {money(b.limit)}</span></div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-surface-row)', overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: overBudget ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981', transition: 'width 200ms' }} />
                </div>
                <div style={{ fontSize: 11, color: overBudget ? '#ef4444' : 'var(--color-text-muted)', marginTop: 4 }}>{pct}% — {overBudget ? `Vượt ${money(spent - b.limit)}` : `Còn ${money(b.limit - spent)}`}</div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <BudgetModal finance={finance} thang={thang} nam={nam} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function BudgetModal({ finance, thang, nam, onClose }: { finance: ReturnType<typeof useFinanceDb>; thang: number; nam: number; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const expenseCats = (Object.keys(LEDGER_CATEGORY_LABEL) as LedgerCategory[]).filter(isExpenseCategory);
  const [category, setCategory] = useState<LedgerCategory>('an_uong');
  const [limit, setLimit] = useState(0);

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (limit <= 0) { await dialog.alert('Nhập giới hạn', { variant: 'warning' }); return; }
    update(d => {
      const idx = d.budgets.findIndex(b => b.thang === thang && b.nam === nam && b.category === category);
      if (idx >= 0) d.budgets[idx].limit = limit;
      else d.budgets.push({ id: createId('bg'), thang, nam, category, limit });
      appendLog(d, `Đặt budget ${LEDGER_CATEGORY_LABEL[category]} T${thang}/${nam}: ${money(limit)}`, 'taichinh');
    });
    onClose();
  }

  return (
    <Modal title={`Đặt ngân sách T${thang}/${nam}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Danh mục chi *">
          <select className="select-field" value={category} onChange={e => setCategory(e.target.value as LedgerCategory)}>
            {expenseCats.map(c => <option key={c} value={c}>{LEDGER_CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Giới hạn *"><NumberInput value={limit} onChange={n => setLimit(n)} suffix="đ" min={0} placeholder="3.000.000" /></Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Đặt budget</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Định kỳ
// ==========================================================
function RecurringPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db, update } = finance;
  const dialog = useDialog();
  const [showCreate, setShowCreate] = useState(false);

  async function trigger(id: string) {
    const r = db.recurrings.find(x => x.id === id);
    if (!r) return;
    const ok = await dialog.confirm(`Tạo giao dịch định kỳ "${r.description}" - ${money(r.amount)} ngay?`, { variant: 'success' });
    if (!ok) return;
    update(d => {
      const rr = d.recurrings.find(x => x.id === id);
      if (!rr) return;
      d.ledger.unshift({ id: createId('ledg'), date: today(), kind: rr.kind, category: rr.category, amount: rr.amount, description: rr.description, accountId: rr.accountId, fromModule: 'recurring', refId: id, createdAt: now() });
      rr.lastTriggeredAt = today();
      appendLog(d, `Trigger định kỳ: ${rr.description}`, 'taichinh');
    });
  }

  async function handleDelete(id: string) {
    const ok = await dialog.confirm('Xoá định kỳ?', { variant: 'danger' });
    if (!ok) return;
    update(d => { d.recurrings = d.recurrings.filter(r => r.id !== id); appendLog(d, 'Xoá định kỳ', 'taichinh'); });
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Giao dịch định kỳ</h2>
            <p className="card-subtitle">VD: Lương tháng, internet, gym, học phí. Bấm "Trigger" để tạo nhanh.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Thêm</button>
        </div>
      </div>

      {db.recurrings.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <RefreshCw style={{ width: 40, height: 40, color: 'var(--color-text-muted)', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12 }}>Chưa có giao dịch định kỳ.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Loại</th><th>Mô tả</th><th>Danh mục</th><th>Chu kỳ</th><th>Số tiền</th><th>Lần cuối</th><th></th></tr></thead>
              <tbody>
                {db.recurrings.map(r => (
                  <tr key={r.id}>
                    <td>{r.kind === 'thu' ? <span className="badge badge-green">Thu</span> : <span className="badge badge-red">Chi</span>}</td>
                    <td>{r.description}</td>
                    <td style={{ fontSize: 12 }}>{LEDGER_CATEGORY_LABEL[r.category]}</td>
                    <td style={{ fontSize: 12 }}>{r.cycle === 'monthly' ? `Hàng tháng (ngày ${r.dayOfMonth || '-'})` : r.cycle === 'weekly' ? 'Hàng tuần' : 'Hàng ngày'}</td>
                    <td><b>{money(r.amount)}</b></td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.lastTriggeredAt ? dateVN(r.lastTriggeredAt) : 'Chưa'}</td>
                    <td><div className="flex gap-1">
                      <button className="icon-btn" style={{ color: '#10b981' }} onClick={() => trigger(r.id)} title="Tạo GD ngay"><CheckCircle2 className="h-3.5 w-3.5" /></button>
                      <button className="icon-btn" style={{ color: '#ef4444' }} onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && <RecurringModal finance={finance} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function RecurringModal({ finance, onClose }: { finance: ReturnType<typeof useFinanceDb>; onClose: () => void }): JSX.Element {
  const { db, update } = finance;
  const [kind, setKind] = useState<LedgerKind>('chi');
  const [category, setCategory] = useState<LedgerCategory>('hoa_don');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [cycle, setCycle] = useState<'monthly' | 'weekly' | 'daily'>('monthly');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [accountId, setAccountId] = useState(db.accounts[0]?.id || '');

  const cats: LedgerCategory[] = kind === 'thu'
    ? ['luong', 'thuong', 'dau_tu', 'kinh_doanh', 'cho_thue', 'khac_thu']
    : ['an_uong', 'di_lai', 'mua_sam', 'hoa_don', 'giai_tri', 'suc_khoe', 'giao_duc', 'qua_tang', 'khac_chi'];
  useMemo(() => { if (!cats.includes(category)) setCategory(cats[0]); }, [kind]);

  const dialog = useDialog();
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim() || amount <= 0) { await dialog.alert('Nhập mô tả + số tiền', { variant: 'warning' }); return; }
    update(d => {
      d.recurrings.push({ id: createId('rc'), kind, category, amount, description, accountId, cycle, dayOfMonth: cycle === 'monthly' ? dayOfMonth : undefined, active: true });
      appendLog(d, `Thêm GD định kỳ: ${description} - ${money(amount)}`, 'taichinh');
    });
    onClose();
  }

  return (
    <Modal title="Thêm giao dịch định kỳ" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" onClick={() => setKind('thu')} style={{ padding: 10, borderRadius: 8, border: '2px solid ' + (kind === 'thu' ? '#10b981' : 'var(--color-border-subtle)'), background: kind === 'thu' ? 'rgba(16,185,129,0.1)' : 'transparent', color: kind === 'thu' ? '#10b981' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Thu</button>
          <button type="button" onClick={() => setKind('chi')} style={{ padding: 10, borderRadius: 8, border: '2px solid ' + (kind === 'chi' ? '#ef4444' : 'var(--color-border-subtle)'), background: kind === 'chi' ? 'rgba(239,68,68,0.1)' : 'transparent', color: kind === 'chi' ? '#ef4444' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Chi</button>
        </div>
        <Field label="Danh mục">
          <select className="select-field" value={category} onChange={e => setCategory(e.target.value as LedgerCategory)}>
            {cats.map(c => <option key={c} value={c}>{LEDGER_CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Mô tả *"><input className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder={kind === 'thu' ? 'Lương tháng' : 'Internet, Gym'} /></Field>
        <div className="form-grid">
          <Field label="Số tiền *"><NumberInput value={amount} onChange={n => setAmount(n)} suffix="đ" min={0} /></Field>
          <Field label="Chu kỳ">
            <select className="select-field" value={cycle} onChange={e => setCycle(e.target.value as any)}>
              <option value="daily">Hàng ngày</option>
              <option value="weekly">Hàng tuần</option>
              <option value="monthly">Hàng tháng</option>
            </select>
          </Field>
        </div>
        {cycle === 'monthly' && (
          <Field label="Ngày trong tháng (1-28)"><input className="input-field" type="number" min={1} max={28} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value) || 1)} /></Field>
        )}
        <Field label="Tài khoản">
          <select className="select-field" value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Không gắn</option>
            {db.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn-primary">Thêm</button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================================
// Báo cáo
// ==========================================================
function ReportPage({ finance }: { finance: ReturnType<typeof useFinanceDb> }): JSX.Element {
  const { db } = finance;
  const tm = thisMonth();
  const [thang, setThang] = useState(tm.thang);
  const [nam, setNam] = useState(tm.nam);

  const monthLedger = useMemo(() => db.ledger.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() + 1 === thang && d.getFullYear() === nam;
  }), [db.ledger, thang, nam]);

  // Pie chi tiêu theo danh mục
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of monthLedger) {
      if (l.kind !== 'chi') continue;
      const k = LEDGER_CATEGORY_LABEL[l.category] || l.category;
      map.set(k, (map.get(k) || 0) + l.amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthLedger]);

  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];

  const totalThu = monthLedger.filter(l => l.kind === 'thu').reduce((s, l) => s + l.amount, 0);
  const totalChi = monthLedger.filter(l => l.kind === 'chi').reduce((s, l) => s + l.amount, 0);

  function handleExportCsv() {
    const rows: any[][] = [
      [`Báo cáo tài chính cá nhân — T${thang}/${nam}`],
      [],
      ['Tổng thu', totalThu],
      ['Tổng chi', totalChi],
      ['Net', totalThu - totalChi],
      ['Số giao dịch', monthLedger.length],
      [],
      ['CHI TIẾT GIAO DỊCH'],
      ['Ngày', 'Loại', 'Danh mục', 'Số tiền (đ)', 'Mô tả', 'Tài khoản', 'Nguồn'],
      ...monthLedger.map(l => [
        l.date,
        l.kind === 'thu' ? 'Thu' : 'Chi',
        LEDGER_CATEGORY_LABEL[l.category] || l.category,
        l.amount,
        l.description,
        l.accountId ? (db.accounts.find(a => a.id === l.accountId)?.name || '') : '',
        l.fromModule,
      ]),
      [],
      ['CƠ CẤU CHI TIÊU'],
      ['Danh mục', 'Số tiền (đ)'],
      ...pieData.map(p => [p.name, p.value]),
    ];
    const csv = toCsv(rows);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `BaoCao_TaiChinh_T${thang}-${nam}.csv`);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Báo cáo tài chính</h2>
            <p className="card-subtitle">Tháng {thang}/{nam} · {monthLedger.length} giao dịch</p>
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
        <Stat icon={TrendingUp} label="Tổng thu" value={money(totalThu)} color="emerald" />
        <Stat icon={TrendingDown} label="Tổng chi" value={money(totalChi)} color="red" />
        <Stat icon={Wallet} label="Net" value={money(totalThu - totalChi)} color={totalThu - totalChi >= 0 ? 'emerald' : 'red'} />
      </div>

      {pieData.length > 0 && (
        <div className="card">
          <h2 className="card-title">Cơ cấu chi tiêu T{thang}/{nam}</h2>
          <div style={{ height: 280, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={false} isAnimationActive={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                </Pie>
                <ReTooltip formatter={(v: number) => money(v)} contentStyle={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, color: 'var(--color-text-primary)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
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
