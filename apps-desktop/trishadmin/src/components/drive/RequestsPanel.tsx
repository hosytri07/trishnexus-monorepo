/**
 * RequestsPanel — Phase 26.5.E.2
 *
 * Admin moderation queue cho file_requests user gửi (Phase 26.5.E.1).
 * GET /api/drive/library/requests + PATCH /api/drive/library/requests/[id]
 *
 * Workflow admin:
 *   1. User TrishDrive standalone gửi request "cần file XYZ"
 *   2. Admin (TrishAdmin Drive Panel → Yêu cầu file) thấy danh sách pending
 *   3. Admin xem mô tả + reply (text) + đổi status: approved → uploaded → done
 *   4. User nhận update qua email (Phase 26.6+) hoặc check status thủ công
 */

import { useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth } from '@trishteam/auth';
import {
  Send, RefreshCw, AlertCircle, Loader2, CheckCircle2,
  X, Filter, Mail, Clock, FileQuestion,
} from 'lucide-react';

interface RequestItem {
  id: string;
  user_uid: string;
  user_email: string | null;
  user_name: string | null;
  file_name: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'uploaded';
  admin_reply: string | null;
  created_at: number;
  updated_at: number | null;
}

const SHARE_API_BASE = 'https://trishteam.io.vn';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'uploaded';

export function RequestsPanel(): JSX.Element {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [editing, setEditing] = useState<RequestItem | null>(null);

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần login admin');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/requests?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items: RequestItem[] };
      setItems(data.items || []);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  }

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, rejected: 0, uploaded: 0 };
    items.forEach(it => { c.all++; c[it.status]++; });
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <Send className="h-5 w-5" /> Yêu cầu file từ user
            </h2>
            <p className="card-subtitle">
              Danh sách user gửi request admin upload file mới. Reply để báo user.
            </p>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mt-3">
          {(['pending', 'all', 'approved', 'uploaded', 'rejected'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                background: filter === s ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
                color: filter === s ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                border: '1px solid ' + (filter === s ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <Filter className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />
              {s === 'all' ? 'Tất cả' : s === 'pending' ? 'Chờ xử lý' : s === 'approved' ? 'Đã duyệt' : s === 'uploaded' ? 'Đã upload' : 'Từ chối'}
              {' '}({s === 'all' ? items.length : (counts[s] || 0)})
            </button>
          ))}
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <FileQuestion className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
              Không có request {filter === 'all' ? 'nào' : `với status "${filter}"`}
            </div>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {items.map(item => <RequestCard key={item.id} item={item} onClick={() => setEditing(item)} />)}
          </div>
        )}
      </div>

      {editing && <ReplyModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </div>
  );
}

function RequestCard({ item, onClick }: { item: RequestItem; onClick: () => void }): JSX.Element {
  const statusColor = {
    pending: { bg: 'rgba(245,158,11,0.15)', color: '#b45309', label: '⏳ Chờ' },
    approved: { bg: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', label: '✓ Duyệt' },
    rejected: { bg: 'rgba(239,68,68,0.15)', color: '#dc2626', label: '✕ Từ chối' },
    uploaded: { bg: 'rgba(59,130,246,0.15)', color: '#2563eb', label: '📤 Đã upload' },
  }[item.status];

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: 14,
        background: 'var(--color-surface-row)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
      onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--color-accent-primary)')}
      onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
    >
      <div className="flex items-start gap-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {item.file_name}
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 5,
              background: statusColor.bg, color: statusColor.color,
            }}>{statusColor.label}</span>
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              {item.description}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-2" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {item.user_email || item.user_uid.slice(0, 8)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDate(item.created_at)}
            </span>
          </div>
          {item.admin_reply && (
            <div className="p-2 mt-2 rounded" style={{ background: 'var(--color-surface-card)', borderLeft: '3px solid var(--color-accent-primary)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent-primary)', marginBottom: 2 }}>Admin reply:</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{item.admin_reply}</div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ReplyModal({ item, onClose, onSaved }: { item: RequestItem; onClose: () => void; onSaved: () => void }): JSX.Element {
  const [status, setStatus] = useState<RequestItem['status']>(item.status);
  const [reply, setReply] = useState(item.admin_reply || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần login admin');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/requests/${item.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_reply: reply.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--color-surface-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 560, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title">{item.file_name}</h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>
              From {item.user_email || item.user_uid.slice(0, 8)} · {formatDate(item.created_at)}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {item.description && (
          <div className="p-3 mt-4 rounded-xl" style={{ background: 'var(--color-surface-row)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {item.description}
          </div>
        )}

        <div className="space-y-3 mt-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Status</label>
            <select className="select-field mt-1" value={status} onChange={e => setStatus(e.target.value as RequestItem['status'])}>
              <option value="pending">⏳ Chờ xử lý</option>
              <option value="approved">✓ Đã duyệt (chưa upload)</option>
              <option value="uploaded">📤 Đã upload (báo user)</option>
              <option value="rejected">✕ Từ chối</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Reply cho user (tùy chọn)</label>
            <textarea
              className="input-field mt-1"
              style={{ minHeight: 100, resize: 'vertical' }}
              placeholder="VD: Đã upload, mở tab Thư viện TrishTEAM. Hoặc: file này thuộc bản quyền nội bộ, không thể public."
              value={reply}
              onChange={e => setReply(e.target.value)}
              maxLength={2000}
              disabled={busy}
            />
          </div>
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString('vi-VN');
}
