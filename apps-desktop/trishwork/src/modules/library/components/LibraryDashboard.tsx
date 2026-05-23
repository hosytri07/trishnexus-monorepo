/**
 * Phase 18.1.c — Library Dashboard.
 *
 * Panel ở đầu Library hiển thị:
 *   - 4 stat cards: total files / total size / files thêm tuần này / phân loại theo type
 *   - Recently viewed: 10 file mở gần nhất (track qua localStorage trishlibrary.lib_meta.v1)
 *   - Reading list: 3 cột Todo / Đang đọc / Đã đọc — click status để chuyển
 *   - Starred: file pin yêu thích
 *
 * Dashboard có thể collapse/expand. State persist localStorage.
 */

import { useEffect, useMemo, useState } from 'react';
import type { LibraryFile } from '../types.js';
import { formatBytes } from '../types.js';
import { useAuth } from '@trishteam/auth/react';

export type ReadStatus = 'todo' | 'reading' | 'done';

export interface LibraryMeta {
  last_opened_ms?: number;
  read_status?: ReadStatus | null;
  starred?: boolean;
  view_count?: number;
}

/**
 * Phase 18.5.b — Per-user library metadata.
 * Reading status, starred, last opened — riêng cho từng user trên cùng máy.
 */
const LEGACY_META_KEY = 'trishlibrary.lib_meta.v1';
const COLLAPSED_KEY = 'trishlibrary.dashboard.collapsed';

function metaKeyForUid(uid: string | null): string {
  if (!uid) return LEGACY_META_KEY;
  return `${LEGACY_META_KEY}::${uid}`;
}

