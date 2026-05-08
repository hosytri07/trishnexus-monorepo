/**
 * TrishLauncher — Quick Search (Spotlight-style Ctrl+K).
 *
 * Phase 39.1 — Spotlight overlay cho fast app launch.
 *
 * Hotkey: Ctrl+K (toàn cục trong launcher) → mở popup ở giữa màn hình.
 * Gõ tên app → fuzzy filter → ↑↓ chọn → Enter để:
 *   - App đã cài: launch trực tiếp
 *   - App chưa cài: mở download URL
 *   - App scheduled / coming_soon: hiện tooltip thời gian release
 *
 * Esc đóng popup.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppForUi } from '@trishteam/core/apps';
import type { InstallDetection } from '../install-types.js';
import { iconFor } from '../icons/index.js';

interface QuickSearchProps {
  apps: AppForUi[];
  installMap: Map<string, InstallDetection>;
  open: boolean;
  onClose: () => void;
  onLaunch: (app: AppForUi) => void;
  onSelectApp: (appId: string) => void;
}

export function QuickSearch({
  apps,
  installMap,
  open,
  onClose,
  onLaunch,
  onSelectApp,
}: QuickSearchProps): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query + focus input khi mở
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus sau 1 frame để input mounted
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Filter apps theo query (fuzzy: name + tagline + id)
  const filtered = useMemo(() => {
    if (!query.trim()) return apps;
    const q = query.trim().toLowerCase();
    return apps
      .map((app) => ({
        app,
        score: scoreMatch(app, q),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.app);
  }, [apps, query]);

  // Reset selected khi filter đổi
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const app = filtered[selectedIndex];
        if (app) handleSelect(app);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, selectedIndex, onClose]);

  function handleSelect(app: AppForUi): void {
    const det = installMap.get(app.id);
    if (det?.installed) {
      onLaunch(app);
    } else {
      onSelectApp(app.id);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        // Click backdrop → đóng. Stop propagation từ inner content.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '15vh',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 600,
          maxWidth: '90vw',
          maxHeight: '70vh',
          background: 'var(--color-surface-card, #fff)',
          color: 'var(--color-text-primary, #111827)',
          borderRadius: 14,
          border: '1px solid var(--color-border-subtle, #E5E7EB)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border-subtle, #E5E7EB)',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm app... (vd: office, drive, finance)"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              fontSize: 16,
              fontFamily: 'inherit',
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              padding: '3px 7px',
              background: 'var(--color-surface-row, #F3F4F6)',
              border: '1px solid var(--color-border-subtle, #E5E7EB)',
              borderRadius: 4,
              color: 'var(--color-text-muted, #6B7280)',
              fontFamily: 'monospace',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Result list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--color-text-muted, #9CA3AF)',
                fontSize: 13,
              }}
            >
              Không tìm thấy app nào khớp "<strong>{query}</strong>"
            </div>
          ) : (
            filtered.map((app, idx) => {
              const det = installMap.get(app.id);
              const installed = det?.installed ?? false;
              const isSelected = idx === selectedIndex;
              return (
                <ResultRow
                  key={app.id}
                  app={app}
                  installed={installed}
                  selected={isSelected}
                  onClick={() => handleSelect(app)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            background: 'var(--color-surface-row, #F9FAFB)',
            borderTop: '1px solid var(--color-border-subtle, #E5E7EB)',
            fontSize: 11,
            color: 'var(--color-text-muted, #6B7280)',
          }}
        >
          <span>{filtered.length} kết quả</span>
          <span style={{ display: 'flex', gap: 12 }}>
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> di chuyển
            </span>
            <span>
              <Kbd>↵</Kbd> mở
            </span>
            <span>
              <Kbd>Esc</Kbd> đóng
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Result row
// ============================================================
function ResultRow({
  app,
  installed,
  selected,
  onClick,
  onMouseEnter,
}: {
  app: AppForUi;
  installed: boolean;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}): JSX.Element {
  const Icon = iconFor(app.id);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px',
        background: selected
          ? 'var(--color-accent-soft, rgba(16,185,129,0.08))'
          : 'transparent',
        border: 'none',
        borderLeft: selected
          ? '3px solid var(--color-accent-primary, #10B981)'
          : '3px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon ? (
          <img
            src={Icon}
            alt={app.name}
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 26 }}>📦</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {app.name}
          <StatusBadge installed={installed} status={app.status} />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-muted, #6B7280)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {app.tagline}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          color: 'var(--color-text-muted, #9CA3AF)',
          fontFamily: 'monospace',
          flexShrink: 0,
        }}
      >
        {installed ? 'Mở' : 'Chi tiết'}
      </span>
    </button>
  );
}

function StatusBadge({
  installed,
  status,
}: {
  installed: boolean;
  status: string;
}): JSX.Element {
  if (installed) {
    return (
      <span
        style={{
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 600,
          background: 'var(--color-accent-primary, #10B981)',
          color: '#fff',
          borderRadius: 4,
        }}
      >
        ✓ Cài rồi
      </span>
    );
  }
  if (status === 'released' || status === 'active') {
    return (
      <span
        style={{
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 600,
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3B82F6',
          borderRadius: 4,
        }}
      >
        Tải về
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span
        style={{
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 600,
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#F59E0B',
          borderRadius: 4,
        }}
      >
        Sắp ra mắt
      </span>
    );
  }
  return (
    <span
      style={{
        padding: '1px 6px',
        fontSize: 10,
        fontWeight: 600,
        background: 'var(--color-surface-row, #F3F4F6)',
        color: 'var(--color-text-muted, #6B7280)',
        borderRadius: 4,
      }}
    >
      {status}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <kbd
      style={{
        padding: '1px 5px',
        fontSize: 10,
        background: 'var(--color-surface-card, #fff)',
        border: '1px solid var(--color-border-subtle, #E5E7EB)',
        borderRadius: 3,
        fontFamily: 'monospace',
      }}
    >
      {children}
    </kbd>
  );
}

// ============================================================
// Fuzzy scoring
// ============================================================
function scoreMatch(app: AppForUi, query: string): number {
  const name = app.name.toLowerCase();
  const tagline = (app.tagline ?? '').toLowerCase();
  const id = app.id.toLowerCase();

  // Exact match name = highest score
  if (name === query) return 1000;
  // Name starts with = high
  if (name.startsWith(query)) return 500;
  // ID starts with = high
  if (id.startsWith(query)) return 400;
  // Name contains = medium
  if (name.includes(query)) return 200;
  // ID contains = medium
  if (id.includes(query)) return 150;
  // Tagline contains = low
  if (tagline.includes(query)) return 50;
  // Loose: all chars in query exist in name in order (fuzzy)
  let i = 0;
  for (const ch of name) {
    if (ch === query[i]) i++;
    if (i >= query.length) return 25;
  }
  return 0;
}
