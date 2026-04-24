'use client';

/**
 * /search — Phase 12.2.
 *
 * Full-page universal search. Lấy ?q= từ URL, bind vào input, hiện kết
 * quả chia group (app/nav/action/note/announcement). Bàn phím:
 *   - ↑ ↓ : di chuyển
 *   - Enter : open
 *   - Esc : clear query
 *   - /   : focus input
 *
 * Chưa có semantic embedding — dựa 100% trên Fuse fuzzy + VN fold.
 * Sẽ nâng cấp ở Phase 12.3 (embedding reranker).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ArrowLeft,
  Cpu,
  Compass,
  Zap,
  StickyNote,
  Megaphone,
  Activity,
  Settings,
  Loader2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  useUniversalSearch,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type SearchCategory,
  type SearchableItem,
  type SearchResult,
} from '@/lib/search';

const CATEGORY_ICON: Record<SearchCategory, LucideIcon> = {
  app: Cpu,
  nav: Compass,
  action: Zap,
  note: StickyNote,
  announcement: Megaphone,
  event: Activity,
  setting: Settings,
};

function groupResults(results: SearchResult[]): Map<SearchCategory, SearchResult[]> {
  const map = new Map<SearchCategory, SearchResult[]>();
  for (const r of results) {
    const arr = map.get(r.item.category) ?? [];
    arr.push(r);
    map.set(r.item.category, arr);
  }
  return map;
}

function SearchPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQ);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<SearchCategory | 'all'>('all');
  const [semanticMode, setSemanticMode] = useState(false);
  const [asyncResults, setAsyncResults] = useState<SearchResult[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync URL ↔ state (one-way: URL → state on mount, state → URL on change).
  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ]);

  const {
    search,
    semanticSearch,
    isLoadingRemote,
    hasRemote,
    semanticReady,
    semanticProvider,
  } = useUniversalSearch({ enableSemantic: semanticMode });

  // Semantic async effect — chỉ chạy khi bật semanticMode + ready.
  useEffect(() => {
    if (!semanticMode) {
      setAsyncResults(null);
      return;
    }
    let cancelled = false;
    setSemanticLoading(true);
    const handle = setTimeout(() => {
      semanticSearch(query, 200)
        .then((res) => {
          if (cancelled) return;
          setAsyncResults(res);
        })
        .catch((e) => {
          console.warn('[search] semanticSearch fail:', e);
          if (!cancelled) setAsyncResults(null);
        })
        .finally(() => {
          if (!cancelled) setSemanticLoading(false);
        });
    }, 150); // debounce 150ms
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, semanticMode, semanticSearch]);

  const results = useMemo(() => {
    const base =
      semanticMode && asyncResults ? asyncResults : search(query, 200);
    if (filter === 'all') return base;
    return base.filter((r) => r.item.category === filter);
  }, [search, query, filter, semanticMode, asyncResults]);

  const grouped = useMemo(() => groupResults(results), [results]);
  const totalCount = results.length;

  // Reset active khi query đổi.
  useEffect(() => {
    setActive(0);
  }, [query, filter]);

  // Focus '/' shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSelect = useCallback(
    (item: SearchableItem) => {
      if (item.run) {
        item.run();
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) onSelect(results[active].item);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const onQueryChange = (v: string) => {
    setQuery(v);
    // Update URL (replace, không push, tránh spam history).
    const url = v ? `/search?q=${encodeURIComponent(v)}` : '/search';
    window.history.replaceState(null, '', url);
  };

  // Flatten for keyboard active index matching visible order.
  const flat = useMemo(() => {
    if (filter !== 'all') return results;
    // When showing grouped, flatten in category order.
    const flatArr: SearchResult[] = [];
    for (const cat of CATEGORY_ORDER) {
      const arr = grouped.get(cat);
      if (arr) flatArr.push(...arr);
    }
    return flatArr;
  }, [results, grouped, filter]);

  const activeItemId = flat[active]?.item.id;

  return (
    <main
      className="max-w-[56rem] mx-auto px-6 py-8"
      style={{ color: 'var(--color-text-primary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <span
          className="text-xs inline-flex items-center gap-1.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Phím <Kbd>/</Kbd> để focus · <Kbd>Esc</Kbd> clear
        </span>
      </div>

      {/* Search input */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Search size={18} style={{ color: 'var(--color-accent-primary)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          placeholder="Gõ để tìm app, ghi chú, hành động, thông báo..."
          className="flex-1 bg-transparent outline-none text-lg"
          style={{ color: 'var(--color-text-primary)' }}
        />
        {(isLoadingRemote || semanticLoading) && (
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: 'var(--color-text-muted)' }}
          />
        )}
        <button
          type="button"
          onClick={() => setSemanticMode((v) => !v)}
          title={
            semanticMode
              ? `Tắt semantic rerank (provider: ${semanticProvider ?? 'đang tải'})`
              : 'Bật semantic rerank (Gemini embedding)'
          }
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium transition"
          style={{
            background: semanticMode
              ? 'var(--color-accent-gradient)'
              : 'var(--color-surface-elevated)',
            color: semanticMode ? '#fff' : 'var(--color-text-secondary)',
            border: `1px solid ${
              semanticMode
                ? 'transparent'
                : 'var(--color-border-subtle)'
            }`,
          }}
        >
          <Sparkles size={11} />
          Semantic
          {semanticMode && !semanticReady && (
            <Loader2 size={10} className="animate-spin" />
          )}
        </button>
      </div>

      {/* Semantic provider hint */}
      {semanticMode && semanticReady && (
        <div
          className="text-[11px] mb-3 inline-flex items-center gap-1.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Sparkles size={10} />
          Rerank bằng{' '}
          <code
            className="px-1 py-0.5 rounded"
            style={{
              background: 'var(--color-surface-elevated)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {semanticProvider ?? 'unknown'}
          </code>
          · blend 40% fuzzy + 60% cosine
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip
          label="Tất cả"
          count={totalCount}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {CATEGORY_ORDER.map((cat) => {
          const count = grouped.get(cat)?.length ?? 0;
          if (count === 0 && filter !== cat) return null;
          return (
            <FilterChip
              key={cat}
              label={CATEGORY_LABEL[cat]}
              count={count}
              active={filter === cat}
              onClick={() => setFilter(cat)}
              icon={CATEGORY_ICON[cat]}
            />
          );
        })}
      </div>

      {/* Results */}
      {totalCount === 0 && query ? (
        <EmptyState query={query} />
      ) : (
        <div className="flex flex-col gap-6">
          {filter === 'all' ? (
            CATEGORY_ORDER.map((cat) => {
              const arr = grouped.get(cat);
              if (!arr || arr.length === 0) return null;
              return (
                <GroupSection
                  key={cat}
                  category={cat}
                  results={arr}
                  activeId={activeItemId}
                  onSelect={onSelect}
                />
              );
            })
          ) : (
            <GroupSection
              category={filter}
              results={results}
              activeId={activeItemId}
              onSelect={onSelect}
            />
          )}
        </div>
      )}

      {/* Hint khi chưa login */}
      {!hasRemote && (
        <div
          className="mt-8 rounded-lg px-4 py-3 flex items-start gap-3 text-sm"
          style={{
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Sparkles size={16} style={{ color: 'var(--color-accent-primary)' }} />
          <div>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              Đăng nhập
            </strong>{' '}
            để tìm cả ghi chú QuickNotes và thông báo đã lưu trong Firestore.
            <Link
              href="/login?next=/search"
              className="ml-2 underline"
              style={{ color: 'var(--color-accent-primary)' }}
            >
              Đăng nhập →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
      style={{
        background: active
          ? 'var(--color-accent-primary)'
          : 'var(--color-surface-card)',
        color: active ? '#fff' : 'var(--color-text-secondary)',
        border: `1px solid ${
          active ? 'var(--color-accent-primary)' : 'var(--color-border-default)'
        }`,
      }}
    >
      {Icon && <Icon size={12} />}
      {label}
      <span
        className="inline-flex items-center justify-center rounded-full text-[10px] px-1.5 min-w-[18px]"
        style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-elevated)',
          color: active ? '#fff' : 'var(--color-text-muted)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function GroupSection({
  category,
  results,
  activeId,
  onSelect,
}: {
  category: SearchCategory;
  results: SearchResult[];
  activeId?: string;
  onSelect: (item: SearchableItem) => void;
}) {
  const Icon = CATEGORY_ICON[category];
  return (
    <section>
      <h2
        className="text-xs uppercase tracking-wider mb-2 inline-flex items-center gap-2"
        style={{ color: 'var(--color-text-muted)', letterSpacing: '0.1em' }}
      >
        <Icon size={12} />
        {CATEGORY_LABEL[category]}
        <span
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ({results.length})
        </span>
      </h2>
      <div className="flex flex-col gap-1">
        {results.map((r) => (
          <ResultRow
            key={r.item.id}
            result={r}
            active={r.item.id === activeId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function ResultRow({
  result,
  active,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onSelect: (item: SearchableItem) => void;
}) {
  const Icon = CATEGORY_ICON[result.item.category];
  return (
    <button
      type="button"
      onClick={() => onSelect(result.item)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition"
      style={{
        background: active
          ? 'var(--color-accent-soft)'
          : 'var(--color-surface-card)',
        border: `1px solid ${
          active ? 'var(--color-accent-primary)' : 'var(--color-border-subtle)'
        }`,
      }}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-md"
        style={{
          width: 34,
          height: 34,
          background: 'var(--color-surface-elevated)',
          color: 'var(--color-accent-primary)',
        }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {result.item.title}
        </div>
        {result.item.subtitle && (
          <div
            className="text-xs truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {result.item.subtitle}
          </div>
        )}
      </div>
      {result.item.meta && (
        <span
          className="shrink-0 text-[10px] uppercase px-2 py-0.5 rounded"
          style={{
            background: 'var(--color-surface-elevated)',
            color: 'var(--color-text-muted)',
            letterSpacing: '0.05em',
          }}
        >
          {result.item.meta}
        </span>
      )}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px]"
      style={{
        background: 'var(--color-surface-card)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
        fontFamily: 'inherit',
        minWidth: 20,
      }}
    >
      {children}
    </kbd>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div
      className="text-center py-16 rounded-xl"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px dashed var(--color-border-default)',
      }}
    >
      <Search
        size={32}
        className="mx-auto mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      />
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Không tìm thấy &quot;{query}&quot;
      </h3>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Thử bỏ dấu, gõ ngắn lại, hoặc chỉ gõ từ khóa chính.
      </p>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
