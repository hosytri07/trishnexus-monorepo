/**
 * TrishDesign Phase 43 wave 10.2 — 9 tab tài sản ATGT với bảng nhập riêng cho từng loại.
 *
 * Mỗi tab tương ứng với 1 sheet trong database-c41a296c.xlsx:
 *   BienBao · VachSon · DenTinHieu · HoLanMem · CocTieu · RanhDoc · CongNgang · TieuPhanQuang · GuongCauLoi
 *
 * Mỗi bảng có toolbar: ➕ Thêm / 📋 Dán / 📥 Import file / 🗑 Xóa / ♻ Xóa bảng.
 */

import { useMemo, useState } from 'react';
import type { AtgtSegment, RoadSide } from '../../lib/atgt-types.js';
import {
  type AtgtItemKind,
  type AtgtSegmentItemsV2,
  type BienBaoItemV2,
  type VachSonItemV2,
  type DenTinHieuItemV2,
  type HoLanMemItemV2,
  type CocTieuItemV2,
  type RanhDocItemV2,
  type CongNgangItemV2,
  type TieuPhanQuangItemV2,
  type GuongCauLoiItemV2,
  ATGT_KINDS,
  getKindMeta,
  newAtgtItemId,
} from '../../lib/atgt-items-types.js';
import { useAtgtBlocks, type AtgtBlock } from '../../lib/atgt-blocks-fetch.js';

interface Props {
  segment: AtgtSegment;
  onChange: (items: AtgtSegmentItemsV2) => void;
}

export function AtgtItemsTabs({ segment, onChange }: Props): JSX.Element {
  const [activeKind, setActiveKind] = useState<AtgtItemKind>('bienBao');
  const items = segment.itemsV2 ?? {};
  const { blocks, loading, error, reload } = useAtgtBlocks();

  // Map: blockMap by databaseCategory → list block tài sản nhóm đó
  const blocksByCategory = useMemo(() => {
    const m = new Map<string, AtgtBlock[]>();
    for (const b of blocks) {
      const list = m.get(b.category) ?? [];
      list.push(b);
      m.set(b.category, list);
    }
    return m;
  }, [blocks]);

  function counts(): Record<AtgtItemKind, number> {
    return {
      bienBao: (items.bienBao ?? []).length,
      vachSon: (items.vachSon ?? []).length,
      denTinHieu: (items.denTinHieu ?? []).length,
      hoLanMem: (items.hoLanMem ?? []).length,
      cocTieu: (items.cocTieu ?? []).length,
      ranhDoc: (items.ranhDoc ?? []).length,
      congNgang: (items.congNgang ?? []).length,
      tieuPhanQuang: (items.tieuPhanQuang ?? []).length,
      guongCauLoi: (items.guongCauLoi ?? []).length,
    };
  }
  const c = counts();

  function update<K extends keyof AtgtSegmentItemsV2>(key: K, next: AtgtSegmentItemsV2[K]): void {
    onChange({ ...items, [key]: next });
  }

  return (
    <div className="atgt-items-tabs">
      {/* Header status */}
      <div className="atgt-tabs-status">
        <span className="muted small">
          {loading ? 'Đang tải danh mục Firestore...' : error ? `⚠ ${error}` : `${blocks.length} block khả dụng`}
        </span>
        <button type="button" className="atgt-tab-mini-btn" onClick={() => void reload()} title="Reload danh mục Firestore">🔄</button>
      </div>

      {/* Tab buttons */}
      <div className="atgt-tabs-nav">
        {ATGT_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`atgt-tab-btn ${activeKind === k.id ? 'atgt-tab-btn-active' : ''}`}
            onClick={() => setActiveKind(k.id)}
          >
            <span>{k.icon}</span>
            <span>{k.label}</span>
            {c[k.id] > 0 && <span className="atgt-tab-badge">{c[k.id]}</span>}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="atgt-tab-content">
        {activeKind === 'bienBao' && (
          <BienBaoTable
            items={items.bienBao ?? []}
            blocks={blocksByCategory.get('Biển báo') ?? []}
            segment={segment}
            onChange={(next) => update('bienBao', next)}
          />
        )}
        {activeKind === 'vachSon' && (
          <VachSonTable
            items={items.vachSon ?? []}
            blocks={blocksByCategory.get('Vạch sơn') ?? []}
            segment={segment}
            onChange={(next) => update('vachSon', next)}
          />
        )}
        {activeKind === 'denTinHieu' && (
          <DenTinHieuTable
            items={items.denTinHieu ?? []}
            blocks={blocksByCategory.get('Đèn tín hiệu') ?? []}
            segment={segment}
            onChange={(next) => update('denTinHieu', next)}
          />
        )}
        {activeKind === 'hoLanMem' && (
          <HoLanMemTable
            items={items.hoLanMem ?? []}
            blocks={blocksByCategory.get('Hộ lan mềm') ?? []}
            segment={segment}
            onChange={(next) => update('hoLanMem', next)}
          />
        )}
        {activeKind === 'cocTieu' && (
          <CocTieuTable
            items={items.cocTieu ?? []}
            blocks={blocksByCategory.get('Cọc tiêu') ?? []}
            segment={segment}
            onChange={(next) => update('cocTieu', next)}
          />
        )}
        {activeKind === 'ranhDoc' && (
          <RanhDocTable
            items={items.ranhDoc ?? []}
            blocks={blocksByCategory.get('Rãnh dọc') ?? []}
            segment={segment}
            onChange={(next) => update('ranhDoc', next)}
          />
        )}
        {activeKind === 'congNgang' && (
          <CongNgangTable
            items={items.congNgang ?? []}
            blocks={blocksByCategory.get('Cống ngang') ?? []}
            segment={segment}
            onChange={(next) => update('congNgang', next)}
          />
        )}
        {activeKind === 'tieuPhanQuang' && (
          <TieuPhanQuangTable
            items={items.tieuPhanQuang ?? []}
            blocks={blocksByCategory.get('Tiêu phản quang') ?? []}
            segment={segment}
            onChange={(next) => update('tieuPhanQuang', next)}
          />
        )}
        {activeKind === 'guongCauLoi' && (
          <GuongCauLoiTable
            items={items.guongCauLoi ?? []}
            blocks={blocksByCategory.get('Gương cầu lồi') ?? []}
            segment={segment}
            onChange={(next) => update('guongCauLoi', next)}
          />
        )}
      </div>

      <TabsStyles />
    </div>
  );
}

