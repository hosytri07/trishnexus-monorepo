/**
 * SharesPage — Phase 22.7e
 * List shares đã tạo + revoke + extend expires + copy URL.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Share2, Copy, CheckCircle2, AlertCircle, Loader2, RefreshCw, Ban, Clock, Download as DownloadIcon, FileText } from 'lucide-react';
import { useDialog } from './InlineDialog';

interface ShareItem {
  token: string;
  file_id: string;
  file_name: string;
  file_size_bytes: number;
  created_at: number;
  expires_at: number | null;
  max_downloads: number | null;
  download_count: number;
  revoked: boolean;
  url: string;
}

export function SharesPage({ uid }: { uid: string }): JSX.Element {
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('all');
  const { confirmAsync, promptAsync, DialogElement } = useDialog();

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await invoke<ShareItem[]>('share_list', { uid });
      setShares(list);
    } catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }

  async function revoke(s: ShareItem) {
    const ok = await confirmAsync(
      `Thu hồi link share "${s.file_name}"?\n\nNgười nhận sẽ không tải được nữa.`,
      { title: '⛔ Thu hồi link', danger: true, okLabel: 'Thu hồi' }
    );
    if (!ok) return;
    setBusyToken(s.token);
    try {
      await invoke('share_revoke', { uid, token: s.token });
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusyToken(null); }
  }

  async function extend(s: ShareItem) {
    const opts = ['1', '24', '168', '720'];
    const choice = await promptAsync(
      `Gia hạn link "${s.file_name}":\n  1 = thêm 1 giờ\n  24 = thêm 1 ngày\n  168 = thêm 7 ngày\n  720 = thêm 30 ngày\n\nNhập số giờ muốn gia hạn:`,
      '168',
      { title: '⏰ Gia hạn link share', placeholder: '168 (= 7 ngày)' }
    );
    if (!choice || !opts.includes(choice)) return;
    setBusyToken(s.token);
    try {
      await invoke('share_extend', { uid, token: s.token, expiresHours: parseInt(choice, 10) });
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusyToken(null); }
  }

  async function copyUrl(s: ShareItem) {
    try {
      await navigator.clipboard.writeText(s.url);
      setCopiedToken(s.token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch { /* ignore */ }
  }

  const now = Date.now();
  const filtered = shares.filter(s => {
    if (filter === 'active') return !s.revoked && (!s.expires_at || s.expires_at > now);
    if (filter === 'expired') return s.revoked || (s.expires_at !== null && s.expires_at <= now);
    return true;
  });

  function statusBadge(s: ShareItem): JSX.Element {
    if (s.revoked) return <Badge color="#ef4444">⛔ Đã thu hồi</Badge>;
    if (s.expires_at && s.expires_at <= now) return <Badge color="#94a3b8">⏰ Hết hạn</Badge>;
    if (s.max_downloads && s.download_count >= s.max_downloads) return <Badge color="#94a3b8">🚫 Hết lượt tải</Badge>;
    return <Badge color="#10b981">✓ Đang hoạt động</Badge>;
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Link share đã tạo ({shares.length})</h2>
          <p className="card-subtitle">Quản lý link share — revoke nếu lộ password, gia hạn thêm thời gian.</p>
        </div>
        <div className="flex gap-2">
          <select className="select-field" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} style={{ width: 160 }}>
            <option value="all">Tất cả</option>
            <option value="active">Đang hoạt động</option>
            <option value="expired">Hết hạn / thu hồi</option>
          </select>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      </div>

      {err && (
        <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
        </div>
      )}

      {loading && filtered.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          <div style={{ fontSize: 13, marginTop: 8 }}>Đang tải...</div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Share2 className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
            Chưa có share nào
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Vào tab "File của tôi" → click 🔗 trên file để tạo share
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-auto mt-4">
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Lượt tải</th>
                <th>Hết hạn</th>
                <th>Tạo lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.token}>
                  <td>
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-accent-primary)' }} />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{s.file_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {formatBytes(s.file_size_bytes)} · token <code style={{ fontFamily: 'monospace', fontSize: 10 }}>{s.token.slice(0, 12)}...</code>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{statusBadge(s)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <DownloadIcon className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                      {s.download_count}{s.max_downloads ? `/${s.max_downloads}` : ''}
                    </div>
                  </td>
                  <td>{s.expires_at ? formatDate(s.expires_at) : 'Không hết hạn'}</td>
                  <td>{formatRelative(s.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex gap-1.5 justify-end">
                      <button className="icon-btn" title="Copy URL" onClick={() => copyUrl(s)}>
                        {copiedToken === s.token ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                      {!s.revoked && (
                        <>
                          <button className="icon-btn" title="Gia hạn" onClick={() => extend(s)} disabled={busyToken === s.token}>
                            {busyToken === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                          </button>
                          <button className="icon-btn-danger" title="Thu hồi (revoke)" onClick={() => revoke(s)} disabled={busyToken === s.token}>
                            <Ban className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {DialogElement}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }): JSX.Element {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600,
      background: `${color}1a`, color,
    }}>
      {children}
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString('vi-VN');
}
