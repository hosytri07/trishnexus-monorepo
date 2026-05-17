/**
 * TrishDesign Phase 42 wave 8.3 — Bảng đa năng nhập block ATGT.
 *
 * Workflow:
 *   1. Admin curate danh mục block (Firestore /atgt_blocks) qua /admin/atgt-blocks
 *   2. TrishDesign user fetch danh mục → dropdown chọn block
 *   3. Bảng đa năng: thêm dòng / nhập số liệu / copy paste TSV / xóa dòng / xóa bảng
 *   4. Lưu vào AtgtSegment.blockPlacements (localStorage qua atgt-db)
 *
 * Field mỗi dòng:
 *   - Block (dropdown từ Firestore)
 *   - Lý trình (m)
 *   - Cách tim (m)
 *   - Vị trí (trái/phải/tim)
 *   - Tình trạng (good/damaged/missing/new)
 *   - Ghi chú
 */

import { useMemo, useState } from 'react';
import type { AtgtBlockPlacement, AtgtItemBase, AtgtSegment, RoadSide } from '../../lib/atgt-types.js';
import { newAtgtId } from '../../lib/atgt-types.js';
import { useAtgtBlocks, type AtgtBlock } from '../../lib/atgt-blocks-fetch.js';

interface Props {
  segment: AtgtSegment;
  onChange: (next: AtgtBlockPlacement[]) => void;
}

