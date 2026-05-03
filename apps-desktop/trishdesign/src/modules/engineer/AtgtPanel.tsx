/**
 * TrishDesign Phase 28.5 — Panel Vẽ hiện trạng ATGT.
 *
 * Workflow giống HHMĐ:
 *   - Project list → Active project
 *   - Segment list → Active segment
 *   - Items table với form thêm theo category
 *   - Vẽ AutoCAD + Xuất Excel
 */

import { useEffect, useMemo, useState } from 'react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { autoCadStatus, autoCadEnsureDocument, autoCadSendCommands } from '../../lib/autocad.js';
import { generateAtgtCommands, computeAtgtStats } from '../../lib/atgt-script.js';
import {
  type AtgtDb,
  type AtgtProject,
  type AtgtSegment,
  type AtgtItem,
  type AtgtCategory,
  type RoadSide,
  type BienBaoItem,
  type VachSonItem,
  type DenTHItem,
  type HoLanItem,
  type CocTieuItem,
  type RanhDocItem,
  type CongNgangItem,
  type TieuPQItem,
  type GuongCauItem,
  ATGT_CATEGORIES,
  BIENBAO_GROUPS,
  emptyAtgtDb,
  newAtgtId,
  defaultAtgtSegment,
  defaultAtgtItem,
  formatStationKm,
  autoAtgtSegmentName,
  sideLabel,
  statusLabel,
  getCategoryInfo,
} from '../../lib/atgt-types.js';

const LS_KEY = 'trishdesign:atgt-db';

// =====================================================================
// State management hook
// =====================================================================

function loadDb(): AtgtDb {
  if (typeof window === 'undefined') return emptyAtgtDb();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return emptyAtgtDb();
    return JSON.parse(raw) as AtgtDb;
  } catch {
    return emptyAtgtDb();
  }
}

function saveDb(db: AtgtDb): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function useAtgtDb(): {
  db: AtgtDb;
  setDb: (updater: (prev: AtgtDb) => AtgtDb) => void;
} {
  const [db, setDbState] = useState<AtgtDb>(() => loadDb());
  useEffect(() => {
    saveDb(db);
  }, [db]);
  const setDb = (updater: (prev: AtgtDb) => AtgtDb): void => {
    setDbState((prev) => ({ ...updater(prev), updatedAt: Date.now() }));
  };
  return { db, setDb };
}

// =====================================================================
// Main panel
// =====================================================================

