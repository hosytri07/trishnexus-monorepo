/**
 * TrishSearch App.tsx — Phase 17.3 Layer 1.
 *
 * UX:
 *  - Sidebar trái: list "Vị trí tìm kiếm" (local + LAN UNC) — add/remove/reindex
 *  - Search bar trên: query + mode (Tên / Nội dung / Cả hai) + filters
 *  - Results giữa: list file với match highlight
 *  - Detail phải: thông tin file + nút Mở / Mở folder
 *  - Settings modal: theme + font size + update check
 *
 * Mục đích chính: tìm file trên máy local + LAN nội bộ — KHÔNG còn pick
 * từng file JSON như alpha cũ.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SEARCH_QUERY,
  addLocation,
  formatBytes,
  formatRelativeTime,
  getAppVersion,
  getDefaultStoreLocation,
  getOcrStatus,
  indexLocation,
  listLocations,
  listOcrCandidates,
  openContainingFolder,
  openFile,
  pickLocalFolder,
  preScanLocation,
  readFileBytes,
  removeLocation,
  renameLocation,
  searchFiles,
  updateFileOcr,
  type EnvLocation,
  type IndexResult,
  type IndexedFile,
  type PreScanResult,
  type SearchHit,
  type SearchLocation,
  type SearchMode,
  type SearchQuery,
  type SearchResponse,
} from './tauri-bridge.js';
import { SettingsModal } from './SettingsModal.js';
import { applySettings, loadSettings, type AppSettings } from './settings.js';
import {
  getOcrEngine,
  isOcrCandidate,
  type OcrLanguage,
  type OcrProgress,
} from './ocr-engine.js';
import {
  estimateRemainingSec,
  formatDurationSec,
  getOcrQueue,
  type QueueState,
} from './ocr-queue.js';
import logoUrl from './assets/logo.png';

const SEARCH_DEBOUNCE_MS = 250;

export function App(): JSX.Element {
  const [env, setEnv] = useState<EnvLocation | null>(null);
  const [appVersion, setAppVersion] = useState('dev');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [locations, setLocations] = useState<SearchLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [query, setQuery] = useState<SearchQuery>(DEFAULT_SEARCH_QUERY);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [indexFlash, setIndexFlash] = useState<string | null>(null);

  const [extFilterInput, setExtFilterInput] = useState('');

  // Stage 4b — Bulk OCR queue
  const [ocrCandidates, setOcrCandidates] = useState<IndexedFile[]>([]);
  const [queueState, setQueueState] = useState<QueueState>(() =>
    getOcrQueue().getState(),
  );
  const [pendingBulkLocId, setPendingBulkLocId] = useState<string | 'all' | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Apply theme + font size
  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  // Initial load
  useEffect(() => {
    void getAppVersion().then(setAppVersion);
    void getDefaultStoreLocation().then(setEnv).catch(() => {});
    void refreshLocations();
  }, []);

  async function refreshLocations(): Promise<void> {
    try {
      const list = await listLocations();
      setLocations(list);
    } catch (err) {
      console.warn('[trishsearch] list locations fail:', err);
    }
  }

  async function refreshOcrCandidates(): Promise<void> {
    try {
      const list = await listOcrCandidates();
      setOcrCandidates(list);
    } catch (err) {
      console.warn('[trishsearch] list OCR candidates fail:', err);
    }
  }

  // Subscribe queue state changes
  useEffect(() => {
    const queue = getOcrQueue();
    const unsub = queue.subscribe((s) => {
      setQueueState(s);
      // Khi queue idle (vừa xong) → refresh candidates + search
      if (s.status === 'idle') {
        void refreshOcrCandidates();
        void runSearch();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh OCR candidates khi locations thay đổi
  useEffect(() => {
    void refreshOcrCandidates();
  }, [locations]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locations]);

  async function runSearch(): Promise<void> {
    setSearching(true);
    try {
      const r = await searchFiles(query);
      setResults(r);
    } catch (err) {
      console.warn('[trishsearch] search fail:', err);
    } finally {
      setSearching(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && !inField) {
        setSelectedPath(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const selectedHit = useMemo(() => {
    if (!selectedPath || !results) return null;
    return results.hits.find((h) => h.file.path === selectedPath) ?? null;
  }, [selectedPath, results]);

  // ===== Handlers =====

  async function handleAddLocalFolder(): Promise<void> {
    const picked = await pickLocalFolder();
    if (!picked) return;
    await tryAddLocation(picked);
  }

  async function handleAddUncPath(path: string): Promise<void> {
    if (!path.trim()) return;
    await tryAddLocation(path.trim());
  }

  async function tryAddLocation(path: string): Promise<void> {
    try {
      // Pre-scan để cảnh báo nếu folder lớn
      let preScan: PreScanResult | null = null;
      try {
        preScan = await preScanLocation(path);
      } catch {
        /* skip pre-scan nếu lỗi (LAN slow) */
      }

      if (preScan) {
        const tooMany = preScan.total_files > 100_000;
        const tooBig = preScan.total_bytes > 10 * 1024 ** 3; // 10GB
        if (tooMany || tooBig || preScan.limit_reached) {
          const ok = window.confirm(
            `Thư mục này rất lớn:\n\n` +
              `📁 ${preScan.total_files.toLocaleString('vi-VN')} file\n` +
              `💾 ${formatBytes(preScan.total_bytes)}\n` +
              `📋 ${preScan.indexable_files.toLocaleString('vi-VN')} file index được\n\n` +
              `Index có thể mất vài phút. Tiếp tục thêm vị trí này?`,
          );
          if (!ok) return;
        }
      }

      const loc = await addLocation(path);
      await refreshLocations();
      setActiveLocationId(loc.id);
      setShowAddLocation(false);
      setIndexFlash(`✓ Đã thêm "${loc.name}". Đang index...`);
      void runIndex(loc.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi thêm vị trí: ${msg}`);
    }
  }

  async function runIndex(locationId: string): Promise<void> {
    setIndexingId(locationId);
    try {
      const result: IndexResult = await indexLocation(locationId);
      await refreshLocations();
      await refreshOcrCandidates();
      const loc = locations.find((l) => l.id === locationId);
      setIndexFlash(
        `✓ Đã index "${loc?.name ?? locationId}": ${result.indexed_files.toLocaleString('vi-VN')} file (${formatBytes(result.total_bytes)}, ${(result.elapsed_ms / 1000).toFixed(1)}s)` +
          (result.limit_reached ? ' · ⚠ Vượt giới hạn 200k file' : ''),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setIndexFlash(`⚠ Lỗi index: ${msg}`);
    } finally {
      setIndexingId(null);
      // Re-run search để áp index mới
      void runSearch();
    }
  }

  async function handleRemoveLocation(loc: SearchLocation): Promise<void> {
    const ok = window.confirm(
      `Xoá vị trí "${loc.name}"?\n\n${loc.indexed_files.toLocaleString('vi-VN')} file đã index sẽ bị xoá khỏi index. File gốc trên ổ KHÔNG bị động đến.`,
    );
    if (!ok) return;
    try {
      await removeLocation(loc.id);
      await refreshLocations();
      if (activeLocationId === loc.id) setActiveLocationId(null);
      setIndexFlash(`✓ Đã xoá "${loc.name}"`);
      void runSearch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi xoá: ${msg}`);
    }
  }

  async function handleRenameLocation(loc: SearchLocation): Promise<void> {
    const newName = window.prompt('Đổi tên vị trí:', loc.name);
    if (!newName?.trim() || newName.trim() === loc.name) return;
    try {
      await renameLocation(loc.id, newName.trim());
      await refreshLocations();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi đổi tên: ${msg}`);
    }
  }

  function patchQuery<K extends keyof SearchQuery>(key: K, value: SearchQuery[K]): void {
    setQuery((prev) => ({ ...prev, [key]: value }));
  }

  // ===== Bulk OCR =====

  /** Files cần OCR cho 1 location (hoặc tất cả nếu locId='all'). */
  function getBulkFiles(locId: string | 'all'): IndexedFile[] {
    if (locId === 'all') return ocrCandidates;
    return ocrCandidates.filter((f) => f.location_id === locId);
  }

  /** Map location_id → số file cần OCR (cho badge sidebar). */
  const ocrPendingByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of ocrCandidates) {
      map.set(f.location_id, (map.get(f.location_id) ?? 0) + 1);
    }
    return map;
  }, [ocrCandidates]);

  async function handleStartBulkOcr(locId: string | 'all'): Promise<void> {
    const files = getBulkFiles(locId);
    if (files.length === 0) return;
    setPendingBulkLocId(null);
    try {
      const ocrSettings = await getOcrStatus();
      const lang = (ocrSettings.languages || 'vie+eng') as OcrLanguage;
      await getOcrQueue().start(files, lang);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi OCR queue: ${msg}`);
    }
  }

  function handleAbortQueue(): void {
    getOcrQueue().abort();
  }

  function handleCloseQueueBar(): void {
    getOcrQueue().reset();
  }

  function applyExtFilter(): void {
    const exts = extFilterInput
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase().replace(/^\./, ''))
      .filter((s) => s.length > 0);
    patchQuery('extensions', exts);
  }

  // ===== Render =====

  const totalIndexed = locations.reduce((sum, l) => sum + l.indexed_files, 0);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="TrishSearch" className="brand-logo" />
          <strong className="brand-name">TrishSearch</strong>
        </div>
        <div className="topbar-stats muted small">
          {totalIndexed > 0 && (
            <>
              📚 {totalIndexed.toLocaleString('vi-VN')} file đã index ·{' '}
              {locations.length} vị trí
            </>
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            className="topbar-icon"
            onClick={() => setShowSettings(true)}
            title="Cài đặt"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Search bar */}
      <div className="searchbar-row">
        <input
          ref={searchInputRef}
          type="search"
          className="search-input"
          placeholder="Tìm tên file hoặc nội dung… (Ctrl+K)"
          value={query.query}
          onChange={(e) => patchQuery('query', e.target.value)}
          autoFocus
        />
        <div className="mode-toggle">
          {(['name', 'content', 'both'] as SearchMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`pill-btn ${query.mode === m ? 'active' : ''}`}
              onClick={() => patchQuery('mode', m)}
            >
              {m === 'name' ? '📄 Tên' : m === 'content' ? '🔍 Nội dung' : '🎯 Cả hai'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-row">
        <label className="filter-item">
          <span className="muted small">Đuôi file:</span>
          <input
            type="text"
            placeholder="vd: pdf, docx, txt"
            value={extFilterInput}
            onChange={(e) => setExtFilterInput(e.target.value)}
            onBlur={applyExtFilter}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyExtFilter();
            }}
          />
        </label>
        <label className="filter-item">
          <span className="muted small">Sửa từ:</span>
          <input
            type="date"
            onChange={(e) => {
              const ts = e.target.value ? new Date(e.target.value).getTime() : 0;
              patchQuery('modified_after_ms', ts);
            }}
          />
        </label>
        <label className="filter-item">
          <span className="muted small">đến:</span>
          <input
            type="date"
            onChange={(e) => {
              const ts = e.target.value ? new Date(e.target.value).getTime() : 0;
              patchQuery('modified_before_ms', ts);
            }}
          />
        </label>
        <label className="filter-item">
          <span className="muted small">KB tối thiểu:</span>
          <input
            type="number"
            min={0}
            placeholder="0"
            onChange={(e) => {
              const v = Number(e.target.value);
              patchQuery('min_size_bytes', isFinite(v) ? v * 1024 : 0);
            }}
          />
        </label>
        <span className="filter-spacer" />
        {searching && <span className="muted small">⏳ đang tìm…</span>}
        {results && !searching && (
          <span className="muted small">
            {results.hits.length} kết quả · {results.elapsed_ms} ms · index{' '}
            {results.total_indexed.toLocaleString('vi-VN')} file
          </span>
        )}
      </div>

      {indexFlash && (
        <div className="flash-bar" onClick={() => setIndexFlash(null)}>
          {indexFlash} <span className="muted small">(click để đóng)</span>
        </div>
      )}

      <main className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <h3>📍 Vị trí tìm kiếm</h3>
            <button
              type="button"
              className="mini-add"
              onClick={() => setShowAddLocation(true)}
              title="Thêm thư mục local hoặc LAN"
            >
              +
            </button>
          </div>
          {locations.length === 0 && (
            <p className="muted small" style={{ padding: '6px 10px' }}>
              Chưa có vị trí nào. Bấm + để thêm thư mục local hoặc LAN
              (\\server\share).
            </p>
          )}
          <ul className="location-list">
            {locations.map((loc) => {
              const pendingOcr = ocrPendingByLocation.get(loc.id) ?? 0;
              return (
                <li
                  key={loc.id}
                  className={`location-row ${activeLocationId === loc.id ? 'active' : ''}`}
                >
                  <div className="location-main" onClick={() => setActiveLocationId(loc.id)}>
                    <div className="location-name">
                      <span className={`kind-tag kind-${loc.kind}`}>
                        {loc.kind === 'lan' ? '🌐' : '💻'}
                      </span>
                      <span className="location-title">{loc.name}</span>
                    </div>
                    <div className="location-path muted small" title={loc.path}>
                      {loc.path}
                    </div>
                    <div className="location-stats muted small">
                      {loc.indexed_files > 0
                        ? `${loc.indexed_files.toLocaleString('vi-VN')} file · ${formatBytes(loc.indexed_bytes)} · ${formatRelativeTime(loc.last_indexed_at)}`
                        : 'chưa index'}
                    </div>
                    {pendingOcr > 0 && (
                      <button
                        type="button"
                        className="ocr-pending-pill"
                        title={`${pendingOcr} file PDF/ảnh chưa OCR`}
                        disabled={queueState.status !== 'idle'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingBulkLocId(loc.id);
                        }}
                      >
                        🔍 OCR {pendingOcr} file
                      </button>
                    )}
                  </div>
                  <div className="location-actions">
                    <button
                      type="button"
                      className="loc-btn"
                      title="Quét lại"
                      disabled={indexingId !== null}
                      onClick={() => void runIndex(loc.id)}
                    >
                      {indexingId === loc.id ? '⏳' : '🔄'}
                    </button>
                    <button
                      type="button"
                      className="loc-btn"
                      title="Đổi tên"
                      onClick={() => void handleRenameLocation(loc)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="loc-btn loc-btn-danger"
                      title="Xoá"
                      onClick={() => void handleRemoveLocation(loc)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="sidebar-foot">
            <p className="muted small" style={{ fontSize: 11 }}>
              💡 Layer 1: chỉ index file text + code. PDF/DOCX/XLSX/OCR sẽ
              thêm ở Layer 2-3.
            </p>
          </div>
        </aside>

        {/* Results */}
        <section className="results">
          {/* Smart prompt: query có ký tự + còn file chưa OCR → đề xuất bulk */}
          {query.query.trim() !== '' &&
            ocrCandidates.length > 0 &&
            queueState.status === 'idle' && (
              <div className="search-ocr-hint">
                <span>
                  💡 Có{' '}
                  <strong>
                    {ocrCandidates.length.toLocaleString('vi-VN')} file PDF/ảnh
                  </strong>{' '}
                  chưa OCR — có thể chứa "
                  <em>{query.query}</em>" mà chưa search được.
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setPendingBulkLocId('all')}
                >
                  🔍 Quét tất cả
                </button>
              </div>
            )}

          {results && results.hits.length === 0 && query.query.trim() !== '' && (
            <div className="empty">
              <p>😶 Không tìm thấy file nào khớp "{query.query}".</p>
              <p className="muted small">
                Thử bỏ filter, đổi mode, hoặc index thêm vị trí.
              </p>
            </div>
          )}

          {results && results.hits.length === 0 && query.query.trim() === '' && (
            <div className="empty">
              <p>🔍 Gõ từ khoá để tìm file (theo tên hoặc nội dung).</p>
              {totalIndexed === 0 ? (
                <p className="muted">
                  Chưa có file nào được index. Thêm vị trí ở sidebar trái rồi
                  bấm 🔄.
                </p>
              ) : (
                <p className="muted">
                  Đã sẵn sàng search trên {totalIndexed.toLocaleString('vi-VN')}{' '}
                  file.
                </p>
              )}
            </div>
          )}

          {results && results.hits.length > 0 && (
            <ul className="hit-list">
              {results.hits.map((h) => (
                <HitRow
                  key={h.file.path}
                  hit={h}
                  selected={selectedPath === h.file.path}
                  onClick={() => setSelectedPath(h.file.path)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Detail */}
        <aside className="detail">
          {selectedHit ? (
            <DetailPane
              hit={selectedHit}
              onOcrDone={() => void runSearch()}
            />
          ) : (
            <div className="empty">
              <p className="muted small">Chọn 1 file để xem chi tiết.</p>
            </div>
          )}
        </aside>
      </main>

      {/* OCR Queue Bar — sticky bottom khi running/aborting */}
      {queueState.status !== 'idle' && (
        <OcrQueueBar
          state={queueState}
          onAbort={handleAbortQueue}
          onClose={handleCloseQueueBar}
        />
      )}
      {/* Hiện queue summary cho 1-2 giây sau khi xong (khi có items + idle) */}
      {queueState.status === 'idle' && queueState.items.length > 0 && (
        <OcrQueueBar
          state={queueState}
          onAbort={handleAbortQueue}
          onClose={handleCloseQueueBar}
        />
      )}

      <footer className="statusbar">
        <span className="muted small">
          📂 <code>{env?.data_dir ?? '…'}</code>
        </span>
        <span className="muted small">v{appVersion}</span>
      </footer>

      {showAddLocation && (
        <AddLocationModal
          onLocal={() => void handleAddLocalFolder()}
          onUnc={(p) => void handleAddUncPath(p)}
          onClose={() => setShowAddLocation(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          appVersion={appVersion}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {pendingBulkLocId !== null && (
        <BulkOcrModal
          files={getBulkFiles(pendingBulkLocId)}
          locationName={
            pendingBulkLocId === 'all'
              ? 'tất cả vị trí'
              : locations.find((l) => l.id === pendingBulkLocId)?.name ?? '?'
          }
          onStart={() => void handleStartBulkOcr(pendingBulkLocId)}
          onClose={() => setPendingBulkLocId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function HitRow({
  hit,
  selected,
  onClick,
}: {
  hit: SearchHit;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <li
      className={`hit ${selected ? 'active' : ''} match-${hit.match_in}`}
      onClick={onClick}
    >
      <div className="hit-row-top">
        <span className="hit-name">{hit.file.name}</span>
        <span className={`match-badge match-${hit.match_in}`}>
          {hit.match_in === 'name'
            ? 'tên'
            : hit.match_in === 'content'
              ? 'nội dung'
              : hit.match_in === 'both'
                ? 'cả hai'
                : ''}
        </span>
        <span className="muted small">{hit.score.toFixed(1)}</span>
      </div>
      <div className="hit-path muted small" title={hit.file.path}>
        {hit.file.path}
      </div>
      {hit.snippet && <div className="hit-snippet muted">{hit.snippet}</div>}
      <div className="hit-meta muted small">
        {hit.file.ext && <span className="ext-chip">.{hit.file.ext}</span>}
        <span>{formatBytes(hit.file.size_bytes)}</span>
        <span>·</span>
        <span>{formatRelativeTime(hit.file.mtime_ms)}</span>
      </div>
    </li>
  );
}

function DetailPane({
  hit,
  onOcrDone,
}: {
  hit: SearchHit;
  onOcrDone?: () => void;
}): JSX.Element {
  const [ocring, setOcring] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const canOcr = isOcrCandidate(hit.file.ext) && !hit.file.has_content;

  async function handleOcr(): Promise<void> {
    if (ocring) return;
    setOcring(true);
    setOcrError(null);
    try {
      // Lấy languages từ settings (default vie+eng)
      const ocrSettings = await getOcrStatus();
      const lang = (ocrSettings.languages || 'vie+eng') as OcrLanguage;

      const bytes = await readFileBytes(hit.file.path);
      const engine = getOcrEngine();

      let text: string;
      if (hit.file.ext === 'pdf') {
        text = await engine.ocrPdf(bytes, lang, setOcrProgress);
      } else {
        text = await engine.ocrImage(bytes, lang, setOcrProgress);
      }

      if (text.trim().length === 0) {
        setOcrError('OCR không tìm thấy text nào trong file này.');
      } else {
        await updateFileOcr(hit.file.path, text);
        onOcrDone?.();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOcrError(`Lỗi OCR: ${msg}`);
    } finally {
      setOcring(false);
      setOcrProgress(null);
    }
  }

  return (
    <div className="detail-inner">
      <header className="detail-head">
        <h2>{hit.file.name}</h2>
        <p className="muted small detail-path-line" title={hit.file.path}>
          {hit.file.path}
        </p>
      </header>

      <div className="detail-actions">
        <button
          className="btn btn-primary"
          onClick={() => void openFile(hit.file.path)}
        >
          📂 Mở file
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void openContainingFolder(hit.file.path)}
        >
          📁 Mở thư mục chứa
        </button>
        {canOcr && (
          <button
            className="btn btn-primary"
            onClick={() => void handleOcr()}
            disabled={ocring}
            title="Dùng Tesseract.js + PDF.js trong app — không cần internet"
          >
            {ocring ? '⏳ Đang OCR…' : '🔍 OCR file này'}
          </button>
        )}
      </div>

      {/* OCR progress */}
      {(ocring || ocrProgress) && (
        <div className="ocr-progress-block">
          <div className="ocr-progress-msg">
            {ocrProgress?.message ?? 'Đang chuẩn bị…'}
            {ocrProgress?.page && ocrProgress?.totalPages && (
              <span className="muted small">
                {' '}· trang {ocrProgress.page}/{ocrProgress.totalPages}
              </span>
            )}
          </div>
          <div className="ocr-progress-bar">
            <div
              className="ocr-progress-fill"
              style={{ width: `${ocrProgress?.progress ?? 0}%` }}
            />
          </div>
          <p className="muted small" style={{ marginTop: 4, fontSize: 11 }}>
            💡 OCR có thể mất 30s-2 phút tuỳ độ dày file. App vẫn dùng được trong
            lúc OCR.
          </p>
        </div>
      )}

      {ocrError && (
        <div className="ocr-error-block">
          {ocrError}
        </div>
      )}

      <dl className="detail-dl">
        <dt>Đuôi</dt>
        <dd>.{hit.file.ext || '(không có)'}</dd>
        <dt>Kích thước</dt>
        <dd>{formatBytes(hit.file.size_bytes)}</dd>
        <dt>Sửa lần cuối</dt>
        <dd>{new Date(hit.file.mtime_ms).toLocaleString('vi-VN')}</dd>
        <dt>Match</dt>
        <dd>{hit.match_in}</dd>
        <dt>Score</dt>
        <dd>{hit.score.toFixed(2)}</dd>
        {hit.file.content_truncated && (
          <>
            <dt>⚠ Lưu ý</dt>
            <dd className="muted">Content đã bị cắt vì file quá lớn (&gt; 1MB)</dd>
          </>
        )}
      </dl>

      {hit.file.has_content && hit.file.content ? (
        <div className="detail-content">
          <h3 className="muted small">Preview nội dung</h3>
          <pre>{hit.file.content.slice(0, 4000)}</pre>
          {hit.file.content.length > 4000 && (
            <p className="muted small">… ({hit.file.content.length} ký tự)</p>
          )}
        </div>
      ) : (
        <NoPreviewBlock ext={hit.file.ext} />
      )}
    </div>
  );
}

/**
 * Block hiển thị khi file chưa có content (PDF/DOCX/XLSX/ảnh/video...)
 * Lấp khoảng trống dưới detail panel + giải thích cho user.
 */
function NoPreviewBlock({ ext }: { ext: string }): JSX.Element {
  const info = describeFileType(ext);
  return (
    <div className="no-preview">
      <div className="no-preview-icon">{info.icon}</div>
      <div className="no-preview-title">{info.title}</div>
      <p className="muted small no-preview-desc">{info.desc}</p>
      {info.layerNote && (
        <p className="muted small no-preview-note">💡 {info.layerNote}</p>
      )}
    </div>
  );
}

interface FileTypeInfo {
  icon: string;
  title: string;
  desc: string;
  layerNote?: string;
}

function describeFileType(ext: string): FileTypeInfo {
  const e = ext.toLowerCase();
  if (e === 'pdf') {
    return {
      icon: '📄',
      title: 'Tài liệu PDF',
      desc: 'Bấm "Mở file" để xem bằng app PDF mặc định.',
      layerNote:
        'Layer 2 sẽ extract text từ PDF text-based. Layer 3 sẽ OCR PDF scan để search nội dung.',
    };
  }
  if (e === 'doc' || e === 'docx') {
    return {
      icon: '📝',
      title: 'Tài liệu Word',
      desc: 'Bấm "Mở file" để xem bằng Microsoft Word hoặc tương đương.',
      layerNote: 'Layer 2 sẽ extract text từ DOCX để search nội dung.',
    };
  }
  if (e === 'xls' || e === 'xlsx') {
    return {
      icon: '📊',
      title: 'Bảng tính Excel',
      desc: 'Bấm "Mở file" để xem bằng Microsoft Excel.',
      layerNote: 'Layer 2 sẽ extract text từ XLSX để search nội dung ô.',
    };
  }
  if (e === 'ppt' || e === 'pptx') {
    return {
      icon: '🎬',
      title: 'Slide PowerPoint',
      desc: 'Bấm "Mở file" để xem bằng PowerPoint.',
    };
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'tif'].includes(e)) {
    return {
      icon: '🖼',
      title: 'File ảnh',
      desc: 'Bấm "Mở file" để xem bằng app ảnh mặc định.',
      layerNote: 'Layer 3 sẽ OCR ảnh chứa văn bản tiếng Việt.',
    };
  }
  if (['mp4', 'avi', 'mkv', 'mov', 'webm', 'flv', 'wmv'].includes(e)) {
    return {
      icon: '🎞',
      title: 'Video',
      desc: 'Bấm "Mở file" để xem bằng player mặc định.',
    };
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(e)) {
    return {
      icon: '🎵',
      title: 'Audio',
      desc: 'Bấm "Mở file" để nghe bằng player mặc định.',
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(e)) {
    return {
      icon: '📦',
      title: 'Archive nén',
      desc: 'Bấm "Mở file" để giải nén bằng 7-Zip / WinRAR.',
    };
  }
  if (['exe', 'msi', 'dll', 'iso'].includes(e)) {
    return {
      icon: '⚙',
      title: 'File hệ thống / cài đặt',
      desc: 'Cẩn thận khi mở file .exe — chỉ mở từ nguồn tin cậy.',
    };
  }
  return {
    icon: '📁',
    title: `File .${e || '(không có đuôi)'}`,
    desc: 'Loại file này hiện chỉ search được theo tên. Bấm "Mở file" để xem.',
  };
}

/**
 * OCR Queue Bar — sticky bottom toolbar.
 * Hiện khi queue chạy hoặc vừa xong (cho user thấy summary).
 */
function OcrQueueBar({
  state,
  onAbort,
  onClose,
}: {
  state: QueueState;
  onAbort: () => void;
  onClose: () => void;
}): JSX.Element {
  const total = state.items.length;
  const done = state.items.filter((i) => i.status === 'done').length;
  const error = state.items.filter((i) => i.status === 'error').length;
  const skipped = state.items.filter((i) => i.status === 'skipped').length;
  const completed = done + error + skipped;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const current = state.items[state.currentIndex];
  const isRunning = state.status === 'running';
  const isAborting = state.status === 'aborting';
  const isFinished = state.status === 'idle';

  const eta = isRunning ? estimateRemainingSec(state) : 0;

  return (
    <div className={`ocr-queue-bar ${isFinished ? 'finished' : ''}`}>
      <div className="queue-info">
        <strong>{isFinished ? '✓ OCR queue' : '🔍 OCR queue'}</strong>
        <span className="muted small">
          {completed}/{total} file
          {done > 0 && <> · ✓ {done}</>}
          {skipped > 0 && <> · ⊘ {skipped}</>}
          {error > 0 && <> · ⚠ {error}</>}
          {isRunning && eta > 0 && <> · còn ~{formatDurationSec(eta)}</>}
        </span>
      </div>

      <div className="queue-progress-wrap">
        <div className="queue-progress-bar">
          <div className="queue-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {isRunning && current && (
          <div className="queue-current muted small">
            <span>⏳ {current.file.name}</span>
            {state.currentProgress && (
              <span> · {state.currentProgress.message}</span>
            )}
          </div>
        )}
        {isAborting && (
          <div className="queue-current muted small">
            ⏳ Đang dừng sau khi xong file hiện tại…
          </div>
        )}
      </div>

      <div className="queue-actions">
        {isRunning && (
          <button
            type="button"
            className="btn btn-ghost mini-btn-danger"
            onClick={onAbort}
          >
            ✕ Dừng
          </button>
        )}
        {isFinished && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ✓ Đóng
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Bulk OCR confirm modal. Hiển thị estimate + breakdown trước khi start.
 */
function BulkOcrModal({
  files,
  locationName,
  onStart,
  onClose,
}: {
  files: IndexedFile[];
  locationName: string;
  onStart: () => void;
  onClose: () => void;
}): JSX.Element {
  const totalFiles = files.length;
  const pdfCount = files.filter((f) => f.ext === 'pdf').length;
  const imageCount = totalFiles - pdfCount;
  // Heuristic estimate: PDF ~30s, image ~10s
  const estimateSec = pdfCount * 30 + imageCount * 10;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <header className="modal-head">
          <h2>🔍 Quét OCR bulk</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <p>
            Sẽ OCR <strong>{totalFiles.toLocaleString('vi-VN')} file</strong>{' '}
            trong <em>{locationName}</em>:
          </p>
          <ul style={{ marginTop: 6 }}>
            {pdfCount > 0 && <li>📄 {pdfCount} PDF scan</li>}
            {imageCount > 0 && <li>🖼 {imageCount} ảnh</li>}
          </ul>
          <p style={{ marginTop: 12 }}>
            Ước tính: <strong>~{formatDurationSec(estimateSec)}</strong> (tùy
            tốc độ máy)
          </p>
          <p className="muted small" style={{ marginTop: 8 }}>
            ✓ App vẫn dùng được trong khi OCR (chạy nền Web Worker)
            <br />
            ✓ Có thể dừng giữa chừng — file đã OCR vẫn được lưu
            <br />
            ✓ Mỗi PDF dày OCR tối đa 50 trang đầu
          </p>
        </div>
        <div className="review-actions" style={{ padding: 12 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" onClick={onStart}>
            🔍 Bắt đầu OCR
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLocationModal({
  onLocal,
  onUnc,
  onClose,
}: {
  onLocal: () => void;
  onUnc: (path: string) => void;
  onClose: () => void;
}): JSX.Element {
  const [uncPath, setUncPath] = useState('');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <header className="modal-head">
          <h2>📍 Thêm vị trí tìm kiếm</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <h3>💻 Thư mục trên máy này</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Chọn thư mục bất kỳ trên ổ cứng máy mình.
            </p>
            <button className="btn btn-primary" onClick={onLocal}>
              Chọn thư mục…
            </button>
          </section>

          <section className="settings-section">
            <h3>🌐 LAN — máy khác trong mạng nội bộ</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Nhập đường dẫn UNC: <code>\\tên-máy\thư-mục-share</code> hoặc{' '}
              <code>\\192.168.1.10\Public</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={uncPath}
                onChange={(e) => setUncPath(e.target.value)}
                placeholder="\\\\server\\share"
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && uncPath.trim()) {
                    onUnc(uncPath);
                  }
                }}
              />
              <button
                className="btn btn-primary"
                onClick={() => onUnc(uncPath)}
                disabled={!uncPath.trim()}
              >
                Thêm
              </button>
            </div>
            <p className="muted small" style={{ marginTop: 8, fontSize: 11 }}>
              💡 Máy share folder phải bật File Sharing và cấp quyền truy cập
              cho user của Trí.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
