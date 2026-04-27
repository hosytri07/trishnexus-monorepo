/**
 * Phase 18.5.a — Library file annotation modal.
 *
 * Per-file structured comments, persisted to localStorage
 * `trishlibrary.annotations.v1` keyed by file path.
 *
 * Annotation types:
 *   - 💡 highlight: đoạn quan trọng cần đánh dấu
 *   - 📝 note: comment/diễn giải
 *   - ❓ question: câu hỏi cần làm rõ
 *   - ⚠ todo: việc cần làm dựa trên file này
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';

export type AnnotationType = 'highlight' | 'note' | 'question' | 'todo';

export interface Annotation {
  id: string;
  page: number | null;
  type: AnnotationType;
  excerpt: string; // đoạn trích từ file
  comment: string; // bình luận của user
  color: string; // hex
  created_at: number;
  updated_at: number;
}

/**
 * Phase 18.5.b — Per-user annotations.
 * Trước: chung 1 key → mọi user trên cùng máy thấy chung annotation.
 * Bây giờ: `trishlibrary.annotations.v1::{uid}`. Có migration legacy.
 */
const LEGACY_STORE_KEY = 'trishlibrary.annotations.v1';

function annotationsKeyForUid(uid: string | null): string {
  if (!uid) return LEGACY_STORE_KEY;
  return `${LEGACY_STORE_KEY}::${uid}`;
}

