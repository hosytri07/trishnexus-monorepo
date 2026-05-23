/**
 * TrishDesign Phase 43 wave 10.2 — Sidebar trái panel ATGT.
 *
 * Gồm 3 nhóm compact (giống HHMĐ):
 *   - Lý trình đoạn tuyến
 *   - Cài đặt khuôn đường (loại, bề rộng, số làn, DPC, cách nhập)
 *   - Chế độ vẽ (duỗi thẳng / polyline + nút pick polyline AutoCAD — Wave 16.2)
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AtgtSegment } from '../../lib/atgt-types.js';

interface Props {
  segment: AtgtSegment;
  onUpdate: (updater: (s: AtgtSegment) => AtgtSegment) => void;
}

interface PolylineInfo {
  handle: string;
  length: number;
  vertices: Array<[number, number]>;
}

export function AtgtSidebar({ segment, onUpdate }: Props): JSX.Element {
  const [picking, setPicking] = useState(false);
  const [pickMsg, setPickMsg] = useState<string>('');

  async function handlePickPolyline(): Promise<void> {
    setPicking(true);
    setPickMsg('🖱 Chuyển sang AutoCAD và click vào polyline...');
    try {
      const info = await invoke<PolylineInfo>('acad_pick_polyline');
      onUpdate((s) => ({
        ...s,
        polylineHandle: info.handle,
        polylineLength: info.length,
        polylineVertices: info.vertices,
      }));
      setPickMsg(`✓ Đã pick: ${info.vertices.length} đỉnh, L=${info.length.toFixed(2)}m`);
    } catch (e) {
      setPickMsg(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPicking(false);
    }
  }

  const isDual = segment.roadType === 'dual';
  const mode = segment.drawMode ?? 'duoithang';

  return (
    <aside className="atgt-sidebar">
      {/* Lý trình đoạn tuyến */}
      <div className="atgt-side-group">
        <div className="atgt-side-title">Lý trình đoạn tuyến</div>
        <div className="atgt-side-row">
          <input type="number" className="atgt-side-input" placeholder="0" value={segment.startStation || ''}
            onChange={(e) => onUpdate((s) => ({ ...s, startStation: Number(e.target.value) || 0 }))} />
          <span className="atgt-side-sep">→</span>
          <input type="number" className="atgt-side-input" placeholder="500" value={segment.endStation || ''}
            onChange={(e) => onUpdate((s) => ({ ...s, endStation: Number(e.target.value) || 0 }))} />
        </div>
        <div className="atgt-side-row" style={{ marginTop: 6 }}>
          <input type="text" className="atgt-side-input" style={{ flex: 1 }} placeholder="Tên đoạn"
            value={segment.name}
            onChange={(e) => onUpdate((s) => ({ ...s, name: e.target.value }))} />
        </div>
      </div>

      {/* Cài đặt khuôn đường */}
      <div className="atgt-side-group">
        <div className="atgt-side-title">Cài đặt khuôn đường</div>
        <label className="atgt-side-field">
          <span>Bề rộng mặt đường (m)</span>
          <input type="number" className="atgt-side-input" step={0.5} value={segment.roadWidth}
            onChange={(e) => onUpdate((s) => ({ ...s, roadWidth: Number(e.target.value) || 7 }))} />
        </label>
        <label className="atgt-side-field">
          <span>Số làn xe (tổng cả 2 chiều)</span>
          <input type="number" className="atgt-side-input" min={1} max={12} value={segment.laneCount ?? 2}
            onChange={(e) => onUpdate((s) => ({ ...s, laneCount: Number(e.target.value) || 2 }))} />
        </label>
        <div className="atgt-side-field-row">
          <span className="atgt-side-label">Loại đường:</span>
          <label className="atgt-side-radio">
            <input type="radio" checked={!isDual}
              onChange={() => onUpdate((s) => ({ ...s, roadType: 'single' }))} />
            <span>Đơn</span>
          </label>
          <label className="atgt-side-radio">
            <input type="radio" checked={isDual}
              onChange={() => onUpdate((s) => ({ ...s, roadType: 'dual' }))} />
            <span>Đôi</span>
          </label>
        </div>
        {isDual && (
          <label className="atgt-side-field">
            <span>Bề rộng DPC (m)</span>
            <input type="number" className="atgt-side-input" step={0.1} min={0} value={segment.medianWidth ?? 0}
              onChange={(e) => onUpdate((s) => ({ ...s, medianWidth: Number(e.target.value) || 0 }))} />
          </label>
        )}
        <div className="atgt-side-field-row">
          <span className="atgt-side-label">Cách nhập:</span>
          <label className="atgt-side-radio">
            <input type="radio" checked={(segment.cachTimMode ?? 'tim') === 'tim'}
              onChange={() => onUpdate((s) => ({ ...s, cachTimMode: 'tim' }))} />
            <span>Tim</span>
          </label>
          <label className="atgt-side-radio">
            <input type="radio" checked={segment.cachTimMode === 'mep'}
              onChange={() => onUpdate((s) => ({ ...s, cachTimMode: 'mep' }))} />
            <span>Mép</span>
          </label>
        </div>
      </div>

      {/* Chế độ vẽ */}
      <div className="atgt-side-group">
        <div className="atgt-side-title">Chế độ vẽ</div>
        <label className="atgt-side-radio-block">
          <input type="radio" checked={mode === 'duoithang'}
            onChange={() => onUpdate((s) => ({ ...s, drawMode: 'duoithang' }))} />
          <span>📏 Bình đồ duỗi thẳng</span>
        </label>
        <div className="atgt-side-hint">scale 1:1000 X / 1:200 Y</div>
        <label className="atgt-side-radio-block" style={{ marginTop: 6 }}>
          <input type="radio" checked={mode === 'polyline'}
            onChange={() => onUpdate((s) => ({ ...s, drawMode: 'polyline' }))} />
          <span>🛣 Theo polyline AutoCAD</span>
        </label>
        {mode === 'polyline' && (
          <div style={{ marginTop: 8 }}>
            <button type="button"
              className="atgt-pick-btn"
              disabled={picking}
              onClick={() => void handlePickPolyline()}
              title="Chuyển sang AutoCAD → click polyline có sẵn (cong/thẳng/đa đoạn) → app tự đọc tọa độ + chiều dài">
              {picking ? '⏳ Đợi pick...' : '🎯 Chọn polyline trong AutoCAD'}
            </button>
            {segment.polylineHandle && (
              <div className="atgt-side-hint" style={{ marginTop: 4, marginLeft: 0, color: '#10b981' }}>
                ✓ Handle: <code>{segment.polylineHandle}</code><br/>
                L = {(segment.polylineLength ?? 0).toFixed(2)}m · {(segment.polylineVertices?.length ?? 0)} đỉnh
              </div>
            )}
            {pickMsg && (
              <div className="atgt-side-hint" style={{ marginTop: 4, marginLeft: 0 }}>{pickMsg}</div>
            )}
          </div>
        )}
      </div>

      <SidebarStyles />
    </aside>
  );
}

