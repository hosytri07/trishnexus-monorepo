/**
 * DashboardPage — Phase 22.7j
 * Tổng quan: total files, total size, chunks, recent uploads, top folders, share stats.
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Files, HardDrive, Boxes, Folder, Share2, Clock, AlertCircle,
  Loader2, ArrowRight, Upload, RefreshCw,
} from 'lucide-react';

interface FileRow {
  id: string;
  name: string;
  size_bytes: number;
  mime?: string | null;
  folder_id?: string | null;
  created_at: number;
  total_chunks: number;
  note?: string | null;
}

interface FolderRow { id: string; name: string; }

interface ShareItem {
  token: string;
  file_name: string;
  download_count: number;
  expires_at: number | null;
  revoked: boolean;
}

export function DashboardPage({
  uid, onGoFiles, onGoUpload, onGoShares,
}: { uid: string; onGoFiles: () => void; onGoUpload: () => void; onGoShares: () => void }): JSX.Element {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [f, fl, sh] = await Promise.all([
        invoke<FileRow[]>('db_files_list', { folderId: null, search: null }),
        invoke<FolderRow[]>('folder_list'),
        invoke<ShareItem[]>('share_list', { uid }).catch(() => [] as ShareItem[]),
      ]);
      setFiles(f);
      setFolders(fl);
      setShares(sh);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  const stats = useMemo(() => {
    const totalSize = files.reduce((s, f) => s + f.size_bytes, 0);
    const totalChunks = files.reduce((s, f) => s + f.total_chunks, 0);
    const now = Date.now();
    const activeShares = shares.filter(s => !s.revoked && (!s.expires_at || s.expires_at > now)).length;
    const totalDownloads = shares.reduce((s, sh) => s + (sh.download_count || 0), 0);
    return {
      totalFiles: files.length,
      totalSize,
      totalChunks,
      totalFolders: folders.length,
      activeShares,
      totalShares: shares.length,
      totalDownloads,
    };
  }, [files, folders, shares]);

  const recent = useMemo(() => {
    return [...files].sort((a, b) => b.created_at - a.created_at).slice(0, 5);
  }, [files]);

  const folderUsage = useMemo(() => {
    const map: Record<string, { count: number; size: number }> = {};
    let rootCount = 0; let rootSize = 0;
    for (const f of files) {
      if (!f.folder_id) {
        rootCount++; rootSize += f.size_bytes;
      } else {
        if (!map[f.folder_id]) map[f.folder_id] = { count: 0, size: 0 };
        map[f.folder_id].count++;
        map[f.folder_id].size += f.size_bytes;
      }
    }
    const list = folders.map(fl => ({
      id: fl.id, name: fl.name, count: map[fl.id]?.count || 0, size: map[fl.id]?.size || 0,
    }));
    list.unshift({ id: '_root', name: '📁 Root', count: rootCount, size: rootSize });
    return list.sort((a, b) => b.size - a.size).slice(0, 5);
  }, [files, folders]);

  return (
    <div className="space-y-4 max-w-5xl">
      {err && (
        <div className="flex gap-2 items-start p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
        </div>
      )}

      {/* 4 stat cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <StatCard icon={Files} label="Tổng files" value={stats.totalFiles.toString()} hint={`${stats.totalChunks} chunks`} />
        <StatCard icon={HardDrive} label="Storage Telegram" value={formatBytes(stats.totalSize)} hint={`Trung bình ${formatBytes(stats.totalFiles ? stats.totalSize / stats.totalFiles : 0)}/file`} />
        <StatCard icon={Folder} label="Folders" value={stats.totalFolders.toString()} hint={`${files.filter(f => !f.folder_id).length} file ở root`} />
        <StatCard icon={Share2} label="Shares đang active" value={stats.activeShares.toString()} hint={`${stats.totalDownloads} lượt tải`} />
      </div>

      {/* 2 col: Recent + Folders */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Recent uploads */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title flex items-center gap-2"><Clock className="h-4 w-4" /> Upload gần đây</h2>
              <p className="card-subtitle">5 file mới nhất</p>
            </div>
            <button className="btn-secondary" onClick={onGoFiles}>
              Xem tất cả <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {loading && recent.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              <Loader2 className="h-6 w-6 mx-auto animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              <p>Chưa có file nào</p>
              <button className="btn-primary mt-3" onClick={onGoUpload}>
                <Upload className="h-4 w-4" /> Upload file đầu tiên
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {recent.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--color-surface-row)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Files className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {formatBytes(f.size_bytes)} · {formatRelative(f.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top folders */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title flex items-center gap-2"><Boxes className="h-4 w-4" /> Top folders</h2>
              <p className="card-subtitle">Theo dung lượng</p>
            </div>
          </div>
          {folderUsage.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              Chưa có folder nào
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {folderUsage.map(fl => {
                const pct = stats.totalSize > 0 ? (fl.size / stats.totalSize) * 100 : 0;
                return (
                  <div key={fl.id}>
                    <div className="flex justify-between text-sm">
                      <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{fl.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{fl.count} file · {formatBytes(fl.size)}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-surface-muted)', borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: 'var(--color-accent-gradient)',
                        transition: 'width 250ms',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="card-title">Quick actions</h2>
        <div className="flex gap-2 flex-wrap mt-3">
          <button className="btn-primary" onClick={onGoUpload}>
            <Upload className="h-4 w-4" /> Upload file mới
          </button>
          <button className="btn-secondary" onClick={onGoFiles}>
            <Files className="h-4 w-4" /> Quản lý file
          </button>
          <button className="btn-secondary" onClick={onGoShares}>
            <Share2 className="h-4 w-4" /> Link share đã tạo ({stats.activeShares})
          </button>
          <button className="btn-secondary" onClick={load}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Files; label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            {label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 4, letterSpacing: '-0.02em' }}>
            {value}
          </div>
          {hint && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>
          )}
        </div>
        <div style={{
          background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)',
          padding: 8, borderRadius: 10, flexShrink: 0,
        }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}
