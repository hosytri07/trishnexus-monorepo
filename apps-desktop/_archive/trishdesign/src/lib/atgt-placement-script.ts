/**
 * TrishDesign Phase 42 wave 9.3 — Engine vẽ AutoCAD cho AtgtBlockPlacement.
 *
 * 2 chế độ:
 *   - 'duoithang' : bình đồ duỗi thẳng, scale 1:1000 X × 1:200 Y (giống HHMĐ).
 *   - 'polyline'  : pick polyline AutoCAD có sẵn → map mỗi station_m lên 1 điểm trên polyline.
 *
 * Output: array AutoCAD command string để truyền vào autoCadSendCommands().
 *
 * Cho mỗi placement:
 *   - shapeKind='block' + orientation='perpendicular' → INSERT block rotate=90° (đứng vuông tim)
 *   - shapeKind='block' + orientation='parallel'      → INSERT block rotate=0° (chạy theo tim)
 *   - shapeKind='linetype' + orientation='parallel'   → PLINE từ stationStart→stationEnd (linetype dọc tuyến)
 *   - shapeKind='linetype' + orientation='perpendicular' → PLINE vạch ngang (qua đường)
 */

import type { AtgtSegment, AtgtBlockPlacement, RoadSide } from './atgt-types.js';
import type { AtgtBlock } from './atgt-blocks-fetch.js';

// Scale chuẩn cho bình đồ duỗi thẳng — giống HHMĐ
const SCALE_X_STRAIGHT = 1 / 1000;   // 1m thực = 1mm vẽ → khung gọn
const SCALE_Y_STRAIGHT = 1 / 200;    // Y exaggeration

/**
 * Tính tọa độ (x, y) cho mode 'duoithang':
 *   x = station_m × SCALE_X_STRAIGHT
 *   y = ±cachTim × SCALE_Y_STRAIGHT  (dấu theo side: trái=+, phải=-)
 */
function toStraightXY(stationMeters: number, cachTim: number, side: RoadSide): { x: number; y: number } {
  const x = stationMeters * SCALE_X_STRAIGHT;
  const sign = side === 'left' ? 1 : side === 'right' ? -1 : 0;
  const y = sign * cachTim * SCALE_Y_STRAIGHT;
  return { x, y };
}

/**
 * Block insert command — sử dụng path tuyệt đối tới file .dwg trong folder block ATGT.
 * Folder default: %APPDATA%/vn.trishteam.design/blocks/ATGT (Phase 42 wave 7).
 * fileName phải bao gồm đuôi .dwg.
 */
function insertBlockCmd(opts: {
  fileName: string;
  x: number;
  y: number;
  scale: number;
  rotateDeg: number;
  layer?: string;
}): string {
  const layerCmd = opts.layer ? `._-LAYER\nM\n${opts.layer}\n\n` : '';
  // ._-INSERT <name>\n <x,y>\n <xscale>\n <yscale>\n <rotation>\n
  // Nếu file chưa load → AutoCAD tự load từ block search path (cần Trí config search path tới folder block)
  return `${layerCmd}._-INSERT\n${opts.fileName}\n${opts.x.toFixed(3)},${opts.y.toFixed(3)}\n${opts.scale.toFixed(3)}\n${opts.scale.toFixed(3)}\n${opts.rotateDeg.toFixed(2)}\n`;
}

/**
 * Generate AutoCAD commands cho TẤT CẢ placements trong segment, mode 'duoithang'.
 *
 * Yêu cầu:
 *   - segment.drawMode = 'duoithang'
 *   - blockMap: Map<blockId, AtgtBlock> để lookup fileName/shapeKind/orientation
 *
 * Output: cmds array (mỗi item = 1 dòng/block command để AutoCAD parse).
 */
