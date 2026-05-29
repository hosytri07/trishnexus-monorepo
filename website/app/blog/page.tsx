/**
 * /blog — Phase 78 Brutalist blog index.
 * Server component fetch posts từ Firestore qua lib/blog.ts.
 * ISR: revalidate 60s.
 */
import Link from 'next/link';
import { Newspaper, ArrowUpRight } from 'lucide-react';
import { listPublishedPosts, getAllTags } from '@/lib/blog';
import { BruFooter } from '@/components/bru/bru-footer';

export const revalidate = 60;

export const metadata = {
  title: 'Blog — TrishTEAM',
  description:
    'Bài viết kỹ thuật, hướng dẫn dùng app TrishTEAM, release notes, ghi chú dev.',
};

export default async function BlogPage() {
  const [posts, tags] = await Promise.all([listPublishedPosts(30), getAllTags()]);
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <main className="bru">
      {/* HERO */}
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // {posts.length} bài viết
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32 }}>
            BLOG.
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 720 }}>
            Bài viết kỹ thuật, hướng dẫn, release notes, ghi chú dev cho ecosystem TrishTEAM.
          </p>

          {tags.length > 0 && (
            <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.slice(0, 10).map((t) => (
                <span key={t} className="bru-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* POSTS GRID */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container">
          {posts.length === 0 ? (
            <div
              style={{
                padding: 80,
                textAlign: 'center',
                border: '2px dashed var(--bru-border)',
              }}
            >
              <Newspaper size={48} strokeWidth={1.5} style={{ color: 'var(--bru-fg-muted)', margin: '0 auto 24px' }} />
              <h2 className="bru-display-sm" style={{ marginBottom: 16 }}>Chưa có bài viết</h2>
              <p className="bru-body" style={{ color: 'var(--bru-fg-dim)' }}>
                Admin có thể tạo bài mới qua /admin/posts.
              </p>
            </div>
          ) : (
            <>
              {/* Featured post (largest card) */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="bru-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    textDecoration: 'none',
                    marginBottom: 48,
                    padding: 'clamp(24px, 4vw, 56px)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="bru-eyebrow">// Bài mới nhất</span>
                    <ArrowUpRight size={24} strokeWidth={2} style={{ color: 'var(--bru-accent)' }} />
                  </div>
                  <h2 className="bru-display-md" style={{ marginTop: 8 }}>
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="bru-body-lg" style={{ maxWidth: 720, marginTop: 8 }}>
                      {featured.excerpt}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {(featured.tags ?? []).slice(0, 4).map((t: string) => (
                      <span key={t} className="bru-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              )}

              {/* Rest */}
              <div className="bru-grid-3">
                {rest.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="bru-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      textDecoration: 'none',
                    }}
                  >
                    <ArrowUpRight size={18} strokeWidth={2} style={{ color: 'var(--bru-accent)' }} />
                    <h3
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'var(--bru-fg)',
                        lineHeight: 1.25,
                      }}
                    >
                      {p.title}
                    </h3>
                    {p.excerpt && (
                      <p className="bru-body-sm" style={{ flex: 1 }}>
                        {p.excerpt}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto' }}>
                      {(p.tags ?? []).slice(0, 3).map((t: string) => (
                        <span key={t} className="bru-tag" style={{ fontSize: 9 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
