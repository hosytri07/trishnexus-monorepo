/**
 * TrishDesign Phase 28.5 — Vẽ mặt cắt hốt sạt (Bão Lũ).
 *
 * Project có nhiều mặt cắt (mỗi vụ sụt lở = 1 section).
 * Mỗi section: vị trí lý trình, ảnh hiện trường, kích thước (L×B×H + góc α),
 * loại vật liệu, tính V tự nhiên + V vận chuyển, vẽ AutoCAD + xuất Excel.
 */

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { autoCadStatus, autoCadSendCommands, autoCadEnsureDocument } from '../../lib/autocad.js';
import { generateSlideEventCommands } from '../../lib/baolu-script.js';

const LS_KEY = 'trishdesign:baolu-db';

// Loại vật liệu + hệ số nở rời (theo TCVN)
const MATERIALS = [
  { id: 'dat',      name: 'Đất pha cát',          k: 1.30 },
  { id: 'dat_set',  name: 'Đất sét',              k: 1.20 },
  { id: 'da_dam',   name: 'Đá dăm',               k: 1.45 },
  { id: 'da_lon',   name: 'Đá lớn / khối',        k: 1.50 },
  { id: 'cuoi_soi', name: 'Cuội sỏi',             k: 1.35 },
  { id: 'hon_hop',  name: 'Hỗn hợp đất + đá',     k: 1.40 },
];

type CrossType = 'nua_dao_nua_dap' | 'taluy_dao_2ben' | 'taluy_dap_2ben';

interface BaoLuSection {
  id: string;
  station: string;       // Lý trình "Km10+020"
  /** Lý trình dạng số (m) — bắt buộc để sort + tính Simpson */
  station_m: number;

  /** Phase 42 — Loại mặt cắt đường */
  crossType: CrossType;

  /** Bề rộng mặt đường (m) — default 7m */
  matDuongWidth: number;
  /** Bề rộng lề bên trái (m) — default 0.5m */
  leWidthLeft: number;
  /** Bề rộng lề bên phải (m) — default 0.5m */
  leWidthRight: number;
  /** Bề rộng rãnh (m, 0 nếu không có) */
  ranhWidth: number;
  /** Chiều sâu rãnh (m) */
  ranhDepth: number;
  /** Hệ số taluy đào 1:n (vd 1.0 = 1:1) */
  taluyDaoSlope: number;
  /** Hệ số taluy đắp 1:n (vd 1.5 = 1:1.5) */
  taluyDapSlope: number;

  /**
   * Phase 42 — Diện tích đất sụt (m²). Nguồn gốc xác định bởi areaSource.
   */
  areaDatSut: number;

  /**
   * Phase 42 wave 8 — Nguồn gốc diện tích đất sụt:
   *  - 'vision'  : AI Vision đo từ ảnh hiện trường (auto-fill khi đo xong)
   *  - 'polygon' : Pick polygon từ AutoCAD (Rust command đọc area)
   *  - 'geometry': Tính từ công thức hình học road geometry + depthSut
   *  - 'manual'  : User nhập tay
   */
  areaSource?: 'vision' | 'polygon' | 'geometry' | 'manual';

  /**
   * Phase 42 wave 8 — Chiều sâu đất sụt trung bình (m), dùng cho mode 'geometry'.
   * Tính areaDatSut = (matDuongWidth + leTrai + leFai + extra) × depthSut.
   */
  depthSut?: number;

  /** Vật liệu */
  materialId: string;

  /** Phase 42 — groupId nhóm các mặt cắt cùng 1 điểm sụt. */
  groupId?: string;

  /** Ảnh hiện trường + ghi chú */
  imageBase64?: string;
  imageName?: string;
  note?: string;

  // ─── Deprecated (giữ tương thích, KHÔNG dùng nữa) ───
  /** @deprecated Phase 42 — không cần tên mặt cắt */
  name?: string;
  /** @deprecated Phase 42 — L = chiều dài TỔNG của SlideEvent, không phải từng mặt cắt */
  L?: number;
  /** @deprecated Phase 42 — diện tích đất sụt nhập tay thay vì tính từ B/H/α */
  B?: number;
  H?: number;
  alpha?: number;

  createdAt: number;
}

const CROSS_TYPE_LABEL: Record<CrossType, string> = {
  nua_dao_nua_dap: 'Nửa đào nửa đắp',
  taluy_dao_2ben:  'Taluy đào 2 bên',
  taluy_dap_2ben:  'Taluy đắp 2 bên',
};

/**
 * Phase 42 — Điểm sụt trượt (Slide Event). 1 hồ sơ có nhiều điểm sụt, mỗi điểm có nhiều mặt cắt.
 * File thống kê cuối cùng = list các điểm sụt với tổng khối lượng từng điểm (Simpson).
 */
export interface BaoLuSlideEvent {
  id: string;
  name: string;          // VD "Vụ sụt Km10+020 → Km10+080 taluy âm"
  stationFrom?: string;  // Lý trình bắt đầu vùng sụt
  stationTo?: string;    // Lý trình kết thúc
  sectionIds: string[];  // Reference tới BaoLuSection.id thuộc về event này
  note?: string;
  createdAt: number;
}

interface BaoLuProject {
  id: string;
  name: string;
  diaDiem?: string;
  ngayKhaoSat?: string;
  sections: BaoLuSection[];
  /** Phase 42 — List điểm sụt (mỗi điểm chứa nhiều sectionIds). Optional cho data cũ. */
  slideEvents?: BaoLuSlideEvent[];
  createdAt: number;
  updatedAt: number;
}

interface BaoLuDb {
  projects: BaoLuProject[];
  activeProjectId: string | null;
}

function emptyDb(): BaoLuDb { return { projects: [], activeProjectId: null }; }
/**
 * Phase 42 — Default values cho mặt cắt mới (theo spec hốt sạt).
 */
function defaultBaoLuSection(): Omit<BaoLuSection, 'id' | 'createdAt'> {
  return {
    station: '',
    station_m: 0,
    crossType: 'nua_dao_nua_dap',
    matDuongWidth: 7,
    leWidthLeft: 0.5,
    leWidthRight: 0.5,
    ranhWidth: 0,
    ranhDepth: 0.3,
    taluyDaoSlope: 1.0,
    taluyDapSlope: 1.5,
    areaDatSut: 0,
    areaSource: 'vision',  // Phase 42 wave 8 — default dùng AI Vision
    depthSut: 1.0,         // Phase 42 wave 8 — chiều sâu sụt trung bình
    materialId: 'dat',
    note: '',
  };
}

