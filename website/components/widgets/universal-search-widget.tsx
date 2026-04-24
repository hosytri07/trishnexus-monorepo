'use client';

/**
 * UniversalSearchWidget — Phase 12.2.
 *
 * Ô search mini trên dashboard gom mọi nguồn (apps, nav, action, notes,
 * announcements). Input box + dropdown 5 kết quả top. Enter để đi tới
 * item đầu, hoặc click. Nút "Mở trang tìm kiếm đầy đủ" → `/search?q=...`.
 *
 * Phân biệt 2 mode:
 *   - Empty query: hiện gợi ý nhanh (apps + nav top).
 *   - Có query: Fuse.js search, group theo category.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  Cpu,
  Compass,
  Zap,
  StickyNote,
  Megaphone,
  Activity,
  Settings,
  Command as CmdIcon,
  type LucideIcon,
} from 'lucide-react';
import { WidgetCard } from './widget-card';
import {
  useUniversalSearch,
  CATEGORY_LABEL,
  type SearchableItem,
  type SearchCategory,
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
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition"
      style={{
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: 'var(--color-text-primary)',
      }}
    >
      <span
        className="shrink-0 inline-flex items-center justify-center rounded-md"
        style={{
          width: 28,
          height: 28,
          background: active
            ? 'var(--color-accent-primary)'
            : 'var(--color-surface-elevated)',
          color: active ? '#fff' : 'var(--color-text-secondary)',
        }}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{result.item.title}</div>
        {result.item.subtitle && (
          <div
            className="text-xs truncate"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {result.item.subtitle}
          </div>
        )}
      </div>
      <span
        className="shrink-0 text-[10px] uppercase px-2 py-0.5 rounded"
        style={{
          background: 'var(--color-surface-elevated)',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.05em',
        }}
      >
        {CATEGORY_LABEL[result.item.category]}
      </span>
    </button>
  );
}

export function UniversalSearchWidget() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { search, isLoadingRemote } = useUniversalSearch();

  const results = useMemo(() => search(query, 6), [search, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const onSelect = (item: SearchableItem) => {
    if (item.run) {
      item.run();
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) {
        onSelect(results[active].item);
      } else if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <WidgetCard
      title="Tìm kiếm tất cả"
      icon={<Search size={16} />}
      action={
        <Link
          href={query ? `/search?q=${encodeURIComponent(query)}` : '/search'}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded transition"
          style={{ color: 'var(--color-accent-primary)' }}
        >
          Xem đầy đủ <ArrowRight size={12} />
        </Link>
      }
    >
      <div
        id="search"
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tìm app, ghi chú, thông báo, hành động..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <span
          className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--color-surface-card)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <CmdIcon size={10} /> K
        </span>
      </div>

      {/* Results dropdown (always visible if có gì đó — tiện scan) */}
      <div className="mt-3 flex flex-col gap-1">
        {results.length === 0 && query ? (
          <div
            className="text-sm py-6 text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Không tìm thấy kết quả cho &quot;{query}&quot;
          </div>
        ) : (
          results.map((r, idx) => (
            <ResultRow
              key={r.item.id}
              result={r}
              active={idx === active}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {isLoadingRemote && (
        <div
          className="mt-2 text-[11px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Đang tải dữ liệu người dùng...
        </div>
      )}
    </WidgetCard>
  );
}
