/**
 * TrishDesign Phase 28.5 — AutoLISP Manager.
 *
 * 4 tabs:
 *   - Library: list .lsp files đã upload, 1-click load vào AutoCAD active session
 *   - Editor: textarea code → run script (gửi qua SendCommand)
 *   - Snippets: favorite commands, 1-click send
 *   - Auto-load: register / unregister vào acaddoc.lsp
 */

import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { autoCadStatus, autoCadSendCommands, autoCadEnsureDocument } from '../../lib/autocad.js';
import { type LispLibraryEntry, subscribeLispLibrary, LISP_CATEGORIES } from '@trishteam/admin-keys';

const LS_KEY = 'trishdesign:lisp-db';

interface LispFile {
  id: string;
  name: string;
  path: string;
  description?: string;
  tags?: string[];
  autoLoaded?: boolean;
  uploadedAt: number;
}

interface Snippet {
  id: string;
  name: string;
  description?: string;
  command: string;       // LISP code or AutoCAD command line
  icon?: string;
  category?: string;
}

interface LispDb {
  files: LispFile[];
  snippets: Snippet[];
  editorContent: string;
}

function defaultSnippets(): Snippet[] {
  return [
    { id: 'snip_zoom', name: 'Zoom Extents',     command: '(command "._ZOOM" "E")',                icon: '🔍', category: 'View' },
    { id: 'snip_purge', name: 'Purge tất cả',    command: '(command "._-PURGE" "A" "*" "N")',      icon: '🧹', category: 'Cleanup' },
    { id: 'snip_audit', name: 'Audit & Fix',     command: '(command "._AUDIT" "Y")',               icon: '🔧', category: 'Cleanup' },
    { id: 'snip_layoff', name: 'Layer OFF (chọn)', command: '(command "._LAYOFF")',                icon: '👁', category: 'Layer' },
    { id: 'snip_layiso', name: 'Layer ISO (chọn)', command: '(command "._LAYISO")',                icon: '🎯', category: 'Layer' },
    { id: 'snip_layon', name: 'Layer ON tất cả', command: '(command "._-LAYER" "ON" "*" "")',      icon: '💡', category: 'Layer' },
    { id: 'snip_units', name: 'Units mm',        command: '(command "._-UNITS" "2" "0" "1" "0" "0" "N")', icon: '📏', category: 'Setup' },
    { id: 'snip_cleanvp', name: 'Clean Viewports', command: '(command "._-VPORTS" "SI")',           icon: '🪟', category: 'Layout' },
  ];
}

