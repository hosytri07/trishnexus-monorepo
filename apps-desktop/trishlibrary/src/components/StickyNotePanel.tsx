/**
 * Phase 18.2.d — Sticky note widget panel.
 *
 * Floating draggable panel để quick-capture ý tưởng nhanh không cần switch
 * vào module Ghi chú. Save → tạo note mới qua module-bus (chuyển tab + prefill).
 *
 * Features:
 *   - Drag header để di chuyển
 *   - Position persist localStorage (per-screen-size để khỏi bay khỏi viewport)
 *   - Auto-save draft text vào localStorage (mất app vẫn còn)
 *   - 2 buttons: Lưu vào Ghi chú · Xóa nháp
 *   - Esc đóng panel
 *   - Mặc định góc dưới-phải, ghim trên các tab (visible kể cả khi switch module)
 */

import { useEffect, useRef, useState } from 'react';
import { requestCreateNoteAbout } from '../lib/module-bus.js';

interface Props {
  onClose: () => void;
}

const POS_KEY = 'trishlibrary.sticky.position';
const DRAFT_KEY = 'trishlibrary.sticky.draft';

interface Position {
  x: number;
  y: number;
}

function loadPosition(): Position {
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.x === 'number' && typeof p?.y === 'number') {
        // Clamp into viewport
        return {
          x: Math.max(0, Math.min(p.x, window.innerWidth - 320)),
          y: Math.max(0, Math.min(p.y, window.innerHeight - 200)),
        };
      }
    }
  } catch {
    /* ignore */
  }
  // Default: bottom-right corner
  return {
    x: Math.max(0, window.innerWidth - 360),
    y: Math.max(0, window.innerHeight - 320),
  };
}

function loadDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function StickyNotePanel({ onClose }: Props): JSX.Element {
  const [pos, setPos] = useState<Position>(() => loadPosition());
  const [text, setText] = useState<string>(() => loadDraft());
  const [pinned, setPinned] = useState(true);
  const [savedFlash, setSavedFlash] = useState(false);
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when opened
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Persist position
  useEffect(() => {
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos]);

  // Persist draft text (debounced via timer)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, text);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        const t = e.target as HTMLElement | null;
        // Only close if focus is inside the sticky (don't steal Esc from app)
        if (t?.closest('.sticky-note-panel')) {
          e.preventDefault();
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onDragStart(e: React.MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.sticky-note-head')) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e: MouseEvent): void {
      if (!dragRef.current) return;
      const newX = e.clientX - dragRef.current.offsetX;
      const newY = e.clientY - dragRef.current.offsetY;
      setPos({
        x: Math.max(0, Math.min(newX, window.innerWidth - 320)),
        y: Math.max(0, Math.min(newY, window.innerHeight - 200)),
      });
    }
    function onUp(): void {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return (): void => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function handleSaveAsNote(): void {
    if (!text.trim()) return;
    const firstLine = text.trim().split('\n')[0].slice(0, 50);
    const title = firstLine || 'Quick capture';
    const html = `<h2>📌 ${escapeHtml(title)}</h2>\n${text
      .split('\n')
      .map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`)
      .join('\n')}`;
    requestCreateNoteAbout({
      title,
      content_html: html,
      category: 'personal',
      tags: ['quick-capture', 'sticky'],
    });
    // Clear draft after saving
    setText('');
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleClearDraft(): void {
    if (!text.trim()) return;
    if (!window.confirm('Xóa toàn bộ nháp hiện tại?')) return;
    setText('');
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`sticky-note-panel ${pinned ? 'pinned' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onDragStart}
    >
      <header className="sticky-note-head">
        <span className="sticky-note-title">📌 Ghi nhanh</span>
        {savedFlash && <span className="sticky-note-flash">✓ Đã lưu</span>}
        <span style={{ flex: 1 }} />
        <button
          className="sticky-note-mini"
          onClick={() => setPinned((v) => !v)}
          title={pinned ? 'Bỏ ghim (cho phép nhường tab khác)' : 'Ghim luôn hiện'}
        >
          {pinned ? '📌' : '📎'}
        </button>
        <button
          className="sticky-note-mini"
          onClick={onClose}
          title="Đóng (Esc)"
        >
          ×
        </button>
      </header>

      <textarea
        ref={textareaRef}
        className="sticky-note-textarea"
        placeholder="Gõ ý tưởng nhanh… (auto-save vào nháp local)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
      />

      <footer className="sticky-note-foot">
        <span className="muted small">
          {text.length} ký tự · {text.split(/\s+/).filter(Boolean).length} từ
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleClearDraft}
          disabled={!text.trim()}
          title="Xóa toàn bộ nháp"
        >
          🗑
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSaveAsNote}
          disabled={!text.trim()}
          title="Tạo ghi chú mới với nội dung này"
        >
          ✓ Lưu vào Ghi chú
        </button>
      </footer>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
