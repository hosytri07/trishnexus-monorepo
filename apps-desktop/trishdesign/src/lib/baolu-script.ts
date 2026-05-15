/**
 * TrishDesign Phase 42 — BaoLu AutoCAD command generator.
 *
 * Vẽ tất cả mặt cắt của 1 điểm sụt trong khung A3 (420×297mm × scale 0.2 = 84×59.4m drawing).
 * Bố trí grid: tự động xếp mặt cắt trong khung.
 *
 * Mỗi mặt cắt:
 *   - Mặt đường ngang trục X (width = matDuongWidth)
 *   - Lề trái + lề phải
 *   - Rãnh 2 bên (nếu có)
 *   - Taluy đào hoặc đắp (theo crossType)
 *   - Polygon HATCH đất sụt (placeholder hình chữ nhật size = area, vì hình phức tạp)
 *   - Text lý trình + diện tích bên dưới
 *
 * Bảng thống kê cuối: STT | Lý trình | Diện tích (m²) | Khoảng cách (m) | Khối lượng TB (m³)
 */

interface BaoLuSection {
  id: string;
  station: string;
  station_m: number;
  crossType: 'nua_dao_nua_dap' | 'taluy_dao_2ben' | 'taluy_dap_2ben';
  matDuongWidth: number;
  leWidthLeft: number;
  leWidthRight: number;
  ranhWidth: number;
  ranhDepth: number;
  taluyDaoSlope: number;
  taluyDapSlope: number;
  areaDatSut: number;
}

interface BaoLuSlideEvent {
  id: string;
  name: string;
  sectionIds: string[];
}

// Khung A3 ngang (mm) × scale 0.2 → 84 × 59.4m drawing units
const A3_WIDTH_MM = 420;
const A3_HEIGHT_MM = 297;
const SCALE = 0.2;
const A3_W = A3_WIDTH_MM / 1000 / SCALE;   // 21m (mỗi đơn vị = 0.2m thực)
const A3_H = A3_HEIGHT_MM / 1000 / SCALE;  // 14.85m

// Mỗi mặt cắt cell trong khung A3
const CELL_W = 18;   // m drawing
const CELL_H = 10;   // m drawing
const CELL_PAD = 1;

/**
 * Generate AutoCAD commands vẽ 1 điểm sụt = tập các mặt cắt + bảng thống kê.
 *
 * Sections phải đã sort theo station_m tăng dần (caller responsibility).
 */