/**
 * Phase 42 wave 8 — Tính diện tích đất sụt theo công thức hình học từ road geometry.
 *
 * - Nửa đào nửa đắp: 1 nửa mặt đường + lề bị sụt với chiều sâu trung bình depthSut.
 *   A = (matDuongWidth/2 + leTrai) × depthSut + chân taluy đắp (depthSut × taluyDapSlope × depthSut / 2)
 *
 * - Taluy đào 2 bên: cả mặt đường + 2 lề + 2 chân taluy đào.
 *   A = (matDuongWidth + leTrai + leFai + 2 × depthSut × taluyDaoSlope) × depthSut
 *
 * - Taluy đắp 2 bên: cả mặt đường + 2 lề + 2 chân taluy đắp.
 *   A = (matDuongWidth + leTrai + leFai + 2 × depthSut × taluyDapSlope) × depthSut
 */
export function computeAreaFromGeometry(s: BaoLuSection): number {
  const d = Math.max(s.depthSut ?? 0, 0);
  if (d <= 0) return 0;
  const W = (s.matDuongWidth ?? 7) + (s.leWidthLeft ?? 0) + (s.leWidthRight ?? 0);
  switch (s.crossType) {
    case 'nua_dao_nua_dap': {
      // 1 nửa đường bị sụt + 1 chân taluy đắp 2 phía
      const half = (s.matDuongWidth ?? 7) / 2 + (s.leWidthLeft ?? 0);
      const chanTaluy = d * (s.taluyDapSlope ?? 1.5);
      return half * d + 0.5 * chanTaluy * d;
    }
    case 'taluy_dao_2ben': {
      const extra = 2 * d * (s.taluyDaoSlope ?? 1.0);
      return (W + extra) * d;
    }
    case 'taluy_dap_2ben': {
      const extra = 2 * d * (s.taluyDapSlope ?? 1.5);
      return (W + extra) * d;
    }
    default:
      return W * d;
  }
}

/**
 * Phase 42 wave 8 — Resolve diện tích đất sụt cuối cùng theo areaSource.
 * 'geometry' → compute từ road geometry. Còn lại → dùng areaDatSut đã save sẵn.
 */
export function resolveAreaDatSut(s: BaoLuSection): number {
  if ((s.areaSource ?? 'manual') === 'geometry') {
    return computeAreaFromGeometry(s);
  }
  return s.areaDatSut ?? 0;
}

