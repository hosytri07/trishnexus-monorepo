/**
 * Phase 18.3.a — DocEditorPanel.
 *
 * TipTap editor cho module Tài liệu sub-tab "Soạn thảo".
 * Tab system + format toolbar + system fonts.
 */

import { useEffect, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import type { DocTab } from './types.js';
import { countDocumentMetrics } from './formats.js';
export type { DocTab };

interface Props {
  tabs: DocTab[];
  activeId: string | null;
  systemFonts: string[];
  tr: (key: string, vars?: Record<string, string | number>) => string;
  tabSearch?: string;
  onTabSearchChange?: (q: string) => void;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onUpdate: (id: string, html: string) => void;
  onNewTab: () => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export function DocEditorPanel({
  tabs,
  activeId,
  systemFonts,
  tr,
  tabSearch = '',
  onTabSearchChange,
  focusMode = false,
  onToggleFocusMode,
  onActivate,
  onClose,
  onUpdate,
  onNewTab,
}: Props): JSX.Element {
  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Image.configure({ inline: false, allowBase64: true }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: 'tiptap-link' },
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        TaskList,
        TaskItem.configure({ nested: true }),
        Typography,
        CharacterCount,
        Placeholder.configure({ placeholder: tr('doc.editor.placeholder') }),
      ],
      content: activeTab?.html ?? '<p></p>',
      editorProps: {
        attributes: {
          class: 'tiptap-doc-editor',
          spellcheck: 'false',
        },
      },
      onUpdate: ({ editor }) => {
        if (activeTab) onUpdate(activeTab.id, editor.getHTML());
      },
    },
    [activeTab?.id],
  );

  // Sync content khi switch tab
  useEffect(() => {
    if (!editor || !activeTab) return;
    const current = editor.getHTML();
    if (current !== activeTab.html) {
      editor.commands.setContent(activeTab.html, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id]);

  if (tabs.length === 0) {
    return (
      <div className="doc-empty">
        <h2>{tr('doc.empty.welcome')}</h2>
        <p className="muted">{tr('doc.empty.hint')}</p>
        <button className="btn btn-primary" onClick={onNewTab} style={{ marginTop: 12 }}>
          {tr('doc.empty.create')}
        </button>
      </div>
    );
  }

  // Filter tabs by search query (search in tab name)
  const filteredTabs = tabSearch.trim()
    ? tabs.filter((t) =>
        t.name.toLowerCase().includes(tabSearch.toLowerCase().trim()),
      )
    : tabs;

  return (
    <div className={`doc-editor-pane ${focusMode ? 'focus-mode' : ''}`}>
      {/* Tab bar */}
      <div className="doc-tab-bar">
        {onToggleFocusMode && (
          <button
            type="button"
            className="doc-focus-btn"
            onClick={onToggleFocusMode}
            title={focusMode ? 'Tắt focus mode (Esc)' : 'Bật focus mode (Ctrl+Shift+F)'}
          >
            {focusMode ? '◱' : '⛶'}
          </button>
        )}
        {onTabSearchChange && tabs.length > 1 && (
          <input
            type="text"
            className="doc-tab-search"
            placeholder="🔍 Tìm tab…"
            value={tabSearch}
            onChange={(e) => onTabSearchChange(e.target.value)}
          />
        )}
        {filteredTabs.map((t) => (
          <div
            key={t.id}
            className={`doc-tab-item ${activeId === t.id ? 'active' : ''} ${t.html !== t.savedHtml ? 'dirty' : ''}`}
            onClick={() => onActivate(t.id)}
            title={t.path ?? '(chưa lưu)'}
          >
            <span className="doc-tab-icon">📄</span>
            <span className="doc-tab-name">{t.name}</span>
            {t.html !== t.savedHtml && <span className="doc-tab-dot">●</span>}
            <button
              className="doc-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              title="Đóng"
            >
              ×
            </button>
          </div>
        ))}
        <button className="doc-tab-add" onClick={onNewTab} title="File mới">
          ＋
        </button>
      </div>

      {/* Format toolbar */}
      {editor && <DocFormatToolbar editor={editor} systemFonts={systemFonts} />}

      {/* Ruler */}
      <DocRuler />

      {/* Body layout: Outline LEFT + Editor + Properties RIGHT */}
      <div className="doc-body">
        {!focusMode && activeTab && editor && <DocOutlineSidebar editor={editor} tr={tr} />}
        <div className="doc-content-area">
          {editor && (
            <div className="doc-editor-wrap">
              <EditorContent editor={editor} />
            </div>
          )}
        </div>
        {!focusMode && activeTab && (
          <DocPropertiesPanel tab={activeTab} editor={editor} tr={tr} />
        )}
      </div>

      {/* Footer metrics */}
      {activeTab && <DocEditorFooter html={activeTab.html} tr={tr} />}
    </div>
  );
}

// ============================================================
// Outline Sidebar (LEFT) — heading TOC riêng
// ============================================================

function DocOutlineSidebar({
  editor,
  tr,
}: {
  editor: Editor;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}): JSX.Element {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((x) => x + 1);
    editor.on('update', handler);
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('update', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);

  const headings: Array<{ pos: number; level: number; text: string }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos,
        level: node.attrs.level as number,
        text: node.textContent || '(empty)',
      });
    }
  });

  // Compute current heading at cursor for active highlighting
  const cursorPos = editor.state.selection.from;
  let activeIdx = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].pos <= cursorPos) {
      activeIdx = i;
    } else {
      break;
    }
  }

  return (
    <aside className="doc-outline-sidebar">
      <div className="outline-sidebar-head">
        <h4>☰ {tr('doc.props.outline')}</h4>
        <span className="muted small">{headings.length}</span>
      </div>
      <div className="outline-sidebar-body">
        {headings.length === 0 ? (
          <p className="outline-empty muted">{tr('doc.props.outline_empty')}</p>
        ) : (
          headings.map((h, i) => (
            <button
              key={`${h.pos}-${i}`}
              className={`outline-item h${h.level} ${i === activeIdx ? 'active' : ''}`}
              onClick={() => {
                editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run();
              }}
              title={h.text}
            >
              {h.text}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

// ============================================================
// Ruler — căn chỉnh ngang giống Word
// ============================================================

function DocRuler(): JSX.Element {
  // 38px ≈ 1cm at 96 DPI 100% zoom
  // Show marks: major every 1cm với số, minor every 0.5cm
  const totalCm = 25; // ~30cm wide ruler
  const marks: JSX.Element[] = [];
  for (let cm = 0; cm <= totalCm; cm += 0.5) {
    const isMajor = Number.isInteger(cm);
    marks.push(
      <span
        key={cm}
        className={`ruler-mark ${isMajor ? 'major' : 'minor'}`}
        style={{ left: `${cm * 38}px` }}
        data-cm={isMajor && cm > 0 ? cm.toString() : ''}
      />,
    );
  }
  return (
    <div className="doc-ruler">
      <div className="doc-ruler-inner">{marks}</div>
    </div>
  );
}

// ============================================================
// Properties panel — bên phải editor
// ============================================================

function DocPropertiesPanel({
  tab,
  editor,
  tr,
}: {
  tab: DocTab;
  editor: Editor | null;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}): JSX.Element {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => force((x) => x + 1);
    editor.on('update', handler);
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('update', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);

  const metrics = countDocumentMetrics(tab.html);

  const dirty = tab.html !== tab.savedHtml;
  const created = new Date(tab.created_ms);

  return (
    <aside className="doc-props">
      {/* File info */}
      <div className="props-section">
        <h4>📄 {tr('doc.props.file')}</h4>
        <div className="props-grid">
          <span className="muted small">{tr('doc.props.name')}</span>
          <strong className="props-name" title={tab.name}>
            {tab.name}
          </strong>
          <span className="muted small">{tr('doc.props.format')}</span>
          <code>.{tab.format}</code>
          <span className="muted small">{tr('doc.props.path')}</span>
          <code className="props-path" title={tab.path ?? tr('doc.props.no_path')}>
            {tab.path ?? tr('doc.props.no_path')}
          </code>
          <span className="muted small">{tr('doc.props.created')}</span>
          <span className="small">{created.toLocaleString()}</span>
          <span className="muted small">{tr('doc.props.status')}</span>
          <span className={`small ${dirty ? 'dirty-flag' : 'clean-flag'}`}>
            {dirty ? tr('doc.props.dirty') : tr('doc.props.clean')}
          </span>
        </div>
      </div>

      {/* Statistics */}
      <div className="props-section">
        <h4>📊 {tr('doc.props.stats')}</h4>
        <div className="props-stats">
          <div className="stat-card">
            <strong>{metrics.words.toLocaleString()}</strong>
            <span className="muted small">{tr('doc.stats.words')}</span>
          </div>
          <div className="stat-card">
            <strong>{metrics.chars.toLocaleString()}</strong>
            <span className="muted small">{tr('doc.stats.chars')}</span>
          </div>
          <div className="stat-card">
            <strong>{metrics.paragraphs}</strong>
            <span className="muted small">{tr('doc.stats.paragraphs')}</span>
          </div>
          <div className="stat-card">
            <strong>~{metrics.readingTimeMin}</strong>
            <span className="muted small">{tr('doc.stats.reading_time')}</span>
          </div>
        </div>
      </div>

    </aside>
  );
}

function DocFormatToolbar({
  editor,
  systemFonts,
}: {
  editor: Editor;
  systemFonts: string[];
}): JSX.Element {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((x) => x + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs);

  function setColor(): void {
    const c = window.prompt('Màu chữ (hex):', '#22d3ee');
    if (c?.trim()) editor.chain().focus().setColor(c.trim()).run();
  }

  function setHighlight(): void {
    const c = window.prompt('Màu highlight (hex):', '#fef08a');
    if (c?.trim()) editor.chain().focus().toggleHighlight({ color: c.trim() }).run();
  }

  function setLink(): void {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL:', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  function setImage(): void {
    const url = window.prompt('Image URL:', 'https://');
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  function insertTable(): void {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  function setFont(name: string): void {
    if (name === 'default') {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(name).run();
    }
  }

  return (
    <div className="format-toolbar">
      <div className="tb-group">
        <button
          className={`tb-btn ${isActive('bold') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className={`tb-btn ${isActive('italic') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className={`tb-btn ${isActive('underline') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <button
          className={`tb-btn ${isActive('strike') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strike"
        >
          <s>S</s>
        </button>
        <button
          className={`tb-btn ${isActive('code') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          {'<>'}
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <select
          className="tb-select"
          value={
            isActive('heading', { level: 1 })
              ? 'h1'
              : isActive('heading', { level: 2 })
                ? 'h2'
                : isActive('heading', { level: 3 })
                  ? 'h3'
                  : 'p'
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else {
              const lvl = parseInt(v.slice(1), 10) as 1 | 2 | 3 | 4;
              editor.chain().focus().toggleHeading({ level: lvl }).run();
            }
          }}
        >
          <option value="p">¶ Đoạn</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
          <option value="h4">H4</option>
        </select>

        <select
          className="tb-select"
          onChange={(e) => setFont(e.target.value)}
          value={(editor.getAttributes('textStyle').fontFamily as string) ?? 'default'}
          title={systemFonts.length > 0 ? `${systemFonts.length} font hệ thống` : 'Đang tải font…'}
          style={{ minWidth: 130, maxWidth: 150 }}
        >
          <option value="default">Font mặc định</option>
          {systemFonts.length === 0 && (
            <>
              <option value="Georgia">Georgia</option>
              <option value="'Times New Roman'">Times</option>
              <option value="Arial">Arial</option>
            </>
          )}
          {systemFonts.map((f) => (
            <option key={f} value={`'${f}'`} style={{ fontFamily: `'${f}'` }}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button
          className={`tb-btn ${isActive('bulletList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet"
        >
          •
        </button>
        <button
          className={`tb-btn ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered"
        >
          1.
        </button>
        <button
          className={`tb-btn ${isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list"
        >
          ☐
        </button>
        <button
          className={`tb-btn ${isActive('blockquote') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          ❝
        </button>
        <button
          className={`tb-btn ${isActive('codeBlock') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          {'</>'}
        </button>
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="HR"
        >
          ―
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <button
            key={a}
            className={`tb-btn ${editor.isActive({ textAlign: a }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign(a).run()}
            title={`Align ${a}`}
          >
            {a === 'left' ? '⫷' : a === 'center' ? '⩌' : a === 'right' ? '⫸' : '⩃'}
          </button>
        ))}
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button className="tb-btn" onClick={setColor} title="Text color">
          <span style={{ color: 'var(--accent)' }}>A</span>
        </button>
        <button className="tb-btn" onClick={setHighlight} title="Highlight">
          🖍
        </button>
        <button className="tb-btn" onClick={setLink} title="Link">
          🔗
        </button>
        <button className="tb-btn" onClick={setImage} title="Image">
          🖼
        </button>
        <button className="tb-btn" onClick={insertTable} title="Table">
          ⌗
        </button>
      </div>

      <div className="tb-divider" />

      {/* Phase 18.3.c — Advanced tools */}
      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => insertTableOfContents(editor)}
          title="Chèn mục lục tự động từ headings"
        >
          📑
        </button>
        <button
          className="tb-btn"
          onClick={() => copyOutlineAsMarkdown(editor)}
          title="Copy outline (markdown) vào clipboard"
        >
          📋
        </button>
        <button
          className="tb-btn"
          onClick={() => wrapSelectionWithMath(editor)}
          title="Wrap selection trong $...$ (math)"
        >
          ∑
        </button>
        <button
          className="tb-btn"
          onClick={() => insertTimestamp(editor)}
          title="Chèn thời gian hiện tại"
        >
          🕒
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          ↶
        </button>
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          ↷
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Phase 18.3.c — Advanced editor helpers
// ============================================================

interface OutlineHeading {
  level: number;
  text: string;
}

function collectHeadings(editor: Editor): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') {
      out.push({
        level: (node.attrs.level as number) ?? 1,
        text: node.textContent.trim() || '(Trống)',
      });
    }
  });
  return out;
}

/** Insert a nested bullet-list ToC at current cursor position. */
function insertTableOfContents(editor: Editor): void {
  const headings = collectHeadings(editor);
  if (headings.length === 0) {
    window.alert('Chưa có heading nào (H1/H2/H3) để tạo mục lục.');
    return;
  }
  // Build HTML — nested <ul> based on heading level
  const minLevel = Math.min(...headings.map((h) => h.level));
  let html = '<h2>📑 Mục lục</h2>';
  let prevLevel = minLevel - 1;
  for (const h of headings) {
    const rel = h.level - minLevel + 1;
    while (prevLevel < rel) {
      html += '<ul>';
      prevLevel++;
    }
    while (prevLevel > rel) {
      html += '</ul>';
      prevLevel--;
    }
    html += `<li>${escapeHtml(h.text)}</li>`;
  }
  while (prevLevel > 0) {
    html += '</ul>';
    prevLevel--;
  }
  editor.chain().focus().insertContent(html).run();
}

/** Copy outline as markdown list to clipboard. */
async function copyOutlineAsMarkdown(editor: Editor): Promise<void> {
  const headings = collectHeadings(editor);
  if (headings.length === 0) {
    window.alert('Chưa có heading nào để copy.');
    return;
  }
  const minLevel = Math.min(...headings.map((h) => h.level));
  const lines = headings.map((h) => {
    const indent = '  '.repeat(h.level - minLevel);
    return `${indent}- ${h.text}`;
  });
  const md = lines.join('\n');
  try {
    await navigator.clipboard.writeText(md);
    window.alert(`✓ Đã copy ${headings.length} heading dưới dạng markdown vào clipboard.`);
  } catch (err) {
    window.alert(`Không copy được: ${String(err)}\n\n${md}`);
  }
}

/** Wrap current selection with $...$ for math notation. */
function wrapSelectionWithMath(editor: Editor): void {
  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, ' ');
  if (!text.trim()) {
    editor.chain().focus().insertContent('$x^2$').run();
    return;
  }
  // Replace selection with $...$
  editor
    .chain()
    .focus()
    .deleteRange({ from, to })
    .insertContent(`$${text}$`)
    .run();
}

/** Insert current date+time at cursor. */
function insertTimestamp(editor: Editor): void {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const stamp = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  editor.chain().focus().insertContent(stamp).run();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function DocEditorFooter({
  html,
  tr,
}: {
  html: string;
  tr: (key: string, vars?: Record<string, string | number>) => string;
}): JSX.Element {
  const m = countDocumentMetrics(html);
  // Phase 18.3.c — count headings + sentences + readability estimate
  const headingCount = (html.match(/<h[1-6][^>]*>/gi) ?? []).length;
  const sentenceCount = m.words > 0
    ? Math.max(1, ((html.replace(/<[^>]+>/g, ' ').match(/[.!?。？！]+/g) ?? []).length))
    : 0;
  const avgWordsPerSentence = sentenceCount > 0 ? Math.round(m.words / sentenceCount) : 0;

  return (
    <div className="doc-editor-footer">
      <span className="muted small doc-footer-stats">
        <span title="Số từ">📝 {m.words.toLocaleString()} từ</span>
        <span title="Số ký tự">🔤 {m.chars.toLocaleString()}</span>
        <span title="Số đoạn">¶ {m.paragraphs}</span>
        {headingCount > 0 && <span title="Số heading">⟨H⟩ {headingCount}</span>}
        {sentenceCount > 0 && <span title="Số câu">. {sentenceCount}</span>}
        {avgWordsPerSentence > 0 && (
          <span
            title="Số từ trung bình mỗi câu (15-20 là tối ưu, >25 nên ngắt câu)"
            className={avgWordsPerSentence > 25 ? 'stat-warn' : ''}
          >
            ⌀ {avgWordsPerSentence} từ/câu
          </span>
        )}
        <span title="Thời gian đọc ước lượng (250 từ/phút)">
          ⏱ ~{m.readingTimeMin} {tr('doc.stats.reading_time')}
        </span>
      </span>
    </div>
  );
}