export function generateSlideEventCommands(
  event: BaoLuSlideEvent,
  sections: BaoLuSection[],
  materialKHeSoNoRoi: number,
): string[] {
  const cmds: string[] = [];

  // ─── Setup ───
  cmds.push('._FILEDIA\n0\n');
  cmds.push('._CMDDIA\n0\n');
  cmds.push('._-STYLE\nBL_TEXT\narial.ttf\n0\n0.7\n0\nN\nN\n');
  // Layers
  cmds.push('._-LAYER\nM\nBL_KHUNG\nC\n7\nBL_KHUNG\n\n');     // Khung A3
  cmds.push('._-LAYER\nM\nBL_DUONG\nC\n7\nBL_DUONG\n\n');     // Mặt đường
  cmds.push('._-LAYER\nM\nBL_TALUY\nC\n8\nBL_TALUY\n\n');     // Taluy đào/đắp
  cmds.push('._-LAYER\nM\nBL_DATSUT\nC\n1\nBL_DATSUT\n\n');   // Đất sụt (đỏ)
  cmds.push('._-LAYER\nM\nBL_TEXT\nC\n7\nBL_TEXT\n\n');
  cmds.push('._-LAYER\nM\nBL_TABLE\nC\n3\nBL_TABLE\n\n');     // Bảng thống kê

  // ─── 1. Vẽ khung A3 ───
  cmds.push('._-LAYER\nS\nBL_KHUNG\n\n');
  cmds.push(`._RECTANG 0,0 ${A3_W},${A3_H}\n`);
  // Tiêu đề khung
  cmds.push('._-LAYER\nS\nBL_TEXT\n\n');
  cmds.push(`._-TEXT\nJ\nMC\n${(A3_W / 2).toFixed(2)},${(A3_H - 0.5).toFixed(2)}\n0.6\n0\n${event.name} — Khung A3 (scale 1:${Math.round(1 / SCALE)})\n`);

  // ─── 2. Vẽ từng mặt cắt ở grid cell ───
  const cols = Math.max(1, Math.floor(A3_W / (CELL_W + CELL_PAD)));
  // Số dòng có thể tăng động — nếu vượt khung thì kéo dài xuống (nhưng trí muốn 1 khung A3)
  sections.forEach((sec, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * (CELL_W + CELL_PAD) + CELL_W / 2 + CELL_PAD;
    const cy = A3_H - 1 - (row + 1) * (CELL_H + CELL_PAD);
    cmds.push(...drawSection(sec, cx, cy));
  });

  // ─── 3. Bảng thống kê dưới khung A3 ───
  const tableY = -2; // Dưới khung 2m
  cmds.push('._-LAYER\nS\nBL_TABLE\n\n');
  cmds.push(`._-TEXT\nJ\nML\n0,${tableY}\n0.5\n0\nBẢNG THỐNG KÊ ĐIỂM SỤT: ${event.name}\n`);
  // Header
  const headerY = tableY - 1.5;
  const colW = [2, 4, 4, 4, 4]; // STT | Lý trình | Diện tích | Khoảng cách | Khối lượng TB
  let xCur = 0;
  const headers = ['STT', 'Lý trình', 'Diện tích (m²)', 'Khoảng cách (m)', 'Khối lượng TB (m³)'];
  headers.forEach((h, idx) => {
    cmds.push(`._-TEXT\nJ\nMC\n${(xCur + (colW[idx] ?? 4) / 2).toFixed(2)},${headerY.toFixed(2)}\n0.35\n0\n${h}\n`);
    xCur += colW[idx] ?? 4;
  });
  // Rows
  let totalArea = 0;
  let totalVol = 0;
  sections.forEach((sec, i) => {
    const rowY = headerY - 0.8 - i * 0.6;
    let xC = 0;
    const next = sections[i + 1];
    const distance = next ? next.station_m - sec.station_m : 0;
    const avgArea = next ? (sec.areaDatSut + next.areaDatSut) / 2 : 0;
    const vol = avgArea * distance;
    const rowData = [
      String(i + 1),
      sec.station,
      sec.areaDatSut.toFixed(2),
      distance ? distance.toFixed(1) : '—',
      vol > 0 ? vol.toFixed(2) : '—',
    ];
    rowData.forEach((d, idx) => {
      cmds.push(`._-TEXT\nJ\nMC\n${(xC + (colW[idx] ?? 4) / 2).toFixed(2)},${rowY.toFixed(2)}\n0.3\n0\n${d}\n`);
      xC += colW[idx] ?? 4;
    });
    totalArea += sec.areaDatSut;
    totalVol += vol;
  });

  // Total row
  const totalY = headerY - 0.8 - sections.length * 0.6 - 0.4;
  cmds.push(`._-TEXT\nJ\nML\n0,${totalY.toFixed(2)}\n0.4\n0\nTỔNG: Diện tích = ${totalArea.toFixed(2)} m² · Khối lượng tự nhiên = ${totalVol.toFixed(2)} m³ · Khối lượng vận chuyển (k=${materialKHeSoNoRoi}) = ${(totalVol * materialKHeSoNoRoi).toFixed(2)} m³\n`);

  // ─── 4. Zoom extend ───
  cmds.push('._ZOOM\nE\n');
  cmds.push('._FILEDIA\n1\n');
  return cmds;
}

/**
 * Vẽ 1 mặt cắt ở tọa độ (cx, cy) trong khung.
 * Mặt cắt gồm:
 *   - Mặt đường rectangle: width = matDuongWidth
 *   - Lề trái + phải
 *   - Rãnh 2 bên (nếu có)
 *   - Taluy đào/đắp 2 bên (theo crossType)
 *   - Polygon đất sụt (hình chữ nhật placeholder representing diện tích)
 *   - Text lý trình + diện tích
 */