export function generateAtgtCommandsStraight(
  segment: AtgtSegment,
  blockMap: Map<string, AtgtBlock>,
): string[] {
  const cmds: string[] = [];
  // 1) FILEDIA off để AutoCAD không hỏi dialog khi INSERT
  cmds.push('._FILEDIA\n0\n');
  // 2) Tạo layer ATGT
  cmds.push('._-LAYER\nM\nATGT_BLOCK\nC\n7\nATGT_BLOCK\n\n');
  cmds.push('._-LAYER\nM\nATGT_LINETYPE\nC\n7\nATGT_LINETYPE\n\n');
  cmds.push('._-LAYER\nM\nATGT_TIM\nC\n2\nATGT_TIM\n\n');

  // 3) Vẽ trục tuyến (line từ station 0 → endStation)
  const lengthScaled = (segment.endStation - segment.startStation) * SCALE_X_STRAIGHT;
  cmds.push('._-LAYER\nS\nATGT_TIM\n\n');
  cmds.push(`._LINE 0,0\n${lengthScaled.toFixed(3)},0\n\n`);

  // 4) Mỗi placement → command
  const placements = segment.blockPlacements ?? [];
  for (const pl of placements) {
    const block = pl.blockId ? blockMap.get(pl.blockId) : undefined;
    if (!block) {
      // Skip nếu chưa map block (free-form text only)
      continue;
    }
    const station = pl.station - segment.startStation;
    if (station < 0) continue;
    const { x, y } = toStraightXY(station, pl.cachTim ?? 0, pl.side);

    if (block.shapeKind === 'linetype') {
      // Linetype → PLINE chạy dọc tuyến từ stationStart đến stationEnd (đoạn segment)
      // Nếu placement không có endStation riêng (placement chỉ có 1 station), vẽ vạch dài 5m demo
      const segLen = 5; // m
      cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
      if (block.orientation === 'perpendicular') {
        // Vạch ngang qua đường — từ lề trái sang lề phải
        const halfRoad = (segment.roadWidth / 2) * SCALE_Y_STRAIGHT;
        cmds.push(`._PLINE\n${x.toFixed(3)},${(-halfRoad).toFixed(3)}\n${x.toFixed(3)},${halfRoad.toFixed(3)}\n\n`);
      } else {
        // Song song — vạch dọc 5m
        const x2 = x + segLen * SCALE_X_STRAIGHT;
        cmds.push(`._PLINE\n${x.toFixed(3)},${y.toFixed(3)}\n${x2.toFixed(3)},${y.toFixed(3)}\n\n`);
      }
    } else {
      // Block INSERT
      const scale = block.defaultScale ?? 1;
      const rotateDeg = block.orientation === 'parallel' ? 0 : 90;
      cmds.push(insertBlockCmd({
        fileName: block.fileName,
        x, y,
        scale,
        rotateDeg,
        layer: 'ATGT_BLOCK',
      }));
    }
  }

  // 5) FILEDIA on
  cmds.push('._FILEDIA\n1\n');
  cmds.push('._ZOOM\nE\n');
  return cmds;
}

/**
 * Generate AutoCAD commands cho mode 'polyline' — yêu cầu Rust command đã pre-compute
 * tọa độ (x, y, tangentDeg) cho mỗi placement (gọi `acad_polyline_point_at_dist`).
 *
 * Input mapping: array {placement, x, y, tangentDeg}.
 */
export function generateAtgtCommandsPolyline(
  mapped: Array<{ placement: AtgtBlockPlacement; block: AtgtBlock; x: number; y: number; tangentDeg: number }>,
): string[] {
  const cmds: string[] = [];
  cmds.push('._FILEDIA\n0\n');
  cmds.push('._-LAYER\nM\nATGT_BLOCK\nC\n7\nATGT_BLOCK\n\n');
  cmds.push('._-LAYER\nM\nATGT_LINETYPE\nC\n7\nATGT_LINETYPE\n\n');

  for (const m of mapped) {
    const { block, placement, x, y, tangentDeg } = m;
    const cachTim = placement.cachTim ?? 0;
    const sign = placement.side === 'left' ? 1 : placement.side === 'right' ? -1 : 0;
    // Offset block ra khỏi tim theo direction vuông góc với tangent
    const normalDeg = tangentDeg + 90;
    const offsetX = Math.cos((normalDeg * Math.PI) / 180) * cachTim * sign;
    const offsetY = Math.sin((normalDeg * Math.PI) / 180) * cachTim * sign;
    const finalX = x + offsetX;
    const finalY = y + offsetY;

    if (block.shapeKind === 'linetype') {
      // Linetype trên polyline → để Trí dùng OFFSET trong AutoCAD (defer)
      // Tạm thời vẽ vạch ngang 2m
      const lenHalf = 1.0;
      const dx = Math.cos((normalDeg * Math.PI) / 180) * lenHalf;
      const dy = Math.sin((normalDeg * Math.PI) / 180) * lenHalf;
      cmds.push('._-LAYER\nS\nATGT_LINETYPE\n\n');
      cmds.push(`._PLINE\n${(x - dx).toFixed(3)},${(y - dy).toFixed(3)}\n${(x + dx).toFixed(3)},${(y + dy).toFixed(3)}\n\n`);
    } else {
      const scale = block.defaultScale ?? 1;
      const rotateDeg = block.orientation === 'parallel' ? tangentDeg : tangentDeg + 90;
      cmds.push(insertBlockCmd({
        fileName: block.fileName,
        x: finalX, y: finalY,
        scale,
        rotateDeg,
        layer: 'ATGT_BLOCK',
      }));
    }
  }

  cmds.push('._FILEDIA\n1\n');
  return cmds;
}
