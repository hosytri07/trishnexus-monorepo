/**
 * Phase 17.2 v4 — RichTextEditor.
 *
 * contentEditable-based editor, body store dạng HTML.
 *
 * Features:
 *  - Font family (system fonts), font size 6-48
 *  - Bold / Italic / Underline
 *  - Numbered list 1.2.3 + lettered list a.b.c
 *  - Reset format
 *
 * Migrate plain text → HTML: nếu body không chứa '<', wrap với escape + <br>.
 *
 * Lưu ý: dùng document.execCommand (deprecated nhưng vẫn work mọi browser
 * + WebView2). Đủ cho note app simple. Nếu sau này cần ProseMirror/TipTap,
 * có thể swap interface tương thích.
 */

import { useCallback, useEffect, useRef } from 'react';
import { fontStackFor, clampFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX } from '../settings.js';

export interface RichTextEditorProps {
  /** HTML body (hoặc plain text — sẽ auto migrate). */
  value: string;
  onChange: (html: string) => void;
  /** System fonts danh sách (lấy từ Rust list_system_fonts). */
  systemFonts: string[];
  /** Per-note font family override (rỗng = dùng default). */
  fontFamily?: string;
  onFontFamilyChange?: (family: string) => void;
  /** Per-note font size override (0 hoặc undefined = dùng default). */
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  /** Min height (px) cho editor area. */
  minHeight?: number;
  /** Placeholder hiện khi empty. */
  placeholder?: string;
  /** Slot bên phải toolbar — vd nút attach file/link. */
  toolbarExtras?: React.ReactNode;
  /** Hiện nút reset format (xoá hết style override). */
  showReset?: boolean;
  onReset?: () => void;
}

/** Detect HTML vs plain text. Phải bắt cả entity (&nbsp; &amp;) lẫn tag <b> */
function isHtml(s: string): boolean {
  return (
    /<[a-z\/!][^>]*>/i.test(s) ||
    /&[a-z]+;/i.test(s) ||
    /&#\d+;/.test(s)
  );
}

/** Escape HTML special chars trong plain text + giữ line breaks. */
function plainToHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/** Apply legacy plain text → HTML once. */
export function normalizeBody(value: string): string {
  if (!value) return '';
  return isHtml(value) ? value : plainToHtml(value);
}

export function RichTextEditor({
  value,
  onChange,
  systemFonts,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  minHeight = 220,
  placeholder = 'Bắt đầu ghi…',
  toolbarExtras,
  showReset,
  onReset,
}: RichTextEditorProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * Track giá trị HTML mới nhất do editor produce → tránh re-process khi
   * value prop chỉ là echo từ chính editor (gây double-escape `&` → `&amp;` chain).
   */
  const lastEditorOutput = useRef<string>('');

  // Sync external value → DOM (chỉ khi khác value editor vừa output).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEditorOutput.current) return; // chính editor vừa emit
    const desired = normalizeBody(value);
    if (el.innerHTML !== desired) {
      el.innerHTML = desired;
    }
    lastEditorOutput.current = desired;
  }, [value]);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEditorOutput.current = html;
    onChange(html);
  }, [onChange]);

  function exec(cmd: string, val?: string): void {
    // Đảm bảo focus vào editor trước khi execCommand áp dụng
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch (err) {
      console.warn('[rte] execCommand fail:', cmd, err);
    }
    sync();
  }

  /** Insert ordered list — cho phép chọn list-style-type ('decimal' | 'lower-alpha'). */
  function insertOrderedList(style: 'decimal' | 'lower-alpha'): void {
    ref.current?.focus();
    document.execCommand('insertOrderedList');
    // Tìm <ol> chứa selection và set style nếu cần
    if (style === 'lower-alpha') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node: Node | null = sel.getRangeAt(0).startContainer;
        while (node && node.nodeName !== 'OL') {
          node = node.parentNode;
        }
        if (node && node instanceof HTMLOListElement) {
          node.style.listStyleType = 'lower-alpha';
        }
      }
    }
    sync();
  }

  function changeFontSize(px: number): void {
    const clamped = clampFontSize(px);
    onFontSizeChange?.(clamped);
    // Áp ngay vào selection nếu có (dùng inline style span)
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      ref.current?.focus();
      // execCommand fontSize chỉ chấp nhận 1-7 → workaround: wrap span
      try {
        document.execCommand('fontSize', false, '7');
        // Tìm tất cả font[size="7"] vừa tạo và đổi sang span style
        const fonts = ref.current?.querySelectorAll('font[size="7"]');
        fonts?.forEach((f) => {
          const span = document.createElement('span');
          span.style.fontSize = `${clamped}px`;
          span.innerHTML = f.innerHTML;
          f.replaceWith(span);
        });
      } catch (err) {
        console.warn('[rte] font size fail:', err);
      }
      sync();
    }
  }

  function changeFontFamily(family: string): void {
    onFontFamilyChange?.(family);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && family) {
      ref.current?.focus();
      try {
        document.execCommand('fontName', false, family);
      } catch (err) {
        console.warn('[rte] font name fail:', err);
      }
      sync();
    }
  }

  const effectiveFontStack = fontStackFor(fontFamily);
  const effectiveFontSize =
    fontSize && fontSize > 0 ? `${clampFontSize(fontSize)}px` : 'var(--note-font-size, 14px)';

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <select
          className="rte-select"
          value={fontFamily ?? ''}
          onChange={(e) => changeFontFamily(e.target.value)}
          title="Font chữ"
        >
          <option value="">— mặc định —</option>
          {systemFonts.map((f) => (
            <option key={f} value={f} style={{ fontFamily: fontStackFor(f) }}>
              {f}
            </option>
          ))}
        </select>

        <input
          type="number"
          className="rte-size"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={1}
          value={fontSize && fontSize > 0 ? fontSize : ''}
          placeholder="14"
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : 0;
            if (v === 0) onFontSizeChange?.(0);
            else changeFontSize(v);
          }}
          title={`Cỡ chữ ${FONT_SIZE_MIN}-${FONT_SIZE_MAX}px`}
        />

        <div className="rte-divider" />

        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          title="Đậm (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          title="Nghiêng (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('underline')}
          title="Gạch chân (Ctrl+U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>

        <div className="rte-divider" />

        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertOrderedList('decimal')}
          title="Danh sách số 1. 2. 3."
        >
          1.
        </button>
        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertOrderedList('lower-alpha')}
          title="Danh sách chữ a. b. c."
        >
          a.
        </button>
        <button
          type="button"
          className="rte-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
          title="Danh sách bullet"
        >
          •
        </button>

        {showReset && (
          <>
            <div className="rte-divider" />
            <button
              type="button"
              className="rte-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                exec('removeFormat');
                onReset?.();
              }}
              title="Xoá định dạng"
            >
              ↺
            </button>
          </>
        )}

        {toolbarExtras && <div className="rte-toolbar-extras">{toolbarExtras}</div>}
      </div>

      <div
        ref={ref}
        className="rte-content"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={placeholder}
        style={{
          fontFamily: effectiveFontStack,
          fontSize: effectiveFontSize,
          minHeight,
        }}
      />
    </div>
  );
}
