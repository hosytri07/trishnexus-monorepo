import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FulltextDoc,
  FulltextHit,
  FulltextIndex,
  FulltextSource,
  IndexStats,
} from '@trishteam/core/fulltext';
import {
  FULLTEXT_SOURCES,
  buildIndex,
  collectFulltextDocs,
  filterHitsBySource,
  parseQuery,
  searchIndex,
  sourceLabel,
  summarizeIndex,
} from '@trishteam/core/fulltext';
import {
  DEV_FALLBACK_DOCS,
  getDefaultStoreLocation,
  openByPath,
  pickAndScanTextFolder,
  pickLibraryFile,
  pickNotesFile,
  type EnvLocation,
  type ScannedTextFile,
} from './tauri-bridge.js';
import type { Note } from '@trishteam/core/notes';
import type { LibraryDoc } from '@trishteam/core/library';

const LIMIT = 60;

interface CorpusState {
  notes: Note[];
  libraryDocs: LibraryDoc[];
  files: ScannedTextFile[];
  notesPath: string | null;
  libraryPath: string | null;
  folderRoot: string | null;
  errors: string[];
}

function emptyCorpus(): CorpusState {
  return {
    notes: [],
    libraryDocs: [],
    files: [],
    notesPath: null,
    libraryPath: null,
    folderRoot: null,
    errors: [],
  };
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function App(): JSX.Element {
  const [env, setEnv] = useState<EnvLocation | null>(null);
  const [corpus, setCorpus] = useState<CorpusState>(emptyCorpus);
  const [usingFallback, setUsingFallback] = useState(false);

  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<FulltextSource | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchMs, setSearchMs] = useState<number | null>(null);
  const [indexMs, setIndexMs] = useState<number | null>(null);

  /* --------- Initial load: env + dev fallback docs ------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loc = await getDefaultStoreLocation();
        if (!alive) return;
        setEnv(loc);
      } catch (err) {
        if (alive) setFlash(`Lỗi env: ${String(err)}`);
      }
      // Nạp dev fallback để user thấy ngay demo trong browser dev.
      if (!alive) return;
      setUsingFallback(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* --------- Combined docs for indexing ----------------------------- */
  const docs: FulltextDoc[] = useMemo(() => {
    const fromCorpus = collectFulltextDocs({
      notes: corpus.notes,
      libraryDocs: corpus.libraryDocs,
      files: corpus.files.map((f) => ({
        path: f.path,
        content: f.content,
        mtimeMs: f.mtime_ms ?? Date.now(),
      })),
    });
    if (fromCorpus.length === 0 && usingFallback) {
      return DEV_FALLBACK_DOCS;
    }
    return fromCorpus;
  }, [corpus, usingFallback]);

  /* --------- Build index from docs --------------------------------- */
  const index: FulltextIndex = useMemo(() => {
    const t0 = performance.now();
    const idx = buildIndex(docs);
    setIndexMs(performance.now() - t0);
    return idx;
  }, [docs]);

  const stats: IndexStats = useMemo(() => summarizeIndex(index), [index]);

  /* --------- Run search -------------------------------------------- */
  const hits: FulltextHit[] = useMemo(() => {
    if (!query.trim()) {
      setSearchMs(null);
      return [];
    }
    const t0 = performance.now();
    const parsed = parseQuery(query);
    const now = Date.now();
    const raw = searchIndex(index, parsed, now, LIMIT);
    // Nếu user bấm source pill, lọc thêm (ngoài source filter trong query DSL).
    const filtered = filterHitsBySource(raw, sourceFilter);
    setSearchMs(performance.now() - t0);
    return filtered;
  }, [query, index, sourceFilter]);

  /* --------- Keyboard shortcuts ------------------------------------ */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'Escape') {
        setQuery('');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* --------- Auto-select first hit --------------------------------- */
  useEffect(() => {
    if (hits.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !hits.find((h) => h.doc.id === selectedId)) {
      setSelectedId(hits[0]?.doc.id ?? null);
    }
  }, [hits, selectedId]);

  const selectedHit = hits.find((h) => h.doc.id === selectedId) ?? null;

  /* --------- Source loaders ---------------------------------------- */
  async function onLoadNotes() {
    setFlash('Đang chọn notes.json…');
    try {
      const notes = await pickNotesFile();
      if (notes == null) {
        setFlash('Huỷ chọn notes.json.');
        return;
      }
      setCorpus((prev) => ({
        ...prev,
        notes,
        notesPath: 'notes.json',
      }));
      setUsingFallback(false);
      setFlash(`Đã nạp ${notes.length} ghi chú.`);
    } catch (err) {
      setFlash(`Lỗi load notes: ${String(err)}`);
    }
  }

  async function onLoadLibrary() {
    setFlash('Đang chọn library.json…');
    try {
      const libraryDocs = await pickLibraryFile();
      if (libraryDocs == null) {
        setFlash('Huỷ chọn library.json.');
        return;
      }
      setCorpus((prev) => ({
        ...prev,
        libraryDocs,
        libraryPath: 'library.json',
      }));
      setUsingFallback(false);
      setFlash(`Đã nạp ${libraryDocs.length} tài liệu thư viện.`);
    } catch (err) {
      setFlash(`Lỗi load library: ${String(err)}`);
    }
  }

  async function onScanFolder() {
    setFlash('Đang scan folder text…');
    try {
      const summary = await pickAndScanTextFolder();
      if (summary == null) {
        setFlash('Huỷ scan folder.');
        return;
      }
      setCorpus((prev) => ({
        ...prev,
        files: summary.files,
        folderRoot: summary.root,
        errors: summary.errors,
      }));
      setUsingFallback(false);
      setFlash(
        `Đã scan ${summary.files.length} file text (thăm ${summary.total_files_visited} file, ${formatElapsed(summary.elapsed_ms)}).`,
      );
    } catch (err) {
      setFlash(`Lỗi scan folder: ${String(err)}`);
    }
  }

  function onResetCorpus() {
    setCorpus(emptyCorpus);
    setUsingFallback(true);
    setFlash('Đã reset corpus về dữ liệu demo.');
  }

  async function onOpenSelected() {
    if (!selectedHit || !selectedHit.doc.path) return;
    await openByPath(selectedHit.doc.path);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">TrishSearch</span>
          <span className="brand-tag">BM25 · Ghi chú + Thư viện + File rời</span>
        </div>
        <div className="actions">
          <button type="button" onClick={onLoadNotes}>
            📝 Nạp notes.json
          </button>
          <button type="button" onClick={onLoadLibrary}>
            📚 Nạp library.json
          </button>
          <button type="button" onClick={onScanFolder}>
            📁 Scan folder text
          </button>
          <button type="button" className="ghost" onClick={onResetCorpus}>
            ↺ Dùng demo
          </button>
        </div>
      </header>

      <div className="searchbar">
        <input
          ref={searchRef}
          type="search"
          placeholder="Gõ từ khoá — hỗ trợ -loại, *prefix, &quot;cụm từ&quot;, note:/library:/file:"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="source-pills">
          <button
            type="button"
            className={sourceFilter == null ? 'pill active' : 'pill'}
            onClick={() => setSourceFilter(null)}
          >
            Tất cả ({stats.totalDocs})
          </button>
          {FULLTEXT_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              className={sourceFilter === s ? 'pill active' : 'pill'}
              onClick={() => setSourceFilter(s)}
            >
              {sourceLabel(s)} ({stats.bySource[s]})
            </button>
          ))}
        </div>
      </div>

      <section className="statusbar">
        <span>
          📂 <code>{env?.data_dir ?? '…'}</code>
        </span>
        <span>·</span>
        <span>
          Ghi chú: <b>{corpus.notes.length}</b>
        </span>
        <span>
          Thư viện: <b>{corpus.libraryDocs.length}</b>
        </span>
        <span>
          File rời: <b>{corpus.files.length}</b>
        </span>
        <span>·</span>
        <span>
          Index: <b>{stats.totalDocs}</b> doc · <b>{stats.totalTerms}</b> term · avg{' '}
          <b>{stats.avgDocLen}</b> tok
          {indexMs != null && <> ({formatElapsed(indexMs)} build)</>}
        </span>
        {searchMs != null && (
          <span>
            · Search: <b>{formatElapsed(searchMs)}</b> → {hits.length} hit
          </span>
        )}
        {usingFallback && <span className="chip warn">· demo data</span>}
        {flash && <span className="flash">{flash}</span>}
      </section>

      <main className="layout">
        <aside className="sidebar">
          <h3>Gợi ý cú pháp</h3>
          <ul className="hint-list">
            <li>
              <code>react hook</code> — cả hai từ (AND)
            </li>
            <li>
              <code>react -legacy</code> — loại trừ
            </li>
            <li>
              <code>typ*</code> — prefix match
            </li>
            <li>
              <code>&quot;kết cấu bê tông&quot;</code> — cụm từ
            </li>
            <li>
              <code>library:react</code> — lọc nguồn
            </li>
          </ul>
          <h3>Top term (df)</h3>
          <ul className="term-list">
            {stats.topTerms.slice(0, 12).map((t) => (
              <li key={t.term}>
                <code>{t.term}</code>
                <span>{t.df}</span>
              </li>
            ))}
            {stats.topTerms.length === 0 && <li className="muted">(chưa có term)</li>}
          </ul>
          {corpus.errors.length > 0 && (
            <>
              <h3>Lỗi scan</h3>
              <ul className="error-list">
                {corpus.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {corpus.errors.length > 5 && (
                  <li className="muted">… và {corpus.errors.length - 5} lỗi nữa</li>
                )}
              </ul>
            </>
          )}
        </aside>

        <section className="results">
          {query.trim() === '' ? (
            <div className="empty">
              <p>
                🔍 Gõ từ khoá để tìm. Mẹo: <kbd>Ctrl+K</kbd> focus ô tìm kiếm,{' '}
                <kbd>Esc</kbd> xoá query.
              </p>
              <p className="muted">
                Index có <b>{stats.totalDocs}</b> tài liệu sẵn sàng query.
              </p>
            </div>
          ) : hits.length === 0 ? (
            <div className="empty">
              <p>😶 Không tìm thấy kết quả cho “{query}”.</p>
              <p className="muted">Thử bỏ bớt clause, bỏ dấu <code>-</code>, hoặc đổi source.</p>
            </div>
          ) : (
            <ul className="hit-list">
              {hits.map((h) => (
                <li
                  key={h.doc.id}
                  className={h.doc.id === selectedId ? 'hit active' : 'hit'}
                  onClick={() => setSelectedId(h.doc.id)}
                >
                  <div className="hit-title">
                    <span className={`source-tag source-${h.doc.source}`}>
                      {sourceLabel(h.doc.source)}
                    </span>
                    <span className="title-text">{h.doc.title || '(không tiêu đề)'}</span>
                    <span className="score">{h.score.toFixed(2)}</span>
                  </div>
                  <p
                    className="hit-snippet"
                    dangerouslySetInnerHTML={{ __html: h.snippet }}
                  />
                  <div className="hit-meta">
                    {h.doc.path && <code>{h.doc.path}</code>}
                    {h.doc.tags?.slice(0, 4).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                    <span className="muted">
                      {new Date(h.doc.mtimeMs).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="detail">
          {selectedHit ? (
            <div className="detail-inner">
              <div className="detail-head">
                <span className={`source-tag source-${selectedHit.doc.source}`}>
                  {sourceLabel(selectedHit.doc.source)}
                </span>
                <h2>{selectedHit.doc.title || '(không tiêu đề)'}</h2>
              </div>
              {selectedHit.doc.path && (
                <div className="detail-path">
                  <code>{selectedHit.doc.path}</code>
                  <button type="button" className="mini" onClick={onOpenSelected}>
                    Mở bằng OS
                  </button>
                </div>
              )}
              <div className="detail-meta">
                <span>
                  Score <b>{selectedHit.score.toFixed(3)}</b>
                </span>
                <span>·</span>
                <span>
                  Match: {selectedHit.matchedTerms.map((t) => (
                    <code key={t}>{t}</code>
                  ))}
                </span>
                <span>·</span>
                <span>
                  Cập nhật{' '}
                  {new Date(selectedHit.doc.mtimeMs).toLocaleString('vi-VN')}
                </span>
              </div>
              {selectedHit.doc.tags && selectedHit.doc.tags.length > 0 && (
                <div className="detail-tags">
                  {selectedHit.doc.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="detail-body">{selectedHit.doc.body || '(trống)'}</div>
            </div>
          ) : (
            <div className="empty">
              <p className="muted">Chọn 1 kết quả để xem chi tiết.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
