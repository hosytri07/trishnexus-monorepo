/**
 * PostCard — preview card cho blog list page.
 *
 * Style: dark cyber giống ecosystem widget — 1px border, hover lift,
 * accent border khi focus, tag chip nhỏ.
 *
 * Variants:
 *   - "feature" (large)  → hero ảnh trái 40%, body phải 60%, dùng cho post nổi bật đầu tiên
 *   - "regular" (default) → hero phía trên, body phía dưới — grid 3 cột
 */
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import type { BlogPost } from '@/lib/blog';
import { formatPublishDate, readingTime } from '@/lib/blog';

interface Props {
  post: BlogPost;
  variant?: 'regular' | 'feature';
}

export function PostCard({ post, variant = 'regular' }: Props) {
  const minutes = readingTime(post.body_md);

  if (variant === 'feature') {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="group grid grid-cols-1 md:grid-cols-[5fr_6fr] gap-0 rounded-xl overflow-hidden border transition-all hover:scale-[1.005]"
        style={{
          background: 'var(--color-surface-card)',
          borderColor: 'var(--color-border-default)',
        }}
      >
        <PostHero post={post} large />
        <div className="p-6 md:p-8 flex flex-col justify-center">
          <PostMeta post={post} minutes={minutes} />
          <h2
            className="text-2xl md:text-3xl font-bold mt-3 mb-3 line-clamp-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {post.title}
          </h2>
          {post.excerpt && (
            <p
              className="text-sm md:text-base line-clamp-3 mb-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {post.excerpt}
            </p>
          )}
          <PostTags tags={post.tags} />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border transition-all hover:scale-[1.01]"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <PostHero post={post} />
      <div className="p-5 flex flex-col flex-1">
        <PostMeta post={post} minutes={minutes} />
        <h3
          className="text-lg font-bold mt-2 mb-2 line-clamp-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {post.title}
        </h3>
        {post.excerpt && (
          <p
            className="text-sm line-clamp-3 mb-3 flex-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {post.excerpt}
          </p>
        )}
        <PostTags tags={post.tags} />
      </div>
    </Link>
  );
}

function PostHero({ post, large = false }: { post: BlogPost; large?: boolean }) {
  if (post.hero_url) {
    return (
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: large ? '4 / 3' : '16 / 9',
          background: 'var(--color-surface-bg_elevated)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.hero_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
    );
  }
  // Fallback hero — gradient với title initial
  const initial = post.title.charAt(0).toUpperCase();
  return (
    <div
      className="relative overflow-hidden flex items-center justify-center"
      style={{
        aspectRatio: large ? '4 / 3' : '16 / 9',
        background:
          'linear-gradient(135deg, var(--color-surface-bg_elevated) 0%, var(--color-accent-soft) 100%)',
      }}
    >
      <span
        className="text-6xl md:text-8xl font-extrabold opacity-40"
        style={{ color: 'var(--color-accent-primary)' }}
      >
        {initial}
      </span>
    </div>
  );
}

function PostMeta({ post, minutes }: { post: BlogPost; minutes: number }) {
  return (
    <div
      className="flex items-center gap-3 text-xs"
      style={{ color: 'var(--color-text-muted)' }}
    >
      <span className="inline-flex items-center gap-1">
        <Calendar size={12} strokeWidth={2} />
        {formatPublishDate(post.publish_at ?? post.created_at)}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Clock size={12} strokeWidth={2} />
        {minutes} phút đọc
      </span>
    </div>
  );
}

function PostTags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-auto">
      {tags.slice(0, 3).map((t) => (
        <span
          key={t}
          className="inline-flex items-center px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
