/**
 * Phase 40.11 — Dashboard tổng hợp doanh thu 6 module.
 *
 * Đọc toàn bộ ledger từ trishfinance_db + các DB module riêng (santhethao /
 * khodientu / photocopy) → tổng hợp:
 *  - Stats hôm nay / tuần / tháng / năm
 *  - Chart doanh thu theo module
 *  - Công nợ (booking/tx chưa trả hết)
 *  - Top khách quen
 *  - Cảnh báo: ngân sách vượt / tồn thấp
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Users,
  DollarSign,
  PieChart,
} from 'lucide-react';

// ============================================================
// Types (subset đọc từ DB)
// ============================================================
interface LedgerEntry {
  id: string;
  date: string;
  kind: 'thu' | 'chi';
  category?: string;
  amount: number;
  description: string;
  fromModule?: string;
  refId?: string;
  createdAt?: string;
}

interface SourceStat {
  source: string;
  label: string;
  emoji: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

const SOURCE_META: Record<string, { label: string; emoji: string }> = {
  manual: { label: 'Nhập tay', emoji: '✍️' },
  nhatro: { label: 'Nhà trọ', emoji: '🏠' },
  banhang: { label: 'Bán hàng POS', emoji: '🛒' },
  santhethao: { label: 'Sân thể thao', emoji: '🏆' },
  khodientu: { label: 'Kho điện tử', emoji: '📦' },
  photocopy: { label: 'Photocopy', emoji: '🖨' },
  karaoke: { label: 'Karaoke', emoji: '🎤' },
  spa: { label: 'Spa / Salon', emoji: '💆' },
  cafe: { label: 'Cafe / Bar', emoji: '☕' },
  gym: { label: 'Gym / Fitness', emoji: '💪' },
  recurring: { label: 'Định kỳ', emoji: '🔁' },
};

// ============================================================
// Helpers
// ============================================================
function formatMoney(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function startOfYear(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function loadLedger(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem('trishfinance_db');
    if (!raw) return [];
    const db = JSON.parse(raw);
    return Array.isArray(db.ledger) ? db.ledger : [];
  } catch {
    return [];
  }
}

function loadStsDebt(): { count: number; total: number } {
  try {
    const raw = localStorage.getItem('trishfinance:santhethao_db');
    if (!raw) return { count: 0, total: 0 };
    const db = JSON.parse(raw);
    const bookings = Array.isArray(db.bookings) ? db.bookings : [];
    let count = 0;
    let total = 0;
    for (const b of bookings) {
      if (b.paymentStatus !== 'cancelled' && (b.paid ?? 0) < (b.totalPrice ?? 0)) {
        count++;
        total += (b.totalPrice ?? 0) - (b.paid ?? 0);
      }
    }
    return { count, total };
  } catch {
    return { count: 0, total: 0 };
  }
}

function loadKdtLowStock(): { count: number; products: string[] } {
  try {
    const raw = localStorage.getItem('trishfinance:khodientu_db');
    if (!raw) return { count: 0, products: [] };
    const db = JSON.parse(raw);
    const products = Array.isArray(db.products) ? db.products : [];
    const low = products.filter((p: any) => p.active && p.stock <= p.minStock);
    return { count: low.length, products: low.slice(0, 5).map((p: any) => p.name) };
  } catch {
    return { count: 0, products: [] };
  }
}

// ============================================================
type Period = 'today' | 'week' | 'month' | 'year';

export function DashboardModule(): JSX.Element {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLedger(loadLedger());
    // Reload mỗi 5s để pick up các transaction mới từ module khác
    const t = setInterval(() => setLedger(loadLedger()), 5000);
    return () => clearInterval(t);
  }, [refreshTick]);

  // Filter theo period
  const fromDate = useMemo(() => {
    switch (period) {
      case 'today': return todayStr();
      case 'week': return daysAgo(6);
      case 'month': return startOfMonth();
      case 'year': return startOfYear();
    }
  }, [period]);

  const filtered = useMemo(
    () => ledger.filter((e) => e.date >= fromDate),
    [ledger, fromDate],
  );

  const totalIncome = filtered.filter((e) => e.kind === 'thu').reduce((s, e) => s + e.amount, 0);
  const totalExpense = filtered.filter((e) => e.kind === 'chi').reduce((s, e) => s + e.amount, 0);
  const net = totalIncome - totalExpense;

  // Group by source
  const sourceStats: SourceStat[] = useMemo(() => {
    const map = new Map<string, SourceStat>();
    for (const e of filtered) {
      const src = e.fromModule ?? 'manual';
      const meta = SOURCE_META[src] ?? { label: src, emoji: '•' };
      if (!map.has(src)) {
        map.set(src, { source: src, label: meta.label, emoji: meta.emoji, income: 0, expense: 0, net: 0, count: 0 });
      }
      const s = map.get(src)!;
      if (e.kind === 'thu') s.income += e.amount;
      else s.expense += e.amount;
      s.net = s.income - s.expense;
      s.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.income - a.income);
  }, [filtered]);

  const maxIncome = Math.max(...sourceStats.map((s) => s.income), 1);

  // Alerts
  const debtSts = loadStsDebt();
  const lowStock = loadKdtLowStock();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Home style={{ width: 24, height: 24, color: 'var(--color-accent-primary)' }} /> Trang chủ
        </h1>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--color-surface-row)', borderRadius: 10 }}>
          {([
            ['today', 'Hôm nay'],
            ['week', '7 ngày'],
            ['month', 'Tháng'],
            ['year', 'Năm'],
          ] as Array<[Period, string]>).map(([p, l]) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px',
                background: period === p ? 'var(--color-surface-card)' : 'transparent',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: period === p ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                boxShadow: period === p ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Stats top row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <BigStatCard icon={TrendingUp} label="Tổng thu" value={formatMoney(totalIncome)} color="#10B981" />
        <BigStatCard icon={TrendingDown} label="Tổng chi" value={formatMoney(totalExpense)} color="#DC2626" />
        <BigStatCard icon={DollarSign} label="Lợi nhuận ròng" value={formatMoney(net)} color={net >= 0 ? '#3B82F6' : '#DC2626'} />
        <BigStatCard icon={Calendar} label="Số giao dịch" value={String(filtered.length)} color="#F59E0B" />
      </div>

      {/* Alerts */}
      {(debtSts.count > 0 || lowStock.count > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
          {debtSts.count > 0 && (
            <div className="card" style={{ padding: 14, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626' }} />
                <strong style={{ color: '#991B1B' }}>⚠ Còn nợ — Sân thể thao</strong>
              </div>
              <div style={{ fontSize: 13, color: '#991B1B' }}>
                <strong>{debtSts.count}</strong> đơn chưa thu đủ — tổng <strong>{formatMoney(debtSts.total)}</strong>
              </div>
            </div>
          )}
          {lowStock.count > 0 && (
            <div className="card" style={{ padding: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#F59E0B' }} />
                <strong style={{ color: '#92400E' }}>📦 Kho điện tử — Tồn thấp</strong>
              </div>
              <div style={{ fontSize: 13, color: '#92400E' }}>
                <strong>{lowStock.count}</strong> sản phẩm sắp hết: {lowStock.products.slice(0, 3).join(', ')}{lowStock.count > 3 ? `, +${lowStock.count - 3} khác` : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Doanh thu theo module — horizontal bar chart */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <PieChart style={{ width: 16, height: 16 }} /> Doanh thu theo module
        </h2>
        {sourceStats.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Chưa có giao dịch nào trong khoảng thời gian này
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sourceStats.map((s) => {
              const pct = s.income > 0 ? (s.income / maxIncome) * 100 : 0;
              return (
                <div key={s.source}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span>{s.emoji}</span>
                      <strong>{s.label}</strong>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>({s.count} GD)</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent-primary)' }}>
                      {formatMoney(s.income)}
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-surface-row)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #059669)', transition: 'width 0.3s' }} />
                  </div>
                  {s.expense > 0 && (
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>
                      Chi: {formatMoney(s.expense)} · Net: {formatMoney(s.net)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar style={{ width: 16, height: 16 }} /> Giao dịch gần đây ({filtered.length})
        </h2>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Chưa có giao dịch
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {filtered.slice(0, 30).map((e) => {
              const meta = SOURCE_META[e.fromModule ?? 'manual'];
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 4px',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{meta?.emoji ?? '•'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.description}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {e.date} · {meta?.label ?? e.fromModule ?? 'manual'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: e.kind === 'thu' ? '#10B981' : '#DC2626',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.kind === 'thu' ? '+' : '−'} {formatMoney(e.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BigStatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }): JSX.Element {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 18, height: 18, color }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>{value}</div>
    </div>
  );
}