function newId(prefix: string): string { return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`; }

function loadDb(): BaoLuDb {
  if (typeof window === 'undefined') return emptyDb();
  try { return JSON.parse(window.localStorage.getItem(LS_KEY) ?? '{"projects":[],"activeProjectId":null}'); }
  catch { return emptyDb(); }
}
function saveDb(db: BaoLuDb): void {
  if (typeof window === 'undefined') return;
  // Strip imageBase64 trước khi save (size có thể quá lớn cho localStorage)
  const stripped: BaoLuDb = {
    ...db,
    projects: db.projects.map((p) => ({
      ...p,
      sections: p.sections.map((s) => ({ ...s, imageBase64: s.imageBase64 ? '__cached__' : undefined })),
    })),
  };
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(stripped)); } catch { /* ignore */ }
}

// Tính khối lượng — hình thang đáy mở rộng do mái dốc
/**
 * Phase 42 — Tính khối lượng 1 mặt cắt riêng lẻ (KHÔNG nhân với L vì L là chiều dài
 * tổng của điểm sụt). Trả về diện tích đất sụt + hệ số nở rời tham khảo.
 *
 * Khối lượng tổng cho 1 điểm sụt = computeSlideEventVolume() (Simpson tích phân
 * giữa các mặt cắt).
 */
function computeVolume(s: BaoLuSection, k: number): { vTuNhien: number; vVanChuyen: number; sMatCat: number } {
  // Phase 42 wave 8 — Dùng resolveAreaDatSut để hỗ trợ 4 nguồn (vision/polygon/geometry/manual)
  let sMatCat = resolveAreaDatSut(s);
  if (!sMatCat && s.B && s.H && s.alpha) {
    // Legacy compute từ schema cũ (data Phase 28.5)
    const aRad = (s.alpha * Math.PI) / 180;
    const tanA = Math.tan(aRad);
    const Btop = s.B + 2 * s.H / Math.max(tanA, 0.001);
    sMatCat = (s.B + Btop) / 2 * s.H;
  }
  // KHÔNG nhân L — vì 1 mặt cắt độc lập KHÔNG có chiều dài, chỉ có diện tích
  // Volume tham khảo = area × 1m (đơn vị nhất quán)
  const vTuNhien = sMatCat;
  const vVanChuyen = vTuNhien * k;
  return { vTuNhien, vVanChuyen, sMatCat };
}

/**
 * Phase 42 — Tính khối lượng tổng cho 1 GROUP mặt cắt (nhiều cross-section cùng 1 vụ sụt).
 *
 * Dùng công thức Simpson 1/3 nếu số mặt cắt LẺ (n=3,5,7...):
 *   V = (h/3) * (S₀ + 4S₁ + 2S₂ + 4S₃ + ... + Sₙ)
 *   với h = (stationCuối - stationĐầu) / (n-1)
 *
 * Dùng Trapezoid nếu số mặt cắt CHẴN:
 *   V = Σ ((Sᵢ + Sᵢ₊₁) / 2) * (stationᵢ₊₁ - stationᵢ)
 *
 * Sections phải đã sort theo station_m tăng dần.
 */
/**
 * Phase 42 — Tính khối lượng 1 SlideEvent (điểm sụt). Lấy các sections theo sectionIds → Simpson.
 */
export function computeSlideEventVolume(event: BaoLuSlideEvent, allSections: BaoLuSection[], k: number) {
  const sections = event.sectionIds
    .map((id) => allSections.find((s) => s.id === id))
    .filter((s): s is BaoLuSection => !!s);
  return computeGroupVolumeSimpson(sections, k);
}

export function computeGroupVolumeSimpson(sections: BaoLuSection[], k: number): {
  vTuNhien: number;
  vVanChuyen: number;
  totalArea: number;
  totalLength: number;
  count: number;
} {
  if (sections.length === 0) return { vTuNhien: 0, vVanChuyen: 0, totalArea: 0, totalLength: 0, count: 0 };
  // Sort theo station_m
  const sorted = [...sections].sort((a, b) => (a.station_m ?? 0) - (b.station_m ?? 0));
  // Phase 42 wave 8 — Tính diện tích mỗi mặt cắt qua resolveAreaDatSut (4 nguồn)
  const areas = sorted.map((s) => {
    const area = resolveAreaDatSut(s);
    if (area > 0) return area;
    // Fallback legacy compute cho data cũ
    if (s.B && s.H && s.alpha) {
      const aRad = (s.alpha * Math.PI) / 180;
      const tanA = Math.tan(aRad);
      const Btop = s.B + 2 * s.H / Math.max(tanA, 0.001);
      return (s.B + Btop) / 2 * s.H;
    }
    return 0;
  });
  const totalArea = areas.reduce((a, b) => a + b, 0);
  if (sorted.length === 1) {
    // Phase 42 — Chỉ 1 mặt cắt → KHÔNG đủ thông tin tính khối lượng (cần ít nhất 2 mặt cắt
    // để có khoảng cách). Trả về diện tích × 1m làm placeholder.
    const v = (areas[0] ?? 0) * 1;
    return { vTuNhien: v, vVanChuyen: v * k, totalArea, totalLength: 0, count: 1 };
  }
  // Trapezoid (an toàn cho mọi N >= 2)
  let v = 0;
  let totalLen = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const dx = ((sorted[i + 1]?.station_m ?? 0) - (sorted[i]?.station_m ?? 0));
    if (dx <= 0) continue;
    const avg = ((areas[i] ?? 0) + (areas[i + 1] ?? 0)) / 2;
    v += avg * dx;
    totalLen += dx;
  }
  return { vTuNhien: v, vVanChuyen: v * k, totalArea, totalLength: totalLen, count: sorted.length };
}

type DialogState =
  | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

export function BaoLuPanel(): JSX.Element {
  const [db, setDbState] = useState<BaoLuDb>(() => loadDb());
  const [statusMsg, setStatusMsg] = useState('');
  const [acadRunning, setAcadRunning] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: BaoLuDb) => BaoLuDb): void { setDbState((prev) => updater(prev)); }
  function flash(m: string): void { setStatusMsg(m); setTimeout(() => setStatusMsg(''), 2500); }

  useEffect(() => {
    autoCadStatus().then((s) => setAcadRunning(s.running));
    const t = setInterval(() => autoCadStatus().then((s) => setAcadRunning(s.running)), 5000);
    return () => clearInterval(t);
  }, []);

  const activeProject = useMemo(
    () => db.projects.find((p) => p.id === db.activeProjectId) ?? null,
    [db.projects, db.activeProjectId],
  );
  useEffect(() => {
    if (activeProject && !activeProject.sections.find((s) => s.id === activeSectionId)) {
      setActiveSectionId(activeProject.sections[0]?.id ?? null);
    }
  }, [activeProject, activeSectionId]);

  const activeSection = useMemo(
    () => activeProject?.sections.find((s) => s.id === activeSectionId) ?? null,
    [activeProject, activeSectionId],
  );

  function updateActiveProject(updater: (p: BaoLuProject) => BaoLuProject): void {
    if (!activeProject) return;
    setDb((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === activeProject.id ? { ...updater(p), updatedAt: Date.now() } : p)),
    }));
  }
  function updateActiveSection(updater: (s: BaoLuSection) => BaoLuSection): void {
    if (!activeSection) return;
    updateActiveProject((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id === activeSection.id ? updater(s) : s)),
    }));
  }

  function handleNewProject(): void {
    setDialog({
      kind: 'prompt', title: 'Tạo dự án mới', value: 'Sụt lở đợt mới',
      onSubmit: (name) => {
        const proj: BaoLuProject = {
          id: newId('proj'), name,
          sections: [], createdAt: Date.now(), updatedAt: Date.now(),
        };
        setDb((prev) => ({ ...prev, projects: [...prev.projects, proj], activeProjectId: proj.id }));
        flash(`✓ Đã tạo "${name}"`);
      },
    });
  }
  function handleDeleteProject(id: string): void {
    const t = db.projects.find((p) => p.id === id); if (!t) return;
    setDialog({
      kind: 'confirm', title: 'Xóa dự án', danger: true,
      message: `Xóa "${t.name}" cùng ${t.sections.length} mặt cắt?`,
      onConfirm: () => setDb((prev) => ({
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        activeProjectId: prev.activeProjectId === id ? null : prev.activeProjectId,
      })),
    });
  }

  function handleNewSection(): void {
    if (!activeProject) return;
    const sec: BaoLuSection = {
      ...defaultBaoLuSection(),
      id: newId('sec'),
      station: `Km0+${(activeProject.sections.length * 50).toString().padStart(3, '0')}`,
      station_m: activeProject.sections.length * 50,
      createdAt: Date.now(),
    };
    updateActiveProject((p) => ({ ...p, sections: [...p.sections, sec] }));
    setActiveSectionId(sec.id);
  }
  function handleDeleteSection(): void {
    if (!activeSection) return;
    setDialog({
      kind: 'confirm', title: 'Xóa mặt cắt', danger: true,
      message: `Xóa mặt cắt "${activeSection.station || '(chưa nhập)'}"?`,
      onConfirm: () => updateActiveProject((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== activeSection.id) })),
    });
  }

  async function handlePickImage(): Promise<void> {
    if (!activeSection) return;
    try {
      const path = await open({
        title: 'Chọn ảnh hiện trường', filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (typeof path !== 'string') return;
      // Phase 28.7b: dùng convertFileSrc để Tauri custom protocol → fetch image
      const url = convertFileSrc(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const r = new FileReader();
      r.onload = () => {
        const base64 = r.result as string;
        updateActiveSection((s) => ({ ...s, imageBase64: base64, imageName: path.split(/[\\/]/).pop() ?? '' }));
        flash('✓ Đã tải ảnh');
      };
      r.onerror = () => flash('✗ Lỗi đọc file ảnh');
      r.readAsDataURL(blob);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  async function handleAiMeasure(): Promise<void> {
    const sec = activeSection;
    if (!sec || !sec.imageBase64 || sec.imageBase64 === '__cached__') {
      flash('Chưa có ảnh hiện trường để AI đo.');
      return;
    }
    const groqKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:groq-api-key') ?? '' : '').trim();
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:gemini-api-key') ?? '' : '').trim();
    if (!groqKey && !geminiKey) {
      flash('✗ Chưa có API key. Vào TrishAdmin → 🔐 API Keys.');
      return;
    }

    // Phase 42 wave 8 — Prompt mới: AI ước lượng DIỆN TÍCH đất sụt (m²) trực tiếp
    const systemPrompt = `Bạn là kỹ sư cầu đường VN. Phân tích ảnh hiện trường mặt cắt sạt lở / hốt sạt → ước tính diện tích vùng đất sụt.
Trả ra JSON object DUY NHẤT (không markdown):
{
  "station": "Km0+520",     // lý trình ước đoán nếu thấy biển/cọc; null nếu không thấy
  "areaDatSut": 12.5,        // DIỆN TÍCH ĐẤT SỤT (m²) — trace đường viền vùng sụt, tỷ lệ ước bằng vật mốc trong ảnh
  "depthSut": 1.5,           // chiều sâu sụt trung bình (m), tham khảo
  "materialId": "dat",       // 1 trong: dat, dat_set, da_dam, da_lon, cuoi_soi, hon_hop
  "note": "Ghi chú tiếng Việt — vd loại đất, mức độ sạt, ảnh hưởng giao thông"
}
Quy tắc: Nếu không ước được giá trị nào, để 0 nhưng vẫn trả đủ keys. JSON only.`;

    flash('⏳ AI Vision đang phân tích ảnh...');
    try {
      // Ưu tiên Gemini cho ảnh ngoài trời
      if (geminiKey) {
        try {
          const m = sec.imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
          const mime = m ? m[1] : 'image/jpeg';
          const data = m ? m[2] : sec.imageBase64;
          const reply = await invoke<string>('gemini_vision', {
            req: {
              apiKey: geminiKey,
              model: 'gemini-2.0-flash',
              prompt: `${systemPrompt}\n\nPhân tích ảnh và trả JSON theo format trên.`,
              imageBase64: data,
              mimeType: mime,
              maxTokens: 1024,
            },
          });
          const jm = reply.match(/\{[\s\S]*\}/);
          if (jm) {
            const parsed = JSON.parse(jm[0]);
            // Phase 42 wave 8 — Parse schema mới (areaDatSut + depthSut)
            const area = Number(parsed.areaDatSut) > 0 ? Number(parsed.areaDatSut) : 0;
            const depth = Number(parsed.depthSut) > 0 ? Number(parsed.depthSut) : undefined;
            updateActiveSection((s) => ({
              ...s,
              station: typeof parsed.station === 'string' ? parsed.station : s.station,
              areaDatSut: area > 0 ? area : (s.areaDatSut ?? 0),
              areaSource: area > 0 ? 'vision' : s.areaSource,
              depthSut: depth ?? s.depthSut,
              materialId: typeof parsed.materialId === 'string' && MATERIALS.some((mat) => mat.id === parsed.materialId) ? parsed.materialId : s.materialId,
              note: typeof parsed.note === 'string' ? parsed.note : s.note,
            }));
            flash(`✓ Gemini đã đo: S = ${area.toFixed(2)} m² · d ≈ ${depth ?? '—'} m`);
            return;
          }
          flash('⚠ Gemini không trả JSON, thử Groq...');
        } catch (e) {
          flash(`⚠ Gemini: ${String(e).slice(0, 80)} — thử Groq`);
        }
      }
      // Fallback Groq
      if (groqKey) {
        const reply = await invoke<string>('groq_chat', {
          req: {
            apiKey: groqKey,
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: [
                { type: 'text', text: 'Phân tích ảnh + trả JSON.' },
                { type: 'image_url', image_url: { url: sec.imageBase64 } },
              ] },
            ],
            maxTokens: 1024,
          },
        });
        const jm = reply.match(/\{[\s\S]*\}/);
        if (jm) {
          const parsed = JSON.parse(jm[0]);
          // Phase 42 wave 8 — Parse schema mới (areaDatSut + depthSut)
          const area = Number(parsed.areaDatSut) > 0 ? Number(parsed.areaDatSut) : 0;
          const depth = Number(parsed.depthSut) > 0 ? Number(parsed.depthSut) : undefined;
          updateActiveSection((s) => ({
            ...s,
            station: typeof parsed.station === 'string' ? parsed.station : s.station,
            areaDatSut: area > 0 ? area : (s.areaDatSut ?? 0),
            areaSource: area > 0 ? 'vision' : s.areaSource,
            depthSut: depth ?? s.depthSut,
            materialId: typeof parsed.materialId === 'string' && MATERIALS.some((mat) => mat.id === parsed.materialId) ? parsed.materialId : s.materialId,
            note: typeof parsed.note === 'string' ? parsed.note : s.note,
          }));
          flash(`✓ Groq đã đo: S = ${area.toFixed(2)} m² · d ≈ ${depth ?? '—'} m`);
          return;
        }
      }
      flash('✗ AI không trả JSON hợp lệ.');
    } catch (e) {
      flash(`✗ AI Vision: ${String(e).slice(0, 100)}`);
    }
  }

  /**
   * Phase 42 — Vẽ A3 cho 1 điểm sụt: bố trí các mặt cắt trong khung A3 scale 0.2 + bảng thống kê.
   */
  async function handleDrawSlideEventA3(eventId?: string): Promise<void> {
    if (!activeProject || activeProject.sections.length === 0) {
      flash('Không có mặt cắt để vẽ');
      return;
    }
    if (!acadRunning) {
      flash('Chưa kết nối AutoCAD. Mở AutoCAD trống trước.');
      return;
    }
    try {
      await autoCadEnsureDocument();
      // Tìm SlideEvent — nếu không có thì tạo virtual event chứa tất cả sections
      const events = activeProject.slideEvents ?? [];
      const ev = eventId ? events.find((e) => e.id === eventId) : events[0];
      const virtualEvent = ev ?? {
        id: 'virtual_all',
        name: activeProject.name || 'Tất cả mặt cắt',
        sectionIds: activeProject.sections.map((s) => s.id),
      };
      const sections = virtualEvent.sectionIds
        .map((id) => activeProject.sections.find((s) => s.id === id))
        .filter((s): s is BaoLuSection => !!s)
        .sort((a, b) => (a.station_m ?? 0) - (b.station_m ?? 0));
      if (sections.length === 0) {
        flash('Không có mặt cắt trong điểm sụt');
        return;
      }
      const mat = MATERIALS.find((m) => m.id === sections[0]?.materialId) ?? MATERIALS[0]!;
      const cmds = generateSlideEventCommands(virtualEvent, sections, mat.k);
      const sent = await autoCadSendCommands(cmds);
      flash(`✓ Đã vẽ A3 khung scale 0.2 với ${sections.length} mặt cắt + bảng thống kê (${sent} lệnh).`);
    } catch (e) {
      flash(`✗ Lỗi vẽ A3: ${String(e).slice(0, 100)}`);
    }
  }

  // Phase 42 wave 8 — Bỏ handleDrawAcad legacy (schema cũ B/H/α). Dùng handleDrawSlideEventA3 thay thế.

  async function handleExportExcel(): Promise<void> {
    if (!activeProject || activeProject.sections.length === 0) {
      flash('Không có dữ liệu để xuất'); return;
    }
    const wb = XLSX.utils.book_new();
    // Phase 42 wave 8 — Excel theo schema mới (đất sụt areaDatSut + road geometry)
    const rows: (string | number)[][] = [
      [`BÁO CÁO KHỐI LƯỢNG SỤT LỞ: ${activeProject.name}`],
      [`Địa điểm: ${activeProject.diaDiem ?? ''}`],
      [`Ngày khảo sát: ${activeProject.ngayKhaoSat ?? ''}`],
      [],
      ['STT', 'Lý trình', 'Lý trình (m)', 'Loại mặt cắt', 'B đường (m)', 'Lề trái (m)', 'Lề phải (m)', 'Nguồn S', 'S đất sụt (m²)', 'Vật liệu', 'k', 'V tự nhiên (m³)', 'V vận chuyển (m³)', 'Ghi chú'],
    ];
    let totalVTN = 0, totalVVC = 0;
    activeProject.sections.forEach((sec, i) => {
      const mat = MATERIALS.find((m) => m.id === sec.materialId) ?? MATERIALS[0]!;
      const v = computeVolume(sec, mat.k);
      totalVTN += v.vTuNhien; totalVVC += v.vVanChuyen;
      rows.push([
        i + 1,
        sec.station,
        sec.station_m ?? 0,
        CROSS_TYPE_LABEL[sec.crossType] ?? '—',
        sec.matDuongWidth ?? 7,
        sec.leWidthLeft ?? 0,
        sec.leWidthRight ?? 0,
        sec.areaSource === 'vision' ? 'AI Vision'
          : sec.areaSource === 'polygon' ? 'AutoCAD'
          : sec.areaSource === 'geometry' ? 'Hình học'
          : 'Nhập tay',
        Number(v.sMatCat.toFixed(2)),
        mat.name, mat.k,
        Number(v.vTuNhien.toFixed(2)),
        Number(v.vVanChuyen.toFixed(2)),
        sec.note ?? '',
      ]);
    });
    rows.push([]);
    rows.push(['', '', '', 'TỔNG', '', '', '', '', '', '', '', Number(totalVTN.toFixed(2)), Number(totalVVC.toFixed(2)), '']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 9 }, { wch: 9 },
      { wch: 11 }, { wch: 14 }, { wch: 22 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Khối lượng');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safe = activeProject.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
    const path = await save({
      title: 'Lưu báo cáo khối lượng',
      defaultPath: `BaoLu_${safe}_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất Excel');
  }

  // -------------------------------------------------------------------
  // Render — luôn hiện UI, banner khi chưa có project
  // -------------------------------------------------------------------
  if (!activeProject) {
    return (
      <>
        <div className="td-panel">
          <header className="td-panel-head">
            <h1>🌊 Vẽ mặt cắt hốt sạt</h1>
            <p className="td-lead">
              Bão lũ · Sụt lở · AI ảnh · Tính khối lượng đất đá vận chuyển.
              AutoCAD: {acadRunning ? <span style={{ color: '#16a34a', fontWeight: 600 }}>● Đã kết nối</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>● Chưa mở</span>}
            </p>
          </header>
          <div className="dos-toolbar">
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự án mới</button>
            <span className="muted small">Quản lý nhiều mặt cắt sụt lở theo lý trình.</span>
            <div style={{ flex: 1 }} />
            {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
          </div>
          <div className="empty-banner">
            <h3 className="empty-banner-title">🌊 Chưa có dự án — hãy tạo dự án mới</h3>
            <p className="empty-banner-msg">
              Tạo dự án để bắt đầu khảo sát các điểm sụt lở: kích thước, ảnh hiện trường, tính V tự nhiên + V vận chuyển, vẽ AutoCAD và xuất Excel báo cáo.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleNewProject}>➕ Tạo dự án mới</button>
            {db.projects.length > 0 && (
              <div className="empty-banner-recent">
                <div className="atgt-recent-label">Dự án gần đây:</div>
                {db.projects.map((p) => (
                  <button key={p.id} type="button" className="atgt-recent-item"
                    onClick={() => setDb((prev) => ({ ...prev, activeProjectId: p.id }))}>
                    🌊 {p.name} <span className="muted small">({p.sections.length} mặt cắt)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogModal state={dialog} onClose={() => setDialog(null)} />
      </>
    );
  }

  return (
    <>
      <div className="td-panel">
        <header className="td-panel-head">
          <h1>🌊 Vẽ mặt cắt hốt sạt — {activeProject.name}</h1>
          <p className="td-lead">
            AutoCAD: {acadRunning ? <span style={{ color: '#16a34a', fontWeight: 600 }}>● Đã kết nối</span> : <span style={{ color: '#dc2626', fontWeight: 600 }}>● Chưa mở</span>}
          </p>
          {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
        </header>

        <div className="dos-toolbar">
          <select className="td-select" style={{ minWidth: 240 }}
            value={activeProject.id}
            onChange={(e) => setDb((prev) => ({ ...prev, activeProjectId: e.target.value }))}>
            {db.projects.map((p) => <option key={p.id} value={p.id}>🌊 {p.name}</option>)}
          </select>
          <button type="button" className="btn btn-ghost" onClick={handleNewProject}>➕</button>
          <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(activeProject.id)}>🗑</button>
          <span className="atgt-selector-sep">|</span>
          <select className="td-select" style={{ minWidth: 200 }}
            value={activeSectionId ?? ''}
            onChange={(e) => setActiveSectionId(e.target.value || null)}>
            <option value="">— Mặt cắt —</option>
            {activeProject.sections.map((s, i) => <option key={s.id} value={s.id}>📐 MC-{i + 1} ({s.station || '?'})</option>)}
          </select>
          <button type="button" className="btn btn-ghost" onClick={handleNewSection}>➕</button>
          {activeSection && <button type="button" className="btn btn-ghost" onClick={handleDeleteSection}>🗑</button>}
          <div style={{ flex: 1 }} />
          {/* Phase 42 wave 8 — Gộp 2 nút "Vẽ AutoCAD" + "Vẽ A3 + bảng" thành 1 nút duy nhất */}
          <button type="button" className="btn btn-primary" onClick={() => void handleDrawSlideEventA3()}
            disabled={!acadRunning || activeProject.sections.length === 0}
            title="Vẽ khung A3 scale 0.2 với tất cả mặt cắt + bảng thống kê khối lượng">📐 Vẽ AutoCAD</button>
          <button type="button" className="btn btn-ghost" onClick={() => void handleExportExcel()}
            disabled={activeProject.sections.length === 0}>📊 Xuất Excel</button>
        </div>

        {/* Project metadata */}
        <section className="td-section">
          <h2 className="td-section-title">Thông tin chung dự án</h2>
          <div className="td-section-body">
            <div className="td-form-row">
              <label className="td-field"><span className="td-field-label">Tên</span>
                <input className="td-input" value={activeProject.name} onChange={(e) => updateActiveProject((p) => ({ ...p, name: e.target.value }))} /></label>
              <label className="td-field"><span className="td-field-label">Địa điểm</span>
                <input className="td-input" value={activeProject.diaDiem ?? ''} onChange={(e) => updateActiveProject((p) => ({ ...p, diaDiem: e.target.value }))} /></label>
              <label className="td-field"><span className="td-field-label">Ngày khảo sát</span>
                <input type="date" className="td-input" value={activeProject.ngayKhaoSat ?? ''} onChange={(e) => updateActiveProject((p) => ({ ...p, ngayKhaoSat: e.target.value }))} /></label>
            </div>
          </div>
        </section>

        {activeSection ? (
          <SectionEditor section={activeSection} onUpdate={updateActiveSection} pickImage={handlePickImage} aiMeasure={() => void handleAiMeasure()} />
        ) : (
          <section className="td-section">
            <div className="td-section-body" style={{ textAlign: 'center', padding: 32 }}>
              <p>Chưa có mặt cắt nào.</p>
              <button type="button" className="btn btn-primary" onClick={handleNewSection}>➕ Thêm mặt cắt đầu tiên</button>
            </div>
          </section>
        )}

        {/* Sections summary table */}
        <SectionsSummary project={activeProject} />
      </div>
      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function SectionEditor({ section, onUpdate, pickImage, aiMeasure }: {
  section: BaoLuSection;
  onUpdate: (u: (s: BaoLuSection) => BaoLuSection) => void;
  pickImage: () => Promise<void>;
  aiMeasure: () => void;
}): JSX.Element {
  const mat = MATERIALS.find((m) => m.id === section.materialId) ?? MATERIALS[0]!;
  const v = computeVolume(section, mat.k);

  function set<K extends keyof BaoLuSection>(k: K, val: BaoLuSection[K]): void {
    onUpdate((s) => ({ ...s, [k]: val }));
  }

  // Phase 42 — Tab Số liệu vs AI Vision (rõ ràng hơn cho user)
  const [editorTab, setEditorTab] = useState<'data' | 'vision'>('data');

  return (
    <section className="td-section">
      <h2 className="td-section-title">📐 Mặt cắt: {section.station || '(chưa nhập lý trình)'}</h2>

      {/* Phase 42 — Tab switcher */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <button
          type="button"
          onClick={() => setEditorTab('data')}
          style={{
            padding: '8px 16px',
            background: editorTab === 'data' ? 'var(--color-accent-soft)' : 'transparent',
            border: 'none',
            borderBottom: editorTab === 'data' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: editorTab === 'data' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >📝 Nhập số liệu</button>
        <button
          type="button"
          onClick={() => setEditorTab('vision')}
          style={{
            padding: '8px 16px',
            background: editorTab === 'vision' ? 'var(--color-accent-soft)' : 'transparent',
            border: 'none',
            borderBottom: editorTab === 'vision' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
            color: editorTab === 'vision' ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >🤖 AI Vision đo ảnh</button>
      </div>

      <div className="td-section-body" style={{ display: editorTab === 'data' ? 'block' : 'none' }}>
        {/* Phase 42 — Lý trình + Vật liệu + Loại mặt cắt */}
        <div className="td-form-row">
          <label className="td-field"><span className="td-field-label">Lý trình</span>
            <input className="td-input" placeholder="Km10+020" value={section.station} onChange={(e) => set('station', e.target.value)} /></label>
          <label className="td-field"><span className="td-field-label">Lý trình (m)</span>
            <input type="number" className="td-input" placeholder="10020" value={section.station_m ?? 0} onChange={(e) => set('station_m', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Loại mặt cắt</span>
            <select className="td-select" value={section.crossType ?? 'nua_dao_nua_dap'} onChange={(e) => set('crossType', e.target.value as 'nua_dao_nua_dap' | 'taluy_dao_2ben' | 'taluy_dap_2ben')}>
              <option value="nua_dao_nua_dap">Nửa đào nửa đắp</option>
              <option value="taluy_dao_2ben">Taluy đào 2 bên</option>
              <option value="taluy_dap_2ben">Taluy đắp 2 bên</option>
            </select></label>
          <label className="td-field"><span className="td-field-label">Vật liệu</span>
            <select className="td-select" value={section.materialId} onChange={(e) => set('materialId', e.target.value)}>
              {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name} (k={m.k})</option>)}
            </select></label>
        </div>

        {/* Phase 42 wave 8 — Diện tích đất sụt: 4 nguồn (AI Vision / AutoCAD / Hình học / Nhập tay) */}
        <AreaSourceEditor section={section} onUpdate={onUpdate} />


        {/* Phase 42 — Road geometry: mặt đường + lề + rãnh + taluy */}
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <label className="td-field"><span className="td-field-label">Bề rộng mặt đường (m)</span>
            <input type="number" step={0.1} className="td-input" value={section.matDuongWidth ?? 7} onChange={(e) => set('matDuongWidth', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Lề trái (m)</span>
            <input type="number" step={0.1} className="td-input" value={section.leWidthLeft ?? 0.5} onChange={(e) => set('leWidthLeft', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Lề phải (m)</span>
            <input type="number" step={0.1} className="td-input" value={section.leWidthRight ?? 0.5} onChange={(e) => set('leWidthRight', Number(e.target.value) || 0)} /></label>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <label className="td-field"><span className="td-field-label">Bề rộng rãnh (m, 0 = không có)</span>
            <input type="number" step={0.1} className="td-input" value={section.ranhWidth ?? 0} onChange={(e) => set('ranhWidth', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Sâu rãnh (m)</span>
            <input type="number" step={0.1} className="td-input" value={section.ranhDepth ?? 0.3} onChange={(e) => set('ranhDepth', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Taluy đào 1:n (vd 1.0)</span>
            <input type="number" step={0.1} className="td-input" value={section.taluyDaoSlope ?? 1.0} onChange={(e) => set('taluyDaoSlope', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">Taluy đắp 1:n (vd 1.5)</span>
            <input type="number" step={0.1} className="td-input" value={section.taluyDapSlope ?? 1.5} onChange={(e) => set('taluyDapSlope', Number(e.target.value) || 0)} /></label>
        </div>

        <div className="td-form-row" style={{ marginTop: 12 }}>
          <label className="td-field" style={{ flex: 2 }}><span className="td-field-label">Ghi chú</span>
            <input className="td-input" value={section.note ?? ''} onChange={(e) => set('note', e.target.value)} /></label>
        </div>

      </div>{/* end tab data */}

      <div className="td-section-body" style={{ display: editorTab === 'vision' ? 'block' : 'none' }}>
        {/* Phase 42 — Tab AI Vision: upload ảnh + AI tự đo diện tích đất sụt */}
        <div style={{ padding: '12px 0 16px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 16 }}>
          <p className="muted small" style={{ marginBottom: 8 }}>
            🤖 <strong>AI Vision đo diện tích đất sụt từ ảnh hiện trường.</strong> Upload ảnh chụp mặt cắt thực tế →
            AI (Gemini Vision / Groq Llama Vision) sẽ phân tích đường viền đất sụt và tự fill <strong>Diện tích (m²)</strong>
            qua tab "Nhập số liệu".
          </p>
          <p className="muted" style={{ fontSize: 11 }}>
            ⚠ Khuyến nghị: ảnh có thước đo / cọc tiêu để AI ước lượng tỉ lệ chính xác hơn.
            Đối với hình phức tạp, AI chỉ ước lượng — Trí có thể chỉnh tay ở tab Số liệu.
          </p>
        </div>

        {/* Image + result */}
        <div className="bl-grid">
          <div>
            <div className="dos-action-bar" style={{ paddingBottom: 0, borderBottom: 'none' }}>
              <button type="button" className="btn btn-primary" onClick={() => void pickImage()}>📷 Tải ảnh hiện trường</button>
              <button type="button" className="btn btn-ghost" onClick={aiMeasure} disabled={!section.imageBase64}>🤖 AI đo diện tích đất sụt</button>
            </div>
            {section.imageBase64 && section.imageBase64 !== '__cached__' ? (
              <div className="ocr-image-wrap" style={{ marginTop: 8 }}>
                <img src={section.imageBase64} alt={section.imageName} className="ocr-image" />
                <div className="muted small">{section.imageName}</div>
              </div>
            ) : (
              <p className="muted small" style={{ padding: 24, textAlign: 'center' }}>
                {section.imageBase64 === '__cached__' ? '(Ảnh đã được tải trước, reload session để tải lại)' : 'Chưa có ảnh hiện trường.'}
              </p>
            )}
          </div>

          <div>
            <div className="struct-result">
              <div className="struct-result-title">Kết quả tính khối lượng</div>
              <div className="struct-result-body">
                <div className="struct-result-row"><span>Diện tích mặt cắt S</span><span><b>{v.sMatCat.toFixed(2)} m²</b></span></div>
                <div className="struct-result-row struct-row-highlight"><span>Khối lượng tự nhiên V</span><span><b>{v.vTuNhien.toFixed(2)} m³</b></span></div>
                <div className="struct-result-row"><span>Hệ số nở rời k</span><span><b>{mat.k} (vật liệu: {mat.name})</b></span></div>
                <div className="struct-result-row struct-row-highlight"><span>Khối lượng vận chuyển V·k</span><span><b>{v.vVanChuyen.toFixed(2)} m³</b></span></div>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              💡 Công thức: S = (B + B + 2H/tanα)/2 × H. V_VC = V_TN × k (hệ số nở rời).
            </p>
          </div>
        </div>
      </div>{/* end tab vision */}
    </section>
  );
}

/**
 * Phase 42 wave 8 — Editor diện tích đất sụt với 4 nguồn:
 *  - vision  : đọc từ AI (tab AI Vision đo ảnh)
 *  - polygon : pick từ AutoCAD (gửi _AREA O, user click polygon, copy area vào ô)
 *  - geometry: tính từ road geometry + depthSut (auto, readonly)
 *  - manual  : user nhập tay
 */
function AreaSourceEditor({ section, onUpdate }: {
  section: BaoLuSection;
  onUpdate: (u: (s: BaoLuSection) => BaoLuSection) => void;
}): JSX.Element {
  const source = section.areaSource ?? 'manual';
  const isReadOnly = source === 'geometry' || source === 'vision';
  const displayArea = source === 'geometry' ? computeAreaFromGeometry(section) : (section.areaDatSut ?? 0);

  async function handlePickFromAcad(): Promise<void> {
    try {
      // Gửi lệnh AutoCAD AREA Object — user pick polyline/region trong CAD, AREA hiện trên command line
      await autoCadEnsureDocument();
      await autoCadSendCommands(['._AREA\nO\n']);
      // AREA giá trị hiện trên CAD command line — không thể đọc trực tiếp (1-way bridge),
      // user copy paste vào ô bên dưới. Tạm thời cứ để vậy, Wave sau thêm Rust read.
    } catch (e) {
      console.warn('AutoCAD AREA pick:', e);
    }
  }

  return (
    <div style={{ marginTop: 12, padding: 12, background: 'rgba(220, 38, 38, 0.08)', borderRadius: 8, border: '1px solid rgba(220, 38, 38, 0.3)' }}>
      <div className="td-form-row" style={{ alignItems: 'flex-end' }}>
        <label className="td-field" style={{ flex: 1 }}>
          <span className="td-field-label" style={{ color: '#dc2626' }}>📥 Nguồn diện tích đất sụt</span>
          <select
            className="td-select"
            value={source}
            onChange={(e) => onUpdate((s) => ({ ...s, areaSource: e.target.value as BaoLuSection['areaSource'] }))}
          >
            <option value="vision">🤖 AI Vision đo ảnh (auto-fill khi AI đo xong)</option>
            <option value="polygon">📐 Polygon AutoCAD (pick từ CAD rồi copy area)</option>
            <option value="geometry">📏 Công thức hình học (auto tính từ B + lề + chiều sâu sụt)</option>
            <option value="manual">✏ Nhập tay</option>
          </select>
        </label>
        <label className="td-field" style={{ flex: 1 }}>
          <span className="td-field-label" style={{ color: '#dc2626' }}>🔴 Diện tích đất sụt (m²)</span>
          <input
            type="number"
            step={0.01}
            className="td-input"
            placeholder="VD: 12.5"
            value={displayArea ? displayArea.toFixed(2) : 0}
            readOnly={isReadOnly}
            onChange={(e) => onUpdate((s) => ({ ...s, areaDatSut: Number(e.target.value) || 0 }))}
          />
        </label>
      </div>

      {source === 'geometry' && (
        <div className="td-form-row" style={{ marginTop: 10 }}>
          <label className="td-field" style={{ flex: 1, maxWidth: 320 }}>
            <span className="td-field-label">📏 Chiều sâu đất sụt trung bình (m)</span>
            <input
              type="number"
              step={0.1}
              className="td-input"
              value={section.depthSut ?? 1.0}
              onChange={(e) => onUpdate((s) => ({ ...s, depthSut: Number(e.target.value) || 0 }))}
            />
            <span className="muted small">Diện tích tự tính = (B + lề + ext) × chiều sâu</span>
          </label>
        </div>
      )}

      {source === 'polygon' && (
        <div className="td-form-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void handlePickFromAcad()}>
            📐 Mở lệnh AREA trong AutoCAD
          </button>
          <span className="muted small" style={{ flex: 1 }}>
            ① Sẽ tự gọi <code>_AREA O</code> trong AutoCAD → ② Trí click polyline đóng / region của vùng đất sụt → ③ Copy số area từ command line CAD → ④ Paste vào ô diện tích bên trên.
          </span>
        </div>
      )}

      {source === 'vision' && (
        <p className="muted small" style={{ marginTop: 8 }}>
          💡 Chuyển sang tab <strong>🤖 AI Vision đo ảnh</strong> → upload ảnh hiện trường → bấm <strong>AI đo</strong>. Diện tích sẽ tự fill vào đây khi AI đo xong.
        </p>
      )}

      {source === 'manual' && (
        <p className="muted small" style={{ marginTop: 8 }}>
          ✏ Nhập trực tiếp diện tích đo được vào ô bên trên (đơn vị: m²).
        </p>
      )}
    </div>
  );
}

function SectionsSummary({ project }: { project: BaoLuProject }): JSX.Element {
  if (project.sections.length === 0) return <></>;
  const totals = useMemo(() => {
    let vtn = 0, vvc = 0;
    for (const s of project.sections) {
      const m = MATERIALS.find((x) => x.id === s.materialId) ?? MATERIALS[0]!;
      const v = computeVolume(s, m.k);
      vtn += v.vTuNhien; vvc += v.vVanChuyen;
    }
    return { vtn, vvc };
  }, [project.sections]);

  // Phase 42 wave 8 — Schema mới: Loại mặt cắt + B đường + S đất sụt (bỏ L/B/H legacy)
  return (
    <section className="td-section">
      <h2 className="td-section-title">📊 Tổng hợp ({project.sections.length} mặt cắt)</h2>
      <div className="td-section-body">
        <div className="atgt-table-wrap" style={{ maxHeight: 320 }}>
          <table className="atgt-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>STT</th>
                <th style={{ width: 110 }}>Lý trình</th>
                <th>Loại mặt cắt</th>
                <th style={{ width: 90 }}>B đường (m)</th>
                <th style={{ width: 110 }}>S đất sụt (m²)</th>
                <th>Vật liệu</th>
                <th style={{ width: 130 }}>V tự nhiên</th>
                <th style={{ width: 130 }}>V vận chuyển</th>
              </tr>
            </thead>
            <tbody>
              {project.sections.map((s, i) => {
                const mat = MATERIALS.find((m) => m.id === s.materialId) ?? MATERIALS[0]!;
                const v = computeVolume(s, mat.k);
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.station}</td>
                    <td className="muted small">{CROSS_TYPE_LABEL[s.crossType] ?? '—'}</td>
                    <td>{s.matDuongWidth ?? 7}</td>
                    <td><b>{v.sMatCat.toFixed(2)}</b></td>
                    <td className="muted small">{mat.name}</td>
                    <td style={{ textAlign: 'right' }}><b>{v.vTuNhien.toFixed(2)}</b> m³</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-accent-primary)' }}><b>{v.vVanChuyen.toFixed(2)}</b> m³</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={6} style={{ textAlign: 'right' }}><b>TỔNG:</b></td>
                <td style={{ textAlign: 'right' }}><b>{totals.vtn.toFixed(2)} m³</b></td>
                <td style={{ textAlign: 'right', color: 'var(--color-accent-primary)' }}><b>{totals.vvc.toFixed(2)} m³</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DialogModal({ state, onClose }: { state: DialogState; onClose: () => void }): JSX.Element {
  const [input, setInput] = useState('');
  useEffect(() => { if (state?.kind === 'prompt') setInput(state.value); }, [state]);
  if (!state) return <></>;
  function submit(): void {
    if (state?.kind === 'prompt') { const v = input.trim(); if (!v) return; state.onSubmit(v); }
    else if (state?.kind === 'confirm') state.onConfirm();
    onClose();
  }
  return (
    <div className="atgt-dialog-backdrop" onClick={onClose}>
      <div className="atgt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="atgt-dialog-title">{state.title}</div>
        {state.kind === 'prompt' ? (
          <input type="text" className="td-input" autoFocus value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />
        ) : <p className="atgt-dialog-msg">{state.message}</p>}
        <div className="atgt-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="button" className={state.kind === 'confirm' && state.danger ? 'btn atgt-dialog-danger' : 'btn btn-primary'} onClick={submit}>
            {state.kind === 'prompt' ? '✓ Lưu' : state.danger ? '🗑 Xóa' : '✓ OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
