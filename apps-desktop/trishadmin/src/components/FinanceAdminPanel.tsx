/**
 * Phase 41 — FinanceAdminPanel.
 *
 * TrishFinance là local-only (localStorage `trishfinance_db`), không sync Firestore.
 * Panel này chỉ hiển thị:
 *   - Notice giải thích why no cross-user view
 *   - Telemetry từ Sessions: ai đã mở Finance gần đây
 *   - Số user kích hoạt key TrishFinance (từ /TrishKey)
 */
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

interface UsageRow {
  uid: string;
  email?: string;
  display_name?: string;
  last_seen?: number;
  key_active?: boolean;
}

export function FinanceAdminPanel(): JSX.Element {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalUsers: number; activeKeys: number; recentSessions: number }>({ totalUsers: 0, activeKeys: 0, recentSessions: 0 });

  useEffect(() => { void load(); }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const db = getFirebaseDb();
      // Phase 41.1 — Schema thực tế: /keys/{keyId} với fields { app_id, status, bound_uid, recipient, ... }
      // Lấy users đã activate key TrishFinance (status='used' nghĩa là đã consumed)
      const usedSnap = await getDocs(query(
        collection(db, 'keys'),
        where('app_id', '==', 'trishfinance'),
        where('status', '==', 'used'),
        limit(200),
      ));
      const sessRows: UsageRow[] = usedSnap.docs.map((d) => {
        const data = d.data() as { bound_uid?: string; recipient?: string; activated_at?: number; used_at?: number };
        return {
          uid: data.bound_uid ?? d.id,
          email: data.recipient,
          last_seen: data.activated_at ?? data.used_at,
          key_active: true,
        };
      });

      // Active keys (chưa kích hoạt — đang chờ user nhập)
      let activeKeysCount = 0;
      try {
        const activeSnap = await getDocs(query(
          collection(db, 'keys'),
          where('app_id', '==', 'trishfinance'),
          where('status', '==', 'active'),
          limit(500),
        ));
        activeKeysCount = activeSnap.size;
      } catch { /* ignore */ }

      setRows(sessRows);
      setStats({
        totalUsers: new Set(sessRows.map((r) => r.uid)).size,
        activeKeys: activeKeysCount,
        recentSessions: sessRows.length,
      });
    } catch (err) {
      console.error('FinanceAdmin load', err);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>💵 Finance Admin — Telemetry</h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        TrishFinance hiện <strong>local-only</strong> (lưu localStorage <code>trishfinance_db</code>) — admin không xem được data nội bộ
        (phòng trọ, bảng lương, POS) của user. Panel này chỉ hiển thị telemetry (session, key activation).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="User mở Finance gần đây" value={stats.totalUsers.toString()} hint="200 key đã activate" />
        <StatCard label="Key Finance đang active" value={stats.activeKeys.toString()} hint="status=active" />
        <StatCard label="Total keys activated" value={stats.recentSessions.toString()} hint="100 mới nhất" />
      </div>

      <div style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>👥 Users đã activate key Finance</h2>
        {loading && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>⏳</div>}
        {!loading && rows.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Chưa có user nào activate key Finance</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-default)' }}>
              <th style={th}>Display name</th>
              <th style={th}>Email</th>
              <th style={th}>UID</th>
              <th style={th}>Activated at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                <td style={td}>{r.display_name ?? '—'}</td>
                <td style={td}>{r.email ?? '—'}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 10 }}>{r.uid.slice(0, 16)}…</td>
                <td style={td}>{r.last_seen ? new Date(r.last_seen).toLocaleString('vi-VN') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 12, color: '#92400E', lineHeight: 1.6 }}>
        💡 <strong>Roadmap Phase 42:</strong> nếu cần view data Finance cross-user, phải thêm Firestore sync opt-in trong TrishFinance
        (giống TrishOffice Phase 38.18). User opt-in trong Settings → push DB lên <code>/trishfinance_users/{'{'}uid{'}'}/db</code>.
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div style={{ padding: 14, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent-primary, #10B981)', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)' };
const td: React.CSSProperties = { padding: '6px 8px' };
