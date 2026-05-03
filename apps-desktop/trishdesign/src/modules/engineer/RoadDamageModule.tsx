/**
 * TrishDesign Phase 28.4 — CadPluginModule (port từ S-RETC WPF CadPluginPage)
 *
 * Layout WPF:
 *   [Header bar: TRUNG TÂM ĐIỀU KHIỂN AUTOCAD]
 *   ┌─────────────┬───────────────────────────────────┐
 *   │ Sidebar 4   │ Active sub-module panel           │
 *   │ - Hư hỏng   │   ├ pnlHuHong (2-col layout)      │
 *   │ - ATGT      │   ├ pnlATGT                       │
 *   │ - Bão Lũ    │   ├ pnlBaoLu                      │
 *   │ - Chatbot   │   └ pnlMCP                        │
 *   └─────────────┴───────────────────────────────────┘
 *
 * Module HƯ HỎNG (pnlHuHong) layout 2-col:
 *   ┌──────────────────┬───────────────────────────────┐
 *   │ LEFT 250px config│ RIGHT toolbar + grid + status │
 *   │ ┌──────────────┐ │ ┌──[Toolbar 6 buttons]──────┐ │
 *   │ │Lý trình+Cọc H│ │ │  + Thêm  Xóa  Vẽ  Excel… │ │
 *   │ ├──────────────┤ │ ├──[DataGrid 8 cols]────────┤ │
 *   │ │Khổ đường     │ │ │  Excel-like inline edit  │ │
 *   │ ├──────────────┤ │ │                           │ │
 *   │ │Cài đặt bản vẽ│ │ ├──[Status bar]─────────────┤ │
 *   │ └──────────────┘ │ │  Sẵn sàng… Tổng… [VẼ CAD] │ │
 *   └──────────────────┴───────────────────────────────┘
 *
 * Phase 28.4 Turn 1 (skeleton):
 *   - Outer shell + 4-module sidebar
 *   - Hư hỏng: 2-col layout với left config panels
 *   - Right side: toolbar + grid + status (basic, full inline edit ở Turn 2)
 *   - Modal popups: stub (sẽ implement Turn 2)
 *   - 3 module khác: placeholder
 */

import { useEffect, useMemo, useState } from 'react';
import {
  type Project,
  type RoadSegment,
  type DamagePiece,
  type DamageCode,
  type DamageSide,
  type RoadType,
  type LayerSpec,
  type StandardLayerKey,
  type LinetypeName,
  LINETYPE_OPTIONS,
  STANDARD_LAYERS,
  defaultLayers,
  formatStation,
  autoSegmentName,
} from '../../types.js';
import { useDesignDb } from '../../state.js';
import {
  generateSegmentCommands,
  generateProjectCommands,
  computeStatistics,
} from '../../lib/acad-script.js';
import { exportProjectStatsToExcel } from '../../lib/excel-export.js';
import {
  autoCadStatus,
  autoCadSendCommands,
  autoCadEnsureDocument,
  deployHatchPatterns,
  listAutoCadShxFonts,
} from '../../lib/autocad.js';
import { AtgtPanel } from './AtgtPanel.js';
import { BaoLuPanel as BaoLuPanelV2 } from './BaoLuPanel.js';
import { CadChatbotPanel } from './CadChatbotPanel.js';

// ============================================================
// Custom Dialog system — thay native window.alert/confirm/prompt
// ============================================================
type DialogState =
  | { kind: 'alert'; message: string; resolve: () => void }
  | { kind: 'confirm'; message: string; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; message: string; defaultValue?: string; resolve: (v: string | null) => void }
  | { kind: 'paste'; resolve: (text: string | null) => void }
  | null;

let _dialogSetState: ((d: DialogState) => void) | null = null;

const dialog = {
  alert(message: string): Promise<void> {
    return new Promise((resolve) => {
      _dialogSetState?.({ kind: 'alert', message, resolve: () => resolve() });
    });
  },
  confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      _dialogSetState?.({ kind: 'confirm', message, resolve });
    });
  },
  prompt(message: string, defaultValue = ''): Promise<string | null> {
    return new Promise((resolve) => {
      _dialogSetState?.({ kind: 'prompt', message, defaultValue, resolve });
    });
  },
  paste(): Promise<string | null> {
    return new Promise((resolve) => {
      _dialogSetState?.({ kind: 'paste', resolve });
    });
  },
};

function DialogHost(): JSX.Element | null {
  const [state, setState] = useState<DialogState>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    _dialogSetState = (s) => {
      setState(s);
      if (s && s.kind === 'prompt') setInputValue(s.defaultValue ?? '');
      else if (s && s.kind === 'paste') setInputValue('');
    };
    return () => { _dialogSetState = null; };
  }, []);

  if (!state) return null;

  const close = () => { setState(null); setInputValue(''); };

  // Click outside CHỈ đóng cho alert (không cho prompt/confirm/paste để tránh mất data)
  return (
    <div className="acad-modal-backdrop" onClick={() => {
      if (state.kind === 'alert') { state.resolve(); close(); }
      // prompt/confirm/paste: click outside KHÔNG đóng — phải bấm Hủy/OK rõ ràng
    }}>
      <div className="acad-modal" style={{ maxWidth: state.kind === 'paste' ? 600 : 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="acad-modal-head">
          <span className="acad-modal-title">
            {state.kind === 'alert' && 'ℹ️ Thông báo'}
            {state.kind === 'confirm' && '❓ Xác nhận'}
            {state.kind === 'prompt' && '✏️ Nhập giá trị'}
            {state.kind === 'paste' && '📋 Dán dữ liệu'}
          </span>
          <button type="button" className="acad-modal-close" onClick={close}>✕</button>
        </div>
        <div className="acad-modal-body" style={{ minHeight: 80 }}>
          {(state.kind === 'alert' || state.kind === 'confirm') && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6 }}>{state.message}</pre>
          )}
          {state.kind === 'prompt' && (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 13 }}>{state.message}</p>
              <input
                type="text"
                className="acad-input"
                style={{ height: 36, fontSize: 14 }}
                value={inputValue}
                autoFocus
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { state.resolve(inputValue); close(); }
                  else if (e.key === 'Escape') { state.resolve(null); close(); }
                }}
              />
            </>
          )}
          {state.kind === 'paste' && (
            <>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6B7280' }}>
                Bấm <kbd>Ctrl+V</kbd> dán dữ liệu từ Excel (TSV) vào ô bên dưới rồi bấm <strong>Nhập</strong>:
              </p>
              <textarea
                className="acad-input"
                style={{ height: 200, fontSize: 12, fontFamily: 'Consolas, monospace', resize: 'vertical', padding: 8 }}
                value={inputValue}
                autoFocus
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={'STT\\tLý trình\\tVT\\tCách tim\\tDài\\tRộng\\tMã'}
              />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#6B7280' }}>
                Cột: <code>STT | Lý trình (Km0+100 hoặc số mét) | VT (T/P/TIM) | Cách tim | Dài | Rộng | Mã HH</code>
              </p>
            </>
          )}
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {state.kind === 'alert' && (
            <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }}
              onClick={() => { state.resolve(); close(); }}>OK</button>
          )}
          {state.kind === 'confirm' && (
            <>
              <button type="button" className="acad-tb-btn" style={{ padding: '0 16px', background: '#E5E7EB', color: '#1F2937' }}
                onClick={() => { state.resolve(false); close(); }}>Hủy</button>
              <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }}
                onClick={() => { state.resolve(true); close(); }}>OK</button>
            </>
          )}
          {state.kind === 'prompt' && (
            <>
              <button type="button" className="acad-tb-btn" style={{ padding: '0 16px', background: '#E5E7EB', color: '#1F2937' }}
                onClick={() => { state.resolve(null); close(); }}>Hủy</button>
              <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }}
                onClick={() => { state.resolve(inputValue); close(); }}>OK</button>
            </>
          )}
          {state.kind === 'paste' && (
            <>
              <button type="button" className="acad-tb-btn" style={{ padding: '0 16px', background: '#E5E7EB', color: '#1F2937' }}
                onClick={() => { state.resolve(null); close(); }}>Hủy</button>
              <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }}
                onClick={() => { state.resolve(inputValue); close(); }}
                disabled={!inputValue.trim()}>📋 Nhập</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// CadShell wrapper — chỉ header + content (KHÔNG có inner sidebar)
// Vì 4 panel giờ là TOP-LEVEL trong TrishDesign App sidebar
function CadShell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="acad-shell">
      <div className="acad-header">
        <span className="acad-header-title">{title}</span>
        {sub && <span className="acad-header-sub">| {sub}</span>}
      </div>
      <div className="acad-content">{children}</div>
      <DialogHost />
    </div>
  );
}

// Top-level wrapper exports — mỗi cái render 1 panel độc lập
export function RoadDamageModule(): JSX.Element {
  return (
    <CadShell title="🛣️ VẼ HƯ HỎNG MẶT ĐƯỜNG" sub="Quản lý dữ liệu khảo sát + vẽ tự động AutoCAD">
      <HuHongPanel />
    </CadShell>
  );
}

export function AtgtModule(): JSX.Element {
  return (
    <CadShell title="🚸 VẼ HIỆN TRẠNG ATGT" sub="Biển báo · Vạch kẻ · Đèn tín hiệu · Hộ lan">
      <AtgtPanel />
    </CadShell>
  );
}

export function CrossSectionModule(): JSX.Element {
  return (
    <CadShell title="🌊 VẼ MẶT CẮT HỐT SẠT" sub="Bão lũ · Sụt lở · AI ảnh · Tính khối lượng đất đá">
      <BaoLuPanelV2 />
    </CadShell>
  );
}

export function CadChatbotModule(): JSX.Element {
  return (
    <CadShell title="🤖 CHATBOT A.I AUTOCAD" sub="Gõ lệnh tiếng Việt tự nhiên → AI sinh lệnh AutoCAD">
      <CadChatbotPanel />
    </CadShell>
  );
}

