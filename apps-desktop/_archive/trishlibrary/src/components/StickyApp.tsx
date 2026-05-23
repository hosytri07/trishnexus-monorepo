/**
 * StickyApp — Sticky note app standalone, chạy trong cửa sổ Tauri riêng
 * (label='sticky', alwaysOnTop, skipTaskbar, no decorations). Hoạt động
 * tương tự Windows Sticky Notes: ẩn app chính, sticky vẫn nổi trên desktop.
 *
 * Sync content qua localStorage (TrishLibrary main + sticky window cùng đọc/ghi
 * cùng key 'trishlibrary.sticky.draft').
 */

import { useEffect, useRef, useState } from 'react';

const DRAFT_KEY = 'trishlibrary.sticky.draft';

function loadDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? '';
  } catch {
    return '';
  }
}

export function StickyApp(): JSX.Element {
  const [text, setText] = useState<string>(() => loadDraft());
  const [savedFlash, setSavedFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ start: { x: number; y: number } } | null>(null);

  // Auto-focus textarea khi mở
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Persist text → localStorage debounce 500ms
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, text);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 800);
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(t);
  }, [text]);

  // Sync với main window: listen storage event
  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key === DRAFT_KEY && e.newValue !== null && e.newValue !== text) {
        setText(e.newValue);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [text]);

  // Drag header to move window (Tauri startDragging)
  async function handleHeaderMouseDown(e: React.MouseEvent): Promise<void> {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.warn('[sticky] startDragging fail:', err);
    }
  }

  async function handleClose(): Promise<void> {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().hide();
    } catch (err) {
      console.warn('[sticky] hide fail:', err);
    }
  }

  function handleClear(): void {
    setText('');
    textareaRef.current?.focus();
  }

  /** Emit event tới main window → tạo note thật + clear draft. */
  async function handleSaveToNote(): Promise<void> {
    if (!text.trim()) return;
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('sticky:save-to-note', { text });
      setText('');
      // Flash visual confirm
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      console.warn('[sticky] save-to-note fail:', err);
    }
  }

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  void dragRef;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        color: '#1a1a1a',
        fontFamily: 'inherit',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={(e) => void handleHeaderMouseDown(e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.06)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 14 }}>📌</span>
        <strong style={{ fontSize: 12, flex: 1 }}>Ghi nhanh</strong>
        <span
          style={{
            fontSize: 10,
            color: savedFlash ? '#059669' : '#6B7280',
            transition: 'color 0.3s',
          }}
        >
          {savedFlash ? '✓ Đã lưu' : 'Tự động lưu'}
        </span>
        <button
          type="button"
          onClick={() => void handleClose()}
          title="Ẩn (vẫn giữ nội dung)"
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            padding: '2px 6px',
            borderRadius: 3,
            lineHeight: 1,
            color: '#1a1a1a',
          }}
        >
          ×
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Gõ ý tưởng nhanh… (auto-save vào nháp local, dùng chung với app chính)"
        style={{
          flex: 1,
          padding: 10,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.5,
          color: '#1a1a1a',
        }}
      />

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.04)',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: 11,
          color: '#6B7280',
        }}
      >
        <span style={{ flex: 1 }}>
          {charCount} ký tự · {wordCount} từ
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={!text}
          title="Xóa nháp"
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: '1px solid rgba(0,0,0,0.2)',
            borderRadius: 3,
            background: 'transparent',
            cursor: text ? 'pointer' : 'not-allowed',
            opacity: text ? 1 : 0.4,
            color: '#1a1a1a',
          }}
        >
          🗑
        </button>
        <button
          type="button"
          onClick={() => void handleSaveToNote()}
          disabled={!text.trim()}
          title="Lưu nội dung thành note thật trong module Ghi chú"
          style={{
            padding: '3px 10px',
            fontSize: 11,
            border: '1px solid #059669',
            borderRadius: 3,
            background: text.trim() ? '#10B981' : 'transparent',
            color: text.trim() ? '#fff' : '#6B7280',
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            opacity: text.trim() ? 1 : 0.4,
          }}
        >
          💾 Lưu vào Ghi chú
        </button>
      </div>
    </div>
  );
}
