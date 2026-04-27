/**
 * TrishImage App.tsx — Phase 17.5 v2.
 *
 * Layout:
 *  - Sidebar trái: Locations (chọn 1 folder để xem) + Timeline (year/month) + Tags filter
 *  - Toolbar trên content: View modes (XL / L / M / S / Details) + sort
 *  - Main giữa: Grid view (XL/L/M/S — object-fit: contain) hoặc List details
 *  - Detail phải: photo metadata + tag editor + note + rename + similar photos
 *
 * View per folder: chỉ hiện ảnh của 1 location đang chọn (sidebar bấm chọn).
 * Hỗ trợ video: index .mp4/.mov/.avi/.mkv/.webm — play inline trong detail.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  DEFAULT_PHOTO_QUERY,
  addLocation,
  clearThumbnailCache,
  fileSrcUrl,
  formatBytes,
  formatRelativeTime,
  getAppVersion,
  getDefaultStoreLocation,
  getThumbnailDataUrl,
  groupPhotosByMonth,
  indexLocation,
  listAllTags,
  listLocations,
  openContainingFolder,
  openFile,
  pickLocalFolder,
  removeLocation,
  renameFile,
  renameLocation,
  searchPhotos,
  setPhotoNote,
  setPhotoTags,
  type EnvLocation,
  type IndexResult,
  type PhotoEntry,
  type PhotoLocation,
  type PhotoQuery,
  type PhotoQueryResult,
} from './tauri-bridge.js';
import { SettingsModal } from './SettingsModal.js';
import { applySettings, loadSettings, saveSettings, type AppSettings, type ViewMode } from './settings.js';
import logoUrl from './assets/logo.png';

const SEARCH_DEBOUNCE_MS = 250;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const VIEW_MODES: Array<{ v: ViewMode; label: string; tip: string }> = [
  { v: 'xl', label: '🖼', tip: 'Ảnh cực lớn (Ctrl+1)' },
  { v: 'l', label: '🖼', tip: 'Ảnh lớn (Ctrl+2)' },
  { v: 'm', label: '🖼', tip: 'Ảnh vừa (Ctrl+3)' },
  { v: 's', label: '▦', tip: 'Ảnh nhỏ (Ctrl+4)' },
  { v: 'details', label: '☰', tip: 'Chi tiết (Ctrl+5)' },
];

type SortMode = 'date_desc' | 'date_asc' | 'name_asc' | 'size_desc';

export function App(): JSX.Element {
  const [env, setEnv] = useState<EnvLocation | null>(null);
  const [appVersion, setAppVersion] = useState('dev');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [locations, setLocations] = useState<PhotoLocation[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  const [query, setQuery] = useState<PhotoQuery>(DEFAULT_PHOTO_QUERY);
  const [results, setResults] = useState<PhotoQueryResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [renamingLocation, setRenamingLocation] = useState<PhotoLocation | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date_desc');
  const [indexProgress, setIndexProgress] = useState<{
    locationId: string;
    stage: 'scanning' | 'processing' | 'done';
    current: number;
    total: number;
    currentFile: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  useEffect(() => {
    void getAppVersion().then(setAppVersion);
    void getDefaultStoreLocation().then(setEnv).catch(() => {});
    void refreshAll();
    return () => {
      clearThumbnailCache();
    };
  }, []);

  // Auto-pick location đầu tiên khi load xong
  useEffect(() => {
    if (!activeLocationId && locations.length > 0) {
      setActiveLocationId(locations[0].id);
    }
    // Nếu activeLocation bị xoá thì reset
    if (activeLocationId && !locations.find((l) => l.id === activeLocationId)) {
      setActiveLocationId(locations[0]?.id ?? null);
    }
  }, [locations, activeLocationId]);

  // Listen index-progress events từ Rust
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    (async () => {
      try {
        unlisten = await listen<{
          location_id: string;
          stage: string;
          current: number;
          total: number;
          current_file: string;
        }>('index-progress', (event) => {
          const p = event.payload;
          setIndexProgress({
            locationId: p.location_id,
            stage: p.stage as 'scanning' | 'processing' | 'done',
            current: p.current,
            total: p.total,
            currentFile: p.current_file,
          });
          if (p.stage === 'done') {
            setTimeout(() => setIndexProgress(null), 1500);
          }
        });
      } catch (err) {
        console.warn('[trishimage] listen progress fail:', err);
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  async function refreshAll(): Promise<void> {
    try {
      const [locs, tags] = await Promise.all([listLocations(), listAllTags()]);
      setLocations(locs);
      setAllTags(tags);
    } catch (err) {
      console.warn('[trishimage] refresh fail:', err);
    }
  }

  // Sync activeLocationId vào query.location_ids
  useEffect(() => {
    setQuery((prev) => ({
      ...prev,
      location_ids: activeLocationId ? [activeLocationId] : [],
    }));
    setSelectedPath(null);
    setActiveMonth(null);
  }, [activeLocationId]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch(): Promise<void> {
    setSearching(true);
    try {
      const r = await searchPhotos({ ...query, limit: 5000 });
      setResults(r);
    } catch (err) {
      console.warn('[trishimage] search fail:', err);
    } finally {
      setSearching(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && /^[1-5]$/.test(e.key) && !inField) {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const mode = VIEW_MODES[idx]?.v;
        if (mode) changeViewMode(mode);
      } else if (e.key === 'Escape' && !inField) {
        setSelectedPath(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function changeViewMode(mode: ViewMode): void {
    const next = { ...settings, viewMode: mode };
    setSettings(next);
    saveSettings(next);
  }

  const selectedPhoto = useMemo(() => {
    if (!selectedPath || !results) return null;
    return results.photos.find((p) => p.path === selectedPath) ?? null;
  }, [selectedPath, results]);

  const photosByMonth = useMemo(() => {
    if (!results) return new Map<string, PhotoEntry[]>();
    return groupPhotosByMonth(results.photos);
  }, [results]);

  const sortedMonths = useMemo(() => {
    return Array.from(photosByMonth.keys()).sort((a, b) => b.localeCompare(a));
  }, [photosByMonth]);

  const filteredPhotos = useMemo(() => {
    if (!results) return [];
    let arr = results.photos;
    if (activeMonth) {
      arr = arr.filter((p) => {
        const d = new Date(p.taken_ms);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return key === activeMonth;
      });
    }
    // Sort
    const sorted = [...arr];
    switch (sortMode) {
      case 'date_desc':
        sorted.sort((a, b) => b.taken_ms - a.taken_ms);
        break;
      case 'date_asc':
        sorted.sort((a, b) => a.taken_ms - b.taken_ms);
        break;
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        break;
      case 'size_desc':
        sorted.sort((a, b) => b.size_bytes - a.size_bytes);
        break;
    }
    return sorted;
  }, [results, activeMonth, sortMode]);

  // Similar photos: same day ±1 day, same location
  const similarPhotos = useMemo(() => {
    if (!selectedPhoto || !results) return [];
    return results.photos
      .filter(
        (p) =>
          p.path !== selectedPhoto.path &&
          p.location_id === selectedPhoto.location_id &&
          Math.abs(p.taken_ms - selectedPhoto.taken_ms) <= ONE_DAY_MS,
      )
      .sort((a, b) => Math.abs(a.taken_ms - selectedPhoto.taken_ms) - Math.abs(b.taken_ms - selectedPhoto.taken_ms))
      .slice(0, 8);
  }, [selectedPhoto, results]);

  // ===== Handlers =====

  async function handleAddLocalFolder(): Promise<void> {
    const picked = await pickLocalFolder();
    if (!picked) return;
    setShowAddLocation(false);
    await tryAddLocation(picked);
  }

  async function handleAddUncPath(uncPath: string): Promise<void> {
    if (!uncPath.trim()) return;
    setShowAddLocation(false);
    await tryAddLocation(uncPath.trim());
  }

  async function tryAddLocation(path: string): Promise<void> {
    try {
      const loc = await addLocation(path);
      await refreshAll();
      setActiveLocationId(loc.id);
      setFlash(`✓ Đã thêm "${loc.name}". Đang index ảnh + tạo thumbnail...`);
      void runIndex(loc.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi: ${msg}`);
    }
  }

  async function runIndex(locationId: string): Promise<void> {
    setIndexingId(locationId);
    try {
      const result: IndexResult = await indexLocation(locationId);
      await refreshAll();
      const loc = locations.find((l) => l.id === locationId);
      setFlash(
        `✓ Đã index "${loc?.name ?? locationId}": ${result.indexed_photos.toLocaleString('vi-VN')} file (${formatBytes(result.total_bytes)}, ${(result.elapsed_ms / 1000).toFixed(1)}s)` +
          (result.limit_reached ? ' · ⚠ Vượt giới hạn 100k' : ''),
      );
      void runSearch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlash(`⚠ Lỗi index: ${msg}`);
    } finally {
      setIndexingId(null);
    }
  }

  async function handleRemoveLocation(loc: PhotoLocation): Promise<void> {
    const ok = window.confirm(
      `Xoá vị trí "${loc.name}"?\n\n${loc.indexed_photos.toLocaleString('vi-VN')} ảnh sẽ bị xoá khỏi index + thumbnails. File gốc trên ổ KHÔNG bị động đến.`,
    );
    if (!ok) return;
    try {
      await removeLocation(loc.id);
      await refreshAll();
      setFlash(`✓ Đã xoá "${loc.name}"`);
      void runSearch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi: ${msg}`);
    }
  }

  function handleRenameLocation(loc: PhotoLocation): void {
    setRenamingLocation(loc);
  }

  async function commitRenameLocation(loc: PhotoLocation, newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === loc.name) {
      setRenamingLocation(null);
      return;
    }
    try {
      await renameLocation(loc.id, trimmed);
      await refreshAll();
      setFlash(`✓ Đã đổi tên "${loc.name}" → "${trimmed}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlash(`⚠ Lỗi đổi tên: ${msg}`);
    } finally {
      setRenamingLocation(null);
    }
  }

  function patchQuery<K extends keyof PhotoQuery>(key: K, value: PhotoQuery[K]): void {
    setQuery((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tag: string): void {
    const has = query.tags.includes(tag);
    patchQuery('tags', has ? query.tags.filter((t) => t !== tag) : [...query.tags, tag]);
  }

  async function handleSetPhotoTags(path: string, tagsInput: string): Promise<void> {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    try {
      await setPhotoTags(path, tags);
      await refreshAll();
      void runSearch();
    } catch (err) {
      window.alert(`Lỗi tag: ${err}`);
    }
  }

  async function handleSetPhotoNote(path: string, note: string): Promise<void> {
    try {
      await setPhotoNote(path, note);
      void runSearch();
    } catch (err) {
      window.alert(`Lỗi ghi chú: ${err}`);
    }
  }

  async function handleRenameFile(oldPath: string, newName: string): Promise<void> {
    try {
      const r = await renameFile(oldPath, newName);
      setSelectedPath(r.new_path);
      setFlash(`✓ Đã đổi tên: ${r.new_name}`);
      void runSearch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Lỗi đổi tên: ${msg}`);
    }
  }

  // ===== Render =====

  const totalIndexed = locations.reduce((sum, l) => sum + l.indexed_photos, 0);
  const activeLocation = locations.find((l) => l.id === activeLocationId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="TrishImage" className="brand-logo" />
          <strong className="brand-name">TrishImage</strong>
        </div>
        <div className="topbar-stats muted small">
          {totalIndexed > 0 && (
            <>
              📷 {totalIndexed.toLocaleString('vi-VN')} file đã index ·{' '}
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
          placeholder={
            activeLocation
              ? `Tìm trong "${activeLocation.name}"... (Ctrl+K)`
              : 'Tìm theo tên file hoặc tag... (Ctrl+K)'
          }
          value={query.query}
          onChange={(e) => patchQuery('query', e.target.value)}
          autoFocus
        />
      </div>

      <div className="filter-row">
        <label className="filter-item">
          <span className="muted small">Camera:</span>
          <input
            type="text"
            placeholder="Canon / iPhone / ..."
            value={query.camera_filter}
            onChange={(e) => patchQuery('camera_filter', e.target.value)}
          />
        </label>
        <label className="filter-item">
          <span className="muted small">Chụp từ:</span>
          <input
            type="date"
            onChange={(e) => {
              const ts = e.target.value ? new Date(e.target.value).getTime() : 0;
              patchQuery('date_after_ms', ts);
            }}
          />
        </label>
        <label className="filter-item">
          <span className="muted small">đến:</span>
          <input
            type="date"
            onChange={(e) => {
              const ts = e.target.value ? new Date(e.target.value).getTime() : 0;
              patchQuery('date_before_ms', ts);
            }}
          />
        </label>
        <label className="filter-item">
          <input
            type="checkbox"
            checked={query.gps_only}
            onChange={(e) => patchQuery('gps_only', e.target.checked)}
          />
          <span className="muted small">📍 chỉ ảnh có GPS</span>
        </label>
        <span className="filter-spacer" />
        {searching && <span className="muted small">⏳ đang tìm…</span>}
        {results && !searching && (
          <span className="muted small">
            {filteredPhotos.length.toLocaleString('vi-VN')}
            {activeMonth ? `/${results.photos.length}` : ''} file · {results.elapsed_ms} ms
          </span>
        )}
      </div>

      {/* Index progress bar — slim 1-row */}
      {indexProgress && (
        <div className={`index-progress-bar stage-${indexProgress.stage}`}>
          <div className="index-progress-info">
            <strong>
              {indexProgress.stage === 'scanning' && '🔍 Quét...'}
              {indexProgress.stage === 'processing' && '🖼 Xử lý'}
              {indexProgress.stage === 'done' && '✓ Hoàn tất'}
            </strong>
            {indexProgress.total > 0 && (
              <span className="muted small">
                {indexProgress.current.toLocaleString('vi-VN')}/{indexProgress.total.toLocaleString('vi-VN')}
                {' · '}
                {Math.round((indexProgress.current / indexProgress.total) * 100)}%
              </span>
            )}
          </div>
          <div className="index-progress-track">
            <div
              className={`index-progress-fill ${indexProgress.stage === 'scanning' && indexProgress.total === 0 ? 'indeterminate' : ''}`}
              style={
                indexProgress.total > 0
                  ? {
                      width: `${Math.round((indexProgress.current / indexProgress.total) * 100)}%`,
                    }
                  : undefined
              }
            />
          </div>
          <div className="index-progress-current" title={indexProgress.currentFile}>
            {indexProgress.currentFile}
          </div>
        </div>
      )}

      {flash && !indexProgress && (
        <div className="flash-bar" onClick={() => setFlash(null)}>
          {flash} <span className="muted small">(click để đóng)</span>
        </div>
      )}

      <main className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <section>
            <div className="section-head">
              <h3>📍 Vị trí</h3>
              <button className="mini-add" onClick={() => setShowAddLocation(true)} title="Thêm folder ảnh local hoặc LAN">
                +
              </button>
            </div>
            {locations.length === 0 && (
              <p className="muted small" style={{ padding: '6px 10px' }}>
                Chưa có folder nào. Bấm + để thêm folder ảnh.
              </p>
            )}
            <ul className="location-list">
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  className={`location-row ${activeLocationId === loc.id ? 'active' : ''}`}
                  onClick={() => setActiveLocationId(loc.id)}
                >
                  <div className="location-main">
                    <div className="location-name">
                      <span>{activeLocationId === loc.id ? '📂' : '📁'}</span>
                      <span className="location-title">{loc.name}</span>
                    </div>
                    <div className="location-stats muted small">
                      {loc.indexed_photos > 0
                        ? `${loc.indexed_photos.toLocaleString('vi-VN')} file · ${formatRelativeTime(loc.last_indexed_at)}`
                        : 'chưa index'}
                    </div>
                  </div>
                  <div className="location-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="loc-btn"
                      title="Quét lại"
                      disabled={indexingId !== null}
                      onClick={() => void runIndex(loc.id)}
                    >
                      {indexingId === loc.id ? '⏳' : '🔄'}
                    </button>
                    <button className="loc-btn" title="Đổi tên" onClick={() => void handleRenameLocation(loc)}>
                      ✎
                    </button>
                    <button className="loc-btn loc-btn-danger" title="Xoá" onClick={() => void handleRemoveLocation(loc)}>
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {sortedMonths.length > 0 && (
            <section>
              <h3>📅 Timeline</h3>
              <ul className="timeline-list">
                <li>
                  <button
                    className={`timeline-item ${activeMonth === null ? 'active' : ''}`}
                    onClick={() => setActiveMonth(null)}
                  >
                    <span>Tất cả</span>
                    <span className="count">{results?.photos.length ?? 0}</span>
                  </button>
                </li>
                {sortedMonths.map((m) => {
                  const photos = photosByMonth.get(m) ?? [];
                  const [yr, mo] = m.split('-');
                  return (
                    <li key={m}>
                      <button
                        className={`timeline-item ${activeMonth === m ? 'active' : ''}`}
                        onClick={() => setActiveMonth(m)}
                      >
                        <span>
                          {mo}/{yr}
                        </span>
                        <span className="count">{photos.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {allTags.length > 0 && (
            <section>
              <h3>🏷 Tags</h3>
              <div className="tag-list">
                {allTags.slice(0, 30).map((t) => (
                  <button
                    key={t}
                    className={`tag-pill ${query.tags.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Main content */}
        <section className="content">
          {/* View mode + sort toolbar */}
          <div className="view-toolbar">
            <div className="view-mode-group">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  className={`view-mode-btn view-mode-${m.v} ${settings.viewMode === m.v ? 'active' : ''}`}
                  title={m.tip}
                  onClick={() => changeViewMode(m.v)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <span className="filter-spacer" />
            <label className="filter-item">
              <span className="muted small">Sắp xếp:</span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                style={{
                  padding: '4px 8px',
                  background: 'var(--panel-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  fontSize: 12,
                }}
              >
                <option value="date_desc">📅 Mới nhất</option>
                <option value="date_asc">📅 Cũ nhất</option>
                <option value="name_asc">🔤 Tên A-Z</option>
                <option value="size_desc">💾 Size lớn nhất</option>
              </select>
            </label>
          </div>

          <div className={`content-scroll view-${settings.viewMode}`}>
            {locations.length === 0 && (
              <div className="empty">
                <p>📷 Chưa có folder nào.</p>
                <p className="muted">Bấm <strong>+</strong> ở sidebar để thêm folder ảnh.</p>
              </div>
            )}
            {locations.length > 0 && !activeLocation && (
              <div className="empty">
                <p className="muted">Chọn 1 folder ở sidebar trái để xem.</p>
              </div>
            )}
            {activeLocation && filteredPhotos.length === 0 && results && results.photos.length === 0 && (
              <div className="empty">
                <p>📷 Folder <strong>{activeLocation.name}</strong> chưa có file nào.</p>
                <p className="muted small">
                  Thử bấm 🔄 để index lại. Hỗ trợ JPG/PNG/WEBP/GIF/BMP/TIFF + MP4/MOV/AVI/MKV/WEBM.
                </p>
              </div>
            )}
            {activeLocation && filteredPhotos.length === 0 && results && results.photos.length > 0 && (
              <div className="empty">
                <p>😶 Không có file nào khớp filter.</p>
                <p className="muted small">Thử bỏ filter hoặc đổi tháng.</p>
              </div>
            )}
            {activeLocation && filteredPhotos.length > 0 && (
              settings.viewMode === 'details' ? (
                <DetailsTable
                  photos={filteredPhotos}
                  selectedPath={selectedPath}
                  onClick={setSelectedPath}
                />
              ) : (
                <ul className="photo-grid">
                  {filteredPhotos.map((p) => (
                    <PhotoCard
                      key={p.path}
                      photo={p}
                      selected={selectedPath === p.path}
                      onClick={() => setSelectedPath(p.path)}
                    />
                  ))}
                </ul>
              )
            )}
          </div>
        </section>

        {/* Detail */}
        <aside className="detail">
          {selectedPhoto ? (
            <PhotoDetail
              photo={selectedPhoto}
              similar={similarPhotos}
              onSelectSimilar={(p) => setSelectedPath(p)}
              onSetTags={(tags) => void handleSetPhotoTags(selectedPhoto.path, tags)}
              onSetNote={(note) => void handleSetPhotoNote(selectedPhoto.path, note)}
              onRename={(name) => void handleRenameFile(selectedPhoto.path, name)}
            />
          ) : (
            <div className="empty">
              <p className="muted small">Chọn 1 file để xem chi tiết.</p>
            </div>
          )}
        </aside>
      </main>

      <footer className="statusbar">
        <span className="muted small">
          📂 <code>{env?.data_dir ?? '…'}</code>
        </span>
        <span className="muted small">v{appVersion}</span>
      </footer>

      {showSettings && (
        <SettingsModal
          settings={settings}
          appVersion={appVersion}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAddLocation && (
        <AddLocationModal
          onLocal={() => void handleAddLocalFolder()}
          onUnc={(p) => void handleAddUncPath(p)}
          onClose={() => setShowAddLocation(false)}
        />
      )}

      {renamingLocation && (
        <RenameLocationModal
          location={renamingLocation}
          onSubmit={(name) => void commitRenameLocation(renamingLocation, name)}
          onClose={() => setRenamingLocation(null)}
        />
      )}
    </div>
  );
}

function RenameLocationModal({
  location,
  onSubmit,
  onClose,
}: {
  location: PhotoLocation;
  onSubmit: (name: string) => void;
  onClose: () => void;
}): JSX.Element {
  const [name, setName] = useState(location.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Focus + select all text (giống F2 trong Explorer)
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(t);
  }, []);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== location.name;

  function handleSubmit(): void {
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <header className="modal-head">
          <h2>✎ Đổi tên vị trí</h2>
          <button className="mini" onClick={onClose} title="Đóng">
            ×
          </button>
        </header>

        <div className="modal-body">
          <p className="muted small" style={{ marginBottom: 6 }}>
            Tên hiển thị trong sidebar (KHÔNG đổi tên folder thật trên ổ).
          </p>
          <div
            className="muted small"
            style={{
              padding: '6px 8px',
              background: 'var(--panel-alt)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontFamily: 'ui-monospace, Consolas, monospace',
              fontSize: 11,
              marginBottom: 12,
              wordBreak: 'break-all',
            }}
            title={location.path}
          >
            📁 {location.path}
          </div>

          <label
            className="muted small"
            style={{ display: 'block', marginBottom: 4 }}
          >
            Tên mới
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Ảnh Tham tra"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty) handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--panel-alt)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              boxShadow: '0 0 0 2px var(--accent-soft)',
            }}
          />
        </div>

        <footer className="modal-foot">
          <span className="muted small">
            {!trimmed
              ? '⚠ Tên không được rỗng'
              : !dirty
              ? '— không có thay đổi —'
              : '↵ Enter để lưu'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              Huỷ
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!dirty}
            >
              ✓ Lưu
            </button>
          </div>
        </footer>
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
          <h2>📍 Thêm folder ảnh / video</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <h3>💻 Thư mục trên máy này</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Chọn folder ảnh/video trên ổ cứng máy mình.
            </p>
            <button className="btn btn-primary" onClick={onLocal}>
              Chọn thư mục…
            </button>
          </section>

          <section className="settings-section">
            <h3>🌐 LAN — máy khác trong mạng nội bộ</h3>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Nhập đường dẫn UNC: <code>\\tên-máy\thư-mục-share</code> hoặc{' '}
              <code>\\192.168.1.10\Photos</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={uncPath}
                onChange={(e) => setUncPath(e.target.value)}
                placeholder="\\\\server\\share"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  background: 'var(--panel-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text)',
                  fontSize: 13,
                }}
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
              💡 Máy share folder phải bật File Sharing và cấp quyền truy cập cho user của Trí.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  selected,
  onClick,
}: {
  photo: PhotoEntry;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (photo.thumb_id) {
      void getThumbnailDataUrl(photo.thumb_id).then((url) => {
        if (alive) setThumbUrl(url);
      });
    } else {
      setThumbUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [photo.thumb_id]);

  const date = new Date(photo.taken_ms);
  const dateLabel = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  return (
    <li
      className={`photo-card ${selected ? 'selected' : ''} ${photo.is_video ? 'is-video' : ''}`}
      onClick={onClick}
      title={photo.name}
    >
      <div className="photo-thumb">
        {photo.is_video ? (
          <div className="photo-thumb-placeholder photo-thumb-video">
            <span className="video-icon-large">▶</span>
            <span className="video-ext-label">.{photo.ext.toUpperCase()}</span>
          </div>
        ) : thumbUrl ? (
          <img src={thumbUrl} alt={photo.name} loading="lazy" />
        ) : (
          <div className="photo-thumb-placeholder">📷</div>
        )}
        {photo.has_gps && <span className="photo-gps-badge">📍</span>}
        {photo.is_video && <span className="photo-video-badge">VIDEO</span>}
        {photo.tags.length > 0 && <span className="photo-tag-badge">🏷 {photo.tags.length}</span>}
      </div>
      <div className="photo-meta">
        <div className="photo-name" title={photo.name}>
          {photo.name}
        </div>
        <div className="photo-sub muted small">
          {dateLabel}
          {photo.width && photo.height && ` · ${photo.width}×${photo.height}`}
          {photo.is_video && ' · video'}
        </div>
      </div>
    </li>
  );
}

function DetailsTable({
  photos,
  selectedPath,
  onClick,
}: {
  photos: PhotoEntry[];
  selectedPath: string | null;
  onClick: (path: string) => void;
}): JSX.Element {
  return (
    <div className="details-explorer">
      <div className="details-header">
        <div className="dh-cell dh-icon"></div>
        <div className="dh-cell dh-name">Tên</div>
        <div className="dh-cell dh-type">Loại</div>
        <div className="dh-cell dh-size">Dung lượng</div>
        <div className="dh-cell dh-dim">Kích thước</div>
        <div className="dh-cell dh-date">Ngày chụp</div>
        <div className="dh-cell dh-camera">Camera</div>
      </div>
      <div className="details-body">
        {photos.map((p, idx) => (
          <DetailsRow
            key={p.path}
            photo={p}
            selected={selectedPath === p.path}
            zebra={idx % 2 === 1}
            onClick={() => onClick(p.path)}
          />
        ))}
      </div>
    </div>
  );
}

function DetailsRow({
  photo,
  selected,
  zebra,
  onClick,
}: {
  photo: PhotoEntry;
  selected: boolean;
  zebra: boolean;
  onClick: () => void;
}): JSX.Element {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (photo.thumb_id) {
      void getThumbnailDataUrl(photo.thumb_id).then((url) => {
        if (alive) setThumbUrl(url);
      });
    }
    return () => {
      alive = false;
    };
  }, [photo.thumb_id]);

  const date = new Date(photo.taken_ms);
  const dateStr = date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`dr-row ${selected ? 'selected' : ''} ${zebra ? 'zebra' : ''} ${photo.is_video ? 'is-video' : ''}`}
      onClick={onClick}
      onDoubleClick={() => void openFile(photo.path)}
      title={photo.path}
    >
      <div className="dr-cell dr-icon">
        {photo.is_video ? (
          <span className="dr-video-icon">▶</span>
        ) : thumbUrl ? (
          <img src={thumbUrl} alt="" loading="lazy" />
        ) : (
          <span className="dr-placeholder">🖼</span>
        )}
      </div>
      <div className="dr-cell dr-name" title={photo.name}>
        <span className="dr-name-text">{photo.name}</span>
        {photo.has_gps && <span className="dr-flag" title="Có GPS">📍</span>}
        {photo.tags.length > 0 && (
          <span className="dr-flag" title={`Tags: ${photo.tags.join(', ')}`}>
            🏷
          </span>
        )}
        {photo.note && (
          <span className="dr-flag" title={photo.note}>
            📝
          </span>
        )}
      </div>
      <div className="dr-cell dr-type">
        {photo.is_video ? 'Video' : 'Ảnh'} .{photo.ext}
      </div>
      <div className="dr-cell dr-size">{formatBytes(photo.size_bytes)}</div>
      <div className="dr-cell dr-dim">
        {photo.width && photo.height ? `${photo.width} × ${photo.height}` : '—'}
      </div>
      <div className="dr-cell dr-date">
        <span className="dr-date-main">{dateStr}</span>
        <span className="dr-date-time muted small"> {timeStr}</span>
      </div>
      <div className="dr-cell dr-camera" title={photo.camera ?? ''}>
        {photo.camera ?? '—'}
      </div>
    </div>
  );
}

function PhotoDetail({
  photo,
  similar,
  onSelectSimilar,
  onSetTags,
  onSetNote,
  onRename,
}: {
  photo: PhotoEntry;
  similar: PhotoEntry[];
  onSelectSimilar: (path: string) => void;
  onSetTags: (tagsInput: string) => void;
  onSetNote: (note: string) => void;
  onRename: (newName: string) => void;
}): JSX.Element {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState(photo.tags.join(', '));
  const [noteDraft, setNoteDraft] = useState(photo.note);
  const [renameDraft, setRenameDraft] = useState(photo.name);
  const [renameMode, setRenameMode] = useState(false);

  useEffect(() => {
    setTagsInput(photo.tags.join(', '));
    setNoteDraft(photo.note);
    setRenameDraft(photo.name);
    setRenameMode(false);
  }, [photo.path, photo.tags, photo.note, photo.name]);

  useEffect(() => {
    let alive = true;
    if (photo.thumb_id && !photo.is_video) {
      void getThumbnailDataUrl(photo.thumb_id).then((url) => {
        if (alive) setThumbUrl(url);
      });
    } else {
      setThumbUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [photo.thumb_id, photo.is_video]);

  const date = new Date(photo.taken_ms);
  const noteDirty = noteDraft !== photo.note;

  function handleRenameSubmit(): void {
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === photo.name) {
      setRenameMode(false);
      return;
    }
    onRename(trimmed);
  }

  function copyPath(): void {
    void navigator.clipboard
      .writeText(photo.path)
      .then(() => window.alert('✓ Đã copy đường dẫn'))
      .catch(() => {});
  }

  return (
    <div className="detail-inner">
      <div className="detail-thumb-wrap">
        {photo.is_video ? (
          <video
            key={photo.path}
            src={fileSrcUrl(photo.path)}
            controls
            preload="metadata"
            className="detail-video"
          >
            Trình duyệt không hỗ trợ video tag.
          </video>
        ) : thumbUrl ? (
          <img src={thumbUrl} alt={photo.name} className="detail-thumb" />
        ) : (
          <div className="detail-thumb-placeholder">📷</div>
        )}
      </div>
      <header className="detail-head">
        {renameMode ? (
          <div className="rename-row">
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') {
                  setRenameMode(false);
                  setRenameDraft(photo.name);
                }
              }}
              autoFocus
            />
            <button className="btn btn-primary btn-small" onClick={handleRenameSubmit}>
              ✓ Lưu
            </button>
            <button
              className="btn btn-ghost btn-small"
              onClick={() => {
                setRenameMode(false);
                setRenameDraft(photo.name);
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="detail-name-row">
            <h2 title={photo.name}>{photo.name}</h2>
            <button
              className="loc-btn"
              title="Đổi tên file (F2)"
              onClick={() => setRenameMode(true)}
            >
              ✎
            </button>
          </div>
        )}
        <p className="muted small detail-path-line" title={photo.path}>
          {photo.path}
        </p>
      </header>

      <div className="detail-actions">
        <button className="btn btn-primary" onClick={() => void openFile(photo.path)}>
          {photo.is_video ? '▶ Mở video' : '📂 Mở ảnh'}
        </button>
        <button className="btn btn-ghost" onClick={() => void openContainingFolder(photo.path)}>
          📁 Mở folder chứa
        </button>
        <button className="btn btn-ghost" onClick={copyPath} title="Copy đường dẫn full path">
          📋 Copy path
        </button>
      </div>

      <dl className="detail-dl">
        <dt>Loại</dt>
        <dd>{photo.is_video ? `Video .${photo.ext}` : `Ảnh .${photo.ext}`}</dd>
        <dt>Kích thước</dt>
        <dd>{photo.width && photo.height ? `${photo.width}×${photo.height} px` : '—'}</dd>
        <dt>Dung lượng</dt>
        <dd>{formatBytes(photo.size_bytes)}</dd>
        <dt>Ngày chụp</dt>
        <dd>{date.toLocaleString('vi-VN')}</dd>
        {photo.camera && (
          <>
            <dt>Camera</dt>
            <dd>{photo.camera}</dd>
          </>
        )}
        {photo.has_gps && photo.gps_lat !== null && photo.gps_lon !== null && (
          <>
            <dt>GPS</dt>
            <dd>
              <a
                href={`https://www.google.com/maps?q=${photo.gps_lat},${photo.gps_lon}`}
                className="gps-link"
                onClick={(e) => {
                  e.preventDefault();
                  void openFile(`https://www.google.com/maps?q=${photo.gps_lat},${photo.gps_lon}`);
                }}
              >
                📍 {photo.gps_lat?.toFixed(5)}, {photo.gps_lon?.toFixed(5)}
              </a>
            </dd>
          </>
        )}
      </dl>

      <div className="tag-editor">
        <label className="muted small">🏷 Tags (phân cách bằng dấu phẩy)</label>
        <div className="tag-input-row">
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="vd: family, holiday, beach"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSetTags(tagsInput);
            }}
          />
          <button className="btn btn-primary btn-small" onClick={() => onSetTags(tagsInput)}>
            Lưu
          </button>
        </div>
      </div>

      <div className="note-editor">
        <label className="muted small">📝 Ghi chú</label>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Ghi chú về file này (đi đâu, ai chụp, sự kiện gì…)"
          rows={3}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {noteDirty && (
            <button
              className="btn btn-ghost btn-small"
              onClick={() => setNoteDraft(photo.note)}
            >
              ↺ Hoàn tác
            </button>
          )}
          <button
            className="btn btn-primary btn-small"
            onClick={() => onSetNote(noteDraft)}
            disabled={!noteDirty}
          >
            ✓ Lưu ghi chú
          </button>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="similar-section">
          <h4 className="muted small">📅 Cùng ngày ({similar.length})</h4>
          <div className="similar-strip">
            {similar.map((s) => (
              <SimilarThumb key={s.path} photo={s} onClick={() => onSelectSimilar(s.path)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimilarThumb({
  photo,
  onClick,
}: {
  photo: PhotoEntry;
  onClick: () => void;
}): JSX.Element {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (photo.thumb_id) {
      void getThumbnailDataUrl(photo.thumb_id).then((url) => {
        if (alive) setThumbUrl(url);
      });
    }
    return () => {
      alive = false;
    };
  }, [photo.thumb_id]);

  return (
    <button className="similar-thumb" onClick={onClick} title={photo.name}>
      {photo.is_video ? (
        <span className="video-icon-large">▶</span>
      ) : thumbUrl ? (
        <img src={thumbUrl} alt={photo.name} loading="lazy" />
      ) : (
        <span>📷</span>
      )}
    </button>
  );
}
