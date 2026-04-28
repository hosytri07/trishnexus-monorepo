/**
 * Phase 17.6 v2 — EditorPanel.
 *
 * TipTap rich-text editor + format toolbar + tab bar + sidebar (outline + stats).
 * Hỗ trợ: bold/italic/underline/strike/code/heading/list/task/quote/code-block/
 *         text-align/color/highlight/font-family/link/image/table.
 *
 * Distinguished features (MVP picks):
 *   - Document statistics (word/char/reading time + Flesch + top words)
 *   - Focus mode (chỉ paragraph hiện tại sáng, blur xung quanh)
 *   - Reading mode (preview như Medium)
 *   - Outline TOC sidebar (click heading → jump)
 *   - Outline mode (collapse content, hiện chỉ heading)
 *   - Auto-format on paste (URL → link, "1. " → list, "- [ ] " → task)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
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
import {
  countDocumentMetrics,
  fleschScore,
  readabilityLabel,
  topWords,
} from './formats.js';
import type { DocTab } from './App.js';
import type { AppSettings } from './settings.js';
import { editorFontStack } from './settings.js';

interface Props {
  tabs: DocTab[];
  activeId: string | null;
  settings: AppSettings;
  systemFonts: string[];
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onUpdate: (id: string, html: string) => void;
  onNewTab: () => void;
}

type SidebarTab = 'outline' | 'stats' | 'tools';
type EditorView = 'normal' | 'focus' | 'reading' | 'outline';

export function EditorPanel(props: Props): JSX.Element {
  const { tabs, activeId, settings, systemFonts, onActivate, onClose, onUpdate, onNewTab } = props;
  const activeTab = tabs.find((t) => t.id === activeId) ?? null;
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('outline');
  const [view, setView] = useState<EditorView>('normal');
  const [zoom, setZoom] = useState<number>(1.0);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: { HTMLAttributes: { class: 'tiptap-code-block' } },
        }),
        Underline,
        Image.configure({ inline: false, allowBase64: true }),
        Link.configure({
          openOnClick: false,
          autolink: settings.autoFormatPaste,
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
        Placeholder.configure({
          placeholder: 'Bắt đầu viết… (gõ "/" để chèn nhanh — sắp có)',
        }),
      ],
      content: activeTab?.html ?? '<p></p>',
      onUpdate: ({ editor }) => {
        if (activeTab) {
          onUpdate(activeTab.id, editor.getHTML());
        }
      },
      editorProps: {
        attributes: {
          class: 'tiptap-editor',
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
        },
      },
    },
    [activeTab?.id], // re-create editor khi switch tab
  );

  // Apply font + zoom to editor
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.style.fontFamily = editorFontStack(settings.editorFontFamily);
    dom.style.fontSize = `${Math.round(settings.editorFontSize * zoom)}px`;
  }, [editor, settings.editorFontFamily, settings.editorFontSize, zoom]);

  // Set content when activeTab changes
  useEffect(() => {
    if (!editor || !activeTab) return;
    const current = editor.getHTML();
    if (current !== activeTab.html) {
      editor.commands.setContent(activeTab.html, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id]);

  // Find/Replace shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowFind(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowFind(true);
      } else if (e.key === 'Escape' && showFind) {
        setShowFind(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFind]);

  if (tabs.length === 0) {
    return (
      <div className="layout-empty">
        <div className="empty">
          <h2>👋 Chào mừng đến với TrishType</h2>
          <p className="muted">
            Bấm <strong>＋ Mới</strong> để chọn template hoặc <strong>📂 Mở</strong> file có sẵn.
          </p>
          <button className="btn btn-primary" onClick={onNewTab} style={{ marginTop: 12 }}>
            ＋ Tạo tài liệu mới
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="layout">
      {/* Sidebar */}
      <aside className="ed-sidebar">
        <div className="ed-sidebar-tabs">
          <button
            className={`ed-sidebar-tab ${sidebarTab === 'outline' ? 'active' : ''}`}
            onClick={() => setSidebarTab('outline')}
            title="Outline TOC"
          >
            ☰
          </button>
          <button
            className={`ed-sidebar-tab ${sidebarTab === 'stats' ? 'active' : ''}`}
            onClick={() => setSidebarTab('stats')}
            title="Document statistics"
          >
            📊
          </button>
          <button
            className={`ed-sidebar-tab ${sidebarTab === 'tools' ? 'active' : ''}`}
            onClick={() => setSidebarTab('tools')}
            title="View tools"
          >
            🎛
          </button>
        </div>
        <div className="ed-sidebar-body">
          {sidebarTab === 'outline' && editor && (
            <OutlineList editor={editor} onJump={(pos) => editor.commands.focus(pos)} />
          )}
          {sidebarTab === 'stats' && activeTab && (
            <StatsPanel html={activeTab.html} />
          )}
          {sidebarTab === 'tools' && (
            <ToolsPanel
              view={view}
              setView={setView}
              zoom={zoom}
              setZoom={setZoom}
            />
          )}
        </div>
      </aside>

      {/* Main editor */}
      <section className={`ed-main view-${view}`}>
        {/* Tab bar */}
        <div className="tab-bar">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`tab-item ${activeId === t.id ? 'active' : ''} ${t.html !== t.savedHtml ? 'dirty' : ''}`}
              onClick={() => onActivate(t.id)}
              title={t.path ?? '(chưa lưu)'}
            >
              <span className="tab-icon">📄</span>
              <span className="tab-name">{t.name}</span>
              {t.html !== t.savedHtml && <span className="tab-dot">●</span>}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(t.id);
                }}
                title="Đóng (Ctrl+W)"
              >
                ×
              </button>
            </div>
          ))}
          <button className="tab-add" onClick={onNewTab} title="File mới (Ctrl+N)">
            ＋
          </button>
        </div>

        {/* Format toolbar */}
        {editor && view !== 'reading' && (
          <FormatToolbar editor={editor} settings={settings} systemFonts={systemFonts} />
        )}

        {/* Find/Replace bar */}
        {showFind && editor && (
          <FindReplaceBar
            editor={editor}
            findQuery={findQuery}
            setFindQuery={setFindQuery}
            replaceQuery={replaceQuery}
            setReplaceQuery={setReplaceQuery}
            onClose={() => setShowFind(false)}
          />
        )}

        {/* Editor content area */}
        <div className="ed-content">
          {view === 'reading' && activeTab && (
            <ReadingView html={activeTab.html} />
          )}
          {view === 'outline' && editor && (
            <OutlineModeView editor={editor} onSwitchBack={() => setView('normal')} />
          )}
          {(view === 'normal' || view === 'focus') && editor && (
            <div className={`tiptap-wrap ${view === 'focus' ? 'focus-mode' : ''}`}>
              <EditorContent editor={editor} />
            </div>
          )}
        </div>

        {/* Editor footer with metrics */}
        {editor && activeTab && (
          <EditorFooter
            html={activeTab.html}
            zoom={zoom}
            view={view}
          />
        )}
      </section>
    </main>
  );
}

