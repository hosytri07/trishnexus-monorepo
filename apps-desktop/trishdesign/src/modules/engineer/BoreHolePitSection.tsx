/**
 * TrishDesign Phase 42 wave 8 — Section "Lỗ khoan + Hố đào" trong panel Vẽ hư hỏng mặt đường.
 *
 * 2 bảng song song:
 *   - 🔵 Lỗ khoan (BoreHole) — vẽ hình tròn + hatch trong AutoCAD
 *   - 🟧 Hố đào   (ExcavationPit) — vẽ hình vuông + hatch
 *
 * Mỗi lỗ / hố có nhiều LỚP (BorePitLayer): tên + chiều dày.
 * Bảng thống kê tự sinh tổng hợp các lớp theo từng lỗ / hố.
 *
 * Field cơ bản (theo yêu cầu Trí 2026-05-17):
 *   - Số hiệu (pieceNumber)
 *   - Lý trình (m, tính từ đầu đoạn)
 *   - Cách tim (m)
 *   - Vị trí (left/right/center)
 *   - Các lớp: tên + chiều dày
 */

import { useMemo, useState } from 'react';
import type { Project, RoadSegment, BoreHole, ExcavationPit, BorePitLayer, DamageSide } from '../../types.js';
import { newId, formatStation } from '../../types.js';
import type { useDesignDb } from '../../state.js';

/**
 * Phase 42 wave 8 — Type của designDb hook trả về.
 * BẮT BUỘC nhận qua props (KHÔNG gọi useDesignDb() local) — vì useDesignDb tạo
 * state LOCAL mỗi lần gọi, instance khác sẽ không sync với HuHongPanel.
 */
type DesignDbApi = ReturnType<typeof useDesignDb>;

interface Props {
  project: Project;
  segment: RoadSegment;
  designDb: DesignDbApi;
}

/**
 * Section root — render 2 bảng + 2 bảng thống kê.
 */
export function BoreHolePitSection({ project, segment, designDb }: Props): JSX.Element {
  const boreHoles = segment.boreHoles ?? [];
  const pits = segment.excavationPits ?? [];

  function handleAddBoreHole(): void {
    const last = boreHoles[boreHoles.length - 1];
    const nextNum = last
      ? incrementCode(last.pieceNumber, 'LK')
      : 'LK1';
    designDb.addBoreHole(project.id, segment.id, {
      pieceNumber: nextNum,
      startStation: 0,
      side: 'right',
      cachTim: 1.0,
      layers: [],
    });
  }

  function handleAddPit(): void {
    const last = pits[pits.length - 1];
    const nextNum = last
      ? incrementCode(last.pieceNumber, 'HĐ')
      : 'HĐ1';
    designDb.addExcavationPit(project.id, segment.id, {
      pieceNumber: nextNum,
      startStation: 0,
      side: 'right',
      cachTim: 1.0,
      layers: [],
    });
  }

  return (
    <div className="bh-pit-section">
      <div className="bh-pit-grid">
        <BoreHoleTable
          project={project}
          segment={segment}
          designDb={designDb}
          holes={boreHoles}
          onAdd={handleAddBoreHole}
        />
        <PitTable
          project={project}
          segment={segment}
          designDb={designDb}
          pits={pits}
          onAdd={handleAddPit}
        />
      </div>

      {(boreHoles.length > 0 || pits.length > 0) && (
        <div className="bh-pit-grid" style={{ marginTop: 16 }}>
          {boreHoles.length > 0 && <BoreHoleSummaryTable holes={boreHoles} />}
          {pits.length > 0 && <PitSummaryTable pits={pits} />}
        </div>
      )}

      <SectionStyles />
    </div>
  );
}

/* ============================================================
 * BoreHole table (lỗ khoan — hình tròn)
 * ============================================================ */
