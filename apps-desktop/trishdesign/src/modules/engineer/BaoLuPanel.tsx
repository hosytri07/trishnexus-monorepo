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

interface BaoLuSection {
  id: string;
  name: string;
  station: string;       // Lý trình "Km0+520"
  L: number;             // Chiều dài (m)
  B: number;             // Bề rộng đáy (m)
  H: number;             // Chiều cao (m)
  alpha: number;         // Góc mái (độ)
  materialId: string;
  imageBase64?: string;  // Ảnh hiện trường (data URL)
  imageName?: string;
  note?: string;
  createdAt: number;
}

interface BaoLuProject {
  id: string;
  name: string;
  diaDiem?: string;
  ngayKhaoSat?: string;
  sections: BaoLuSection[];
  createdAt: number;
  updatedAt: number;
}

interface BaoLuDb {
  projects: BaoLuProject[];
  activeProjectId: string | null;
}

function emptyDb(): BaoLuDb { return { projects: [], activeProjectId: null }; }
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
function computeVolume(s: BaoLuSection, k: number): { vTuNhien: number; vVanChuyen: number; sMatCat: number } {
  // Diện tích mặt cắt = trapezoid: (B + B + 2*H/tan(α)) / 2 * H = (B + H/tan(α)) * H
  const alphaRad = (s.alpha * Math.PI) / 180;
  const tanA = Math.tan(alphaRad);
  const Btop = s.B + 2 * s.H / Math.max(tanA, 0.001);
  const sMatCat = (s.B + Btop) / 2 * s.H;
  const vTuNhien = sMatCat * s.L;
  const vVanChuyen = vTuNhien * k;
  return { vTuNhien, vVanChuyen, sMatCat };
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
      id: newId('sec'), name: `Mặt cắt ${activeProject.sections.length + 1}`,
      station: 'Km0+000', L: 20, B: 5, H: 2, alpha: 45, materialId: 'dat',
      createdAt: Date.now(),
    };
    updateActiveProject((p) => ({ ...p, sections: [...p.sections, sec] }));
    setActiveSectionId(sec.id);
  }
  function handleDeleteSection(): void {
    if (!activeSection) return;
    setDialog({
      kind: 'confirm', title: 'Xóa mặt cắt', danger: true,
      message: `Xóa "${activeSection.name}"?`,
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

    const systemPrompt = `Bạn là kỹ sư cầu đường VN. Phân tích ảnh hiện trường mặt cắt sạt lở / hốt sạt → ước tính kích thước.
Trả ra JSON object DUY NHẤT (không markdown):
{
  "station": "Km0+520",     // lý trình ước đoán nếu thấy biển hoặc null
  "B": 3.5,                  // bề rộng đáy (m), số thực
  "H": 2.0,                  // chiều cao mái (m)
  "alpha": 45,               // góc mái (độ)
  "L": 10,                   // chiều dài đoạn sạt (m)
  "materialId": "dat",       // 1 trong: dat, dat_set, da_dam, da_lon, cuoi_soi, hon_hop
  "note": "Ghi chú nhận xét bằng tiếng Việt — vd loại đất, mức độ sạt, ảnh hưởng giao thông"
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
            updateActiveSection((s) => ({
              ...s,
              station: typeof parsed.station === 'string' ? parsed.station : s.station,
              B: Number(parsed.B) > 0 ? Number(parsed.B) : s.B,
              H: Number(parsed.H) > 0 ? Number(parsed.H) : s.H,
              alpha: Number(parsed.alpha) > 0 ? Number(parsed.alpha) : s.alpha,
              L: Number(parsed.L) > 0 ? Number(parsed.L) : s.L,
              materialId: typeof parsed.materialId === 'string' && MATERIALS.some((mat) => mat.id === parsed.materialId) ? parsed.materialId : s.materialId,
              note: typeof parsed.note === 'string' ? parsed.note : s.note,
            }));
            flash(`✓ Gemini đã đo: B=${parsed.B}m H=${parsed.H}m α=${parsed.alpha}° L=${parsed.L}m`);
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
          updateActiveSection((s) => ({
            ...s,
            station: typeof parsed.station === 'string' ? parsed.station : s.station,
            B: Number(parsed.B) > 0 ? Number(parsed.B) : s.B,
            H: Number(parsed.H) > 0 ? Number(parsed.H) : s.H,
            alpha: Number(parsed.alpha) > 0 ? Number(parsed.alpha) : s.alpha,
            L: Number(parsed.L) > 0 ? Number(parsed.L) : s.L,
            materialId: typeof parsed.materialId === 'string' && MATERIALS.some((mat) => mat.id === parsed.materialId) ? parsed.materialId : s.materialId,
            note: typeof parsed.note === 'string' ? parsed.note : s.note,
          }));
          flash(`✓ Groq đã đo: B=${parsed.B}m H=${parsed.H}m`);
          return;
        }
      }
      flash('✗ AI không trả JSON hợp lệ.');
    } catch (e) {
      flash(`✗ AI Vision: ${String(e).slice(0, 100)}`);
    }
  }

  async function handleDrawAcad(): Promise<void> {
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
      const cmds: string[] = [];
      cmds.push('._FILEDIA\n0\n');
      cmds.push('._-STYLE\nBL_TEXT\narial.ttf\n0\n0.7\n0\nN\nN\n');
      cmds.push('._-LAYER\nM\nBAOLU_DAT\nC\n8\nBAOLU_DAT\n\n');
      cmds.push('._-LAYER\nM\nBAOLU_TEXT\nC\n7\nBAOLU_TEXT\n\n');

      let yOff = 0;
      for (const sec of activeProject.sections) {
        const mat = MATERIALS.find((m) => m.id === sec.materialId) ?? MATERIALS[0]!;
        const v = computeVolume(sec, mat.k);
        // Vẽ mặt cắt: trapezoid (B đáy → B + 2*H/tan(α) đỉnh)
        const Btop = sec.B + 2 * sec.H / Math.max(Math.tan((sec.alpha * Math.PI) / 180), 0.001);
        const halfBot = sec.B / 2; const halfTop = Btop / 2;
        // 4 corners
        const x0 = -halfBot, x1 = halfBot, x2 = halfTop, x3 = -halfTop;
        const y0 = 0, y1 = sec.H;
        cmds.push('._-LAYER\nS\nBAOLU_DAT\n\n');
        // Polyline 4 đỉnh + close
        cmds.push(`._PLINE ${x0.toFixed(2)},${(y0 + yOff).toFixed(2)} ${x1.toFixed(2)},${(y0 + yOff).toFixed(2)} ${x2.toFixed(2)},${(y1 + yOff).toFixed(2)} ${x3.toFixed(2)},${(y1 + yOff).toFixed(2)} C\n`);
        // Text label trên đỉnh
        cmds.push('._-LAYER\nS\nBAOLU_TEXT\n\n');
        cmds.push(`._-TEXT\nJ\nMC\n0,${(y1 + 1.2 + yOff).toFixed(2)}\n0.5\n0\n${sec.name} (${sec.station}) — V=${v.vTuNhien.toFixed(1)}m³\n`);
        // Dim text dưới đáy
        cmds.push(`._-TEXT\nJ\nMC\n0,${(y0 - 0.5 + yOff).toFixed(2)}\n0.4\n0\nB=${sec.B}m · H=${sec.H}m · α=${sec.alpha}° · L=${sec.L}m\n`);
        yOff += sec.H + 5;
      }
      cmds.push('._ZOOM\nE\n');
      cmds.push('._FILEDIA\n1\n');
      const sent = await autoCadSendCommands(cmds);
      flash(`✓ Đã gửi ${sent} lệnh vẽ ${activeProject.sections.length} mặt cắt vào AutoCAD`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  async function handleExportExcel(): Promise<void> {
    if (!activeProject || activeProject.sections.length === 0) {
      flash('Không có dữ liệu để xuất'); return;
    }
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      [`BÁO CÁO KHỐI LƯỢNG SỤT LỞ: ${activeProject.name}`],
      [`Địa điểm: ${activeProject.diaDiem ?? ''}`],
      [`Ngày khảo sát: ${activeProject.ngayKhaoSat ?? ''}`],
      [],
      ['STT', 'Tên mặt cắt', 'Lý trình', 'L (m)', 'B (m)', 'H (m)', 'α (°)', 'Vật liệu', 'k', 'S mặt cắt (m²)', 'V tự nhiên (m³)', 'V vận chuyển (m³)', 'Ghi chú'],
    ];
    let totalVTN = 0, totalVVC = 0;
    activeProject.sections.forEach((sec, i) => {
      const mat = MATERIALS.find((m) => m.id === sec.materialId) ?? MATERIALS[0]!;
      const v = computeVolume(sec, mat.k);
      totalVTN += v.vTuNhien; totalVVC += v.vVanChuyen;
      rows.push([
        i + 1, sec.name, sec.station,
        sec.L, sec.B, sec.H, sec.alpha,
        mat.name, mat.k,
        Number(v.sMatCat.toFixed(2)),
        Number(v.vTuNhien.toFixed(2)),
        Number(v.vVanChuyen.toFixed(2)),
        sec.note ?? '',
      ]);
    });
    rows.push([]);
    rows.push(['', '', 'TỔNG', '', '', '', '', '', '', '', Number(totalVTN.toFixed(2)), Number(totalVVC.toFixed(2)), '']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 22 }, { wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
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
            {activeProject.sections.map((s) => <option key={s.id} value={s.id}>📐 {s.name} ({s.station})</option>)}
          </select>
          <button type="button" className="btn btn-ghost" onClick={handleNewSection}>➕</button>
          {activeSection && <button type="button" className="btn btn-ghost" onClick={handleDeleteSection}>🗑</button>}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={() => void handleDrawAcad()}
            disabled={!acadRunning || activeProject.sections.length === 0}>📐 Vẽ AutoCAD</button>
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

  return (
    <section className="td-section">
      <h2 className="td-section-title">📐 Mặt cắt: {section.name}</h2>
      <div className="td-section-body">
        <div className="td-form-row">
          <label className="td-field"><span className="td-field-label">Tên</span>
            <input className="td-input" value={section.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className="td-field"><span className="td-field-label">Lý trình</span>
            <input className="td-input" value={section.station} onChange={(e) => set('station', e.target.value)} /></label>
          <label className="td-field"><span className="td-field-label">Vật liệu</span>
            <select className="td-select" value={section.materialId} onChange={(e) => set('materialId', e.target.value)}>
              {MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name} (k={m.k})</option>)}
            </select></label>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <label className="td-field"><span className="td-field-label">L — chiều dài (m)</span>
            <input type="number" step={0.5} className="td-input" value={section.L} onChange={(e) => set('L', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">B — bề rộng đáy (m)</span>
            <input type="number" step={0.5} className="td-input" value={section.B} onChange={(e) => set('B', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">H — chiều cao (m)</span>
            <input type="number" step={0.1} className="td-input" value={section.H} onChange={(e) => set('H', Number(e.target.value) || 0)} /></label>
          <label className="td-field"><span className="td-field-label">α — góc mái (°)</span>
            <input type="number" step={1} className="td-input" value={section.alpha} onChange={(e) => set('alpha', Number(e.target.value) || 0)} /></label>
        </div>
        <div className="td-form-row" style={{ marginTop: 12 }}>
          <label className="td-field" style={{ flex: 2 }}><span className="td-field-label">Ghi chú</span>
            <input className="td-input" value={section.note ?? ''} onChange={(e) => set('note', e.target.value)} /></label>
        </div>

        {/* Image + result */}
        <div className="bl-grid" style={{ marginTop: 16 }}>
          <div>
            <div className="dos-action-bar" style={{ paddingBottom: 0, borderBottom: 'none' }}>
              <button type="button" className="btn btn-primary" onClick={() => void pickImage()}>📷 Tải ảnh hiện trường</button>
              <button type="button" className="btn btn-ghost" onClick={aiMeasure} disabled={!section.imageBase64}>🤖 AI đo kích thước</button>
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
      </div>
    </section>
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

  return (
    <section className="td-section">
      <h2 className="td-section-title">📊 Tổng hợp ({project.sections.length} mặt cắt)</h2>
      <div className="td-section-body">
        <div className="atgt-table-wrap" style={{ maxHeight: 320 }}>
          <table className="atgt-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>STT</th>
                <th>Tên</th>
                <th style={{ width: 110 }}>Lý trình</th>
                <th style={{ width: 70 }}>L (m)</th>
                <th style={{ width: 70 }}>B (m)</th>
                <th style={{ width: 70 }}>H (m)</th>
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
                    <td>{s.name}</td>
                    <td>{s.station}</td>
                    <td>{s.L}</td>
                    <td>{s.B}</td>
                    <td>{s.H}</td>
                    <td className="muted small">{mat.name}</td>
                    <td style={{ textAlign: 'right' }}><b>{v.vTuNhien.toFixed(2)}</b> m³</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-accent-primary)' }}><b>{v.vVanChuyen.toFixed(2)}</b> m³</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={7} style={{ textAlign: 'right' }}><b>TỔNG:</b></td>
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