// ============================================================
// Format toolbar
// ============================================================

function FormatToolbar({
  editor,
  settings: _settings,
  systemFonts,
}: {
  editor: Editor;
  settings: AppSettings;
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
    const c = window.prompt('Nhập màu chữ (hex, ví dụ #ec4899):', '#ec4899');
    if (c?.trim()) editor.chain().focus().setColor(c.trim()).run();
  }

  function setHighlight(): void {
    const c = window.prompt('Nhập màu highlight (hex, ví dụ #fef08a):', '#fef08a');
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
    if (url?.trim()) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
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
          title="Strikethrough"
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
                  : isActive('heading', { level: 4 })
                    ? 'h4'
                    : 'p'
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else {
              const lvl = parseInt(v.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
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
          style={{ minWidth: 140 }}
        >
          <option value="default">Default font</option>
          {systemFonts.length === 0 && (
            <>
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Helvetica Neue', sans-serif">Helvetica</option>
              <option value="'Courier New', monospace">Courier New</option>
              <option value="'Cascadia Code', monospace">Cascadia Code</option>
            </>
          )}
          {systemFonts.length > 0 &&
            systemFonts.map((f) => (
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
          title="Bullet list"
        >
          •
        </button>
        <button
          className={`tb-btn ${isActive('orderedList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1.
        </button>
        <button
          className={`tb-btn ${isActive('taskList') ? 'active' : ''}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list (checkbox)"
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
          title="Horizontal rule"
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
          <span style={{ color: '#ec4899' }}>A</span>
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

      <div className="tb-group">
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="tb-btn"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        >
          ↷
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Find / Replace bar
// ============================================================

function FindReplaceBar({
  editor,
  findQuery,
  setFindQuery,
  replaceQuery,
  setReplaceQuery,
  onClose,
}: {
  editor: Editor;
  findQuery: string;
  setFindQuery: (s: string) => void;
  replaceQuery: string;
  setReplaceQuery: (s: string) => void;
  onClose: () => void;
}): JSX.Element {
  function findNext(): void {
    if (!findQuery) return;
    const text = editor.getText();
    const lower = text.toLowerCase();
    const needle = findQuery.toLowerCase();
    const cursor = editor.state.selection.from;
    let idx = lower.indexOf(needle, cursor);
    if (idx === -1) idx = lower.indexOf(needle, 0); // wrap
    if (idx >= 0) {
      const start = idx + 1;
      const end = start + needle.length;
      editor.commands.setTextSelection({ from: start, to: end });
      editor.commands.focus();
    }
  }

  function replaceCurrent(): void {
    if (!findQuery) return;
    const sel = editor.state.selection;
    const text = editor.state.doc.textBetween(sel.from, sel.to);
    if (text.toLowerCase() === findQuery.toLowerCase()) {
      editor.chain().focus().insertContent(replaceQuery).run();
    }
    findNext();
  }

  function replaceAll(): void {
    if (!findQuery) return;
    const html = editor.getHTML();
    const re = new RegExp(escapeRegex(findQuery), 'gi');
    const next = html.replace(re, replaceQuery);
    editor.commands.setContent(next, true);
  }

  return (
    <div className="find-bar">
      <input
        type="text"
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        placeholder="Tìm…"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') findNext();
        }}
      />
      <input
        type="text"
        value={replaceQuery}
        onChange={(e) => setReplaceQuery(e.target.value)}
        placeholder="Thay bằng…"
      />
      <button className="btn btn-ghost btn-small" onClick={findNext}>
        ⏭ Tiếp
      </button>
      <button className="btn btn-ghost btn-small" onClick={replaceCurrent}>
        Thay
      </button>
      <button className="btn btn-ghost btn-small" onClick={replaceAll}>
        Thay hết
      </button>
      <button className="btn btn-ghost btn-small" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// Outline list (sidebar)
// ============================================================

function OutlineList({ editor, onJump }: { editor: Editor; onJump: (pos: number) => void }): JSX.Element {
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((x) => x + 1);
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor]);

  const headings = useMemo(() => {
    const list: Array<{ pos: number; level: number; text: string }> = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        list.push({
          pos,
          level: node.attrs.level as number,
          text: node.textContent || '(Trống)',
        });
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.state.doc]);

  if (headings.length === 0) {
    return (
      <p className="muted small" style={{ padding: 12 }}>
        Chưa có heading nào. Tạo H1/H2/H3… để xây cấu trúc tài liệu.
      </p>
    );
  }

  return (
    <ul className="outline-list">
      {headings.map((h, i) => (
        <li key={`${h.pos}-${i}`}>
          <button
            className={`outline-item h${h.level}`}
            style={{ paddingLeft: 8 + (h.level - 1) * 10 }}
            onClick={() => onJump(h.pos + 1)}
            title={h.text}
          >
            <span className="outline-marker">H{h.level}</span>
            <span className="outline-text">{h.text}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ============================================================
// Stats panel
// ============================================================

function StatsPanel({ html }: { html: string }): JSX.Element {
  const metrics = useMemo(() => countDocumentMetrics(html), [html]);
  const score = useMemo(() => fleschScore(html), [html]);
  const words = useMemo(() => topWords(html, 8), [html]);
  const label = readabilityLabel(score);

  return (
    <div className="stats-panel">
      <div className="stats-row">
        <span className="muted small">Số từ</span>
        <strong>{metrics.words.toLocaleString('vi-VN')}</strong>
      </div>
      <div className="stats-row">
        <span className="muted small">Ký tự</span>
        <strong>{metrics.chars.toLocaleString('vi-VN')}</strong>
      </div>
      <div className="stats-row">
        <span className="muted small">Ký tự (no space)</span>
        <strong>{metrics.charsNoSpace.toLocaleString('vi-VN')}</strong>
      </div>
      <div className="stats-row">
        <span className="muted small">Đoạn</span>
        <strong>{metrics.paragraphs}</strong>
      </div>
      <div className="stats-row">
        <span className="muted small">Câu</span>
        <strong>{metrics.sentences}</strong>
      </div>
      <div className="stats-row">
        <span className="muted small">Đọc trong</span>
        <strong>~{metrics.readingTimeMin} phút</strong>
      </div>

      <div className="stats-divider" />

      <div className="stats-readability">
        <div className="muted small">Độ dễ đọc (Flesch)</div>
        <div className="flesch-row">
          <strong style={{ color: label.color, fontSize: 22 }}>{score}</strong>
          <span className="muted small" style={{ color: label.color }}>{label.label}</span>
        </div>
        <div className="flesch-bar">
          <div
            className="flesch-fill"
            style={{ width: `${score}%`, background: label.color }}
          />
        </div>
        <p className="muted small" style={{ margin: '4px 0 0', fontSize: 10.5 }}>
          90+: rất dễ · 60-70: bình thường · &lt;30: rất khó
        </p>
      </div>

      <div className="stats-divider" />

      <div>
        <div className="muted small" style={{ marginBottom: 4 }}>Từ lặp nhiều</div>
        {words.length === 0 ? (
          <p className="muted small">Chưa có từ.</p>
        ) : (
          <ul className="topwords-list">
            {words.map((w) => (
              <li key={w.word}>
                <span className="word">{w.word}</span>
                <span className="count muted small">{w.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tools panel
// ============================================================

function ToolsPanel({
  view,
  setView,
  zoom,
  setZoom,
}: {
  view: EditorView;
  setView: (v: EditorView) => void;
  zoom: number;
  setZoom: (z: number) => void;
}): JSX.Element {
  return (
    <div className="tools-panel">
      <h4>Chế độ xem</h4>
      <div className="tools-grid">
        {(
          [
            { v: 'normal', label: '✏ Bình thường', desc: 'Soạn thảo đầy đủ' },
            { v: 'focus', label: '🎯 Focus mode', desc: 'Chỉ paragraph hiện tại' },
            { v: 'reading', label: '📖 Reading mode', desc: 'Preview như Medium' },
            { v: 'outline', label: '☰ Outline mode', desc: 'Chỉ hiện heading' },
          ] as Array<{ v: EditorView; label: string; desc: string }>
        ).map((opt) => (
          <button
            key={opt.v}
            className={`tools-btn ${view === opt.v ? 'active' : ''}`}
            onClick={() => setView(opt.v)}
          >
            <strong>{opt.label}</strong>
            <span className="muted small">{opt.desc}</span>
          </button>
        ))}
      </div>

      <h4 style={{ marginTop: 16 }}>Zoom</h4>
      <div className="zoom-row">
        <button
          className="loc-btn"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
          title="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <button
          className="loc-btn"
          onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
          title="Zoom in"
        >
          +
        </button>
        <span className="muted small" style={{ minWidth: 36, textAlign: 'right' }}>
          {Math.round(zoom * 100)}%
        </span>
      </div>
      <button
        className="btn btn-ghost btn-small"
        onClick={() => setZoom(1.0)}
        style={{ width: '100%', marginTop: 4 }}
      >
        Reset 100%
      </button>
    </div>
  );
}

// ============================================================
// Reading view (preview như Medium)
// ============================================================

function ReadingView({ html }: { html: string }): JSX.Element {
  return (
    <div className="reading-view">
      <article
        className="reading-content"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ============================================================
// Outline mode (heading-only collapse)
// ============================================================

function OutlineModeView({
  editor,
  onSwitchBack,
}: {
  editor: Editor;
  onSwitchBack: () => void;
}): JSX.Element {
  const headings = useMemo(() => {
    const list: Array<{ pos: number; level: number; text: string; size: number }> = [];
    let lastPos = 0;
    let pending: { pos: number; level: number; text: string } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        if (pending) {
          list.push({ ...pending, size: pos - pending.pos });
        }
        pending = {
          pos,
          level: node.attrs.level as number,
          text: node.textContent || '(Trống)',
        };
        lastPos = pos;
      }
    });
    if (pending) {
      list.push({ ...pending, size: editor.state.doc.content.size - pending.pos });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.state.doc]);

  return (
    <div className="outline-mode">
      <p className="muted small" style={{ marginBottom: 12 }}>
        Chế độ outline: chỉ hiện cấu trúc heading. <button className="link-btn" onClick={onSwitchBack}>Quay lại bình thường</button>
      </p>
      {headings.length === 0 ? (
        <p className="muted">Chưa có heading.</p>
      ) : (
        <ul className="outline-mode-list">
          {headings.map((h, i) => (
            <li key={i}>
              <button
                className={`outline-mode-item h${h.level}`}
                style={{ paddingLeft: 8 + (h.level - 1) * 16 }}
                onClick={() => {
                  editor.commands.focus(h.pos + 1);
                  onSwitchBack();
                }}
              >
                <span className="outline-mode-text">{h.text}</span>
                <span className="muted small">{h.size} ký tự</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Editor footer (metrics + zoom)
// ============================================================

function EditorFooter({
  html,
  zoom,
  view,
}: {
  html: string;
  zoom: number;
  view: EditorView;
}): JSX.Element {
  const m = useMemo(() => countDocumentMetrics(html), [html]);
  return (
    <div className="ed-footer">
      <span className="muted small">
        {m.words.toLocaleString('vi-VN')} từ · {m.chars.toLocaleString('vi-VN')} ký tự · ~{m.readingTimeMin} phút đọc
      </span>
      <span className="muted small">
        Mode: {view === 'normal' ? 'Bình thường' : view === 'focus' ? 'Focus' : view === 'reading' ? 'Reading' : 'Outline'} · Zoom {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
