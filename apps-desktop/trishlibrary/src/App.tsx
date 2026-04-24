import { useEffect, useMemo, useState } from 'react';
import { library } from '@trishteam/core';
import type {
  CiteStyle,
  DocFormat,
  LibraryDoc,
  ReadStatus,
} from '@trishteam/core/library';
import {
  exportLibraryAs,
  getDefaultStoreLocation,
  importLibraryFrom,
  loadLibrary,
  openDocument,
  pickAndScan,
  saveLibrary,
  type StoreLocation,
} from './tauri-bridge.js';

const STATUS_LABEL: Record<ReadStatus, string> = {
  unread: 'Chưa đọc',
  reading: 'Đang đọc',
  done: 'Đã đọc xong',
  abandoned: 'Bỏ dở',
};

const STATUS_COLOR: Record<ReadStatus, string> = {
  unread: 'var(--status-unread)',
  reading: 'var(--status-reading)',
  done: 'var(--status-done)',
  abandoned: 'var(--status-abandoned)',
};

const FORMAT_LABEL: Partial<Record<DocFormat, string>> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  epub: 'EPUB',
  txt: 'Text',
  md: 'Markdown',
  html: 'HTML',
  rtf: 'RTF',
  odt: 'ODT',
  unknown: 'Khác',
};

