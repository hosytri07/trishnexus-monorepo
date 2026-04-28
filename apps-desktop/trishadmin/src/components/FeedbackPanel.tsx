/**
 * Phase 18.8.a — Feedback inbox.
 *
 * List feedback/{id}, filter by status + category, mark resolved + admin note.
 * User app gửi feedback → Firestore. Admin xem + xử lý ở đây.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type Feedback,
  deleteFeedback,
  formatRelative,
  formatTimestamp,
  listFeedback,
  setFeedbackStatus,
} from '../lib/firestore-admin.js';
import { applyMask, maskEmail, maskName, maskUid } from '../lib/mask.js';
import { useReveal } from '../lib/use-reveal.js';
import { RevealToggle } from './RevealToggle.js';

const STATUS_LABEL: Record<Feedback['status'], string> = {
  new: '🆕 Mới',
  read: '👁 Đã xem',
  in_progress: '⏳ Đang xử lý',
  resolved: '✅ Đã xử lý',
  wontfix: '🚫 Không sửa',
};

const CATEGORY_LABEL: Record<Feedback['category'], string> = {
  bug: '🐛 Bug',
  feature: '✨ Feature',
  question: '❓ Câu hỏi',
  praise: '👍 Khen',
  other: '📝 Khác',
};

export function FeedbackPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Feedback['status'] | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Feedback['category'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Feedback | null>(null);
  const reveal = useReveal(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listFeedback(300);
      setFeedback(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return feedback.filter((f) => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (f.message ?? '').toLowerCase().includes(q) ||
        (f.email ?? '').toLowerCase().includes(q) ||
        (f.app ?? '').toLowerCase().includes(q)
      );
    });
  }, [feedback, statusFilter, categoryFilter, search]);

  const counts = useMemo(() => {
    return {
      new: feedback.filter((f) => f.status === 'new').length,
      in_progress: feedback.filter((f) => f.status === 'in_progress').length,
      resolved: feedback.filter((f) => f.status === 'resolved').length,
      total: feedback.length,
    };
  }, [feedback]);

  async function handleSetStatus(
    f: Feedback,
    status: Feedback['status'],
    note?: string,
  ): Promise<void> {
    try {
      await setFeedbackStatus(f.id, status, adminUid, note);
      setActionMsg(`✓ Cập nhật "${STATUS_LABEL[status]}"`);
      await load();
      setEditing(null);
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(f: Feedback): Promise<void> {
    if (!window.confirm(`Xóa feedback từ ${f.email ?? f.uid}?`)) return;
    try {
      await deleteFeedback(f.id);
      setActionMsg(`✓ Đã xóa`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>Feedback inbox</h1>
          <p className="muted small">
            {counts.new > 0 && (
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                🆕 {counts.new} mới ·{' '}
              </span>
            )}
            {counts.in_progress} đang xử lý · {counts.resolved} đã xử lý ·{' '}
            {counts.total} tổng
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <RevealToggle
            revealed={reveal.revealAll}
            onToggle={reveal.toggleAll}
            variant="header"
            showLabel
            overrideCount={reveal.hasRowOverrides ? feedback.length : 0}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </header>

      <div className="filter-row">
        <input
          type="search"
          placeholder="🔍 Tìm message / email / app…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Feedback['status'] | 'all')}
          className="input"
        >
          <option value="all">Tất cả status</option>
          {(Object.keys(STATUS_LABEL) as Feedback['status'][]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as Feedback['category'] | 'all')
          }
          className="input"
        >
          <option value="all">Tất cả loại</option>
          {(Object.keys(CATEGORY_LABEL) as Feedback['category'][]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg}
        </div>
      )}

      <div className="feedback-list">
        {filtered.length === 0 ? (
          <div className="empty-state muted small">
            {loading ? 'Đang tải…' : 'Không có feedback nào.'}
          </div>
        ) : (
          filtered.map((f) => {
            const rowRevealed = reveal.isRevealed(f.id);
            const displayName = f.display_name ?? '(no name)';
            const emailText = f.email ?? '';
            return (
            <div
              key={f.id}
              className={`feedback-card status-${f.status} ${rowRevealed ? 'row-revealed' : 'row-masked'}`}
              onClick={() => {
                if (f.status === 'new') {
                  void handleSetStatus(f, 'read');
                }
                setEditing(f);
              }}
            >
              <header className="feedback-head">
                <div className="feedback-meta">
                  <span className={`status-badge status-${f.status}`}>
                    {STATUS_LABEL[f.status]}
                  </span>
                  <span className="audience-badge">{CATEGORY_LABEL[f.category]}</span>
                  <span className="audience-badge">📱 {f.app}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="muted small" title={formatTimestamp(f.created_at)}>
                    {formatRelative(f.created_at)}
                  </span>
                  <span onClick={(ev) => ev.stopPropagation()}>
                    <RevealToggle
                      revealed={rowRevealed}
                      onToggle={() => reveal.toggleRow(f.id)}
                      variant="inline"
                    />
                  </span>
                </div>
              </header>
              <div className="feedback-body">
                <p className="feedback-message">{f.message}</p>
                <p className="muted small feedback-author">
                  👤 {applyMask(displayName, rowRevealed, maskName)}
                  {emailText && (<> · {applyMask(emailText, rowRevealed, maskEmail)}</>)}
                  {f.app_version && ` · v${f.app_version}`}
                </p>
                {f.admin_note && (
                  <p className="feedback-admin-note">
                    <strong>📝 Admin:</strong> {f.admin_note}
                  </p>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      {editing && (
        <FeedbackDetailModal
          feedback={editing}
          onClose={() => setEditing(null)}
          onSetStatus={(status, note) => void handleSetStatus(editing, status, note)}
          onDelete={() => {
            void handleDelete(editing);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

interface DetailProps {
  feedback: Feedback;
  onClose: () => void;
  onSetStatus: (status: Feedback['status'], note?: string) => void;
  onDelete: () => void;
}

function FeedbackDetailModal({
  feedback,
  onClose,
  onSetStatus,
  onDelete,
}: DetailProps): JSX.Element {
  const [note, setNote] = useState(feedback.admin_note ?? '');
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <header className="modal-head">
          <h2>Feedback detail</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <RevealToggle
              revealed={revealed}
              onToggle={() => setRevealed((v) => !v)}
              variant="inline"
              showLabel
            />
            <button className="mini" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="modal-body">
          <div className="feedback-meta" style={{ marginBottom: 12 }}>
            <span className={`status-badge status-${feedback.status}`}>
              {STATUS_LABEL[feedback.status]}
            </span>
            <span className="audience-badge">{CATEGORY_LABEL[feedback.category]}</span>
            <span className="audience-badge">📱 {feedback.app}</span>
            {feedback.app_version && (
              <span className="audience-badge">v{feedback.app_version}</span>
            )}
          </div>

          <p className="muted small">
            👤 {applyMask(feedback.display_name ?? '—', revealed, maskName)} ·{' '}
            {feedback.email ? (
              <code>{applyMask(feedback.email, revealed, maskEmail)}</code>
            ) : (
              <em>(no email)</em>
            )}{' '}
            ·{' '}
            <code>
              {applyMask(feedback.uid?.slice(0, 12) ?? '', revealed, maskUid)}
              {revealed ? '…' : ''}
            </code>
          </p>
          <p className="muted small">
            Tạo {formatTimestamp(feedback.created_at)} · {formatRelative(feedback.created_at)}
          </p>

          <h3 style={{ marginTop: 16, fontSize: 14 }}>Nội dung</h3>
          <pre className="feedback-raw">{feedback.message}</pre>

          <label className="form-label" style={{ marginTop: 16 }}>
            <span>Ghi chú admin (lưu chung với feedback)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Vd: Đã reply qua email · Sửa trong v3.1 · ..."
              maxLength={500}
            />
          </label>

          <h3 style={{ marginTop: 16, fontSize: 14 }}>Đổi status</h3>
          <div className="settings-pills" style={{ marginBottom: 12 }}>
            {(Object.keys(STATUS_LABEL) as Feedback['status'][]).map((s) => (
              <button
                key={s}
                type="button"
                className={`settings-pill ${feedback.status === s ? 'active' : ''}`}
                onClick={() => onSetStatus(s, note.trim() || undefined)}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost btn-danger" onClick={onDelete}>
              🗑 Xóa
            </button>
            {feedback.email && (
              <a
                href={`mailto:${feedback.email}?subject=Re:%20${encodeURIComponent(
                  CATEGORY_LABEL[feedback.category],
                )}%20-%20TrishTEAM`}
                className="btn btn-primary"
              >
                ✉ Reply qua email
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
