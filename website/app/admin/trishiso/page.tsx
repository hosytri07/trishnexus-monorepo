'use client';

/**
 * /admin/trishiso — Phase 22.8.
 * Read-only view dữ liệu sync từ TrishISO desktop (admin only).
 *
 * Khi TrishISO desktop wire Firestore (Phase 22.3 ISO Auth):
 *   - Hồ sơ tổng quát → /trishiso/projects/{id}
 *   - Mục lục con   → /trishiso/projects/{id}/items/{itemId}
 *   - Thiết bị      → /trishiso/equipment/{id}
 *   - Mượn-trả     → /trishiso/loans/{id}
 *   - Audit log    → /trishiso/audit/{id}
 *
 * Hiện tại (Phase 22.0) — placeholder + instruction sync setup.
 */

import { useEffect, useState } from 'react';
import { ClipboardList, FolderOpen, PackageCheck, UserCheck, AlertTriangle, Download } from 'lucide-react';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';

interface ProjectStats {
  total: number;
  byProvince: Record<string, number>;
  byStatus: { full: number; progress: number; missing: number };
}

export default function TrishISOAdminPage() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const db = requireDb();
      const q = query(collection(db, 'trishiso/_/projects'), orderBy('updatedAt', 'desc'), limit(500));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSynced(false);
      } else {
        setSynced(true);
        const byProvince: Record<string, number> = {};
        const byStatus = { full: 0, progress: 0, missing: 0 };
        snap.docs.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const province = (data.tinhThanh as string) || 'Khác';
          byProvince[province] = (byProvince[province] || 0) + 1;
          const status = (data.status as string) || '';
          if (status === 'Đầy đủ') byStatus.full++;
          else if (status === 'Đang hoàn thiện') byStatus.progress++;
          else byStatus.missing++;
        });
        setStats({ total: snap.size, byProvince, byStatus });
      }
    } catch (err) {
      console.warn('[trishiso admin] load failed', err);
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
            <ClipboardList className="inline h-7 w-7 mr-2" />
            TrishISO — Quản lý hồ sơ ISO
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Read-only view dữ liệu sync từ TrishISO desktop. Admin only.
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
                TrishISO desktop hiện đang lưu localStorage. Phase 22.3 sẽ wire Firebase login + auto sync Firestore mỗi khi user thao tác.
              </p>
              <div className="mt-3 text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                <div>Collection map (sau khi Phase 22.3):</div>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code>trishiso/_/projects/{'{id}'}</code> — hồ sơ tổng quát</li>
                  <li><code>trishiso/_/projects/{'{id}'}/items/{'{itemId}'}</code> — mục lục con</li>
                  <li><code>trishiso/_/equipment/{'{id}'}</code> — thiết bị nội bộ</li>
                  <li><code>trishiso/_/loans/{'{id}'}</code> — mượn-trả</li>
                  <li><code>trishiso/_/audit/{'{id}'}</code> — audit log thao tác</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && synced && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={FolderOpen} label="Hồ sơ" value={stats.total} />
            <StatCard icon={PackageCheck} label="Đầy đủ" value={stats.byStatus.full} color="#10b981" />
            <StatCard icon={UserCheck} label="Đang hoàn thiện" value={stats.byStatus.progress} color="#f59e0b" />
            <StatCard icon={AlertTriangle} label="Thiếu nhiều" value={stats.byStatus.missing} color="#ef4444" />
          </div>

          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Phân bố theo tỉnh/thành
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.byProvince).sort((a, b) => b[1] - a[1]).map(([province, count]) => (
                <div key={province} className="flex justify-between items-center text-sm">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{province}</span>
                  <span className="font-semibold" style={{ color: 'var(--color-accent-primary)' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof FolderOpen; label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p className="text-3xl font-bold mt-2" style={{ color: color || 'var(--color-text-primary)' }}>{value}</p>
        </div>
        <div className="p-2 rounded-xl" style={{ background: 'var(--color-accent-soft)', color: color || 'var(--color-accent-primary)' }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
