/**
 * /blog — Blog index (Phase 19.2).
 *
 * Server component fetch posts published từ Firestore qua `lib/blog.ts`.
 * Layout:
 *   - Header: title + tagline + tag filter chips (top tags)
 *   - Feature post: bài mới nhất (variant 'feature')
 *   - Grid: các bài còn lại (3 cột desktop / 2 cột tablet / 1 cột mobile)
 *   - Empty state: nếu chưa có bài thì hiện hint cho admin
 *
 * ISR: revalidate 60s — admin publish bài xong tối đa 1 phút sau là live.
 */
import Link from 'next/link';
import { ArrowLeft, Newspaper, Tag } from 'lucide-react';
import { listPublishedPosts, getAllTags } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';

export const revalidate = 60;

export const metadata = {
  title: 'Blog — TrishTEAM',
  description: 'Bài viết về kỹ thuật cầu đường, hướng dẫn dùng app TrishTEAM, kinh nghiệm thi chứng chỉ.',
  openGraph: {
    title: 'Blog — TrishTEAM',
    description: 'Bài viết về kỹ thuật cầu đường, hướng dẫn dùng app TrishTEAM.',
  },
};

export default async function BlogPage() {
  const [posts, tags] = await Promise.all([listPublishedPosts(30), getAllTags()]);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} />
        Quay lại Dashboard
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="shrink-0 inline-flex items-center justify-center rounded-xl"
            style={{
              width: 56,
              height: 56,
              background: 'var(--color-accent-soft)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <Newspaper
              size={28}
              strokeWidth={1.75}
              style={{ color: 'var(--color-accent-primary)' }}
            />
          </div>
          <div>
            <h1
              className="text-3xl md:text-5xl font-bold mb-2 tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Blog · Tin tức · Kiến thức
            </h1>
            <p
              className="text-base md:text-lg max-w-2xl"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Bài viết về kỹ thuật cầu đường, hướng dẫn ecosystem TrishTEAM,
              kinh nghiệm thi lái xe và chứng chỉ XD.
            </p>
          </div>
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <span
              className="inline-flex items-center gap-1 text-xs uppercase font-bold tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Tag size={12} strokeWidth={2.5} />
              Chủ đề
            </span>
            {tags.slice(0, 8).map((t) => (
              <Link
                key={t.tag}
                href={`/blog/tag/${encodeURIComponent(t.tag)}`}
                className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-medium transition-colors hover:opacity-90"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {t.tag}
                <span
                  className="text-[10px] opacity-70"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t.count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Empty state */}
      {posts.length === 0 && <EmptyState />}

      {/* Featured post */}
      {featured && (
        <section className="mb-10">
          <div
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            ★ Bài nổi bật
          </div>
          <PostCard post={featured} variant="feature" />
        </section>
      )}

      {/* Grid của các bài còn lại */}
      {rest.length > 0 && (
        <section>
          <h2
            className="text-sm font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Bài viết mới nhất
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border p-10 text-center"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <Newspaper
        size={40}
        strokeWidth={1.5}
        className="mx-auto mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      />
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Chưa có bài viết nào
      </h2>
      <p
        className="text-sm mb-4 max-w-md mx-auto"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Admin sẽ post bài đầu tiên qua trang quản trị. Quay lại sau hoặc
        đăng ký nhận thông báo qua email khi có bài mới.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'var(--color-accent-gradient)',
          color: '#ffffff',
        }}
      >
        Về Dashboard
      </Link>
    </div>
  );
}
