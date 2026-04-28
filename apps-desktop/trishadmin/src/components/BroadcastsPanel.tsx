/**
 * Phase 18.7.a — Broadcasts (notifications) panel.
 *
 * Compose announcement → Firestore `announcements/{id}`.
 * User app subscribe collection này → hiện banner trong N giờ.
 */

import { useEffect, useState } from 'react';
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

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>📢 Broadcasts</h1>
          <p className="muted small">
            Push thông báo tới user app. Lưu vào Firestore <code>announcements/</code>.
            User app subscribe collection này.
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
          broadcasts.map((b) => (
            <div
              key={b.id}
              className={`broadcast-card severity-${b.severity} ${b.active ? '' : 'inactive'}`}
            >
              <header>
                <div className="broadcast-meta">
                  <span className={`severity-badge severity-${b.severity}`}>
                    {SEVERITY_LABEL[b.severity]}
                  </span>
                  <span className="audience-badge">{AUDIENCE_LABEL[b.audience]}</span>
                  {!b.active && <span className="muted small">⏸ Tắt</span>}
                </div>
                <div className="row-actions">
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
          ))
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
