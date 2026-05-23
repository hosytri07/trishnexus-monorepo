/**
 * Phase 18.2.c — Note template picker modal.
 *
 * Hiển thị 10 templates dạng card, có search filter + category tabs.
 * Click → callback `onPick(template)` để parent insert content.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { NOTE_TEMPLATES, type NoteTemplate, expandTemplate } from './note-templates.js';

interface Props {
  onClose: () => void;
  onPick: (expanded: { title: string; html: string; template: NoteTemplate }) => void;
}

const CATEGORIES: Array<{ id: 'all' | 'work' | 'personal' | 'project'; icon: string; label: string }> = [
  { id: 'all', icon: '🗂', label: 'Tất cả' },
  { id: 'work', icon: '💼', label: 'Công việc' },
  { id: 'personal', icon: '🌱', label: 'Cá nhân' },
  { id: 'project', icon: '🚀', label: 'Dự án' },
];

export function NoteTemplatePicker({ onClose, onPick }: Props): JSX.Element {
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<'all' | 'work' | 'personal' | 'project'>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIdx]) {
          handlePick(filtered[activeIdx]);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, filter, category]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return NOTE_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [filter, category]);

  function handlePick(t: NoteTemplate): void {
    const expanded = expandTemplate(t);
    onPick({ title: expanded.title, html: expanded.html, template: t });
    onClose();
  }

  return (
    <div className="modal-backdrop note-tpl-backdrop" onClick={onClose}>
      <div
        className="note-tpl-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chọn template"
      >
        <header className="note-tpl-head">
          <h2>📋 Chọn template ghi chú</h2>
          <button className="mini" onClick={onClose} title="Đóng (Esc)">
            ×
          </button>
        </header>

        <div className="note-tpl-toolbar">
          <input
            ref={inputRef}
            type="text"
            className="note-tpl-search"
            placeholder="Tìm template…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="segmented">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`seg-btn ${category === c.id ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c.id);
                  setActiveIdx(0);
                }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="note-tpl-grid">
          {filtered.length === 0 ? (
            <div className="muted small" style={{ padding: 24, textAlign: 'center' }}>
              Không tìm thấy template khớp "<strong>{filter}</strong>"
            </div>
          ) : (
            filtered.map((t, i) => (
              <button
                key={t.id}
                type="button"
                className={`note-tpl-card ${i === activeIdx ? 'active' : ''}`}
                onClick={() => handlePick(t)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="note-tpl-icon">{t.icon}</span>
                <div className="note-tpl-text">
                  <strong>{t.name}</strong>
                  <p className="muted small">{t.description}</p>
                </div>
                <span className="note-tpl-cat muted small">
                  {t.category === 'work'
                    ? '💼'
                    : t.category === 'project'
                      ? '🚀'
                      : '🌱'}
                </span>
              </button>
            ))
          )}
        </div>

        <footer className="note-tpl-foot muted small">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> Chọn · <kbd>Enter</kbd> Insert · <kbd>Esc</kbd> Đóng
          </span>
          <span>{filtered.length} / {NOTE_TEMPLATES.length} template</span>
        </footer>
      </div>
    </div>
  );
}