export function loadLibMetaStore(uid: string | null = null): Record<string, LibraryMeta> {
  try {
    const key = metaKeyForUid(uid);
    let raw = window.localStorage.getItem(key);
    if (!raw && uid) {
      const legacy = window.localStorage.getItem(LEGACY_META_KEY);
      if (legacy) {
        try {
          window.localStorage.setItem(key, legacy);
        } catch {
          /* ignore */
        }
        raw = legacy;
      }
    }
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLibMetaStore(
  store: Record<string, LibraryMeta>,
  uid: string | null = null,
): void {
  try {
    const key = metaKeyForUid(uid);
    window.localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* quota — skip */
  }
}

/**
 * Public helper — gọi khi user mở file để track recent + view count.
 * Note: caller phải truyền uid (lấy từ useAuth) để track per-user.
 * Nếu uid=null → ghi vào legacy key (chế độ chưa login).
 */
export function recordFileOpened(path: string, uid: string | null = null): void {
  const store = loadLibMetaStore(uid);
  const cur = store[path] ?? {};
  store[path] = {
    ...cur,
    last_opened_ms: Date.now(),
    view_count: (cur.view_count ?? 0) + 1,
  };
  saveLibMetaStore(store, uid);
}

interface Props {
  files: LibraryFile[];
  onOpenFile: (file: LibraryFile) => void;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

export function LibraryDashboard({ files, onOpenFile, tr }: Props): JSX.Element | null {
  void tr;
  const { profile } = useAuth();
  const uid = profile?.id ?? null;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [meta, setMeta] = useState<Record<string, LibraryMeta>>(() => loadLibMetaStore(uid));

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Refresh meta when files set changes (in case opens happened from elsewhere)
  // hoặc uid đổi (login/logout/switch user)
  useEffect(() => {
    setMeta(loadLibMetaStore(uid));
  }, [files.length, uid]);

  function patchMeta(path: string, patch: Partial<LibraryMeta>): void {
    const next = { ...meta, [path]: { ...(meta[path] ?? {}), ...patch } };
    setMeta(next);
    saveLibMetaStore(next, uid);
  }

  function setStatus(path: string, status: ReadStatus | null): void {
    patchMeta(path, { read_status: status });
  }

  function toggleStar(path: string): void {
    const cur = meta[path]?.starred ?? false;
    patchMeta(path, { starred: !cur });
  }

  // ---- Computed stats ----
  const stats = useMemo(() => {
    const total = files.length;
    const totalBytes = files.reduce((s, f) => s + f.size_bytes, 0);
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const since = Date.now() - oneWeek;
    const recentCount = files.filter((f) => f.mtime_ms >= since).length;
    const byType = files.reduce<Record<string, number>>((acc, f) => {
      const t = String(f.file_type ?? 'other');
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    return { total, totalBytes, recentCount, byType };
  }, [files]);

  const recentlyViewed = useMemo(() => {
    const items: Array<{ file: LibraryFile; opened: number }> = [];
    for (const f of files) {
      const t = meta[f.path]?.last_opened_ms;
      if (t) items.push({ file: f, opened: t });
    }
    items.sort((a, b) => b.opened - a.opened);
    return items.slice(0, 5);
  }, [files, meta]);

  const starred = useMemo(() => {
    return files.filter((f) => meta[f.path]?.starred).slice(0, 6);
  }, [files, meta]);

  const readingLists = useMemo(() => {
    const lists: Record<ReadStatus, LibraryFile[]> = {
      todo: [],
      reading: [],
      done: [],
    };
    for (const f of files) {
      const s = meta[f.path]?.read_status;
      if (s === 'todo' || s === 'reading' || s === 'done') {
        lists[s].push(f);
      }
    }
    return lists;
  }, [files, meta]);

  if (files.length === 0) return null;

  // ---- Collapsed pill ----
  if (collapsed) {
    return (
      <div className="lib-dashboard-collapsed">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCollapsed(false)}
          title="Mở dashboard"
        >
          📊 Bảng điều khiển ▾
        </button>
        <span className="muted small">
          {stats.total} file · {formatBytes(stats.totalBytes)}
        </span>
      </div>
    );
  }

  // ---- Expanded ----
  return (
    <section className="lib-dashboard">
      <header className="lib-dashboard-head">
        <h2>📊 Bảng điều khiển</h2>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCollapsed(true)}
          title="Thu gọn"
        >
          ▴ Thu gọn
        </button>
      </header>

      {/* Stats row */}
      <div className="lib-dashboard-stats">
        <div className="lib-stat-card">
          <span className="lib-stat-icon">📚</span>
          <div>
            <strong>{stats.total.toLocaleString()}</strong>
            <span className="muted small">tổng file</span>
          </div>
        </div>
        <div className="lib-stat-card">
          <span className="lib-stat-icon">💾</span>
          <div>
            <strong>{formatBytes(stats.totalBytes)}</strong>
            <span className="muted small">dung lượng</span>
          </div>
        </div>
        <div className="lib-stat-card">
          <span className="lib-stat-icon">🆕</span>
          <div>
            <strong>{stats.recentCount}</strong>
            <span className="muted small">mới (7 ngày)</span>
          </div>
        </div>
        <div className="lib-stat-card lib-stat-card-types">
          <span className="lib-stat-icon">🗂</span>
          <div className="lib-stat-types">
            {Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([type, count]) => (
                <span key={type} className="lib-type-chip">
                  {type} · <strong>{count}</strong>
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Recently viewed */}
      {recentlyViewed.length > 0 && (
        <div className="lib-dashboard-section">
          <h3>⏰ Mở gần đây</h3>
          <ul className="lib-recent-list">
            {recentlyViewed.map(({ file, opened }) => (
              <li key={file.path}>
                <button
                  className="lib-recent-item"
                  onClick={() => onOpenFile(file)}
                  title={file.path}
                >
                  <span className="lib-recent-icon">{iconForType(String(file.file_type))}</span>
                  <div className="lib-recent-text">
                    <strong>{file.doc_title || file.file_name}</strong>
                    <span className="muted small">
                      {formatRelative(opened)}
                      {meta[file.path]?.view_count
                        ? ` · ${meta[file.path]?.view_count}× mở`
                        : ''}
                    </span>
                  </div>
                  {meta[file.path]?.starred && <span title="Yêu thích">⭐</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Starred */}
      {starred.length > 0 && (
        <div className="lib-dashboard-section">
          <h3>⭐ Yêu thích ({starred.length})</h3>
          <ul className="lib-recent-list">
            {starred.map((file) => (
              <li key={file.path}>
                <button
                  className="lib-recent-item"
                  onClick={() => onOpenFile(file)}
                  title={file.path}
                >
                  <span className="lib-recent-icon">{iconForType(String(file.file_type))}</span>
                  <div className="lib-recent-text">
                    <strong>{file.doc_title || file.file_name}</strong>
                    <span className="muted small">{formatBytes(file.size_bytes)}</span>
                  </div>
                  <button
                    className="mini lib-star-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(file.path);
                    }}
                    title="Bỏ yêu thích"
                  >
                    ⭐
                  </button>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reading list — 3 columns */}
      <div className="lib-dashboard-section">
        <h3>📖 Reading list <span className="muted small" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· bấm chip trạng thái để chuyển cột</span></h3>
        <div className="lib-reading-grid">
          {(['todo', 'reading', 'done'] as ReadStatus[]).map((status) => (
            <ReadingColumn
              key={status}
              status={status}
              files={readingLists[status]}
              onOpen={onOpenFile}
              onSetStatus={setStatus}
              onToggleStar={toggleStar}
              meta={meta}
            />
          ))}
        </div>
        <AddToReadingList
          files={files}
          existingStatuses={meta}
          onAdd={(path) => setStatus(path, 'todo')}
        />
      </div>
    </section>
  );
}

// ============================================================
// Reading list column
// ============================================================

function ReadingColumn({
  status,
  files,
  onOpen,
  onSetStatus,
  onToggleStar,
  meta,
}: {
  status: ReadStatus;
  files: LibraryFile[];
  onOpen: (f: LibraryFile) => void;
  onSetStatus: (path: string, s: ReadStatus | null) => void;
  onToggleStar: (path: string) => void;
  meta: Record<string, LibraryMeta>;
}): JSX.Element {
  const labels: Record<ReadStatus, { icon: string; label: string; class: string }> = {
    todo: { icon: '📥', label: 'Cần đọc', class: 'col-todo' },
    reading: { icon: '📖', label: 'Đang đọc', class: 'col-reading' },
    done: { icon: '✅', label: 'Đã đọc', class: 'col-done' },
  };
  const def = labels[status];
  return (
    <div className={`lib-reading-col ${def.class}`}>
      <header>
        <span>{def.icon}</span>
        <strong>{def.label}</strong>
        <span className="muted small">{files.length}</span>
      </header>
      {files.length === 0 ? (
        <p className="muted small lib-reading-empty">(Trống)</p>
      ) : (
        <ul>
          {files.map((f) => (
            <li key={f.path}>
              <div className="lib-reading-item">
                <button
                  className="lib-reading-link"
                  onClick={() => onOpen(f)}
                  title={f.path}
                >
                  <strong>{f.doc_title || f.file_name}</strong>
                </button>
                <div className="lib-reading-actions">
                  {(['todo', 'reading', 'done'] as ReadStatus[])
                    .filter((s) => s !== status)
                    .map((s) => (
                      <button
                        key={s}
                        className="mini"
                        onClick={() => onSetStatus(f.path, s)}
                        title={`Chuyển sang ${labels[s].label}`}
                      >
                        {labels[s].icon}
                      </button>
                    ))}
                  <button
                    className="mini"
                    onClick={() => onToggleStar(f.path)}
                    title={meta[f.path]?.starred ? 'Bỏ yêu thích' : 'Yêu thích'}
                  >
                    {meta[f.path]?.starred ? '⭐' : '☆'}
                  </button>
                  <button
                    className="mini"
                    onClick={() => onSetStatus(f.path, null)}
                    title="Bỏ khỏi reading list"
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Add to reading list dropdown
// ============================================================

function AddToReadingList({
  files,
  existingStatuses,
  onAdd,
}: {
  files: LibraryFile[];
  existingStatuses: Record<string, LibraryMeta>;
  onAdd: (path: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return files
      .filter((f) => !existingStatuses[f.path]?.read_status)
      .filter((f) => {
        if (!q) return true;
        return (
          f.file_name.toLowerCase().includes(q) ||
          (f.doc_title ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [files, existingStatuses, filter]);

  return (
    <div className="lib-reading-add">
      {!open ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          + Thêm file vào "Cần đọc"
        </button>
      ) : (
        <div className="lib-reading-picker">
          <input
            type="text"
            className="lib-reading-search"
            placeholder="Tìm file để thêm…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <ul className="lib-reading-options">
            {candidates.length === 0 ? (
              <li className="muted small" style={{ padding: 6 }}>
                (Không có file nào)
              </li>
            ) : (
              candidates.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => {
                      onAdd(f.path);
                      setFilter('');
                    }}
                  >
                    {f.doc_title || f.file_name}
                  </button>
                </li>
              ))
            )}
          </ul>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function iconForType(t: string): string {
  switch (t.toLowerCase()) {
    case 'pdf':
      return '📕';
    case 'docx':
    case 'doc':
      return '📘';
    case 'xlsx':
    case 'xls':
    case 'csv':
      return '📊';
    case 'pptx':
    case 'ppt':
      return '📙';
    case 'image':
    case 'png':
    case 'jpg':
    case 'jpeg':
      return '🖼';
    case 'txt':
    case 'md':
      return '📄';
    default:
      return '📎';
  }
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'vừa xong';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h trước`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}
