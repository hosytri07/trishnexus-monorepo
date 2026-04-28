/**
 * Phase 18.8.a — Posts/News editor.
 *
 * CRUD posts/{id}. Blog/changelog public website. Khác Broadcasts (banner trong app).
 * Markdown body source. Slug tự generate từ title.
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  type Post,
  createPost,
  deletePost,
  formatRelative,
  formatTimestamp,
  listPosts,
  updatePost,
} from '../lib/firestore-admin.js';

const STATUS_LABEL: Record<Post['status'], string> = {
  draft: '📝 Draft',
  published: '🌐 Published',
};

export function PostsPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Post['status'] | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listPosts(200);
      setPosts(list);
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
    return posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.body_md ?? '').toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, statusFilter, search]);

  async function handleSave(input: SaveInput | null): Promise<void> {
    if (!input) {
      setEditing(null);
      return;
    }
    try {
      if (editing && editing !== 'new') {
        await updatePost(editing.id, {
          title: input.title,
          body_md: input.body_md,
          excerpt: input.excerpt,
          hero_url: input.hero_url,
          tags: input.tags,
          status: input.status,
        });
        setActionMsg(`✓ Cập nhật "${input.title}"`);
      } else {
        await createPost({ ...input, authorUid: adminUid });
        setActionMsg(`✓ Tạo post "${input.title}"`);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(p: Post): Promise<void> {
    if (!window.confirm(`Xóa post "${p.title}"? Không thể khôi phục.`)) return;
    try {
      await deletePost(p.id);
      setActionMsg(`✓ Xóa "${p.title}"`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleTogglePublish(p: Post): Promise<void> {
    const next: Post['status'] = p.status === 'published' ? 'draft' : 'published';
    try {
      await updatePost(p.id, { status: next });
      setActionMsg(`✓ ${p.title} → ${STATUS_LABEL[next]}`);
      await load();
    } catch (err) {
      setActionMsg(`⚠ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>Posts / News</h1>
          <p className="muted small">
            Blog/changelog public trên website ({posts.length} post · {' '}
            {posts.filter((p) => p.status === 'published').length} published).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? '⏳' : '🔄'} Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            ＋ Soạn post
          </button>
        </div>
      </header>

      <div className="filter-row">
        <input
          type="search"
          placeholder="🔍 Tìm title / body / tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Post['status'] | 'all')}
          className="input"
        >
          <option value="all">Tất cả status</option>
          <option value="draft">📝 Draft</option>
          <option value="published">🌐 Published</option>
        </select>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
      {actionMsg && (
        <div className="info-banner" onClick={() => setActionMsg(null)}>
          {actionMsg}
        </div>
      )}

      <div className="post-list">
        {filtered.length === 0 ? (
          <div className="empty-state muted small">
            {loading ? 'Đang tải…' : 'Chưa có post.'}
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className={`post-card status-${p.status}`}>
              <header className="post-card-head">
                <div className="post-meta">
                  <span className={`status-badge status-${p.status}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  {p.tags?.map((t) => (
                    <span key={t} className="audience-badge">
                      #{t}
                    </span>
                  ))}
                </div>
                <span className="muted small" title={formatTimestamp(p.updated_at)}>
                  {formatRelative(p.updated_at)}
                </span>
              </header>
              <h3 className="post-title">{p.title}</h3>
              {p.excerpt && <p className="post-excerpt muted">{p.excerpt}</p>}
              <p className="muted small post-slug">
                <code>/{p.slug}</code>
                {p.publish_at && (
                  <> · 🌐 publish {formatRelative(p.publish_at)}</>
                )}
              </p>
              <div className="row-actions" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setEditing(p)}
                >
                  ✏ Sửa
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => void handleTogglePublish(p)}
                >
                  {p.status === 'published' ? '📝 Unpublish' : '🌐 Publish'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost btn-danger"
                  onClick={() => void handleDelete(p)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <PostEditorModal
          initial={editing === 'new' ? null : editing}
          onClose={(input) => void handleSave(input)}
        />
      )}
    </div>
  );
}

interface SaveInput {
  title: string;
  body_md: string;
  excerpt?: string;
  hero_url?: string;
  tags?: string[];
  status: Post['status'];
}

interface ModalProps {
  initial: Post | null;
  onClose: (input: SaveInput | null) => void;
}

function PostEditorModal({ initial, onClose }: ModalProps): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body_md, setBody] = useState(initial?.body_md ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [heroUrl, setHeroUrl] = useState(initial?.hero_url ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(', '));
  const [status, setStatus] = useState<Post['status']>(initial?.status ?? 'draft');

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!title.trim() || !body_md.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onClose({
      title: title.trim(),
      body_md: body_md,
      excerpt: excerpt.trim() || undefined,
      hero_url: heroUrl.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      status,
    });
  }

  return (
    <div className="modal-backdrop" onClick={() => onClose(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <header className="modal-head">
          <h2>{initial ? 'Sửa post' : '＋ Soạn post'}</h2>
          <button className="mini" onClick={() => onClose(null)}>×</button>
        </header>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="form-label">
            <span>Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              autoFocus
            />
          </label>
          <label className="form-label">
            <span>Excerpt (mô tả ngắn — hiện ở list page)</span>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={300}
            />
          </label>
          <label className="form-label">
            <span>Body (Markdown)</span>
            <textarea
              value={body_md}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              required
              placeholder="# Heading\n\nĐoạn văn... **bold** *italic* [link](url)\n\n- bullet 1\n- bullet 2"
              style={{ fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: 13 }}
            />
          </label>
          <div className="form-row" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
            <label className="form-label">
              <span>Hero image URL (tuỳ chọn)</span>
              <input
                type="url"
                value={heroUrl}
                onChange={(e) => setHeroUrl(e.target.value)}
                placeholder="https://..."
                maxLength={500}
              />
            </label>
            <label className="form-label">
              <span>Tags (cách bằng dấu phẩy)</span>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="release, v3, library"
              />
            </label>
            <label className="form-label">
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Post['status'])}
              >
                <option value="draft">📝 Draft</option>
                <option value="published">🌐 Published</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => onClose(null)}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || !body_md.trim()}
            >
              {initial ? '💾 Lưu' : '＋ Tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
