'use client';

/**
 * /admin/posts — Phase 19.14 — Quản lý bài blog (web admin).
 *
 * Liệt kê posts từ Firestore /posts/{id}, cho phép:
 *   - Tạo post mới (markdown editor + Cloudinary hero upload)
 *   - Edit existing
 *   - Toggle Publish/Unpublish
 *   - Delete với confirm
 *
 * Schema khớp TrishAdmin desktop PostsPanel:
 *   { id, slug, title, body_md, excerpt?, hero_url?, hero_cloudinary_id?,
 *     tags?[], status, publish_at?, created_at, updated_at, author_uid }
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FilePlus,
  Loader2,
  Newspaper,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { marked } from 'marked';
import { db, firebaseReady } from '@/lib/firebase';
import { useConfirm } from '@/components/confirm-modal';
import { useAuth } from '@/lib/auth-context';
import { CloudinaryUploader } from '@/components/cloudinary-uploader';
import { CloudinaryImage } from '@/components/cloudinary-image';
import { buildImageUrl } from '@/lib/cloudinary';

interface Post {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  excerpt?: string;
  hero_url?: string;
  hero_cloudinary_id?: string;
  tags?: string[];
  status: 'draft' | 'published';
  publish_at?: number;
  created_at: number;
  updated_at: number;
  author_uid: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function AdminPostsPage() {
  const { user } = useAuth();
  const [ConfirmDialog, askConfirm] = useConfirm();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseReady || !db) return;
    const q = query(collection(db, 'posts'), orderBy('updated_at', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(
          snap.docs.map((d) => {
            const r = d.data();
            return {
              id: d.id,
              slug: (r.slug as string) ?? d.id,
              title: (r.title as string) ?? 'Untitled',
              body_md: (r.body_md as string) ?? '',
              excerpt: r.excerpt as string | undefined,
              hero_url: r.hero_url as string | undefined,
              hero_cloudinary_id: r.hero_cloudinary_id as string | undefined,
              tags: (r.tags as string[]) ?? [],
              status: (r.status as 'draft' | 'published') ?? 'draft',
              publish_at: r.publish_at as number | undefined,
              created_at: (r.created_at as number) ?? 0,
              updated_at: (r.updated_at as number) ?? 0,
              author_uid: (r.author_uid as string) ?? '',
            };
          }),
        );
      },
      (err) => {
        console.warn('[admin/posts] subscribe fail', err);
        setPosts([]);
      },
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (posts ?? []).filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.body_md.toLowerCase().includes(q) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [posts, filter, search]);

  function showMsg(m: string) {
    setActionMsg(m);
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function togglePublish(p: Post) {
    if (!firebaseReady || !db) return;
    const newStatus = p.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'posts', p.id), {
      status: newStatus,
      publish_at:
        newStatus === 'published' && !p.publish_at ? Date.now() : p.publish_at,
      updated_at: Date.now(),
      _server_updated_at: serverTimestamp(),
    });
    showMsg(`✓ ${newStatus === 'published' ? 'Published' : 'Unpublished'}: ${p.title}`);
  }

  async function deletePost(p: Post) {
    if (!firebaseReady || !db) return;
    if (!window.confirm(`Xoá bài "${p.title}"? Không thể khôi phục.`)) return;
    await deleteDoc(doc(db, 'posts', p.id));
    showMsg(`✓ Đã xoá ${p.title}`);
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <ConfirmDialog />
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} /> Admin Dashboard
      </Link>

      <header className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Newspaper size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Quản lý Blog
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {posts?.length ?? 0} bài · {posts?.filter((p) => p.status === 'published').length ?? 0} đã xuất bản
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-md text-sm font-semibold"
          style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
        >
          <FilePlus size={14} /> Bài mới
        </button>
      </header>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`Tất cả (${posts?.length ?? 0})`} />
        <FilterChip
          active={filter === 'published'}
          onClick={() => setFilter('published')}
          label={`Published (${posts?.filter((p) => p.status === 'published').length ?? 0})`}
        />
        <FilterChip
          active={filter === 'draft'}
          onClick={() => setFilter('draft')}
          label={`Draft (${posts?.filter((p) => p.status === 'draft').length ?? 0})`}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo title, body, tags..."
          className="flex-1 min-w-[200px] h-8 px-3 rounded-md text-sm outline-none border"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {actionMsg && (
        <div
          className="mb-4 px-3 py-2 rounded text-sm"
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent-primary)',
            border: '1px solid var(--color-accent-primary)',
          }}
        >
          {actionMsg}
        </div>
      )}

      {/* Posts list */}
      {posts === null ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          Đang tải…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--color-surface-card)', borderColor: 'var(--color-border-default)' }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Không có bài nào khớp filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              onEdit={() => setEditing(p)}
              onTogglePublish={() => togglePublish(p)}
              onDelete={() => deletePost(p)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && user && (
        <PostEditor
          post={editing === 'new' ? null : editing}
          authorUid={user.id}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            showMsg(msg);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 h-7 rounded-full text-xs font-semibold transition-all"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-bg_elevated)',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
        border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'}`,
      }}
    >
      {label}
    </button>
  );
}