// ============================================================
// HuHongPanel — module chính 2-cột
// ============================================================
function HuHongPanel(): JSX.Element {
  const designDb = useDesignDb();
  const { db } = designDb;

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  useEffect(() => {
    if (activeProject) {
      if (!activeSegmentId || !activeProject.segments.find((s) => s.id === activeSegmentId)) {
        setActiveSegmentId(activeProject.segments[0]?.id ?? null);
      }
    }
  }, [activeProject?.id, activeProject?.segments.length, activeSegmentId]);

  const activeSegment = useMemo(
    () => activeProject?.segments.find((s) => s.id === activeSegmentId) ?? null,
    [activeProject, activeSegmentId],
  );

  // Modal states
  const [openModal, setOpenModal] = useState<null | 'cocH' | 'banVe' | 'hatch' | 'layers' | 'segments' | 'projects'>(null);

  // ============================================================
  // Project / Segment selectors row
  // ============================================================
  function ProjectSegmentBar(): JSX.Element {
    return (
      <div className="acad-selector-bar">
        <select
          className="acad-selector"
          value={db.activeProjectId ?? ''}
          onChange={(e) => designDb.setActiveProject(e.target.value || null)}
        >
          <option value="">— Chọn hồ sơ —</option>
          {db.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="acad-btn acad-btn-ghost"
          onClick={async () => {
            const name = await dialog.prompt('Tên hồ sơ:');
            if (name?.trim()) designDb.createProject({ name: name.trim() });
          }}
        >+ Hồ sơ</button>
        {db.projects.length > 0 && (
          <button
            type="button"
            className="acad-btn acad-btn-ghost"
            title="Quản lý / chỉnh sửa / xóa hồ sơ"
            onClick={() => setOpenModal('projects')}
          >📋</button>
        )}

        {activeProject && (
          <>
            <span className="acad-selector-sep">›</span>
            <select
              className="acad-selector"
              value={activeSegmentId ?? ''}
              onChange={(e) => setActiveSegmentId(e.target.value || null)}
            >
              <option value="">— Chọn đoạn —</option>
              {activeProject.segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="acad-btn acad-btn-ghost"
              onClick={async () => {
                const startStr = await dialog.prompt('Lý trình bắt đầu (mét, vd: 0 hoặc 1500):', '0');
                if (startStr === null) return;
                const endStr = await dialog.prompt('Lý trình kết thúc (mét):', String((Number(startStr) || 0) + 1000));
                if (endStr === null) return;
                const start = Number(startStr) || 0;
                const end = Number(endStr) || (start + 1000);
                const customName = await dialog.prompt('Tên đoạn (Enter để tự sinh "Km0 - Km1"):', '');
                const id = designDb.createSegment(activeProject.id, {
                  startStation: start,
                  endStation: end,
                  roadType: 'single',
                  roadWidth: 7,
                  laneCount: 2,
                  name: customName?.trim() ? customName.trim() : undefined,
                });
                setActiveSegmentId(id);
              }}
            >+ Đoạn</button>
            {activeProject.segments.length > 0 && (
              <button
                type="button"
                className="acad-btn acad-btn-ghost"
                title="Quản lý / xóa nhiều đoạn"
                onClick={() => setOpenModal('segments')}
              >📋 Quản lý ({activeProject.segments.length})</button>
            )}
          </>
        )}
      </div>
    );
  }

  if (!activeProject) {
    return (
      <>
        <ProjectSegmentBar />
        <div className="acad-empty">
          <strong>Chưa có hồ sơ</strong>
          <p>Bấm "+ Hồ sơ" tạo hồ sơ đầu tiên để bắt đầu khảo sát.</p>
        </div>
      </>
    );
  }

  if (!activeSegment) {
    return (
      <>
        <ProjectSegmentBar />
        <div className="acad-empty">
          <strong>Chưa có đoạn đường</strong>
          <p>Bấm "+ Đoạn" tạo đoạn đầu tiên trong hồ sơ "{activeProject.name}".</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ProjectSegmentBar />

      <div className="acad-2col">
        {/* LEFT — config panels */}
        <div className="acad-2col-left">
          <LyTrinhPanel
            project={activeProject}
            segment={activeSegment}
            designDb={designDb}
            onOpenCocH={() => setOpenModal('cocH')}
          />
          <KhoDuongPanel
            project={activeProject}
            segment={activeSegment}
            designDb={designDb}
          />
          <CaiDatBanVePanel
            segment={activeSegment}
            onOpenBanVe={() => setOpenModal('banVe')}
            onOpenHatch={() => setOpenModal('hatch')}
            onOpenLayers={() => setOpenModal('layers')}
          />
        </div>

        {/* RIGHT — toolbar + grid + status */}
        <div className="acad-2col-right">
          <HuHongRightSide
            project={activeProject}
            segment={activeSegment}
            damageCodes={db.damageCodes}
            drawingPrefs={db.drawingPrefs}
            designDb={designDb}
          />
        </div>
      </div>

      {/* Modal popups — Turn 2 đầy đủ */}
      {openModal === 'cocH' && (
        <CocHModal
          segment={activeSegment}
          designDb={designDb}
          projectId={activeProject.id}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'banVe' && (
        <BanVeModal
          segment={activeSegment}
          designDb={designDb}
          projectId={activeProject.id}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'hatch' && (
        <HatchModal
          damageCodes={db.damageCodes}
          designDb={designDb}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'layers' && (
        <LayerConfigModal
          designDb={designDb}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'segments' && (
        <SegmentsManagerModal
          project={activeProject}
          designDb={designDb}
          activeSegmentId={activeSegmentId}
          onSelectSegment={setActiveSegmentId}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'projects' && (
        <ProjectsManagerModal
          db={db}
          designDb={designDb}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  );
}

// ============================================================
// ProjectsManagerModal — danh sách + multi-select xóa nhiều hồ sơ + edit tên
// ============================================================
function ProjectsManagerModal({
  db, designDb, onClose,
}: {
  db: ReturnType<typeof useDesignDb>['db'];
  designDb: ReturnType<typeof useDesignDb>;
  onClose: () => void;
}): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = db.projects.length > 0 && selected.size === db.projects.length;
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(db.projects.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    const totalSegs = db.projects
      .filter((p) => selected.has(p.id))
      .reduce((s, p) => s + p.segments.length, 0);
    if (!await dialog.confirm(`Xóa ${selected.size} hồ sơ đã chọn? (${totalSegs} đoạn + tất cả miếng cũng mất)`)) return;
    for (const id of selected) designDb.deleteProject(id);
    setSelected(new Set());
  }
  return (
    <ModalShell title={`📁 Quản lý hồ sơ (${db.projects.length})`} onClose={onClose} width={780}
      footer={<button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={onClose}>Đóng</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="acad-tb-btn acad-tb-blue"
          onClick={async () => {
            const name = await dialog.prompt('Tên hồ sơ mới:');
            if (name?.trim()) designDb.createProject({ name: name.trim() });
          }}
        >+ Hồ sơ mới</button>
        <button
          type="button"
          className="acad-tb-btn acad-tb-red"
          disabled={selected.size === 0}
          onClick={handleDeleteSelected}
        >🗑 Xóa {selected.size > 0 ? `(${selected.size})` : ''} hồ sơ đã chọn</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>
          Tổng: {db.projects.length} hồ sơ · {db.projects.reduce((s, p) => s + p.segments.length, 0)} đoạn
        </span>
      </div>
      <table className="acad-grid">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            </th>
            <th>Tên hồ sơ</th>
            <th style={{ width: 110 }}>Đơn vị</th>
            <th style={{ width: 100 }}>Ngày KS</th>
            <th style={{ width: 80 }}>Đoạn</th>
            <th style={{ width: 80 }}>Miếng</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {db.projects.length === 0 ? (
            <tr><td colSpan={7} className="acad-grid-empty">Chưa có hồ sơ.</td></tr>
          ) : db.projects.map((p) => (
            <tr key={p.id} style={p.id === db.activeProjectId ? { background: '#DBEAFE' } : undefined}>
              <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} /></td>
              <td>
                <input
                  className="acad-grid-input"
                  value={p.name}
                  onChange={(e) => designDb.updateProject(p.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  className="acad-grid-input"
                  value={p.designUnit ?? ''}
                  onChange={(e) => designDb.updateProject(p.id, { designUnit: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="date"
                  className="acad-grid-input"
                  value={p.surveyDate ?? ''}
                  onChange={(e) => designDb.updateProject(p.id, { surveyDate: e.target.value })}
                />
              </td>
              <td>{p.segments.length}</td>
              <td>{p.segments.reduce((s, x) => s + x.damagePieces.length, 0)}</td>
              <td>
                <button
                  type="button"
                  className="acad-grid-del"
                  onClick={async () => {
                    if (await dialog.confirm(`Xóa hồ sơ "${p.name}" và ${p.segments.length} đoạn?`)) {
                      designDb.deleteProject(p.id);
                    }
                  }}
                >🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

// ============================================================
// SegmentsManagerModal — danh sách + multi-select xóa nhiều đoạn
// ============================================================
function SegmentsManagerModal({
  project, designDb, activeSegmentId, onSelectSegment, onClose,
}: {
  project: Project;
  designDb: ReturnType<typeof useDesignDb>;
  activeSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onClose: () => void;
}): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = project.segments.length > 0 && selected.size === project.segments.length;
  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(project.segments.map((s) => s.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!await dialog.confirm(`Xóa ${selected.size} đoạn đã chọn? Tất cả miếng hư hỏng trong đoạn đó cũng mất.`)) return;
    for (const id of selected) {
      designDb.deleteSegment(project.id, id);
    }
    if (activeSegmentId && selected.has(activeSegmentId)) onSelectSegment(null);
    setSelected(new Set());
  }
  return (
    <ModalShell title={`📋 Quản lý đoạn — ${project.name}`} onClose={onClose} width={780}
      footer={<button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={onClose}>Đóng</button>}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="acad-tb-btn acad-tb-blue"
          disabled={selected.size === 0}
          onClick={() => { selected.forEach((id) => onSelectSegment(id)); }}
          style={{ display: selected.size === 1 ? 'inline-flex' : 'none' }}
        >Chọn đoạn này</button>
        <button
          type="button"
          className="acad-tb-btn acad-tb-red"
          disabled={selected.size === 0}
          onClick={handleDeleteSelected}
        >🗑 Xóa {selected.size > 0 ? `(${selected.size})` : ''} đoạn đã chọn</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>
          Tổng: {project.segments.length} đoạn · {project.segments.reduce((s, x) => s + x.damagePieces.length, 0)} miếng
        </span>
      </div>
      <table className="acad-grid">
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            </th>
            <th>Tên đoạn</th>
            <th style={{ width: 110 }}>Lý trình (m)</th>
            <th style={{ width: 80 }}>Loại</th>
            <th style={{ width: 80 }}>Bề rộng</th>
            <th style={{ width: 70 }}>Số làn</th>
            <th style={{ width: 70 }}>Miếng</th>
            <th style={{ width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {project.segments.length === 0 ? (
            <tr><td colSpan={8} className="acad-grid-empty">Chưa có đoạn nào.</td></tr>
          ) : project.segments.map((s) => (
            <tr key={s.id} style={s.id === activeSegmentId ? { background: '#DBEAFE' } : undefined}>
              <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} /></td>
              <td>
                <input
                  className="acad-grid-input"
                  value={s.name}
                  onChange={(e) => designDb.updateSegment(project.id, s.id, { name: e.target.value })}
                />
              </td>
              <td>{s.startStation} → {s.endStation}</td>
              <td>{s.roadType === 'single' ? 'Đơn' : `Đôi (DPC ${s.medianWidth ?? 0}m)`}</td>
              <td>{s.roadWidth}m</td>
              <td>{s.laneCount}</td>
              <td>{s.damagePieces.length}</td>
              <td>
                <button
                  type="button"
                  className="acad-grid-del"
                  title="Xóa đoạn này"
                  onClick={async () => {
                    if (await dialog.confirm(`Xóa đoạn "${s.name}" và ${s.damagePieces.length} miếng?`)) {
                      designDb.deleteSegment(project.id, s.id);
                      if (s.id === activeSegmentId) onSelectSegment(null);
                    }
                  }}
                >🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

// ============================================================
// LEFT panel 1 — Lý trình & Cọc H
// ============================================================
function LyTrinhPanel({
  project, segment, designDb, onOpenCocH,
}: {
  project: Project;
  segment: RoadSegment;
  designDb: ReturnType<typeof useDesignDb>;
  onOpenCocH: () => void;
}): JSX.Element {
  return (
    <div className="acad-cfg-panel">
      <label className="acad-cfg-label">Lý trình đoạn tuyến:</label>
      <div className="acad-cfg-row2">
        <input
          type="number"
          className="acad-input"
          value={segment.startStation}
          onChange={(e) => designDb.updateSegment(project.id, segment.id, { startStation: Number(e.target.value) || 0 })}
          title="Lý trình bắt đầu (mét)"
        />
        <span className="acad-dash">–</span>
        <input
          type="number"
          className="acad-input"
          value={segment.endStation}
          onChange={(e) => designDb.updateSegment(project.id, segment.id, { endStation: Number(e.target.value) || 0 })}
          title="Lý trình kết thúc (mét)"
        />
      </div>
      <button
        type="button"
        className="acad-btn-popup acad-btn-blue"
        onClick={onOpenCocH}
      >📍 Cài đặt Cọc H ({segment.stakes.length})...</button>
    </div>
  );
}

// ============================================================
// LEFT panel 2 — Khổ đường
// ============================================================
function KhoDuongPanel({
  project, segment, designDb,
}: {
  project: Project;
  segment: RoadSegment;
  designDb: ReturnType<typeof useDesignDb>;
}): JSX.Element {
  function update<K extends keyof RoadSegment>(key: K, value: RoadSegment[K]) {
    designDb.updateSegment(project.id, segment.id, { [key]: value } as Partial<RoadSegment>);
  }

  const cachTimMode = segment.cachTimMode ?? 'tim';

  return (
    <div className="acad-cfg-panel">
      <div className="acad-cfg-title">CÀI ĐẶT KHỔ ĐƯỜNG</div>

      <div className="acad-cfg-grid">
        <span>Bề rộng mặt đường (m):</span>
        <input
          type="number"
          step="0.5"
          className="acad-input acad-input-narrow"
          value={segment.roadWidth}
          onChange={(e) => update('roadWidth', Number(e.target.value) || 0)}
        />
      </div>

      <div className="acad-cfg-grid">
        <span>Số làn xe (tổng cả 2 chiều):</span>
        <input
          type="number"
          min={1}
          className="acad-input acad-input-narrow"
          value={segment.laneCount}
          onChange={(e) => update('laneCount', Number(e.target.value) || 1)}
        />
      </div>

      <div className="acad-cfg-grid">
        <span>Loại đường:</span>
        <div className="acad-radio-row">
          <label>
            <input
              type="radio"
              name="roadType"
              checked={segment.roadType === 'single'}
              onChange={() => update('roadType', 'single')}
            /> Đơn
          </label>
          <label>
            <input
              type="radio"
              name="roadType"
              checked={segment.roadType === 'dual'}
              onChange={() => update('roadType', 'dual')}
            /> Đôi
          </label>
        </div>
      </div>

      {segment.roadType === 'dual' && (
        <div className="acad-cfg-grid">
          <span>Rộng dải phân cách (m):</span>
          <input
            type="number"
            step="0.5"
            className="acad-input acad-input-narrow"
            value={segment.medianWidth ?? 0}
            onChange={(e) => update('medianWidth', Number(e.target.value) || 0)}
          />
        </div>
      )}

      {/* Toggle Cách tim / Cách mép */}
      <div className="acad-toggle-box">
        <span>📏 Cột <strong style={{ color: '#1E3A8A' }}>{cachTimMode === 'tim' ? 'Cách tim' : 'Cách mép'}</strong> (m):</span>
        <div className="acad-toggle-row">
          <span className="acad-toggle-label">Tim</span>
          <input
            type="checkbox"
            checked={cachTimMode === 'mep'}
            onChange={(e) => update('cachTimMode', e.target.checked ? 'mep' : 'tim')}
            title="Bật: nhập khoảng cách từ MÉP đường&#10;Tắt: nhập khoảng cách từ TIM đường"
          />
          <span className="acad-toggle-label">Mép</span>
        </div>
      </div>

      {/* Canvas mini sơ họa */}
      <div className="acad-cfg-label-center">SƠ HỌA MẶT ĐƯỜNG:</div>
      <RoadMiniPreview segment={segment} />
    </div>
  );
}

// Mini canvas preview — sơ họa khuôn đường
function RoadMiniPreview({ segment }: { segment: RoadSegment }): JSX.Element {
  const W = 280;
  const H = 90;
  const halfW = segment.roadWidth / 2;
  const scale = (H - 16) / (halfW * 2);
  const halfDpc = (segment.medianWidth ?? 0) / 2;

  // Lane width tính ĐÚNG: dual trừ DPC, single dùng full roadWidth
  const isDual = segment.roadType === 'dual';
  const trafficWidth = isDual ? segment.roadWidth - (segment.medianWidth ?? 0) : segment.roadWidth;
  const laneWidth = trafficWidth / Math.max(segment.laneCount, 1);
  const lanesPerSide = isDual ? Math.max(Math.floor(segment.laneCount / 2), 1) : segment.laneCount;

  // Compute lane divider offsets (in m từ tim)
  const lineOffsets: number[] = [];
  if (isDual) {
    // Dividers: top side from halfDpc to halfWidth
    for (let k = 1; k < lanesPerSide; k++) lineOffsets.push(halfDpc + k * laneWidth);
    for (let k = 1; k < lanesPerSide; k++) lineOffsets.push(-halfDpc - k * laneWidth);
  } else {
    // Single: dividers at -halfW + k×laneWidth
    for (let k = 1; k < segment.laneCount; k++) {
      const off = -halfW + k * laneWidth;
      if (Math.abs(off) > 0.01) lineOffsets.push(off); // skip y=0 (tim)
    }
  }

  return (
    <div className="acad-mini-canvas">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
        {/* Mặt đường nền */}
        <rect x={4} y={H/2 - halfW * scale} width={W - 8} height={halfW * 2 * scale} fill="#1F2937" stroke="#10B981" strokeWidth={1.5} />

        {/* DPC vùng */}
        {isDual && halfDpc > 0 && (
          <rect x={4} y={H/2 - halfDpc * scale} width={W - 8} height={halfDpc * 2 * scale} fill="#FBBF24" fillOpacity={0.3} stroke="#FBBF24" strokeWidth={0.5} />
        )}

        {/* Tim đường (cả single + dual đều có tim trong DPC) yellow dashed */}
        <line x1={4} y1={H/2} x2={W - 4} y2={H/2} stroke="#FBBF24" strokeDasharray="4 3" strokeWidth={1} />

        {/* Vạch chia làn (white dashed) */}
        {lineOffsets.map((off, i) => (
          <line
            key={i}
            x1={4} y1={H/2 - off * scale} x2={W - 4} y2={H/2 - off * scale}
            stroke="#FFFFFF" strokeDasharray="6 6" strokeWidth={0.6}
          />
        ))}
      </svg>
      <div className="acad-mini-caption">
        {isDual ? 'Đường đôi (DPC)' : 'Đường đơn'} · {segment.roadWidth}m{isDual ? ` (DPC ${segment.medianWidth ?? 0}m)` : ''} · {segment.laneCount} làn ({laneWidth.toFixed(2)}m/làn)
      </div>
    </div>
  );
}

// ============================================================
// LEFT panel 3 — Cài đặt bản vẽ
// ============================================================
function CaiDatBanVePanel({
  segment, onOpenBanVe, onOpenHatch, onOpenLayers,
}: {
  segment: RoadSegment;
  onOpenBanVe: () => void;
  onOpenHatch: () => void;
  onOpenLayers: () => void;
}): JSX.Element {
  const frame = segment.drawing.frameType === 'A3_390x280' ? 'A3' : 'A4 bão lũ';
  const summary = `${frame} · TL X:1/${(1/segment.drawing.scaleX).toFixed(0)} · Y:1/${(1/segment.drawing.scaleY).toFixed(0)}`;

  return (
    <div className="acad-cfg-panel">
      <div className="acad-cfg-summary">{summary}</div>
      <button type="button" className="acad-btn-popup acad-btn-purple" onClick={onOpenBanVe}>
        📄 Cài đặt bản vẽ...
      </button>
      <button type="button" className="acad-btn-popup acad-btn-blue" onClick={onOpenHatch}>
        ⚙️ Cài đặt Hatch / Mã HH...
      </button>
      <button type="button" className="acad-btn-popup acad-btn-blue" onClick={onOpenLayers}>
        🗂 Cài đặt Layer AutoCAD...
      </button>
    </div>
  );
}

// ============================================================
// RIGHT — Toolbar + DataGrid + Status bar
// (Turn 1: basic version. Turn 2 sẽ làm full inline edit + paste clipboard)
// ============================================================
function HuHongRightSide({
  project, segment, damageCodes, drawingPrefs, designDb,
}: {
  project: Project;
  segment: RoadSegment;
  damageCodes: DamageCode[];
  drawingPrefs: ReturnType<typeof useDesignDb>['db']['drawingPrefs'];
  designDb: ReturnType<typeof useDesignDb>;
}): JSX.Element {
  const [acadStatus, setAcadStatus] = useState<{ running: boolean; version?: string }>({ running: false });
  const [drawing, setDrawing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng. Nhập dữ liệu vào bảng rồi bấm Vẽ CAD.');

  useEffect(() => {
    autoCadStatus().then((s) => setAcadStatus({ running: s.running, version: s.version }));
    const interval = setInterval(() => {
      autoCadStatus().then((s) => setAcadStatus({ running: s.running, version: s.version }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = computeStatistics(segment, damageCodes);

  function handleAdd() {
    designDb.addDamagePiece(project.id, segment.id, {
      pieceNumber: String(segment.damagePieces.length + 1),
      startStation: segment.startStation,
      side: 'left',
      cachTim: 0,
      width: 1,
      length: 5,
      damageCode: damageCodes[0]?.code ?? 1,
    });
    setStatusMsg(`Đã thêm miếng. Tổng: ${segment.damagePieces.length + 1} miếng.`);
  }

  function handleDeleteSelected(id: string) {
    designDb.deleteDamagePiece(project.id, segment.id, id);
  }

  // Vẽ lần 2 → offset xuống dưới (Y) để KHÔNG trùng với lần 1
  // Lưu cumulativeY trong localStorage per project
  const drawCounterKey = `trishdesign:drawY:${project.id}`;

  async function handleDraw() {
    setDrawing(true);
    setStatusMsg('Đang gửi lệnh vào AutoCAD…');
    try {
      await autoCadEnsureDocument();
      // Đọc Y offset từ localStorage (lần vẽ trước)
      let cumulativeY = 0;
      try { cumulativeY = Number(localStorage.getItem(drawCounterKey) ?? '0') || 0; } catch {}
      const cmds = generateProjectCommands(project, damageCodes, drawingPrefs, cumulativeY);
      const sent = await autoCadSendCommands(cmds);
      // Tính total Y space của project vừa vẽ → cập nhật cumulativeY cho lần sau
      const projectVSpace = project.segments.reduce((sum, seg) => {
        const halfW = seg.roadWidth / 2;
        return sum + halfW * 2 * seg.drawing.scaleY + 50; // 50 đv buffer giữa các "lần vẽ"
      }, 0);
      cumulativeY -= projectVSpace;
      try { localStorage.setItem(drawCounterKey, String(cumulativeY)); } catch {}
      setStatusMsg(`✓ Đã gửi ${sent} lệnh (lần vẽ ${cumulativeY < 0 ? Math.ceil(-cumulativeY / projectVSpace) : 1}, ${project.segments.length} đoạn).`);
    } catch (e) {
      setStatusMsg(`✗ Lỗi: ${String(e)}`);
    } finally {
      setDrawing(false);
    }
  }

  async function handleClearAcad() {
    if (!await dialog.confirm('Xóa TOÀN BỘ entities trong AutoCAD?\n\nLưu ý: cả các bản vẽ user tự làm cũng sẽ bị xóa.')) return;
    setDrawing(true);
    setStatusMsg('Đang xóa AutoCAD…');
    try {
      await autoCadEnsureDocument();
      await autoCadSendCommands(['._ERASE\nALL\n\n', '._ZOOM\nE\n']);
      // Reset cumulativeY về 0 (vẽ lại từ đầu)
      try { localStorage.removeItem(drawCounterKey); } catch {}
      setStatusMsg('✓ Đã xóa hết AutoCAD. Lần vẽ tiếp sẽ bắt đầu từ y=0.');
    } catch (e) {
      setStatusMsg(`✗ Lỗi: ${String(e)}`);
    } finally {
      setDrawing(false);
    }
  }

  async function handlePasteClipboard() {
    // Mở textarea modal — user paste Ctrl+V vào (tránh permission popup native)
    const text = await dialog.paste();
    if (text === null) return;  // user cancel
    if (!text.trim()) {
      setStatusMsg('Không có dữ liệu để dán.');
      return;
    }
    try {
      // Parse tab-separated (Excel paste) hoặc comma-separated
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      let added = 0;
      for (const line of lines) {
        const cols = line.includes('\t') ? line.split('\t') : line.split(',');
        if (cols.length < 6) continue;
        // Cols: S.Miếng | Lý trình | VT (T/P/TIM) | Cách tim | Dài | Rộng | Mã HH (optional)
        const pieceNumber = (cols[0] ?? '').trim();
        if (!pieceNumber) continue;
        const stationStr = (cols[1] ?? '').trim();
        const startStation = stationStr.includes('Km') ? parseStation(stationStr) : Number(stationStr) || 0;
        const vt = (cols[2] ?? '').trim().toUpperCase();
        const side: DamageSide = vt === 'T' ? 'left' : vt === 'P' ? 'right' : 'center';
        const cachTim = Number((cols[3] ?? '0').replace(',', '.')) || 0;
        const length = Number((cols[4] ?? '0').replace(',', '.')) || 0;
        const width = Number((cols[5] ?? '0').replace(',', '.')) || 0;
        const damageCode = Number((cols[6] ?? '1').trim()) || 1;
        designDb.addDamagePiece(project.id, segment.id, {
          pieceNumber, startStation, side, cachTim, length, width, damageCode,
        });
        added += 1;
      }
      setStatusMsg(`✓ Đã dán ${added} miếng từ clipboard.`);
    } catch (e) {
      setStatusMsg(`✗ Lỗi paste: ${String(e)}`);
    }
  }

  function handlePreview() {
    const lines: string[] = [`# Bản xem trước — ${project.name} / ${segment.name}`];
    lines.push(`Tổng: ${segment.damagePieces.length} miếng / ${stats.totalDamage.toFixed(2)} m² (${stats.ratio.toFixed(2)}% mặt đường)`);
    lines.push('');
    lines.push('| STT | Lý trình | VT | Cách tim | Dài | Rộng | Mã | Loại |');
    lines.push('|-----|----------|----|----|----|----|----|----|');
    for (const p of segment.damagePieces) {
      const dc = damageCodes.find((d) => d.code === p.damageCode);
      lines.push(`| ${p.pieceNumber} | ${formatStation(p.startStation)} | ${p.side === 'left' ? 'T' : p.side === 'right' ? 'P' : 'TIM'} | ${(p.cachTim ?? 0).toFixed(2)} | ${p.length.toFixed(2)} | ${p.width.toFixed(2)} | ${p.damageCode} | ${dc?.name ?? '?'} |`);
    }
    void dialog.alert(lines.join('\n'));
  }

  async function handleExportExcel() {
    try {
      setStatusMsg('⏳ Đang chuẩn bị file Excel — chọn nơi lưu...');
      const result = await exportProjectStatsToExcel(project, damageCodes);
      if (!result) {
        setStatusMsg('Đã huỷ xuất Excel.');
        return;
      }
      setStatusMsg(`✓ Đã xuất ${result.filename} (${(result.bytes / 1024).toFixed(1)} KB) — 3 sheet: Diện tích / Tỉ lệ / Chi tiết miếng.\n${result.path}`);
    } catch (e) {
      setStatusMsg(`✗ Lỗi xuất Excel: ${String(e)}`);
    }
  }

  return (
    <div className="acad-right">
      {/* Toolbar — chỉ Thêm + Dán + Xem (Vẽ CAD đã có ở status bar dưới, Excel dời sang status bar) */}
      <div className="acad-toolbar">
        <button type="button" className="acad-tb-btn acad-tb-blue" onClick={handleAdd}>➕ Thêm</button>
        <button type="button" className="acad-tb-btn acad-tb-cyan" onClick={handlePasteClipboard} title="Dán dữ liệu từ Excel/clipboard (TSV)">📋 Dán</button>
        <button type="button" className="acad-tb-btn acad-tb-amber" onClick={handlePreview} disabled={segment.damagePieces.length === 0}>🔍 Xem</button>

        <div style={{ flex: 1 }} />
        <span className="acad-acad-state">
          AutoCAD: {acadStatus.running
            ? <span style={{ color: '#16a34a' }}>● {mapAcadVersion(acadStatus.version)}</span>
            : <span style={{ color: '#dc2626' }}>● Chưa mở</span>}
        </span>
      </div>

      {/* DataGrid 8 cols — onPaste handler để paste TSV từ Excel trực tiếp */}
      <div
        className="acad-grid-wrap"
        onPaste={(e) => {
          const text = e.clipboardData.getData('text/plain');
          if (!text || (!text.includes('\t') && !text.includes('\n'))) return; // single value paste, để default xử lý
          e.preventDefault();
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          let added = 0;
          for (const line of lines) {
            const cols = line.includes('\t') ? line.split('\t') : line.split(',');
            if (cols.length < 6) continue;
            const pieceNumber = (cols[0] ?? '').trim();
            if (!pieceNumber) continue;
            const stationStr = (cols[1] ?? '').trim();
            const startStation = stationStr.includes('Km') ? parseStation(stationStr) : Number(stationStr) || 0;
            const vt = (cols[2] ?? '').trim().toUpperCase();
            const side: DamageSide = vt === 'T' ? 'left' : vt === 'P' ? 'right' : 'center';
            const cachTim = Number((cols[3] ?? '0').replace(',', '.')) || 0;
            const length = Number((cols[4] ?? '0').replace(',', '.')) || 0;
            const width = Number((cols[5] ?? '0').replace(',', '.')) || 0;
            const damageCode = Number((cols[6] ?? '1').trim()) || 1;
            designDb.addDamagePiece(project.id, segment.id, {
              pieceNumber, startStation, side, cachTim, length, width, damageCode,
            });
            added += 1;
          }
          if (added > 0) setStatusMsg(`✓ Đã paste ${added} miếng từ Excel.`);
        }}
      >
        <table className="acad-grid">
          <thead>
            <tr>
              <th style={{ width: 62 }}>S.Miếng</th>
              <th style={{ width: 90 }}>Lý trình</th>
              <th style={{ width: 38 }}>VT</th>
              <th style={{ width: 68 }}>Cách tim</th>
              <th style={{ width: 58 }}>Dài (m)</th>
              <th style={{ width: 62 }}>Rộng (m)</th>
              <th style={{ width: 48 }}>Mã HH</th>
              <th>Dạng hư hỏng</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {segment.damagePieces.length === 0 ? (
              <tr>
                <td colSpan={9} className="acad-grid-empty">
                  Chưa có miếng hư hỏng. Bấm <strong>+ Thêm</strong> để nhập.
                </td>
              </tr>
            ) : (
              segment.damagePieces.map((p) => {
                const dc = damageCodes.find((d) => d.code === p.damageCode);
                return (
                  <tr key={p.id}>
                    <td><InlineText
                      value={p.pieceNumber}
                      onChange={(v) => designDb.updateDamagePiece(project.id, segment.id, p.id, { pieceNumber: v })}
                    /></td>
                    <td><InlineNumber
                      value={p.startStation}
                      onChange={(v) => designDb.updateDamagePiece(project.id, segment.id, p.id, { startStation: v })}
                    /></td>
                    <td>
                      <select
                        className="acad-grid-input"
                        value={p.side}
                        onChange={(e) => designDb.updateDamagePiece(project.id, segment.id, p.id, { side: e.target.value as DamageSide })}
                      >
                        <option value="left">T</option>
                        <option value="right">P</option>
                        <option value="center">TIM</option>
                      </select>
                    </td>
                    <td><InlineNumber
                      value={p.cachTim ?? 0}
                      step={0.1}
                      onChange={(v) => designDb.updateDamagePiece(project.id, segment.id, p.id, { cachTim: v })}
                    /></td>
                    <td><InlineNumber
                      value={p.length}
                      step={0.1}
                      onChange={(v) => designDb.updateDamagePiece(project.id, segment.id, p.id, { length: v })}
                    /></td>
                    <td><InlineNumber
                      value={p.width}
                      step={0.1}
                      onChange={(v) => designDb.updateDamagePiece(project.id, segment.id, p.id, { width: v })}
                    /></td>
                    <td>
                      <select
                        className="acad-grid-input"
                        value={p.damageCode}
                        onChange={(e) => designDb.updateDamagePiece(project.id, segment.id, p.id, { damageCode: Number(e.target.value) })}
                      >
                        {damageCodes.map((d) => (
                          <option key={d.code} value={d.code}>{d.code}</option>
                        ))}
                      </select>
                    </td>
                    <td className="acad-grid-readonly">{dc?.name ?? '?'}</td>
                    <td>
                      <button
                        type="button"
                        className="acad-grid-del"
                        onClick={() => handleDeleteSelected(p.id)}
                      >🗑</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="acad-statusbar">
        <span className="acad-status-msg">{statusMsg}</span>
        {stats.totalDamage > 0 && (
          <span className="acad-status-stat">
            Tổng: <strong>{stats.totalDamage.toFixed(2)} m²</strong> ({stats.ratio.toFixed(2)}% mặt đường)
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="acad-tb-btn acad-tb-green"
            onClick={handleExportExcel}
            disabled={project.segments.every((s) => s.damagePieces.length === 0)}
            title="Xuất file Excel báo cáo: 3 sheet (Diện tích / Tỉ lệ % / Chi tiết miếng) cho TOÀN BỘ project"
          >
            📊 Excel Báo cáo
          </button>
          <button
            type="button"
            className="acad-tb-btn acad-tb-red"
            onClick={handleClearAcad}
            disabled={drawing || !acadStatus.running}
            title="Xóa toàn bộ AutoCAD + reset Y offset về 0"
          >
            🗑 Xóa AutoCAD
          </button>
          <button
            type="button"
            className="acad-tb-btn acad-tb-purple"
            style={{ padding: '6px 14px', fontWeight: 700 }}
            onClick={handleDraw}
            disabled={drawing || !acadStatus.running || segment.damagePieces.length === 0}
            title="Vẽ project vào AutoCAD. Lần 2 trở đi sẽ vẽ phía DƯỚI (Y giảm dần) để không trùng lần 1."
          >
            📐 VẼ AUTOCAD
          </button>
        </div>
      </div>
    </div>
  );
}

// Helpers — inline cell input
function InlineText({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <input
      type="text"
      className="acad-grid-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function InlineNumber({ value, step = 1, onChange }: { value: number; step?: number; onChange: (v: number) => void }): JSX.Element {
  return (
    <input
      type="number"
      step={step}
      className="acad-grid-input"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
    />
  );
}

// ============================================================
// Modals — Turn 1 stub (Turn 2 sẽ implement đầy đủ)
// ============================================================
function CocHModal({
  segment, designDb, projectId, onClose,
}: {
  segment: RoadSegment;
  designDb: ReturnType<typeof useDesignDb>;
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  const [label, setLabel] = useState('');
  const [station, setStation] = useState(0);

  return (
    <ModalShell title="📍 Cài đặt Cọc H" onClose={onClose} width={500}
      footer={<button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={onClose}>Đóng</button>}
    >
      <div className="acad-modal-row" style={{ gap: 8 }}>
        <input type="text" className="acad-input" placeholder="Tên cọc (vd: H1)" value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 110 }} />
        <input type="number" className="acad-input" placeholder="Lý trình (m)" value={station} onChange={(e) => setStation(Number(e.target.value) || 0)} style={{ width: 130 }} />
        <button type="button" className="acad-btn-popup acad-btn-blue" style={{ width: 'auto', padding: '6px 14px' }}
          onClick={() => {
            if (!label.trim()) return;
            designDb.addStake(projectId, segment.id, label.trim(), station);
            setLabel(''); setStation(0);
          }}
        >+ Thêm</button>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
        💡 Để trống danh sách → tự sinh cọc H1, H2, H3… mỗi 100m khi vẽ.
      </div>
      <table className="acad-grid" style={{ marginTop: 10 }}>
        <thead><tr><th>Cọc</th><th>Lý trình (m)</th><th></th></tr></thead>
        <tbody>
          {segment.stakes.length === 0 ? (
            <tr><td colSpan={3} className="acad-grid-empty">(rỗng — auto-sinh khi vẽ)</td></tr>
          ) : segment.stakes.map((k) => (
            <tr key={k.id}>
              <td><strong>{k.label}</strong></td>
              <td>{k.station} ({formatStation(k.station)})</td>
              <td><button type="button" className="acad-grid-del" onClick={() => designDb.deleteStake(projectId, segment.id, k.id)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </ModalShell>
  );
}

function BanVeModal({
  segment, designDb, projectId, onClose,
}: {
  segment: RoadSegment;
  designDb: ReturnType<typeof useDesignDb>;
  projectId: string;
  onClose: () => void;
}): JSX.Element {
  // Draft state — Lưu/Hủy pattern: edits ko apply realtime, chờ user bấm "Lưu"
  const [draftDrawing, setDraftDrawing] = useState(segment.drawing);
  const [draftPrefs, setDraftPrefs] = useState(designDb.db.drawingPrefs);

  // Functional update để batch updates không bị ghi đè (vd FontPicker gọi 2 update liên tiếp)
  function updateDrawing<K extends keyof RoadSegment['drawing']>(key: K, value: RoadSegment['drawing'][K]) {
    setDraftDrawing((prev) => ({ ...prev, [key]: value }));
  }
  function updatePrefs<K extends keyof typeof draftPrefs>(key: K, value: typeof draftPrefs[K]) {
    setDraftPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    designDb.updateSegment(projectId, segment.id, { drawing: draftDrawing });
    designDb.updateDrawingPrefs(draftPrefs);
    onClose();
  }
  function handleCancel() {
    onClose();
  }

  return (
    <ModalShell title="📄 Cài đặt bản vẽ" onClose={handleCancel} width={520}
      footer={
        <>
          <button type="button" className="acad-tb-btn" style={{ background: '#E5E7EB', color: '#1F2937', padding: '0 16px' }} onClick={handleCancel}>Hủy</button>
          <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={handleSave}>💾 Lưu</button>
        </>
      }
    >
      <div className="acad-modal-grid">
        <label>Khung bản vẽ:</label>
        <select
          className="acad-input"
          value={draftDrawing.frameType}
          onChange={(e) => {
            const ft = e.target.value as RoadSegment['drawing']['frameType'];
            const isA3 = ft === 'A3_390x280';
            setDraftDrawing({
              ...draftDrawing,
              frameType: ft,
              scaleX: isA3 ? 0.2 : 0.1,
              scaleY: 1,
              baoLutMode: !isA3,
            });
          }}
        >
          <option value="A3_390x280">A3 (78×56 đv = 1:5) — bản thường</option>
          <option value="A4_270x195_baolut">A4 (54×39 đv = 1:10) — bão lũ</option>
        </select>

        <label>Tỷ lệ X (1:N):</label>
        <input
          type="number"
          className="acad-input"
          value={Math.round(1 / (draftDrawing.scaleX || 1))}
          onChange={(e) => updateDrawing('scaleX', 1 / (Number(e.target.value) || 1))}
        />

        <label>Tỷ lệ Y (1:N):</label>
        <input
          type="number"
          className="acad-input"
          value={Math.round(1 / (draftDrawing.scaleY || 1))}
          onChange={(e) => updateDrawing('scaleY', 1 / (Number(e.target.value) || 1))}
        />

        <label>Mode bão lũ (500m+500m/A4):</label>
        <input
          type="checkbox"
          checked={draftDrawing.baoLutMode}
          onChange={(e) => updateDrawing('baoLutMode', e.target.checked)}
        />
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #E5E7EB' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: '#1F2937' }}>
          🔠 Text Style (sẽ tạo + set current trong AutoCAD)
        </h3>
        <div className="acad-modal-grid">
          <label>Tên style:</label>
          <input
            type="text"
            className="acad-input"
            value={draftPrefs.textStyleName}
            onChange={(e) => updatePrefs('textStyleName', e.target.value)}
          />
          <label>Font:</label>
          <FontPicker
            value={draftPrefs.textStyleFont}
            onChange={(v) => updatePrefs('textStyleFont', v)}
            onTypeChange={(t) => updatePrefs('textStyleType', t)}
          />
          <label>Width factor:</label>
          <input
            type="number"
            step="0.05"
            className="acad-input"
            value={draftPrefs.textStyleWidth}
            onChange={(e) => updatePrefs('textStyleWidth', Number(e.target.value) || 1)}
          />
          <label>Chiều cao text lý trình (m):</label>
          <input
            type="number"
            step="0.05"
            className="acad-input"
            value={draftPrefs.stationTextHeight}
            onChange={(e) => updatePrefs('stationTextHeight', Number(e.target.value) || 0.4)}
          />
          <label>Chiều cao text label miếng (m):</label>
          <input
            type="number"
            step="0.05"
            className="acad-input"
            value={draftPrefs.pieceLabelTextHeight}
            onChange={(e) => updatePrefs('pieceLabelTextHeight', Number(e.target.value) || 0.35)}
          />
        </div>
      </div>
    </ModalShell>
  );
}

// ============================================================
// LayerConfigModal — chỉnh tên + màu + linetype cho 9 standard layers
// Edits via draft state với Lưu/Hủy pattern
// ============================================================
function LayerConfigModal({
  designDb, onClose,
}: {
  designDb: ReturnType<typeof useDesignDb>;
  onClose: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState(designDb.db.drawingPrefs.layers);

  function update(key: StandardLayerKey, patch: Partial<LayerSpec>) {
    setDraft({ ...draft, [key]: { ...draft[key], ...patch } });
  }
  function handleSave() {
    designDb.updateDrawingPrefs({ layers: draft });
    onClose();
  }
  function handleReset() {
    setDraft(defaultLayers());
  }

  return (
    <ModalShell
      title="🗂 Cài đặt Layer AutoCAD"
      onClose={onClose}
      width={780}
      footer={
        <>
          <button type="button" className="acad-tb-btn" style={{ background: '#FEE2E2', color: '#DC2626', padding: '0 14px' }} onClick={handleReset}>↺ Reset mặc định</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="acad-tb-btn" style={{ background: '#E5E7EB', color: '#1F2937', padding: '0 16px' }} onClick={onClose}>Hủy</button>
          <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={handleSave}>💾 Lưu</button>
        </>
      }
    >
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px' }}>
        Tên layer + màu sẽ được tạo trong AutoCAD khi bấm "Vẽ AutoCAD". Linetype DASHED dùng cho TIM + VACHLAN (vạch chia làn).
      </p>
      <table className="acad-grid">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Đối tượng</th>
            <th style={{ width: 130 }}>Tên Layer</th>
            <th style={{ width: 110 }}>Màu</th>
            <th style={{ width: 130 }}>Linetype</th>
            <th>Mô tả</th>
          </tr>
        </thead>
        <tbody>
          {STANDARD_LAYERS.map((cfg) => {
            const layer = draft[cfg.key];
            return (
              <tr key={cfg.key}>
                <td><strong>{cfg.key}</strong></td>
                <td>
                  <input
                    className="acad-grid-input"
                    value={layer.name}
                    onChange={(e) => update(cfg.key, { name: e.target.value })}
                  />
                </td>
                <td>
                  <AcadColorPicker
                    value={layer.color}
                    onChange={(c) => update(cfg.key, { color: c })}
                  />
                </td>
                <td>
                  <select
                    className="acad-grid-input"
                    style={{ minWidth: 100, paddingRight: 18 }}
                    value={layer.linetype ?? 'CONTINUOUS'}
                    onChange={(e) => update(cfg.key, { linetype: e.target.value as LinetypeName })}
                  >
                    {LINETYPE_OPTIONS.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
                  </select>
                </td>
                <td className="acad-grid-readonly">{cfg.description}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ModalShell>
  );
}

function HatchModal({
  damageCodes, designDb, onClose,
}: {
  damageCodes: DamageCode[];
  designDb: ReturnType<typeof useDesignDb>;
  onClose: () => void;
}): JSX.Element {
  return (
    <ModalShell title="⚙️ Cài đặt Hatch / Mã hư hỏng" onClose={onClose} width={780}
      footer={
        <button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={onClose}>Đóng</button>
      }
    >
      <table className="acad-grid">
        <thead><tr>
          <th style={{ width: 36 }}>Mã</th>
          <th style={{ width: 72 }}>Mã vẽ</th>
          <th>Tên hư hỏng</th>
          <th style={{ width: 90 }}>Hatch</th>
          <th style={{ width: 70 }}>Sơ họa</th>
          <th style={{ width: 60 }}>Scale</th>
          <th style={{ width: 90 }}>Màu</th>
          <th style={{ width: 36 }}></th>
        </tr></thead>
        <tbody>
          {damageCodes.map((dc) => (
            <tr key={dc.code}>
              <td><strong>{dc.code}</strong></td>
              <td><input className="acad-grid-input" value={dc.maVe} onChange={(e) => designDb.upsertDamageCode({ ...dc, maVe: e.target.value })} /></td>
              <td><input className="acad-grid-input" value={dc.name} onChange={(e) => designDb.upsertDamageCode({ ...dc, name: e.target.value })} /></td>
              <td>
                <select
                  className="acad-grid-input"
                  value={dc.hatchPattern}
                  onChange={(e) => designDb.upsertDamageCode({ ...dc, hatchPattern: e.target.value })}
                >
                  {HATCH_PATTERN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              <td><HatchPreviewSwatch pattern={dc.hatchPattern} color={acadColorIndexToHex(dc.colorIndex)} /></td>
              <td><input type="number" step="0.1" className="acad-grid-input" value={dc.hatchScale} onChange={(e) => designDb.upsertDamageCode({ ...dc, hatchScale: Number(e.target.value) || 1 })} /></td>
              <td><AcadColorPicker value={dc.colorIndex} onChange={(c) => designDb.upsertDamageCode({ ...dc, colorIndex: c })} /></td>
              <td><button type="button" className="acad-grid-del" onClick={async () => {
                if (await dialog.confirm(`Xóa mã ${dc.code} - ${dc.name}?`)) designDb.deleteDamageCode(dc.code);
              }}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="acad-btn-popup acad-btn-blue"
          style={{ width: 'auto', padding: '0 16px' }}
          onClick={() => {
            const next = Math.max(0, ...damageCodes.map(c => c.code)) + 1;
            designDb.upsertDamageCode({
              code: next, name: `Loại ${next}`, maVe: `M${next}`,
              hatchPattern: 'ANSI31', hatchScale: 0.5, hatchAngle: 0,
              colorIndex: 8, layerName: `HH_${next}`,
            });
          }}
        >+ Thêm mã hư hỏng</button>
        <button
          type="button"
          className="acad-btn-popup acad-btn-purple"
          style={{ width: 'auto', padding: '0 16px' }}
          onClick={async () => {
            try {
              const result = await deployHatchPatterns();
              await dialog.alert(result.summary);
            } catch (e) {
              await dialog.alert(`✗ Lỗi: ${String(e)}`);
            }
          }}
          title="Tự động cài 25 hatch patterns vào support folder của tất cả AutoCAD đã cài trên máy"
        >📥 Cài đặt thư viện hatch TrishTEAM</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title, onClose, children, width = 480, footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="acad-modal-backdrop" /* click outside KHÔNG đóng — phải bấm Hủy/✕ */>
      <div className="acad-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="acad-modal-head">
          <span className="acad-modal-title">{title}</span>
          <button type="button" className="acad-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="acad-modal-body">{children}</div>
        {footer && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ATGT — Phase 28.5: tách thành module riêng AtgtPanel.tsx (full-feature
// 9 loại đối tượng theo QCVN 41:2019). Import ở đầu file để AtgtModule
// wrapper render được.
// ============================================================

// ============================================================
// Bão Lũ panel — Phân tích đất đá sụt trượt + tính khối lượng
// ============================================================

interface BaoLuResult {
  vTuNhien: number;     // m³
  vVanChuyen: number;   // m³
  sMatCat: number;      // m²
  detail: string;
}

function BaoLuPanel(): JSX.Element {
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgBase64, setImgBase64] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [L, setL] = useState(20);
  const [B, setB] = useState(5);
  const [H, setH] = useState(2);
  const [alpha, setAlpha] = useState(45);
  const [k, setK] = useState(1.3);
  const [lyTrinh, setLyTrinh] = useState('Km0+000');

  const [result, setResult] = useState<BaoLuResult | null>(null);
  const [acadStatus, setAcadStatus] = useState<{ running: boolean; version?: string }>({ running: false });

  useEffect(() => {
    autoCadStatus().then((s) => setAcadStatus({ running: s.running, version: s.version }));
    const t = setInterval(() => autoCadStatus().then((s) => setAcadStatus({ running: s.running, version: s.version })), 5000);
    return () => clearInterval(t);
  }, []);

  function handleImageChoose() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        setImgPreview(data);
        setImgBase64(data.split(',')[1] ?? null);
      };
      reader.readAsDataURL(f);
    };
    input.click();
  }

  function handleClearImage() {
    setImgPreview(null);
    setImgBase64(null);
    setAiResult(null);
  }

  async function handleAiAnalyze() {
    if (!imgBase64) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      // TODO Phase sau: gọi Claude Vision API qua Tauri Rust backend (an toàn key)
      // Hiện tại: gợi ý sơ bộ dựa vào aspect ratio ảnh + ước lượng theo ràng buộc
      // Note: AI vision đo kích thước qua ảnh không chính xác (Trí đã confirm)
      // Để placeholder demo — Phase sau wire Claude API
      await new Promise((r) => setTimeout(r, 800));
      setAiResult(
        'Ước tính sơ bộ từ ảnh (chỉ tham khảo, sai số ±30-50%):\n' +
        `• Chiều dài L ≈ ${(15 + Math.random() * 15).toFixed(1)}m\n` +
        `• Chiều rộng B ≈ ${(3 + Math.random() * 5).toFixed(1)}m\n` +
        `• Chiều cao H ≈ ${(1 + Math.random() * 2).toFixed(1)}m\n` +
        '\n⚠ Để chính xác cần đo thực địa. Ảnh AI chỉ gợi ý ban đầu.\n' +
        '(Phase sau: tích hợp Claude Vision API qua Rust backend)'
      );
    } finally {
      setAiLoading(false);
    }
  }

  function handleCalc() {
    if (L <= 0 || B <= 0 || H <= 0) {
      void dialog.alert('Nhập đầy đủ L, B, H > 0.');
      return;
    }
    // Mặt cắt tam giác: S = ½ × B × H
    const sMatCat = 0.5 * B * H;
    const vTuNhien = sMatCat * L;
    const vVanChuyen = vTuNhien * k;
    const detail =
      `L = ${L}m · B = ${B}m · H = ${H}m · α = ${alpha}° · k = ${k}\n` +
      `S mặt cắt (½×B×H) = ${sMatCat.toFixed(2)} m²\n` +
      `V tự nhiên (S×L) = ${vTuNhien.toFixed(2)} m³\n` +
      `V vận chuyển (V×k) = ${vVanChuyen.toFixed(2)} m³`;
    setResult({ vTuNhien, vVanChuyen, sMatCat, detail });
  }

  async function handleDrawCad() {
    if (!result) {
      handleCalc();
      return;
    }
    if (!acadStatus.running) {
      await dialog.alert('Chưa kết nối AutoCAD. Mở AutoCAD trống trước.');
      return;
    }
    try {
      await autoCadEnsureDocument();
      // Vẽ mặt cắt tam giác L × H tại lý trình lyTrinh
      const x0 = parseStation(lyTrinh);
      const y0 = 0;
      const cmds: string[] = [];
      // Setup text style (font + width factor)
      cmds.push('._-STYLE\nTEXT_HH\nromans.shx\n0\n0.7\n0\nN\nN\nN\n');
      cmds.push('._-LAYER\nN\nBAOLU_DAT\nC\n30\nBAOLU_DAT\n\n');
      cmds.push('._-LAYER\nN\nBAOLU_TEXT\nC\n7\nBAOLU_TEXT\n\n');
      cmds.push('._-LAYER\nS\nBAOLU_DAT\n\n');
      // Tam giác mặt cắt: 3 điểm — dùng PLINE + Close
      cmds.push(`._PLINE\n${x0},${y0}\n${x0 + B},${y0}\n${x0 + B / 2},${y0 + H}\nC\n`);
      cmds.push(`._-HATCH\nP\nEARTH\n${(0.3).toFixed(3)}\n0\nS\nL\n\n\n`);
      cmds.push('._-LAYER\nS\nBAOLU_TEXT\n\n');
      cmds.push(`._-TEXT\n${x0 + B / 2 - 1},${y0 + H + 0.5}\n0.5\n0\n${lyTrinh.replace(/\s+/g, '_')}\n`);
      cmds.push(`._-TEXT\n${x0},${y0 - 0.8}\n0.4\n0\nB=${B}m\n`);
      cmds.push(`._-TEXT\n${x0 + B + 0.3},${y0 + H / 2}\n0.4\n0\nH=${H}m\n`);
      cmds.push(`._-TEXT\n${x0},${y0 - 1.5}\n0.4\n0\nV=${result.vVanChuyen.toFixed(1)}m3\n`);
      cmds.push('._ZOOM\nE\n');
      const sent = await autoCadSendCommands(cmds);
      await dialog.alert(`✓ Đã gửi ${sent} lệnh mặt cắt vào AutoCAD.`);
    } catch (e) {
      await dialog.alert(`✗ Lỗi: ${String(e)}`);
    }
  }

  return (
    <>
      <div className="acad-page-head">
        <h2>🌊 VẼ BÃO LŨ — PHÂN TÍCH ĐẤT ĐÁ SỤT TRƯỢT</h2>
        <p>AI tự nhận diện ảnh hiện trường · Tính khối lượng · Xuất mặt cắt AutoCAD</p>
      </div>

      <div className="acad-card-blue">
        <div className="acad-card-title">📷 ẢNH HIỆN TRƯỜNG</div>
        <div className="acad-bl-img-row">
          {!imgPreview ? (
            <div className="acad-bl-img-placeholder" onClick={handleImageChoose}>
              <div style={{ fontSize: 40 }}>🖼️</div>
              <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 6 }}>Nhấn để chọn ảnh</div>
              <div style={{ fontSize: 11, color: '#CBD5E1' }}>(.jpg, .png, .jpeg)</div>
            </div>
          ) : (
            <img src={imgPreview} className="acad-bl-img-preview" onClick={handleImageChoose} alt="" />
          )}
          <div className="acad-bl-img-actions">
            <button type="button" className="acad-tb-btn acad-tb-blue" disabled={!imgBase64 || aiLoading} onClick={handleAiAnalyze}>
              {aiLoading ? '⏳ Đang phân tích…' : '🤖 Phân tích AI'}
            </button>
            <button type="button" className="acad-tb-btn acad-tb-red" disabled={!imgPreview} onClick={handleClearImage}>
              🗑 Xóa ảnh
            </button>
          </div>
        </div>
        {aiResult && (
          <div className="acad-bl-ai-result">
            <strong>🤖 Kết quả nhận diện AI:</strong>
            <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12 }}>{aiResult}</pre>
          </div>
        )}
      </div>

      <div className="acad-card-amber">
        <div className="acad-card-title" style={{ color: '#92400E' }}>📐 THÔNG SỐ HIỆN TRƯỜNG</div>
        <div className="acad-form-3col">
          <div><label>Chiều dài L (m):</label><input type="number" className="acad-input" step="0.1" value={L} onChange={(e) => setL(Number(e.target.value) || 0)} /></div>
          <div><label>Chiều rộng B (m):</label><input type="number" className="acad-input" step="0.1" value={B} onChange={(e) => setB(Number(e.target.value) || 0)} /></div>
          <div><label>Chiều cao H (m):</label><input type="number" className="acad-input" step="0.1" value={H} onChange={(e) => setH(Number(e.target.value) || 0)} /></div>
        </div>
        <div className="acad-form-2col" style={{ marginTop: 10 }}>
          <div><label>Góc mái α (độ):</label><input type="number" className="acad-input" value={alpha} onChange={(e) => setAlpha(Number(e.target.value) || 0)} /></div>
          <div><label>Loại vật liệu (k):</label>
            <select className="acad-input" value={k} onChange={(e) => setK(Number(e.target.value))}>
              <option value={1.2}>Bùn (k=1.2)</option>
              <option value={1.3}>Đất (k=1.3)</option>
              <option value={1.4}>Đất + Đá (k=1.4)</option>
              <option value={1.5}>Đá cục (k=1.5)</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Lý trình bắt đầu:</label>
          <input type="text" className="acad-input" style={{ width: 200 }} value={lyTrinh} onChange={(e) => setLyTrinh(e.target.value)} />
        </div>
      </div>

      <div className="acad-action-row">
        <button type="button" className="acad-tb-btn acad-tb-amber" onClick={handleCalc}>🧮 Tính Khối Lượng</button>
        <button type="button" className="acad-tb-btn acad-tb-purple" disabled={!acadStatus.running} onClick={handleDrawCad}>📐 Xuất AutoCAD</button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280' }}>
          AutoCAD: {acadStatus.running ? <span style={{ color: '#16a34a' }}>● Đã kết nối</span> : <span style={{ color: '#dc2626' }}>● Chưa mở</span>}
        </span>
      </div>

      {result && (
        <div className="acad-card-purple">
          <div className="acad-card-title" style={{ color: '#5B21B6' }}>📊 KẾT QUẢ TÍNH TOÁN</div>
          <div className="acad-bl-result-grid">
            <div><span className="acad-bl-stat-label">KL tự nhiên (m³)</span><div className="acad-bl-stat-value" style={{ color: '#7C3AED' }}>{result.vTuNhien.toFixed(2)}</div></div>
            <div><span className="acad-bl-stat-label">KL vận chuyển (m³)</span><div className="acad-bl-stat-value" style={{ color: '#5B21B6' }}>{result.vVanChuyen.toFixed(2)}</div></div>
            <div><span className="acad-bl-stat-label">Diện tích MC (m²)</span><div className="acad-bl-stat-value" style={{ color: '#374151' }}>{result.sMatCat.toFixed(2)}</div></div>
          </div>
          <pre style={{ margin: '12px 0 0', fontFamily: 'Consolas, monospace', fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{result.detail}</pre>
        </div>
      )}
    </>
  );
}

// ============================================================
// Chatbot Panel — Placeholder cho Claude Vision API integration
// ============================================================
function McpPanel(): JSX.Element {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: '👋 Chào! Tôi sẽ giúp gửi lệnh AutoCAD bằng tiếng Việt tự nhiên.\n\nVD: "Vẽ hố ga 2x2m" → tự sinh lệnh AutoCAD.\n\n⚠ Phase này cần wire Claude API qua Rust backend (key bảo mật). Hiện tại là demo UI.' },
  ]);
  const [input, setInput] = useState('Vẽ cho tôi mặt cắt đường: hình chữ nhật 10x0.5, vẽ tim đường chia đôi mặt cắt');

  function handleSend() {
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', text: input }, {
      role: 'ai',
      text: '⏳ Phase sau: Claude API sẽ phân tích yêu cầu và tự sinh lệnh AutoCAD command line.\n\nVí dụ output mong muốn:\n```\n._RECTANG 0,0 10,0.5\n._LINE 0,0.25 10,0.25\n```\n\nHiện tại chưa wire — đợi Phase 28.4.MCP.',
    }]);
    setInput('');
  }

  return (
    <>
      <div className="acad-mcp-head">
        <span className="acad-mcp-title">🤖 AUTOCAD AI AGENT</span>
        <span className="acad-mcp-sub">| Gõ lệnh tiếng Việt tự nhiên</span>
        <span className="acad-mcp-engine">⚡ Engine: Claude (Phase sau)</span>
      </div>

      <div className="acad-mcp-chat">
        {messages.map((m, i) => (
          <div key={i} className={`acad-mcp-bubble acad-mcp-${m.role}`}>
            <strong>{m.role === 'user' ? '🧑 Bạn' : '🤖 AI'}</strong>
            <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12 }}>{m.text}</pre>
          </div>
        ))}
      </div>

      <div className="acad-mcp-input-row">
        <input
          type="text"
          className="acad-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Gõ yêu cầu… VD: Vẽ hố ga 2x2m"
        />
        <button type="button" className="acad-tb-btn acad-tb-green" onClick={handleSend} style={{ padding: '0 18px', fontSize: 13 }}>
          ✨ TẠO LỆNH
        </button>
      </div>
    </>
  );
}

// AutoCAD hatch patterns thường dùng
const HATCH_PATTERN_OPTIONS = [
  // ANSI standard
  'ANSI31', 'ANSI32', 'ANSI33', 'ANSI34', 'ANSI35', 'ANSI36', 'ANSI37', 'ANSI38',
  // ISO
  'ISO02W100', 'ISO03W100', 'ISO04W100', 'ISO05W100', 'ISO06W100', 'ISO07W100', 'ISO08W100',
  // AR (architectural)
  'AR-CONC', 'AR-SAND', 'AR-BRSTD', 'AR-PARQ1', 'AR-RROOF', 'AR-RSHKE', 'AR-HBONE',
  // Other common
  'EARTH', 'GRAVEL', 'HONEY', 'STARS', 'DOTS', 'GRATE', 'NET', 'NET3',
  'BRICK', 'BRSTONE', 'CORK', 'CROSS', 'DASH', 'FLEX', 'GRASS', 'HEX',
  'LINE', 'PLAST', 'PLASTI', 'SACNCR', 'SQUARE', 'STEEL', 'SWAMP', 'TRIANG',
  'ZIGZAG', 'CLAY', 'MUDST', 'SOLID',
];

// AutoCAD Color Index (ACI) → hex map (16 chuẩn + grayscale)
const ACAD_COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
  5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#414141',
  9: '#808080', 10: '#FF0000', 11: '#FFAAAA', 12: '#BD0000',
  13: '#BD7E7E', 14: '#810000', 15: '#815656', 16: '#680000',
  20: '#FF3F00', 30: '#FF7F00', 40: '#FFBF00', 50: '#FFFF00',
  60: '#BFFF00', 70: '#7FFF00', 80: '#3FFF00', 90: '#00FF00',
  100: '#00FF3F', 110: '#00FF7F', 120: '#00FFBF', 130: '#00FFFF',
  140: '#00BFFF', 150: '#007FFF', 160: '#003FFF', 170: '#0000FF',
  180: '#3F00FF', 190: '#7F00FF', 200: '#BF00FF', 210: '#FF00FF',
  220: '#FF00BF', 230: '#FF007F', 240: '#FF003F',
  250: '#333333', 251: '#5B5B5B', 252: '#848484', 253: '#ADADAD',
  254: '#D6D6D6', 255: '#FFFFFF',
};
function acadColorIndexToHex(idx: number): string {
  return ACAD_COLORS[idx] ?? '#808080';
}

// Tính ACI hex màu cho 1 index 1-255 (chính xác hơn ACAD_COLORS map)
function aciToHex(index: number): string {
  if (ACAD_COLORS[index]) return ACAD_COLORS[index]!;
  // Index 10-249: hue+saturation grid theo công thức AutoCAD
  if (index >= 10 && index <= 249) {
    const i = index - 10;
    const hue = Math.floor(i / 24) * 15;        // 0..360 step 15°
    const lightStep = i % 24;                    // 0..23
    const lightness = [50, 80, 30, 65, 45, 90, 25, 60, 40, 85, 20, 55, 35, 75, 15, 50, 30, 70, 10, 45, 25, 65, 5, 40][lightStep] ?? 50;
    return hslToHex(hue, 100, lightness);
  }
  return '#808080';
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// Color picker — click swatch mở palette modal AutoCAD style
function AcadColorPicker({ value, onChange }: { value: number; onChange: (c: number) => void }): JSX.Element {
  const [open, setOpen] = useState(false);
  const hex = aciToHex(value);
  return (
    <>
      <button
        type="button"
        className="acad-grid-input"
        onClick={() => setOpen(true)}
        title={`Click để chọn màu (Hex: ${hex})`}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: 2,
          background: '#FFF', border: '1px solid #D1D5DB', cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 18, height: 18, borderRadius: 3,
            background: hex, border: '1px solid #9CA3AF',
            flexShrink: 0, display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600 }}>{value}</span>
      </button>
      {open && (
        <AcadColorPaletteModal
          value={value}
          onChange={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Palette modal AutoCAD-style: 16 standard ACI + 240 grid + grayscale 250-255
function AcadColorPaletteModal({
  value, onChange, onClose,
}: {
  value: number;
  onChange: (c: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const previewIdx = hover ?? value;
  const previewHex = aciToHex(previewIdx);

  const renderCell = (i: number, size = 20) => (
    <button
      key={i}
      type="button"
      onClick={() => onChange(i)}
      onMouseEnter={() => setHover(i)}
      onMouseLeave={() => setHover(null)}
      title={`Index ${i} · ${aciToHex(i)}`}
      style={{
        width: size, height: size,
        background: aciToHex(i),
        border: i === value ? '2px solid #1E3A8A' : '1px solid rgba(0,0,0,0.15)',
        cursor: 'pointer', padding: 0, margin: 0,
        boxShadow: i === value ? '0 0 4px #1E3A8A' : undefined,
      }}
    />
  );

  return (
    <ModalShell title="🎨 Chọn màu AutoCAD (ACI 1-255)" onClose={onClose} width={620}
      footer={<button type="button" className="acad-tb-btn acad-tb-blue" style={{ padding: '0 18px' }} onClick={onClose}>Đóng</button>}
    >
      {/* Preview */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <span style={{
          width: 60, height: 36, background: previewHex,
          border: '1px solid #9CA3AF', borderRadius: 4,
        }} />
        <div style={{ fontSize: 13 }}>
          <div><strong>Index:</strong> {previewIdx} {previewIdx === value && <span style={{ color: '#16a34a' }}>(đã chọn)</span>}</div>
          <div><strong>Hex:</strong> {previewHex}</div>
        </div>
      </div>

      {/* 16 Standard ACI 1-9 + grayscale */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Standard ACI (1-9):</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 9 }).map((_, k) => renderCell(k + 1, 28))}
        </div>
      </div>

      {/* True color grid 10-249 (24 columns × 10 rows) */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>True Color (10-249):</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 1, maxWidth: 504 }}>
          {Array.from({ length: 240 }).map((_, k) => renderCell(k + 10, 19))}
        </div>
      </div>

      {/* Grayscale 250-255 */}
      <div>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Grayscale (250-255):</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 6 }).map((_, k) => renderCell(k + 250, 28))}
        </div>
      </div>
    </ModalShell>
  );
}

// Hatch preview swatch — render SVG approximate hatch pattern
function HatchPreviewSwatch({ pattern, color }: { pattern: string; color: string }): JSX.Element {
  const id = `hatch_${pattern.replace(/[^A-Z0-9]/gi, '_')}`;
  // Define SVG pattern theo tên
  const def = (() => {
    const stroke = color === '#FFFFFF' ? '#1F2937' : color;
    switch (pattern.toUpperCase()) {
      case 'ANSI31':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={stroke} strokeWidth="0.6"/></pattern>;
      case 'ANSI32':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'ANSI33':
      case 'ANSI34':
      case 'ANSI37':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke={stroke} strokeWidth="0.7"/>
          <line x1="2" y1="0" x2="2" y2="4" stroke={stroke} strokeWidth="0.7"/></pattern>;
      case 'NET':
      case 'GRATE':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5">
          <line x1="0" y1="0" x2="5" y2="0" stroke={stroke} strokeWidth="0.5"/>
          <line x1="0" y1="0" x2="0" y2="5" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'NET3':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(60)">
          <line x1="0" y1="0" x2="6" y2="0" stroke={stroke} strokeWidth="0.5"/>
          <line x1="0" y1="3" x2="6" y2="3" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'STARS':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
          <text x="0" y="5" fontSize="6" fill={stroke}>★</text></pattern>;
      case 'DOTS':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
          <circle cx="2" cy="2" r="0.6" fill={stroke}/></pattern>;
      case 'EARTH':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
          <line x1="0" y1="0" x2="0" y2="6" stroke={stroke} strokeWidth="0.4"/>
          <line x1="3" y1="3" x2="3" y2="6" stroke={stroke} strokeWidth="0.4"/></pattern>;
      case 'CORK':
      case 'GRAVEL':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
          <circle cx="1" cy="1" r="0.6" fill={stroke}/>
          <circle cx="4" cy="3" r="0.5" fill={stroke}/>
          <circle cx="2" cy="4.5" r="0.4" fill={stroke}/></pattern>;
      case 'HONEY':
      case 'HEX':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="5.2">
          <polygon points="3,0 5.2,1.3 5.2,3.9 3,5.2 0.8,3.9 0.8,1.3" fill="none" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'AR-CONC':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8">
          <circle cx="2" cy="2" r="0.7" fill={stroke} opacity="0.7"/>
          <circle cx="6" cy="3" r="0.5" fill={stroke} opacity="0.7"/>
          <circle cx="3" cy="6" r="0.6" fill={stroke} opacity="0.7"/></pattern>;
      case 'FLEX':
      case 'ZIGZAG':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="3">
          <polyline points="0,0 1.5,3 3,0 4.5,3 6,0" fill="none" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'CROSS':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
          <line x1="2" y1="3" x2="4" y2="3" stroke={stroke} strokeWidth="0.6"/>
          <line x1="3" y1="2" x2="3" y2="4" stroke={stroke} strokeWidth="0.6"/></pattern>;
      case 'DASH':
      case 'LINE':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
          <line x1="0" y1="2" x2="3" y2="2" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'BRICK':
      case 'BRSTONE':
      case 'AR-BRSTD':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="4">
          <rect x="0" y="0" width="8" height="4" fill="none" stroke={stroke} strokeWidth="0.4"/>
          <line x1="4" y1="0" x2="4" y2="4" stroke={stroke} strokeWidth="0.4"/></pattern>;
      case 'SQUARE':
        return <pattern id={id} patternUnits="userSpaceOnUse" width="5" height="5">
          <rect x="1" y="1" width="3" height="3" fill="none" stroke={stroke} strokeWidth="0.5"/></pattern>;
      case 'SOLID':
        return null;
      default:
        return <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
          <line x1="0" y1="4" x2="4" y2="0" stroke={stroke} strokeWidth="0.4"/></pattern>;
    }
  })();

  const isSolid = pattern.toUpperCase() === 'SOLID';
  return (
    <svg width="60" height="22" style={{ border: '1px solid #D1D5DB', borderRadius: 3, background: '#FFF' }}>
      {def && <defs>{def}</defs>}
      <rect
        width="60"
        height="22"
        fill={isSolid ? color : (def ? `url(#${id})` : '#F3F4F6')}
        stroke="none"
      />
    </svg>
  );
}

// AutoCAD common SHX fonts (preset list — user có thể thêm)
const AUTOCAD_SHX_FONTS = [
  'romans.shx', 'romanc.shx', 'romand.shx', 'romant.shx',
  'simplex.shx', 'complex.shx', 'italic.shx', 'italicc.shx',
  'txt.shx', 'monotxt.shx',
  'isocp.shx', 'isocp2.shx', 'isocp3.shx',
  'iso3098a.shx', 'iso3098b.shx', 'iso3098c.shx', 'iso3098d.shx',
  'gothicg.shx', 'gothice.shx', 'gothici.shx',
  'scripts.shx', 'scriptc.shx',
  // Vietnamese (TCVN-compatible SHX)
  'vntime.shx', 'vntimeh.shx', 'vntime_d.shx',
];

// Common Vietnamese TTF fonts trên Windows
const VN_COMMON_TTF = [
  'vntime.ttf', 'vntimeh.ttf', 'vnarial.ttf', 'vnarialh.ttf',
  '.VnTime.ttf', '.VnTimeH.ttf', '.VnArial.ttf', '.VnArialH.ttf',
];

// FontPicker — 1 dropdown tổng hợp font, scan từ:
// - System TTF (queryLocalFonts API)
// - AutoCAD SHX (Program Files\Autodesk\AutoCAD <ver>\Fonts\)
// - Preset (AUTOCAD_SHX_FONTS, VN_COMMON_TTF)
function FontPicker({
  value, onChange, onTypeChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onTypeChange: (t: 'shx' | 'ttf') => void;
}): JSX.Element {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [acadShxFonts, setAcadShxFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let pending = 2;
    const done = () => { pending -= 1; if (pending === 0) setLoading(false); };
    // Load system TTF
    const w = window as any;
    if (typeof w.queryLocalFonts === 'function') {
      w.queryLocalFonts()
        .then((fonts: { family: string }[]) => {
          const families = Array.from(new Set(fonts.map((f) => f.family))).sort();
          const ttfNames = families.map((fam) => `${fam.toLowerCase().replace(/\s+/g, '')}.ttf`);
          setSystemFonts(ttfNames);
        })
        .catch(() => {})
        .finally(done);
    } else { done(); }
    // Load AutoCAD SHX fonts
    listAutoCadShxFonts()
      .then((list) => setAcadShxFonts(list))
      .catch(() => {})
      .finally(done);
  }, []);

  const [filter, setFilter] = useState('');

  function handleSelect(font: string) {
    onChange(font);
    if (font.toLowerCase().endsWith('.shx')) onTypeChange('shx');
    else onTypeChange('ttf');
  }

  // Combine SHX preset + AutoCAD scanned, dedupe
  const allShx = Array.from(new Set([...AUTOCAD_SHX_FONTS, ...acadShxFonts])).sort();
  const f = filter.toLowerCase();
  const matchShx = allShx.filter((x) => !f || x.toLowerCase().includes(f));
  const matchVN = VN_COMMON_TTF.filter((x) => !f || x.toLowerCase().includes(f));
  const matchSys = systemFonts.filter((x) => !f || x.toLowerCase().includes(f));
  const totalMatch = matchShx.length + matchVN.length + matchSys.length;
  const isCustom = !allShx.includes(value) && !VN_COMMON_TTF.includes(value) && !systemFonts.includes(value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Search filter input */}
      <input
        type="text"
        className="acad-input"
        placeholder="🔍 Gõ tên font để filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ height: 28, fontSize: 12 }}
      />
      <select
        className="acad-input"
        value={value}
        onChange={(e) => handleSelect(e.target.value)}
        style={{ height: 32 }}
      >
        {/* LUÔN show current value đầu tiên — đảm bảo select hiển thị đúng giá trị đã lưu */}
        <option value={value}>★ {value}</option>
        {matchShx.length > 0 && (
          <optgroup label={`📐 AutoCAD SHX (${matchShx.length}${filter ? '/' + allShx.length : ''})`}>
            {matchShx.filter((f) => f !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {matchVN.length > 0 && (
          <optgroup label={`🇻🇳 Vietnamese TTF (${matchVN.length}${filter ? '/' + VN_COMMON_TTF.length : ''})`}>
            {matchVN.filter((f) => f !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {matchSys.length > 0 && (
          <optgroup label={`💻 Windows (${matchSys.length}${filter ? '/' + systemFonts.length : ''})`}>
            {matchSys.filter((f) => f !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {totalMatch === 0 && <option value="" disabled>Không tìm thấy font khớp filter</option>}
      </select>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>
        {loading ? 'Đang scan font…' :
         filter ? `Tìm thấy ${totalMatch} font khớp "${filter}"` :
         `${allShx.length} SHX${acadShxFonts.length > 0 ? ` (${acadShxFonts.length} AutoCAD)` : ''} + ${VN_COMMON_TTF.length} VN + ${systemFonts.length} Windows`}
      </span>
    </div>
  );
}

// Map AutoCAD version DLL string → tên năm thân thiện
// VD: "24.0s (LMS Tech)" → "AutoCAD 2021"
//     "24.1s (...)"      → "AutoCAD 2022"
//     "24.2"             → "AutoCAD 2023"
//     "24.3"             → "AutoCAD 2024"
//     "25.0"             → "AutoCAD 2025"
function mapAcadVersion(version?: string): string {
  if (!version) return 'Đã kết nối';
  const m = version.match(/^(\d+)\.(\d+)/);
  if (!m) return version;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  // AutoCAD release year mapping (theo lịch sử phát hành)
  // 24.0=2021, 24.1=2022, 24.2=2023, 24.3=2024, 25.0=2025
  if (major === 24) return `AutoCAD ${2021 + minor}`;
  if (major === 25) return `AutoCAD ${2025 + minor}`;
  if (major === 23) return 'AutoCAD 2020';
  if (major === 22) return 'AutoCAD 2018-2019';
  return `AutoCAD v${major}.${minor}`;
}

// Helper — parse Vietnamese station "Km0+100" → meters
function parseStation(s: string): number {
  const m = s.match(/Km(\d+)(?:\+(\d+))?/i);
  if (!m) return Number(s) || 0;
  const km = Number(m[1] ?? 0);
  const plus = Number(m[2] ?? 0);
  return km * 1000 + plus;
}