function BoreHoleTable({
  project, segment, designDb, holes, onAdd,
}: {
  project: Project; segment: RoadSegment; designDb: DesignDbApi; holes: BoreHole[]; onAdd: () => void;
}): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeleteSelected(): void {
    selectedIds.forEach((id) => designDb.deleteBoreHole(project.id, segment.id, id));
    setSelectedIds(new Set());
  }

  function handleClearAll(): void {
    designDb.setBoreHoles(project.id, segment.id, []);
    setSelectedIds(new Set());
  }

  async function handlePaste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseTabularInput(text);
      if (parsed.length === 0) return;
      const next: BoreHole[] = [
        ...holes,
        ...parsed.map((row, i) => ({
          id: newId('bh'),
          segmentId: segment.id,
          pieceNumber: row.pieceNumber || `LK${holes.length + i + 1}`,
          startStation: row.startStation,
          side: row.side,
          cachTim: row.cachTim,
          layers: [],
        } as BoreHole)),
      ];
      designDb.setBoreHoles(project.id, segment.id, next);
    } catch (e) {
      console.warn('Paste failed:', e);
    }
  }

  return (
    <div className="bh-pit-table-wrap">
      <header className="bh-pit-table-head">
        <h3>🔵 Lỗ khoan ({holes.length})</h3>
        <div className="bh-pit-actions">
          <button type="button" className="acad-btn acad-btn-ghost" onClick={onAdd}>+ Thêm</button>
          <button type="button" className="acad-btn acad-btn-ghost" onClick={() => void handlePaste()} title="Dán từ Excel (cột: số hiệu / lý trình m / cách tim / trái phải)">📋 Dán</button>
          <button type="button" className="acad-btn acad-btn-ghost" disabled={selectedIds.size === 0} onClick={handleDeleteSelected}>🗑 Xóa ({selectedIds.size})</button>
          <button type="button" className="acad-btn acad-btn-ghost" disabled={holes.length === 0} onClick={handleClearAll}>♻ Xóa bảng</button>
        </div>
      </header>

      {holes.length === 0 ? (
        <p className="bh-pit-empty">Chưa có lỗ khoan. Bấm "+ Thêm" hoặc 📋 Dán từ Excel.</p>
      ) : (
        <table className="bh-pit-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ width: 80 }}>Số hiệu</th>
              <th style={{ width: 110 }}>Lý trình (m)</th>
              <th style={{ width: 90 }}>Cách tim (m)</th>
              <th style={{ width: 100 }}>Vị trí</th>
              <th style={{ width: 70 }}>Số lớp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holes.map((h, idx) => (
              <BoreHoleRow
                key={h.id}
                project={project}
                segment={segment}
                designDb={designDb}
                hole={h}
                index={idx}
                selected={selectedIds.has(h.id)}
                expanded={expandedId === h.id}
                onToggleSelect={() => toggleSelect(h.id)}
                onToggleExpand={() => setExpandedId(expandedId === h.id ? null : h.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BoreHoleRow({
  project, segment, designDb, hole, index, selected, expanded, onToggleSelect, onToggleExpand,
}: {
  project: Project; segment: RoadSegment; designDb: DesignDbApi; hole: BoreHole; index: number;
  selected: boolean; expanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
}): JSX.Element {

  function patch(p: Partial<BoreHole>): void {
    designDb.updateBoreHole(project.id, segment.id, hole.id, p);
  }

  return (
    <>
      <tr className={selected ? 'bh-row-selected' : ''}>
        <td><input type="checkbox" checked={selected} onChange={onToggleSelect} /></td>
        <td><input className="bh-cell-input" value={hole.pieceNumber} onChange={(e) => patch({ pieceNumber: e.target.value })} /></td>
        <td><input className="bh-cell-input" type="number" step={0.1} value={hole.startStation} onChange={(e) => patch({ startStation: Number(e.target.value) || 0 })} /></td>
        <td><input className="bh-cell-input" type="number" step={0.1} value={hole.cachTim ?? 0} onChange={(e) => patch({ cachTim: Number(e.target.value) || 0 })} /></td>
        <td>
          <select className="bh-cell-input" value={hole.side} onChange={(e) => patch({ side: e.target.value as DamageSide })}>
            <option value="left">Trái</option>
            <option value="right">Phải</option>
            <option value="center">Tim</option>
          </select>
        </td>
        <td style={{ textAlign: 'center' }}>{hole.layers.length}</td>
        <td style={{ textAlign: 'right' }}>
          <button type="button" className="acad-btn acad-btn-ghost bh-row-btn" onClick={onToggleExpand} title="Sửa các lớp">
            {expanded ? '▼ Đóng' : `📚 Lớp (${hole.layers.length})`}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <LayerEditor
              layers={hole.layers}
              onChange={(layers) => patch({ layers })}
              kind="bore"
              titleHint={`Lỗ khoan ${hole.pieceNumber || `#${index + 1}`} — lý trình ${formatStation(hole.startStation)}`}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================================================
 * ExcavationPit table (hố đào — hình vuông) — pattern y hệt BoreHoleTable
 * ============================================================ */
function PitTable({
  project, segment, designDb, pits, onAdd,
}: {
  project: Project; segment: RoadSegment; designDb: DesignDbApi; pits: ExcavationPit[]; onAdd: () => void;
}): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDeleteSelected(): void {
    selectedIds.forEach((id) => designDb.deleteExcavationPit(project.id, segment.id, id));
    setSelectedIds(new Set());
  }

  function handleClearAll(): void {
    designDb.setExcavationPits(project.id, segment.id, []);
    setSelectedIds(new Set());
  }

  async function handlePaste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseTabularInput(text);
      if (parsed.length === 0) return;
      const next: ExcavationPit[] = [
        ...pits,
        ...parsed.map((row, i) => ({
          id: newId('pit'),
          segmentId: segment.id,
          pieceNumber: row.pieceNumber || `HĐ${pits.length + i + 1}`,
          startStation: row.startStation,
          side: row.side,
          cachTim: row.cachTim,
          layers: [],
        } as ExcavationPit)),
      ];
      designDb.setExcavationPits(project.id, segment.id, next);
    } catch (e) {
      console.warn('Paste failed:', e);
    }
  }

  return (
    <div className="bh-pit-table-wrap">
      <header className="bh-pit-table-head">
        <h3>🟧 Hố đào ({pits.length})</h3>
        <div className="bh-pit-actions">
          <button type="button" className="acad-btn acad-btn-ghost" onClick={onAdd}>+ Thêm</button>
          <button type="button" className="acad-btn acad-btn-ghost" onClick={() => void handlePaste()} title="Dán từ Excel">📋 Dán</button>
          <button type="button" className="acad-btn acad-btn-ghost" disabled={selectedIds.size === 0} onClick={handleDeleteSelected}>🗑 Xóa ({selectedIds.size})</button>
          <button type="button" className="acad-btn acad-btn-ghost" disabled={pits.length === 0} onClick={handleClearAll}>♻ Xóa bảng</button>
        </div>
      </header>

      {pits.length === 0 ? (
        <p className="bh-pit-empty">Chưa có hố đào. Bấm "+ Thêm" hoặc 📋 Dán từ Excel.</p>
      ) : (
        <table className="bh-pit-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th style={{ width: 80 }}>Số hiệu</th>
              <th style={{ width: 110 }}>Lý trình (m)</th>
              <th style={{ width: 90 }}>Cách tim (m)</th>
              <th style={{ width: 100 }}>Vị trí</th>
              <th style={{ width: 70 }}>Số lớp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pits.map((p, idx) => (
              <PitRow
                key={p.id}
                project={project}
                segment={segment}
                designDb={designDb}
                pit={p}
                index={idx}
                selected={selectedIds.has(p.id)}
                expanded={expandedId === p.id}
                onToggleSelect={() => toggleSelect(p.id)}
                onToggleExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PitRow({
  project, segment, designDb, pit, index, selected, expanded, onToggleSelect, onToggleExpand,
}: {
  project: Project; segment: RoadSegment; designDb: DesignDbApi; pit: ExcavationPit; index: number;
  selected: boolean; expanded: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void;
}): JSX.Element {

  function patch(p: Partial<ExcavationPit>): void {
    designDb.updateExcavationPit(project.id, segment.id, pit.id, p);
  }

  return (
    <>
      <tr className={selected ? 'bh-row-selected' : ''}>
        <td><input type="checkbox" checked={selected} onChange={onToggleSelect} /></td>
        <td><input className="bh-cell-input" value={pit.pieceNumber} onChange={(e) => patch({ pieceNumber: e.target.value })} /></td>
        <td><input className="bh-cell-input" type="number" step={0.1} value={pit.startStation} onChange={(e) => patch({ startStation: Number(e.target.value) || 0 })} /></td>
        <td><input className="bh-cell-input" type="number" step={0.1} value={pit.cachTim ?? 0} onChange={(e) => patch({ cachTim: Number(e.target.value) || 0 })} /></td>
        <td>
          <select className="bh-cell-input" value={pit.side} onChange={(e) => patch({ side: e.target.value as DamageSide })}>
            <option value="left">Trái</option>
            <option value="right">Phải</option>
            <option value="center">Tim</option>
          </select>
        </td>
        <td style={{ textAlign: 'center' }}>{pit.layers.length}</td>
        <td style={{ textAlign: 'right' }}>
          <button type="button" className="acad-btn acad-btn-ghost bh-row-btn" onClick={onToggleExpand} title="Sửa các lớp">
            {expanded ? '▼ Đóng' : `📚 Lớp (${pit.layers.length})`}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <LayerEditor
              layers={pit.layers}
              onChange={(layers) => patch({ layers })}
              kind="pit"
              titleHint={`Hố đào ${pit.pieceNumber || `#${index + 1}`} — lý trình ${formatStation(pit.startStation)}`}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================================================
 * LayerEditor — bảng nhập các lớp cho 1 lỗ khoan / hố đào
 * ============================================================ */
function LayerEditor({
  layers, onChange, kind, titleHint,
}: {
  layers: BorePitLayer[];
  onChange: (next: BorePitLayer[]) => void;
  kind: 'bore' | 'pit';
  titleHint: string;
}): JSX.Element {
  function add(): void {
    const next: BorePitLayer = {
      id: newId('ly'),
      order: layers.length + 1,
      name: '',
      depth: 0,
    };
    onChange([...layers, next]);
  }

  function patch(id: string, p: Partial<BorePitLayer>): void {
    onChange(layers.map((l) => (l.id === id ? { ...l, ...p } : l)));
  }

  function remove(id: string): void {
    onChange(layers.filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i + 1 })));
  }

  function move(id: string, dir: -1 | 1): void {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= layers.length) return;
    const next = [...layers];
    [next[idx], next[swap]] = [next[swap]!, next[idx]!];
    onChange(next.map((l, i) => ({ ...l, order: i + 1 })));
  }

  const totalDepth = layers.reduce((sum, l) => sum + (l.depth || 0), 0);
  const accentColor = kind === 'bore' ? '#2563eb' : '#ea580c';

  return (
    <div className="bh-layer-editor" style={{ borderLeft: `3px solid ${accentColor}` }}>
      <div className="bh-layer-header">
        <strong>{kind === 'bore' ? '🔵' : '🟧'} Các lớp — {titleHint}</strong>
        <span className="muted small">Tổng chiều dày: <b>{totalDepth.toFixed(2)} m</b></span>
        <div style={{ flex: 1 }} />
        <button type="button" className="acad-btn acad-btn-ghost" onClick={add}>+ Thêm lớp</button>
      </div>

      {layers.length === 0 ? (
        <p className="bh-pit-empty">Chưa có lớp nào. Bấm "+ Thêm lớp" để bắt đầu.</p>
      ) : (
        <table className="bh-pit-table bh-layer-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>Lớp #</th>
              <th>Tên lớp / Vật liệu</th>
              <th style={{ width: 130 }}>Chiều dày (m)</th>
              <th>Ghi chú</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {layers.map((l) => (
              <tr key={l.id}>
                <td style={{ textAlign: 'center' }}>{l.order}</td>
                <td><input className="bh-cell-input" placeholder="VD: BTN C12.5 / Cấp phối đá dăm / Đất sét xám" value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} /></td>
                <td><input className="bh-cell-input" type="number" step={0.01} value={l.depth} onChange={(e) => patch(l.id, { depth: Number(e.target.value) || 0 })} /></td>
                <td><input className="bh-cell-input" value={l.notes ?? ''} onChange={(e) => patch(l.id, { notes: e.target.value })} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="acad-btn acad-btn-ghost bh-row-btn" title="Lên" onClick={() => move(l.id, -1)}>▲</button>
                  <button type="button" className="acad-btn acad-btn-ghost bh-row-btn" title="Xuống" onClick={() => move(l.id, 1)}>▼</button>
                  <button type="button" className="acad-btn acad-btn-ghost bh-row-btn" title="Xóa" onClick={() => remove(l.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================================================
 * Bảng thống kê tổng hợp — show theo từng lỗ / hố với từng lớp
 * ============================================================ */
function BoreHoleSummaryTable({ holes }: { holes: BoreHole[] }): JSX.Element {
  const rows = useMemo(() => flattenForSummary(holes), [holes]);
  return (
    <div className="bh-pit-summary-wrap">
      <h3>📊 Thống kê lỗ khoan</h3>
      <table className="bh-pit-table bh-summary-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Số hiệu</th>
            <th>Lý trình</th>
            <th>Vị trí</th>
            <th>Lớp #</th>
            <th>Tên lớp</th>
            <th>Dày (m)</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.parentId}-${r.layerId ?? i}`}>
              <td>{i + 1}</td>
              <td>{r.pieceNumber}</td>
              <td>{formatStation(r.startStation)}</td>
              <td>{sideLabel(r.side)} · {r.cachTim ?? 0}m</td>
              <td style={{ textAlign: 'center' }}>{r.layerOrder ?? '—'}</td>
              <td>{r.layerName ?? <span className="muted small">(không có lớp)</span>}</td>
              <td>{r.layerDepth?.toFixed(2) ?? '—'}</td>
              <td className="muted small">{r.layerNotes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PitSummaryTable({ pits }: { pits: ExcavationPit[] }): JSX.Element {
  const rows = useMemo(() => flattenForSummary(pits), [pits]);
  return (
    <div className="bh-pit-summary-wrap">
      <h3>📊 Thống kê hố đào</h3>
      <table className="bh-pit-table bh-summary-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Số hiệu</th>
            <th>Lý trình</th>
            <th>Vị trí</th>
            <th>Lớp #</th>
            <th>Tên lớp</th>
            <th>Dày (m)</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.parentId}-${r.layerId ?? i}`}>
              <td>{i + 1}</td>
              <td>{r.pieceNumber}</td>
              <td>{formatStation(r.startStation)}</td>
              <td>{sideLabel(r.side)} · {r.cachTim ?? 0}m</td>
              <td style={{ textAlign: 'center' }}>{r.layerOrder ?? '—'}</td>
              <td>{r.layerName ?? <span className="muted small">(không có lớp)</span>}</td>
              <td>{r.layerDepth?.toFixed(2) ?? '—'}</td>
              <td className="muted small">{r.layerNotes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * Helpers
 * ============================================================ */

interface FlatRow {
  parentId: string;
  pieceNumber: string;
  startStation: number;
  side: DamageSide;
  cachTim?: number;
  layerId?: string;
  layerOrder?: number;
  layerName?: string;
  layerDepth?: number;
  layerNotes?: string;
}

function flattenForSummary(items: Array<BoreHole | ExcavationPit>): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const it of items) {
    if (it.layers.length === 0) {
      rows.push({
        parentId: it.id,
        pieceNumber: it.pieceNumber,
        startStation: it.startStation,
        side: it.side,
        cachTim: it.cachTim,
      });
    } else {
      for (const l of it.layers) {
        rows.push({
          parentId: it.id,
          pieceNumber: it.pieceNumber,
          startStation: it.startStation,
          side: it.side,
          cachTim: it.cachTim,
          layerId: l.id,
          layerOrder: l.order,
          layerName: l.name,
          layerDepth: l.depth,
          layerNotes: l.notes,
        });
      }
    }
  }
  return rows;
}

function sideLabel(s: DamageSide): string {
  return s === 'left' ? 'Trái' : s === 'right' ? 'Phải' : 'Tim';
}

/** Tăng số ở cuối mã: "LK1" → "LK2", "LK-3A" → "LK-3A1" fallback */
function incrementCode(prev: string, defaultPrefix: string): string {
  const m = prev.match(/^(.*?)(\d+)([^\d]*)$/);
  if (m) {
    const [, head, num, tail] = m;
    return `${head}${Number(num) + 1}${tail}`;
  }
  return `${prev || defaultPrefix}${1}`;
}

/**
 * Parse TSV/CSV từ clipboard. Mỗi dòng = 1 lỗ khoan / hố đào.
 * Cột: số hiệu | lý trình (m) | cách tim (m) | vị trí (trái/phải/tim hoặc L/R/C)
 * Tab hoặc dấu phẩy đều nhận.
 */
function parseTabularInput(text: string): Array<{ pieceNumber: string; startStation: number; cachTim: number; side: DamageSide }> {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  const out: Array<{ pieceNumber: string; startStation: number; cachTim: number; side: DamageSide }> = [];
  for (const ln of lines) {
    const parts = ln.split(/\t|,/).map((p) => p.trim());
    if (parts.length === 0) continue;
    // Skip header row
    if (/lý\s*trình|station/i.test(parts.join(' '))) continue;
    const num = parts[0] ?? '';
    const station = Number(parts[1] ?? 0) || 0;
    const cachTim = Number(parts[2] ?? 0) || 0;
    const sideRaw = (parts[3] ?? '').toLowerCase();
    const side: DamageSide = /trái|^l/i.test(sideRaw) ? 'left' : /tim|^c/i.test(sideRaw) ? 'center' : 'right';
    out.push({ pieceNumber: num, startStation: station, cachTim, side });
  }
  return out;
}

/* ============================================================
 * Scoped CSS — inject once via <style>
 * ============================================================ */
function SectionStyles(): JSX.Element {
  return (
    <style>{`
      .bh-pit-section { margin-top: 16px; padding: 0 4px; }
      .bh-pit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 1200px) { .bh-pit-grid { grid-template-columns: 1fr; } }

      .bh-pit-table-wrap, .bh-pit-summary-wrap {
        border: 1px solid var(--color-border-subtle, #2a2a30);
        border-radius: 8px;
        background: var(--color-bg-surface, #1a1a1f);
        overflow: hidden;
      }

      .bh-pit-table-head {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: var(--color-bg-elevated, #22222a);
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .bh-pit-table-head h3 { margin: 0; font-size: 13px; font-weight: 600; flex: 1; }
      .bh-pit-actions { display: flex; gap: 4px; }

      .bh-pit-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .bh-pit-table th, .bh-pit-table td {
        padding: 4px 6px; text-align: left; border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .bh-pit-table thead th {
        background: var(--color-bg-elevated, #22222a);
        font-weight: 600; font-size: 11px; color: var(--color-text-muted, #888);
      }
      .bh-row-selected { background: rgba(37, 99, 235, 0.08); }
      .bh-cell-input {
        width: 100%; padding: 3px 6px; font-size: 12px;
        background: transparent; border: 1px solid transparent; border-radius: 4px;
        color: inherit;
      }
      .bh-cell-input:focus {
        outline: none; border-color: var(--color-accent-primary, #10b981);
        background: var(--color-bg-input, #0e0e12);
      }
      .bh-row-btn { padding: 2px 6px; font-size: 11px; margin-left: 2px; }

      .bh-pit-empty { padding: 18px; text-align: center; color: var(--color-text-muted, #888); font-size: 12px; }

      .bh-layer-editor {
        padding: 10px 12px 12px 16px;
        background: rgba(0, 0, 0, 0.15);
      }
      .bh-layer-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }

      .bh-summary-table thead th { background: rgba(16, 185, 129, 0.08); }
      .bh-pit-summary-wrap > h3 {
        margin: 0; padding: 8px 12px; font-size: 13px;
        background: var(--color-bg-elevated, #22222a);
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
    `}</style>
  );
}
