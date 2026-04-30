'use client';

/**
 * /admin/trishdrive — Phase 22.8.
 * Admin tools cho TrishDrive: storage stats, share link audit, user list.
 *
 * Khác /admin/trishiso và /admin/trishfinance ở chỗ TrishDrive là **public app**
 * (user thường dùng), nhưng admin có quyền:
 *   - Xem total storage usage all users
 *   - Quản lý share link công khai
 *   - Block user vi phạm (spam upload)
 *   - Force quota limit
 */

import { useEffect, useState } from 'react';
import { Cloud, Files, Share2, AlertTriangle, Download } from 'lucide-react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';

interface DriveStats {
  totalUsers: number;
  totalFiles: number;
  totalShareLinks: number;
  totalSizeBytes: number;
}

export default function TrishDriveAdminPage() {
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const db = requireDb();
      const usersSnap = await getDocs(query(collection(db, 'trishdrive/_/users'), limit(1)));
      if (usersSnap.empty) {
        setSynced(false);
      } else {
        // Phase 22.8 placeholder
        setSynced(true);
        setStats({ totalUsers: 0, totalFiles: 0, totalShareLinks: 0, totalSizeBytes: 0 });
      }
    } catch {
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
            <Cloud className="inline h-7 w-7 mr-2" />
            TrishDrive — Admin tools
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Quản lý cloud storage qua Telegram. Stats + share link audit + user moderation.
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
                TrishDrive chưa active
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                TrishDrive đang ở Phase 22.0 (skeleton). Phase 22.4-22.7 implement Telegram setup wizard, upload, download, share link.
              </p>
              <div className="mt-3 text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                <div>Collection map (sau khi Phase 22.5+):</div>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><code>trishdrive/_/users/{'{uid}'}</code> — quota + bot config</li>
                  <li><code>trishdrive/_/users/{'{uid}'}/files/{'{fileId}'}</code> — metadata file</li>
                  <li><code>trishdrive/_/share/{'{token}'}</code> — public share link</li>
                  <li><code>trishdrive/_/audit/{'{id}'}</code> — admin actions log</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && synced && stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon={Files} label="Users" value={stats.totalUsers} />
          <StatCard icon={Files} label="Files" value={stats.totalFiles} />
          <StatCard icon={Share2} label="Share links" value={stats.totalShareLinks} />
          <StatCard icon={Cloud} label="Total size" value={formatBytes(stats.totalSizeBytes)} isText />
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function StatCard({ icon: Icon, label, value, isText }: { icon: typeof Files; label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p className={`mt-2 font-bold ${isText ? 'text-xl' : 'text-3xl'}`} style={{ color: 'var(--color-text-primary)' }}>{value}</p>
        </div>
        <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
