/**
 * TrishDesign Phase 28.5 — Bảng tính kết cấu.
 *
 * 5 tabs:
 *   - Mặt đường (22TCN 211-06): tính chiều dày + Echung
 *   - Cống đúc sẵn (TCVN 11823-3): tính cốt thép
 *   - Tường chắn (TCVN 9362): kiểm ổn định trượt + lật
 *   - Móng đơn (TCVN 9362): kích thước + sức chịu tải
 *   - Excel calculator: upload + open file Excel có sẵn
 */

import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';

const LS_KEY = 'trishdesign:struct-db';

// =====================================================================
// Types
// =====================================================================

interface ExcelTemplate {
  id: string; name: string; path: string; uploadedAt: number;
}

interface StructDb {
  templates: ExcelTemplate[];
  // Snapshot saved calculations (per-tab)
  matDuongInputs?: MatDuongInputs;
  congInputs?: CongInputs;
  tuongInputs?: TuongInputs;
  mongInputs?: MongInputs;
}

function loadDb(): StructDb {
  if (typeof window === 'undefined') return { templates: [] };
  try { return JSON.parse(window.localStorage.getItem(LS_KEY) ?? '{"templates":[]}'); }
  catch { return { templates: [] }; }
}
function saveDb(db: StructDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`;
}

type Tab = 'matduong' | 'cong' | 'tuongchan' | 'mong' | 'excel';

// =====================================================================
// Main
// =====================================================================

export function StructuralPanel(): JSX.Element {
  const [db, setDbState] = useState<StructDb>(() => loadDb());
  const [tab, setTab] = useState<Tab>('matduong');
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: StructDb) => StructDb): void {
    setDbState((prev) => updater(prev));
  }
  function flash(m: string): void {
    setStatusMsg(m);
    setTimeout(() => setStatusMsg(''), 2200);
  }

  return (
    <div className="td-panel">
      <header className="td-panel-head">
        <h1>🏗 Bảng tính kết cấu</h1>
        <p className="td-lead">Calculator theo TCVN/22TCN cho mặt đường + cống + tường chắn + móng + thư viện Excel calculator.</p>
        {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
      </header>

      <div className="dos-tabs">
        <TabBtn active={tab === 'matduong'}  onClick={() => setTab('matduong')}>🛣 Mặt đường</TabBtn>
        <TabBtn active={tab === 'cong'}      onClick={() => setTab('cong')}>🟫 Cống</TabBtn>
        <TabBtn active={tab === 'tuongchan'} onClick={() => setTab('tuongchan')}>🧱 Tường chắn</TabBtn>
        <TabBtn active={tab === 'mong'}      onClick={() => setTab('mong')}>⬛ Móng đơn</TabBtn>
        <TabBtn active={tab === 'excel'}     onClick={() => setTab('excel')}>📊 Excel calculator ({db.templates.length})</TabBtn>
      </div>

      {tab === 'matduong'  && <MatDuongCalc inputs={db.matDuongInputs} onChange={(v) => setDb((d) => ({ ...d, matDuongInputs: v }))} />}
      {tab === 'cong'      && <CongCalc inputs={db.congInputs} onChange={(v) => setDb((d) => ({ ...d, congInputs: v }))} />}
      {tab === 'tuongchan' && <TuongChanCalc inputs={db.tuongInputs} onChange={(v) => setDb((d) => ({ ...d, tuongInputs: v }))} />}
      {tab === 'mong'      && <MongCalc inputs={db.mongInputs} onChange={(v) => setDb((d) => ({ ...d, mongInputs: v }))} />}
      {tab === 'excel'     && <ExcelTab db={db} setDb={setDb} flash={flash} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return <button type="button" className={`dos-tab${active ? ' dos-tab-active' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="td-field">
      <span className="td-field-label">{label}</span>
      {children}
      {hint && <span className="muted small" style={{ fontSize: 10.5 }}>{hint}</span>}
    </label>
  );
}

