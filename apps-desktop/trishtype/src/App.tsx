/**
 * TrishType App — Phase 17.6 v2.
 *
 * Trình soạn thảo văn bản chuyên nghiệp + converter đa format.
 *
 * Mode toggle:
 *  - editor: Tab system + TipTap rich editor + toolbar + outline + stats
 *  - convert: Standalone file converter UI
 */

import { useEffect, useRef, useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { EditorPanel } from './EditorPanel.js';
import { ConvertPanel } from './ConvertPanel.js';
import { SettingsModal } from './SettingsModal.js';
import {
  applySettings,
  loadSettings,
  saveSettings,
  type AppSettings,
} from './settings.js';
import {
  detectFormatFromName,
  exportFromHtml,
  importToHtml,
  importTipTapJson,
  type DocFormat,
} from './formats.js';
import { TEMPLATES, type Template, findTemplate } from './templates.js';
import logoUrl from './assets/logo.png';

export interface DocTab {
  id: string;
  /** Disk path nếu đã save, null nếu untitled */
  path: string | null;
  /** Hiển thị (basename hoặc untitled-N) */
  name: string;
  /** TipTap HTML content */
  html: string;
  /** Để compare dirty */
  savedHtml: string;
  /** Format detect from path/extension. 'json' = native TipTap JSON. */
  format: DocFormat;
  /** Lúc tạo */
  created_ms: number;
}

export type AppMode = 'editor' | 'convert';

let _tabId = 1;
function genTabId(): string {
  return `t${_tabId++}-${Date.now().toString(36)}`;
}

function basename(path: string): string {
  const m = path.split(/[\\/]/);
  return m[m.length - 1] ?? path;
}

function isInTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    // @ts-expect-error injected at runtime
    typeof window.__TAURI_INTERNALS__ !== 'undefined'
  );
}

