/**
 * TrishDesign Phase 28.5 — Danh mục hồ sơ (full feature).
 *
 * 5 tabs:
 *   - Dự án: chọn / tạo / sửa biến chung
 *   - Template: thư viện .docx/.xlsx có biến {ten_du_an}
 *   - Files: tài liệu hồ sơ của dự án
 *   - Catalog: danh mục bản vẽ / thiết bị / vật liệu (Excel grid + xuất xlsx)
 *   - Biên bản: form điền → render Word
 */

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  type DossierDb,
  type DossierProject,
  type DossierTemplate,
  type DossierFile,
  type Catalog,
  type CatalogItem,
  type CatalogKind,
  type Report,
  type ReportKind,
  type DossierVariables,
  TEMPLATE_CATEGORIES,
  FILE_CATEGORIES,
  CATALOG_KIND_INFO,
  REPORT_TEMPLATES,
  emptyDossierDb,
  newDossierId,
  defaultDossierProject,
  fileKindFromName,
  formatFileSize,
  fillTemplate,
  variablesToRecord,
} from '../../lib/dossier-types.js';

const LS_KEY = 'trishdesign:dossier-db';

function loadDb(): DossierDb {
  if (typeof window === 'undefined') return emptyDossierDb();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return emptyDossierDb();
    return JSON.parse(raw) as DossierDb;
  } catch { return emptyDossierDb(); }
}
function saveDb(db: DossierDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

type Tab = 'project' | 'templates' | 'files' | 'catalogs' | 'reports';

export function DocumentsPanel(): JSX.Element {
  const [db, setDbState] = useState<DossierDb>(() => loadDb());
  const [tab, setTab] = useState<Tab>('project');
  const [statusMsg, setStatusMsg] = useState<string>('');

  type DialogState =
    | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
    | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
    | null;
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: DossierDb) => DossierDb): void {
    setDbState((prev) => ({ ...updater(prev), updatedAt: Date.now() }));
  }
  function flash(msg: string): void {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2200);
  }

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );

  function updateActiveProject(updater: (p: DossierProject) => DossierProject): void {
    if (!activeProject) return;
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? updater(p) : p)),
    }));
  }

  function handleNewProject(): void {
    setDialog({
      kind: 'prompt', title: 'Tạo dự án mới', value: 'Dự án mới',
      onSubmit: (name) => {
        const proj = defaultDossierProject(name);
        setDb((prev) => ({ ...prev, projects: [...prev.projects, proj], activeProjectId: proj.id }));
        flash(`✓ Đã tạo dự án "${name}"`);
        setTab('project');
      },
    });
  }

  function handleDeleteProject(id: string): void {
    const target = db.projects.find((p) => p.id === id);
    if (!target) return;
    setDialog({
      kind: 'confirm', title: 'Xóa dự án', danger: true,
      message: `Xóa dự án "${target.name}" và toàn bộ template/file/catalog/biên bản đi kèm?`,
      onConfirm: () => {
        setDb((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          activeProjectId: prev.activeProjectId === id ? null : prev.activeProjectId,
        }));
      },
    });
  }

  // -------------------------------------------------------------------
  // Render — luôn hiện UI structure, banner khi chưa có project
  // -------------------------------------------------------------------
  return (
    <>
      <div className="td-panel">
        <header className="td-panel-head">
          <h1>📂 Danh mục hồ sơ</h1>
          <p className="td-lead">Template Word/Excel + file hồ sơ + danh mục bản vẽ + biên bản nghiệm thu theo dự án.</p>
        </header>

        <div className="dos-toolbar">
          <select className="td-select" style={{ minWidth: 240 }}
            value={activeProject?.id ?? ''}
            onChange={(e) => setDb((prev) => ({ ...prev, activeProjectId: e.target.value || null }))}
            disabled={db.projects.length === 0}>
            {db.projects.length === 0 && <option value="">(chưa có dự án)</option>}
            {db.projects.map((p) => <option key={p.id} value={p.id}>📁 {p.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={handleNewProject} title="Tạo dự án mới">➕ Tạo dự án</button>
          {activeProject && <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(activeProject.id)} title="Xóa dự án">🗑</button>}
          <div style={{ flex: 1 }} />
          {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
        </div>

        {!activeProject ? (
          <div className="empty-banner">
            <h3 className="empty-banner-title">📁 Chưa có dự án — hãy tạo dự án mới</h3>
            <p className="empty-banner-msg">
              Tạo dự án mới để bắt đầu quản lý template Word/Excel, file hồ sơ, danh mục bản vẽ, và biên bản nghiệm thu.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự án mới</button>
            {db.projects.length > 0 && (
              <div className="empty-banner-recent">
                <div className="atgt-recent-label">Dự án gần đây:</div>
                {db.projects.map((p) => (
                  <button key={p.id} type="button" className="atgt-recent-item"
                    onClick={() => setDb((prev) => ({ ...prev, activeProjectId: p.id }))}>
                    📁 {p.name}
                    <span className="muted small"> ({p.templates.length} template · {p.files.length} file · {p.catalogs.length} danh mục · {p.reports.length} BB)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="dos-tabs">
              <TabBtn active={tab === 'project'}   onClick={() => setTab('project')}>📋 Dự án</TabBtn>
              <TabBtn active={tab === 'templates'} onClick={() => setTab('templates')}>📄 Template ({activeProject.templates.length})</TabBtn>
              <TabBtn active={tab === 'files'}     onClick={() => setTab('files')}>📁 Files ({activeProject.files.length})</TabBtn>
              <TabBtn active={tab === 'catalogs'}  onClick={() => setTab('catalogs')}>📊 Danh mục ({activeProject.catalogs.length})</TabBtn>
              <TabBtn active={tab === 'reports'}   onClick={() => setTab('reports')}>📑 Biên bản ({activeProject.reports.length})</TabBtn>
            </div>

            {tab === 'project'   && <ProjectTab project={activeProject} onUpdate={updateActiveProject} flash={flash} />}
            {tab === 'templates' && <TemplatesTab project={activeProject} onUpdate={updateActiveProject} flash={flash} setDialog={setDialog} />}
            {tab === 'files'     && <FilesTab project={activeProject} onUpdate={updateActiveProject} flash={flash} setDialog={setDialog} />}
            {tab === 'catalogs'  && <CatalogsTab project={activeProject} onUpdate={updateActiveProject} flash={flash} setDialog={setDialog} />}
            {tab === 'reports'   && <ReportsTab project={activeProject} onUpdate={updateActiveProject} flash={flash} setDialog={setDialog} />}
          </>
        )}
      </div>
      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button type="button" className={`dos-tab${active ? ' dos-tab-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

// =====================================================================
// Tab 1: Dự án — biến chung
// =====================================================================

function ProjectTab({ project, onUpdate, flash }: {
  project: DossierProject;
  onUpdate: (u: (p: DossierProject) => DossierProject) => void;
  flash: (m: string) => void;
}): JSX.Element {
  const v = project.variables;
  function setVar<K extends keyof DossierVariables>(k: K, val: DossierVariables[K]): void {
    onUpdate((p) => ({ ...p, name: k === 'tenDuAn' ? String(val) : p.name, variables: { ...p.variables, [k]: val } }));
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Biến chung của dự án (auto-fill template + biên bản)</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="Tên dự án *">
            <input className="td-input" value={v.tenDuAn} onChange={(e) => setVar('tenDuAn', e.target.value)} />
          </Field>
          <Field label="Mã dự án">
            <input className="td-input" value={v.maDuAn ?? ''} onChange={(e) => setVar('maDuAn', e.target.value)} />
          </Field>
          <Field label="Năm thực hiện">
            <input className="td-input" type="number" value={v.namThucHien} onChange={(e) => setVar('namThucHien', Number(e.target.value) || new Date().getFullYear())} />
          </Field>
          <Field label="Địa điểm">
            <input className="td-input" value={v.diaDiem} onChange={(e) => setVar('diaDiem', e.target.value)} />
          </Field>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <Field label="Chủ đầu tư">
            <input className="td-input" value={v.chuDauTu} onChange={(e) => setVar('chuDauTu', e.target.value)} />
          </Field>
          <Field label="Đơn vị tư vấn">
            <input className="td-input" value={v.donViTuVan} onChange={(e) => setVar('donViTuVan', e.target.value)} />
          </Field>
          <Field label="Đơn vị thiết kế">
            <input className="td-input" value={v.donViThietKe} onChange={(e) => setVar('donViThietKe', e.target.value)} />
          </Field>
          <Field label="Đơn vị thi công">
            <input className="td-input" value={v.donViThiCong ?? ''} onChange={(e) => setVar('donViThiCong', e.target.value)} />
          </Field>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <Field label="Đơn vị giám sát">
            <input className="td-input" value={v.donViGiamSat ?? ''} onChange={(e) => setVar('donViGiamSat', e.target.value)} />
          </Field>
          <Field label="Giá trị HĐ (VND)">
            <input className="td-input" type="number" value={v.giaTriHopDong ?? 0} onChange={(e) => setVar('giaTriHopDong', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Ngày khởi công">
            <input className="td-input" type="date" value={v.ngayKhoiCong ?? ''} onChange={(e) => setVar('ngayKhoiCong', e.target.value)} />
          </Field>
          <Field label="Ngày hoàn thành">
            <input className="td-input" type="date" value={v.ngayHoanThanh ?? ''} onChange={(e) => setVar('ngayHoanThanh', e.target.value)} />
          </Field>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <Field label="Địa chỉ chủ đầu tư">
            <input className="td-input" value={v.diaChiChuDT ?? ''} onChange={(e) => setVar('diaChiChuDT', e.target.value)} />
          </Field>
          <Field label="Địa chỉ đơn vị tư vấn">
            <input className="td-input" value={v.diaChiTuVan ?? ''} onChange={(e) => setVar('diaChiTuVan', e.target.value)} />
          </Field>
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>
          💡 Các biến này sẽ tự động chèn vào template Word/Excel (placeholder dạng <code>{`{ten_du_an}`}</code>, <code>{`{chu_dau_tu}`}</code>, <code>{`{don_vi_thiet_ke}`}</code>, ...)
        </p>
        <div className="td-action-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={() => flash('✓ Biến đã lưu (auto)')}>
            💾 Lưu biến
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="td-field">
      <span className="td-field-label">{label}</span>
      {children}
    </label>
  );
}

// =====================================================================
// Tab 2: Templates — upload .docx/.xlsx, fill biến → save
// =====================================================================

function TemplatesTab({ project, onUpdate, flash, setDialog }: {
  project: DossierProject;
  onUpdate: (u: (p: DossierProject) => DossierProject) => void;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  const [category, setCategory] = useState<DossierTemplate['category']>('thuyet_minh');

  async function handleUpload(): Promise<void> {
    try {
      const path = await open({
        title: 'Chọn template Word/Excel',
        filters: [{ name: 'Document', extensions: ['docx', 'xlsx', 'doc', 'xls'] }],
      });
      if (typeof path !== 'string') return;
      const name = path.split(/[\\/]/).pop() ?? 'Template';
      const tmpl: DossierTemplate = {
        id: newDossierId('tmpl'),
        name,
        kind: fileKindFromName(name),
        category,
        filePath: path,
        createdAt: Date.now(),
      };
      onUpdate((p) => ({ ...p, templates: [...p.templates, tmpl] }));
      flash(`✓ Đã thêm template "${name}"`);
    } catch (e) {
      flash(`✗ Lỗi: ${String(e)}`);
    }
  }

  function handleDelete(id: string): void {
    const t = project.templates.find((x) => x.id === id);
    if (!t) return;
    setDialog({
      kind: 'confirm', title: 'Xóa template', danger: true,
      message: `Xóa template "${t.name}" khỏi dự án?`,
      onConfirm: () => onUpdate((p) => ({ ...p, templates: p.templates.filter((x) => x.id !== id) })),
    });
  }

  async function handleOpen(t: DossierTemplate): Promise<void> {
    if (!t.filePath) return;
    try { await openUrl(`file://${t.filePath}`); }
    catch (e) { flash(`✗ Không mở được file: ${String(e)}`); }
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Thư viện template</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <select className="td-select" value={category} onChange={(e) => setCategory(e.target.value as any)} style={{ maxWidth: 200 }}>
            {TEMPLATE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void handleUpload()}>
            📤 Upload template
          </button>
        </div>

        {project.templates.length === 0 ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa có template nào. Upload .docx hoặc .xlsx có placeholder <code>{`{ten_du_an}`}</code> để bắt đầu.
          </p>
        ) : (
          <div className="dos-list">
            {TEMPLATE_CATEGORIES.map((cat) => {
              const list = project.templates.filter((t) => t.category === cat.id);
              if (list.length === 0) return null;
              return (
                <div key={cat.id} className="dos-list-group">
                  <div className="dos-list-group-title">{cat.icon} {cat.name} ({list.length})</div>
                  {list.map((t) => (
                    <div key={t.id} className="dos-list-item">
                      <span className="dos-item-icon">{t.kind === 'docx' ? '📄' : t.kind === 'xlsx' ? '📊' : '📁'}</span>
                      <span className="dos-item-name">{t.name}</span>
                      <span className="muted small">{t.filePath ?? ''}</span>
                      <div className="dos-item-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => void handleOpen(t)}>📂 Mở</button>
                        <button type="button" className="btn btn-ghost" onClick={() => handleDelete(t.id)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <p className="muted small" style={{ marginTop: 12 }}>
          💡 Template Word/Excel có placeholder <code>{`{ten_du_an}`}</code>, <code>{`{chu_dau_tu}`}</code>... sẽ được fill biến khi export. Hiện tại app chỉ lưu link file → mở trong Word/Excel để bạn tự fill biến.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// Tab 3: Files — upload + open + categorize
// =====================================================================

function FilesTab({ project, onUpdate, flash, setDialog }: {
  project: DossierProject;
  onUpdate: (u: (p: DossierProject) => DossierProject) => void;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  const [category, setCategory] = useState<DossierFile['category']>('khao_sat');

  async function handleUpload(): Promise<void> {
    try {
      const path = await open({
        title: 'Chọn file hồ sơ',
        multiple: true,
      });
      if (!path) return;
      const paths = Array.isArray(path) ? path : [path];
      const files: DossierFile[] = paths.map((p) => ({
        id: newDossierId('file'),
        name: p.split(/[\\/]/).pop() ?? 'File',
        path: p,
        category,
        uploadedAt: Date.now(),
      }));
      onUpdate((proj) => ({ ...proj, files: [...proj.files, ...files] }));
      flash(`✓ Đã thêm ${files.length} file`);
    } catch (e) { flash(`✗ Lỗi: ${String(e)}`); }
  }

  function handleDelete(id: string): void {
    const f = project.files.find((x) => x.id === id);
    if (!f) return;
    setDialog({
      kind: 'confirm', title: 'Xóa file', danger: true,
      message: `Xóa "${f.name}" khỏi danh sách? (file gốc trên ổ cứng vẫn còn)`,
      onConfirm: () => onUpdate((p) => ({ ...p, files: p.files.filter((x) => x.id !== id) })),
    });
  }

  async function handleOpen(f: DossierFile): Promise<void> {
    try { await openUrl(`file://${f.path}`); }
    catch (e) { flash(`✗ Không mở được: ${String(e)}`); }
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">File hồ sơ dự án</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <select className="td-select" value={category} onChange={(e) => setCategory(e.target.value as any)} style={{ maxWidth: 200 }}>
            {FILE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void handleUpload()}>
            📤 Thêm file
          </button>
        </div>

        {project.files.length === 0 ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa có file nào. Thêm các file hồ sơ khảo sát / thiết kế / hoàn công / ...
          </p>
        ) : (
          <div className="dos-list">
            {FILE_CATEGORIES.map((cat) => {
              const list = project.files.filter((f) => f.category === cat.id);
              if (list.length === 0) return null;
              return (
                <div key={cat.id} className="dos-list-group">
                  <div className="dos-list-group-title">{cat.icon} {cat.name} ({list.length})</div>
                  {list.map((f) => (
                    <div key={f.id} className="dos-list-item">
                      <span className="dos-item-icon">📄</span>
                      <span className="dos-item-name">{f.name}</span>
                      <span className="muted small">{f.path}</span>
                      <div className="dos-item-actions">
                        <button type="button" className="btn btn-ghost" onClick={() => void handleOpen(f)}>📂 Mở</button>
                        <button type="button" className="btn btn-ghost" onClick={() => handleDelete(f.id)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// Tab 4: Catalogs — Excel grid input cho bản vẽ / thiết bị / vật liệu
// =====================================================================

function CatalogsTab({ project, onUpdate, flash, setDialog }: {
  project: DossierProject;
  onUpdate: (u: (p: DossierProject) => DossierProject) => void;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(project.catalogs[0]?.id ?? null);
  const active = project.catalogs.find((c) => c.id === activeId) ?? null;

  function handleNew(kind: CatalogKind): void {
    const cat: Catalog = {
      id: newDossierId('cat'),
      kind,
      title: `Danh mục ${CATALOG_KIND_INFO[kind].name.toLowerCase()}`,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onUpdate((p) => ({ ...p, catalogs: [...p.catalogs, cat] }));
    setActiveId(cat.id);
    flash(`✓ Đã tạo "${cat.title}"`);
  }

  function updateActive(updater: (c: Catalog) => Catalog): void {
    if (!active) return;
    onUpdate((p) => ({
      ...p,
      catalogs: p.catalogs.map((c) => (c.id === active.id ? { ...updater(c), updatedAt: Date.now() } : c)),
    }));
  }

  function handleAddItem(): void {
    if (!active) return;
    const item: CatalogItem = {
      id: newDossierId('it'),
      stt: active.items.length + 1, ma: '', ten: '',
    };
    updateActive((c) => ({ ...c, items: [...c.items, item] }));
  }

  function handleDeleteItem(id: string): void {
    updateActive((c) => ({ ...c, items: c.items.filter((x) => x.id !== id).map((x, i) => ({ ...x, stt: i + 1 })) }));
  }

  function handleUpdateItem(id: string, patch: Partial<CatalogItem>): void {
    updateActive((c) => ({ ...c, items: c.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }

  function handleDeleteCatalog(): void {
    if (!active) return;
    setDialog({
      kind: 'confirm', title: 'Xóa danh mục', danger: true,
      message: `Xóa "${active.title}"?`,
      onConfirm: () => {
        onUpdate((p) => ({ ...p, catalogs: p.catalogs.filter((c) => c.id !== active.id) }));
        setActiveId(null);
      },
    });
  }

  async function handleExportXlsx(): Promise<void> {
    if (!active) return;
    const wb = XLSX.utils.book_new();
    const headers = active.kind === 'banve'
      ? ['STT', 'Mã hiệu', 'Tên bản vẽ', 'Khổ giấy', 'Tỷ lệ', 'Số lượng', 'Ghi chú']
      : active.kind === 'thietbi'
      ? ['STT', 'Mã hiệu', 'Tên thiết bị', 'Quy cách', 'Đơn vị', 'Số lượng', 'Xuất xứ', 'Ghi chú']
      : ['STT', 'Mã hiệu', 'Tên vật liệu', 'Quy cách', 'Đơn vị', 'Số lượng', 'Xuất xứ', 'Ghi chú'];
    const rows = [
      [active.title.toUpperCase()],
      [`Dự án: ${project.variables.tenDuAn}`],
      [],
      headers,
      ...active.items.map((it) => active.kind === 'banve'
        ? [it.stt, it.ma, it.ten, it.khoGiay ?? '', it.tyLe ?? '', it.soLuong ?? '', it.ghiChu ?? '']
        : [it.stt, it.ma, it.ten, it.quyCach ?? '', it.donVi ?? '', it.soLuong ?? '', it.xuatXu ?? '', it.ghiChu ?? '']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, CATALOG_KIND_INFO[active.kind].name);
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = (project.variables.tenDuAn || 'DuAn').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: 'Lưu danh mục',
      defaultPath: `DanhMuc_${active.kind}_${safeName}_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất danh mục');
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Danh mục</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <select className="td-select" value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value || null)} style={{ maxWidth: 280 }}>
            <option value="">— Chọn danh mục —</option>
            {project.catalogs.map((c) => <option key={c.id} value={c.id}>{CATALOG_KIND_INFO[c.kind].icon} {c.title}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={() => handleNew('banve')}>📐 + Bản vẽ</button>
            <button type="button" className="btn btn-ghost" onClick={() => handleNew('thietbi')}>🔧 + Thiết bị</button>
            <button type="button" className="btn btn-ghost" onClick={() => handleNew('vatlieu')}>🧱 + Vật liệu</button>
          </div>
          <div style={{ flex: 1 }} />
          {active && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void handleExportXlsx()}>📊 Xuất Excel</button>
              <button type="button" className="btn btn-ghost" onClick={handleDeleteCatalog}>🗑 Xóa danh mục</button>
            </>
          )}
        </div>

        {active ? (
          <CatalogEditor catalog={active} onAdd={handleAddItem} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} />
        ) : (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa chọn danh mục. Tạo mới hoặc chọn từ dropdown ở trên.
          </p>
        )}
      </div>
    </section>
  );
}

function CatalogEditor({ catalog, onAdd, onUpdate, onDelete }: {
  catalog: Catalog;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<CatalogItem>) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  const isBanve = catalog.kind === 'banve';
  return (
    <div>
      <div className="dos-catalog-title">{CATALOG_KIND_INFO[catalog.kind].icon} {catalog.title}</div>
      <div className="atgt-table-wrap">
        <table className="atgt-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>STT</th>
              <th style={{ width: 120 }}>Mã hiệu</th>
              <th>Tên</th>
              {isBanve ? (<>
                <th style={{ width: 90 }}>Khổ giấy</th>
                <th style={{ width: 100 }}>Tỷ lệ</th>
              </>) : (<>
                <th style={{ width: 160 }}>Quy cách</th>
                <th style={{ width: 80 }}>Đơn vị</th>
              </>)}
              <th style={{ width: 80 }}>Số lượng</th>
              {!isBanve && <th style={{ width: 120 }}>Xuất xứ</th>}
              <th>Ghi chú</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {catalog.items.length === 0 ? (
              <tr><td colSpan={isBanve ? 8 : 9} className="atgt-empty-row">Chưa có item nào.</td></tr>
            ) : catalog.items.map((it) => (
              <tr key={it.id}>
                <td>{it.stt}</td>
                <td><InlineInput value={it.ma} onChange={(v) => onUpdate(it.id, { ma: v })} /></td>
                <td><InlineInput value={it.ten} onChange={(v) => onUpdate(it.id, { ten: v })} /></td>
                {isBanve ? (<>
                  <td><InlineInput value={it.khoGiay ?? ''} onChange={(v) => onUpdate(it.id, { khoGiay: v })} placeholder="A0/A1/A2/A3" /></td>
                  <td><InlineInput value={it.tyLe ?? ''} onChange={(v) => onUpdate(it.id, { tyLe: v })} placeholder="1/100" /></td>
                </>) : (<>
                  <td><InlineInput value={it.quyCach ?? ''} onChange={(v) => onUpdate(it.id, { quyCach: v })} /></td>
                  <td><InlineInput value={it.donVi ?? ''} onChange={(v) => onUpdate(it.id, { donVi: v })} /></td>
                </>)}
                <td><InlineInput type="number" value={String(it.soLuong ?? '')} onChange={(v) => onUpdate(it.id, { soLuong: Number(v) || 0 })} /></td>
                {!isBanve && <td><InlineInput value={it.xuatXu ?? ''} onChange={(v) => onUpdate(it.id, { xuatXu: v })} /></td>}
                <td><InlineInput value={it.ghiChu ?? ''} onChange={(v) => onUpdate(it.id, { ghiChu: v })} /></td>
                <td><button type="button" className="atgt-del-btn" onClick={() => onDelete(it.id)}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onAdd} style={{ marginTop: 8 }}>
        ➕ Thêm dòng
      </button>
    </div>
  );
}

function InlineInput({ value, onChange, type, placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }): JSX.Element {
  return (
    <input
      type={type ?? 'text'}
      placeholder={placeholder}
      className="td-input"
      style={{ padding: '4px 8px', fontSize: 12 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// =====================================================================
// Tab 5: Reports — Form điền → render Word
// =====================================================================

function ReportsTab({ project, onUpdate, flash, setDialog }: {
  project: DossierProject;
  onUpdate: (u: (p: DossierProject) => DossierProject) => void;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(project.reports[0]?.id ?? null);
  const active = project.reports.find((r) => r.id === activeId) ?? null;

  function handleNew(kind: ReportKind): void {
    const tmpl = REPORT_TEMPLATES.find((t) => t.id === kind);
    if (!tmpl) return;
    const fields: Record<string, string> = {};
    for (const f of tmpl.fields) fields[f] = '';
    const r: Report = {
      id: newDossierId('rep'),
      kind, title: tmpl.name, fields,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    onUpdate((p) => ({ ...p, reports: [...p.reports, r] }));
    setActiveId(r.id);
    flash(`✓ Đã tạo "${tmpl.name}"`);
  }

  function handleDelete(): void {
    if (!active) return;
    setDialog({
      kind: 'confirm', title: 'Xóa biên bản', danger: true,
      message: `Xóa biên bản "${active.title}"?`,
      onConfirm: () => {
        onUpdate((p) => ({ ...p, reports: p.reports.filter((r) => r.id !== active.id) }));
        setActiveId(null);
      },
    });
  }

  function updateField(key: string, val: string): void {
    if (!active) return;
    onUpdate((p) => ({
      ...p,
      reports: p.reports.map((r) => (r.id === active.id ? { ...r, fields: { ...r.fields, [key]: val }, updatedAt: Date.now() } : r)),
    }));
  }

  async function handleExport(): Promise<void> {
    if (!active) return;
    const tmpl = REPORT_TEMPLATES.find((t) => t.id === active.kind);
    if (!tmpl) return;
    const rec = variablesToRecord(project.variables);
    const ngay = new Date().toLocaleDateString('vi-VN');

    // Render HTML đơn giản → save .html (user mở trong Word để chuyển docx)
    const fieldsHtml = tmpl.fields.map((f) => `<tr><td><b>${f}:</b></td><td>${active.fields[f] ?? ''}</td></tr>`).join('\n');
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${active.title}</title>
<style>body{font-family:'Times New Roman',serif;font-size:13pt;margin:2cm;line-height:1.5}h1{text-align:center;font-size:14pt}table{width:100%;border-collapse:collapse}td{padding:6px 0;vertical-align:top}.head{text-align:center;margin-bottom:24px}.sig{margin-top:48px;display:flex;justify-content:space-around;text-align:center}</style>
</head><body>
<div class="head">
  <p><b>${rec.chu_dau_tu || 'CHỦ ĐẦU TƯ'}</b></p>
  <p><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br/>Độc lập - Tự do - Hạnh phúc</p>
  <p>${rec.dia_diem || ''}, ngày ${ngay}</p>
</div>
<h1>${active.title.toUpperCase()}</h1>
<p><b>Dự án:</b> ${rec.ten_du_an || '...'} ${rec.ma_du_an ? `(Mã: ${rec.ma_du_an})` : ''}</p>
<p><b>Chủ đầu tư:</b> ${rec.chu_dau_tu || '...'}</p>
<p><b>Đơn vị tư vấn:</b> ${rec.don_vi_tu_van || '...'}</p>
<p><b>Đơn vị thiết kế:</b> ${rec.don_vi_thiet_ke || '...'}</p>
${rec.don_vi_thi_cong ? `<p><b>Đơn vị thi công:</b> ${rec.don_vi_thi_cong}</p>` : ''}
${rec.don_vi_giam_sat ? `<p><b>Đơn vị giám sát:</b> ${rec.don_vi_giam_sat}</p>` : ''}
<hr/>
<table>${fieldsHtml}</table>
<div class="sig">
  <div><b>ĐẠI DIỆN CHỦ ĐẦU TƯ</b><br/><br/><br/>(Ký, ghi rõ họ tên)</div>
  <div><b>ĐẠI DIỆN TƯ VẤN</b><br/><br/><br/>(Ký, ghi rõ họ tên)</div>
  <div><b>ĐẠI DIỆN NHÀ THẦU</b><br/><br/><br/>(Ký, ghi rõ họ tên)</div>
</div>
</body></html>`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = active.title.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: 'Lưu biên bản',
      defaultPath: `${safeName}_${dateStr}.html`,
      filters: [{ name: 'HTML/Word', extensions: ['html', 'doc'] }],
    });
    if (!path) return;
    const bytes = Array.from(new TextEncoder().encode(html));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất biên bản (HTML — mở trong Word để chuyển .docx)');
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Biên bản</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <select className="td-select" value={activeId ?? ''} onChange={(e) => setActiveId(e.target.value || null)} style={{ maxWidth: 320 }}>
            <option value="">— Chọn biên bản —</option>
            {project.reports.map((r) => {
              const t = REPORT_TEMPLATES.find((x) => x.id === r.kind);
              return <option key={r.id} value={r.id}>{t?.icon ?? '📑'} {r.title}</option>;
            })}
          </select>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {REPORT_TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="btn btn-ghost" onClick={() => handleNew(t.id)} title={t.name}>
                {t.icon}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {active && (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void handleExport()}>📤 Xuất Word/HTML</button>
              <button type="button" className="btn btn-ghost" onClick={handleDelete}>🗑</button>
            </>
          )}
        </div>

        {active ? (
          <div style={{ marginTop: 16 }}>
            <div className="dos-catalog-title">
              {REPORT_TEMPLATES.find((t) => t.id === active.kind)?.icon} {active.title}
            </div>
            <div className="td-form-row" style={{ marginTop: 12 }}>
              {REPORT_TEMPLATES.find((t) => t.id === active.kind)?.fields.map((f) => (
                <Field key={f} label={f}>
                  <input className="td-input" value={active.fields[f] ?? ''} onChange={(e) => updateField(f, e.target.value)} />
                </Field>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 14 }}>
              💡 Header biên bản auto-fill từ biến chung dự án (chủ đầu tư, đơn vị TK/TC/GS).
            </p>
          </div>
        ) : (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa chọn biên bản. Bấm icon trên để tạo biên bản mới (✅ NT công việc, 🏁 NT giai đoạn, ...).
          </p>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// DialogModal — re-use pattern từ AtgtPanel
// =====================================================================

type DialogState =
  | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

function DialogModal({ state, onClose }: { state: DialogState; onClose: () => void }): JSX.Element {
  const [input, setInput] = useState('');
  useEffect(() => { if (state?.kind === 'prompt') setInput(state.value); }, [state]);
  if (!state) return <></>;
  function submit(): void {
    if (state?.kind === 'prompt') {
      const v = input.trim();
      if (!v) return;
      state.onSubmit(v);
    } else if (state?.kind === 'confirm') {
      state.onConfirm();
    }
    onClose();
  }
  return (
    <div className="atgt-dialog-backdrop" onClick={onClose}>
      <div className="atgt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="atgt-dialog-title">{state.title}</div>
        {state.kind === 'prompt' ? (
          <input type="text" className="td-input" autoFocus value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />
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