function PostRow({
  post,
  onEdit,
  onTogglePublish,
  onDelete,
}: {
  post: Post;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className="rounded-lg border p-4 flex items-start gap-3"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
        borderLeftWidth: 3,
        borderLeftColor: post.status === 'published' ? '#10B981' : '#F59E0B',
      }}
    >
      {/* Hero thumb */}
      {(post.hero_cloudinary_id || post.hero_url) && (
        <div className="shrink-0 w-20 h-20 rounded overflow-hidden" style={{ background: 'var(--color-surface-bg_elevated)' }}>
          {post.hero_cloudinary_id ? (
            <CloudinaryImage
              publicId={post.hero_cloudinary_id}
              preset="bridge-card"
              alt={post.title}
              className="w-full h-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.hero_url} alt={post.title} className="w-full h-full object-cover" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="inline-flex items-center px-1.5 h-4 rounded text-[10px] font-bold uppercase"
            style={{
              background: post.status === 'published' ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)',
              color: post.status === 'published' ? '#10B981' : '#F59E0B',
            }}
          >
            {post.status}
          </span>
          {post.tags?.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 h-4 rounded inline-flex items-center"
              style={{ background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}
            >
              {t}
            </span>
          ))}
        </div>
        <h3 className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-xs line-clamp-2 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="inline-flex items-center gap-1">
            <Calendar size={10} />
            {new Date(post.publish_at ?? post.created_at).toLocaleDateString('vi-VN')}
          </span>
          <span>·</span>
          <code style={{ opacity: 0.7 }}>/{post.slug}</code>
        </div>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)' }}
        >
          <Pencil size={11} /> Sửa
        </button>
        <button
          type="button"
          onClick={onTogglePublish}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold"
          style={{
            background: post.status === 'published' ? 'rgba(245,158,11,0.14)' : 'rgba(16,185,129,0.14)',
            color: post.status === 'published' ? '#F59E0B' : '#10B981',
          }}
        >
          {post.status === 'published' ? <EyeOff size={11} /> : <Eye size={11} />}
          {post.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
        >
          <Trash2 size={11} /> Xoá
        </button>
      </div>
    </article>
  );
}