// =====================================================================
// 1. Mặt đường (22TCN 211-06)
// =====================================================================

interface MatDuongInputs {
  E_yc: number;        // Mô đun đàn hồi yêu cầu (MPa)
  E_dat: number;       // Mô đun đàn hồi nền đất
  // Lớp 1: BTNN
  h1: number; E1: number;
  // Lớp 2: BTNC
  h2: number; E2: number;
  // Lớp 3: CPDD I
  h3: number; E3: number;
  // Lớp 4: CPDD II
  h4: number; E4: number;
  loaiTaiTrong: 'truc_100kN' | 'truc_120kN' | 'tong_xe_he';
  ngayLap?: string;
}

const defaultMatDuong: MatDuongInputs = {
  E_yc: 155, E_dat: 42,
  h1: 5, E1: 1600,
  h2: 7, E2: 1200,
  h3: 18, E3: 300,
  h4: 30, E4: 250,
  loaiTaiTrong: 'truc_100kN',
};

function MatDuongCalc({ inputs, onChange }: { inputs?: MatDuongInputs; onChange: (v: MatDuongInputs) => void }): JSX.Element {
  const v = inputs ?? defaultMatDuong;
  function set<K extends keyof MatDuongInputs>(k: K, val: MatDuongInputs[K]): void {
    onChange({ ...v, [k]: val });
  }

  // Tính E chung 4 lớp theo Odemark (đơn giản hóa)
  const result = useMemo(() => {
    const layers = [
      { h: v.h1, E: v.E1 },
      { h: v.h2, E: v.E2 },
      { h: v.h3, E: v.E3 },
      { h: v.h4, E: v.E4 },
    ].filter((l) => l.h > 0);
    // Quy đổi về tương đương Odemark: h_eq = sum(h * (E/E_dat)^(1/3))
    let h_eq = 0;
    for (const l of layers) h_eq += l.h * Math.pow(l.E / v.E_dat, 1 / 3);
    // E_chung tính theo Bumister (chỉ áng chừng, mục đích kiểm tra sơ bộ)
    const D = 33; // đường kính vệt bánh xe (cm) cho trục 100kN
    const ratio = h_eq / D;
    // Approximation: E_chung / E_dat = a*ratio^b với a~6, b~0.5
    const E_chung = v.E_dat * (1 + 5.5 * Math.pow(ratio, 0.55));
    const dat = E_chung >= v.E_yc;
    const tongDay = layers.reduce((s, l) => s + l.h, 0);
    return { h_eq, E_chung, dat, tongDay, layers };
  }, [v]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">🛣 Mặt đường — kiểm tra E chung (22TCN 211-06)</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="E yêu cầu E_yc (MPa)" hint="Trục 100kN: ~155, trục 120kN: ~190">
            <input type="number" className="td-input" value={v.E_yc} onChange={(e) => set('E_yc', Number(e.target.value) || 0)} />
          </Field>
          <Field label="E nền đất E_dat (MPa)" hint="Đất tốt: 50, vừa: 42, yếu: 30">
            <input type="number" className="td-input" value={v.E_dat} onChange={(e) => set('E_dat', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Loại tải trọng">
            <select className="td-select" value={v.loaiTaiTrong} onChange={(e) => set('loaiTaiTrong', e.target.value as any)}>
              <option value="truc_100kN">Trục 100 kN</option>
              <option value="truc_120kN">Trục 120 kN</option>
              <option value="tong_xe_he">Tổng xe hệ</option>
            </select>
          </Field>
        </div>

        <h3 style={{ marginTop: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>Cấu tạo lớp (từ trên xuống)</h3>
        <div className="atgt-table-wrap">
          <table className="atgt-table">
            <thead><tr><th>Lớp</th><th>Loại</th><th style={{ width: 130 }}>Chiều dày h (cm)</th><th style={{ width: 150 }}>Mô đun E (MPa)</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>Bê tông nhựa nóng (BTNN)</td><td><input type="number" className="td-input" value={v.h1} onChange={(e) => set('h1', Number(e.target.value) || 0)} /></td><td><input type="number" className="td-input" value={v.E1} onChange={(e) => set('E1', Number(e.target.value) || 0)} /></td></tr>
              <tr><td>2</td><td>BTNC C19</td><td><input type="number" className="td-input" value={v.h2} onChange={(e) => set('h2', Number(e.target.value) || 0)} /></td><td><input type="number" className="td-input" value={v.E2} onChange={(e) => set('E2', Number(e.target.value) || 0)} /></td></tr>
              <tr><td>3</td><td>Cấp phối đá dăm loại I</td><td><input type="number" className="td-input" value={v.h3} onChange={(e) => set('h3', Number(e.target.value) || 0)} /></td><td><input type="number" className="td-input" value={v.E3} onChange={(e) => set('E3', Number(e.target.value) || 0)} /></td></tr>
              <tr><td>4</td><td>Cấp phối đá dăm loại II</td><td><input type="number" className="td-input" value={v.h4} onChange={(e) => set('h4', Number(e.target.value) || 0)} /></td><td><input type="number" className="td-input" value={v.E4} onChange={(e) => set('E4', Number(e.target.value) || 0)} /></td></tr>
            </tbody>
          </table>
        </div>

        <ResultBox title="Kết quả tính toán">
          <ResultRow label="Tổng chiều dày kết cấu" value={`${result.tongDay.toFixed(1)} cm`} />
          <ResultRow label="Chiều dày tương đương Odemark h_eq" value={`${result.h_eq.toFixed(1)} cm`} />
          <ResultRow label="Mô đun đàn hồi chung E_chung" value={`${result.E_chung.toFixed(1)} MPa`} highlight />
          <ResultRow label="Yêu cầu E_yc" value={`${v.E_yc} MPa`} />
          <ResultRow label="Kiểm tra" value={result.dat ? '✓ ĐẠT' : '✗ KHÔNG ĐẠT'} success={result.dat} />
        </ResultBox>
        <p className="muted small" style={{ marginTop: 10 }}>
          ⚠ Tính theo Odemark + Bumister giản hóa. Cho thiết kế chính thức cần kiểm tra thêm bằng phần mềm Bisar/KENPAVE hoặc Excel TCN211.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// 2. Cống đúc sẵn (TCVN 11823-3 + tải HL93 đơn giản hóa)
// =====================================================================

interface CongInputs {
  D: number;        // Khẩu độ trong (m)
  Hdat: number;     // Chiều cao đắp (m)
  loai: 'tron' | 'hop';
  tHopChieuDay: number;  // Cống hộp: chiều dày bản (m)
  fck: number;      // Cường độ bê tông MPa (M)
  fyk: number;      // Cường độ thép MPa
  taiTrong: 'HL93' | 'H30' | 'XB80';
}
const defaultCong: CongInputs = { D: 1.5, Hdat: 1.2, loai: 'tron', tHopChieuDay: 0.2, fck: 30, fyk: 400, taiTrong: 'HL93' };

function CongCalc({ inputs, onChange }: { inputs?: CongInputs; onChange: (v: CongInputs) => void }): JSX.Element {
  const v = inputs ?? defaultCong;
  function set<K extends keyof CongInputs>(k: K, val: CongInputs[K]): void { onChange({ ...v, [k]: val }); }

  const r = useMemo(() => {
    // Áp lực đất: pe = γ_dat × Hdat (kN/m²), γ_dat ~ 18 kN/m³
    const gamma_dat = 18;
    const pe = gamma_dat * v.Hdat;
    // Tải xe (đơn giản): ~ 30 kN/m² nếu HL93, 50 nếu XB80, 25 nếu H30
    const taiXe = v.taiTrong === 'HL93' ? 30 : v.taiTrong === 'XB80' ? 50 : 25;
    const ptotal = pe + taiXe;
    // Mômen mặt đỉnh (cho cống hộp simply supported): M = p × D² / 8
    const M = ptotal * v.D * v.D / 8; // kNm/m
    // Cốt thép Asd = M / (0.9 × d × fyk_design)
    const fyk_d = v.fyk * 0.87; // hệ số an toàn
    const d = (v.tHopChieuDay - 0.05) * 1000; // mm (concrete cover 50mm)
    const Asd_mm2 = (M * 1e6) / (0.9 * d * fyk_d);
    // Số thanh ϕ16 / m
    const dia = 16; const Aphy = Math.PI * dia * dia / 4;
    const num = Asd_mm2 / Aphy;
    return { pe, taiXe, ptotal, M, Asd_mm2, num: Math.ceil(num) };
  }, [v]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">🟫 Cống đúc sẵn — tính cốt thép</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="Khẩu độ D (m)"><input type="number" step={0.1} className="td-input" value={v.D} onChange={(e) => set('D', Number(e.target.value) || 0)} /></Field>
          <Field label="Cao đắp đất H (m)"><input type="number" step={0.1} className="td-input" value={v.Hdat} onChange={(e) => set('Hdat', Number(e.target.value) || 0)} /></Field>
          <Field label="Loại cống">
            <select className="td-select" value={v.loai} onChange={(e) => set('loai', e.target.value as any)}>
              <option value="tron">Cống tròn</option>
              <option value="hop">Cống hộp</option>
            </select>
          </Field>
          <Field label="Chiều dày bản (m)"><input type="number" step={0.05} className="td-input" value={v.tHopChieuDay} onChange={(e) => set('tHopChieuDay', Number(e.target.value) || 0)} /></Field>
          <Field label="fc' (MPa) M-#"><input type="number" className="td-input" value={v.fck} onChange={(e) => set('fck', Number(e.target.value) || 0)} /></Field>
          <Field label="fy thép (MPa)"><input type="number" className="td-input" value={v.fyk} onChange={(e) => set('fyk', Number(e.target.value) || 0)} /></Field>
          <Field label="Tải trọng">
            <select className="td-select" value={v.taiTrong} onChange={(e) => set('taiTrong', e.target.value as any)}>
              <option value="HL93">HL93 (TCVN 11823)</option>
              <option value="H30">H30 (cũ)</option>
              <option value="XB80">XB80</option>
            </select>
          </Field>
        </div>
        <ResultBox title="Kết quả">
          <ResultRow label="Áp lực đất pe" value={`${r.pe.toFixed(2)} kN/m²`} />
          <ResultRow label="Tải xe quy đổi" value={`${r.taiXe} kN/m²`} />
          <ResultRow label="Tổng tải p" value={`${r.ptotal.toFixed(2)} kN/m²`} />
          <ResultRow label="Mômen tính M" value={`${r.M.toFixed(2)} kNm/m`} highlight />
          <ResultRow label="Diện tích cốt thép cần As" value={`${r.Asd_mm2.toFixed(0)} mm²/m`} />
          <ResultRow label="Bố trí thép ϕ16" value={`${r.num} thanh ϕ16/m (a=${(1000 / r.num).toFixed(0)}mm)`} success />
        </ResultBox>
        <p className="muted small" style={{ marginTop: 10 }}>
          ⚠ Công thức đơn giản hóa cho thiết kế sơ bộ. Tính chính thức cần kiểm tra thêm uốn-xoắn-chọc thủng theo TCVN 11823-3.
        </p>
      </div>
    </section>
  );
}

// =====================================================================
// 3. Tường chắn (TCVN 9362)
// =====================================================================

interface TuongInputs {
  H: number;        // Chiều cao tường (m)
  B: number;        // Bề rộng đáy (m)
  gamma: number;    // Dung trọng đất kN/m³
  phi: number;      // Góc ma sát đất (độ)
  c: number;        // Lực dính đất kN/m²
  gamma_btct: number; // Dung trọng BTCT
  loai: 'trong_luc' | 'consol' | 'co_chong';
  he_so_ms_day: number;  // Hệ số ma sát đáy
}
const defaultTuong: TuongInputs = { H: 4, B: 2.5, gamma: 18, phi: 30, c: 5, gamma_btct: 24, loai: 'trong_luc', he_so_ms_day: 0.5 };

function TuongChanCalc({ inputs, onChange }: { inputs?: TuongInputs; onChange: (v: TuongInputs) => void }): JSX.Element {
  const v = inputs ?? defaultTuong;
  function set<K extends keyof TuongInputs>(k: K, val: TuongInputs[K]): void { onChange({ ...v, [k]: val }); }

  const r = useMemo(() => {
    // Áp lực Rankine chủ động Ka = tan²(45 - φ/2)
    const phiRad = (v.phi * Math.PI) / 180;
    const Ka = Math.pow(Math.tan(Math.PI / 4 - phiRad / 2), 2);
    // Tổng áp lực ngang Pa = 0.5 * γ * H² * Ka - 2*c*H*sqrt(Ka)
    const Pa = 0.5 * v.gamma * v.H * v.H * Ka - 2 * v.c * v.H * Math.sqrt(Ka);
    // Trọng lượng tường (giả định tiết diện chữ nhật B×H × γ_btct) — đơn giản
    const W = v.B * v.H * v.gamma_btct;
    // Hệ số trượt: Kt = (W * f) / Pa  (yêu cầu ≥ 1.5)
    const Kt = (W * v.he_so_ms_day) / Math.max(Pa, 0.01);
    // Hệ số lật: Kl = (W * B/2) / (Pa * H/3) (yêu cầu ≥ 1.5)
    const Kl = (W * v.B / 2) / Math.max(Pa * v.H / 3, 0.01);
    return { Ka, Pa, W, Kt, Kl, datTruot: Kt >= 1.5, datLat: Kl >= 1.5 };
  }, [v]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">🧱 Tường chắn — kiểm tra ổn định</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="Chiều cao H (m)"><input type="number" step={0.1} className="td-input" value={v.H} onChange={(e) => set('H', Number(e.target.value) || 0)} /></Field>
          <Field label="Bề rộng đáy B (m)"><input type="number" step={0.1} className="td-input" value={v.B} onChange={(e) => set('B', Number(e.target.value) || 0)} /></Field>
          <Field label="γ đất (kN/m³)"><input type="number" className="td-input" value={v.gamma} onChange={(e) => set('gamma', Number(e.target.value) || 0)} /></Field>
          <Field label="φ đất (độ)"><input type="number" className="td-input" value={v.phi} onChange={(e) => set('phi', Number(e.target.value) || 0)} /></Field>
          <Field label="c đất (kN/m²)"><input type="number" className="td-input" value={v.c} onChange={(e) => set('c', Number(e.target.value) || 0)} /></Field>
          <Field label="γ BTCT (kN/m³)"><input type="number" className="td-input" value={v.gamma_btct} onChange={(e) => set('gamma_btct', Number(e.target.value) || 0)} /></Field>
          <Field label="Loại tường">
            <select className="td-select" value={v.loai} onChange={(e) => set('loai', e.target.value as any)}>
              <option value="trong_luc">Trọng lực (BTCT)</option>
              <option value="consol">Console</option>
              <option value="co_chong">Có chống đỡ</option>
            </select>
          </Field>
          <Field label="Hệ số ms đáy f"><input type="number" step={0.05} className="td-input" value={v.he_so_ms_day} onChange={(e) => set('he_so_ms_day', Number(e.target.value) || 0)} /></Field>
        </div>
        <ResultBox title="Kết quả">
          <ResultRow label="Hệ số áp lực chủ động Ka" value={r.Ka.toFixed(3)} />
          <ResultRow label="Tổng áp lực ngang Pa" value={`${r.Pa.toFixed(2)} kN/m`} />
          <ResultRow label="Trọng lượng tường W" value={`${r.W.toFixed(2)} kN/m`} />
          <ResultRow label="Hệ số ổn định trượt Kt" value={r.Kt.toFixed(2)} highlight />
          <ResultRow label="Kiểm tra trượt (≥ 1.5)" value={r.datTruot ? '✓ ĐẠT' : '✗ KHÔNG ĐẠT'} success={r.datTruot} />
          <ResultRow label="Hệ số ổn định lật Kl" value={r.Kl.toFixed(2)} highlight />
          <ResultRow label="Kiểm tra lật (≥ 1.5)" value={r.datLat ? '✓ ĐẠT' : '✗ KHÔNG ĐẠT'} success={r.datLat} />
        </ResultBox>
      </div>
    </section>
  );
}

// =====================================================================
// 4. Móng đơn (TCVN 9362)
// =====================================================================

interface MongInputs {
  N: number;        // Tải đứng kN
  M: number;        // Mômen kNm
  Rtc: number;      // Cường độ đất tiêu chuẩn (kN/m²)
  hM: number;       // Chiều sâu đặt móng (m)
  gamma_btct: number;
  loai: 'don' | 'bang' | 'be';
}
const defaultMong: MongInputs = { N: 50, M: 5, Rtc: 200, hM: 1.2, gamma_btct: 25, loai: 'don' };

function MongCalc({ inputs, onChange }: { inputs?: MongInputs; onChange: (v: MongInputs) => void }): JSX.Element {
  const v = inputs ?? defaultMong;
  function set<K extends keyof MongInputs>(k: K, val: MongInputs[K]): void { onChange({ ...v, [k]: val }); }

  const r = useMemo(() => {
    // Diện tích sơ bộ F = N / (Rtc - γ_dat * hM)
    const gamma_dat = 18;
    const Rgross = v.Rtc - gamma_dat * v.hM;
    const F = v.N / Math.max(Rgross, 1);
    const a = Math.sqrt(F);  // móng vuông
    // Áp lực max + min do M
    const W = a * a * a / 6;  // mômen kháng
    const pmax = (v.N + a * a * v.hM * v.gamma_btct) / (a * a) + v.M / W;
    const pmin = (v.N + a * a * v.hM * v.gamma_btct) / (a * a) - v.M / W;
    return { F, a, pmax, pmin, datMax: pmax <= 1.2 * v.Rtc, datMin: pmin >= 0 };
  }, [v]);

  return (
    <section className="td-section">
      <h2 className="td-section-title">⬛ Móng đơn — kích thước + sức chịu tải</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <Field label="Tải đứng N (kN)"><input type="number" className="td-input" value={v.N} onChange={(e) => set('N', Number(e.target.value) || 0)} /></Field>
          <Field label="Mômen M (kNm)"><input type="number" step={0.1} className="td-input" value={v.M} onChange={(e) => set('M', Number(e.target.value) || 0)} /></Field>
          <Field label="Rtc đất (kN/m²)"><input type="number" className="td-input" value={v.Rtc} onChange={(e) => set('Rtc', Number(e.target.value) || 0)} /></Field>
          <Field label="Chiều sâu hM (m)"><input type="number" step={0.1} className="td-input" value={v.hM} onChange={(e) => set('hM', Number(e.target.value) || 0)} /></Field>
          <Field label="γ BTCT (kN/m³)"><input type="number" className="td-input" value={v.gamma_btct} onChange={(e) => set('gamma_btct', Number(e.target.value) || 0)} /></Field>
          <Field label="Loại móng">
            <select className="td-select" value={v.loai} onChange={(e) => set('loai', e.target.value as any)}>
              <option value="don">Móng đơn (vuông)</option>
              <option value="bang">Móng băng</option>
              <option value="be">Móng bè</option>
            </select>
          </Field>
        </div>
        <ResultBox title="Kết quả">
          <ResultRow label="Diện tích sơ bộ F" value={`${r.F.toFixed(2)} m²`} />
          <ResultRow label="Cạnh móng a (vuông)" value={`${r.a.toFixed(2)} m → chọn ${Math.ceil(r.a * 10) / 10} m`} highlight />
          <ResultRow label="Áp lực max p_max" value={`${r.pmax.toFixed(2)} kN/m²`} />
          <ResultRow label="Áp lực min p_min" value={`${r.pmin.toFixed(2)} kN/m²`} />
          <ResultRow label="Kiểm tra p_max ≤ 1.2 Rtc" value={r.datMax ? '✓ ĐẠT' : '✗ KHÔNG ĐẠT'} success={r.datMax} />
          <ResultRow label="Kiểm tra p_min ≥ 0" value={r.datMin ? '✓ ĐẠT (không nhổ)' : '✗ MÓNG NHỔ'} success={r.datMin} />
        </ResultBox>
      </div>
    </section>
  );
}

// =====================================================================
// 5. Excel calculator templates
// =====================================================================

function ExcelTab({ db, setDb, flash }: {
  db: StructDb;
  setDb: (u: (prev: StructDb) => StructDb) => void;
  flash: (m: string) => void;
}): JSX.Element {
  async function handleUpload(): Promise<void> {
    try {
      const path = await open({ title: 'Chọn file Excel calculator', filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'xlsm'] }] });
      if (typeof path !== 'string') return;
      const name = path.split(/[\\/]/).pop() ?? 'Calculator';
      const t: ExcelTemplate = { id: newId('tmpl'), name, path, uploadedAt: Date.now() };
      setDb((prev) => ({ ...prev, templates: [...prev.templates, t] }));
      flash(`✓ Đã thêm "${name}"`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  async function handleOpen(t: ExcelTemplate): Promise<void> {
    try { await openUrl(`file://${t.path}`); }
    catch (e) { flash(`✗ Không mở được: ${String(e)}`); }
  }

  function handleDelete(id: string): void {
    setDb((prev) => ({ ...prev, templates: prev.templates.filter((t) => t.id !== id) }));
  }

  return (
    <section className="td-section">
      <h2 className="td-section-title">Thư viện Excel calculator</h2>
      <div className="td-section-body">
        <div className="dos-action-bar">
          <button type="button" className="btn btn-primary" onClick={() => void handleUpload()}>📤 Upload Excel</button>
          <span className="muted small">Lưu link file Excel calculator (TCVN, công thức tính phức tạp). Mở trong Excel để dùng.</span>
        </div>
        {db.templates.length === 0 ? (
          <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
            Chưa có Excel calculator. Upload file .xlsx để lưu trong dự án.
          </p>
        ) : (
          <div className="dos-list">
            {db.templates.map((t) => (
              <div key={t.id} className="dos-list-item">
                <span className="dos-item-icon">📊</span>
                <span className="dos-item-name">{t.name}</span>
                <span className="muted small">{t.path}</span>
                <div className="dos-item-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => void handleOpen(t)}>📂 Mở</button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleDelete(t.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// =====================================================================
// Result box
// =====================================================================

function ResultBox({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="struct-result" style={{ marginTop: 18 }}>
      <div className="struct-result-title">{title}</div>
      <div className="struct-result-body">{children}</div>
    </div>
  );
}

function ResultRow({ label, value, highlight, success }: {
  label: string; value: string;
  highlight?: boolean; success?: boolean;
}): JSX.Element {
  return (
    <div className={`struct-result-row${highlight ? ' struct-row-highlight' : ''}${success === true ? ' struct-row-pass' : success === false ? ' struct-row-fail' : ''}`}>
      <span>{label}</span>
      <span><b>{value}</b></span>
    </div>
  );
}