function SidebarStyles(): JSX.Element {
  return (
    <style>{`
      .atgt-sidebar {
        width: 240px;
        flex-shrink: 0;
        padding: 12px;
        background: var(--color-bg-elevated, #1a1a1f);
        border-right: 1px solid var(--color-border-subtle, #2a2a30);
        font-size: 12px;
        overflow-y: auto;
      }
      .atgt-side-group {
        margin-bottom: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--color-border-subtle, #2a2a30);
      }
      .atgt-side-group:last-of-type { border-bottom: none; margin-bottom: 0; }
      .atgt-side-title {
        font-weight: 700; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-muted, #888);
        margin-bottom: 8px;
      }
      .atgt-side-row { display: flex; align-items: center; gap: 6px; }
      .atgt-side-sep { color: var(--color-text-muted); font-size: 11px; }
      .atgt-side-input {
        width: 100%;
        padding: 5px 8px;
        font-size: 12px;
        background: var(--color-bg-input, #0e0e12);
        border: 1px solid var(--color-border-subtle, #2a2a30);
        border-radius: 4px;
        color: inherit;
        box-sizing: border-box;
      }
      .atgt-side-input:focus {
        outline: none;
        border-color: var(--color-accent-primary, #10b981);
      }
      .atgt-side-field {
        display: flex; flex-direction: column; gap: 3px;
        margin-bottom: 8px;
      }
      .atgt-side-field > span {
        font-size: 11px; color: var(--color-text-muted, #888);
      }
      .atgt-side-field-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
      .atgt-side-label { font-size: 11px; color: var(--color-text-muted, #888); min-width: 70px; }
      .atgt-side-radio, .atgt-side-radio-block {
        display: flex; align-items: center; gap: 4px;
        font-size: 12px; cursor: pointer;
      }
      .atgt-side-radio input, .atgt-side-radio-block input { margin: 0; }
      .atgt-side-radio-block { padding: 3px 0; }
      .atgt-side-hint {
        font-size: 10px; color: var(--color-text-muted, #888);
        margin-left: 22px;
      }
      .atgt-pick-btn {
        width: 100%;
        padding: 7px 10px;
        font-size: 12px; font-weight: 600;
        background: var(--color-accent-primary, #10b981);
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .atgt-pick-btn:hover:not(:disabled) { opacity: 0.85; }
      .atgt-pick-btn:disabled { opacity: 0.5; cursor: wait; }
    `}</style>
  );
}
