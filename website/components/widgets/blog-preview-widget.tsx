/**
 * BlogPreviewWidget — Phase 19.22.
 *
 * Server component fetch 5 bài blog mới nhất (published). Hiển thị
 * list title + ngày đăng + tag. Click → navigate /blog/[id].
 *
 * Empty state: nếu chưa có bài, hiện CTA "Vào /admin/posts để post bài đầu tiên".
 */
import Link from 'next/link';
import { ArrowRight, Calendar, Newspaper } from 'lucide-react';
import { listPublishedPosts, formatPublishDate } from '@/lib/blog';

const PREVIEW_LIMIT = 5;

export async function BlogPreviewWidget() {
  const posts = await listPublishedPosts(PREVIEW_LIMIT);

  return (
    <section
      className="rounded-xl border p-5 md:p-6"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper size={18} strokeWidth={2} style={{ color: 'var(--color-accent-primary)' }} />
          <h2
            className="text-base md:text-lg font-bold truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Blog · Tin tức · Kiến thức
          </h2>
        </div>
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80 shrink-0"
          style={{ color: 'var(--color-accent-primary)' }}
        >
          Xem tất cả
          <ArrowRight size={12} strokeWidth={2.25} />
        </Link>
      </header>

      {posts.length === 0 ? (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <p className="mb-2">Chưa có bài viết nào.</p>
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            Vào trang quản trị viết bài đầu tiên
            <ArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                href={`/blog/${post.id}`}
                className="flex items-start gap-3 py-3 transition-colors hover:bg-[var(--color-surface-muted)] -mx-3 px-3 rounded"
              >
                <div
                  className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded font-mono text-xs font-bold"
                  style={{
                    background: 'var(--color-accent-soft)',
                    color: 'var(--color-accent-primary)',
                  }}
                >
                  {post.id}
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-semibold line-clamp-1"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {post.title}
                  </h3>
                  <div
                    className="flex items-center gap-2 text-[11px] mt-0.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <Calendar size={10} strokeWidth={2} />
                    {formatPublishDate(post.publish_at ?? post.created_at)}
                    {post.tags && post.tags.length > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="truncate">
                          {post.tags.slice(0, 3).join(' · ')}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  strokeWidth={2}
                  style={{ color: 'var(--color-text-muted)' }}
                  className="shrink-0 mt-2 opacity-50"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
