'use client';

/**
 * /admin/trishdrive — Phase 22.8 (rewrite Phase 23.4).
 * Admin tools cho TrishDrive: share link audit, recent activity.
 *
 * TrishDrive là **local-first** app: file metadata lưu SQLite + keyring local.
 * Chỉ share links ghi lên Firestore /trishdrive/_/shares/{token}.
 * Vì vậy admin chỉ thấy stats về share link, không phải user/file globally.
 */

import { useEffect, useState } from 'react';
import { Cloud, Files, Share2, AlertTriangle, Download, Activity } from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';

interface DriveStats {
  totalShares: number;
  activeShares: number;
  revokedShares: number;
  totalDownloads: number;
  totalSizeBytes: number;
}

interface ShareSummary {
  token: string;
  file_name: string;
  file_size_bytes: number;
  created_at: number;
  download_count: number;
  revoked: boolean;
  short_code?: string;
}

export default function TrishDriveAdminPage() {
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [recentShares, setRecentShares] = useState<ShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const db = requireDb();
      // Lấy tất cả shares (giới hạn 500 để tránh quá tải)
      const sharesSnap = await getDocs(
        query(collection(db, 'trishdrive/_/shares'), limit(500))
      );

      let active = 0;
      let revoked = 0;
      let totalDownloads = 0;
      let totalSize = 0;
      const summaries: ShareSummary[] = [];

      sharesSnap.forEach(doc => {
        const d = doc.data();
        const isRevoked = d.revoked === true;
        if (isRevoked) revoked++; else active++;
        totalDownloads += d.download_count ?? 0;
        totalSize += d.file_size_bytes ?? 0;
        summaries.push({
          token: doc.id,
          file_name: d.file_name ?? '(unknown)',
          file_size_bytes: d.file_size_bytes ?? 0,
          created_at: d.created_at ?? 0,
          download_count: d.download_count ?? 0,
          revoked: isRevoked,
          short_code: d.short_code,
        });
      });
      summaries.sort((a, b) => b.created_at - a.created_at);

      setStats({
        totalShares: sharesSnap.size,
        activeShares: active,
        revokedShares: revoked,
        totalDownloads,
        totalSizeBytes: totalSize,
      });
      setRecentShares(summaries.slice(0, 20));
    } catch (e) {
      setErr((e as Error).message);
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

      {!loading && err && (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div className="flex-1">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Lỗi load</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{err}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !err && stats && stats.totalShares === 0 && (
        <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            ✅ TrishDrive backend đã active (Phase 22.4–23.4) — chưa có share link nào được tạo.
            File và folder lưu local-first ở user (SQLite + keyring), Firestore chỉ track share link.
          </p>
        </div>
      )}

      {!loading && stats && stats.totalShares > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={Share2} label="Total shares" value={stats.totalShares} />
            <StatCard icon={Activity} label="Active" value={stats.activeShares} />
            <StatCard icon={AlertTriangle} label="Revoked" value={stats.revokedShares} />
            <StatCard icon={Download} label="Total downloads" value={stats.totalDownloads} />
          </div>

          <div className="rounded-2xl border" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-surface-card)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                20 share link gần nhất
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Tổng dung lượng đã share (cumulative): {formatBytes(stats.totalSizeBytes)}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-row)' }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>File</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Size</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Downloads</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Created</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Short link</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShares.map(s => (
                    <tr key={s.token} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <td className="px-4 py-2" style={{ color: 'var(--color-text-primary)' }}>{s.file_name}</td>
                      <td className="px-4 py-2 text-right" style={{ color: 'var(--color-text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
                        {formatBytes(s.file_size_bytes)}
                      </td>
                      <td className="px-4 py-2 text-center" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                        {s.download_count}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: s.revoked ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                          color: s.revoked ? '#dc2626' : 'var(--color-accent-primary)',
                          letterSpacing: 0.4,
                        }}>
                          {s.revoked ? 'REVOKED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right" style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-2" style={{ color: 'var(--color-text-link)', fontFamily: 'monospace', fontSize: 11 }}>
                        {s.short_code ? `/s/${s.short_code}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
