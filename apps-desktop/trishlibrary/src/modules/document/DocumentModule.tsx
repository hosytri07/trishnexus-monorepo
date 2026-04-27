/**
 * Phase 18.3.a — Document Module.
 *
 * Layout: 2 sub-tab
 *   ✏ Soạn thảo  → DocEditorPanel (TipTap)
 *   ⇄ Chuyển đổi → ConvertPanel với 2 sub-sub-tab:
 *       📑 Chuyển đổi file → file convert
 *       📕 Chuyển đổi PDF  → PDF tools (Phase 18.3.b)
 */

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { useAuth } from '@trishteam/auth/react';
import { DocEditorPanel } from './DocEditorPanel.js';
import { DocConvertPanel } from './DocConvertPanel.js';
import {
  type DocFormat,
  type DocTab,
  basename,
  detectFormatFromName,
  genTabId,
} from './types.js';
import {
  exportFromHtml,
  importToHtml,
  importTipTapJson,
} from './formats.js';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplate,
  type TemplateCategory,
} from './templates.js';

type SubTab = 'editor' | 'convert';

interface ModuleProps {
  tr: (key: string, vars?: Record<string, string | number>) => string;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export function DocumentModule({ tr }: ModuleProps): JSX.Element {
  const { profile } = useAuth();
  const uid = profile?.id ?? null;
  const [subTab, setSubTab] = useState<SubTab>('editor');
  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Phase 18.5.b — Khi user đổi (login/logout/switch), clear tabs in-memory
  // để không hiện tab của user trước đó.
  const prevUidRef = useRef<string | null>(uid);
  useEffect(() => {
    if (prevUidRef.current !== uid) {
      setTabs([]);
      setActiveId(null);
      try {
        window.localStorage.removeItem('trishlibrary.doc.tabs.v1');
      } catch {
        /* ignore */
      }
      prevUidRef.current = uid;
    }
  }, [uid]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [defaultFormat, setDefaultFormat] = useState<DocFormat>(() => {
    const saved = localStorage.getItem('trishlibrary.doc.default_format');
    if (saved && ['docx', 'md', 'html', 'txt', 'pdf', 'json'].includes(saved)) {
      return saved as DocFormat;
    }
    return 'docx';
  });
  const [tabSearch, setTabSearch] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const initRef = useRef(false);

  // Phase 18.3.c.1 — Ctrl+Shift+F focus mode + Esc exit
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  useEffect(() => {
    localStorage.setItem('trishlibrary.doc.default_format', defaultFormat);
  }, [defaultFormat]);

  // Phase 18.4 — Mirror tab metadata (id, name, path) cho global Ctrl+K search.
  useEffect(() => {
    try {
      const meta = tabs.map((t) => ({ id: t.id, name: t.name, path: t.path }));
      localStorage.setItem('trishlibrary.doc.tabs.v1', JSON.stringify(meta));
    } catch {
      /* ignore quota */
    }
  }, [tabs]);

  // Phase 18.4 — Consume pending_tab hint từ global search
  useEffect(() => {
    function checkPending(): void {
      try {
        const pending = window.localStorage.getItem('trishlibrary.doc.pending_tab');
        if (pending) {
          window.localStorage.removeItem('trishlibrary.doc.pending_tab');
          setSubTab('editor');
          setActiveId(pending);
        }
      } catch {
        /* ignore */
      }
    }
    checkPending();
    const onFocus = (): void => checkPending();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    // Load system fonts
    if (isInTauri()) {
      void invoke<string[]>('list_system_fonts')
        .then(setSystemFonts)
        .catch(() => {});
    }
    // Auto-create blank tab
    if (tabs.length === 0) {
      newTabFromTemplate('blank');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  function newTabFromTemplate(templateId: string): void {
    const tpl = findTemplate(templateId);
    if (!tpl) return;
    const id = genTabId();
    const tab: DocTab = {
      id,
      path: null,
      name: `untitled-${tabs.length + 1}.docx`,
      html: tpl.html,
      savedHtml: tpl.html,
      format: 'docx',
      created_ms: Date.now(),
    };
    setTabs((prev) => [...prev, tab]);
    setActiveId(id);
    setShowTemplates(false);
  }

  function updateTabHtml(id: string, html: string): void {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, html } : t)));
  }

  function closeTab(id: string): void {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    if (t.html !== t.savedHtml) {
      const ok = window.confirm(
        `"${t.name}" chưa lưu. Đóng và bỏ thay đổi?`,
      );
      if (!ok) return;
    }
    setTabs((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      const next = prev.filter((x) => x.id !== id);
      if (activeId === id) {
        const newActive = next[Math.max(0, Math.min(idx, next.length - 1))] ?? null;
        setActiveId(newActive?.id ?? null);
      }
      return next;
    });
  }

  async function openFileDialog(): Promise<void> {
    if (!isInTauri()) {
      window.alert('Mở file chỉ trong desktop.');
      return;
    }
    const picked = await openDialog({
      multiple: false,
      filters: [
        {
          name: 'Tài liệu hỗ trợ',
          extensions: ['docx', 'md', 'markdown', 'html', 'htm', 'txt', 'json', 'pdf'],
        },
        { name: 'Word', extensions: ['docx'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    if (typeof picked !== 'string') return;
    await openPathInTab(picked);
  }

  async function openPathInTab(path: string): Promise<void> {
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    try {
      const fmt = detectFormatFromName(path);
      let html: string;
      let warnings: string[] = [];
      if (fmt === 'docx' || fmt === 'pdf') {
        const bytes = await invoke<number[]>('read_binary_file', { path });
        const ab = new Uint8Array(bytes).buffer;
        const r = await importToHtml(ab, fmt);
        html = r.html;
        warnings = r.warnings;
      } else if (fmt === 'json') {
        const text = await invoke<string>('read_text_string', { path });
        const json = importTipTapJson(text);
        html = json.html ?? '<p></p>';
      } else {
        const text = await invoke<string>('read_text_string', { path });
        const r = await importToHtml(text, fmt);
        html = r.html;
        warnings = r.warnings;
      }
      const id = genTabId();
      const tab: DocTab = {
        id,
        path,
        name: basename(path),
        html,
        savedHtml: html,
        format: fmt,
        created_ms: Date.now(),
      };
      setTabs((prev) => [...prev, tab]);
      setActiveId(id);
      if (warnings.length > 0) {
        setFlash(`⚠ Mở "${tab.name}" với ${warnings.length} cảnh báo`);
      } else {
        setFlash(`✓ Đã mở: ${tab.name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlash(`⚠ Lỗi mở file: ${msg}`);
    }
  }

  async function saveActiveTab(): Promise<void> {
    if (!activeTab) return;
    if (!activeTab.path) {
      // Lần đầu lưu → dùng default format đã chọn (chỉ filter định dạng đó)
      const target = await pickSavePath(
        replaceExt(activeTab.name, defaultFormat),
        defaultFormat,
      );
      if (!target) return;
      await writeTabToPath(activeTab, target, defaultFormat);
      return;
    }
    await writeTabToPath(activeTab, activeTab.path, activeTab.format);
  }

  function replaceExt(name: string, ext: DocFormat): string {
    const i = name.lastIndexOf('.');
    const base = i > 0 ? name.slice(0, i) : name;
    return `${base}.${ext}`;
  }

  async function saveAsActiveTab(): Promise<void> {
    if (!activeTab) return;
    const target = await pickSavePath(activeTab.name, activeTab.format);
    if (!target) return;
    const fmt = detectFormatFromName(target);
    await writeTabToPath(activeTab, target, fmt);
  }

  async function pickSavePath(suggested: string, fmt: DocFormat): Promise<string | null> {
    if (!isInTauri()) return prompt('Lưu thành (browser dev):', suggested);
    const filters: Array<{ name: string; extensions: string[] }> = [];
    if (fmt === 'docx') filters.push({ name: 'Word', extensions: ['docx'] });
    if (fmt === 'md') filters.push({ name: 'Markdown', extensions: ['md'] });
    if (fmt === 'html') filters.push({ name: 'HTML', extensions: ['html'] });
    if (fmt === 'txt') filters.push({ name: 'Text', extensions: ['txt'] });
    if (fmt === 'pdf') filters.push({ name: 'PDF', extensions: ['pdf'] });
    if (fmt === 'json') filters.push({ name: 'JSON', extensions: ['json'] });
    filters.push({
      name: 'Tất cả định dạng',
      extensions: ['docx', 'md', 'html', 'txt', 'pdf', 'json'],
    });
    const picked = await saveDialog({ defaultPath: suggested, filters });
    return typeof picked === 'string' ? picked : null;
  }

  async function writeTabToPath(
    tab: DocTab,
    path: string,
    fmt: DocFormat,
  ): Promise<void> {
    try {
      const result = await exportFromHtml(tab.html, fmt, {
        fileName: basename(path),
        tipTapJson: { html: tab.html },
      });
      if (result.isBinary) {
        const ab = result.content as ArrayBuffer;
        const arr = Array.from(new Uint8Array(ab));
        await invoke<void>('write_binary_file', { path, bytes: arr });
      } else {
        await invoke<void>('write_text_string', {
          path,
          content: result.content as string,
        });
      }
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tab.id
            ? { ...t, path, name: basename(path), savedHtml: t.html, format: fmt }
            : t,
        ),
      );
      setFlash(`✓ Đã lưu: ${basename(path)} (${fmt.toUpperCase()})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlash(`⚠ Lỗi lưu: ${msg}`);
    }
  }

  return (
    <div className="document-module">
      {/* Row 1: Sub-tab nav */}
      <div className="doc-subtab-nav">
        <button
          className={`doc-subtab ${subTab === 'editor' ? 'active' : ''}`}
          onClick={() => setSubTab('editor')}
        >
          <span className="doc-subtab-icon">✏</span>
          <span>{tr('doc.tab.editor')}</span>
          {tabs.length > 0 && <span className="badge">{tabs.length}</span>}
        </button>
        <button
          className={`doc-subtab ${subTab === 'convert' ? 'active' : ''}`}
          onClick={() => setSubTab('convert')}
        >
          <span className="doc-subtab-icon">⇄</span>
          <span>{tr('doc.tab.convert')}</span>
        </button>
      </div>

      {/* Row 2: Action toolbar (chỉ hiện ở Editor) */}
      {subTab === 'editor' && (
        <div className="doc-action-toolbar">
          <button
            className="btn-action"
            onClick={() => setShowTemplates(true)}
            title="Ctrl+N"
          >
            <span className="btn-action-icon">＋</span>
            <span>{tr('doc.action.new')}</span>
          </button>
          <button
            className="btn-action"
            onClick={() => void openFileDialog()}
            title="Ctrl+O"
          >
            <span className="btn-action-icon">📂</span>
            <span>{tr('doc.action.open')}</span>
          </button>
          <span className="action-divider" />
          <label className="doc-default-format" title="Đuôi mặc định khi lưu">
            <span className="muted small">Đuôi</span>
            <select
              value={defaultFormat}
              onChange={(e) => setDefaultFormat(e.target.value as DocFormat)}
            >
              <option value="docx">.docx</option>
              <option value="md">.md</option>
              <option value="html">.html</option>
              <option value="txt">.txt</option>
              <option value="pdf">.pdf</option>
              <option value="json">.json</option>
            </select>
          </label>
          <button
            className="btn-action btn-action-primary"
            onClick={() => void saveActiveTab()}
            disabled={!activeTab || activeTab.html === activeTab.savedHtml}
            title="Ctrl+S"
          >
            <span className="btn-action-icon">💾</span>
            <span>{tr('doc.action.save')}</span>
          </button>
          <button
            className="btn-action"
            onClick={() => void saveAsActiveTab()}
            disabled={!activeTab}
            title="Ctrl+Shift+S"
          >
            <span className="btn-action-icon">📤</span>
            <span>{tr('doc.action.save_as')}</span>
          </button>
        </div>
      )}

      {flash && (
        <div className="flash-bar" onClick={() => setFlash(null)}>
          {flash} <span className="muted small">(click để đóng)</span>
        </div>
      )}

      {/* Sub-tab content */}
      {subTab === 'editor' && (
        <DocEditorPanel
          tabs={tabs}
          activeId={activeId}
          systemFonts={systemFonts}
          tr={tr}
          tabSearch={tabSearch}
          onTabSearchChange={setTabSearch}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((v) => !v)}
          onActivate={setActiveId}
          onClose={closeTab}
          onUpdate={updateTabHtml}
          onNewTab={() => setShowTemplates(true)}
        />
      )}

      {subTab === 'convert' && (
        <DocConvertPanel
          tr={tr}
          onFlash={(msg) => setFlash(msg)}
          onOpenInEditor={(path) => {
            setSubTab('editor');
            void openPathInTab(path);
          }}
        />
      )}

      {/* Template picker modal — grouped by category */}
      {showTemplates && (
        <div className="modal-backdrop" onClick={() => setShowTemplates(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 880, width: '92vw' }}
          >
            <header className="modal-head">
              <h2>📑 {tr('doc.template.title')} ({TEMPLATES.length})</h2>
              <button className="mini" onClick={() => setShowTemplates(false)}>
                ×
              </button>
            </header>
            <div className="modal-body">
              {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map((cat) => {
                const items = TEMPLATES.filter((t) => t.category === cat);
                if (items.length === 0) return null;
                return (
                  <section key={cat} className="template-category">
                    <h3 className="template-cat-title">
                      {TEMPLATE_CATEGORIES[cat]}{' '}
                      <span className="muted small">({items.length})</span>
                    </h3>
                    <div className="template-grid">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          className="template-card"
                          onClick={() => newTabFromTemplate(t.id)}
                        >
                          <div className="template-icon">{t.icon}</div>
                          <div className="template-name">{t.name}</div>
                          <div className="template-desc">{t.description}</div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