export function App(): JSX.Element {
  const [items, setItems] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<DocFormat | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReadStatus | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [citeStyle, setCiteStyle] = useState<CiteStyle>('apa');
  const [showCite, setShowCite] = useState(false);
  const [sortMode, setSortMode] = useState<'recent' | 'title' | 'size'>('recent');

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loc = await getDefaultStoreLocation();
        if (!alive) return;
        setLocation(loc);
        const result = await loadLibrary();
        if (!alive) return;
        setItems(result.docs);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Auto-save debounce 400 ms.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          setSavingFlash(true);
          await saveLibrary(items);
          setTimeout(() => setSavingFlash(false), 300);
        } catch (e) {
          setError(String(e));
          setSavingFlash(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [items, loading]);

  const summary = useMemo(() => library.summarizeLibrary(items), [items]);
  const tagIndex = useMemo(() => library.buildTagIndex(items), [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (search.trim()) list = library.searchDocs(list, search);
    list = library.filterByFormat(list, formatFilter);
    list = library.filterByStatus(list, statusFilter);
    list = library.filterByTag(list, tagFilter);
    if (sortMode === 'recent') return library.sortRecent(list);
    if (sortMode === 'title') return library.sortByTitle(list);
    return library.sortBySize(list);
  }, [items, search, formatFilter, statusFilter, tagFilter, sortMode]);

  const selected = useMemo(
    () => items.find((d) => d.id === selectedId) ?? null,
    [items, selectedId],
  );

  function updateDoc(id: string, patch: Partial<LibraryDoc>): void {
    setItems((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d,
      ),
    );
  }

  async function handleScan(): Promise<void> {
    setScanning(true);
    setError(null);
    try {
      const summary = await pickAndScan();
      if (!summary) {
        setScanning(false);
        return;
      }
      const now = Date.now();
      setItems((prev) => {
        const byPath = new Map(prev.map((d) => [d.path, d] as const));
        let added = 0;
        let updated = 0;
        for (const raw of summary.entries) {
          const existing = byPath.get(raw.path);
          if (existing) {
            const merged = library.mergeWithExisting(existing, raw);
            if (merged !== existing) {
              byPath.set(raw.path, merged);
              updated++;
            }
          } else {
            byPath.set(raw.path, library.enrichRaw(raw, now));
            added++;
          }
        }
        setScanInfo(
          `Đã quét ${summary.entries.length} tài liệu trong ${summary.elapsed_ms} ms — +${added} mới, ${updated} cập nhật${summary.errors.length ? ', ' + summary.errors.length + ' lỗi' : ''}.`,
        );
        return [...byPath.values()];
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  }

  async function handleImport(): Promise<void> {
    try {
      const imported = await importLibraryFrom();
      if (!imported) return;
      // Merge theo path — import là "source of truth" cho path đó.
      setItems((prev) => {
        const byPath = new Map(prev.map((d) => [d.path, d] as const));
        for (const d of imported) byPath.set(d.path, d);
        return [...byPath.values()];
      });
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const result = await exportLibraryAs(items);
      if (result) setScanInfo(`Đã xuất ${result.size_bytes} bytes → ${result.path}`);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleDelete(id: string): void {
    setItems((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function applyTag(id: string, tag: string): void {
    const normalized = library.normalizeLibraryTag(tag);
    if (!normalized) return;
    setItems((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        if (d.tags.includes(normalized)) return d;
        return { ...d, tags: [...d.tags, normalized], updatedAt: Date.now() };
      }),
    );
  }

  function removeTag(id: string, tag: string): void {
    setItems((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, tags: d.tags.filter((t) => t !== tag), updatedAt: Date.now() }
          : d,
      ),
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">📚</span>
          <div>
            <div className="brand-title">TrishLibrary</div>
            <div className="brand-sub">
              Thư viện tài liệu · Tag AI · Cite APA/IEEE
            </div>
          </div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Đang quét…' : '📂 Quét thư mục…'}
        </button>
        <button className="btn" onClick={handleImport}>
          ⬇ Nhập JSON
        </button>
        <button className="btn" onClick={handleExport}>
          ⬆ Xuất JSON
        </button>
        <button
          className="btn primary"
          disabled={filtered.length === 0}
          onClick={() => setShowCite(true)}
        >
          🔖 Trích dẫn ({filtered.length})
        </button>
        {savingFlash && <span className="saving-flash">đang lưu…</span>}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="side-block">
            <div className="side-label">Tìm kiếm</div>
            <input
              className="input"
              type="search"
              placeholder="Tìm trong tiêu đề / tác giả / tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </section>

          <section className="side-block">
            <div className="side-label">Tổng quan</div>
            <div className="stat-row">
              <span>Tổng</span>
              <strong>{summary.totalDocs}</strong>
            </div>
            <div className="stat-row">
              <span>Dung lượng</span>
              <strong>{library.formatBytes(summary.totalBytes)}</strong>
            </div>
            <div className="stat-row">
              <span>Đã đọc</span>
              <strong>{summary.byStatus.done}</strong>
            </div>
            <div className="stat-row">
              <span>Đang đọc</span>
              <strong>{summary.byStatus.reading}</strong>
            </div>
            <div className="stat-row">
              <span>Chưa đọc</span>
              <strong>{summary.byStatus.unread}</strong>
            </div>
          </section>

          <section className="side-block">
            <div className="side-label">Format</div>
            <div className="pill-row">
              <button
                className={'pill ' + (formatFilter == null ? 'active' : '')}
                onClick={() => setFormatFilter(null)}
              >
                Tất cả
              </button>
              {Object.entries(summary.byFormat).map(([fmt, count]) => (
                <button
                  key={fmt}
                  className={'pill ' + (formatFilter === fmt ? 'active' : '')}
                  onClick={() => setFormatFilter(fmt as DocFormat)}
                >
                  {FORMAT_LABEL[fmt as DocFormat] ?? fmt}
                  <span className="pill-count">{count}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="side-block">
            <div className="side-label">Trạng thái</div>
            <div className="pill-row">
              <button
                className={'pill ' + (statusFilter == null ? 'active' : '')}
                onClick={() => setStatusFilter(null)}
              >
                Tất cả
              </button>
              {(Object.keys(STATUS_LABEL) as ReadStatus[]).map((s) => (
                <button
                  key={s}
                  className={'pill ' + (statusFilter === s ? 'active' : '')}
                  onClick={() => setStatusFilter(s)}
                  style={
                    statusFilter === s
                      ? { background: STATUS_COLOR[s] + '33', borderColor: STATUS_COLOR[s] }
                      : undefined
                  }
                >
                  {STATUS_LABEL[s]}
                  <span className="pill-count">{summary.byStatus[s]}</span>
                </button>
              ))}
            </div>
          </section>

          {summary.topTags.length > 0 && (
            <section className="side-block">
              <div className="side-label">Tag phổ biến</div>
              <div className="pill-row">
                <button
                  className={'pill ' + (tagFilter == null ? 'active' : '')}
                  onClick={() => setTagFilter(null)}
                >
                  Tất cả
                </button>
                {summary.topTags.slice(0, 10).map((t) => (
                  <button
                    key={t.tag}
                    className={'pill ' + (tagFilter === t.tag ? 'active' : '')}
                    onClick={() => setTagFilter(t.tag)}
                  >
                    {t.tag}
                    <span className="pill-count">{t.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="side-block location">
            <div className="side-label">Lưu tại</div>
            <div className="location-path" title={location?.path ?? ''}>
              {location?.path ?? '—'}
            </div>
          </section>
        </aside>

        <main className="content">
          {error && (
            <div className="banner error" onClick={() => setError(null)}>
              ⚠ {error} — nhấn để ẩn
            </div>
          )}
          {scanInfo && !error && (
            <div className="banner info" onClick={() => setScanInfo(null)}>
              {scanInfo}
            </div>
          )}

          <div className="content-toolbar">
            <div className="result-count">
              Đang hiển thị {filtered.length} / {items.length} tài liệu
            </div>
            <div className="spacer" />
            <label className="sort-label">
              Sắp xếp:
              <select
                className="select"
                value={sortMode}
                onChange={(e) =>
                  setSortMode(e.target.value as 'recent' | 'title' | 'size')
                }
              >
                <option value="recent">Mới cập nhật</option>
                <option value="title">Tên A→Z</option>
                <option value="size">Dung lượng lớn→nhỏ</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="empty">Đang tải…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <p>Chưa có tài liệu nào khớp với bộ lọc.</p>
              <p style={{ opacity: 0.7 }}>
                Bấm <strong>Quét thư mục…</strong> để import sách/PDF từ máy.
              </p>
            </div>
          ) : (
            <ul className="doc-list">
              {filtered.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  selected={d.id === selectedId}
                  onSelect={() => setSelectedId(d.id)}
                  onOpen={() => {
                    updateDoc(d.id, {});
                    void openDocument(d.path);
                  }}
                />
              ))}
            </ul>
          )}
        </main>

        <aside className="detail">
          {selected ? (
            <DetailPane
              doc={selected}
              tagIndex={tagIndex}
              onChange={(patch) => updateDoc(selected.id, patch)}
              onAddTag={(t) => applyTag(selected.id, t)}
              onRemoveTag={(t) => removeTag(selected.id, t)}
              onOpen={() => void openDocument(selected.path)}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : (
            <div className="detail-empty">
              Chọn 1 tài liệu bên trái để xem + chỉnh metadata.
            </div>
          )}
        </aside>
      </div>

      {showCite && (
        <CiteModal
          docs={filtered}
          style={citeStyle}
          onStyleChange={setCiteStyle}
          onClose={() => setShowCite(false)}
        />
      )}
    </div>
  );
}

function DocRow({
  doc,
  selected,
  onSelect,
  onOpen,
}: {
  doc: LibraryDoc;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}): JSX.Element {
  return (
    <li
      className={'doc-row ' + (selected ? 'selected' : '')}
      style={{ borderLeftColor: STATUS_COLOR[doc.status] }}
      onClick={onSelect}
    >
      <div className="doc-main">
        <div className="doc-title">
          <span className="format-chip">
            {FORMAT_LABEL[doc.format] ?? doc.format}
          </span>
          {doc.title || doc.name}
        </div>
        <div className="doc-meta">
          {doc.authors.length > 0 && <span>{doc.authors.join(', ')}</span>}
          {doc.year != null && <span>· {doc.year}</span>}
          <span>· {library.formatBytes(doc.sizeBytes)}</span>
          <span
            className="status-chip"
            style={{ color: STATUS_COLOR[doc.status] }}
          >
            · {STATUS_LABEL[doc.status]}
          </span>
        </div>
        {doc.tags.length > 0 && (
          <div className="tag-row">
            {doc.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        className="btn tiny"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        Mở
      </button>
    </li>
  );
}

function DetailPane({
  doc,
  tagIndex,
  onChange,
  onAddTag,
  onRemoveTag,
  onOpen,
  onDelete,
}: {
  doc: LibraryDoc;
  tagIndex: Map<string, number>;
  onChange: (patch: Partial<LibraryDoc>) => void;
  onAddTag: (t: string) => void;
  onRemoveTag: (t: string) => void;
  onOpen: () => void;
  onDelete: () => void;
}): JSX.Element {
  const [tagInput, setTagInput] = useState('');

  const suggestions = useMemo(
    () =>
      library.suggestTags(
        {
          title: doc.title,
          name: doc.name,
          note: doc.note,
          format: doc.format,
          authors: doc.authors,
        },
        tagIndex,
        8,
      ).filter((s) => !doc.tags.includes(s.tag)),
    [doc.title, doc.name, doc.note, doc.format, doc.authors, doc.tags, tagIndex],
  );

  function commitTag(): void {
    const t = tagInput.trim();
    if (!t) return;
    onAddTag(t);
    setTagInput('');
  }

  return (
    <div className="detail-inner">
      <div className="detail-path" title={doc.path}>
        {doc.path}
      </div>
      <input
        className="input detail-title"
        value={doc.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Tiêu đề…"
      />

      <div className="detail-row">
        <label>Tác giả (cách nhau dấu phẩy)</label>
        <input
          className="input"
          value={doc.authors.join(', ')}
          onChange={(e) =>
            onChange({
              authors: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div className="detail-row two">
        <label>
          Năm
          <input
            className="input"
            type="number"
            value={doc.year ?? ''}
            onChange={(e) =>
              onChange({
                year: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          NXB
          <input
            className="input"
            value={doc.publisher ?? ''}
            onChange={(e) =>
              onChange({
                publisher: e.target.value === '' ? null : e.target.value,
              })
            }
          />
        </label>
      </div>

      <div className="detail-row">
        <label>Trạng thái</label>
        <div className="pill-row">
          {(Object.keys(STATUS_LABEL) as ReadStatus[]).map((s) => (
            <button
              key={s}
              className={'pill ' + (doc.status === s ? 'active' : '')}
              style={
                doc.status === s
                  ? { background: STATUS_COLOR[s] + '33', borderColor: STATUS_COLOR[s] }
                  : undefined
              }
              onClick={() => onChange({ status: s })}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-row">
        <label>Tag đã gán</label>
        <div className="tag-row">
          {doc.tags.length === 0 ? (
            <em className="muted">chưa có tag</em>
          ) : (
            doc.tags.map((t) => (
              <span key={t} className="tag removable">
                {t}
                <button
                  className="tag-x"
                  onClick={() => onRemoveTag(t)}
                  aria-label={'Bỏ tag ' + t}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="tag-input-row">
          <input
            className="input"
            placeholder="Thêm tag rồi Enter"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTag();
              }
            }}
          />
          <button className="btn tiny" onClick={commitTag}>
            +
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="detail-row">
          <label>Gợi ý tag (AI)</label>
          <div className="tag-row">
            {suggestions.map((s) => (
              <button
                key={s.tag}
                className="tag suggestion"
                title={s.reason + ` · score=${s.score.toFixed(2)}`}
                onClick={() => onAddTag(s.tag)}
              >
                + {s.tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="detail-row">
        <label>Ghi chú</label>
        <textarea
          className="input"
          rows={4}
          value={doc.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Ghi chú cá nhân về tài liệu này…"
        />
      </div>

      <div className="detail-actions">
        <button className="btn primary" onClick={onOpen}>
          🔗 Mở file
        </button>
        <button className="btn danger" onClick={onDelete}>
          🗑 Xoá khỏi library
        </button>
      </div>
    </div>
  );
}

function CiteModal({
  docs,
  style,
  onStyleChange,
  onClose,
}: {
  docs: LibraryDoc[];
  style: CiteStyle;
  onStyleChange: (s: CiteStyle) => void;
  onClose: () => void;
}): JSX.Element {
  const citations = useMemo(
    () => library.formatCitationList(docs, style),
    [docs, style],
  );

  function copyAll(): void {
    const text = citations.join('\n\n');
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Trích dẫn {docs.length} tài liệu</h3>
          <button className="btn tiny" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="pill-row" style={{ marginBottom: 12 }}>
            {library.CITE_STYLES.map((s) => (
              <button
                key={s}
                className={'pill ' + (style === s ? 'active' : '')}
                onClick={() => onStyleChange(s)}
              >
                {library.citeStyleLabel(s)}
              </button>
            ))}
            <div className="spacer" />
            <button className="btn tiny" onClick={copyAll}>
              📋 Copy all
            </button>
          </div>
          <ol className="cite-list">
            {citations.map((c, i) => (
              <li key={i}>
                <code>{c}</code>
              </li>
            ))}
          </ol>
          {citations.length === 0 && (
            <p className="muted">Không có tài liệu nào trong bộ lọc.</p>
          )}
        </div>
      </div>
    </div>
  );
}
