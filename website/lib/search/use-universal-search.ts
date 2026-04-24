'use client';

/**
 * useUniversalSearch — Phase 12.1.
 *
 * Hook aggregator cho universal search:
 *   - Static items: apps ecosystem + nav + actions (luôn có).
 *   - Dynamic (khi authed):
 *     - Quick Note scratchpad `/notes/{uid}/items/quick-note` (1 doc).
 *     - Announcements từ `/announcements` (active + chưa hết hạn).
 *   - Consumer truyền runners cho ACTION để bind theme toggle/focus mode/...
 *
 * Output:
 *   - `items`: mảng SearchableItem đã merge (recompute khi data thay đổi).
 *   - `search(query)`: chạy Fuse.js → SearchResult[] đã sort theo score +
 *     recency tie-break.
 *   - `isLoadingRemote`: có đang fetch initial snapshot không.
 *
 * Fuse config:
 *   - keys: title (weight 0.6), subtitle (0.25), keywords (0.15).
 *   - threshold: 0.4 (khớp tương đối; dưới 0.25 = strict, trên 0.5 = noisy).
 *   - ignoreLocation: true — user gõ chữ nào ở đâu cũng match.
 *   - minMatchCharLength: 2 — tránh noise khi gõ 1 ký tự.
 *   - includeScore + includeMatches: cho highlight.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Fuse, { type IFuseOptions } from 'fuse.js';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query as fsQuery,
  where,
  limit as fsLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import {
  buildActionItems,
  buildStaticItems,
  foldVN,
  type ActionKey,
} from './static-sources';
import type { SearchableItem, SearchResult } from './types';
import { embedTexts, cosine } from './embeddings';
import { fetchSemanticUnion, type SemanticDoc } from './semantic-index';

const FUSE_OPTIONS: IFuseOptions<SearchableItem> = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'subtitle', weight: 0.25 },
    { name: 'keywords', weight: 0.15 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
};

export interface UseUniversalSearchOptions {
  runners?: Partial<Record<ActionKey, () => void>>;
  /** Tắt subscribe Firestore (ví dụ preview SSR). */
  disableRemote?: boolean;
  /** Phase 12.5: bật rerank semantic async (fetch /api/embed + cosine). */
  enableSemantic?: boolean;
}

export interface UseUniversalSearchResult {
  items: SearchableItem[];
  search: (q: string, maxResults?: number) => SearchResult[];
  /** Async rerank version — bổ sung vector similarity + blend. */
  semanticSearch: (
    q: string,
    maxResults?: number,
  ) => Promise<SearchResult[]>;
  isLoadingRemote: boolean;
  hasRemote: boolean;
  semanticReady: boolean;
  semanticProvider: string | null;
}

