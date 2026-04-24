import { useEffect, useMemo, useState } from 'react';
import { notes } from '@trishteam/core';
import type { Note, NoteStatus } from '@trishteam/core/notes';
import {
  exportNotesAs,
  getDefaultStoreLocation,
  importNotesFrom,
  loadNotes,
  saveNotes,
  type StoreLocation,
} from './tauri-bridge.js';

type ViewMode = 'list' | 'kanban';

function uid(): string {
  return 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function App(): JSX.Element {
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<StoreLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<NoteStatus | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [savingFlash, setSavingFlash] = useState(false);

  // Initial load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const loc = await getDefaultStoreLocation();
        if (!alive) return;
        setLocation(loc);
        const result = await loadNotes();
        if (!alive) return;
        setItems(result.notes);
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

  // Auto-save 400 ms after items change (debounce).
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          setSavingFlash(true);
          await saveNotes(items);
          setTimeout(() => setSavingFlash(false), 300);
        } catch (e) {
          setError(String(e));
          setSavingFlash(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [items, loading]);

  const now = Date.now();

  const counts = useMemo(() => notes.countByStatus(items), [items]);
  const dueCount = useMemo(() => notes.countDueForReview(items, now), [items, now]);
  const streak = useMemo(() => notes.computeReviewStreak(items, now), [items, now]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of items) {
      if (n.deletedAt != null) continue;
      for (const t of n.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const base = notes.filterByStatus(items, statusFilter);
    const byTag = tagFilter
      ? base.filter((n) => n.tags.includes(tagFilter))
      : base;
    if (!search.trim()) return byTag;
    const q = search.trim().toLowerCase();
    return byTag.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [items, statusFilter, tagFilter, search]);

  const kanbanLanes = useMemo(() => notes.groupByKanban(filtered), [filtered]);

  const selected = useMemo(
    () => items.find((n) => n.id === selectedId) ?? null,
    [items, selectedId],
  );

  const handleCreate = (draft: {
    title: string;
    body: string;
    tagsInput: string;
    status: NoteStatus;
  }): void => {
    const tags = draft.tagsInput
      .split(',')
      .map((t) => notes.normalizeTag(t))
      .filter((t) => t.length > 0);
    const err = notes.validateDraft({
      title: draft.title,
      body: draft.body,
      tags,
    });
    if (err !== null) {
      alert(err);
      return;
    }
    const note: Note = {
      id: uid(),
      title: draft.title.trim(),
      body: draft.body,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      status: draft.status,
      lastReviewedAt: null,
      dueAt: null,
    };
    setItems((prev) => [note, ...prev]);
    setShowComposer(false);
    setSelectedId(note.id);
  };

  const handleMove = (id: string, status: NoteStatus): void => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? notes.moveNote(n, status, Date.now()) : n)),
    );
  };

  const handleReview = (id: string): void => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? notes.markReviewed(n, Date.now()) : n)),
    );
  };

  const handleDelete = (id: string): void => {
    const note = items.find((n) => n.id === id);
    if (!note) return;
    if (!confirm(`Xoá "${note.title || '(không tiêu đề)'}"?`)) return;
    setItems((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deletedAt: Date.now(), updatedAt: Date.now() } : n,
      ),
    );
    if (selectedId === id) setSelectedId(null);
  };

  const handleEditField = (id: string, field: 'title' | 'body', val: string): void => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: val, updatedAt: Date.now() } : n)),
    );
  };

  const handleExport = (): void => {
    void exportNotesAs(items);
  };

  const handleImport = async (): Promise<void> => {
    const imported = await importNotesFrom();
    if (!imported) return;
    if (!confirm(`Import ${imported.length} note? Sẽ merge với note hiện tại.`)) return;
    // Merge theo id: import thắng nếu updatedAt lớn hơn.
    const map = new Map<string, Note>();
    for (const n of items) map.set(n.id, n);
    for (const n of imported) {
      const existing = map.get(n.id);
      if (!existing || n.updatedAt >= existing.updatedAt) map.set(n.id, n);
    }
    setItems(Array.from(map.values()));
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-inner">Đang tải notes…</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>TrishNote</strong>
          <span className="muted"> · ghi chú + review + kanban</span>
        </div>
        <div className="actions">
          <input
            className="search"
            type="search"
            placeholder="Tìm… (Ctrl+F)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className={dueCount > 0 ? 'review-btn has-due' : 'review-btn'}
            onClick={() => setShowReview(true)}
            title={`${dueCount} note chưa review > 7 ngày`}
          >
            Review{dueCount > 0 ? ` · ${dueCount}` : ''}
          </button>
          <button onClick={() => setShowComposer(true)}>+ Note</button>
          <button className="mini" onClick={handleExport} title="Export JSON">
            ⇧
          </button>
          <button className="mini" onClick={() => void handleImport()} title="Import JSON">
            ⇩
          </button>
        </div>
      </header>

      {error && <div className="error-banner">Lỗi: {error}</div>}

      <div className="main">
        <aside className="sidebar">
          <section>
            <h3>Trạng thái</h3>
            <nav className="status-nav">
              <StatusPill
                active={statusFilter === null}
                count={counts.inbox + counts.active + counts.waiting + counts.done}
                onClick={() => setStatusFilter(null)}
              >
                Tất cả (không archive)
              </StatusPill>
              {(['inbox', 'active', 'waiting', 'done', 'archived'] as NoteStatus[]).map(
                (s) => (
                  <StatusPill
                    key={s}
                    status={s}
                    active={statusFilter === s}
                    count={counts[s]}
                    onClick={() => setStatusFilter(s)}
                  >
                    {notes.statusLabel(s)}
                  </StatusPill>
                ),
              )}
            </nav>
          </section>

          {allTags.length > 0 && (
            <section>
              <h3>Tag</h3>
              <div className="tag-list">
                <button
                  className={tagFilter === null ? 'tag active' : 'tag'}
                  onClick={() => setTagFilter(null)}
                >
                  tất cả
                </button>
                {allTags.map((t) => (
                  <button
                    key={t}
                    className={tagFilter === t ? 'tag active' : 'tag'}
                    onClick={() => setTagFilter(t)}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3>Review</h3>
            <div className="stat-row">
              <span>Cần review</span>
              <strong className={dueCount > 0 ? 'warn' : ''}>{dueCount}</strong>
            </div>
            <div className="stat-row">
              <span>Streak ngày</span>
              <strong>{streak}</strong>
            </div>
          </section>

          <section>
            <h3>View</h3>
            <div className="view-toggle">
              <button
                className={view === 'list' ? 'active' : ''}
                onClick={() => setView('list')}
              >
                Danh sách
              </button>
              <button
                className={view === 'kanban' ? 'active' : ''}
                onClick={() => setView('kanban')}
              >
                Kanban
              </button>
            </div>
          </section>
        </aside>

        <main className="content">
          {view === 'list' && (
            <ListView
              items={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              now={now}
            />
          )}
          {view === 'kanban' && (
            <KanbanView
              lanes={kanbanLanes}
              onMove={handleMove}
              onSelect={setSelectedId}
              selectedId={selectedId}
              now={now}
            />
          )}
        </main>

        {selected && (
          <aside className="detail">
            <DetailPane
              note={selected}
              now={now}
              onEdit={handleEditField}
              onMove={handleMove}
              onReview={handleReview}
              onDelete={handleDelete}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        )}
      </div>

      <footer className="statusbar">
        <span className="path" title={location?.path ?? ''}>
          {location?.path ?? '—'}
        </span>
        <span>
          {savingFlash ? 'Đang lưu…' : `${items.filter((n) => n.deletedAt == null).length} note`}
        </span>
      </footer>

      {showReview && (
        <ReviewModal
          items={items}
          now={now}
          onReview={handleReview}
          onClose={() => setShowReview(false)}
        />
      )}

      {showComposer && (
        <ComposerModal
          onSubmit={handleCreate}
          onClose={() => setShowComposer(false)}
        />
      )}
    </div>
  );
}

// ---------------- Sub-components ----------------

function StatusPill({
  status,
  active,
  count,
  onClick,
  children,
}: {
  status?: NoteStatus;
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      className={`status-pill ${active ? 'active' : ''}`}
      data-status={status ?? ''}
      onClick={onClick}
    >
      <span>{children}</span>
      <span className="count">{count}</span>
    </button>
  );
}

function ListView({
  items,
  selectedId,
  onSelect,
  now,
}: {
  items: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}): JSX.Element {
  if (items.length === 0)
    return <div className="empty-pane">Không có note nào khớp filter.</div>;
  return (
    <ul className="note-list">
      {[...items]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            selected={selectedId === n.id}
            onClick={() => onSelect(n.id)}
            now={now}
          />
        ))}
    </ul>
  );
}

function NoteRow({
  note,
  selected,
  onClick,
  now,
}: {
  note: Note;
  selected: boolean;
  onClick: () => void;
  now: number;
}): JSX.Element {
  const bucket = notes.reviewAgeBucket(note, now);
  const status = note.status ?? 'inbox';
  const preview = (note.body || '').slice(0, 120);
  return (
    <li
      className={`note-row ${selected ? 'selected' : ''}`}
      data-status={status}
      data-bucket={bucket}
      onClick={onClick}
    >
      <div className="note-row-top">
        <strong className="title">{note.title || '(không tiêu đề)'}</strong>
        <span className="status-badge" data-status={status}>
          {notes.statusLabel(status)}
        </span>
      </div>
      {preview && <div className="preview muted">{preview}</div>}
      <div className="note-row-bottom">
        {note.tags.map((t) => (
          <span key={t} className="tag-chip">
            #{t}
          </span>
        ))}
        <span className={`age-chip ${bucket}`}>{ageChipLabel(note, now)}</span>
      </div>
    </li>
  );
}

function ageChipLabel(note: Note, now: number): string {
  const last = note.lastReviewedAt ?? note.createdAt;
  const days = Math.floor((now - last) / 86_400_000);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.floor(days / 30)} tháng`;
  return `${Math.floor(days / 365)} năm`;
}

function KanbanView({
  lanes,
  onMove,
  onSelect,
  selectedId,
  now,
}: {
  lanes: ReturnType<typeof notes.groupByKanban>;
  onMove: (id: string, status: NoteStatus) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  now: number;
}): JSX.Element {
  const onDragStart = (e: React.DragEvent, id: string): void => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (e: React.DragEvent, status: NoteStatus): void => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) onMove(id, status);
  };
  return (
    <div className="kanban">
      {lanes.map((lane) => (
        <section
          key={lane.status}
          className="lane"
          data-status={lane.status}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, lane.status)}
        >
          <header className="lane-head">
            <h3>{lane.label}</h3>
            <span className="muted tiny">{lane.notes.length}</span>
          </header>
          <ul className="lane-list">
            {lane.notes.map((n) => {
              const bucket = notes.reviewAgeBucket(n, now);
              return (
                <li
                  key={n.id}
                  className={`kanban-card ${selectedId === n.id ? 'selected' : ''}`}
                  draggable
                  data-bucket={bucket}
                  onDragStart={(e) => onDragStart(e, n.id)}
                  onClick={() => onSelect(n.id)}
                >
                  <strong>{n.title || '(không tiêu đề)'}</strong>
                  {n.body && <p className="muted">{n.body.slice(0, 80)}</p>}
                  <div className="kanban-meta">
                    {n.tags.slice(0, 3).map((t) => (
                      <span key={t} className="tag-chip">
                        #{t}
                      </span>
                    ))}
                    <span className={`age-chip ${bucket}`}>{ageChipLabel(n, now)}</span>
                  </div>
                </li>
              );
            })}
            {lane.notes.length === 0 && (
              <li className="empty-lane muted tiny">— kéo note vào đây —</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DetailPane({
  note,
  now,
  onEdit,
  onMove,
  onReview,
  onDelete,
  onClose,
}: {
  note: Note;
  now: number;
  onEdit: (id: string, field: 'title' | 'body', val: string) => void;
  onMove: (id: string, status: NoteStatus) => void;
  onReview: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const bucket = notes.reviewAgeBucket(note, now);
  return (
    <div className="detail-inner">
      <header className="detail-head">
        <h2>Chi tiết</h2>
        <button className="mini" onClick={onClose}>
          ×
        </button>
      </header>
      <label className="field">
        <span>Tiêu đề</span>
        <input
          value={note.title}
          onChange={(e) => onEdit(note.id, 'title', e.target.value)}
          maxLength={200}
        />
      </label>
      <label className="field">
        <span>Nội dung</span>
        <textarea
          value={note.body}
          onChange={(e) => onEdit(note.id, 'body', e.target.value)}
          rows={10}
          maxLength={20_000}
        />
      </label>
      <div className="detail-row">
        <span>Status</span>
        <select
          value={note.status ?? 'inbox'}
          onChange={(e) => onMove(note.id, e.target.value as NoteStatus)}
        >
          {(['inbox', 'active', 'waiting', 'done', 'archived'] as NoteStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {notes.statusLabel(s)}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="detail-row">
        <span>Tag</span>
        <span className="muted tiny">{note.tags.map((t) => '#' + t).join('  ') || '—'}</span>
      </div>
      <div className="detail-row">
        <span>Tạo</span>
        <span className="muted tiny">{formatDate(note.createdAt)}</span>
      </div>
      <div className="detail-row">
        <span>Review gần nhất</span>
        <span className={`muted tiny ${bucket}`}>
          {note.lastReviewedAt ? formatDate(note.lastReviewedAt) : '— chưa bao giờ —'}
        </span>
      </div>
      <div className="detail-actions">
        <button onClick={() => onReview(note.id)}>✓ Đánh dấu đã review</button>
        <button className="danger" onClick={() => onDelete(note.id)}>
          Xoá
        </button>
      </div>
    </div>
  );
}

function ReviewModal({
  items,
  now,
  onReview,
  onClose,
}: {
  items: Note[];
  now: number;
  onReview: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const due = useMemo(() => notes.notesDueForReview(items, now), [items, now]);
  const [cursor, setCursor] = useState(0);
  const current = due[cursor];
  const handleNext = (): void => {
    if (current) onReview(current.id);
    if (cursor + 1 >= due.length) {
      onClose();
    } else {
      setCursor((c) => c + 1);
    }
  };
  const handleSkip = (): void => {
    if (cursor + 1 >= due.length) {
      onClose();
    } else {
      setCursor((c) => c + 1);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Daily Review</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>
        {due.length === 0 && (
          <div className="empty-pane">
            <p>🎉 Không còn note nào cần review.</p>
            <p className="muted tiny">
              Streak sẽ tiếp tục nếu bạn review ít nhất 1 note mỗi ngày.
            </p>
          </div>
        )}
        {current && (
          <div className="review-card">
            <div className="progress muted tiny">
              {cursor + 1}/{due.length} · còn {due.length - cursor - 1} note
            </div>
            <h3>{current.title || '(không tiêu đề)'}</h3>
            {current.body && <pre className="review-body">{current.body}</pre>}
            <div className="review-meta muted tiny">
              {current.tags.length > 0 && (
                <span>{current.tags.map((t) => '#' + t).join('  ')} · </span>
              )}
              Lần review gần nhất:{' '}
              {current.lastReviewedAt ? formatDate(current.lastReviewedAt) : 'chưa có'}
            </div>
            <div className="review-actions">
              <button onClick={handleSkip}>Bỏ qua</button>
              <button className="primary" onClick={handleNext}>
                ✓ Đã review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComposerModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (draft: {
    title: string;
    body: string;
    tagsInput: string;
    status: NoteStatus;
  }) => void;
  onClose: () => void;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<NoteStatus>('inbox');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Note mới</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>
        <label className="field">
          <span>Tiêu đề</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Tiêu đề ngắn…"
          />
        </label>
        <label className="field">
          <span>Nội dung</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={20_000}
            placeholder="Nội dung — markdown cũng ok"
          />
        </label>
        <label className="field">
          <span>Tags (phân cách bằng dấu phẩy)</span>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="vd: study, blog, urgent"
          />
        </label>
        <label className="field">
          <span>Trạng thái</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as NoteStatus)}>
            {(['inbox', 'active', 'waiting', 'done'] as NoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {notes.statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="review-actions">
          <button onClick={onClose}>Huỷ</button>
          <button
            className="primary"
            onClick={() => onSubmit({ title, body, tagsInput, status })}
          >
            Tạo
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