export function loadAnnotations(uid: string | null = null): Record<string, Annotation[]> {
  try {
    const key = annotationsKeyForUid(uid);
    let raw = window.localStorage.getItem(key);
    if (!raw && uid) {
      const legacy = window.localStorage.getItem(LEGACY_STORE_KEY);
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

export function saveAnnotations(
  store: Record<string, Annotation[]>,
  uid: string | null = null,
): void {
  try {
    const key = annotationsKeyForUid(uid);
    window.localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* quota — skip */
  }
}

export function getAnnotationsFor(path: string, uid: string | null = null): Annotation[] {
  return loadAnnotations(uid)[path] ?? [];
}

const TYPE_META: Record<AnnotationType, { icon: string; label: string; color: string }> = {
  highlight: { icon: '💡', label: 'Highlight', color: '#fef08a' },
  note: { icon: '📝', label: 'Ghi chú', color: '#bfdbfe' },
  question: { icon: '❓', label: 'Câu hỏi', color: '#fbcfe8' },
  todo: { icon: '⚠', label: 'Việc cần làm', color: '#fed7aa' },
};

interface Props {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function AnnotationModal({ filePath, fileName, onClose }: Props): JSX.Element {
  const { profile } = useAuth();
  const uid = profile?.id ?? null;
  const [annotations, setAnnotations] = useState<Annotation[]>(() =>
    getAnnotationsFor(filePath, uid),
  );
  const [editing, setEditing] = useState<Annotation | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !editing) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  function persist(next: Annotation[]): void {
    setAnnotations(next);
    const all = loadAnnotations(uid);
    if (next.length === 0) delete all[filePath];
    else all[filePath] = next;
    saveAnnotations(all, uid);
  }

  function handleSave(a: Annotation): void {
    const exists = annotations.some((x) => x.id === a.id);
    const next = exists
      ? annotations.map((x) => (x.id === a.id ? { ...a, updated_at: Date.now() } : x))
      : [a, ...annotations];
    persist(next);
    setEditing(null);
  }

  function handleDelete(id: string): void {
    if (!window.confirm('Xóa annotation này?')) return;
    persist(annotations.filter((x) => x.id !== id));
  }

  function handleAddNew(): void {
    const now = Date.now();
    setEditing({
      id: `ann-${now}-${Math.random().toString(36).slice(2, 8)}`,
      page: null,
      type: 'highlight',
      excerpt: '',
      comment: '',
      color: TYPE_META.highlight.color,
      created_at: now,
      updated_at: now,
    });
  }

  return (
    <div className="modal-backdrop" onClick={editing ? undefined : onClose}>
      <div
        className="annotation-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chú thích"
      >
        <header className="annotation-head">
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>📝 Chú thích — {fileName}</h2>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Highlight, ghi chú, câu hỏi, todo gắn với file này.
            </p>
          </div>
          <button className="mini" onClick={onClose} title="Đóng (Esc)">
            ×
          </button>
        </header>

        <div className="annotation-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="muted small">
              {annotations.length} chú thích
              {annotations.length > 0 && (
                <>
                  {' · '}
                  {(['highlight', 'note', 'question', 'todo'] as AnnotationType[])
                    .map((t) => {
                      const cnt = annotations.filter((a) => a.type === t).length;
                      return cnt > 0 ? `${TYPE_META[t].icon}${cnt}` : null;
                    })
                    .filter(Boolean)
                    .join(' ')}
                </>
              )}
            </span>
            <button className="btn btn-primary btn-sm" onClick={handleAddNew}>
              + Thêm chú thích
            </button>
          </div>

          {annotations.length === 0 ? (
            <div className="muted small" style={{ textAlign: 'center', padding: 36 }}>
              <p>Chưa có chú thích nào cho file này.</p>
              <button className="btn btn-ghost btn-sm" onClick={handleAddNew}>
                + Tạo chú thích đầu tiên
              </button>
            </div>
          ) : (
            <ul className="annotation-list">
              {annotations.map((a) => {
                const meta = TYPE_META[a.type];
                return (
                  <li key={a.id} className="annotation-item" style={{ borderLeftColor: a.color }}>
                    <div className="annotation-item-head">
                      <span title={meta.label}>{meta.icon}</span>
                      {a.page !== null && a.page !== undefined && (
                        <span className="muted small">trang {a.page}</span>
                      )}
                      <span className="muted small">
                        {new Date(a.updated_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button
                        className="mini"
                        onClick={() => setEditing(a)}
                        title="Sửa"
                      >
                        ✎
                      </button>
                      <button
                        className="mini"
                        onClick={() => handleDelete(a.id)}
                        title="Xóa"
                      >
                        ×
                      </button>
                    </div>
                    {a.excerpt && (
                      <blockquote
                        className="annotation-excerpt"
                        style={{ background: a.color + '40' /* 25% alpha */ }}
                      >
                        "{a.excerpt}"
                      </blockquote>
                    )}
                    {a.comment && (
                      <p className="annotation-comment">{a.comment}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {editing && (
          <AnnotationEditModal
            annotation={editing}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Edit modal (nested)
// ============================================================

function AnnotationEditModal({
  annotation,
  onSave,
  onCancel,
}: {
  annotation: Annotation;
  onSave: (a: Annotation) => void;
  onCancel: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState<Annotation>(annotation);

  function setType(type: AnnotationType): void {
    setDraft((d) => ({ ...d, type, color: TYPE_META[type].color }));
  }

  function handleSubmit(): void {
    if (!draft.excerpt.trim() && !draft.comment.trim()) {
      window.alert('Nhập ít nhất đoạn trích hoặc bình luận');
      return;
    }
    onSave(draft);
  }

  return (
    <div className="modal-backdrop annotation-edit-backdrop" onClick={onCancel}>
      <div
        className="annotation-edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="modal-head">
          <h3 style={{ margin: 0, fontSize: 14 }}>
            {annotation.id.startsWith('ann-')
              ? annotation.excerpt || annotation.comment
                ? '✎ Sửa chú thích'
                : '+ Chú thích mới'
              : '✎ Sửa chú thích'}
          </h3>
          <button className="mini" onClick={onCancel}>×</button>
        </header>
        <div className="modal-body">
          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Loại
          </label>
          <div className="segmented" style={{ marginBottom: 12 }}>
            {(Object.keys(TYPE_META) as AnnotationType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg-btn ${draft.type === t ? 'active' : ''}`}
                onClick={() => setType(t)}
                style={{ background: draft.type === t ? TYPE_META[t].color + '60' : undefined }}
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <label className="muted small">Trang:</label>
            <input
              type="number"
              min={0}
              value={draft.page ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  page: e.target.value === '' ? null : parseInt(e.target.value, 10),
                }))
              }
              placeholder="(không bắt buộc)"
              style={{
                width: 100,
                padding: '4px 8px',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                color: 'var(--fg)',
              }}
            />
            <span className="muted small">Màu:</span>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              style={{ width: 40, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 3 }}
            />
          </div>

          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Đoạn trích từ file (đoạn cần đánh dấu)
          </label>
          <textarea
            value={draft.excerpt}
            onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
            placeholder='"...nội dung trích từ file PDF/text..."'
            rows={3}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--fg)',
              fontFamily: 'inherit',
              fontSize: 13,
              resize: 'vertical',
              marginBottom: 12,
            }}
          />

          <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
            Bình luận / ghi chú của bạn
          </label>
          <textarea
            value={draft.comment}
            onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
            placeholder="Tại sao đoạn này quan trọng? Câu hỏi đặt ra? Việc cần làm?"
            rows={4}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--fg)',
              fontFamily: 'inherit',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
        </div>
        <footer className="modal-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onCancel}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            ✓ Lưu
          </button>
        </footer>
      </div>
    </div>
  );
}
