/**
 * TrishDesign Phase 28.5 — Panel Dự toán xây dựng.
 *
 * 3 tabs:
 *   - BKL: Bảng khối lượng công việc (Excel-grid input + auto-fill từ catalog)
 *   - Catalog: Định mức + đơn giá (import từ Excel)
 *   - Tổng hợp: Chi phí trực tiếp / gián tiếp / lãi / thuế / dự phòng
 */

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import {
  type EstimateDb,
  type EstimateProject,
  type WorkItem,
  type Norm,
  type Price,
  type CostFactors,
  emptyEstimateDb,
  newEstId,
  defaultEstimateProject,
  defaultCostFactors,
  calculateCosts,
  recomputeWorkItem,
  formatVnd,
} from '../../lib/estimate-types.js';

const LS_KEY = 'trishdesign:estimate-db';

function loadDb(): EstimateDb {
  if (typeof window === 'undefined') return emptyEstimateDb();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) as EstimateDb : emptyEstimateDb();
  } catch { return emptyEstimateDb(); }
}
function saveDb(db: EstimateDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

type DialogState =
  | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

type Tab = 'project' | 'bkl' | 'catalog' | 'summary';

export function EstimatePanel(): JSX.Element {
  const [db, setDbState] = useState<EstimateDb>(() => loadDb());
  const [tab, setTab] = useState<Tab>('project');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: EstimateDb) => EstimateDb): void {
    setDbState((prev) => ({ ...updater(prev), updatedAt: Date.now() }));
  }
  function flash(msg: string): void {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2500);
  }

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );

  function updateActiveProject(updater: (p: EstimateProject) => EstimateProject): void {
    if (!activeProject) return;
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? { ...updater(p), updatedAt: Date.now() } : p)),
    }));
  }

  function handleNewProject(): void {
    setDialog({
      kind: 'prompt', title: 'Tạo dự án dự toán', value: 'Dự toán mới',
      onSubmit: (name) => {
        const proj = defaultEstimateProject(name);
        setDb((prev) => ({ ...prev, projects: [...prev.projects, proj], activeProjectId: proj.id }));
        flash(`✓ Đã tạo "${name}"`);
        setTab('project');
      },
    });
  }
  function handleDeleteProject(id: string): void {
    const t = db.projects.find((p) => p.id === id);
    if (!t) return;
    setDialog({
      kind: 'confirm', title: 'Xóa dự toán', danger: true,
      message: `Xóa "${t.name}" cùng tất cả BKL?`,
      onConfirm: () => setDb((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        activeProjectId: prev.activeProjectId === id ? null : prev.activeProjectId,
      })),
    });
  }

  // -------------------------------------------------------------------
  // Render — luôn hiện UI structure, banner khi chưa có project
  // -------------------------------------------------------------------
  return (
    <>
      <div className="td-panel">
        <header className="td-panel-head">
          <h1>💰 Dự toán xây dựng</h1>
          <p className="td-lead">BKL + catalog định mức/đơn giá + tổng hợp chi phí (TT/GT/lãi/VAT) theo TT 12/2021.</p>
        </header>

        <div className="dos-toolbar">
          <select className="td-select" style={{ minWidth: 240 }}
            value={activeProject?.id ?? ''}
            onChange={(e) => setDb((prev) => ({ ...prev, activeProjectId: e.target.value || null }))}
            disabled={db.projects.length === 0}>
            {db.projects.length === 0 && <option value="">(chưa có dự toán)</option>}
            {db.projects.map((p) => <option key={p.id} value={p.id}>💰 {p.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự toán</button>
          {activeProject && <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(activeProject.id)}>🗑</button>}
          <div style={{ flex: 1 }} />
          {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
        </div>

        {!activeProject ? (
          <div className="empty-banner">
            <h3 className="empty-banner-title">💰 Chưa có dự toán — hãy tạo dự toán mới</h3>
            <p className="empty-banner-msg">Tạo dự toán mới để nhập BKL, catalog định mức/đơn giá, và tính tổng hợp chi phí xây dựng.</p>
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự toán mới</button>
            {db.projects.length > 0 && (
              <div className="empty-banner-recent">
                <div className="atgt-recent-label">Dự toán gần đây:</div>
                {db.projects.map((p) => (
                  <button key={p.id} type="button" className="atgt-recent-item"
                    onClick={() => setDb((prev) => ({ ...prev, activeProjectId: p.id }))}>
                    💰 {p.name} <span className="muted small">({p.workItems.length} công việc)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="dos-tabs">
              <TabBtn active={tab === 'project'} onClick={() => setTab('project')}>📋 Thông tin dự toán</TabBtn>
              <TabBtn active={tab === 'bkl'}     onClick={() => setTab('bkl')}>📊 Bảng khối lượng ({activeProject.workItems.length})</TabBtn>
              <TabBtn active={tab === 'catalog'} onClick={() => setTab('catalog')}>📚 Catalog ({db.norms.length} ĐM · {db.prices.length} giá)</TabBtn>
              <TabBtn active={tab === 'summary'} onClick={() => setTab('summary')}>📈 Tổng hợp chi phí</TabBtn>
            </div>

            {tab === 'project' && <ProjectTab project={activeProject} onUpdate={updateActiveProject} />}
            {tab === 'bkl'     && <BklTab project={activeProject} onUpdate={updateActiveProject} db={db} flash={flash} setDialog={setDialog} />}
            {tab === 'catalog' && <CatalogTab db={db} setDb={setDb} flash={flash} setDialog={setDialog} />}
            {tab === 'summary' && <SummaryTab project={activeProject} onUpdate={updateActiveProject} flash={flash} />}
          </>
        )}
      </div>
      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return <button type="button" className={`dos-tab${active ? ' dos-tab-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return <label className="td-field"><span className="td-field-label">{label}</span>{children}</label>;
}

// =====================================================================
// Tab 1: Project info
// =====================================================================

function ProjectTab({ project, onUpdate }: {
  project: EstimateProject;
  onUpdate: (u: (p: EstimateProject) => EstimateProject) => void;
}): JSX.Element {
  function set<K extends keyof EstimateProject>(k: K, v: EstimateProject[K]): void {
    onUpdate((p) => ({ ...p, [k]: v }));
  }
  return (
    <section className="td-section">
      <h2 className="td-section-title">Thông tin dự toán</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="Tên dự toán *"><input className="td-input" value={project.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Tên công trình"><input className="td-input" value={project.congTrinh ?? ''} onChange={(e) => set('congTrinh', e.target.value)} /></Field>
          <Field label="Địa điểm"><input className="td-input" value={project.diaDiem ?? ''} onChange={(e) => set('diaDiem', e.target.value)} /></Field>
          <Field label="Ngày lập"><input type="date" className="td-input" value={project.ngayLap ?? ''} onChange={(e) => set('ngayLap', e.target.value)} /></Field>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <Field label="Chủ đầu tư"><input className="td-input" value={project.chuDauTu ?? ''} onChange={(e) => set('chuDauTu', e.target.value)} /></Field>
          <Field label="Đơn vị thiết kế"><input className="td-input" value={project.donViThietKe ?? ''} onChange={(e) => set('donViThietKe', e.target.value)} /></Field>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// Tab 2: BKL
// =====================================================================

function BklTab({ project, onUpdate, db, flash, setDialog }: {
  project: EstimateProject;
  onUpdate: (u: (p: EstimateProject) => EstimateProject) => void;
  db: EstimateDb;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  function handleAddRow(): void {
    const item: WorkItem = recomputeWorkItem({
      id: newEstId('wi'), stt: project.workItems.length + 1,
      normCode: '', donVi: '', khoiLuong: 0,
      donGiaVL: 0, donGiaNC: 0, donGiaM: 0,
    });
    onUpdate((p) => ({ ...p, workItems: [...p.workItems, item] }));
  }

  function updateRow(id: string, patch: Partial<WorkItem>): void {
    onUpdate((p) => ({
      ...p,
      workItems: p.workItems.map((x) => (x.id === id ? recomputeWorkItem({ ...x, ...patch }) : x)),
    }));
  }

  function deleteRow(id: string): void {
    onUpdate((p) => ({
      ...p,
      workItems: p.workItems.filter((x) => x.id !== id).map((x, i) => ({ ...x, stt: i + 1 })),
    }));
  }

  function autoFillFromCatalog(rowId: string, normCode: string): void {
    const norm = db.norms.find((n) => n.code === normCode);
    if (!norm) return;
    let dgVL = 0, dgNC = 0, dgM = 0;
    for (const r of norm.resources) {
      const price = db.prices.find((p) => p.code === r.code);
      const cost = (price?.donGia ?? 0) * r.hao;
      if (r.type === 'vatlieu') dgVL += cost;
      else if (r.type === 'nhancong') dgNC += cost;
      else dgM += cost;
    }
    updateRow(rowId, { donVi: norm.donVi, donGiaVL: dgVL, donGiaNC: dgNC, donGiaM: dgM, customName: norm.name });
    flash(`✓ Đã tự động fill đơn giá từ ĐM ${normCode}`);
  }

  function handleClearAll(): void {
    setDialog({
      kind: 'confirm', title: 'Xóa toàn bộ BKL', danger: true,
      message: 'Xóa tất cả dòng trong bảng khối lượng?',
      onConfirm: () => onUpdate((p) => ({ ...p, workItems: [] })),
    });
  }

  async function handleExport(): Promise<void> {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      [`BẢNG KHỐI LƯỢNG: ${project.name}`],
      [project.congTrinh ?? '', project.diaDiem ?? '', project.ngayLap ?? ''],
      [],
      ['STT', 'Mã ĐM', 'Tên công việc', 'ĐV', 'KL', 'ĐG VL', 'ĐG NC', 'ĐG Máy', 'TT VL', 'TT NC', 'TT Máy', 'Thành tiền', 'Ghi chú'],
    ];
    let sumVL = 0, sumNC = 0, sumM = 0, sumT = 0;
    for (const it of project.workItems) {
      const r = recomputeWorkItem(it);
      sumVL += r.thanhTienVL ?? 0;
      sumNC += r.thanhTienNC ?? 0;
      sumM += r.thanhTienM ?? 0;
      sumT += r.thanhTien ?? 0;
      rows.push([
        r.stt, r.normCode, r.customName ?? '', r.donVi, r.khoiLuong,
        r.donGiaVL, r.donGiaNC, r.donGiaM,
        r.thanhTienVL ?? 0, r.thanhTienNC ?? 0, r.thanhTienM ?? 0, r.thanhTien ?? 0,
        r.ghiChu ?? '',
      ]);
    }
    rows.push([]);
    rows.push(['', '', 'TỔNG', '', '', '', '', '', sumVL, sumNC, sumM, sumT]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 35 }, { wch: 8 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'BKL');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safe = project.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: 'Lưu BKL', defaultPath: `BKL_${safe}_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất BKL');
  }

  const totals = useMemo(() => {
    let vl = 0, nc = 0, m = 0, t = 0;
    for (const it of project.workItems) {
      vl += it.thanhTienVL ?? 0;
      nc += it.thanhTienNC ?? 0;
      m += it.thanhTienM ?? 0;
      t += it.thanhTien ?? 0;
    }
    return { vl, nc, m, t };
  }, [project.workItems]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">Bảng khối lượng công việc</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <button type="button" className="btn btn-primary" onClick={handleAddRow}>➕ Thêm dòng</button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleExport()} disabled={project.workItems.length === 0}>📊 Xuất Excel</button>
          <button type="button" className="btn btn-ghost" onClick={handleClearAll} disabled={project.workItems.length === 0}>🗑 Xóa tất cả</button>
          <div style={{ flex: 1 }} />
          <span className="muted small">Tổng VL: <b>{formatVnd(totals.vl)}</b> · NC: <b>{formatVnd(totals.nc)}</b> · M: <b>{formatVnd(totals.m)}</b> · TỔNG: <b style={{ color: 'var(--color-accent-primary)' }}>{formatVnd(totals.t)} ₫</b></span>
        </div>

        <div className="atgt-table-wrap" style={{ maxHeight: 480 }}>
          <table className="atgt-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>STT</th>
                <th style={{ width: 130 }}>Mã ĐM</th>
                <th>Tên công việc</th>
                <th style={{ width: 70 }}>ĐV</th>
                <th style={{ width: 90 }}>KL</th>
                <th style={{ width: 110 }}>ĐG VL</th>
                <th style={{ width: 110 }}>ĐG NC</th>
                <th style={{ width: 110 }}>ĐG Máy</th>
                <th style={{ width: 130 }}>Thành tiền</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {project.workItems.length === 0 ? (
                <tr><td colSpan={10} className="atgt-empty-row">Chưa có dòng nào. Bấm "Thêm dòng" để bắt đầu.</td></tr>
              ) : project.workItems.map((it) => (
                <tr key={it.id}>
                  <td>{it.stt}</td>
                  <td>
                    <input list="norm-list" className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.normCode}
                      onChange={(e) => updateRow(it.id, { normCode: e.target.value })}
                      onBlur={() => it.normCode && autoFillFromCatalog(it.id, it.normCode)}
                      placeholder="VD AB.11122" />
                  </td>
                  <td>
                    <input className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.customName ?? ''} onChange={(e) => updateRow(it.id, { customName: e.target.value })} />
                  </td>
                  <td>
                    <input className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.donVi} onChange={(e) => updateRow(it.id, { donVi: e.target.value })} />
                  </td>
                  <td>
                    <input type="number" className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.khoiLuong} onChange={(e) => updateRow(it.id, { khoiLuong: Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input type="number" className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.donGiaVL} onChange={(e) => updateRow(it.id, { donGiaVL: Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input type="number" className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.donGiaNC} onChange={(e) => updateRow(it.id, { donGiaNC: Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input type="number" className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                      value={it.donGiaM} onChange={(e) => updateRow(it.id, { donGiaM: Number(e.target.value) || 0 })} />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                    {formatVnd(it.thanhTien ?? 0)}
                  </td>
                  <td><button type="button" className="atgt-del-btn" onClick={() => deleteRow(it.id)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <datalist id="norm-list">
          {db.norms.map((n) => <option key={n.id} value={n.code}>{n.name}</option>)}
        </datalist>

        <p className="muted small" style={{ marginTop: 10 }}>
          💡 Nhập Mã ĐM trùng catalog → tab key/blur để auto-fill ĐG VL/NC/Máy. Catalog quản lý ở tab "Catalog".
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// Tab 3: Catalog (Norms + Prices)
// =====================================================================

function CatalogTab({ db, setDb, flash, setDialog }: {
  db: EstimateDb;
  setDb: (u: (prev: EstimateDb) => EstimateDb) => void;
  flash: (m: string) => void;
  setDialog: (s: any) => void;
}): JSX.Element {
  const [subTab, setSubTab] = useState<'norms' | 'prices'>('norms');
  const [search, setSearch] = useState('');

  async function handleImportNorms(): Promise<void> {
    try {
      const path = await open({ title: 'Chọn Excel định mức', filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }] });
      if (typeof path !== 'string') return;
      const res = await fetch(`file://${path}`);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      // Expect columns: Mã ĐM | Tên | Đơn vị | (Mã VL|Tên VL|ĐV VL|Hao VL) ... or simplified
      const norms: Norm[] = rows.filter((r) => r['Mã ĐM'] || r['Ma DM'] || r.code).map((r) => ({
        id: newEstId('n'),
        code: String(r['Mã ĐM'] ?? r['Ma DM'] ?? r.code ?? ''),
        name: String(r['Tên'] ?? r['Ten'] ?? r.name ?? ''),
        donVi: String(r['Đơn vị'] ?? r['Don vi'] ?? r.donVi ?? ''),
        category: r['Nhóm'] ?? r['Nhom'] ?? r.category,
        resources: [],
        note: r['Ghi chú'] ?? r.note,
      }));
      setDb((prev) => ({ ...prev, norms: [...prev.norms, ...norms] }));
      flash(`✓ Đã import ${norms.length} mã định mức`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  async function handleImportPrices(): Promise<void> {
    try {
      const path = await open({ title: 'Chọn Excel đơn giá', filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }] });
      if (typeof path !== 'string') return;
      const res = await fetch(`file://${path}`);
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]!]!;
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);
      const prices: Price[] = rows.filter((r) => r['Mã'] || r.code).map((r) => ({
        id: newEstId('p'),
        code: String(r['Mã'] ?? r['Ma'] ?? r.code ?? ''),
        name: String(r['Tên'] ?? r['Ten'] ?? r.name ?? ''),
        type: ((String(r['Loại'] ?? r['Loai'] ?? r.type ?? 'vatlieu')).toLowerCase().includes('nc')) ? 'nhancong'
            : (String(r['Loại'] ?? r['Loai'] ?? '').toLowerCase().includes('máy')) ? 'may' : 'vatlieu',
        donVi: String(r['Đơn vị'] ?? r['Don vi'] ?? r.donVi ?? ''),
        donGia: Number(r['Đơn giá'] ?? r['Don gia'] ?? r.donGia ?? 0),
        region: r['Vùng'] ?? r.region,
        source: r['Nguồn'] ?? r.source,
        updatedAt: Date.now(),
      }));
      setDb((prev) => ({ ...prev, prices: [...prev.prices, ...prices] }));
      flash(`✓ Đã import ${prices.length} đơn giá`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  function handleClearNorms(): void {
    setDialog({ kind: 'confirm', title: 'Xóa định mức', danger: true, message: 'Xóa toàn bộ catalog định mức?',
      onConfirm: () => setDb((prev) => ({ ...prev, norms: [] })) });
  }
  function handleClearPrices(): void {
    setDialog({ kind: 'confirm', title: 'Xóa đơn giá', danger: true, message: 'Xóa toàn bộ catalog đơn giá?',
      onConfirm: () => setDb((prev) => ({ ...prev, prices: [] })) });
  }

  function handleUpdatePrices(): void {
    flash('⚠ Auto cập nhật giá từ Sở XD đang phát triển ở Phase sau (cần API endpoint Sở XD công bố)');
  }

  const filteredNorms = useMemo(() => {
    const q = search.toLowerCase();
    return db.norms.filter((n) => !q || n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q));
  }, [db.norms, search]);
  const filteredPrices = useMemo(() => {
    const q = search.toLowerCase();
    return db.prices.filter((p) => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [db.prices, search]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">Catalog định mức + đơn giá</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className={`btn ${subTab === 'norms' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubTab('norms')}>📚 Định mức ({db.norms.length})</button>
            <button type="button" className={`btn ${subTab === 'prices' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubTab('prices')}>💵 Đơn giá ({db.prices.length})</button>
          </div>
          <input type="text" className="td-input" placeholder="🔍 Tìm theo mã hoặc tên..." style={{ maxWidth: 280 }}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ flex: 1 }} />
          {subTab === 'norms' ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void handleImportNorms()}>📥 Import Excel ĐM</button>
              <button type="button" className="btn btn-ghost" onClick={handleClearNorms} disabled={db.norms.length === 0}>🗑 Xóa</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void handleImportPrices()}>📥 Import Excel giá</button>
              <button type="button" className="btn btn-ghost" onClick={handleUpdatePrices}>🔄 Cập nhật từ Sở XD</button>
              <button type="button" className="btn btn-ghost" onClick={handleClearPrices} disabled={db.prices.length === 0}>🗑 Xóa</button>
            </>
          )}
        </div>

        <div className="atgt-table-wrap" style={{ maxHeight: 480 }}>
          {subTab === 'norms' ? (
            <table className="atgt-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Mã ĐM</th>
                  <th>Tên công việc</th>
                  <th style={{ width: 80 }}>ĐV</th>
                  <th style={{ width: 150 }}>Nhóm</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredNorms.length === 0 ? (
                  <tr><td colSpan={5} className="atgt-empty-row">Chưa có định mức. Import Excel để bắt đầu.</td></tr>
                ) : filteredNorms.map((n) => (
                  <tr key={n.id}>
                    <td><b>{n.code}</b></td>
                    <td>{n.name}</td>
                    <td>{n.donVi}</td>
                    <td className="muted small">{n.category ?? '-'}</td>
                    <td className="muted small">{n.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="atgt-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Mã</th>
                  <th>Tên</th>
                  <th style={{ width: 90 }}>Loại</th>
                  <th style={{ width: 80 }}>ĐV</th>
                  <th style={{ width: 140 }}>Đơn giá (VND)</th>
                  <th>Nguồn</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrices.length === 0 ? (
                  <tr><td colSpan={6} className="atgt-empty-row">Chưa có đơn giá. Import Excel để bắt đầu.</td></tr>
                ) : filteredPrices.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.code}</b></td>
                    <td>{p.name}</td>
                    <td>{p.type === 'vatlieu' ? '🧱 VL' : p.type === 'nhancong' ? '👷 NC' : '🚜 Máy'}</td>
                    <td>{p.donVi}</td>
                    <td style={{ textAlign: 'right' }}>{formatVnd(p.donGia)}</td>
                    <td className="muted small">{p.source ?? p.region ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="muted small" style={{ marginTop: 10 }}>
          💡 Format Excel ĐM: cột "Mã ĐM" | "Tên" | "Đơn vị" | "Nhóm". Format Excel giá: cột "Mã" | "Tên" | "Loại" (VL/NC/Máy) | "Đơn vị" | "Đơn giá".
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// Tab 4: Summary
// =====================================================================

function SummaryTab({ project, onUpdate, flash }: {
  project: EstimateProject;
  onUpdate: (u: (p: EstimateProject) => EstimateProject) => void;
  flash: (m: string) => void;
}): JSX.Element {
  const costs = useMemo(() => calculateCosts(project.workItems, project.factors), [project.workItems, project.factors]);

  function setFactor<K extends keyof CostFactors>(k: K, v: number): void {
    onUpdate((p) => ({ ...p, factors: { ...p.factors, [k]: v } }));
  }
  function reset(): void {
    onUpdate((p) => ({ ...p, factors: defaultCostFactors() }));
    flash('✓ Đã reset hệ số về mặc định');
  }

  async function handleExport(): Promise<void> {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      [`TỔNG HỢP DỰ TOÁN: ${project.name}`],
      [`Công trình: ${project.congTrinh ?? ''}`],
      [`Địa điểm: ${project.diaDiem ?? ''}`],
      [`Ngày lập: ${project.ngayLap ?? ''}`],
      [],
      ['STT', 'Khoản mục', 'Hệ số (%)', 'Giá trị (VND)'],
      [1,  'Vật liệu',          '', costs.vlTotal],
      [2,  'Nhân công',         '', costs.ncTotal],
      [3,  'Máy thi công',      '', costs.mayTotal],
      ['', 'CHI PHÍ TRỰC TIẾP', '', costs.trucTiep],
      [4,  'TLPT (Trực tiếp phí khác)', project.factors.truciepPhiKhac, costs.truciepPhiKhac],
      [5,  'Chi phí chung',     project.factors.chiPhiChung, costs.chiPhiChung],
      [6,  'Thu nhập chịu thuế tính trước', project.factors.thuNhapChiuThueTinhTruoc, costs.thuNhapChiuThueTinhTruoc],
      ['', 'GIÁ TRỊ TRƯỚC VAT', '', costs.giaTriTruocVAT],
      [7,  'Thuế VAT',          project.factors.vat, costs.vat],
      ['', 'GIÁ TRỊ SAU VAT',   '', costs.giaTriSauVAT],
      [8,  'Dự phòng phí',      project.factors.duPhongPhi, costs.duPhongPhi],
      ['', 'TỔNG DỰ TOÁN',      '', costs.tongDuToan],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Tổng hợp');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safe = project.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: 'Lưu tổng hợp dự toán', defaultPath: `TongHop_${safe}_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất tổng hợp dự toán');
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Tổng hợp chi phí</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="TLPT (%)"><input type="number" step={0.1} className="td-input" value={project.factors.truciepPhiKhac} onChange={(e) => setFactor('truciepPhiKhac', Number(e.target.value) || 0)} /></Field>
          <Field label="Chi phí chung (%)"><input type="number" step={0.1} className="td-input" value={project.factors.chiPhiChung} onChange={(e) => setFactor('chiPhiChung', Number(e.target.value) || 0)} /></Field>
          <Field label="TN chịu thuế tính trước (%)"><input type="number" step={0.1} className="td-input" value={project.factors.thuNhapChiuThueTinhTruoc} onChange={(e) => setFactor('thuNhapChiuThueTinhTruoc', Number(e.target.value) || 0)} /></Field>
          <Field label="VAT (%)"><input type="number" step={0.1} className="td-input" value={project.factors.vat} onChange={(e) => setFactor('vat', Number(e.target.value) || 0)} /></Field>
          <Field label="Dự phòng (%)"><input type="number" step={0.1} className="td-input" value={project.factors.duPhongPhi} onChange={(e) => setFactor('duPhongPhi', Number(e.target.value) || 0)} /></Field>
        </div>
        <div className="td-action-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={reset}>🔄 Reset hệ số mặc định</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleExport()}>📊 Xuất tổng hợp Excel</button>
        </div>

        <div className="est-summary" style={{ marginTop: 16 }}>
          <Row label="① Vật liệu" value={costs.vlTotal} />
          <Row label="② Nhân công" value={costs.ncTotal} />
          <Row label="③ Máy thi công" value={costs.mayTotal} />
          <Row label="CHI PHÍ TRỰC TIẾP (①+②+③)" value={costs.trucTiep} bold />
          <Row label={`④ TLPT (${project.factors.truciepPhiKhac}%)`} value={costs.truciepPhiKhac} />
          <Row label={`⑤ Chi phí chung (${project.factors.chiPhiChung}%)`} value={costs.chiPhiChung} />
          <Row label={`⑥ Thu nhập chịu thuế tính trước (${project.factors.thuNhapChiuThueTinhTruoc}%)`} value={costs.thuNhapChiuThueTinhTruoc} />
          <Row label="GIÁ TRỊ TRƯỚC VAT" value={costs.giaTriTruocVAT} bold />
          <Row label={`⑦ Thuế VAT (${project.factors.vat}%)`} value={costs.vat} />
          <Row label="GIÁ TRỊ SAU VAT" value={costs.giaTriSauVAT} bold />
          <Row label={`⑧ Dự phòng phí (${project.factors.duPhongPhi}%)`} value={costs.duPhongPhi} />
          <Row label="TỔNG DỰ TOÁN" value={costs.tongDuToan} bold large />
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, bold, large }: { label: string; value: number; bold?: boolean; large?: boolean }): JSX.Element {
  return (
    <div className={`est-row${bold ? ' est-row-bold' : ''}${large ? ' est-row-large' : ''}`}>
      <span className="est-row-label">{label}</span>
      <span className="est-row-value">{formatVnd(value)} ₫</span>
    </div>
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
      const v = input.trim(); if (!v) return;
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
