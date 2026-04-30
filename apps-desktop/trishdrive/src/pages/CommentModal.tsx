/**
 * CommentModal — Phase 26.5.D
 *
 * User post comment + rating (1-5 stars) per-file, admin biết file nào hữu ích.
 * GET list comments có sẵn + POST comment mới.
 */

import { useEffect, useState } from 'react';
import { getFirebaseAuth } from '@trishteam/auth';
import {
  X, Send, Star, AlertCircle, Loader2, MessageSquare, User as UserIcon,
} from 'lucide-react';

const SHARE_API_BASE = 'https://trishteam.io.vn';

interface Comment {
  id: string;
  file_token: string;
  user_uid: string;
  user_email: string | null;
  user_name: string | null;
  text: string;
  rating: number | null;
  created_at: number;
}

interface CommentsResponse {
  items: Comment[];
  count: number;
  avg_rating: number | null;
  rating_count: number;
}

export function CommentModal({
  fileToken, fileName, onClose,
}: {
  fileToken: string;
  fileName: string;
  onClose: () => void;
}): JSX.Element {
  const [items, setItems] = useState<Comment[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [rating, setRating] = useState<number>(0);
  const [posting, setPosting] = useState(false);

  useEffect(() => { void load(); }, [fileToken]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần đăng nhập');
      const token = await user.getIdToken();
      const res = await fetch(
        `${SHARE_API_BASE}/api/drive/library/comments?file_token=${encodeURIComponent(fileToken)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CommentsResponse;
      setItems(data.items || []);
      setAvgRating(data.avg_rating);
      setRatingCount(data.rating_count);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function postComment() {
    if (!text.trim()) {
      setErr('Nhập nội dung comment');
      return;
    }
    setPosting(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần đăng nhập');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/comment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_token: fileToken,
          text: text.trim(),
          rating: rating > 0 ? rating : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setText('');
      setRating(0);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--color-surface-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card" style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="card-title flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Bình luận
            </h2>
            <p className="card-subtitle" style={{ marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>
              {fileName}
            </p>
            {avgRating !== null && (
              <div className="flex items-center gap-2 mt-2">
                <RatingStars value={avgRating} readOnly />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {avgRating.toFixed(1)}/5 · {ratingCount} đánh giá · {items.length} bình luận
                </span>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {/* Form post comment */}
        <div className="p-3 mt-4 rounded-xl" style={{ background: 'var(--color-surface-row)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Đánh giá file này
          </div>
          <RatingStars value={rating} onChange={setRating} />
          <textarea
            className="input-field mt-2"
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="Nội dung file thế nào? File hữu ích cho công việc gì?"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={2000}
            disabled={posting}
          />
          <div className="flex justify-end mt-2">
            <button
              className="btn-primary"
              onClick={postComment}
              disabled={posting || !text.trim()}
              style={{ fontSize: 12 }}
            >
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {posting ? 'Đang gửi...' : 'Gửi bình luận'}
            </button>
          </div>
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {/* List comments */}
        <div className="mt-4">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            {items.length === 0 ? 'Chưa có bình luận' : `${items.length} bình luận gần đây`}
          </div>
          {loading ? (
            <div className="text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
              <Loader2 className="h-6 w-6 mx-auto animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-6" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
              Bạn là người đầu tiên bình luận file này
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(c => <CommentCard key={c.id} comment={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RatingStars({
  value, onChange, readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}): JSX.Element {
  const [hover, setHover] = useState<number>(0);
  const display = hover || value;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={readOnly ? undefined : () => onChange?.(s)}
          onMouseEnter={readOnly ? undefined : () => setHover(s)}
          onMouseLeave={readOnly ? undefined : () => setHover(0)}
          style={{
            background: 'transparent', border: 'none',
            cursor: readOnly ? 'default' : 'pointer', padding: 2,
          }}
        >
          <Star
            className="h-5 w-5"
            style={{
              fill: s <= display ? 'var(--semantic-warning)' : 'transparent',
              color: s <= display ? 'var(--semantic-warning)' : 'var(--color-text-muted)',
            }}
          />
        </button>
      ))}
    </div>
  );
}

function CommentCard({ comment }: { comment: Comment }): JSX.Element {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center gap-2 mb-2">
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-accent-gradient)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
        }}>
          {(comment.user_name || comment.user_email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserIcon className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
            {comment.user_name || comment.user_email || comment.user_uid.slice(0, 8)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{formatDate(comment.created_at)}</div>
        </div>
        {comment.rating !== null && comment.rating > 0 && (
          <RatingStars value={comment.rating} readOnly />
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingLeft: 36 }}>
        {comment.text}
      </div>
    </div>
  );
}

function formatDate(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString('vi-VN');
}