export function AtgtPanel(): JSX.Element {
  const { db, setDb } = useAtgtDb();

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );

  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(
    () => activeProject?.segments[0]?.id ?? null,
  );

  // Sync activeSegmentId khi project đổi
  useEffect(() => {
    if (!activeProject) {
      setActiveSegmentId(null);
      return;
    }
    if (!activeProject.segments.find((s) => s.id === activeSegmentId)) {
      setActiveSegmentId(activeProject.segments[0]?.id ?? null);
    }
  }, [activeProject, activeSegmentId]);

  const activeSegment = useMemo(
    () => activeProject?.segments.find((s) => s.id === activeSegmentId) ?? null,
    [activeProject, activeSegmentId],
  );

  const [acadRunning, setAcadRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  // Inline dialog state — không dùng window.prompt/confirm native
  type DialogState =
    | { kind: 'prompt'; title: string; value: string; placeholder?: string; onSubmit: (v: string) => void }
    | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
    | null;
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    autoCadStatus().then((s) => setAcadRunning(s.running));
    const t = setInterval(() => autoCadStatus().then((s) => setAcadRunning(s.running)), 5000);
    return () => clearInterval(t);
  }, []);

  // -------------------------------------------------------------------
  // Project actions — inline dialog thay native popup
  // -------------------------------------------------------------------
  function handleNewProject(): void {
    setDialog({
      kind: 'prompt',
      title: 'Tạo dự án ATGT mới',
      value: 'Dự án ATGT mới',
      placeholder: 'VD: Đường Lê Lợi, Quận 1',
      onSubmit: (name) => {
        const id = newAtgtId('proj');
        const proj: AtgtProject = {
          id,
          name: name.trim(),
          segments: [{ id: newAtgtId('seg'), ...defaultAtgtSegment() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDb((prev) => ({
          ...prev,
          projects: [...prev.projects, proj],
          activeProjectId: id,
        }));
        setStatusMsg(`✓ Đã tạo dự án "${name.trim()}"`);
      },
    });
  }

  function handleSelectProject(id: string): void {
    setDb((prev) => ({ ...prev, activeProjectId: id }));
  }

  function handleDeleteProject(id: string): void {
    const target = db.projects.find((p) => p.id === id);
    if (!target) return;
    setDialog({
      kind: 'confirm',
      title: 'Xóa dự án',
      message: `Xóa dự án "${target.name}"? Hành động này không thể hoàn tác.`,
      danger: true,
      onConfirm: () => {
        setDb((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== id),
          activeProjectId: prev.activeProjectId === id
            ? (prev.projects.find((p) => p.id !== id)?.id ?? null)
            : prev.activeProjectId,
        }));
      },
    });
  }

  function handleRenameProject(): void {
    if (!activeProject) return;
    setDialog({
      kind: 'prompt',
      title: 'Đổi tên dự án',
      value: activeProject.name,
      onSubmit: (name) => {
        setDb((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === activeProject.id ? { ...p, name: name.trim() } : p,
          ),
        }));
      },
    });
  }

  // -------------------------------------------------------------------
  // Segment actions
  // -------------------------------------------------------------------
  function handleAddSegment(): void {
    if (!activeProject) return;
    const segDefault = defaultAtgtSegment();
    const newSeg: AtgtSegment = {
      id: newAtgtId('seg'),
      ...segDefault,
      name: autoAtgtSegmentName(segDefault.startStation, segDefault.endStation),
    };
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...p, segments: [...p.segments, newSeg] } : p,
      ),
    }));
    setActiveSegmentId(newSeg.id);
  }

  function updateActiveSegment(updater: (s: AtgtSegment) => AtgtSegment): void {
    if (!activeProject || !activeSegment) return;
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id
          ? {
              ...p,
              segments: p.segments.map((s) => (s.id === activeSegment.id ? updater(s) : s)),
            }
          : p,
      ),
    }));
  }

  function handleDeleteSegment(): void {
    if (!activeProject || !activeSegment) return;
    setDialog({
      kind: 'confirm',
      title: 'Xóa đoạn',
      message: `Xóa đoạn "${activeSegment.name}" khỏi dự án "${activeProject.name}"?`,
      danger: true,
      onConfirm: () => {
        setDb((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === activeProject.id
              ? { ...p, segments: p.segments.filter((s) => s.id !== activeSegment.id) }
              : p,
          ),
        }));
      },
    });
  }

  // -------------------------------------------------------------------
  // Item actions
  // -------------------------------------------------------------------
  function handleAddItem(item: AtgtItem): void {
    updateActiveSegment((s) => ({ ...s, items: [...s.items, item] }));
    setStatusMsg(`✓ Đã thêm ${getCategoryInfo(item.category).name}`);
  }

  function handleDeleteItem(id: string): void {
    updateActiveSegment((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  }

  // -------------------------------------------------------------------
  // Data Input: Paste TSV from clipboard + Import Excel
  // -------------------------------------------------------------------
  /**
   * Paste TSV format (mỗi dòng = 1 item):
   *   category<TAB>station<TAB>side<TAB>cachTim<TAB>extra1<TAB>extra2...
   * VD biển báo: BIENBAO\\t100\\tright\\t1.5\\tP.103a\\tP\\t0.7
   * VD vạch sơn: VACHSON\\t50\\tcenter\\t0\\ttim\\t100\\t0.15\\ttrue
   */
  async function handlePasteTsv(): Promise<void> {
    if (!activeSegment) {
      setStatusMsg('Chưa chọn đoạn để paste.');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) { setStatusMsg('Clipboard rỗng.'); return; }
      const newItems: AtgtItem[] = [];
      for (const line of lines) {
        const cols = line.split(/\t|,|;/).map((c) => c.trim());
        if (cols.length < 4) continue;
        const cat = (cols[0] ?? '').toUpperCase() as AtgtCategory;
        const station = Number(cols[1]) || 0;
        const side = (cols[2] === 'left' || cols[2] === 'right' || cols[2] === 'center') ? cols[2] : 'right';
        const cachTim = Number(cols[3]) || 1.5;
        const it = { ...defaultAtgtItem(cat, station), side, cachTim, status: 'good' } as AtgtItem;
        // Specific extras theo category
        if (cat === 'BIENBAO' && cols[4]) (it as BienBaoItem).code = cols[4];
        if (cat === 'VACHSON') {
          if (cols[4]) (it as VachSonItem).vachType = cols[4] as any;
          if (cols[5]) (it as VachSonItem).length = Number(cols[5]) || 50;
          if (cols[6]) (it as VachSonItem).width = Number(cols[6]) || 0.15;
          if (cols[7]) (it as VachSonItem).isContinuous = cols[7] === 'true';
        }
        if (cat === 'COCTIEU' || cat === 'TIEUPQ') {
          if (cols[4]) (it as any).count = Number(cols[4]) || 10;
          if (cols[5]) (it as any).spacing = Number(cols[5]) || 5;
        }
        newItems.push(it);
      }
      if (newItems.length === 0) {
        setStatusMsg('✗ Không parse được dòng nào. Format: CATEGORY\\tstation\\tside\\tcachTim\\textra...');
        return;
      }
      updateActiveSegment((s) => ({ ...s, items: [...s.items, ...newItems] }));
      setStatusMsg(`✓ Đã paste ${newItems.length} đối tượng từ clipboard.`);
    } catch (e) { setStatusMsg(`✗ ${String(e)}`); }
  }

  // -------------------------------------------------------------------
  // AutoCAD draw
  // -------------------------------------------------------------------
  async function handleDrawAcad(): Promise<void> {
    if (!activeProject) return;
    if (!acadRunning) {
      await dialog.message('Chưa kết nối AutoCAD. Mở AutoCAD với 1 bản vẽ trống trước.', { kind: 'warning' });
      return;
    }
    if (activeProject.segments.every((s) => s.items.length === 0)) {
      setStatusMsg('Không có dữ liệu để vẽ.');
      return;
    }
    try {
      setStatusMsg('⏳ Đang gửi lệnh tới AutoCAD...');
      await autoCadEnsureDocument();
      const cmds = generateAtgtCommands(activeProject);
      const sent = await autoCadSendCommands(cmds);
      setStatusMsg(`✓ Đã gửi ${sent} lệnh ATGT vào AutoCAD.`);
    } catch (e) {
      setStatusMsg(`✗ Lỗi: ${String(e)}`);
    }
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (!activeProject) {
    return (
      <>
        <div className="atgt-shell">
          <div className="atgt-selector-bar">
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự án ATGT mới</button>
            <span className="muted small">9 loại đối tượng ATGT theo QCVN 41:2019.</span>
            <div style={{ flex: 1 }} />
          </div>
          <div className="empty-banner">
            <h3 className="empty-banner-title">🚸 Chưa có dự án ATGT — hãy tạo dự án mới</h3>
            <p className="empty-banner-msg">
              Tạo dự án để bắt đầu quản lý 9 loại đối tượng ATGT theo QCVN 41:2019: biển báo, vạch sơn, đèn tín hiệu, hộ lan, cọc tiêu, rãnh dọc, cống ngang, tiêu phản quang, gương cầu lồi.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự án ATGT mới</button>
            {db.projects.length > 0 && (
              <div className="empty-banner-recent">
                <div className="atgt-recent-label">Dự án gần đây:</div>
                {db.projects.map((p) => (
                  <button key={p.id} type="button" className="atgt-recent-item" onClick={() => handleSelectProject(p.id)}>
                    📁 {p.name} <span className="muted small">({p.segments.length} đoạn)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <InlineDialog state={dialog} onClose={() => setDialog(null)} />
      </>
    );
  }

  return (
    <div className="atgt-shell">
      {/* Selector bar */}
      <div className="atgt-selector-bar">
        <select
          className="td-select atgt-project-select"
          value={activeProject.id}
          onChange={(e) => handleSelectProject(e.target.value)}
        >
          {db.projects.map((p) => (
            <option key={p.id} value={p.id}>📁 {p.name}</option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={handleNewProject} title="Tạo dự án mới">
          ➕
        </button>
        <button type="button" className="btn btn-ghost" onClick={handleRenameProject} title="Đổi tên dự án">
          ✏
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(activeProject.id)} title="Xóa dự án">
          🗑
        </button>
        <span className="atgt-selector-sep">›</span>
        <select
          className="td-select atgt-segment-select"
          value={activeSegmentId ?? ''}
          onChange={(e) => setActiveSegmentId(e.target.value || null)}
        >
          {activeProject.segments.map((s) => (
            <option key={s.id} value={s.id}>📏 {s.name} ({s.items.length})</option>
          ))}
        </select>
        <button type="button" className="btn btn-ghost" onClick={handleAddSegment} title="Thêm đoạn">
          ➕
        </button>
        {activeSegment && (
          <button type="button" className="btn btn-ghost" onClick={handleDeleteSegment} title="Xóa đoạn">
            🗑
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span className="atgt-acad-status">
          AutoCAD: {acadRunning
            ? <span className="atgt-status-on">● Đã kết nối</span>
            : <span className="atgt-status-off">● Chưa mở</span>
          }
        </span>
      </div>

      {activeSegment ? (
        <>
          <SegmentEditor segment={activeSegment} onUpdate={updateActiveSegment} />
          <ItemForm
            onAdd={(item) => handleAddItem(item)}
            defaultStation={activeSegment.startStation}
          />
          <ItemTable
            items={activeSegment.items}
            onDelete={handleDeleteItem}
          />
          <StatsPanel segment={activeSegment} />

          <div className="atgt-action-bar">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleDrawAcad()}
              disabled={!acadRunning}
            >
              📐 Vẽ AutoCAD
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void handlePasteTsv()}
              title="Paste danh sách từ Excel/clipboard. Format mỗi dòng: CATEGORY⇥station⇥side⇥cachTim⇥extra..."
            >
              📋 Paste TSV
            </button>
            <span className="atgt-status-msg">{statusMsg}</span>
          </div>
        </>
      ) : (
        <div className="atgt-no-segment">
          <p>Chưa có đoạn nào.</p>
          <button type="button" className="btn btn-primary" onClick={handleAddSegment}>
            ➕ Thêm đoạn đầu tiên
          </button>
        </div>
      )}

      <InlineDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

// =====================================================================
// InlineDialog — modal styled không dùng native window.prompt/confirm
// =====================================================================

type InlineDialogState =
  | { kind: 'prompt'; title: string; value: string; placeholder?: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

function InlineDialog({
  state,
  onClose,
}: {
  state: InlineDialogState;
  onClose: () => void;
}): JSX.Element {
  const [input, setInput] = useState('');

  // Sync input khi state mới
  useEffect(() => {
    if (state?.kind === 'prompt') setInput(state.value);
  }, [state]);

  if (!state) return <></>;

  function handleSubmit(): void {
    if (state?.kind === 'prompt') {
      const trimmed = input.trim();
      if (!trimmed) return;
      state.onSubmit(trimmed);
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
          <input
            type="text"
            className="td-input"
            autoFocus
            value={input}
            placeholder={state.placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') onClose();
            }}
          />
        ) : (
          <p className="atgt-dialog-msg">{state.message}</p>
        )}
        <div className="atgt-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className={state.kind === 'confirm' && state.danger ? 'btn atgt-dialog-danger' : 'btn btn-primary'}
            onClick={handleSubmit}
          >
            {state.kind === 'prompt' ? '✓ Lưu' : state.danger ? '🗑 Xóa' : '✓ OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// SegmentEditor — chỉnh sửa thông tin đoạn (start/end/width)
// =====================================================================

function SegmentEditor({
  segment,
  onUpdate,
}: {
  segment: AtgtSegment;
  onUpdate: (updater: (s: AtgtSegment) => AtgtSegment) => void;
}): JSX.Element {
  return (
    <div className="atgt-section">
      <div className="atgt-section-title">📏 Thông tin đoạn đường</div>
      <div className="atgt-grid-4">
        <label className="td-field">
          <span className="td-field-label">Tên đoạn</span>
          <input
            type="text"
            className="td-input"
            value={segment.name}
            onChange={(e) => onUpdate((s) => ({ ...s, name: e.target.value }))}
          />
        </label>
        <label className="td-field">
          <span className="td-field-label">Lý trình bắt đầu (m)</span>
          <input
            type="number"
            className="td-input"
            value={segment.startStation}
            onChange={(e) => onUpdate((s) => ({ ...s, startStation: Number(e.target.value) || 0 }))}
          />
        </label>
        <label className="td-field">
          <span className="td-field-label">Lý trình kết thúc (m)</span>
          <input
            type="number"
            className="td-input"
            value={segment.endStation}
            onChange={(e) => onUpdate((s) => ({ ...s, endStation: Number(e.target.value) || 0 }))}
          />
        </label>
        <label className="td-field">
          <span className="td-field-label">Bề rộng đường (m)</span>
          <input
            type="number"
            className="td-input"
            step={0.5}
            value={segment.roadWidth}
            onChange={(e) => onUpdate((s) => ({ ...s, roadWidth: Number(e.target.value) || 7 }))}
          />
        </label>
      </div>
    </div>
  );
}

// =====================================================================
// ItemForm — form thêm item theo category (dynamic fields)
// =====================================================================

function ItemForm({
  onAdd,
  defaultStation,
}: {
  onAdd: (item: AtgtItem) => void;
  defaultStation: number;
}): JSX.Element {
  const [category, setCategory] = useState<AtgtCategory>('BIENBAO');
  const [draft, setDraft] = useState<AtgtItem>(() => defaultAtgtItem('BIENBAO', defaultStation));

  // Reset draft khi đổi category
  function handleCategoryChange(c: AtgtCategory): void {
    setCategory(c);
    setDraft(defaultAtgtItem(c, defaultStation));
  }

  function handleAddClick(): void {
    onAdd({ ...draft, id: newAtgtId('item') });
    // Keep category, reset station += 50m, fields reset
    setDraft({
      ...defaultAtgtItem(category, draft.station + 50),
      side: draft.side,
      status: draft.status,
    } as AtgtItem);
  }

  return (
    <div className="atgt-section">
      <div className="atgt-section-title">➕ Thêm đối tượng ATGT</div>
      <div className="atgt-category-tabs">
        {ATGT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`atgt-tab${category === c.id ? ' atgt-tab-active' : ''}`}
            onClick={() => handleCategoryChange(c.id)}
          >
            <span>{c.icon}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="atgt-grid-4">
        {/* Common fields */}
        <label className="td-field">
          <span className="td-field-label">Lý trình (m)</span>
          <input
            type="number"
            className="td-input"
            value={draft.station}
            onChange={(e) => setDraft({ ...draft, station: Number(e.target.value) || 0 } as AtgtItem)}
          />
        </label>
        <label className="td-field">
          <span className="td-field-label">Vị trí</span>
          <select
            className="td-select"
            value={draft.side}
            onChange={(e) => setDraft({ ...draft, side: e.target.value as RoadSide } as AtgtItem)}
          >
            <option value="left">Trái (T)</option>
            <option value="right">Phải (P)</option>
            <option value="center">Tim đường</option>
          </select>
        </label>
        <label className="td-field">
          <span className="td-field-label">Cách tim đường (m)</span>
          <input
            type="number"
            step={0.1}
            className="td-input"
            value={draft.cachTim ?? 1.5}
            onChange={(e) => setDraft({ ...draft, cachTim: Number(e.target.value) || 0 } as AtgtItem)}
          />
        </label>
        <label className="td-field">
          <span className="td-field-label">Tình trạng</span>
          <select
            className="td-select"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as AtgtItem['status'] } as AtgtItem)}
          >
            <option value="good">Tốt</option>
            <option value="damaged">Hư hỏng</option>
            <option value="missing">Mất</option>
            <option value="new">Mới</option>
          </select>
        </label>
        <label className="td-field">
          <span className="td-field-label">Ghi chú</span>
          <input
            type="text"
            className="td-input"
            value={draft.note ?? ''}
            onChange={(e) => setDraft({ ...draft, note: e.target.value } as AtgtItem)}
          />
        </label>

        {/* Dynamic fields per category */}
        {renderCategoryFields(category, draft, setDraft)}
      </div>

      <div style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" onClick={handleAddClick}>
          ➕ Thêm vào danh sách
        </button>
      </div>
    </div>
  );
}

function renderCategoryFields(
  category: AtgtCategory,
  draft: AtgtItem,
  setDraft: (item: AtgtItem) => void,
): JSX.Element {
  const update = (patch: Partial<AtgtItem>): void => {
    setDraft({ ...draft, ...patch } as AtgtItem);
  };

  switch (category) {
    case 'BIENBAO': {
      const it = draft as BienBaoItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Nhóm biển</span>
            <select className="td-select" value={it.group} onChange={(e) => update({ group: e.target.value as BienBaoItem['group'] })}>
              {BIENBAO_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Mã biển (vd P.103a)</span>
            <input type="text" className="td-input" value={it.code} onChange={(e) => update({ code: e.target.value })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Đường kính (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.diameter} onChange={(e) => update({ diameter: Number(e.target.value) || 0.7 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Chiều cao cột (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.poleHeight} onChange={(e) => update({ poleHeight: Number(e.target.value) || 2.2 })} />
          </label>
        </>
      );
    }
    case 'VACHSON': {
      const it = draft as VachSonItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Loại vạch</span>
            <select className="td-select" value={it.vachType} onChange={(e) => update({ vachType: e.target.value as VachSonItem['vachType'] })}>
              <option value="tim">Vạch tim</option>
              <option value="lan">Vạch chia làn</option>
              <option value="mep">Vạch mép</option>
              <option value="qua_duong">Qua đường</option>
              <option value="dung_xe">Dừng xe</option>
              <option value="gianh_uu_tien">Giành ưu tiên</option>
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Chiều dài (m)</span>
            <input type="number" className="td-input" value={it.length} onChange={(e) => update({ length: Number(e.target.value) || 50 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Bề rộng vạch (m)</span>
            <input type="number" className="td-input" step={0.05} value={it.width} onChange={(e) => update({ width: Number(e.target.value) || 0.15 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Kiểu vạch</span>
            <select className="td-select" value={it.isContinuous ? 'true' : 'false'} onChange={(e) => update({ isContinuous: e.target.value === 'true' })}>
              <option value="true">Liền</option>
              <option value="false">Đứt</option>
            </select>
          </label>
        </>
      );
    }
    case 'DENTH': {
      const it = draft as DenTHItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Loại đèn</span>
            <select className="td-select" value={it.denType} onChange={(e) => update({ denType: e.target.value as DenTHItem['denType'] })}>
              <option value="xe">Đèn xe</option>
              <option value="nguoi">Đèn người</option>
              <option value="mui_ten">Đèn mũi tên</option>
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Cao cột (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.poleHeight} onChange={(e) => update({ poleHeight: Number(e.target.value) || 4.5 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Vươn cần (m)</span>
            <input type="number" className="td-input" step={0.5} value={it.cantilever} onChange={(e) => update({ cantilever: Number(e.target.value) || 0 })} />
          </label>
        </>
      );
    }
    case 'HOLAN': {
      const it = draft as HoLanItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Loại</span>
            <select className="td-select" value={it.holanType} onChange={(e) => update({ holanType: e.target.value as HoLanItem['holanType'] })}>
              <option value="ho_lan_ton">Hộ lan tôn sóng</option>
              <option value="ho_lan_betong">Hộ lan bê tông</option>
              <option value="go_giam_toc">Gờ giảm tốc</option>
              <option value="chong_loa">Chống lóa</option>
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Chiều dài (m)</span>
            <input type="number" className="td-input" value={it.length} onChange={(e) => update({ length: Number(e.target.value) || 50 })} />
          </label>
        </>
      );
    }
    case 'COCTIEU': {
      const it = draft as CocTieuItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Khoảng cách cọc (m)</span>
            <input type="number" className="td-input" step={0.5} value={it.spacing} onChange={(e) => update({ spacing: Number(e.target.value) || 5 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Số lượng cọc</span>
            <input type="number" className="td-input" value={it.count} onChange={(e) => update({ count: Number(e.target.value) || 10 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Cao cọc (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.height} onChange={(e) => update({ height: Number(e.target.value) || 0.6 })} />
          </label>
        </>
      );
    }
    case 'RANHDOC': {
      const it = draft as RanhDocItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Loại rãnh</span>
            <select className="td-select" value={it.ranhType} onChange={(e) => update({ ranhType: e.target.value as RanhDocItem['ranhType'] })}>
              <option value="dat">Đất</option>
              <option value="da_xay">Đá xây</option>
              <option value="betong">Bê tông</option>
              <option value="nap_be">Nắp bê tông</option>
              <option value="tron">Tròn</option>
              <option value="hinh_thang">Hình thang</option>
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Chiều dài (m)</span>
            <input type="number" className="td-input" value={it.length} onChange={(e) => update({ length: Number(e.target.value) || 100 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Rộng đáy (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.width} onChange={(e) => update({ width: Number(e.target.value) || 0.4 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Sâu (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.depth} onChange={(e) => update({ depth: Number(e.target.value) || 0.4 })} />
          </label>
        </>
      );
    }
    case 'CONGNGANG': {
      const it = draft as CongNgangItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Loại cống</span>
            <select className="td-select" value={it.congType} onChange={(e) => update({ congType: e.target.value as CongNgangItem['congType'] })}>
              <option value="tron">Cống tròn</option>
              <option value="vuong">Cống vuông</option>
              <option value="hop">Cống hộp</option>
              <option value="ban">Cống bản</option>
            </select>
          </label>
          <label className="td-field">
            <span className="td-field-label">Đường kính/khẩu độ (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.diameter} onChange={(e) => update({ diameter: Number(e.target.value) || 1.0 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Chiều dài cống (m)</span>
            <input type="number" className="td-input" step={0.5} value={it.length} onChange={(e) => update({ length: Number(e.target.value) || 8 })} />
          </label>
        </>
      );
    }
    case 'TIEUPQ': {
      const it = draft as TieuPQItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Khoảng cách (m)</span>
            <input type="number" className="td-input" value={it.spacing} onChange={(e) => update({ spacing: Number(e.target.value) || 10 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Số lượng</span>
            <input type="number" className="td-input" value={it.count} onChange={(e) => update({ count: Number(e.target.value) || 10 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Màu</span>
            <select className="td-select" value={it.color} onChange={(e) => update({ color: e.target.value as TieuPQItem['color'] })}>
              <option value="yellow">Vàng</option>
              <option value="red">Đỏ</option>
              <option value="white">Trắng</option>
            </select>
          </label>
        </>
      );
    }
    case 'GUONGCAU': {
      const it = draft as GuongCauItem;
      return (
        <>
          <label className="td-field">
            <span className="td-field-label">Đường kính (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.diameter} onChange={(e) => update({ diameter: Number(e.target.value) || 0.6 })} />
          </label>
          <label className="td-field">
            <span className="td-field-label">Cao cột (m)</span>
            <input type="number" className="td-input" step={0.1} value={it.poleHeight} onChange={(e) => update({ poleHeight: Number(e.target.value) || 4 })} />
          </label>
        </>
      );
    }
  }
}

// =====================================================================
// ItemTable — bảng list items
// =====================================================================

function ItemTable({
  items,
  onDelete,
}: {
  items: AtgtItem[];
  onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <div className="atgt-section">
      <div className="atgt-section-title">📋 Danh sách đối tượng ({items.length})</div>
      <div className="atgt-table-wrap">
        <table className="atgt-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Lý trình</th>
              <th style={{ width: 180 }}>Loại</th>
              <th style={{ width: 90 }}>Vị trí</th>
              <th style={{ width: 90 }}>Cách tim</th>
              <th>Chi tiết</th>
              <th style={{ width: 90 }}>Tình trạng</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="atgt-empty-row">Chưa có đối tượng nào.</td></tr>
            ) : items.map((it) => {
              const cat = getCategoryInfo(it.category);
              return (
                <tr key={it.id}>
                  <td>{formatStationKm(it.station)}</td>
                  <td>{cat.icon} {cat.name}</td>
                  <td>{sideLabel(it.side)}</td>
                  <td>{(it.cachTim ?? 0).toFixed(1)}m</td>
                  <td className="atgt-detail-cell">{describeItem(it)}</td>
                  <td><StatusBadge status={it.status} /></td>
                  <td>
                    <button type="button" className="atgt-del-btn" onClick={() => onDelete(it.id)}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function describeItem(it: AtgtItem): string {
  switch (it.category) {
    case 'BIENBAO': return `${it.code} · Ø${it.diameter}m · cột ${it.poleHeight}m`;
    case 'VACHSON': return `${it.vachType} · ${it.length}m × ${it.width}m · ${it.isContinuous ? 'liền' : 'đứt'}`;
    case 'DENTH': return `${it.denType} · cột ${it.poleHeight}m`;
    case 'HOLAN': return `${it.holanType} · ${it.length}m`;
    case 'COCTIEU': return `${it.count} cọc × ${it.spacing}m`;
    case 'RANHDOC': return `${it.ranhType} · ${it.length}m × ${it.width}×${it.depth}m`;
    case 'CONGNGANG': return `${it.congType} · Ø${it.diameter}m · L=${it.length}m`;
    case 'TIEUPQ': return `${it.count} tiêu × ${it.spacing}m · màu ${it.color}`;
    case 'GUONGCAU': return `Ø${it.diameter}m · cột ${it.poleHeight}m`;
  }
}

function StatusBadge({ status }: { status: AtgtItem['status'] }): JSX.Element {
  const colors: Record<AtgtItem['status'], { bg: string; fg: string }> = {
    good: { bg: 'rgba(16,185,129,0.14)', fg: '#047857' },
    damaged: { bg: 'rgba(245,158,11,0.14)', fg: '#b45309' },
    missing: { bg: 'rgba(239,68,68,0.14)', fg: '#b91c1c' },
    new: { bg: 'rgba(59,130,246,0.14)', fg: '#1e40af' },
  };
  const c = colors[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      background: c.bg,
      color: c.fg,
      fontSize: 11,
      fontWeight: 600,
    }}>{statusLabel(status)}</span>
  );
}

function StatsPanel({ segment }: { segment: AtgtSegment }): JSX.Element {
  const stats = useMemo(() => computeAtgtStats(segment), [segment]);
  if (stats.total === 0) return <></>;
  return (
    <div className="atgt-section">
      <div className="atgt-section-title">📊 Thống kê đoạn ({stats.total} đối tượng)</div>
      <div className="atgt-stats-row">
        {stats.byCategory.map((c) => {
          const info = ATGT_CATEGORIES.find((x) => x.id === c.id);
          return (
            <div key={c.id} className="atgt-stat-chip">
              <span>{info?.icon}</span>
              <span>{c.name}:</span>
              <strong>{c.count}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
