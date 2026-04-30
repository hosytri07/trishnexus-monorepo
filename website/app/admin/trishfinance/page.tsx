'use client';

/**
 * /admin/trishfinance — Phase 22.8.
 * Read-only view dữ liệu sync từ TrishFinance desktop (admin only).
 *
 * Khi TrishFinance Phase 22.9 (rewrite React) wire Firestore:
 *   - Sản phẩm        → /trishfinance/_/products/{id}
 *   - Đơn hàng       → /trishfinance/_/orders/{id}
 *   - Khách hàng     → /trishfinance/_/customers/{id}
 *   - Phòng trọ      → /trishfinance/_/rooms/{id}
 *   - Hợp đồng       → /trishfinance/_/contracts/{id}
 *   - Thu chi        → /trishfinance/_/transactions/{id}
 */

import { useEffect, useState } from 'react';
import { Wallet, ShoppingCart, Building, Users, AlertTriangle, Download, TrendingUp } from 'lucide-react';
import { collection, getDocs, query, limit, where, Timestamp } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';

interface FinanceStats {
  totalProducts: number;
  totalRooms: number;
  totalCustomers: number;
  revenueToday: number;
  revenueMonth: number;
  pendingOrders: number;
}

export default function TrishFinanceAdminPage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const db = requireDb();
      const productsSnap = await getDocs(query(collection(db, 'trishfinance/_/products'), limit(1)));
      if (productsSnap.empty) {
        setSynced(false);
        return;
      }
      setSynced(true);

      // Phase 22.8 placeholder — full stats khi có data thật
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

      const [products, rooms, customers, ordersToday, ordersMonth, pendingOrders] = await Promise.all([
        getDocs(query(collection(db, 'trishfinance/_/products'), limit(2000))),
        getDocs(query(collection(db, 'trishfinance/_/rooms'), limit(500))),
        getDocs(query(collection(db, 'trishfinance/_/customers'), limit(2000))),
        getDocs(query(collection(db, 'trishfinance/_/orders'), where('createdAt', '>=', Timestamp.fromDate(startOfDay)))),
        getDocs(query(collection(db, 'trishfinance/_/orders'), where('createdAt', '>=', Timestamp.fromDate(startOfMonth)))),
        getDocs(query(collection(db, 'trishfinance/_/orders'), where('status', '==', 'pending'), limit(100))),
      ]);

      const sumRevenue = (snap: typeof ordersToday) =>
        snap.docs.reduce((sum, d) => sum + ((d.data() as { total?: number }).total || 0), 0);

      setStats({
        totalProducts: products.size,
        totalRooms: rooms.size,
        totalCustomers: customers.size,
        revenueToday: sumRevenue(ordersToday),
        revenueMonth: sumRevenue(ordersMonth),
        pendingOrders: pendingOrders.size,
      });
    } catch (err) {
      console.warn('[trishfinance admin] load failed', err);
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            <Wallet className="inline h-7 w-7 mr-2" />
            TrishFinance — Tài chính phòng trọ + bán hàng
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Read-only dashboard dữ liệu sync từ TrishFinance desktop. Admin only.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--color-accent-gradient)', color: 'white' }}
        >
          <Download className="h-4 w-4" />
          Tải installer (.exe)
        </button>
      </header>

      {loading && (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Đang tải dữ liệu...</p>
        </div>
      )}

      {!loading && !synced && (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <div className="flex-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Chưa có dữ liệu sync
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                TrishFinance desktop là HTML standalone (Phase 22.0), chưa wire Firestore.
                Phase 22.9 sẽ rewrite React + Vite + sync auto realtime.
              </p>
              <div className="mt-3 text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                <div>Collection map (sau khi Phase 22.9):</div>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code>trishfinance/_/products/{'{id}'}</code> — sản phẩm tồn kho</li>
                  <li><code>trishfinance/_/orders/{'{id}'}</code> — đơn hàng POS</li>
                  <li><code>trishfinance/_/customers/{'{id}'}</code> — khách hàng + công nợ</li>
                  <li><code>trishfinance/_/rooms/{'{id}'}</code> — phòng trọ</li>
                  <li><code>trishfinance/_/contracts/{'{id}'}</code> — hợp đồng thuê</li>
                  <li><code>trishfinance/_/transactions/{'{id}'}</code> — thu/chi</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && synced && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard icon={ShoppingCart} label="Sản phẩm" value={stats.totalProducts} />
            <StatCard icon={Building} label="Phòng trọ" value={stats.totalRooms} />
            <StatCard icon={Users} label="Khách hàng" value={stats.totalCustomers} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              label="Doanh thu hôm nay"
              value={formatVND(stats.revenueToday)}
              color="#10b981"
              isText
            />
            <StatCard
              icon={TrendingUp}
              label="Doanh thu tháng"
              value={formatVND(stats.revenueMonth)}
              color="#10b981"
              isText
            />
            <StatCard
              icon={AlertTriangle}
              label="Đơn chờ xử lý"
              value={stats.pendingOrders}
              color={stats.pendingOrders > 0 ? '#f59e0b' : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}

function formatVND(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isText,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: number | string;
  color?: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p
            className={`mt-2 font-bold ${isText ? 'text-xl' : 'text-3xl'}`}
            style={{ color: color || 'var(--color-text-primary)' }}
          >
            {value}
          </p>
        </div>
        <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'var(--color-accent-soft)', color: color || 'var(--color-accent-primary)' }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
