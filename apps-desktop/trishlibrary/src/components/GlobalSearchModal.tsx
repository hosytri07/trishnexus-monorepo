/**
 * Phase 18.4.a — Global Ctrl+K search.
 *
 * Tìm xuyên 4 module:
 *   - 📝 Notes: title + content (toàn bộ)
 *   - 🖼 Ảnh: tên file thật + display_name + per-image note + folder name
 *   - 📚 Library: filename trong cached scan
 *   - 📄 Documents: tab name (open tabs)
 *
 * Click result → switch module + (nếu có) auto-select item qua localStorage hint.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModuleId } from '../AppShell.js';

interface SearchResult {
  module: ModuleId;
  icon: string;
  title: string;
  subtitle?: string;
  matchHint?: string;
  // Optional: hint key to localStorage that the target module reads on mount.
  selectKey?: { storageKey: string; value: string };
}

interface Props {
  onClose: () => void;
  onSwitchModule: (m: ModuleId) => void;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

export function GlobalSearchModal({ onClose, onSwitchModule, tr }: Props): JSX.Element {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => searchAllModules(query), [query]);

  // Reset highlighted index when query changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  function pick(r: SearchResult): void {
    if (r.selectKey) {
      try {
        window.localStorage.setItem(r.selectKey.storageKey, r.selectKey.value);
      } catch {
        /* ignore */
      }
    }
    onSwitchModule(r.module);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) pick(r);
    }
  }

  // Group results by module for nicer display
  const grouped = useMemo(() => {
    const order: ModuleId[] = ['note', 'image', 'library', 'document'];
    const map: Record<ModuleId, SearchResult[]> = {
      library: [],
      note: [],
      document: [],
      image: [],
    };
    results.forEach((r) => map[r.module].push(r));
    return order
      .filter((m) => map[m].length > 0)
      .map((m) => ({ module: m, items: map[m] }));
  }, [results]);

  return (
    <div className="modal-backdrop global-search-backdrop" onClick={onClose}>
      <div
        className="global-search-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Global search"
      >
        <div className="global-search-input-row">
          <span className="global-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder="Tìm trong toàn bộ TrishLibrary… (Ghi chú · Ảnh · Thư viện · Tài liệu)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd className="global-search-kbd">Esc</kbd>
        </div>

        <div className="global-search-body">
          {!query.trim() ? (
            <div className="global-search-empty">
              <p className="muted small">
                Bắt đầu gõ để tìm. Có thể dùng <kbd>↑</kbd> <kbd>↓</kbd> để chọn,{' '}
                <kbd>Enter</kbd> để mở.
              </p>
              <div className="global-search-tips">
                <p className="muted small">
                  💡 Tìm theo nội dung trong{' '}
                  <strong>Ghi chú</strong>, ghi chú/đổi tên{' '}
                  <strong>Ảnh</strong>, tên file{' '}
                  <strong>Thư viện</strong>, tên tab{' '}
                  <strong>Tài liệu</strong>.
                </p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="global-search-empty">
              <p className="muted small">
                Không tìm thấy "<strong>{query}</strong>".
              </p>
            </div>
          ) : (
            <div className="global-search-results">
              {grouped.map((group) => {
                let runningIdx = 0;
                for (const g of grouped) {
                  if (g.module === group.module) break;
                  runningIdx += g.items.length;
                }
                return (
                  <div key={group.module} className="global-search-group">
                    <div className="global-search-group-head">
                      {moduleLabelOf(group.module, tr)} · {group.items.length}
                    </div>
                    {group.items.map((r, i) => {
                      const idx = runningIdx + i;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`global-search-item ${idx === activeIdx ? 'active' : ''}`}
                          onClick={() => pick(r)}
                          onMouseEnter={() => setActiveIdx(idx)}
                        >
                          <span className="global-search-item-icon">{r.icon}</span>
                          <div className="global-search-item-text">
                            <strong className="global-search-item-title">
                              {r.title}
                            </strong>
                            {r.subtitle && (
                              <span className="muted small global-search-item-sub">
                                {r.subtitle}
                              </span>
                            )}
                            {r.matchHint && (
                              <span className="global-search-item-hint">
                                {r.matchHint}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="global-search-footer muted small">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> Chọn · <kbd>Enter</kbd> Mở · <kbd>Esc</kbd> Đóng
          </span>
          <span>{results.length} kết quả</span>
        </div>
      </div>
    </div>
  );
}

function moduleLabelOf(
  m: ModuleId,
  tr: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (m) {
    case 'library':
      return `📚 ${tr('module.library')}`;
    case 'note':
      return `📝 ${tr('module.note')}`;
    case 'document':
      return `📄 ${tr('module.document')}`;
    case 'image':
      return `🖼 ${tr('module.image')}`;
  }
}

// ============================================================
// Search per module — read directly from localStorage stores
// ============================================================

const MAX_PER_MODULE = 8;

function searchAllModules(rawQuery: string): SearchResult[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  return [
    ...searchNotes(q),
    ...searchImages(q),
    ...searchLibrary(q),
    ...searchDocuments(q),
  ];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function snippetAround(haystack: string, needle: string, maxLen = 90): string {
  const idx = haystack.toLowerCase().indexOf(needle);
  if (idx < 0) return haystack.slice(0, maxLen);
  const start = Math.max(0, idx - 30);
  const end = Math.min(haystack.length, idx + needle.length + 60);
  let snip = haystack.slice(start, end);
  if (start > 0) snip = '…' + snip;
  if (end < haystack.length) snip += '…';
  return snip.length > maxLen ? snip.slice(0, maxLen) + '…' : snip;
}

function searchNotes(q: string): SearchResult[] {
  try {
    // Try multiple known keys for note store
    const candidates = [
      'trishlibrary.note.store.v1',
      'trishlibrary.note.store',
      'trishnote.store.v1',
    ];
    let raw: string | null = null;
    for (const key of candidates) {
      raw = window.localStorage.getItem(key);
      if (raw) break;
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const notes: Array<{
      id: string;
      title?: string;
      content?: string;
      html?: string;
      category?: string;
      folder_id?: string;
      trashed?: boolean;
    }> = Array.isArray(parsed?.notes) ? parsed.notes : [];

    const results: SearchResult[] = [];
    for (const n of notes) {
      if (n.trashed) continue;
      const title = (n.title ?? '').trim();
      const contentText = stripHtml(n.html ?? n.content ?? '');
      const titleHit = title.toLowerCase().includes(q);
      const contentHit = contentText.toLowerCase().includes(q);
      if (!titleHit && !contentHit) continue;
      results.push({
        module: 'note',
        icon: n.category === 'project' ? '📂' : '📝',
        title: title || '(Chưa đặt tiêu đề)',
        subtitle: n.category === 'project' ? 'Dự án' : 'Cá nhân',
        matchHint: contentHit ? snippetAround(contentText, q) : undefined,
        selectKey: {
          storageKey: 'trishlibrary.note.pending_select',
          value: n.id,
        },
      });
      if (results.length >= MAX_PER_MODULE) break;
    }
    return results;
  } catch {
    return [];
  }
}

function searchImages(q: string): SearchResult[] {
  try {
    const raw = window.localStorage.getItem('trishlibrary.image.store.v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const folders: Array<{ id: string; name: string; path: string }> =
      Array.isArray(parsed?.folders) ? parsed.folders : [];
    const notes: Record<string, string> = parsed?.notes ?? {};
    const displayNames: Record<string, string> = parsed?.display_names ?? {};

    const results: SearchResult[] = [];

    // Match folders
    for (const f of folders) {
      if (
        f.name.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
      ) {
        results.push({
          module: 'image',
          icon: '📁',
          title: f.name,
          subtitle: f.path,
          matchHint: 'Thư mục ảnh',
          selectKey: {
            storageKey: 'trishlibrary.image.pending_folder',
            value: f.id,
          },
        });
      }
      if (results.length >= MAX_PER_MODULE) break;
    }

    // Match image notes
    for (const [path, note] of Object.entries(notes)) {
      if (results.length >= MAX_PER_MODULE) break;
      if (note.toLowerCase().includes(q)) {
        const fname = path.split(/[\\/]/).pop() ?? path;
        const display = displayNames[path] ?? fname;
        results.push({
          module: 'image',
          icon: '🖼',
          title: display,
          subtitle: path,
          matchHint: '📝 ' + snippetAround(note, q, 70),
          selectKey: {
            storageKey: 'trishlibrary.image.pending_select',
            value: path,
          },
        });
      }
    }

    // Match display names
    for (const [path, name] of Object.entries(displayNames)) {
      if (results.length >= MAX_PER_MODULE) break;
      if (name.toLowerCase().includes(q)) {
        const fname = path.split(/[\\/]/).pop() ?? path;
        if (fname.toLowerCase().includes(q)) continue; // already covered if filename matches
        results.push({
          module: 'image',
          icon: '✎',
          title: name,
          subtitle: `${path} (file thật: ${fname})`,
          matchHint: 'Tên hiển thị',
          selectKey: {
            storageKey: 'trishlibrary.image.pending_select',
            value: path,
          },
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

function searchLibrary(q: string): SearchResult[] {
  // Library files are persisted by App.tsx — try a couple of known keys
  try {
    const candidates = [
      'trishlibrary.lib_files.cache.v1',
      'trishlibrary.lib.scan.cache',
      'trishlibrary.files.cache',
    ];
    let raw: string | null = null;
    for (const key of candidates) {
      raw = window.localStorage.getItem(key);
      if (raw) break;
    }
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const files: Array<{ name?: string; rel_path?: string; path?: string }> =
      Array.isArray(arr) ? arr : Array.isArray(arr?.files) ? arr.files : [];
    const results: SearchResult[] = [];
    for (const f of files) {
      const name = f.name ?? '';
      const rel = f.rel_path ?? f.path ?? '';
      if (
        name.toLowerCase().includes(q) ||
        rel.toLowerCase().includes(q)
      ) {
        results.push({
          module: 'library',
          icon: '📄',
          title: name || rel,
          subtitle: rel,
          matchHint: 'File thư viện',
        });
      }
      if (results.length >= MAX_PER_MODULE) break;
    }
    return results;
  } catch {
    return [];
  }
}

function searchDocuments(q: string): SearchResult[] {
  try {
    const candidates = [
      'trishlibrary.doc.tabs.v1',
      'trishlibrary.doc.tabs',
    ];
    let raw: string | null = null;
    for (const key of candidates) {
      raw = window.localStorage.getItem(key);
      if (raw) break;
    }
    if (!raw) return [];
    const tabs: Array<{ id: string; name?: string; path?: string }> =
      JSON.parse(raw);
    if (!Array.isArray(tabs)) return [];
    const results: SearchResult[] = [];
    for (const t of tabs) {
      const name = t.name ?? '';
      const path = t.path ?? '';
      if (
        name.toLowerCase().includes(q) ||
        path.toLowerCase().includes(q)
      ) {
        results.push({
          module: 'document',
          icon: '📄',
          title: name || '(Tab không tên)',
          subtitle: path || '(chưa lưu)',
          matchHint: 'Tab tài liệu',
          selectKey: {
            storageKey: 'trishlibrary.doc.pending_tab',
            value: t.id,
          },
        });
      }
      if (results.length >= MAX_PER_MODULE) break;
    }
    return results;
  } catch {
    return [];
  }
}
