/**
 * SoftwareCollectionView — Tab "📦 Phần mềm" (collection link tải).
 *
 * Layout: 2-pane (sidebar trái với folder/category + chip type + right grid).
 * Read-only: user xem + click link tải/tham khảo. Admin curate qua
 * TrishAdmin → publish vào /public/check/software.json.
 */

import { useEffect, useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  loadSoftwareCollection,
  type SoftwareItem,
  type SoftwareFile,
  type ContentLoadResult,
} from '../lib/content-loader.js';

const TYPE_LABEL: Record<SoftwareItem['type'], string> = {
  free: '🆓 Free',
  paid: '💰 Paid',
  freemium: '⭐ Freemium',
  trial: '🎁 Trial',
};

const TYPE_COLOR: Record<SoftwareItem['type'], string> = {
  free: '#10B981',
  paid: '#EF4444',
  freemium: '#3B82F6',
  trial: '#F59E0B',
};

export function SoftwareCollectionView(): JSX.Element {
  const [result, setResult] = useState<ContentLoadResult<SoftwareFile> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Tất cả');
  const [activeType, setActiveType] = useState<'all' | SoftwareItem['type']>(
    'all',
  );

  useEffect(() => {
    let cancelled = false;
    void loadSoftwareCollection().then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async (): Promise<void> => {
    setLoading(true);
    const r = await loadSoftwareCollection();
    setResult(r);
    setLoading(false);
  };

  const items = result?.data.items ?? [];

  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((s) => m.set(s.category, (m.get(s.category) ?? 0) + 1));
    return m;
  }, [items]);

  const categories = useMemo(() => {
    return ['Tất cả', ...[...catCounts.keys()].sort()];
  }, [catCounts]);

  const typeCounts = useMemo(() => {
    const m = new Map<SoftwareItem['type'], number>();
    items.forEach((s) => m.set(s.type, (m.get(s.type) ?? 0) + 1));
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (activeCat !== 'Tất cả' && s.category !== activeCat) return false;
      if (activeType !== 'all' && s.type !== activeType) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.name} ${s.vendor} ${s.description} ${s.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeCat, activeType, search]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 16,
        padding: 16,
        height: '100%',
        minHeight: 'calc(100vh - 200px)',
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 12,
          height: 'fit-content',
          position: 'sticky',
          top: 16,
        }}
      >
        {/* Type filter */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
            padding: '0 8px',
          }}
        >
          💵 Loại
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            marginBottom: 14,
          }}
        >
          <SidebarItem
            label="Tất cả loại"
            count={items.length}
            active={activeType === 'all'}
            onClick={() => setActiveType('all')}
          />
          {(['free', 'paid', 'freemium', 'trial'] as const).map((t) => {
            const count = typeCounts.get(t) ?? 0;
            if (count === 0) return null;
            return (
              <SidebarItem
                key={t}
                label={TYPE_LABEL[t]}
                count={count}
                active={activeType === t}
                onClick={() => setActiveType(t)}
                color={TYPE_COLOR[t]}
              />
            );
          })}
        </div>

        {/* Category folders */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 10,
            padding: '0 8px',
          }}
        >
          📁 Phân loại
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {categories.map((c) => {
            const count = c === 'Tất cả' ? items.length : catCounts.get(c) ?? 0;
            return (
              <SidebarItem
                key={c}
                label={c}
                count={count}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
              />
            );
          })}
        </div>
      </aside>

      {/* Main pane */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Tìm tên / vendor / mô tả…"
            style={{
              flex: 1,
              minWidth: 240,
              padding: '9px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {result?.source === 'remote'
              ? '🌐 cập nhật từ server'
              : '📦 bản đóng gói'}{' '}
            · {result?.data.updated_at ?? '—'}
          </span>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="btn-topbar"
          >
            {loading ? '⏳ Đang tải…' : '🔄 Làm mới'}
          </button>
        </div>

        {/* Grid */}
        {loading && items.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>Đang tải danh sách phần mềm…</p>
        )}
        {!loading && filtered.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--muted)',
              border: '1px dashed var(--border)',
              borderRadius: 10,
            }}
          >
            Không có app nào khớp filter.
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 10,
          }}
        >
          {filtered.map((s) => (
            <SoftwareCard key={s.id} item={s} />
          ))}
        </div>

        {result?.error && result.source === 'bundled' && (
          <p
            style={{
              marginTop: 4,
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            ⚠ Không tải được data từ server ({result.error}). Hiện đang dùng bản đóng gói.
          </p>
        )}
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: active ? color || 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text)',
        border: 'none',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          color: active ? '#fff' : 'var(--muted)',
          background: active
            ? 'rgba(255,255,255,0.25)'
            : 'var(--surface-raised)',
          padding: '1px 8px',
          borderRadius: 10,
          fontWeight: 600,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SoftwareCard({ item }: { item: SoftwareItem }): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${TYPE_COLOR[item.type]}`,
        borderRadius: 10,
        padding: 14,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>
          {item.name}
        </strong>
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            background: `${TYPE_COLOR[item.type]}22`,
            color: TYPE_COLOR[item.type],
            borderRadius: 3,
            fontWeight: 600,
          }}
        >
          {TYPE_LABEL[item.type]}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          display: 'flex',
          gap: 6,
        }}
      >
        <span>{item.category}</span>
        <span>·</span>
        <span>{item.vendor}</span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {item.description}
      </p>
      {item.alternatives && item.alternatives.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          Alt: {item.alternatives.join(' · ')}
        </div>
      )}
      {item.links.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 4,
          }}
        >
          {item.links.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => void openUrl(l.url)}
              style={{
                padding: '5px 10px',
                border: '1px solid var(--accent)',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              🔗 {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