export function AtgtBlockTable({ segment, onChange }: Props): JSX.Element {
  const { blocks, loading, error, reload } = useAtgtBlocks();
  const placements = segment.blockPlacements ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const blockMap = useMemo(() => {
    const m = new Map<string, AtgtBlock>();
    blocks.forEach((b) => m.set(b.id, b));
    return m;
  }, [blocks]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => { if (b.category) set.add(b.category); });
    return Array.from(set).sort();
  }, [blocks]);

  const visibleBlocks = useMemo(() => {
    if (filterCategory === 'all') return blocks;
    return blocks.filter((b) => b.category === filterCategory);
  }, [blocks, filterCategory]);

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addRow(): void {
    const next: AtgtBlockPlacement = {
      id: newAtgtId('plc'),
      blockId: blocks[0]?.id,
      blockLabel: blocks[0]?.label,
      station: segment.startStation,
      side: 'right',
      cachTim: 1.0,
      status: 'good',
    };
    onChange([...placements, next]);
  }

  function patch(id: string, p: Partial<AtgtBlockPlacement>): void {
    onChange(placements.map((pl) => (pl.id === id ? { ...pl, ...p } : pl)));
  }

  function deleteSelected(): void {
    onChange(placements.filter((pl) => !selectedIds.has(pl.id)));
    setSelectedIds(new Set());
  }

  function clearAll(): void {
    onChange([]);
    setSelectedIds(new Set());
  }

  async function handlePaste(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parsePasted(text, blocks);
      if (parsed.length === 0) return;
      onChange([...placements, ...parsed]);
    } catch (e) {
      console.warn('Paste failed:', e);
    }
  }

  async function handleImportFile(): Promise<void> {
    try {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.csv,.tsv,.txt';
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return;
        const text = await f.text();
        const parsed = parsePasted(text, blocks);
        if (parsed.length > 0) onChange([...placements, ...parsed]);
      };
      inp.click();
    } catch (e) {
      console.warn('Import file failed:', e);
    }
  }

  return (
    <div className="atgt-block-section">
      <header className="atgt-block-head">
        <h3>🚸 Bảng nhập block ATGT</h3>
        <span className="atgt-block-sub">
          {loading ? 'Đang tải danh mục...' : error ? `⚠ ${error}` : `${blocks.length} block khả dụng`}
          {' '}
          <button type="button" className="atgt-block-mini-btn" onClick={() => void reload()} title="Tải lại danh mục Firestore">🔄</button>
        </span>
        <span style={{ flex: 1 }} />
        <select
          className="atgt-block-input atgt-block-filter"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          title="Lọc danh mục block theo nhóm"
        >
          <option value="all">Tất cả nhóm</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </header>

      <div className="atgt-block-toolbar">
        <button type="button" className="atgt-block-btn" onClick={addRow}>+ Thêm dòng</button>
        <button type="button" className="atgt-block-btn" onClick={() => void handlePaste()} title="Dán từ Excel: cột (block ID hoặc tên) | lý trình (m) | cách tim | vị trí">📋 Dán Excel</button>
        <button type="button" className="atgt-block-btn" onClick={() => void handleImportFile()} title="Import file CSV/TSV">📥 Import file</button>
        <button type="button" className="atgt-block-btn" disabled={selectedIds.size === 0} onClick={deleteSelected}>🗑 Xóa ({selectedIds.size})</button>
        <button type="button" className="atgt-block-btn" disabled={placements.length === 0} onClick={clearAll}>♻ Xóa bảng</button>
      </div>

      {placements.length === 0 ? (
        <p className="atgt-block-empty">
          Chưa có block nào trong đoạn. Bấm "<strong>+ Thêm dòng</strong>" hoặc "<strong>📋 Dán Excel</strong>" để bắt đầu.
          {blocks.length === 0 && !loading && (
            <><br /><br />
              ⚠ Danh mục block Firestore đang trống. Trí vào <code>https://trishteam.io.vn/admin/atgt-blocks</code> để thêm block.
            </>
          )}
        </p>
      ) : (
        <div className="atgt-block-table-wrap">
          <table className="atgt-block-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}></th>
                <th style={{ minWidth: 220 }}>Block (chọn từ danh mục)</th>
                <th style={{ width: 110 }}>Lý trình (m)</th>
                <th style={{ width: 90 }}>Cách tim (m)</th>
                <th style={{ width: 90 }}>Vị trí</th>
                <th style={{ width: 110 }}>Tình trạng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {placements.map((pl) => {
                const b = pl.blockId ? blockMap.get(pl.blockId) : undefined;
                return (
                  <tr key={pl.id} className={selectedIds.has(pl.id) ? 'atgt-block-row-selected' : ''}>
                    <td><input type="checkbox" checked={selectedIds.has(pl.id)} onChange={() => toggleSelect(pl.id)} /></td>
                    <td>
                      <select
                        className="atgt-block-input"
                        value={pl.blockId ?? ''}
                        onChange={(e) => {
                          const id = e.target.value || undefined;
                          const blk = id ? blockMap.get(id) : undefined;
                          patch(pl.id, { blockId: id, blockLabel: blk?.label });
                        }}
                      >
                        <option value="">— Chọn block —</option>
                        {visibleBlocks.map((bk) => (
                          <option key={bk.id} value={bk.id}>
                            {bk.label} ({bk.fileName})
                          </option>
                        ))}
                      </select>
                      {!b && pl.blockLabel && (
                        <span className="atgt-block-label-hint" title="Block không có trong danh mục — sẽ vẽ free-form">
                          ⚠ {pl.blockLabel}
                        </span>
                      )}
                      {b && <span className="atgt-block-meta">{b.category}</span>}
                    </td>
                    <td><input className="atgt-block-input" type="number" step={0.1} value={pl.station} onChange={(e) => patch(pl.id, { station: Number(e.target.value) || 0 })} /></td>
                    <td><input className="atgt-block-input" type="number" step={0.1} value={pl.cachTim ?? 0} onChange={(e) => patch(pl.id, { cachTim: Number(e.target.value) || 0 })} /></td>
                    <td>
                      <select className="atgt-block-input" value={pl.side} onChange={(e) => patch(pl.id, { side: e.target.value as RoadSide })}>
                        <option value="left">Trái</option>
                        <option value="right">Phải</option>
                        <option value="center">Tim</option>
                      </select>
                    </td>
                    <td>
                      <select className="atgt-block-input" value={pl.status ?? 'good'} onChange={(e) => patch(pl.id, { status: e.target.value as AtgtItemBase['status'] })}>
                        <option value="good">Tốt</option>
                        <option value="damaged">Hỏng</option>
                        <option value="missing">Mất</option>
                        <option value="new">Mới</option>
                      </select>
                    </td>
                    <td><input className="atgt-block-input" value={pl.notes ?? ''} onChange={(e) => patch(pl.id, { notes: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {placements.length > 0 && (
        <PlacementSummary placements={placements} blockMap={blockMap} />
      )}

      <BlockTableStyles />
    </div>
  );
}

/* ============================================================
 * Summary table
 * ============================================================ */
function PlacementSummary({
  placements, blockMap,
}: {
  placements: AtgtBlockPlacement[];
  blockMap: Map<string, AtgtBlock>;
}): JSX.Element {
  // Group theo block category để thống kê số lượng
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number; items: AtgtBlockPlacement[] }>();
    placements.forEach((pl) => {
      const b = pl.blockId ? blockMap.get(pl.blockId) : undefined;
      const key = b?.category ?? '(Chưa chọn)';
      const g = map.get(key) ?? { label: key, count: 0, items: [] };
      g.count += 1;
      g.items.push(pl);
      map.set(key, g);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [placements, blockMap]);

  return (
    <div className="atgt-block-summary">
      <strong>📊 Tổng: {placements.length} block</strong>
      <div className="atgt-block-chips">
        {groups.map((g) => (
          <span key={g.label} className="atgt-block-chip">
            {g.label}: <b>{g.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * Parse pasted TSV/CSV.
 * Cột: blockId hoặc tên block | lý trình (m) | cách tim (m) | vị trí (T/P/C hoặc trái/phải/tim) | tình trạng
 * ============================================================ */
function parsePasted(text: string, blocks: AtgtBlock[]): AtgtBlockPlacement[] {
  if (!text || !text.trim()) return [];
  const out: AtgtBlockPlacement[] = [];
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
  for (const ln of lines) {
    const parts = ln.split(/\t|,/).map((p) => p.trim());
    if (parts.length === 0) continue;
    if (/lý\s*trình|station|block/i.test(parts.join(' ').toLowerCase()) && parts.length < 5) {
      // Header row — skip
      continue;
    }
    const raw0 = parts[0] ?? '';
    // Resolve blockId: match by id hoặc by label
    const byId = blocks.find((b) => b.id === raw0);
    const byLabel = blocks.find((b) => b.label.toLowerCase() === raw0.toLowerCase());
    const block = byId ?? byLabel;
    const station = Number(parts[1] ?? 0) || 0;
    const cachTim = Number(parts[2] ?? 0) || 0;
    const sideRaw = (parts[3] ?? '').toLowerCase();
    const side: RoadSide = /trái|^l/i.test(sideRaw) ? 'left' : /tim|^c/i.test(sideRaw) ? 'center' : 'right';
    const statusRaw = (parts[4] ?? 'good').toLowerCase();
    const status: AtgtItemBase['status'] =
      /h(ỏng|ong)|damaged/i.test(statusRaw) ? 'damaged'
      : /mất|missing/i.test(statusRaw) ? 'missing'
      : /mới|new/i.test(statusRaw) ? 'new'
      : 'good';
    out.push({
      id: newAtgtId('plc'),
      blockId: block?.id,
      blockLabel: block?.label ?? raw0,
      station, cachTim, side, status,
    });
  }
  return out;
}

/* ============================================================
 * Scoped CSS
 * ============================================================ */
function BlockTableStyles(): JSX.Element {
  return (
    <style>{`
      .atgt-block-section {
        margin-top: 16px;
        border: 1px solid var(--color-border-subtle, #2a2a30);
        border-radius: 8px;
        background: var(--color-bg-surface, #1a1a1f);
        overflow: hidden;
      }
      .atgt-block-head {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 12px;
        background: var(--color-bg-elevated, #22222a);
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .atgt-block-head h3 { margin: 0; font-size: 13px; font-weight: 700; }
      .atgt-block-sub { color: var(--color-text-muted, #888); font-size: 12px; }
      .atgt-block-mini-btn {
        background: transparent; border: none; cursor: pointer;
        padding: 2px 4px; font-size: 13px;
      }
      .atgt-block-filter { min-width: 160px; padding: 4px 8px; }

      .atgt-block-toolbar {
        display: flex; gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
        flex-wrap: wrap;
      }
      .atgt-block-btn {
        padding: 5px 10px; font-size: 12px;
        background: var(--color-bg-elevated, #22222a);
        color: inherit;
        border: 1px solid var(--color-border-subtle, #2a2a30);
        border-radius: 4px;
        cursor: pointer;
      }
      .atgt-block-btn:hover:not(:disabled) {
        background: var(--color-accent-soft, rgba(16,185,129,0.1));
      }
      .atgt-block-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .atgt-block-empty { padding: 20px; text-align: center; color: var(--color-text-muted, #888); font-size: 13px; }

      .atgt-block-table-wrap { overflow-x: auto; max-height: 480px; }
      .atgt-block-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .atgt-block-table th, .atgt-block-table td {
        padding: 4px 6px; text-align: left;
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .atgt-block-table thead th {
        background: var(--color-bg-elevated, #22222a);
        font-weight: 600; font-size: 11px;
        color: var(--color-text-muted, #888);
        position: sticky; top: 0; z-index: 1;
      }
      .atgt-block-row-selected { background: rgba(16, 185, 129, 0.06); }
      .atgt-block-input {
        width: 100%; padding: 3px 6px; font-size: 12px;
        background: transparent; border: 1px solid transparent;
        border-radius: 4px; color: inherit;
      }
      .atgt-block-input:focus {
        outline: none; border-color: var(--color-accent-primary, #10b981);
        background: var(--color-bg-input, #0e0e12);
      }
      .atgt-block-meta {
        display: block; font-size: 10px; color: var(--color-text-muted, #888);
        margin-top: 2px;
      }
      .atgt-block-label-hint {
        display: block; font-size: 10px; color: #f59e0b; margin-top: 2px;
      }

      .atgt-block-summary {
        padding: 8px 12px;
        background: rgba(16, 185, 129, 0.04);
        border-top: 1px solid var(--color-border-subtle, #2a2a30);
        font-size: 12px;
      }
      .atgt-block-chips {
        display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
      }
      .atgt-block-chip {
        padding: 2px 8px; border-radius: 12px;
        background: var(--color-bg-elevated, #22222a);
        font-size: 11px;
      }
    `}</style>
  );
}

// Re-export for type hints
export type { AtgtBlock };
