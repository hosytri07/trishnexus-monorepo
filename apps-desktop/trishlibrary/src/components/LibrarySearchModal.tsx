/**
 * Phase 18.1.b — Library full-text search modal.
 *
 * Build Tantivy index từ list path đã scan → search PDF/TXT/MD nội dung.
 * Snippet 160 ký tự xung quanh từ khóa, click → mở file.
 */

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SearchHit {
  path: string;
  name: string;
  parent: string;
  score: number;
  snippet: string;
}

interface IndexResult {
  files_indexed: number;
  files_skipped: number;
  bytes_indexed: number;
  elapsed_ms: number;
}

interface Props {
  /** Absolute paths của tất cả file đã scan trong thư viện. */
  allPaths: string[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

export function LibrarySearchModal({
  allPaths,
  onClose,
  onOpenFile,
  tr,
}: Props): JSX.Element {
  void tr;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(false);
  const [indexInfo, setIndexInfo] = useState<IndexResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void invoke<boolean>('library_index_status')
      .then((ok) => setIndexed(ok))
      .catch(() => setIndexed(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (!query.trim() || !indexed) {
      setHits([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void runSearch(query);
    }, 250);
    return (): void => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, indexed]);

  async function runSearch(q: string): Promise<void> {
    setSearching(true);
    setErr(null);
    try {
      const results = await invoke<SearchHit[]>('library_search', {
        query: q,
        limit: 30,
      });
      setHits(results);
    } catch (e) {
      setErr(String(e));
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function buildIndex(): Promise<void> {
    if (allPaths.length === 0) {
      setErr('Chưa có file nào trong thư viện. Quét thư mục trước.');
      return;
    }
    setIndexing(true);
    setErr(null);
    setIndexInfo(null);
    try {
      const result = await invoke<IndexResult>('library_index_build', {
        root: '',
        paths: allPaths,
      });
      setIndexInfo(result);
      setIndexed(true);
      if (query.trim()) await runSearch(query);
    } catch (e) {
      setErr(String(e));
    } finally {
      setIndexing(false);
    }
  }

  async function clearIndex(): Promise<void> {
    if (!window.confirm('Xóa toàn bộ index? Cần build lại để search được.')) return;
    try {
      await invoke('library_index_clear');
      setIndexed(false);
      setHits([]);
      setIndexInfo(null);
    } catch (e) {
      setErr(String(e));
    }
  }

  function highlightSnippet(snippet: string, q: string): JSX.Element[] {
    if (!q.trim()) return [<span key="0">{snippet}</span>];
    const lower = snippet.toLowerCase();
    const qLower = q.toLowerCase();
    const out: JSX.Element[] = [];
    let cursor = 0;
    let match = lower.indexOf(qLower, cursor);
    let key = 0;
    while (match !== -1) {
      if (match > cursor) {
        out.push(<span key={key++}>{snippet.slice(cursor, match)}</span>);
      }
      out.push(
        <mark key={key++} className="lib-search-hl">
          {snippet.slice(match, match + qLower.length)}
        </mark>,
      );
      cursor = match + qLower.length;
      match = lower.indexOf(qLower, cursor);
    }
    if (cursor < snippet.length) {
      out.push(<span key={key++}>{snippet.slice(cursor)}</span>);
    }
    return out;
  }

  return (
    <div className="modal-backdrop lib-search-backdrop" onClick={onClose}>
      <div
        className="lib-search-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Library full-text search"
      >
        <header className="lib-search-head">
          <h2 style={{ margin: 0, fontSize: 16 }}>
            🔍 Tìm trong nội dung file (PDF / TXT / MD)
          </h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="lib-search-input-row">
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="lib-search-input"
            placeholder="Gõ từ khóa để tìm trong nội dung file…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!indexed || indexing}
          />
        </div>

        <div className="lib-search-toolbar">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void buildIndex()}
            disabled={indexing || allPaths.length === 0}
            title={`${allPaths.length} file sẽ được index`}
          >
            {indexing
              ? '⏳ Đang index…'
              : indexed
                ? '🔄 Build lại index'
                : '⚡ Tạo index'}
          </button>
          {indexed && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => void clearIndex()}
              disabled={indexing}
            >
              🗑 Xóa index
            </button>
          )}
          <span className="muted small" style={{ marginLeft: 8 }}>
            {indexed ? '✓ Đã index' : 'Chưa index'} · {allPaths.length} file trong thư viện
          </span>
        </div>

        {indexInfo && (
          <div className="lib-search-stats muted small">
            ✓ Index xong: <strong>{indexInfo.files_indexed}</strong> file
            {indexInfo.files_skipped > 0 && (
              <> · skip <strong>{indexInfo.files_skipped}</strong></>
            )}
            {' · '}
            <strong>{(indexInfo.bytes_indexed / 1024 / 1024).toFixed(1)} MB</strong>
            {' · '}
            <strong>{(indexInfo.elapsed_ms / 1000).toFixed(1)}s</strong>
          </div>
        )}

        {err && (
          <div className="lib-search-error">⚠ {err}</div>
        )}

        <div className="lib-search-results">
          {!indexed ? (
            <div className="lib-search-empty muted">
              <p>📚 Bấm "⚡ Tạo index" để bắt đầu</p>
              <p className="small">
                Index sẽ trích text từ tất cả PDF, TXT, MD trong thư viện.
                Build 1 lần, search nhanh mãi sau đó.
              </p>
            </div>
          ) : !query.trim() ? (
            <div className="lib-search-empty muted">
              <p>🔍 Nhập từ khóa để tìm trong nội dung file</p>
              <p className="small">
                Hỗ trợ: từ đơn, cụm từ trong dấu nháy "tcvn 5574", AND/OR.
              </p>
            </div>
          ) : searching ? (
            <div className="lib-search-empty muted">⏳ Đang tìm…</div>
          ) : hits.length === 0 ? (
            <div className="lib-search-empty muted">
              Không tìm thấy "<strong>{query}</strong>" trong index.
            </div>
          ) : (
            <ul className="lib-search-list">
              {hits.map((hit, i) => (
                <li key={`${hit.path}-${i}`} className="lib-search-item">
                  <button
                    className="lib-search-item-btn"
                    onClick={() => onOpenFile(hit.path)}
                    title={hit.path}
                  >
                    <div className="lib-search-item-head">
                      <strong>{hit.name}</strong>
                      <span className="muted small">score {hit.score.toFixed(2)}</span>
                    </div>
                    <div className="muted small lib-search-item-parent">{hit.parent}</div>
                    <div className="lib-search-item-snippet">
                      {highlightSnippet(hit.snippet, query)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="lib-search-foot muted small">
          {hits.length > 0 ? `${hits.length} kết quả` : 'Tantivy + pdf-extract · 100% offline'}
        </footer>
      </div>
    </div>
  );
}