/* ============================================================
 * Generic toolbar component
 * ============================================================ */
function Toolbar({
  count, selectedCount, onAdd, onPaste, onDeleteSelected, onClearAll,
}: {
  count: number; selectedCount: number;
  onAdd: () => void; onPaste: () => void; onDeleteSelected: () => void; onClearAll: () => void;
}): JSX.Element {
  return (
    <div className="atgt-tbl-toolbar">
      <button type="button" className="atgt-tbl-btn" onClick={onAdd}>➕ Thêm</button>
      <button type="button" className="atgt-tbl-btn" onClick={onPaste} title="Dán TSV/CSV từ clipboard">📋 Dán</button>
      <button type="button" className="atgt-tbl-btn" disabled={selectedCount === 0} onClick={onDeleteSelected}>🗑 Xóa ({selectedCount})</button>
      <button type="button" className="atgt-tbl-btn" disabled={count === 0} onClick={onClearAll}>♻ Xóa bảng</button>
      <span className="atgt-tbl-count">{count} dòng</span>
    </div>
  );
}

function BlockSelector({
  value, blocks, onChange, placeholder,
}: { value: string; blocks: AtgtBlock[]; onChange: (label: string) => void; placeholder: string }): JSX.Element {
  return (
    <select className="atgt-tbl-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {blocks.map((b) => (
        <option key={b.id} value={b.label}>{b.label}{b.meaning ? ` — ${b.meaning}` : ''}</option>
      ))}
    </select>
  );
}

