/**
 * Phase 24.1 — Broadcasts panel with delivery tracking.
 *
 * Compose announcement → Firestore `announcements/{id}`.
 * Track delivery_count (clients received) + read_count (marked as read).
 * Detail view with delivery analytics.
 */

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@trishteam/auth/react';
import {
  type ActorContext,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastSeverity,
  createBroadcast,
  deleteBroadcast,
  formatRelative,
  formatTimestamp,
  listBroadcasts,
  setBroadcastActive,
} from '../lib/firestore-admin.js';

interface Props {
  adminUid: string;
}

const SEVERITY_LABEL: Record<BroadcastSeverity, string> = {
  info: 'ℹ Thông tin',
  warning: '⚠ Cảnh báo',
  critical: '🚨 Khẩn cấp',
};

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  all: '👥 Tất cả',
  paid: '✅ User (paid)',
  trial: '✨ Trial',
  admin: '🛡 Admin only',
};

export function BroadcastsPanel({ adminUid }: Props): JSX.Element {
  const { firebaseUser } = useAuth();
  const actor: ActorContext = {
    uid: firebaseUser?.uid ?? adminUid,
    email: firebaseUser?.email ?? undefined,
  };
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [showDetail, setShowDetail] = useState<Broadcast | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listBroadcasts(100);
      setBroadcasts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggleActive(b: Broadcast): Promise<void> {
    try {
      await setBroadcastActive(b.id, !b.active, actor, b.title);
      setActionMsg(`✓ ${!b.active ? 'Bật' : 'Tắt'} broadcast`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(b: Broadcast): Promise<void> {
    if (!window.confirm(`Xóa broadcast "${b.title}"? Không thể khôi phục.`)) return;
    try {
      await deleteBroadcast(b.id, actor, b.title);
      setActionMsg(`✓ Đã xóa "${b.title}"`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 24.3 — Theme color helpers (reserved for future inline-style usage)
  // Đang khai báo để khỏi cần reload nếu component sau dùng.
  void (() => 'var(--color-border-subtle, #E5E7EB)');
  void (() => 'var(--color-text-primary, #111827)');
  void (() => 'var(--color-text-muted, #6B7280)');

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>📢 Broadcasts + Delivery Tracking</h1>
          <p className="muted small">
            Push thông báo tới user app. Theo dõi delivery + read rate realtime.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCompose(true)}
          >
            ＋ Soạn broadcast
          </button>
        </div>
      </header>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg}
        </div>
      )}

      <div className="broadcast-list">
        {broadcasts.length === 0 ? (
          <div className="empty-state muted small">
            {loading ? 'Đang tải…' : 'Chưa có broadcast nào.'}
          </div>
        ) : (
          broadcasts.map((b) => {
            const deliveryRate = (b.delivery_count ?? 0) > 0
              ? Math.round(((b.read_count ?? 0) / (b.delivery_count ?? 1)) * 100)
              : 0;
            return (
              <div
                key={b.id}
                className={`broadcast-card severity-${b.severity} ${b.active ? '' : 'inactive'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setShowDetail(b)}
              >
                <header>
                  <div className="broadcast-meta">
                    <span className={`severity-badge severity-${b.severity}`}>
                      {SEVERITY_LABEL[b.severity]}
                    </span>
                    <span className="audience-badge">{AUDIENCE_LABEL[b.audience]}</span>
                    {!b.active && <span className="muted small">⏸ Tắt</span>}
                    {(b.delivery_count ?? 0) > 0 && (
                      <span className="muted small">
                        📨 {b.delivery_count} delivered · 👁 {b.read_count ?? 0} read ({deliveryRate}%)
                      </span>
                    )}
                  </div>
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => void handleToggleActive(b)}
                    >
                      {b.active ? '⏸ Tắt' : '▶ Bật'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-danger"
                      onClick={() => void handleDelete(b)}
                    >
                      🗑
                    </button>
                  </div>
                </header>
                <h3>{b.title}</h3>
                <p className="broadcast-body">{b.body}</p>
                <footer className="muted small">
                  Tạo {formatRelative(b.created_at)} ·
                  {b.expires_at > 0
                    ? ` Hết hạn ${formatTimestamp(b.expires_at)}`
                    : ' Không hết hạn'}
                </footer>
              </div>
            );
          })
        )}
      </div>

      {showCompose && (
        <ComposeBroadcastModal
          adminUid={adminUid}
          onClose={() => setShowCompose(false)}
          onDone={async (msg) => {
            setActionMsg(msg);
            await load();
            setShowCompose(false);
          }}
        />
      )}

      {showDetail && (
        <BroadcastDetailModal
          broadcast={showDetail}
          onClose={() => setShowDetail(null)}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

interface DetailProps {
  broadcast: Broadcast;
  onClose: () => void;
  onToggleActive: (b: Broadcast) => Promise<void>;
  onDelete: (b: Broadcast) => Promise<void>;
}

function BroadcastDetailModal({
  broadcast,
  onClose,
  onToggleActive,
  onDelete,
}: DetailProps): JSX.Element {
  const deliveryChart = [
    { label: 'Delivered', value: broadcast.delivery_count ?? 0, fill: '#3b82f6' },
    { label: 'Read', value: broadcast.read_count ?? 0, fill: '#22c55e' },
  ];

  const deliveryRate = (broadcast.delivery_count ?? 0) > 0
    ? Math.round(((broadcast.read_count ?? 0) / (broadcast.delivery_count ?? 1)) * 100)
    : 0;

  const getBorderColor = (): string => 'var(--color-border-subtle, #E5E7EB)';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 700, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <header className="modal-head">
          <h2>{broadcast.title}</h2>
          <button className="mini" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          {/* Delivery stats */}
          {(broadcast.delivery_count ?? 0) > 0 && (
            <div
              style={{
                background: 'var(--color-surface-row, #F9FAFB)',
                padding: 12,
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 12,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong>📊 Delivery Stats</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {broadcast.delivery_count ?? 0}
                  </div>
                  <div style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
                    Clients received
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {broadcast.read_count ?? 0}
                    <span style={{ fontSize: 12, marginLeft: 4 }}>({deliveryRate}%)</span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted, #6B7280)', fontSize: 11 }}>
                    Marked as read
                  </div>
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deliveryChart}>
                    <CartesianGrid stroke={getBorderColor()} />
                    <XAxis dataKey="label" style={{ fontSize: 11 }} />
                    <YAxis style={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface-bg, #f9fafb)' }} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600 }}>Content</h3>
            <div
              style={{
                background: 'var(--color-surface-row, #F9FAFB)',
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {broadcast.body}
            </div>
          </div>

          {/* Metadata */}
          <div style={{ fontSize: 12, color: 'var(--color-text-muted, #6B7280)', marginBottom: 16 }}>
            <div>
              <strong>Status:</strong> {broadcast.active ? '✅ Active' : '⏸ Inactive'}
            </div>
            <div>
              <strong>Severity:</strong> {SEVERITY_LABEL[broadcast.severity]}
            </div>
            <div>
              <strong>Audience:</strong> {AUDIENCE_LABEL[broadcast.audience]}
            </div>
            <div>
              <strong>Created:</strong> {formatTimestamp(broadcast.created_at)}
            </div>
            {broadcast.expires_at > 0 && (
              <div>
                <strong>Expires:</strong> {formatTimestamp(broadcast.expires_at)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: `1px solid ${getBorderColor()}`, paddingTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => void onToggleActive(broadcast)}
            >
              {broadcast.active ? '⏸ Tắt' : '▶ Bật'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                if (window.confirm(`Xóa "${broadcast.title}"?`)) {
                  void onDelete(broadcast).then(() => onClose());
                }
              }}
            >
              🗑 Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComposeProps {
  adminUid: string;
  onClose: () => void;
  onDone: (msg: string) => Promise<void>;
}

function ComposeBroadcastModal({ adminUid, onClose, onDone }: ComposeProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<BroadcastSeverity>('info');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [expireHours, setExpireHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Cần điền title + body');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const expiresAt =
        expireHours > 0 ? Date.now() + expireHours * 60 * 60 * 1000 : 0;
      await createBroadcast({
        title: title.trim(),
        body: body.trim(),
        severity,
        audience,
        expiresAt,
        createdByUid: adminUid,
      });
      await onDone(`✓ Đã đẩy broadcast "${title}"`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <header className="modal-head">
          <h2>＋ Soạn broadcast</h2>
          <button className="mini" onClick={onClose} disabled={busy}>×</button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="form-label">
            <span>Title (tiêu đề ngắn)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd: Bảo trì máy chủ 22:00 tối nay"
              maxLength={120}
              required
              disabled={busy}
              autoFocus
            />
          </label>
          <label className="form-label">
            <span>Body (nội dung — markdown light)</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Chi tiết thông báo. Có thể dùng **bold**, *italic*, [link](url)."
              rows={6}
              maxLength={2000}
              required
              disabled={busy}
            />
          </label>
          <div className="form-row">
            <label className="form-label">
              <span>Mức độ</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BroadcastSeverity)}
                disabled={busy}
              >
                {(Object.keys(SEVERITY_LABEL) as BroadcastSeverity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span>Đối tượng</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
                disabled={busy}
              >
                {(Object.keys(AUDIENCE_LABEL) as BroadcastAudience[]).map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              <span>Hết hạn (giờ — 0 = không hết)</span>
              <input
                type="number"
                min={0}
                max={720}
                value={expireHours}
                onChange={(e) => setExpireHours(parseInt(e.target.value, 10) || 0)}
                disabled={busy}
              />
            </label>
          </div>
          {error && <div className="error-banner">⚠ {error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? '⏳ Đang gửi…' : '📢 Gửi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