export function App(): JSX.Element {
  const [mode, setMode] = useState<AppMode>('editor');
  const [appVersion, setAppVersion] = useState('dev');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  const autoSaveTimerRef = useRef<number | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  // Initial: get version + create blank tab + load system fonts
  // useRef guard ensures only-once kể cả StrictMode double-mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (isInTauri()) {
      void invoke<string>('app_version')
        .then(setAppVersion)
        .catch(() => {});
      // Load fonts hệ thống async — không block UI
      void invoke<string[]>('list_system_fonts')
        .then((fonts) => setSystemFonts(fonts ?? []))
        .catch((err) => {
          console.warn('[trishtype] list_system_fonts fail:', err);
        });
    }
    newTabFromTemplate('blank');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = tabs.find((t) => t.id === activeId) ?? null;

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!settings.autoSave || !activeTab || !activeTab.path) return;
    if (activeTab.html === activeTab.savedHtml) return;
    if (activeTab.format === 'pdf') return; // PDF không re-save được
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveActiveTab();
    }, settings.autoSaveDelayMs);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.html, activeTab?.path, settings.autoSave, settings.autoSaveDelayMs]);

  // Global shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void saveAsActiveTab();
        } else {
          void saveActiveTab();
        }
      } else if (key === 'o') {
        e.preventDefault();
        void openFileDialog();
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        setShowTemplatePicker(true);
      } else if (key === 'w') {
        e.preventDefault();
        if (activeId) closeTab(activeId);
      } else if (key === 'e' && e.shiftKey) {
        e.preventDefault();
        setShowExportMenu(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, tabs]);

  // ===== Tab management =====

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
    setShowTemplatePicker(false);
  }

  function updateTabHtml(id: string, html: string): void {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, html } : t)));
  }

  function closeTab(id: string): void {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    if (t.html !== t.savedHtml) {
      const ok = window.confirm(
        `"${t.name}" chưa lưu. Đóng và bỏ thay đổi?\n\nNhấn Cancel để giữ lại.`,
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

  // ===== File I/O =====

  async function openFileDialog(): Promise<void> {
    if (!isInTauri()) {
      window.alert('Mở file chỉ hoạt động trong desktop.');
      return;
    }
    const picked = await openDialog({
      multiple: false,
      filters: [
        {
          name: 'Tất cả định dạng hỗ trợ',
          extensions: ['docx', 'md', 'markdown', 'html', 'htm', 'txt', 'json'],
        },
        { name: 'Word', extensions: ['docx'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'HTML', extensions: ['html', 'htm'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'TrishType JSON', extensions: ['json'] },
      ],
    });
    if (typeof picked !== 'string') return;
    await openPathInTab(picked);
  }

  async function openPathInTab(path: string): Promise<void> {
    // Đã mở rồi → switch
    const existing = tabs.find((t) => t.path === path);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    try {
      const fmt = detectFormatFromName(path);
      let html: string;
      let warnings: string[] = [];
      if (fmt === 'docx') {
        // Read binary qua Rust
        const bytes = await invoke<number[]>('read_binary_file', { path });
        const ab = new Uint8Array(bytes).buffer;
        const r = await importToHtml(ab, fmt);
        html = r.html;
        warnings = r.warnings;
      } else if (fmt === 'json') {
        const text = await invoke<string>('read_text_string', { path });
        const json = importTipTapJson(text) as { html?: string };
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
        setFlash(`⚠ Mở "${tab.name}" với ${warnings.length} cảnh báo (xem console)`);
        warnings.forEach((w) => console.warn('[trishtype]', w));
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
      await saveAsActiveTab();
      return;
    }
    await writeTabToPath(activeTab, activeTab.path, activeTab.format);
  }

  async function saveAsActiveTab(): Promise<void> {
    if (!activeTab) return;
    const target = await pickSavePath(activeTab.name, activeTab.format);
    if (!target) return;
    const fmt = detectFormatFromName(target);
    await writeTabToPath(activeTab, target, fmt);
  }

  async function pickSavePath(suggested: string, fmt: DocFormat): Promise<string | null> {
    if (!isInTauri()) {
      return prompt('Lưu thành (browser dev):', suggested);
    }
    const filters: Array<{ name: string; extensions: string[] }> = [];
    if (fmt === 'docx') filters.push({ name: 'Word', extensions: ['docx'] });
    if (fmt === 'md') filters.push({ name: 'Markdown', extensions: ['md'] });
    if (fmt === 'html') filters.push({ name: 'HTML', extensions: ['html'] });
    if (fmt === 'txt') filters.push({ name: 'Text', extensions: ['txt'] });
    if (fmt === 'pdf') filters.push({ name: 'PDF', extensions: ['pdf'] });
    if (fmt === 'json') filters.push({ name: 'TrishType JSON', extensions: ['json'] });
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

  /** Bulk export — xuất tab hiện tại sang nhiều format 1 lúc. */
  async function handleBulkExport(formats: DocFormat[]): Promise<void> {
    if (!activeTab) return;
    if (!isInTauri()) {
      window.alert('Bulk export chỉ trong desktop.');
      return;
    }
    // Pick destination folder
    const folder = await openDialog({ directory: true, multiple: false });
    if (typeof folder !== 'string') return;

    const baseName = activeTab.name.replace(/\.[^.]+$/, '');
    let success = 0;
    const errors: string[] = [];

    for (const fmt of formats) {
      try {
        const ext = fmt === 'pdf' ? 'pdf' : fmt === 'docx' ? 'docx' : fmt;
        const path = `${folder}\\${baseName}.${ext}`;
        const result = await exportFromHtml(activeTab.html, fmt, {
          fileName: `${baseName}.${ext}`,
          tipTapJson: { html: activeTab.html },
        });
        if (result.isBinary) {
          const arr = Array.from(new Uint8Array(result.content as ArrayBuffer));
          await invoke<void>('write_binary_file', { path, bytes: arr });
        } else {
          await invoke<void>('write_text_string', {
            path,
            content: result.content as string,
          });
        }
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${fmt}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      setFlash(`⚠ Bulk export: ${success} OK · ${errors.length} lỗi (xem console)`);
      errors.forEach((e) => console.warn('[trishtype] bulk export:', e));
    } else {
      setFlash(`✓ Bulk export: ${success} file đã lưu vào ${basename(folder)}`);
    }
  }

  /** Export single format từ menu. */
  async function handleExportSingle(fmt: DocFormat): Promise<void> {
    if (!activeTab) return;
    setShowExportMenu(false);
    const baseName = activeTab.name.replace(/\.[^.]+$/, '');
    const ext = fmt === 'pdf' ? 'pdf' : fmt === 'docx' ? 'docx' : fmt;
    const target = await pickSavePath(`${baseName}.${ext}`, fmt);
    if (!target) return;
    try {
      const result = await exportFromHtml(activeTab.html, fmt, {
        fileName: basename(target),
        tipTapJson: { html: activeTab.html },
      });
      if (result.isBinary) {
        const arr = Array.from(new Uint8Array(result.content as ArrayBuffer));
        await invoke<void>('write_binary_file', { path: target, bytes: arr });
      } else {
        await invoke<void>('write_text_string', {
          path: target,
          content: result.content as string,
        });
      }
      setFlash(`✓ Đã export: ${basename(target)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlash(`⚠ Lỗi export: ${msg}`);
    }
  }

  // ===== Render =====

  const dirtyCount = tabs.filter((t) => t.html !== t.savedHtml).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="TrishType" className="brand-logo" />
          <strong className="brand-name">TrishType</strong>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'editor' ? 'active' : ''}`}
            onClick={() => setMode('editor')}
          >
            ✏ Soạn thảo
          </button>
          <button
            className={`mode-btn ${mode === 'convert' ? 'active' : ''}`}
            onClick={() => setMode('convert')}
          >
            ⇄ Chuyển đổi
          </button>
        </div>

        <span className="filter-spacer" />

        {mode === 'editor' && (
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-small"
              onClick={() => setShowTemplatePicker(true)}
              title="File mới (Ctrl+N)"
            >
              ＋ Mới
            </button>
            <button
              className="btn btn-ghost btn-small"
              onClick={() => void openFileDialog()}
              title="Mở file (Ctrl+O)"
            >
              📂 Mở
            </button>
            <button
              className="btn btn-primary btn-small"
              onClick={() => void saveActiveTab()}
              disabled={!activeTab || activeTab.html === activeTab.savedHtml}
              title="Lưu (Ctrl+S)"
            >
              💾 Lưu
            </button>
            <div className="export-menu-wrap">
              <button
                className={`btn btn-ghost btn-small ${showExportMenu ? 'active' : ''}`}
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={!activeTab}
                title="Xuất file (Ctrl+Shift+E)"
              >
                📤 Xuất ▾
              </button>
              {showExportMenu && (
                <ExportMenu
                  onClose={() => setShowExportMenu(false)}
                  onExport={(fmt) => void handleExportSingle(fmt)}
                  onBulkExport={(fmts) => void handleBulkExport(fmts)}
                />
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          className="topbar-icon"
          onClick={() => setShowSettings(true)}
          title="Cài đặt"
        >
          ⚙
        </button>
      </header>

      {flash && (
        <div className="flash-bar" onClick={() => setFlash(null)}>
          {flash} <span className="muted small">(click để đóng)</span>
        </div>
      )}

      {mode === 'editor' && (
        <EditorPanel
          tabs={tabs}
          activeId={activeId}
          settings={settings}
          systemFonts={systemFonts}
          onActivate={setActiveId}
          onClose={closeTab}
          onUpdate={updateTabHtml}
          onNewTab={() => setShowTemplatePicker(true)}
        />
      )}

      {mode === 'convert' && (
        <ConvertPanel
          onFlash={(msg) => setFlash(msg)}
          onSwitchToEditor={() => setMode('editor')}
          onOpenInEditor={(path) => {
            setMode('editor');
            void openPathInTab(path);
          }}
        />
      )}

      <footer className="statusbar">
        {mode === 'editor' && activeTab && (
          <>
            <span className="muted small">
              {activeTab.path ? (
                <code className="status-path" title={activeTab.path}>
                  {activeTab.path}
                </code>
              ) : (
                '— Chưa lưu —'
              )}
            </span>
            <span className="filter-spacer" />
            <span className="muted small">{activeTab.format.toUpperCase()}</span>
          </>
        )}
        {mode === 'convert' && (
          <>
            <span className="muted small">⇄ Chế độ chuyển đổi file</span>
            <span className="filter-spacer" />
          </>
        )}
        <span className="muted small">
          {dirtyCount > 0 ? `● ${dirtyCount} chưa lưu` : '— sạch —'}
        </span>
        <span className="muted small">v{appVersion}</span>
      </footer>

      {showSettings && (
        <SettingsModal
          settings={settings}
          appVersion={appVersion}
          onSettingsChange={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showTemplatePicker && (
        <TemplatePickerModal
          onPick={newTabFromTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// Template picker modal
// ============================================================

function TemplatePickerModal({
  onPick,
  onClose,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        <header className="modal-head">
          <h2>📑 Chọn template</h2>
          <button className="mini" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} className="template-card" onClick={() => onPick(t.id)}>
                <div className="template-icon">{t.icon}</div>
                <div className="template-name">{t.name}</div>
                <div className="template-desc">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Export dropdown menu
// ============================================================

function ExportMenu({
  onClose,
  onExport,
  onBulkExport,
}: {
  onClose: () => void;
  onExport: (fmt: DocFormat) => void;
  onBulkExport: (fmts: DocFormat[]) => void;
}): JSX.Element {
  const [bulkSelection, setBulkSelection] = useState<DocFormat[]>([]);
  const [bulkMode, setBulkMode] = useState(false);

  function toggleBulk(fmt: DocFormat): void {
    setBulkSelection((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    );
  }

  return (
    <div className="export-dropdown" onMouseLeave={onClose}>
      <div className="export-mode-row">
        <button
          className={`mini ${!bulkMode ? 'active' : ''}`}
          onClick={() => setBulkMode(false)}
        >
          1 file
        </button>
        <button
          className={`mini ${bulkMode ? 'active' : ''}`}
          onClick={() => setBulkMode(true)}
        >
          Bulk (E)
        </button>
      </div>
      {!bulkMode &&
        (
          [
            { v: 'docx', label: '📘 Word (.docx)' },
            { v: 'pdf', label: '📕 PDF (.pdf)' },
            { v: 'md', label: '📝 Markdown (.md)' },
            { v: 'html', label: '🌐 HTML (.html)' },
            { v: 'txt', label: '📄 Plain text (.txt)' },
            { v: 'json', label: '🗃 TrishType JSON' },
          ] as Array<{ v: DocFormat; label: string }>
        ).map((opt) => (
          <button key={opt.v} className="export-item" onClick={() => onExport(opt.v)}>
            {opt.label}
          </button>
        ))}

      {bulkMode && (
        <>
          <p className="muted small" style={{ padding: '6px 8px', margin: 0 }}>
            Chọn nhiều format để xuất 1 lúc:
          </p>
          {(
            [
              { v: 'docx', label: '📘 Word' },
              { v: 'pdf', label: '📕 PDF' },
              { v: 'md', label: '📝 Markdown' },
              { v: 'html', label: '🌐 HTML' },
              { v: 'txt', label: '📄 Plain text' },
            ] as Array<{ v: DocFormat; label: string }>
          ).map((opt) => (
            <label key={opt.v} className="export-item bulk">
              <input
                type="checkbox"
                checked={bulkSelection.includes(opt.v)}
                onChange={() => toggleBulk(opt.v)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          <button
            className="btn btn-primary btn-small"
            style={{ margin: '8px 6px' }}
            disabled={bulkSelection.length === 0}
            onClick={() => {
              onBulkExport(bulkSelection);
              onClose();
            }}
          >
            ⤓ Xuất {bulkSelection.length} file
          </button>
        </>
      )}
    </div>
  );
}