export function useUniversalSearch(
  opts: UseUniversalSearchOptions = {},
): UseUniversalSearchResult {
  const { runners = {}, disableRemote = false, enableSemantic = false } = opts;
  const { user, isAuthenticated } = useAuth();

  const [noteItem, setNoteItem] = useState<SearchableItem | null>(null);
  const [announcementItems, setAnnouncementItems] = useState<SearchableItem[]>(
    [],
  );
  const [loadingNote, setLoadingNote] = useState(false);
  const [loadingAnn, setLoadingAnn] = useState(false);

  // Phase 12.5: semantic index (fetched once khi enableSemantic=true).
  const [semanticIndex, setSemanticIndex] = useState<SemanticDoc[]>([]);
  const [semanticProvider, setSemanticProvider] = useState<string | null>(null);
  const [semanticReady, setSemanticReady] = useState(false);

  useEffect(() => {
    if (!enableSemantic) {
      setSemanticReady(false);
      return;
    }
    let cancelled = false;
    setSemanticReady(false);
    fetchSemanticUnion(['apps', 'announcements'])
      .then((docs) => {
        if (cancelled) return;
        setSemanticIndex(docs);
        setSemanticProvider(docs[0]?.model ?? null);
        setSemanticReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn('[search] semantic fetch fail:', e);
        setSemanticReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enableSemantic]);

  // Subscribe Firestore quick-note của user.
  useEffect(() => {
    if (disableRemote) return;
    if (!isAuthenticated || !user || !db) {
      setNoteItem(null);
      return;
    }
    setLoadingNote(true);
    const ref = doc(db, 'notes', user.id, 'items', 'quick-note');
    const unsub: Unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setLoadingNote(false);
        if (!snap.exists()) {
          setNoteItem(null);
          return;
        }
        const data = snap.data() as { text?: string; updatedAt?: unknown };
        const text = (data.text ?? '').trim();
        if (!text) {
          setNoteItem(null);
          return;
        }
        setNoteItem({
          id: 'note:quick-note',
          category: 'note',
          title: text.split('\n')[0].slice(0, 80) || 'Ghi chú nhanh',
          subtitle:
            text.length > 80
              ? `${text.slice(0, 160).replace(/\n/g, ' ')}…`
              : text.replace(/\n/g, ' '),
          keywords: [foldVN(text.slice(0, 200))],
          href: '/#notes',
          meta: 'QuickNotes',
        });
      },
      () => setLoadingNote(false),
    );
    return () => unsub();
  }, [user, isAuthenticated, disableRemote]);

  // Subscribe Firestore announcements (chỉ active).
  useEffect(() => {
    if (disableRemote) return;
    if (!db) return;
    setLoadingAnn(true);
    // Active announcements từ /announcements admin tạo.
    const q = fsQuery(
      collection(db, 'announcements'),
      where('active', '==', true),
      orderBy('startAt', 'desc'),
      fsLimit(20),
    );
    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLoadingAnn(false);
        const items: SearchableItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as {
            title?: string;
            message?: string;
            kind?: string;
            startAt?: { toDate: () => Date } | null;
          };
          if (!data.title && !data.message) return;
          const title = data.title || data.message?.slice(0, 60) || 'Thông báo';
          const subtitle =
            data.message && data.message.length > 80
              ? `${data.message.slice(0, 160)}…`
              : data.message || '';
          const ts = data.startAt?.toDate?.().getTime?.() ?? Date.now();
          items.push({
            id: `announcement:${d.id}`,
            category: 'announcement',
            title,
            subtitle,
            keywords: [foldVN(title), foldVN(subtitle), data.kind ?? ''],
            href: '/',
            meta: data.kind ?? 'thông báo',
            ts,
          });
        });
        setAnnouncementItems(items);
      },
      (err) => {
        console.warn('[search] announcements subscribe fail:', err);
        setLoadingAnn(false);
      },
    );
    return () => unsub();
  }, [disableRemote]);

  // Memoize items tổng.
  const items = useMemo<SearchableItem[]>(() => {
    const staticItems = buildStaticItems();
    const actionItems = buildActionItems(runners);
    const dyn: SearchableItem[] = [];
    if (noteItem) dyn.push(noteItem);
    dyn.push(...announcementItems);
    return [...staticItems, ...actionItems, ...dyn];
    // runners ổn định qua useCallback ở consumer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteItem, announcementItems, JSON.stringify(Object.keys(runners))]);

  // Fuse instance — rebuild khi items thay đổi.
  const fuseRef = useRef<Fuse<SearchableItem> | null>(null);
  useEffect(() => {
    fuseRef.current = new Fuse(items, FUSE_OPTIONS);
  }, [items]);

  const search = useCallback(
    (q: string, maxResults = 30): SearchResult[] => {
      const trimmed = q.trim();
      if (!trimmed) {
        // Empty → trả về top items theo category order (app → nav → action).
        return items.slice(0, maxResults).map((item) => ({ item, score: 0 }));
      }
      const fuse = fuseRef.current;
      if (!fuse) return [];
      // Fold VN để "lai xe" match "lái xe".
      const folded = foldVN(trimmed);
      // Fuse 'extended' support → nhưng default AND word là đủ cho MVP.
      const raw = fuse.search(folded, { limit: maxResults });
      return raw.map((r) => ({
        item: r.item,
        score: r.score ?? 0,
        matches: r.matches?.map((m) => ({
          key: (m.key ?? '') as string,
          ranges: (m.indices ?? []).map((p) => [p[0], p[1]] as [number, number]),
        })),
      }));
    },
    [items],
  );

  // Phase 12.5: semantic rerank async.
  // Strategy:
  //   1. Lấy top-K (50) từ Fuse để giới hạn candidate set.
  //   2. Embed query qua /api/embed (Gemini hoặc fallback local-hash).
  //   3. Với mỗi candidate có matching SemanticDoc (id prefix 'app:'/'announcement:'),
  //      tính cosine(queryVec, docVec). Blend: final = 0.4*fuse + 0.6*(1-cosine).
  //      (Fuse score thấp = tốt, cosine cao = tốt → flip cosine.)
  //   4. Candidate không có semantic doc → giữ fuse score.
  //   5. Sort ascending (score thấp trước) rồi slice top N.
  const semanticSearch = useCallback(
    async (q: string, maxResults = 30): Promise<SearchResult[]> => {
      const trimmed = q.trim();
      if (!trimmed) return search('', maxResults);
      const fuseHits = search(trimmed, 50);
      if (!enableSemantic || semanticIndex.length === 0) {
        return fuseHits.slice(0, maxResults);
      }
      let queryVec: number[];
      try {
        const [v] = await embedTexts([trimmed]);
        queryVec = v;
      } catch (e) {
        console.warn('[search] embed query fail, fallback fuse:', e);
        return fuseHits.slice(0, maxResults);
      }
      // Index semantic docs theo id cho O(1) lookup.
      // SemanticDoc.id cho 'app' là app.id (vd 'smart-life'),
      // cho 'announcement' là firestore doc id.
      // SearchableItem.id của app = 'app:{app.id}', announcement = 'announcement:{id}'.
      const byKey = new Map<string, SemanticDoc>();
      for (const doc of semanticIndex) {
        byKey.set(`${doc.category}:${doc.id}`, doc);
      }
      const reranked = fuseHits.map((hit) => {
        const semDoc = byKey.get(hit.item.id);
        if (!semDoc) return hit;
        const sim = cosine(queryVec, semDoc.vec);
        // flip: cosine [-1,1] → [0,1] distance-ish.
        const semDist = Math.max(0, 1 - sim);
        const blended = 0.4 * hit.score + 0.6 * semDist;
        return { ...hit, score: blended };
      });
      reranked.sort((a, b) => a.score - b.score);
      return reranked.slice(0, maxResults);
    },
    [search, enableSemantic, semanticIndex],
  );

  return {
    items,
    search,
    semanticSearch,
    isLoadingRemote: loadingNote || loadingAnn,
    hasRemote: isAuthenticated,
    semanticReady,
    semanticProvider,
  };
}