function drawSection(s: BaoLuSection, cx: number, cy: number): string[] {
  const cmds: string[] = [];
  const halfMat = s.matDuongWidth / 2;
  const yRoad = cy;

  // Mặt đường: rectangle ngang
  cmds.push('._-LAYER\nS\nBL_DUONG\n\n');
  cmds.push(`._LINE ${(cx - halfMat).toFixed(2)},${yRoad.toFixed(2)} ${(cx + halfMat).toFixed(2)},${yRoad.toFixed(2)}\n\n`);

  // Lề trái + lề phải
  cmds.push(`._LINE ${(cx - halfMat - s.leWidthLeft).toFixed(2)},${yRoad.toFixed(2)} ${(cx - halfMat).toFixed(2)},${yRoad.toFixed(2)}\n\n`);
  cmds.push(`._LINE ${(cx + halfMat).toFixed(2)},${yRoad.toFixed(2)} ${(cx + halfMat + s.leWidthRight).toFixed(2)},${yRoad.toFixed(2)}\n\n`);

  // Rãnh trái (nếu có)
  if (s.ranhWidth > 0) {
    const rxL = cx - halfMat - s.leWidthLeft;
    cmds.push(`._PLINE ${rxL.toFixed(2)},${yRoad.toFixed(2)} ${rxL.toFixed(2)},${(yRoad - s.ranhDepth).toFixed(2)} ${(rxL - s.ranhWidth).toFixed(2)},${(yRoad - s.ranhDepth).toFixed(2)} ${(rxL - s.ranhWidth).toFixed(2)},${yRoad.toFixed(2)}\n\n`);
  }

  // Taluy theo crossType
  cmds.push('._-LAYER\nS\nBL_TALUY\n\n');
  const taluyLen = 3; // m projection
  if (s.crossType === 'nua_dao_nua_dap' || s.crossType === 'taluy_dao_2ben') {
    // Taluy đào bên trái (lên dốc)
    const xL = cx - halfMat - s.leWidthLeft - s.ranhWidth;
    cmds.push(`._LINE ${xL.toFixed(2)},${yRoad.toFixed(2)} ${(xL - taluyLen).toFixed(2)},${(yRoad + taluyLen / s.taluyDaoSlope).toFixed(2)}\n\n`);
  }
  if (s.crossType === 'nua_dao_nua_dap' || s.crossType === 'taluy_dap_2ben') {
    // Taluy đắp bên phải (xuống dốc)
    const xR = cx + halfMat + s.leWidthRight;
    cmds.push(`._LINE ${xR.toFixed(2)},${yRoad.toFixed(2)} ${(xR + taluyLen).toFixed(2)},${(yRoad - taluyLen / s.taluyDapSlope).toFixed(2)}\n\n`);
  }
  if (s.crossType === 'taluy_dao_2ben') {
    const xR = cx + halfMat + s.leWidthRight;
    cmds.push(`._LINE ${xR.toFixed(2)},${yRoad.toFixed(2)} ${(xR + taluyLen).toFixed(2)},${(yRoad + taluyLen / s.taluyDaoSlope).toFixed(2)}\n\n`);
  }
  if (s.crossType === 'taluy_dap_2ben') {
    const xL = cx - halfMat - s.leWidthLeft - s.ranhWidth;
    cmds.push(`._LINE ${xL.toFixed(2)},${(yRoad).toFixed(2)} ${(xL - taluyLen).toFixed(2)},${(yRoad - taluyLen / s.taluyDapSlope).toFixed(2)}\n\n`);
  }

  // ─── Polygon đất sụt (placeholder hình chữ nhật theo diện tích) ───
  // Thực tế là hình phức tạp — user có thể edit polygon trong AutoCAD sau khi vẽ
  cmds.push('._-LAYER\nS\nBL_DATSUT\n\n');
  const ratio = 2.5; // width/height ratio mặc định
  const wDatSut = Math.sqrt(s.areaDatSut * ratio);
  const hDatSut = wDatSut / ratio;
  // Vẽ phía taluy đào (góc trên trái)
  const dx = cx - halfMat - s.leWidthLeft - s.ranhWidth - 0.3;
  const dy = yRoad + 0.3;
  cmds.push(`._-BHATCH\nP\nAR-CONC\n1\n0\nA\nR\nL\n`); // not used — use simple rectangle hatch
  // Đơn giản hơn: vẽ rectangle + hatch
  cmds.push(`._RECTANG ${(dx - wDatSut).toFixed(2)},${dy.toFixed(2)} ${dx.toFixed(2)},${(dy + hDatSut).toFixed(2)}\n`);

  // Text lý trình + diện tích
  cmds.push('._-LAYER\nS\nBL_TEXT\n\n');
  cmds.push(`._-TEXT\nJ\nMC\n${cx.toFixed(2)},${(yRoad - 2).toFixed(2)}\n0.3\n0\n${s.station} · S=${s.areaDatSut.toFixed(2)}m²\n`);

  return cmds;
}

export { CELL_W, CELL_H, A3_W, A3_H, SCALE };
