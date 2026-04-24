import { useMemo, useState } from 'react';
import {
  classifyPath,
  summarizeScan,
  type CleanCategory,
  type FileEntry,
  type ScanSummary,
} from '@trishteam/core/clean';
import {
  pickDirectory,
  scanDir,
  type ScanStats,
} from './tauri-bridge.js';

type Status = 'idle' | 'scanning' | 'done' | 'error';

const CATEGORY_LABEL: Record<CleanCategory, string> = {
  cache: 'Cache',
  temp: 'Temp',
  download: 'Downloads cũ',
  duplicate: 'Trùng lặp',
  large: 'File lớn (>100 MB)',
  old: 'Chưa mở >180 ngày',
  empty_dir: 'Thư mục rỗng',
  recycle: 'Thùng rác OS',
  other: 'Khác',
};

const CATEGORY_ORDER: CleanCategory[] = [
  'cache',
  'temp',
  'download',
  'large',
  'old',
  'empty_dir',
  'recycle',
  'duplicate',
  'other',
];

export function App(): JSX.Element {
  const [dir, setDir] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [selected, setSelected] = useState<CleanCategory | null>(null);

  const nowMs = Date.now();

  const classified: FileEntry[] = useMemo(() => {
    if (!stats) return [];
    return stats.entries.map((e) => ({
      path: e.path,
      size_bytes: e.size_bytes,
      modified_at_ms: e.modified_at_ms,
      accessed_at_ms: e.accessed_at_ms,
      is_dir: e.is_dir,
      category: classifyPath({
        path: e.path,
        size_bytes: e.size_bytes,
        accessed_at_ms: e.accessed_at_ms,
        is_dir: e.is_dir,
        nowMs,
      }),
    }));
  }, [stats, nowMs]);

  const summary: ScanSummary | null = useMemo(() => {
    if (!classified.length) return null;
    return summarizeScan(classified, nowMs);
  }, [classified, nowMs]);

  async function handlePickAndScan() {
    setError(null);
    try {
      const picked = await pickDirectory();
      if (!picked) return;
      setDir(picked);
      setStatus('scanning');
      const res = await scanDir(picked, { maxEntries: 20_000, maxDepth: 6 });
      setStats(res);
      setStatus('done');
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }

  const visibleEntries = useMemo(() => {
    if (!selected) return classified;
    return classified.filter((e) => e.category === selected);
  }, [classified, selected]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>🧹</span>
          <div>
            <strong>TrishClean</strong>
            <div className="sub">Dọn dẹp máy an toàn · undo 7 ngày</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handlePickAndScan}>
          {status === 'scanning' ? 'Đang quét...' : 'Chọn thư mục & quét'}
        </button>
      </header>

      {error && <div className="alert alert-error">Lỗi: {error}</div>}
      {stats?.truncated && (
        <div className="alert alert-warn">
          Đã quét tối đa ({stats.entries.length} file). Chọn thư mục nhỏ
          hơn để có kết quả đầy đủ.
        </div>
      )}

      {!stats && status !== 'scanning' && (
        <div className="empty">
          <p>Chọn một thư mục để bắt đầu quét — thường là:</p>
          <ul>
            <li>Downloads (tìm installer cũ, file ít khi mở lại)</li>
            <li>%TEMP% / /tmp (cache phiên làm việc)</li>
            <li>~/.cache hoặc AppData\Local\Cache (cache browser, app)</li>
          </ul>
          <p className="muted small">
            Ở phase alpha.1: chỉ quét, chưa xoá. Bản 14.3.2 sẽ thêm
            staged delete với undo 7 ngày.
          </p>
        </div>
      )}

      {summary && stats && (
        <>
          <section className="stats-panel">
            <h2>Kết quả quét</h2>
            <div className="stats-grid">
              <Stat label="Thư mục" value={dir ?? '—'} wide />
              <Stat label="Số file" value={summary.total_files.toLocaleString('vi-VN')} />
              <Stat label="Dung lượng" value={formatBytes(summary.total_size_bytes)} />
              <Stat
                label="Thời gian"
                value={`${(stats.elapsed_ms / 1000).toFixed(1)} s`}
              />
              {stats.errors > 0 && (
                <Stat
                  label="Lỗi đọc"
                  value={`${stats.errors} file`}
                  warn
                />
              )}
            </div>
          </section>

          <section className="categories">
            <h2>Theo phân loại</h2>
            <div className="cat-grid">
              <CatPill
                label="Tất cả"
                count={summary.total_files}
                size={summary.total_size_bytes}
                active={selected === null}
                onClick={() => setSelected(null)}
              />
              {CATEGORY_ORDER.map((c) => {
                const s = summary.by_category[c];
                if (!s || s.count === 0) return null;
                return (
                  <CatPill
                    key={c}
                    label={CATEGORY_LABEL[c]}
                    count={s.count}
                    size={s.size_bytes}
                    active={selected === c}
                    onClick={() => setSelected(c)}
                  />
                );
              })}
            </div>
          </section>

          <section className="file-list">
            <h2>
              {selected ? CATEGORY_LABEL[selected] : 'Tất cả file'}
              <span className="muted small">
                {' '}
                ({visibleEntries.length})
              </span>
            </h2>
            <div className="list-scroll">
              {visibleEntries
                .slice()
                .sort((a, b) => b.size_bytes - a.size_bytes)
                .slice(0, 200)
                .map((e) => (
                  <FileRow key={e.path} entry={e} nowMs={nowMs} />
                ))}
              {visibleEntries.length > 200 && (
                <div className="row muted small">
                  … {visibleEntries.length - 200} file nữa không hiển thị
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  wide?: boolean;
  warn?: boolean;
}
function Stat({ label, value, wide, warn }: StatProps): JSX.Element {
  return (
    <div className={`stat ${wide ? 'wide' : ''} ${warn ? 'warn' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

interface CatPillProps {
  label: string;
  count: number;
  size: number;
  active: boolean;
  onClick: () => void;
}
function CatPill({ label, count, size, active, onClick }: CatPillProps): JSX.Element {
  return (
    <button
      type="button"
      className={`cat-pill ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="cat-label">{label}</div>
      <div className="cat-count">
        {count.toLocaleString('vi-VN')} · {formatBytes(size)}
      </div>
    </button>
  );
}

interface FileRowProps {
  entry: FileEntry;
  nowMs: number;
}
function FileRow({ entry, nowMs }: FileRowProps): JSX.Element {
  const ageDays = Math.max(
    0,
    Math.floor((nowMs - entry.accessed_at_ms) / 86_400_000),
  );
  return (
    <div className="row">
      <div className="row-main">
        <div className="row-path" title={entry.path}>
          {entry.path}
        </div>
        <div className="row-meta">
          <span className={`tag tag-${entry.category}`}>
            {CATEGORY_LABEL[entry.category]}
          </span>
          <span className="muted small">
            {entry.is_dir ? 'thư mục' : ''} · chưa mở {ageDays} ngày
          </span>
        </div>
      </div>
      <div className="row-size">{formatBytes(entry.size_bytes)}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}
