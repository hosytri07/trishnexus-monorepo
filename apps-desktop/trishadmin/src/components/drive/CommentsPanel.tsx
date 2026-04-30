/**
 * CommentsPanel — Phase 26.5.D.2
 *
 * Admin xem all comments cross-files + stats per file.
 */

import { useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth } from '@trishteam/auth';
import {
  MessageSquare, RefreshCw, AlertCircle, Loader2, Star,
  FileQuestion, User as UserIcon, Filter,
} from 'lucide-react';

const SHARE_API_BASE = 'https://trishteam.io.vn';

interface AdminComment {
  id: string;
  file_token: string;
  file_name: string;
  user_uid: string;
  user_email: string | null;
  user_name: string | null;
  text: string;
  rating: number | null;
  created_at: number;
}

interface FileStat {
  file_token: string;
  file_name: string;
  count: number;
  avg_rating: number | null;
}

export function CommentsPanel(): JSX.Element {
  const [items, setItems] = useState<AdminComment[]>([]);
  const [stats, setStats] = useState<FileStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filterToken, setFilterToken] = useState<string>('');

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Cần login admin');
      const token = await user.getIdToken();
      const res = await fetch(`${SHARE_API_BASE}/api/drive/library/comments-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { items: AdminComment[]; stats: FileStat[] };
      setItems(data.items || []);
      setStats((data.stats || []).sort((a, b) => b.count - a.count));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!filterToken) return items;
    return items.filter(c => c.file_token === filterToken);
  }, [items, filterToken]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Bình luận từ user
            </h2>
            <p className="card-subtitle">
              Feedback per-file để biết file nào hữu ích · {items.length} comments · {stats.length} files
            </p>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>

        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}

        {/* File stats */}
        {stats.length > 0 && (
          <div className="mt-3" style={{ overflowX: 'auto' }}>
            <div className="flex gap-2" style={{ flexWrap: 'nowrap' }}>
              <button
                onClick={() => setFilterToken('')}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 500,
                  background: !filterToken ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
                  color: !filterToken ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid ' + (!filterToken ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
                  borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                <Filter className="h-3 w-3" style={{ display: 'inline', marginRight: 4 }} />
                Tất cả ({items.length})
              </button>
              {stats.slice(0, 10).map(s => (
                <button
                  key={s.file_token}
                  onClick={() => setFilterToken(s.file_token)}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    background: filterToken === s.file_token ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
                    color: filterToken === s.file_token ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                    border: '1px solid ' + (filterToken === s.file_token ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'),
                    borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                  title={`${s.count} comments${s.avg_rating ? ` · ${s.avg_rating.toFixed(1)}★` : ''}`}
                >
                  {s.file_name.length > 30 ? s.file_name.slice(0, 30) + '…' : s.file_name}
                  {' '}({s.count})
                  {s.avg_rating !== null && (
                    <span style={{ marginLeft: 4, color: 'var(--semantic-warning)' }}>
                      ★{s.avg_rating.toFixed(1)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
            <FileQuestion className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
              Chưa có bình luận
            </div>
          </div>
        ) : (
          <div className="space-y-2 mt-4">
            {filtered.map(c => <CommentCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentCard({ c }: { c: AdminComment }): JSX.Element {
  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-accent-gradient)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
        }}>
          {(c.user_name || c.user_email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            <UserIcon className="h-3 w-3" style={{ display: 'inline', marginRight: 4, color: 'var(--color-text-muted)' }} />
            {c.user_name || c.user_email || c.user_uid.slice(0, 8)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
            {c.file_name || c.file_token.slice(0, 8)} · {formatDate(c.created_at)}
          </div>
        </div>
        {c.rating !== null && c.rating > 0 && (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star
                key={s}
                className="h-3.5 w-3.5"
                style={{
                  fill: s <= c.rating! ? 'var(--semantic-warning)' : 'transparent',
                  color: s <= c.rating! ? 'var(--semantic-warning)' : 'var(--color-text-muted)',
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, paddingLeft: 36 }}>
        {c.text}
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
