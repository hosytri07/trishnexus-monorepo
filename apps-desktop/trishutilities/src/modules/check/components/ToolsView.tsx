/**
 * ToolsView — Tab "🛠 Tools" (tips/tricks fix lỗi).
 *
 * Layout: 2-pane (sidebar trái với folder/category + right list).
 * Read-only: user chỉ xem + click link tải/tham khảo. Admin curate nội
 * dung qua TrishAdmin → publish vào /public/check/tips.json.
 */

import { useEffect, useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  loadTips,
  type TipItem,
  type TipsFile,
  type ContentLoadResult,
} from '../lib/content-loader.js';

export function ToolsView(): JSX.Element {
  const [result, setResult] = useState<ContentLoadResult<TipsFile> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Tất cả');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTips().then((r) => {
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
    const r = await loadTips();
    setResult(r);
    setLoading(false);
  };

  const items = result?.data.items ?? [];

  // Count theo category cho sidebar
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((t) => m.set(t.category, (m.get(t.category) ?? 0) + 1));
    return m;
  }, [items]);

  const categories = useMemo(() => {
    return ['Tất cả', ...[...catCounts.keys()].sort()];
  }, [catCounts]);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (activeCat !== 'Tất cả' && t.category !== activeCat) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${t.title} ${t.summary} ${t.body} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, activeCat, search]);

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
            const active = c === activeCat;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCat(c)}
                style={sidebarItemStyle(active)}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>{c}</span>
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
          })}
        </div>
      </aside>

      {/* Main pane */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header bar: search + refresh */}
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
            placeholder="🔍 Tìm theo tiêu đề / tag / nội dung…"
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

        {/* List */}
        {loading && items.length === 0 && (
          <p style={{ color: 'var(--muted)' }}>Đang tải tips…</p>
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
            Không có tip nào khớp filter.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              open={openId === tip.id}
              onToggle={() => setOpenId(openId === tip.id ? null : tip.id)}
            />
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

function TipCard({
  tip,
  open,
  onToggle,
}: {
  tip: TipItem;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        background: 'var(--surface)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'var(--text)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderRadius: 4,
            fontWeight: 600,
          }}
        >
          {tip.category}
        </span>
        <strong style={{ flex: 1, fontSize: 14 }}>{tip.title}</strong>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {!open && (
        <div
          style={{
            padding: '0 14px 12px 14px',
            color: 'var(--muted)',
            fontSize: 12,
          }}
        >
          {tip.summary}
        </div>
      )}
      {open && (
        <div
          style={{
            padding: '4px 14px 14px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-raised)',
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 10,
              marginBottom: 8,
            }}
          >
            {tip.summary}
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {tip.body}
          </pre>
          {tip.tags.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              {tip.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                    borderRadius: 3,
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
          {tip.links.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              {tip.links.map((l, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void openUrl(l.url)}
                  style={{
                    padding: '6px 10px',
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
      )}
    </div>
  );
}

function sidebarItemStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text)',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'background 120ms ease',
  };
}
