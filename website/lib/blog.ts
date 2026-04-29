/**
 * lib/blog.ts — Server-side fetch posts từ Firestore.
 *
 * Phase 19.2 — blog list + detail. Posts admin tạo qua TrishAdmin desktop
 * (collection `/posts/{id}`, status='published' mới public).
 *
 * Dùng firebase-admin SDK (server-only) để bypass rules + đọc nhanh.
 * Nếu admin SDK chưa cấu hình (env `FIREBASE_SERVICE_ACCOUNT` thiếu) →
 * trả về empty list + log warning. UI tự fallback "chưa có bài nào".
 */
import 'server-only';
import { adminDb, adminReady } from './firebase-admin';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  excerpt?: string;
  hero_url?: string;
  tags?: string[];
  status: 'draft' | 'published';
  publish_at?: number;
  created_at: number;
  updated_at: number;
  author_uid: string;
}

/**
 * List published posts, sort by publish_at DESC.
 *
 * @param limit max items (default 30 — đủ trang chủ blog)
 */
export async function listPublishedPosts(limit = 30): Promise<BlogPost[]> {
  if (!adminReady()) {
    console.warn('[blog] admin SDK chưa cấu hình — trả về [] cho /blog');
    return [];
  }
  try {
    const snap = await adminDb()
      .collection('posts')
      .where('status', '==', 'published')
      .orderBy('publish_at', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => normalize(d.id, d.data()));
  } catch (err) {
    console.error('[blog] listPublishedPosts fail', err);
    return [];
  }
}

/**
 * Fetch 1 post by slug. Trả null nếu không tìm thấy hoặc draft.
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!adminReady()) return null;
  try {
    const snap = await adminDb()
      .collection('posts')
      .where('slug', '==', slug)
      .where('status', '==', 'published')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0]!;
    return normalize(d.id, d.data());
  } catch (err) {
    console.error('[blog] getPostBySlug fail', err);
    return null;
  }
}

/**
 * Fetch 1 post by document ID (Phase 19.22 — URL /blog/[id] với ID 13-digit).
 * Auto fallback sang getPostBySlug nếu ID không phải số (legacy slug post).
 */
export async function getPostById(idOrSlug: string): Promise<BlogPost | null> {
  if (!adminReady()) return null;
  // Thử fetch by doc ID trước
  try {
    const snap = await adminDb().collection('posts').doc(idOrSlug).get();
    if (snap.exists) {
      const data = snap.data();
      if (data?.status === 'published') {
        return normalize(snap.id, data);
      }
    }
  } catch (err) {
    console.warn('[blog] getPostById direct fail:', err);
  }
  // Fallback: thử as slug (cho post legacy)
  return getPostBySlug(idOrSlug);
}

/**
 * Get all unique tags từ published posts (cho filter sidebar).
 */
export async function getAllTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await listPublishedPosts(200);
  const counter = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.tags ?? []) {
      counter.set(t, (counter.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counter.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * List posts theo tag.
 */
export async function listPostsByTag(tag: string, limit = 30): Promise<BlogPost[]> {
  if (!adminReady()) return [];
  try {
    const snap = await adminDb()
      .collection('posts')
      .where('status', '==', 'published')
      .where('tags', 'array-contains', tag)
      .orderBy('publish_at', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => normalize(d.id, d.data()));
  } catch (err) {
    console.error('[blog] listPostsByTag fail', err);
    return [];
  }
}

/**
 * Estimated reading time (phút) — giả định 220 wpm tiếng Việt + 200 wpm code.
 */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return minutes;
}

/**
 * Format publish date dd/MM/yyyy.
 */
export function formatPublishDate(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function normalize(id: string, raw: FirebaseFirestore.DocumentData): BlogPost {
  return {
    id,
    slug: (raw.slug as string) ?? id,
    title: (raw.title as string) ?? 'Untitled',
    body_md: (raw.body_md as string) ?? '',
    excerpt: (raw.excerpt as string) ?? undefined,
    hero_url: (raw.hero_url as string) ?? undefined,
    tags: (raw.tags as string[]) ?? [],
    status: (raw.status as 'draft' | 'published') ?? 'draft',
    publish_at: (raw.publish_at as number) ?? undefined,
    created_at: (raw.created_at as number) ?? 0,
    updated_at: (raw.updated_at as number) ?? 0,
    author_uid: (raw.author_uid as string) ?? '',
  };
}