function loadDb(): LispDb {
  if (typeof window === 'undefined') return { files: [], snippets: defaultSnippets(), editorContent: '' };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { files: [], snippets: defaultSnippets(), editorContent: '' };
    const parsed = JSON.parse(raw) as Partial<LispDb>;
    return {
      files: parsed.files ?? [],
      snippets: parsed.snippets && parsed.snippets.length > 0 ? parsed.snippets : defaultSnippets(),
      editorContent: parsed.editorContent ?? '',
    };
  } catch { return { files: [], snippets: defaultSnippets(), editorContent: '' }; }
}
function saveDb(db: LispDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

type DialogState =
  | { kind: 'prompt'; title: string; value: string; multiline?: boolean; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

type Tab = 'library' | 'cloud' | 'editor' | 'snippets' | 'autoload';

export function AutoLispPanel(): JSX.Element {
  const [db, setDbState] = useState<LispDb>(() => loadDb());
  const [tab, setTab] = useState<Tab>('library');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [acadRunning, setAcadRunning] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: LispDb) => LispDb): void { setDbState((prev) => updater(prev)); }
  function flash(m: string): void {
    setStatusMsg(m);
    setTimeout(() => setStatusMsg(''), 2200);
  }

  useEffect(() => {
    autoCadStatus().then((s) => setAcadRunning(s.running));
    const t = setInterval(() => autoCadStatus().then((s) => setAcadRunning(s.running)), 5000);
    return () => clearInterval(t);
  }, []);

  // -------------------------------------------------------------------
  // Send LISP code to AutoCAD
  // -------------------------------------------------------------------
  async function sendLisp(code: string): Promise<void> {
    if (!acadRunning) {
      flash('✗ Chưa kết nối AutoCAD. Mở AutoCAD trước.');
      return;
    }
    try {
      await autoCadEnsureDocument();
      // Wrap code thành 1 SendCommand. Mỗi expression cần \n
      const cmd = code.includes('\n') ? code : `${code}\n`;
      await autoCadSendCommands([cmd]);
      flash('✓ Đã gửi vào AutoCAD');
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  async function loadLspFile(file: LispFile): Promise<void> {
    if (!acadRunning) {
      flash('✗ Chưa kết nối AutoCAD.');
      return;
    }
    try {
      await autoCadEnsureDocument();
      // Escape path cho LISP string
      const escaped = file.path.replace(/\\/g, '/');
      await autoCadSendCommands([`(load "${escaped}")\n`]);
      flash(`✓ Đã load ${file.name}`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🧩 Quản lý AutoLISP</h1>
        <p className="td-lead">
          Library .lsp + editor code + snippets favorite + auto-load registry vào AutoCAD.
          AutoCAD: {acadRunning ? <span style={{ color: '#16a34a', fontWeight: 600 }}>● Đã kết nối</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>● Chưa mở</span>}
        </p>
        {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
      </header>

      <div className="dos-tabs">
        <TabBtn active={tab === 'library'}  onClick={() => setTab('library')}>📚 Library local ({db.files.length})</TabBtn>
        <TabBtn active={tab === 'cloud'}    onClick={() => setTab('cloud')}>☁ AutoLISP TrishTEAM</TabBtn>
        <TabBtn active={tab === 'editor'}   onClick={() => setTab('editor')}>✏ Editor</TabBtn>
        <TabBtn active={tab === 'snippets'} onClick={() => setTab('snippets')}>⚡ Lệnh AutoCAD ({db.snippets.length})</TabBtn>
        <TabBtn active={tab === 'autoload'} onClick={() => setTab('autoload')}>🚀 Auto-load</TabBtn>
      </div>

      {tab === 'library'  && <LibraryTab db={db} setDb={setDb} flash={flash} loadLsp={loadLspFile} setDialog={setDialog} />}
      {tab === 'cloud'    && <CloudLibraryTab flash={flash} sendLisp={sendLisp} />}
      {tab === 'editor'   && <EditorTab db={db} setDb={setDb} sendLisp={sendLisp} />}
      {tab === 'snippets' && <SnippetsTab db={db} setDb={setDb} sendLisp={sendLisp} setDialog={setDialog} />}
      {tab === 'autoload' && <AutoloadTab db={db} setDb={setDb} flash={flash} setDialog={setDialog} />}

      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return <button type="button" className={`dos-tab${active ? ' dos-tab-active' : ''}`} onClick={onClick}>{children}</button>;
}

// =====================================================================
// Tab 1: Library
// =====================================================================

function LibraryTab({ db, setDb, flash, loadLsp, setDialog }: {
  db: LispDb; setDb: (u: (p: LispDb) => LispDb) => void;
  flash: (m: string) => void; loadLsp: (f: LispFile) => Promise<void>;
  setDialog: (s: DialogState) => void;
}): JSX.Element {
  async function handleUpload(): Promise<void> {
    try {
      const path = await open({
        title: 'Chọn file .lsp',
        multiple: true,
        filters: [{ name: 'AutoLISP', extensions: ['lsp', 'fas', 'vlx'] }],
      });
      if (!path) return;
      const paths = Array.isArray(path) ? path : [path];
      const files: LispFile[] = paths.map((p) => ({
        id: newId('lsp'),
        name: p.split(/[\\/]/).pop() ?? 'Script',
        path: p,
        uploadedAt: Date.now(),
      }));
      setDb((prev) => ({ ...prev, files: [...prev.files, ...files] }));
      flash(`✓ Đã thêm ${files.length} file`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  function handleEditMeta(file: LispFile): void {
    setDialog({
      kind: 'prompt', title: `Mô tả cho "${file.name}"`,
      value: file.description ?? '',
      onSubmit: (val) => setDb((p) => ({
        ...p,
        files: p.files.map((f) => (f.id === file.id ? { ...f, description: val } : f)),
      })),
    });
  }

  function handleDelete(file: LispFile): void {
    setDialog({
      kind: 'confirm', title: 'Xóa khỏi library', danger: true,
      message: `Bỏ "${file.name}" khỏi library? (file gốc trên ổ đĩa vẫn giữ nguyên)`,
      onConfirm: () => setDb((p) => ({ ...p, files: p.files.filter((f) => f.id !== file.id) })),
    });
  }

  async function handleScanFolder(): Promise<void> {
    try {
      const folder = await open({ title: 'Chọn folder thư viện LISP', directory: true });
      if (typeof folder !== 'string') return;
      const paths = await invoke<string[]>('scan_folder_lsp', { folder });
      if (paths.length === 0) { flash('Folder không có file .lsp/.fas/.vlx nào.'); return; }
      const existing = new Set(db.files.map((f) => f.path));
      const newFiles: LispFile[] = paths
        .filter((p) => !existing.has(p))
        .map((p) => ({
          id: newId('lsp'),
          name: p.split(/[\\/]/).pop() ?? 'Script',
          path: p,
          uploadedAt: Date.now(),
        }));
      if (newFiles.length === 0) { flash('Tất cả file đã có trong library.'); return; }
      setDb((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
      flash(`✓ Đã scan & thêm ${newFiles.length}/${paths.length} file mới`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Library .lsp</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <button type="button" className="btn btn-primary" onClick={() => void handleUpload()}>📥 Thêm file</button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleScanFolder()}>📂 Scan folder</button>
          <span className="muted small">Click "▶ Load" để gửi `(load "...")` vào AutoCAD. Mỗi file có thể nhập ghi chú/mô tả qua nút ✏.</span>
        </div>
        {db.files.length === 0 ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa có file. Upload các .lsp/.fas/.vlx của bạn để truy cập nhanh.
          </p>
        ) : (
          <div className="dos-list">
            {db.files.map((f) => (
              <div key={f.id} className="dos-list-item lisp-item">
                <span className="dos-item-icon">🧩</span>
                <div className="lisp-info">
                  <div className="dos-item-name">{f.name}</div>
                  {f.description && <div className="muted small">{f.description}</div>}
                  <div className="muted small" style={{ fontSize: 10.5 }}>{f.path}</div>
                </div>
                <div className="dos-item-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void loadLsp(f)}>▶ Load</button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleEditMeta(f)}>✏</button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(f)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// Tab 2: Editor
// =====================================================================

function EditorTab({ db, setDb, sendLisp }: {
  db: LispDb; setDb: (u: (p: LispDb) => LispDb) => void;
  sendLisp: (code: string) => Promise<void>;
}): JSX.Element {
  function update(content: string): void {
    setDb((p) => ({ ...p, editorContent: content }));
  }

  async function handleRun(): Promise<void> {
    if (!db.editorContent.trim()) return;
    await sendLisp(db.editorContent);
  }

  function handleClear(): void {
    update('');
  }

  function handleInsertExample(): void {
    update(`; Ví dụ: vẽ vòng tròn r=5 tại 0,0,0\n(command "._CIRCLE" "0,0,0" "5")\n(command "._ZOOM" "E")\n`);
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Editor AutoLISP</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <button type="button" className="btn btn-primary" onClick={() => void handleRun()} disabled={!db.editorContent.trim()}>▶ Run</button>
          <button type="button" className="btn btn-ghost" onClick={handleClear} disabled={!db.editorContent.trim()}>🗑 Clear</button>
          <button type="button" className="btn btn-ghost" onClick={handleInsertExample}>💡 Ví dụ</button>
          <span className="muted small">Code sẽ được gửi vào AutoCAD command line. Mỗi `(command ...)` là 1 lệnh.</span>
        </div>
        <textarea
          className="lisp-editor"
          value={db.editorContent}
          onChange={(e) => update(e.target.value)}
          placeholder="(command &quot;._LINE&quot; &quot;0,0&quot; &quot;100,0&quot; &quot;&quot;)"
          spellCheck={false}
          lang="vi"
          style={{
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "Courier New", monospace',
            fontSize: 13,
            lineHeight: 1.55,
            letterSpacing: 0.1,
          }}
        />
        <p className="muted small" style={{ marginTop: 8 }}>
          💡 Tip: dùng `(command ...)` để gọi command AutoCAD. Wrap chuỗi dài bằng `(progn ...)`. Hỗ trợ tiếng Việt Unicode (UTF-8). Code persist tự động.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// Tab 3: Snippets
// =====================================================================

function SnippetsTab({ db, setDb, sendLisp, setDialog }: {
  db: LispDb; setDb: (u: (p: LispDb) => LispDb) => void;
  sendLisp: (code: string) => Promise<void>;
  setDialog: (s: DialogState) => void;
}): JSX.Element {
  function handleAdd(): void {
    setDialog({
      kind: 'prompt', title: 'Tên snippet', value: 'Lệnh mới',
      onSubmit: (name) => {
        setDialog({
          kind: 'prompt', title: `Code/command cho "${name}"`, value: '(command "._...")', multiline: true,
          onSubmit: (cmd) => {
            const s: Snippet = { id: newId('snip'), name, command: cmd, icon: '⚡' };
            setDb((p) => ({ ...p, snippets: [...p.snippets, s] }));
          },
        });
      },
    });
  }

  function handleDelete(s: Snippet): void {
    setDialog({
      kind: 'confirm', title: 'Xóa snippet', danger: true,
      message: `Xóa snippet "${s.name}"?`,
      onConfirm: () => setDb((p) => ({ ...p, snippets: p.snippets.filter((x) => x.id !== s.id) })),
    });
  }

  function handleResetDefaults(): void {
    setDialog({
      kind: 'confirm', title: 'Reset snippets', danger: false,
      message: 'Reset về 8 snippet mặc định? (xoá tất cả custom snippets)',
      onConfirm: () => setDb((p) => ({ ...p, snippets: defaultSnippets() })),
    });
  }

  // Group by category
  const groups: Record<string, Snippet[]> = {};
  for (const s of db.snippets) {
    const cat = s.category ?? 'Khác';
    (groups[cat] ??= []).push(s);
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">⚡ Lệnh AutoCAD ưa thích (KHÔNG phải AutoLISP)</h2>
      <div className="td-section-body">
        <p className="muted small" style={{ marginTop: 0, marginBottom: 8 }}>
          ⚠ Đây là <strong>lệnh AutoCAD command line</strong> (vd <code>._ZOOM E</code>, <code>._-PURGE A * N</code>) — KHÔNG phải code AutoLISP. Để chạy file .lsp, vào tab <strong>📚 Library</strong>.
        </p>
        <div className="dos-action-bar">
          <button type="button" className="btn btn-primary" onClick={handleAdd}>➕ Lệnh mới</button>
          <button type="button" className="btn btn-ghost" onClick={handleResetDefaults}>🔄 Reset mặc định</button>
          <span className="muted small">Click ▶ để gửi lệnh vào AutoCAD command line.</span>
        </div>

        {Object.entries(groups).map(([cat, list]) => (
          <div key={cat} className="dos-list-group">
            <div className="dos-list-group-title">{cat} ({list.length})</div>
            <div className="lisp-snip-grid">
              {list.map((s) => (
                <div key={s.id} className="lisp-snip-card">
                  <div className="lisp-snip-head">
                    <span className="lisp-snip-icon">{s.icon ?? '⚡'}</span>
                    <span className="lisp-snip-name">{s.name}</span>
                    <button type="button" className="atgt-del-btn" style={{ marginLeft: 'auto' }} onClick={() => handleDelete(s)}>🗑</button>
                  </div>
                  <code className="lisp-snip-code">{s.command}</code>
                  <button type="button" className="btn btn-primary" onClick={() => void sendLisp(s.command)}>
                    ▶ Gửi vào AutoCAD
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Tab 4: Auto-load (acaddoc.lsp registration)
// =====================================================================

/**
 * Map AutoCAD release version (vd "R24.0") → tên thương mại "AutoCAD 2021".
 * Source: docs.autodesk.com/AutoCAD/release-history.
 *   R23.0 = 2019, R23.1 = 2020
 *   R24.0 = 2021, R24.1 = 2022, R24.2 = 2023, R24.3 = 2024
 *   R25.0 = 2025, R25.1 = 2026
 * Path Autodesk format: %APPDATA%/Autodesk/AutoCAD <year>/R<ver>/enu/Support
 *   nhưng nhiều case path chỉ có R24.0, R25.1 — phải mapping ngược.
 */
const ACAD_VERSION_MAP: Record<string, string> = {
  'R23.0': 'AutoCAD 2019',
  'R23.1': 'AutoCAD 2020',
  'R24.0': 'AutoCAD 2021',
  'R24.1': 'AutoCAD 2022',
  'R24.2': 'AutoCAD 2023',
  'R24.3': 'AutoCAD 2024',
  'R25.0': 'AutoCAD 2025',
  'R25.1': 'AutoCAD 2026',
};

function pathToAcadVersion(p: string): string {
  // Match "R24.0" or "R25.1" anywhere trong path
  const m = p.match(/R(\d{2})\.(\d)/);
  if (m) {
    const key = `R${m[1]}.${m[2]}`;
    if (ACAD_VERSION_MAP[key]) return ACAD_VERSION_MAP[key];
  }
  // Match "AutoCAD 2024" trong path
  const m2 = p.match(/AutoCAD\s+(\d{4})/i);
  if (m2) return `AutoCAD ${m2[1]}`;
  return p.split(/[\\/]/).slice(-3).join('/');
}

function AutoloadTab({ db, setDb, flash, setDialog }: {
  db: LispDb; setDb: (u: (p: LispDb) => LispDb) => void;
  flash: (m: string) => void; setDialog: (s: DialogState) => void;
}): JSX.Element {
  const [acaddocPaths, setAcaddocPaths] = useState<string[]>([]);

  useEffect(() => {
    invoke<string[]>('find_acaddoc_paths').then(setAcaddocPaths).catch(() => setAcaddocPaths([]));
  }, []);

  async function handleToggle(file: LispFile): Promise<void> {
    try {
      if (file.autoLoaded) {
        const n = await invoke<number>('unregister_lisp_autoload', { lspPath: file.path });
        setDb((p) => ({ ...p, files: p.files.map((f) => (f.id === file.id ? { ...f, autoLoaded: false } : f)) }));
        flash(`✓ Đã xoá khỏi auto-load ${n} version AutoCAD`);
      } else {
        const n = await invoke<number>('register_lisp_autoload', { lspPath: file.path });
        setDb((p) => ({ ...p, files: p.files.map((f) => (f.id === file.id ? { ...f, autoLoaded: true } : f)) }));
        flash(`✓ Đã đăng ký auto-load vào ${n} version AutoCAD`);
      }
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  function handleViewAcaddoc(path: string): void {
    setDialog({
      kind: 'confirm', title: 'Mở acaddoc.lsp', message: `Mở file ${path} bằng app mặc định?`,
      onConfirm: () => {
        invoke('read_text_file', { path }).then((text: any) => {
          alert(text);
        }).catch((e) => flash(`✗ ${String(e)}`));
      },
    });
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Auto-load LISP khi AutoCAD mở</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <span className="muted small">
            Tìm thấy <b>{acaddocPaths.length}</b> file <code>acaddoc.lsp</code> trong %APPDATA%\Autodesk\AutoCAD *
          </span>
          <div style={{ flex: 1 }} />
          {acaddocPaths.map((p) => (
            <button key={p} type="button" className="btn btn-ghost" onClick={() => handleViewAcaddoc(p)} title={p}>
              📂 {pathToAcadVersion(p)}
            </button>
          ))}
        </div>

        {db.files.length === 0 ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa có file .lsp trong library. Vào tab "Library" để upload trước.
          </p>
        ) : (
          <div className="dos-list">
            {db.files.map((f) => (
              <div key={f.id} className="dos-list-item">
                <span className="dos-item-icon">🧩</span>
                <div>
                  <div className="dos-item-name">{f.name}</div>
                  <div className="muted small" style={{ fontSize: 10.5 }}>{f.path}</div>
                </div>
                <div className="dos-item-actions">
                  <span className={`lisp-toggle${f.autoLoaded ? ' lisp-toggle-on' : ''}`}>
                    {f.autoLoaded ? '✓ Đang auto-load' : '— Chưa'}
                  </span>
                  <button type="button" className={f.autoLoaded ? 'btn btn-ghost' : 'btn btn-primary'} onClick={() => void handleToggle(f)}>
                    {f.autoLoaded ? '✗ Bỏ auto-load' : '🚀 Bật auto-load'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted small" style={{ marginTop: 12 }}>
          ⚠ Bật auto-load sẽ thêm dòng <code>(load "...")</code> vào file <code>acaddoc.lsp</code> trong Support folder của AutoCAD. File sẽ tự load mỗi khi mở document mới. Nhớ <b>khởi động lại AutoCAD</b> để áp dụng.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// DialogModal
// =====================================================================

function DialogModal({ state, onClose }: { state: DialogState; onClose: () => void }): JSX.Element {
  const [input, setInput] = useState('');
  useEffect(() => { if (state?.kind === 'prompt') setInput(state.value); }, [state]);
  if (!state) return <></>;
  function submit(): void {
    if (state?.kind === 'prompt') {
      const v = state.multiline ? input : input.trim();
      if (!v) return;
      state.onSubmit(v);
    } else if (state?.kind === 'confirm') {
      state.onConfirm();
    }
    onClose();
  }
  return (
    <div className="atgt-dialog-backdrop" onClick={onClose}>
      <div className="atgt-dialog" onClick={(e) => e.stopPropagation()} style={state?.kind === 'prompt' && state.multiline ? { minWidth: 520 } : undefined}>
        <div className="atgt-dialog-title">{state.title}</div>
        {state.kind === 'prompt' ? (
          state.multiline ? (
            <textarea className="td-input" rows={6} autoFocus value={input}
              style={{ fontFamily: 'monospace', resize: 'vertical' }}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} />
          ) : (
            <input type="text" className="td-input" autoFocus value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />
          )
        ) : <p className="atgt-dialog-msg">{state.message}</p>}
        <div className="atgt-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="button" className={state.kind === 'confirm' && state.danger ? 'btn atgt-dialog-danger' : 'btn btn-primary'} onClick={submit}>
            {state.kind === 'prompt' ? '✓ Lưu' : state.danger ? '🗑 Xóa' : '✓ OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Phase 28.14 — Tab "☁ AutoLISP TrishTEAM" (curated cloud library)
// =====================================================================

function CloudLibraryTab({ flash, sendLisp }: {
  flash: (m: string) => void;
  sendLisp: (code: string) => Promise<void>;
}): JSX.Element {
  const [entries, setEntries] = useState<LispLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLispLibrary((list) => {
      setEntries(list);
      setLoading(false);
    });
    return () => { try { unsub(); } catch { /* ignore */ } };
  }, []);

  const filtered = entries.filter((e) => {
    if (categoryFilter && e.category !== categoryFilter) return false;
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (e.name.toLowerCase().includes(q)
      || e.command.toLowerCase().includes(q)
      || e.description.toLowerCase().includes(q));
  });

  async function handleDownloadAndLoad(entry: LispLibraryEntry): Promise<void> {
    const botToken = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:tg-feedback-bot-token') ?? '' : '').trim();
    if (!botToken) {
      flash('✗ Chưa có Telegram bot token. Liên hệ admin (TrishAdmin → 🔐 API Keys).');
      return;
    }
    setBusyId(entry.id);
    try {
      // 1. getFile để lấy file_path tươi (file_path có TTL 1h)
      let filePath = entry.filePath;
      try {
        filePath = await invoke<string>('tg_get_file_path', { req: { botToken, fileId: entry.fileId } });
      } catch (e) {
        // dùng filePath cached nếu fail
        console.warn('[lisp-cloud] getFile fail, dùng cached', e);
      }

      // 2. Lưu vào %TEMP%/trishdesign-lisp/<filename>
      const tmpPath = `${(window as any).__TAURI_OS_TEMPDIR__ ?? ''}trishdesign-lisp-${entry.id}-${entry.filename}`;
      // Fallback nếu không có temp dir
      const savePath = tmpPath || `C:\\Users\\Public\\Documents\\trishdesign-lisp-${entry.filename}`;

      await invoke<number>('tg_download_file', { req: { botToken, filePath, savePath } });

      // 3. Load .lsp vào AutoCAD: gửi command (load "<savePath>")
      const lispLoadCmd = `(load "${savePath.replace(/\\/g, '\\\\')}")`;
      await sendLisp(lispLoadCmd);

      flash(`✓ Đã tải + load "${entry.name}" vào AutoCAD. Gõ ${entry.command || '(lệnh)'} để chạy.`);
    } catch (e) {
      flash(`✗ Tải LISP lỗi: ${String(e).slice(0, 150)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">☁ AutoLISP TrishTEAM Library — admin curated, sync cloud</h2>
      <div className="td-section-body">
        <div className="dos-action-bar" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="td-input"
            placeholder="Tìm theo tên / lệnh / mô tả..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: '1 1 220px', maxWidth: 320, padding: '6px 10px' }}
          />
          <select className="td-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">— Tất cả nhóm —</option>
            {LISP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="muted small">{filtered.length}/{entries.length} LISP</span>
        </div>

        {loading ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>⏳ Đang tải danh sách...</p>
        ) : entries.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>
            Library trống. Admin upload LISP qua TrishAdmin → 🧩 AutoLISP Library.
          </p>
        ) : (
          <table className="atgt-table" style={{ fontSize: 12, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>STT</th>
                <th>Tên file</th>
                <th>Lệnh</th>
                <th>Chức năng</th>
                <th>Nhóm</th>
                <th>Ghi chú</th>
                <th style={{ width: 110 }}>Load vào CAD</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id}>
                  <td>{i + 1}</td>
                  <td><strong>{e.name}</strong><br /><span className="muted small">{e.filename} · {(e.size / 1024).toFixed(1)} KB</span></td>
                  <td><code>{e.command || '—'}</code></td>
                  <td>{e.description || '—'}</td>
                  <td><span className="muted small">{e.category || 'Khác'}</span></td>
                  <td>{e.note || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void handleDownloadAndLoad(e)}
                      disabled={busyId === e.id}
                      style={{ width: '100%' }}
                    >
                      {busyId === e.id ? '⏳' : '⬇ Tải + Load'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small" style={{ marginTop: 10, fontSize: 11 }}>
          ☁ File .lsp lưu trên kênh Telegram TrishTEAM (admin upload). Khi bấm "Tải + Load", app download về %TEMP% rồi gửi <code>(load "...")</code> vào AutoCAD.
        </p>
      </div>
    </section>
  );
}