function PostEditor({
  post,
  authorUid,
  onClose,
  onSaved,
}: {
  post: Post | null;
  authorUid: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body_md ?? '# Tiêu đề\n\nNội dung...');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [tags, setTags] = useState((post?.tags ?? []).join(', '));
  const [heroId, setHeroId] = useState<string | undefined>(post?.hero_cloudinary_id);
  const [status, setStatus] = useState<'draft' | 'published'>(post?.status ?? 'draft');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const renderedHtml = useMemo(() => {
    try {
      const result = marked.parse(body, { async: false });
      return typeof result === 'string' ? result : '';
    } catch (err) {
      console.warn('[marked] parse fail', err);
      return '';
    }
  }, [body]);

  async function handleSave() {
    if (!firebaseReady || !db) return;
    if (!title.trim()) {
      alert('Tiêu đề không được trống');
      return;
    }
    setBusy(true);
    try {
      // Phase 19.22 — Doc ID = sequence từ 01, 02, 03... (atomic counter trong Firestore).
      // URL /blog/01, /blog/02 — ngắn gọn, dễ nhớ.
      let id = post?.id;
      if (!id) {
        const counterRef = doc(db, '_meta', 'posts_counter');
        const newNum = await runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const current = snap.exists() ? Number(snap.data()?.value ?? 0) : 0;
          const next = current + 1;
          tx.set(
            counterRef,
            { value: next, updated_at: Date.now() },
            { merge: true },
          );
          return next;
        });
        // Pad 2 digit (01, 02...). Sau 100 thì tự dài 3+ digit.
        id = newNum < 100 ? newNum.toString().padStart(2, '0') : newNum.toString();
      }
      const slug = post?.slug ?? slugify(title);
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const now = Date.now();
      const data: Record<string, unknown> = {
        slug,
        title: title.trim(),
        body_md: body,
        status,
        updated_at: now,
        author_uid: authorUid,
        _server_updated_at: serverTimestamp(),
      };
      if (excerpt.trim()) data.excerpt = excerpt.trim();
      else if (post) data.excerpt = null;
      if (heroId) {
        data.hero_cloudinary_id = heroId;
        data.hero_url = buildImageUrl(heroId, 'post-hero');
      }
      if (tagList.length > 0) data.tags = tagList;
      if (!post) {
        data.created_at = now;
        data._server_created_at = serverTimestamp();
      }
      if (status === 'published' && !post?.publish_at) {
        data.publish_at = now;
      }
      await setDoc(doc(db, 'posts', id), data, { merge: true });
      onSaved(`✓ Đã lưu "${title}"`);
    } catch (err) {
      alert('Lỗi: ' + (err instanceof Error ? err.message : err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-4xl w-full rounded-xl border p-5 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
          aria-label="Đóng"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={16} />
        </button>

        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          {post ? 'Sửa bài' : 'Bài mới'}
        </h2>

        <div className="space-y-3">
          <Field label="Tiêu đề *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-md outline-none border text-base"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <Field label="Tóm tắt (excerpt)">
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={200}
              placeholder="1-2 câu mô tả ngắn..."
              className="w-full h-10 px-3 rounded-md outline-none border text-sm"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Tags (CSV)">
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="kỹ thuật, hướng dẫn, cầu đường"
                className="w-full h-10 px-3 rounded-md outline-none border text-sm"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </Field>

            <Field label="Status">
              <div className="inline-flex p-0.5 rounded-md" style={{ background: 'var(--color-surface-bg_elevated)' }}>
                <StatusButton active={status === 'draft'} onClick={() => setStatus('draft')} label="Draft" color="#F59E0B" />
                <StatusButton active={status === 'published'} onClick={() => setStatus('published')} label="Published" color="#10B981" />
              </div>
            </Field>
          </div>

          <Field label="Hero image (1200×630)">
            <div className="flex items-center gap-3">
              {heroId && (
                <div className="w-32 h-20 rounded overflow-hidden border" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <CloudinaryImage publicId={heroId} preset="bridge-card" alt="Hero" className="w-full h-full object-cover" />
                </div>
              )}
              <CloudinaryUploader
                folder="post"
                onUpload={(r) => setHeroId(r.publicId)}
                maxSizeMB={10}
              >
                <span
                  className="inline-flex items-center gap-2 px-3 h-9 rounded text-xs font-semibold cursor-pointer"
                  style={{
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-primary)',
                    border: '1px solid var(--color-accent-primary)',
                  }}
                >
                  <Upload size={12} />
                  {heroId ? 'Đổi ảnh' : 'Upload hero'}
                </span>
              </CloudinaryUploader>
              {heroId && (
                <button
                  type="button"
                  onClick={() => setHeroId(undefined)}
                  className="text-xs"
                  style={{ color: '#EF4444' }}
                >
                  Xoá
                </button>
              )}
            </div>
          </Field>

          <Field label="Body (Markdown)">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowPreview((s) => !s)}
                className="text-xs inline-flex items-center gap-1 px-2 h-7 rounded font-semibold"
                style={{ background: 'var(--color-surface-bg_elevated)', color: 'var(--color-text-muted)' }}
              >
                <Eye size={11} />
                {showPreview ? 'Ẩn preview' : 'Xem preview'}
              </button>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Hỗ trợ {'{{youtube:ID}}'}, {'{{vimeo:ID}}'} cho video embed
              </span>
            </div>
            <div className={showPreview ? 'grid grid-cols-2 gap-2' : ''}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full p-3 rounded-md outline-none border text-sm font-mono"
                style={{
                  background: 'var(--color-surface-bg_elevated)',
                  borderColor: 'var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {showPreview && (
                <div
                  className="p-3 rounded-md border blog-prose overflow-y-auto"
                  style={{
                    background: 'var(--color-surface-bg_elevated)',
                    borderColor: 'var(--color-border-default)',
                    maxHeight: 400,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              )}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 rounded-md text-sm font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 h-10 rounded-md text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--color-accent-gradient)', color: '#ffffff' }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-semibold mb-1 inline-block"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function StatusButton({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center px-3 h-9 rounded text-xs font-semibold transition-colors"
      style={{
        background: active ? color + '22' : 'transparent',
        color: active ? color : 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  );
}
