/**
 * QuickLauncher — Phase 32.8
 *
 * Spotlight-style overlay center màn hình. Trigger qua hotkey toàn cục
 * (mặc định Ctrl+Space). Fuzzy search shortcuts + workspaces, Enter launch.
 *
 * UX:
 *   - Search bar to + auto-focus
 *   - Top 8 results fuzzy match (tên + tags)
 *   - Arrow Up/Down navigate, Enter launch
 *   - Esc đóng
 *   - Click outside đóng
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Zap } from 'lucide-react';
import type { Shortcut, Workspace } from '../types';
import { iconUrl } from '../tauri-bridge';

interface Props {
  shortcuts: Shortcut[];
  workspaces: Workspace[];
  onLaunchShortcut: (sc: Shortcut) => void;
  onLaunchWorkspace: (ws: Workspace) => void;
  onClose: () => void;
}

interface ResultItem {
  type: 'shortcut' | 'workspace';
  id: string;
  name: string;
  subtitle: string;
  icon?: string | null;
  data: Shortcut | Workspace;
  score: number;
}

export function QuickLauncher({
  shortcuts, workspaces, onLaunchShortcut, onLaunchWorkspace, onClose,
}: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const out: ResultItem[] = [];

    // Workspace results (priority)
    for (const ws of workspaces) {
      const score = fuzzyScore(ws.name.toLowerCase(), q);
      if (score > 0 || q === '') {
        out.push({
          type: 'workspace',
          id: ws.id,
          name: ws.name,
          subtitle: `Workspace · ${ws.shortcut_ids.length} app`,
          data: ws,
          score: score + 50, // boost workspace
        });
      }
    }

    // Shortcut results
    for (const sc of shortcuts) {
      const text = `${sc.name} ${sc.target} ${(sc.tags ?? []).join(' ')}`.toLowerCase();
      const score = fuzzyScore(text, q);
      if (score > 0 || q === '') {
        // Boost favorite + frequently used
        const boost = (sc.favorite ? 30 : 0) + Math.min(20, sc.click_count);
        out.push({
          type: 'shortcut',
          id: sc.id,
          name: sc.name,
          subtitle: `${sc.type} · ${sc.group}`,
          icon: sc.icon_path,
          data: sc,
          score: score + boost,
        });
      }
    }

    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8);
  }, [query, shortcuts, workspaces]);

  // Reset active index khi query thay đổi
  useEffect(() => { setActiveIdx(0); }, [query]);

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[activeIdx];
      if (item) launch(item);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function launch(item: ResultItem): void {
    if (item.type === 'shortcut') onLaunchShortcut(item.data as Shortcut);
    else onLaunchWorkspace(item.data as Workspace);
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,14,12,0.50)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 250,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560, maxWidth: '90vw',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.30)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Gõ tên app / workspace... (Esc đóng)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              {query ? 'Không khớp shortcut nào' : 'Chưa có shortcut'}
            </div>
          ) : (
            results.map((item, idx) => {
              const isActive = idx === activeIdx;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => launch(item)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                  }}
                >
                  <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.type === 'workspace' ? (
                      <Zap size={20} fill="#f59e0b" color="#f59e0b" />
                    ) : item.icon ? (
                      <img src={iconUrl(item.icon) ?? ''} alt="" style={{ width: 24, height: 24 }} />
                    ) : (
                      <span style={{ fontSize: 18 }}>📱</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {item.subtitle}
                    </div>
                  </div>
                  {isActive && (
                    <kbd style={{ fontSize: 10, padding: '2px 6px', background: 'var(--color-surface-row)', borderRadius: 4, color: 'var(--color-text-muted)' }}>
                      ↵ Enter
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 14px',
          fontSize: 11,
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border-subtle)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>↑↓ chọn · ↵ mở · Esc đóng</span>
          <span>{results.length} kết quả</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple fuzzy score: substring match boost, word-start boost.
 * Empty query → 1 (match all với weight thấp).
 */
function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  if (!text) return 0;
  const idx = text.indexOf(query);
  if (idx === -1) {
    // Try character-by-character match
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    if (qi === query.length) return 5;
    return 0;
  }
  // Substring match
  let score = 100 - idx; // earlier match = higher score
  if (idx === 0) score += 50;
  // Word boundary boost
  if (idx > 0 && /\s/.test(text[idx - 1])) score += 20;
  return score;
}