function SideSelect({ value, onChange }: { value: RoadSide; onChange: (v: RoadSide) => void }): JSX.Element {
  return (
    <select className="atgt-tbl-input" value={value} onChange={(e) => onChange(e.target.value as RoadSide)}>
      <option value="left">Trái</option>
      <option value="right">Phải</option>
      <option value="center">Tim</option>
    </select>
  );
}

/* ============================================================
 * 1. Bảng BIỂN BÁO (7 cột: STT | Lí trình | Vị trí | Tên biển báo | Ý nghĩa | Cách tim | Hiện trạng)
 * ============================================================ */
function BienBaoTable({
  items, blocks, segment, onChange,
}: { items: BienBaoItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: BienBaoItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void {
    onChange([...items, { id: newAtgtItemId('bb'), station: segment.startStation, side: 'right', tenBienBao: '', cachTim: 0 }]);
  }
  function patch(id: string, p: Partial<BienBaoItemV2>): void {
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      if (rows.length === 0) return;
      const next: BienBaoItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('bb'),
        station: Number(r[0] ?? 0) || 0,
        side: parseSide(r[1] ?? ''),
        tenBienBao: r[2] ?? '',
        yNghia: r[3],
        cachTim: Number(r[4] ?? 0) || 0,
        hienTrang: r[5],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  // auto-fill yNghia khi đổi tenBienBao
  function onBlockChange(id: string, label: string): void {
    const blk = blocks.find((b) => b.label === label);
    patch(id, { tenBienBao: label, yNghia: blk?.meaning });
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>Lí trình</th><th>Vị trí</th>
          <th>Tên biển báo</th><th>Ý nghĩa</th><th>Cách tim</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={8} className="atgt-tbl-empty">Chưa có biển báo. Bấm "➕ Thêm" hoặc "📋 Dán".</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.tenBienBao} blocks={blocks} onChange={(v) => onBlockChange(it.id, v)} placeholder="— Chọn biển báo —" /></td>
                <td><input className="atgt-tbl-input" placeholder="(tự fill từ Database)" value={it.yNghia ?? ''} onChange={(e) => patch(it.id, { yNghia: e.target.value })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachTim || ''} onChange={(e) => patch(it.id, { cachTim: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" placeholder="VD: tốt / hỏng / mất" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 2. Bảng VẠCH SƠN (8 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Ý nghĩa | Cách tim | Hiện trạng)
 * ============================================================ */
function VachSonTable({ items, blocks, segment, onChange }: { items: VachSonItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: VachSonItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('vs'), station: segment.startStation, stationEnd: segment.startStation, side: 'right', loaiVachSon: '', cachTim: 0 }]); }
  function patch(id: string, p: Partial<VachSonItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: VachSonItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('vs'),
        station: Number(r[0] ?? 0) || 0,
        stationEnd: Number(r[1] ?? 0) || 0,
        side: parseSide(r[2] ?? ''),
        loaiVachSon: r[3] ?? '',
        yNghia: r[4],
        cachTim: Number(r[5] ?? 0) || 0,
        hienTrang: r[6],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  function onBlockChange(id: string, label: string): void {
    const blk = blocks.find((b) => b.label === label);
    patch(id, { loaiVachSon: label, yNghia: blk?.meaning });
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>LT đầu</th><th>LT cuối</th><th>Vị trí</th>
          <th>Loại vạch sơn</th><th>Ý nghĩa</th><th>Cách tim</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={9} className="atgt-tbl-empty">Chưa có vạch sơn.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.stationEnd || ''} onChange={(e) => patch(it.id, { stationEnd: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiVachSon} blocks={blocks} onChange={(v) => onBlockChange(it.id, v)} placeholder="— Chọn vạch sơn —" /></td>
                <td><input className="atgt-tbl-input" value={it.yNghia ?? ''} onChange={(e) => patch(it.id, { yNghia: e.target.value })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachTim || ''} onChange={(e) => patch(it.id, { cachTim: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 3. Bảng ĐÈN TÍN HIỆU (6 cột)
 * ============================================================ */
function DenTinHieuTable({ items, blocks, segment, onChange }: { items: DenTinHieuItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: DenTinHieuItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('dth'), station: segment.startStation, side: 'right', tenDen: '', cachMep: 0 }]); }
  function patch(id: string, p: Partial<DenTinHieuItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: DenTinHieuItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('dth'),
        station: Number(r[0] ?? 0) || 0,
        side: parseSide(r[1] ?? ''),
        tenDen: r[2] ?? '',
        cachMep: Number(r[3] ?? 0) || 0,
        hienTrang: r[4],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>Lí trình</th><th>Vị trí</th>
          <th>Tên đèn</th><th>Cách mép</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={7} className="atgt-tbl-empty">Chưa có đèn tín hiệu.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.tenDen} blocks={blocks} onChange={(v) => patch(it.id, { tenDen: v })} placeholder="— Chọn đèn —" /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachMep || ''} onChange={(e) => patch(it.id, { cachMep: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 4. Bảng HỘ LAN MỀM (8 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Số khoang | Cách mép | Hiện trạng)
 * ============================================================ */
function HoLanMemTable({ items, blocks, segment, onChange }: { items: HoLanMemItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: HoLanMemItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('hlm'), station: segment.startStation, stationEnd: segment.startStation, side: 'right', loaiHoLan: '', soKhoang: '', cachMep: 0 }]); }
  function patch(id: string, p: Partial<HoLanMemItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: HoLanMemItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('hlm'),
        station: Number(r[0] ?? 0) || 0,
        stationEnd: Number(r[1] ?? 0) || 0,
        side: parseSide(r[2] ?? ''),
        loaiHoLan: r[3] ?? '',
        soKhoang: r[4] ?? '',
        cachMep: Number(r[5] ?? 0) || 0,
        hienTrang: r[6],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>LT đầu</th><th>LT cuối</th><th>Vị trí</th>
          <th>Loại hộ lan</th><th>Số khoang</th><th>Cách mép</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={9} className="atgt-tbl-empty">Chưa có hộ lan mềm.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.stationEnd || ''} onChange={(e) => patch(it.id, { stationEnd: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiHoLan} blocks={blocks} onChange={(v) => patch(it.id, { loaiHoLan: v })} placeholder="— Chọn loại —" /></td>
                <td><input className="atgt-tbl-input" placeholder="3m/kh, 2m/kh..." value={it.soKhoang} onChange={(e) => patch(it.id, { soKhoang: e.target.value })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachMep || ''} onChange={(e) => patch(it.id, { cachMep: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 5. Bảng CỌC TIÊU (9 cột: STT | LT đầu | LT cuối | Vị trí | Loại | Số lượng | Cách khoảng | Cách mép | Hiện trạng)
 * ============================================================ */
function CocTieuTable({ items, blocks, segment, onChange }: { items: CocTieuItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: CocTieuItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('ct'), station: segment.startStation, stationEnd: 0, side: 'right', loaiCocTieu: '', soLuong: 1, cachKhoang: 1, cachMep: 0 }]); }
  function patch(id: string, p: Partial<CocTieuItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: CocTieuItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('ct'),
        station: Number(r[0] ?? 0) || 0,
        stationEnd: Number(r[1] ?? 0) || 0,
        side: parseSide(r[2] ?? ''),
        loaiCocTieu: r[3] ?? '',
        soLuong: Number(r[4] ?? 1) || 1,
        cachKhoang: Number(r[5] ?? 1) || 1,
        cachMep: Number(r[6] ?? 0) || 0,
        hienTrang: r[7],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <p className="atgt-tbl-hint">
        💡 Nếu <strong>LT cuối = 0</strong>: rải <strong>Số lượng</strong> cọc cách nhau <strong>Cách khoảng</strong> m.
        Nếu có cả 2 LT: rải đều theo <code>(LT cuối − LT đầu) / (Số lượng + 1)</code>.
      </p>
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>LT đầu</th><th>LT cuối</th><th>Vị trí</th>
          <th>Loại</th><th>Số lượng</th><th>Cách khoảng</th><th>Cách mép</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={10} className="atgt-tbl-empty">Chưa có cọc tiêu.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0 = bỏ trống" value={it.stationEnd || ''} onChange={(e) => patch(it.id, { stationEnd: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiCocTieu} blocks={blocks} onChange={(v) => patch(it.id, { loaiCocTieu: v })} placeholder="— Loại cọc —" /></td>
                <td><input className="atgt-tbl-input" type="number" min={1} value={it.soLuong} onChange={(e) => patch(it.id, { soLuong: Number(e.target.value) || 1 })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.5} value={it.cachKhoang} onChange={(e) => patch(it.id, { cachKhoang: Number(e.target.value) || 1 })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachMep || ''} onChange={(e) => patch(it.id, { cachMep: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 6. Bảng RÃNH DỌC (7 cột)
 * ============================================================ */
function RanhDocTable({ items, blocks, segment, onChange }: { items: RanhDocItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: RanhDocItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('rd'), station: segment.startStation, stationEnd: segment.startStation, side: 'right', loaiRanhDoc: '', cachMep: 0 }]); }
  function patch(id: string, p: Partial<RanhDocItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: RanhDocItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('rd'),
        station: Number(r[0] ?? 0) || 0,
        stationEnd: Number(r[1] ?? 0) || 0,
        side: parseSide(r[2] ?? ''),
        loaiRanhDoc: r[3] ?? '',
        cachMep: Number(r[4] ?? 0) || 0,
        hienTrang: r[5],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>LT đầu</th><th>LT cuối</th><th>Vị trí</th>
          <th>Loại rãnh dọc</th><th>Cách mép</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={8} className="atgt-tbl-empty">Chưa có rãnh dọc.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.stationEnd || ''} onChange={(e) => patch(it.id, { stationEnd: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiRanhDoc} blocks={blocks} onChange={(v) => patch(it.id, { loaiRanhDoc: v })} placeholder="— Loại rãnh —" /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachMep || ''} onChange={(e) => patch(it.id, { cachMep: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 7. Bảng CỐNG NGANG (5 cột)
 * ============================================================ */
function CongNgangTable({ items, blocks, segment, onChange }: { items: CongNgangItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: CongNgangItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('cn'), station: segment.startStation, side: 'center', loaiCongNgang: '' }]); }
  function patch(id: string, p: Partial<CongNgangItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: CongNgangItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('cn'),
        station: Number(r[0] ?? 0) || 0,
        side: parseSide(r[1] ?? 'center'),
        loaiCongNgang: r[2] ?? '',
        hienTrang: r[3],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>Lí trình</th><th>Vị trí</th>
          <th>Loại cống ngang</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={6} className="atgt-tbl-empty">Chưa có cống ngang.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiCongNgang} blocks={blocks} onChange={(v) => patch(it.id, { loaiCongNgang: v })} placeholder="— Loại cống —" /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 8. Bảng TIÊU PHẢN QUANG (9 cột: giống Cọc tiêu)
 * ============================================================ */
function TieuPhanQuangTable({ items, blocks, segment, onChange }: { items: TieuPhanQuangItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: TieuPhanQuangItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('tpq'), station: segment.startStation, stationEnd: 0, side: 'right', loaiTPQ: '', soLuong: 1, cachKhoang: 1, cachMep: 0 }]); }
  function patch(id: string, p: Partial<TieuPhanQuangItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: TieuPhanQuangItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('tpq'),
        station: Number(r[0] ?? 0) || 0,
        stationEnd: Number(r[1] ?? 0) || 0,
        side: parseSide(r[2] ?? ''),
        loaiTPQ: r[3] ?? '',
        soLuong: Number(r[4] ?? 1) || 1,
        cachKhoang: Number(r[5] ?? 1) || 1,
        cachMep: Number(r[6] ?? 0) || 0,
        hienTrang: r[7],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <p className="atgt-tbl-hint">💡 Logic rải block giống Cọc tiêu (LT cuối = 0 → rải theo Số lượng × Cách khoảng).</p>
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>LT đầu</th><th>LT cuối</th><th>Vị trí</th>
          <th>Loại</th><th>Số lượng</th><th>Cách khoảng</th><th>Cách mép</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={10} className="atgt-tbl-empty">Chưa có tiêu phản quang.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0 = bỏ trống" value={it.stationEnd || ''} onChange={(e) => patch(it.id, { stationEnd: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.loaiTPQ} blocks={blocks} onChange={(v) => patch(it.id, { loaiTPQ: v })} placeholder="— Loại TPQ —" /></td>
                <td><input className="atgt-tbl-input" type="number" min={1} value={it.soLuong} onChange={(e) => patch(it.id, { soLuong: Number(e.target.value) || 1 })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.5} value={it.cachKhoang} onChange={(e) => patch(it.id, { cachKhoang: Number(e.target.value) || 1 })} /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachMep || ''} onChange={(e) => patch(it.id, { cachMep: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
 * 9. Bảng GƯƠNG CẦU LỒI (6 cột)
 * ============================================================ */
function GuongCauLoiTable({ items, blocks, segment, onChange }: { items: GuongCauLoiItemV2[]; blocks: AtgtBlock[]; segment: AtgtSegment; onChange: (n: GuongCauLoiItemV2[]) => void }): JSX.Element {
  const [sel, setSel] = useState<Set<string>>(new Set());
  function toggle(id: string): void { setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function add(): void { onChange([...items, { id: newAtgtItemId('gcl'), station: segment.startStation, side: 'right', tenGuong: '', cachTim: 0 }]); }
  function patch(id: string, p: Partial<GuongCauLoiItemV2>): void { onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  async function paste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const rows = parsePaste(text);
      const next: GuongCauLoiItemV2[] = rows.map((r) => ({
        id: newAtgtItemId('gcl'),
        station: Number(r[0] ?? 0) || 0,
        side: parseSide(r[1] ?? ''),
        tenGuong: r[2] ?? '',
        cachTim: Number(r[3] ?? 0) || 0,
        hienTrang: r[4],
      }));
      onChange([...items, ...next]);
    } catch (e) { console.warn(e); }
  }
  return (
    <div className="atgt-tbl-wrap">
      <Toolbar count={items.length} selectedCount={sel.size} onAdd={add} onPaste={() => void paste()}
        onDeleteSelected={() => { onChange(items.filter((i) => !sel.has(i.id))); setSel(new Set()); }}
        onClearAll={() => { onChange([]); setSel(new Set()); }} />
      <table className="atgt-tbl">
        <thead><tr>
          <th style={{ width: 28 }}></th><th>STT</th><th>Lí trình</th><th>Vị trí</th>
          <th>Tên gương cầu lồi</th><th>Cách tim</th><th>Hiện trạng</th>
        </tr></thead>
        <tbody>
          {items.length === 0 ? <tr><td colSpan={7} className="atgt-tbl-empty">Chưa có gương cầu lồi.</td></tr>
            : items.map((it, i) => (
              <tr key={it.id} className={sel.has(it.id) ? 'atgt-tbl-row-sel' : ''}>
                <td><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} /></td>
                <td>{i + 1}</td>
                <td><input className="atgt-tbl-input" type="number" placeholder="0" value={it.station || ''} onChange={(e) => patch(it.id, { station: Number(e.target.value) || 0 })} /></td>
                <td><SideSelect value={it.side} onChange={(v) => patch(it.id, { side: v })} /></td>
                <td><BlockSelector value={it.tenGuong} blocks={blocks} onChange={(v) => patch(it.id, { tenGuong: v })} placeholder="— Tên gương —" /></td>
                <td><input className="atgt-tbl-input" type="number" step={0.1} placeholder="0" value={it.cachTim || ''} onChange={(e) => patch(it.id, { cachTim: Number(e.target.value) || 0 })} /></td>
                <td><input className="atgt-tbl-input" value={it.hienTrang ?? ''} onChange={(e) => patch(it.id, { hienTrang: e.target.value })} /></td>
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
function parseSide(raw: string): RoadSide {
  const s = raw.toLowerCase().trim();
  if (/trái|^t$|^l/i.test(s)) return 'left';
  if (/tim|^c|center/i.test(s)) return 'center';
  return 'right';
}

function parsePaste(text: string): string[][] {
  if (!text || !text.trim()) return [];
  return text.split(/\r?\n/)
    .filter((ln) => ln.trim().length > 0)
    .filter((ln) => !/^stt$|lí\s*trình|station/i.test(ln.split(/\t|,/)[0] ?? ''))
    .map((ln) => ln.split(/\t|,/).map((p) => p.trim()));
}

/* ============================================================
 * Styles
 * ============================================================ */
function TabsStyles(): JSX.Element {
  return (
    <style>{`
      .atgt-items-tabs {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column;
        background: var(--color-bg-surface, #1a1a1f);
        overflow: hidden;
      }
      .atgt-tabs-status {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 12px;
        background: var(--color-bg-elevated, #22222a);
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .atgt-tab-mini-btn {
        background: transparent; border: none; cursor: pointer; padding: 2px 4px; font-size: 12px; color: inherit;
      }
      .atgt-tabs-nav {
        display: flex; flex-wrap: wrap;
        padding: 4px 8px;
        background: var(--color-bg-elevated, #22222a);
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
        gap: 2px;
      }
      .atgt-tab-btn {
        display: flex; align-items: center; gap: 4px;
        padding: 5px 10px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        color: inherit;
      }
      .atgt-tab-btn:hover { background: rgba(255,255,255,0.05); }
      .atgt-tab-btn-active {
        background: var(--color-accent-soft, rgba(16,185,129,0.1));
        border-color: var(--color-accent-primary, #10b981);
        color: var(--color-accent-primary, #10b981);
        font-weight: 600;
      }
      .atgt-tab-badge {
        background: var(--color-accent-primary, #10b981);
        color: #fff;
        font-size: 10px; font-weight: 700;
        padding: 1px 5px; border-radius: 8px;
        margin-left: 2px;
      }

      .atgt-tab-content { flex: 1; overflow: auto; padding: 8px; }
      .atgt-tbl-wrap { background: var(--color-bg-surface); border: 1px solid var(--color-border-subtle); border-radius: 6px; overflow: hidden; }

      .atgt-tbl-toolbar {
        display: flex; gap: 4px; padding: 6px 8px;
        border-bottom: 1px solid var(--color-border-subtle);
        background: var(--color-bg-elevated);
      }
      .atgt-tbl-btn {
        padding: 4px 9px; font-size: 11px;
        background: transparent; color: inherit;
        border: 1px solid var(--color-border-subtle); border-radius: 3px; cursor: pointer;
      }
      .atgt-tbl-btn:hover:not(:disabled) { background: rgba(16,185,129,0.08); }
      .atgt-tbl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .atgt-tbl-count { margin-left: auto; font-size: 11px; color: var(--color-text-muted); align-self: center; }

      .atgt-tbl-hint { padding: 6px 10px; font-size: 11px; color: var(--color-text-muted); margin: 0; border-bottom: 1px solid var(--color-border-subtle); }

      .atgt-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
      .atgt-tbl th, .atgt-tbl td { padding: 3px 5px; border-bottom: 1px solid var(--color-border-subtle); text-align: left; }
      .atgt-tbl thead th { background: var(--color-bg-elevated); font-weight: 600; font-size: 11px; color: var(--color-text-muted); position: sticky; top: 0; }
      .atgt-tbl-row-sel { background: rgba(16,185,129,0.06); }
      .atgt-tbl-empty { padding: 20px; text-align: center; color: var(--color-text-muted); font-size: 12px; }
      .atgt-tbl-input {
        width: 100%; padding: 3px 5px; font-size: 12px;
        background: transparent; border: 1px solid transparent; border-radius: 3px; color: inherit;
      }
      .atgt-tbl-input:focus { outline: none; border-color: var(--color-accent-primary); background: var(--color-bg-input, #0e0e12); }
    `}</style>
  );
}
