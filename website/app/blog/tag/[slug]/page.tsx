/**
 * /blog/tag/[slug] — Posts list filter theo tag (Phase 19.2).
 */
import Link from 'next/link';
import { ArrowLeft, Tag } from 'lucide-react';
import { listPostsByTag } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const tag = decodeURIComponent(params.slug);
  return {
    title: `${tag} — Blog TrishTEAM`,
    description: `Tất cả bài viết được gắn thẻ "${tag}" trên Blog TrishTEAM.`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const tag = decodeURIComponent(params.slug);
  const posts = await listPostsByTag(tag, 50);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 mb-6 text-sm transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <ArrowLeft size={15} />
        Tất cả bài viết
      </Link>

      <header className="mb-8">
        <div
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--color-accent-primary)' }}
        >
          <Tag size={11} strokeWidth={2.5} className="inline mr-1" />
          Chủ đề
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold mb-2 tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          #{tag}
        </h1>
        <p
          className="text-base"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {posts.length} bài viết
        </p>
      </header>

      {posts.length === 0 ? (
        <div
          className="rounded-xl border p-10 text-center"
          style={{
            background: 'var(--color-surface-card)',
            borderColor: 'var(--color-border-default)',
          }}
        >
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Chưa có bài viết nào với chủ đề này.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
}
