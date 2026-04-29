/**
 * /blog/[slug] — Blog post detail (Phase 19.2).
 *
 * Server component fetch 1 post theo slug. 404 nếu không tìm thấy hoặc draft.
 *
 * Layout:
 *   - Reading progress bar fixed top
 *   - Header: title + meta (date + reading time + tags)
 *   - Hero image (nếu có)
 *   - Body markdown rendered qua MarkdownContent
 *   - Footer: tag list + back link + related posts (cùng tag)
 *
 * SEO:
 *   - generateMetadata sinh OG image + meta theo post
 *   - canonical URL
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Tag } from 'lucide-react';
import {
  getPostById,
  listPublishedPosts,
  formatPublishDate,
  readingTime,
} from '@/lib/blog';
import { MarkdownContent } from '@/components/blog/MarkdownContent';
import { PostCard } from '@/components/blog/PostCard';

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  // Phase 19.22 — params.slug giờ chứa ID 13-digit (số). Fallback slug cho legacy.
  const post = await getPostById(params.slug);
  if (!post) {
    return { title: 'Không tìm thấy bài viết — TrishTEAM' };
  }
  const desc =
    post.excerpt ?? post.body_md.slice(0, 160).replace(/\n+/g, ' ').trim();
  return {
    title: `${post.title} — TrishTEAM`,
    description: desc,
    openGraph: {
      title: post.title,
      description: desc,
      type: 'article',
      publishedTime: post.publish_at
        ? new Date(post.publish_at).toISOString()
        : undefined,
      images: post.hero_url ? [{ url: post.hero_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: desc,
      images: post.hero_url ? [post.hero_url] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const post = await getPostById(params.slug);
  if (!post) notFound();

  const minutes = readingTime(post.body_md);

  // Related posts: cùng tag đầu tiên, exclude bài hiện tại, max 3.
  let related: Awaited<ReturnType<typeof listPublishedPosts>> = [];
  if (post.tags && post.tags.length > 0) {
    const all = await listPublishedPosts(20);
    related = all
      .filter(
        (p) =>
          p.id !== post.id &&
          (p.tags ?? []).some((t) => post.tags!.includes(t)),
      )
      .slice(0, 3);
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} />
        Tất cả bài viết
      </Link>

      {/* Title + meta */}
      <header className="mb-8">
        <h1
          className="text-3xl md:text-5xl font-bold leading-tight tracking-tight mb-4"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {post.title}
        </h1>

        <div
          className="flex flex-wrap items-center gap-3 text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={13} strokeWidth={2} />
            {formatPublishDate(post.publish_at ?? post.created_at)}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} strokeWidth={2} />
            {minutes} phút đọc
          </span>
        </div>

        {post.excerpt && (
          <p
            className="text-lg mt-4 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {post.excerpt}
          </p>
        )}
      </header>

      {/* Hero image */}
      {post.hero_url && (
        <div
          className="rounded-xl overflow-hidden mb-8"
          style={{
            background: 'var(--color-surface-bg_elevated)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.hero_url}
            alt=""
            className="w-full h-auto"
            loading="eager"
          />
        </div>
      )}

      {/* Body markdown */}
      <MarkdownContent markdown={post.body_md} />

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <footer
          className="mt-12 pt-8 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Tag size={11} strokeWidth={2.5} className="inline mr-1" />
            Thẻ
          </div>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <Link
                key={t}
                href={`/blog/tag/${encodeURIComponent(t)}`}
                className="inline-flex items-center px-3 h-7 rounded-full text-xs font-medium transition-colors hover:opacity-90"
                style={{
                  background: 'var(--color-surface-muted)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {t}
              </Link>
            ))}
          </div>
        </footer>
      )}

      {/* Related posts */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2
            className="text-sm font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Bài viết liên quan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
