/**
 * TrishDesign Phase 43 wave 16.3 — Polyline arc-length parameterization.
 *
 * Cho polyline 2D với vertices [[x0,y0], [x1,y1], ...] và station_m (lý trình),
 * trả về điểm tương ứng trên polyline + góc tiếp tuyến + vector pháp tuyến (vuông góc bên trái).
 *
 * Dùng cho engine vẽ ATGT mode 'polyline':
 *   - station_m: lý trình theo mét, 0 ≤ s ≤ totalLength
 *   - cachTim: cách tim đường (m), dương = bên trái, âm = bên phải (theo chiều polyline)
 *   - → vị trí block AutoCAD = point + normal × cachTim
 *   - → góc xoay block = tangentAngle (radians)
 */

export type Vec2 = [number, number];

export interface CurvePoint {
  /** Toạ độ X, Y trên polyline */
  x: number;
  y: number;
  /** Góc tiếp tuyến (radians) tại điểm đó — dùng làm rotation cho block INSERT */
  tangentAngle: number;
  /** Vector pháp tuyến (vuông góc bên trái theo chiều polyline) — unit vector */
  normal: Vec2;
}

/** Tính tổng chiều dài polyline + mảng cumulative length per segment. */
export function polylineLengths(vertices: Vec2[]): { total: number; segLens: number[]; cumLens: number[] } {
  const segLens: number[] = [];
  const cumLens: number[] = [0];
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    const [x0, y0] = vertices[i - 1]!;
    const [x1, y1] = vertices[i]!;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.sqrt(dx * dx + dy * dy);
    segLens.push(d);
    total += d;
    cumLens.push(total);
  }
  return { total, segLens, cumLens };
}

/**
 * Trả về điểm trên polyline tại station_m (m).
 * Nếu station_m < 0 → trả về điểm đầu (kèm tangent đầu tiên).
 * Nếu station_m > total → trả về điểm cuối (kèm tangent cuối).
 */
export function pointAtStation(
  vertices: Vec2[],
  stationM: number,
  precomputed?: { total: number; segLens: number[]; cumLens: number[] },
): CurvePoint {
  if (vertices.length < 2) {
    return { x: 0, y: 0, tangentAngle: 0, normal: [0, 1] };
  }
  const { total, segLens, cumLens } = precomputed ?? polylineLengths(vertices);
  const s = Math.max(0, Math.min(total, stationM));

  // Tìm segment chứa station
  let segIdx = 0;
  for (let i = 1; i < cumLens.length; i++) {
    if (s <= cumLens[i]!) {
      segIdx = i - 1;
      break;
    }
    segIdx = i - 1;
  }

  const segLen = segLens[segIdx] ?? 0;
  const localS = s - (cumLens[segIdx] ?? 0);
  const t = segLen > 0 ? localS / segLen : 0;
  const [x0, y0] = vertices[segIdx]!;
  const [x1, y1] = vertices[segIdx + 1]!;

  const x = x0 + (x1 - x0) * t;
  const y = y0 + (y1 - y0) * t;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const tangentAngle = Math.atan2(dy, dx);
  // Normal vuông góc bên trái: rotate tangent 90° CCW → (-dy, dx) / |seg|
  const segLenSafe = segLen > 0 ? segLen : 1;
  const normal: Vec2 = [-dy / segLenSafe, dx / segLenSafe];

  return { x, y, tangentAngle, normal };
}

/**
 * Tính vị trí block với offset cách tim (m).
 *
 * @param vertices Đỉnh polyline (m, model space AutoCAD)
 * @param stationM Lý trình theo mét (so với đầu polyline = đầu segment)
 * @param offsetM Cách tim (m); side='left' → +offset, side='right' → -offset, side='center' → 0
 * @returns { x, y, rotationDeg } để dùng trong AutoCAD command `_-INSERT name x,y scale rotation`
 */
export function blockPositionOnPolyline(
  vertices: Vec2[],
  stationM: number,
  offsetM: number,
  precomputed?: { total: number; segLens: number[]; cumLens: number[] },
): { x: number; y: number; rotationDeg: number } {
  const cp = pointAtStation(vertices, stationM, precomputed);
  return {
    x: cp.x + cp.normal[0] * offsetM,
    y: cp.y + cp.normal[1] * offsetM,
    rotationDeg: (cp.tangentAngle * 180) / Math.PI,
  };
}
