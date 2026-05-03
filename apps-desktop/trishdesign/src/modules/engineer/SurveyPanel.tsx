/**
 * TrishDesign Phase 28.5 — Khảo sát (OCR).
 *
 * Workflow:
 *   1. Upload ảnh sổ hiện trạng (chụp / scan, có thể chữ tay)
 *   2. Tesseract.js OCR (lang vi) → text
 *   3. User chỉnh sửa text (textarea)
 *   4. AI prompt (placeholder Phase sau)
 *   5. Parse text → bảng (mỗi dòng = 1 record)
 *   6. Export bảng → Excel với SheetJS
 *
 * Tesseract.js loaded từ unpkg CDN (~3.5 MB lần đầu, sau cache).
 */

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import {
  type MultiSheetParse,
  type SheetType,
  SHEET_TYPES,
  SHEET_LABEL,
  SHEET_ICON,
  MULTI_SHEET_SYSTEM_PROMPT,
  STEP1_TRANSCRIBE_PROMPT,
  STEP2_CLASSIFY_PROMPT,
  parseMultiSheetJson,
  emptyMultiSheet,
  totalRows,
} from '../../lib/ocr-sheets.js';

declare global {
  interface Window {
    Tesseract?: any;
  }
}

const TESSERACT_JS = 'https://unpkg.com/tesseract.js@5/dist/tesseract.min.js';
const LS_KEY = 'trishdesign:survey-ocr';

let tessLoadingPromise: Promise<void> | null = null;
function loadTesseract(): Promise<void> {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve();
  if (tessLoadingPromise) return tessLoadingPromise;
  tessLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_JS;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Tesseract.js'));
    document.head.appendChild(script);
  });
  return tessLoadingPromise;
}

interface OcrSession {
  imageBase64: string | null;
  imageName: string;
  ocrText: string;
  parsedRows: string[][];
  parsedHeader: string[];
  aiPrompt: string;
  aiResult: string;
  /** Phase 28.10 — multi-sheet AI Vision result */
  multiSheet: MultiSheetParse;
}

function defaultSession(): OcrSession {
  return {
    imageBase64: null, imageName: '',
    ocrText: '', parsedRows: [], parsedHeader: [],
    aiPrompt: 'Hãy chuẩn hóa text OCR thành bảng có các cột: STT, Lý trình, Loại HH, Dài, Rộng, Mã HH. Phân tách bằng tab.',
    aiResult: '',
    multiSheet: emptyMultiSheet(),
  };
}

function loadSession(): OcrSession {
  if (typeof window === 'undefined') return defaultSession();
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? { ...defaultSession(), ...JSON.parse(raw) } : defaultSession();
  } catch { return defaultSession(); }
}
function saveSession(s: OcrSession): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore — image base64 có thể quá lớn */ }
}

export function SurveyPanel(): JSX.Element {
  const [s, setSession] = useState<OcrSession>(() => {
    const loaded = loadSession();
    // Backward compat — loadSession có thể không có multiSheet (session cũ)
    if (!loaded.multiSheet) loaded.multiSheet = emptyMultiSheet();
    return loaded;
  });
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [aiVisionRunning, setAiVisionRunning] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetType>('mat_duong');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Tránh persist image base64 to lớn → only save text + parsed
    saveSession({ ...s, imageBase64: null });
  }, [s.ocrText, s.parsedRows, s.parsedHeader, s.aiPrompt, s.aiResult, s.multiSheet]);

  function update<K extends keyof OcrSession>(k: K, v: OcrSession[K]): void {
    setSession((prev) => ({ ...prev, [k]: v }));
  }
  function flash(m: string): void { setStatusMsg(m); setTimeout(() => setStatusMsg(''), 2500); }

  async function handlePickFile(): Promise<void> {
    try {
      const path = await open({
        title: 'Chọn ảnh sổ khảo sát',
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
      });
      if (typeof path !== 'string') return;
      const url = convertFileSrc(path);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      const name = path.split(/[\\/]/).pop() ?? 'ảnh';
      setSession((prev) => ({ ...prev, imageBase64: base64, imageName: name }));
      flash(`✓ Đã tải ${name}`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  async function handleRunOcr(): Promise<void> {
    if (!s.imageBase64) {
      flash('Chưa chọn ảnh.');
      return;
    }
    setOcrRunning(true);
    setOcrProgress(0);
    update('ocrText', '');
    try {
      await loadTesseract();
      const Tesseract = window.Tesseract!;
      const result = await Tesseract.recognize(s.imageBase64, 'vie', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
        },
      });
      update('ocrText', result.data.text ?? '');
      flash('✓ OCR hoàn tất');
    } catch (e) { flash(`✗ ${String(e)}`); }
    finally {
      setOcrRunning(false);
      setOcrProgress(0);
    }
  }

  function handleParseToTable(): void {
    const lines = s.ocrText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { flash('Không có text để parse'); return; }
    // Detect separator: tab > pipe > 2+ spaces > comma
    const sample = lines[0]!;
    const sep = sample.includes('\t') ? /\t+/
      : sample.includes('|') ? /\s*\|\s*/
      : sample.split(/\s{2,}/).length >= 2 ? /\s{2,}/
      : sample.includes(',') ? /\s*,\s*/
      : /\s+/;
    const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
    // First row có thể là header
    const header = rows[0]!;
    const data = rows.slice(1);
    update('parsedHeader', header);
    update('parsedRows', data);
    flash(`✓ Đã parse ${data.length} dòng × ${header.length} cột`);
  }

  function handleAiPrompt(): void {
    flash('⚠ AI rewrite text đang phát triển. Hiện tại bạn copy prompt + paste vào ChatGPT/Claude.ai/Groq bên ngoài.');
  }

  /** Phase 28.7d + 28.9: AI Vision parse ảnh → table. Thứ tự: Groq → Gemini. */
  async function handleGroqVisionParse(): Promise<void> {
    if (!s.imageBase64) { flash('Chưa có ảnh để parse.'); return; }
    const groqKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:groq-api-key') ?? '' : '').trim();
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:gemini-api-key') ?? '' : '').trim();
    if (!groqKey && !geminiKey) {
      flash('✗ Chưa có API key Groq hoặc Gemini. Vào ⚙ Cài đặt → 🔐 API Keys (admin) hoặc TrishAdmin → 🔐 API Keys.');
      return;
    }

    const systemPrompt = `Bạn là AI chuyên parse ảnh khảo sát hư hỏng mặt đường VN.
Phân tích ảnh chứa bảng/text khảo sát → trả ra JSON object DUY NHẤT (không markdown, không giải thích).
Format: { "header": ["STT", "Lý trình", "Loại HH", "Dài (m)", "Rộng (m)", "Mã HH"], "rows": [["1", "Km0+020", "Nứt rạn mai rùa", "10", "3", "2"], ["2", "Km0+066", "Bong tróc", "5", "3", "4"]] }
Header phải đúng tên cột tiếng Việt cầu đường (STT, Lý trình, Vị trí, Loại HH, Dài, Rộng, Diện tích, Mã HH, Ghi chú).
Rows là array of array of string (giữ nguyên text gốc).`;

    function applyParsed(reply: string, source: string): boolean {
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        flash(`✗ ${source} không trả JSON hợp lệ. Raw: ${reply.slice(0, 100)}`);
        return false;
      }
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed.header) || !Array.isArray(parsed.rows)) {
          flash(`✗ ${source} trả format sai (thiếu header/rows)`);
          return false;
        }
        update('parsedHeader', parsed.header);
        update('parsedRows', parsed.rows);
        flash(`✓ ${source} parse ${parsed.rows.length} dòng × ${parsed.header.length} cột — check & xuất Excel.`);
        return true;
      } catch (e) {
        flash(`✗ ${source} JSON parse lỗi: ${String(e).slice(0, 100)}`);
        return false;
      }
    }

    // 1. Try Groq Vision (Llama 3.2 90B)
    if (groqKey) {
      try {
        flash('⏳ Groq Vision (Llama 3.2 90B)...');
        const reply = await invoke<string>('groq_chat', {
          req: {
            apiKey: groqKey,
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Hãy parse ảnh này thành JSON theo format đã quy định. Trả ra JSON only.' },
                  { type: 'image_url', image_url: { url: s.imageBase64 } },
                ],
              },
            ],
            maxTokens: 2048,
          },
        });
        if (applyParsed(reply, 'Groq Vision')) return;
      } catch (e) {
        flash(`✗ Groq Vision: ${String(e).slice(0, 80)} — fallback Gemini`);
      }
    }

    // 2. Try Gemini Vision (gemini-2.0-flash hỗ trợ vision)
    if (geminiKey) {
      try {
        flash('⏳ Gemini Vision (2.0 Flash)...');
        // Strip data URI prefix nếu có
        const m = s.imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
        const mime = m ? m[1] : 'image/png';
        const data = m ? m[2] : s.imageBase64;
        const reply = await invoke<string>('gemini_vision', {
          req: {
            apiKey: geminiKey,
            model: 'gemini-2.0-flash',
            prompt: `${systemPrompt}\n\nHãy parse ảnh này thành JSON theo format đã quy định. Trả ra JSON only.`,
            imageBase64: data,
            mimeType: mime,
            maxTokens: 2048,
          },
        });
        if (applyParsed(reply, 'Gemini Vision')) return;
      } catch (e) {
        flash(`✗ Gemini Vision: ${String(e).slice(0, 100)}`);
      }
    }
  }

  /**
   * Phase 28.10 — AI Vision đọc + tự phân loại sheet.
   * Ưu tiên Gemini (handwriting tiếng Việt tốt hơn) → fallback Groq Vision.
   */
  async function handleAiMultiSheetVision(): Promise<void> {
    if (!s.imageBase64) { flash('Chưa có ảnh để parse.'); return; }
    const groqKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:groq-api-key') ?? '' : '').trim();
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:gemini-api-key') ?? '' : '').trim();
    if (!groqKey && !geminiKey) {
      flash('✗ Chưa có Gemini hoặc Groq key. Vào TrishAdmin → 🔐 API Keys hoặc ⚙ Cài đặt.');
      return;
    }

    setAiVisionRunning(true);
    try {
      // 1. Try Gemini first (better with Vietnamese handwriting)
      if (geminiKey) {
        try {
          flash('⏳ Gemini Vision đang đọc ảnh + phân loại 8 sheet...');
          const m = s.imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
          const mime = m ? m[1] : 'image/png';
          const data = m ? m[2] : s.imageBase64;
          const reply = await invoke<string>('gemini_vision', {
            req: {
              apiKey: geminiKey,
              model: 'gemini-2.0-flash',
              prompt: `${MULTI_SHEET_SYSTEM_PROMPT}\n\nĐọc ảnh và trả ra JSON object 8 keys theo format đã quy định. JSON only.`,
              imageBase64: data,
              mimeType: mime,
              maxTokens: 4096,
            },
          });
          const parsed = parseMultiSheetJson(reply);
          if (parsed) {
            update('multiSheet', parsed);
            const total = totalRows(parsed);
            const firstNonEmpty = SHEET_TYPES.find((k) => parsed[k].rows.length > 0);
            if (firstNonEmpty) setActiveSheet(firstNonEmpty);
            flash(`✓ Gemini đã đọc ${total} dòng vào ${SHEET_TYPES.filter((k) => parsed[k].rows.length > 0).length} sheet.`);
            return;
          }
          flash('⚠ Gemini trả không đúng JSON — thử Groq...');
        } catch (e) {
          flash(`✗ Gemini: ${String(e).slice(0, 80)} — thử Groq`);
        }
      }

      // 2. Fallback Groq Vision (Llama 3.2 90B)
      if (groqKey) {
        try {
          flash('⏳ Groq Vision (Llama 3.2 90B)...');
          const reply = await invoke<string>('groq_chat', {
            req: {
              apiKey: groqKey,
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              messages: [
                { role: 'system', content: MULTI_SHEET_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Đọc ảnh + phân loại 8 sheet theo format đã quy định. JSON only.' },
                    { type: 'image_url', image_url: { url: s.imageBase64 } },
                  ],
                },
              ],
              maxTokens: 4096,
            },
          });
          const parsed = parseMultiSheetJson(reply);
          if (parsed) {
            update('multiSheet', parsed);
            const total = totalRows(parsed);
            const firstNonEmpty = SHEET_TYPES.find((k) => parsed[k].rows.length > 0);
            if (firstNonEmpty) setActiveSheet(firstNonEmpty);
            flash(`✓ Groq đã đọc ${total} dòng vào ${SHEET_TYPES.filter((k) => parsed[k].rows.length > 0).length} sheet.`);
            return;
          }
          flash('✗ Groq cũng không trả ra JSON hợp lệ.');
        } catch (e) {
          flash(`✗ Groq Vision: ${String(e).slice(0, 100)}`);
        }
      }
    } finally {
      setAiVisionRunning(false);
    }
  }

  /**
   * Phase 28.11 — Bước 1: AI Vision đọc ảnh → text tiếng Việt thô (không phân loại).
   * Lưu vào s.ocrText.
   */
  async function handleAiTranscribe(): Promise<void> {
    if (!s.imageBase64) { flash('Chưa có ảnh.'); return; }
    const groqKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:groq-api-key') ?? '' : '').trim();
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:gemini-api-key') ?? '' : '').trim();
    if (!groqKey && !geminiKey) {
      flash('✗ Chưa có Gemini hoặc Groq key.');
      return;
    }
    setAiVisionRunning(true);
    try {
      // Ưu tiên Gemini cho handwriting tiếng Việt
      if (geminiKey) {
        try {
          flash('⏳ Bước 1: Gemini đang đọc chữ viết tay...');
          const m = s.imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
          const mime = m ? m[1] : 'image/png';
          const data = m ? m[2] : s.imageBase64;
          const reply = await invoke<string>('gemini_vision', {
            req: {
              apiKey: geminiKey,
              model: 'gemini-2.0-flash',
              prompt: STEP1_TRANSCRIBE_PROMPT,
              imageBase64: data,
              mimeType: mime,
              maxTokens: 4096,
            },
          });
          // Strip code block fences nếu có
          const cleaned = reply.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
          update('ocrText', cleaned);
          flash(`✓ Gemini đã đọc ${cleaned.split('\n').length} dòng. Sửa lỗi rồi bấm Bước 2 để phân loại.`);
          return;
        } catch (e) {
          flash(`⚠ Gemini: ${String(e).slice(0, 80)} — thử Groq`);
        }
      }
      if (groqKey) {
        flash('⏳ Bước 1: Groq Vision đang đọc...');
        const reply = await invoke<string>('groq_chat', {
          req: {
            apiKey: groqKey,
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: [
              { role: 'system', content: STEP1_TRANSCRIBE_PROMPT },
              { role: 'user', content: [
                { type: 'text', text: 'Transcribe ảnh này thành text VN thô.' },
                { type: 'image_url', image_url: { url: s.imageBase64 } },
              ] },
            ],
            maxTokens: 4096,
          },
        });
        const cleaned = reply.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '').trim();
        update('ocrText', cleaned);
        flash(`✓ Groq đã đọc ${cleaned.split('\n').length} dòng.`);
      }
    } catch (e) {
      flash(`✗ AI Transcribe: ${String(e).slice(0, 100)}`);
    } finally {
      setAiVisionRunning(false);
    }
  }

  /**
   * Bước 2: text VN → AI text-only phân loại 8 sheet với prompt RIÊNG cho từng sheet.
   * Input lấy từ s.ocrText (user có thể đã sửa lỗi sau bước 1).
   */
  async function handleAiClassify(): Promise<void> {
    const text = s.ocrText.trim();
    if (!text) { flash('Chưa có text — bấm Bước 1 hoặc paste text VN trước.'); return; }
    const groqKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:groq-api-key') ?? '' : '').trim();
    const geminiKey = (typeof window !== 'undefined' ? localStorage.getItem('trishdesign:gemini-api-key') ?? '' : '').trim();
    if (!groqKey && !geminiKey) { flash('✗ Chưa có API key.'); return; }
    setAiVisionRunning(true);
    try {
      // Groq text-only model nhanh hơn cho task này
      if (groqKey) {
        try {
          flash('⏳ Bước 2: Groq đang phân loại 8 sheet...');
          const reply = await invoke<string>('groq_chat', {
            req: {
              apiKey: groqKey,
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: STEP2_CLASSIFY_PROMPT },
                { role: 'user', content: `Text khảo sát:\n\n${text}\n\nPhân loại + trả JSON 8 sheet.` },
              ],
              maxTokens: 4096,
            },
          });
          const parsed = parseMultiSheetJson(reply);
          if (parsed) {
            update('multiSheet', parsed);
            const total = totalRows(parsed);
            const firstNonEmpty = SHEET_TYPES.find((k) => parsed[k].rows.length > 0);
            if (firstNonEmpty) setActiveSheet(firstNonEmpty);
            flash(`✓ Groq phân loại ${total} dòng vào ${SHEET_TYPES.filter((k) => parsed[k].rows.length > 0).length} sheet.`);
            return;
          }
          flash('⚠ Groq không trả JSON đúng — thử Gemini');
        } catch (e) {
          flash(`⚠ Groq: ${String(e).slice(0, 80)} — thử Gemini`);
        }
      }
      if (geminiKey) {
        flash('⏳ Bước 2: Gemini đang phân loại...');
        const reply = await invoke<string>('gemini_chat', {
          req: {
            apiKey: geminiKey,
            model: 'gemini-2.0-flash',
            system: STEP2_CLASSIFY_PROMPT,
            messages: [{ role: 'user', content: `Text khảo sát:\n\n${text}\n\nPhân loại + trả JSON 8 sheet.` }],
            maxTokens: 4096,
          },
        });
        const parsed = parseMultiSheetJson(reply);
        if (parsed) {
          update('multiSheet', parsed);
          const total = totalRows(parsed);
          const firstNonEmpty = SHEET_TYPES.find((k) => parsed[k].rows.length > 0);
          if (firstNonEmpty) setActiveSheet(firstNonEmpty);
          flash(`✓ Gemini phân loại ${total} dòng.`);
          return;
        }
        flash('✗ Gemini cũng không trả JSON hợp lệ.');
      }
    } catch (e) {
      flash(`✗ AI Classify: ${String(e).slice(0, 100)}`);
    } finally {
      setAiVisionRunning(false);
    }
  }

  async function handleExportMultiSheetExcel(): Promise<void> {
    const total = totalRows(s.multiSheet);
    if (total === 0) {
      flash('Chưa có dữ liệu multi-sheet để xuất. Bấm "🚀 AI Vision" trước.');
      return;
    }
    const wb = XLSX.utils.book_new();
    // Sheet "Tổng hợp" — gộp tất cả với thêm cột "Loại"
    const summaryAoA: string[][] = [['Loại sheet', 'STT trong sheet', ...['Lý trình', 'Mô tả', 'Ghi chú']]];
    for (const k of SHEET_TYPES) {
      const data = s.multiSheet[k];
      if (data.rows.length === 0) continue;
      const aoa = [data.header, ...data.rows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Tên sheet tối đa 31 ký tự (Excel limit)
      const sheetName = SHEET_LABEL[k].slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      // Dòng vào tổng hợp
      data.rows.forEach((r, idx) => {
        summaryAoA.push([
          SHEET_LABEL[k],
          String(idx + 1),
          r[1] ?? '', // Lý trình thường ở cột 2
          r.slice(2).join(' · '),
          r[r.length - 1] ?? '',
        ]);
      });
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoA);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng hợp');

    const dateStr = new Date().toISOString().slice(0, 10);
    const path = await save({
      title: 'Lưu khảo sát multi-sheet',
      defaultPath: `KhaoSat_MultiSheet_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash(`✓ Đã xuất Excel ${SHEET_TYPES.filter((k) => s.multiSheet[k].rows.length > 0).length + 1} sheet (${total} dòng + tổng hợp)`);
  }

  // Helpers cho multi-sheet table editing
  function msUpdateCell(sheet: SheetType, rIdx: number, cIdx: number, val: string): void {
    setSession((prev) => {
      const sheetData = prev.multiSheet[sheet];
      const newRows = sheetData.rows.map((r, i) =>
        i === rIdx ? r.map((c, j) => (j === cIdx ? val : c)) : r,
      );
      return { ...prev, multiSheet: { ...prev.multiSheet, [sheet]: { ...sheetData, rows: newRows } } };
    });
  }
  function msUpdateHeader(sheet: SheetType, cIdx: number, val: string): void {
    setSession((prev) => {
      const sheetData = prev.multiSheet[sheet];
      return { ...prev, multiSheet: { ...prev.multiSheet, [sheet]: { ...sheetData, header: sheetData.header.map((h, i) => i === cIdx ? val : h) } } };
    });
  }
  function msDeleteRow(sheet: SheetType, rIdx: number): void {
    setSession((prev) => {
      const sheetData = prev.multiSheet[sheet];
      return { ...prev, multiSheet: { ...prev.multiSheet, [sheet]: { ...sheetData, rows: sheetData.rows.filter((_, i) => i !== rIdx) } } };
    });
  }
  function msAddRow(sheet: SheetType): void {
    setSession((prev) => {
      const sheetData = prev.multiSheet[sheet];
      const empty = new Array(sheetData.header.length).fill('');
      return { ...prev, multiSheet: { ...prev.multiSheet, [sheet]: { ...sheetData, rows: [...sheetData.rows, empty] } } };
    });
  }
  function msClearSheet(sheet: SheetType): void {
    setSession((prev) => ({ ...prev, multiSheet: { ...prev.multiSheet, [sheet]: { ...prev.multiSheet[sheet], rows: [] } } }));
  }

  async function handleExportExcel(): Promise<void> {
    if (s.parsedRows.length === 0 && s.parsedHeader.length === 0) {
      flash('Chưa có bảng để xuất');
      return;
    }
    const wb = XLSX.utils.book_new();
    const aoa = [s.parsedHeader, ...s.parsedRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'OCR');
    // Sheet 2: text gốc
    const ws2 = XLSX.utils.aoa_to_sheet([['Text gốc OCR'], [s.ocrText]]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Text gốc');
    const dateStr = new Date().toISOString().slice(0, 10);
    const path = await save({
      title: 'Lưu bảng thống kê', defaultPath: `KhaoSat_OCR_${dateStr}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (!path) return;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const bytes = Array.from(new Uint8Array(buf));
    await invoke<number>('save_file_bytes', { path, bytes });
    flash('✓ Đã xuất Excel');
  }

  function handleClearImage(): void {
    setSession((prev) => ({ ...prev, imageBase64: null, imageName: '' }));
  }
  function handleClearAll(): void {
    setSession(defaultSession());
  }

  function updateRow(rIdx: number, cIdx: number, val: string): void {
    setSession((prev) => {
      const newRows = prev.parsedRows.map((r, i) =>
        i === rIdx ? r.map((c, j) => (j === cIdx ? val : c)) : r,
      );
      return { ...prev, parsedRows: newRows };
    });
  }
  function updateHeader(cIdx: number, val: string): void {
    setSession((prev) => ({ ...prev, parsedHeader: prev.parsedHeader.map((h, i) => (i === cIdx ? val : h)) }));
  }
  function deleteRow(rIdx: number): void {
    setSession((prev) => ({ ...prev, parsedRows: prev.parsedRows.filter((_, i) => i !== rIdx) }));
  }
  function addRow(): void {
    const empty = new Array(s.parsedHeader.length).fill('');
    setSession((prev) => ({ ...prev, parsedRows: [...prev.parsedRows, empty] }));
  }
  function addColumn(): void {
    setSession((prev) => ({
      ...prev,
      parsedHeader: [...prev.parsedHeader, `Cột ${prev.parsedHeader.length + 1}`],
      parsedRows: prev.parsedRows.map((r) => [...r, '']),
    }));
  }

  // Phase 28.10 — multi-sheet active data
  const activeData = s.multiSheet[activeSheet];
  const totalMs = totalRows(s.multiSheet);

  // Style chung gọn cho card
  const sectionStyle: CSSProperties = { marginBottom: 12 };
  const sectionBodyStyle: CSSProperties = { padding: '10px 14px' };

  return (
    <div className="td-panel">
      <header className="td-panel-head" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 4 }}>🔍 Khảo sát (OCR + AI Vision)</h1>
        <p className="td-lead" style={{ fontSize: 12, marginBottom: 0 }}>
          Upload ảnh sổ khảo sát → AI Vision tự đọc & phân loại 8 sheet → sửa → xuất Excel multi-sheet.
        </p>
        {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
      </header>

      {/* Compact image upload + AI Vision actions trong 1 card */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>① Ảnh nguồn + 🚀 AI Vision (workflow 2 bước)</h2>
        <div className="td-section-body" style={sectionBodyStyle}>
          <div className="dos-action-bar" style={{ flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="btn btn-primary" onClick={() => void handlePickFile()}>📷 Chọn ảnh / PDF</button>
            {s.imageBase64 && <button type="button" className="btn btn-ghost" onClick={handleClearImage}>🗑 Xoá ảnh</button>}
            <button type="button" className="btn btn-ghost" onClick={handleClearAll}>🔄 Reset</button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleExportMultiSheetExcel()}
              disabled={totalMs === 0}
              title="Xuất file Excel với 8 sheet riêng + sheet Tổng hợp"
            >
              📤 Xuất Excel multi-sheet
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden />
          </div>

          {s.imageBase64 ? (
            <>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <img src={s.imageBase64} alt={s.imageName} style={{ maxHeight: 200, maxWidth: '40%', borderRadius: 6, border: '1px solid var(--color-border-soft, #2a2a2a)' }} />
                <div style={{ flex: 1, fontSize: 11 }} className="muted">
                  <div><strong>File:</strong> {s.imageName}</div>
                  <div style={{ marginTop: 4 }}>
                    Workflow: <strong>Bước 1</strong> AI Vision đọc ảnh → text VN thô (sửa được) → <strong>Bước 2</strong> AI phân loại 8 sheet với prompt riêng từng loại.
                  </div>
                </div>
              </div>

              {/* Step 1 + Step 2 */}
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleAiTranscribe()}
                  disabled={aiVisionRunning}
                  style={{ flex: '1 1 240px' }}
                >
                  {aiVisionRunning ? '⏳ Đang đọc...' : '🔍 Bước 1: AI Vision đọc → text VN thô'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleAiClassify()}
                  disabled={aiVisionRunning || !s.ocrText.trim()}
                  style={{ flex: '1 1 240px' }}
                >
                  {aiVisionRunning ? '⏳ Đang phân loại...' : '🚀 Bước 2: AI phân loại → 8 sheet'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void handleAiMultiSheetVision()}
                  disabled={aiVisionRunning}
                  title="Chỉ 1 bước: AI Vision đọc + phân loại trực tiếp (nhanh nhưng kém chính xác hơn)"
                >
                  ⚡ 1-bước (nhanh)
                </button>
              </div>

              {/* Text VN thô — editable sau bước 1 */}
              <details open={!!s.ocrText} style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 0' }}>
                  📄 Text tiếng Việt thô (Bước 1) — {s.ocrText ? `${s.ocrText.split('\n').length} dòng` : 'chưa có'} — sửa lỗi rồi bấm Bước 2
                </summary>
                <textarea
                  className="lisp-editor"
                  value={s.ocrText}
                  onChange={(e) => update('ocrText', e.target.value)}
                  placeholder="Sau khi bấm Bước 1, text sẽ hiện ở đây. Bạn sửa lỗi nhận diện trước khi bấm Bước 2."
                  style={{ minHeight: 140, marginTop: 6, fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace', fontSize: 12 }}
                  spellCheck={false}
                />
              </details>
            </>
          ) : (
            <p className="muted small" style={{ padding: '12px 0', textAlign: 'center', margin: 0 }}>
              Chưa có ảnh. Bấm "📷 Chọn ảnh / PDF" để upload sổ khảo sát.
            </p>
          )}
        </div>
      </section>

      {/* Multi-sheet tabs */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>
          ② Bảng thống kê multi-sheet — Tổng {totalMs} dòng / 8 sheet
        </h2>
        <div className="td-section-body" style={{ padding: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border-soft, #2a2a2a)' }}>
            {SHEET_TYPES.map((k) => {
              const cnt = s.multiSheet[k].rows.length;
              const isActive = k === activeSheet;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveSheet(k)}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                    color: isActive ? 'var(--color-accent-primary)' : 'var(--color-fg, #ddd)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                  }}
                >
                  {SHEET_ICON[k]} {SHEET_LABEL[k]}{' '}
                  {cnt > 0 && (
                    <span style={{ marginLeft: 4, padding: '1px 6px', background: 'var(--color-accent-primary)', color: 'white', borderRadius: 8, fontSize: 10 }}>{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active sheet table */}
          <div style={{ padding: '10px 14px' }}>
            <div className="dos-action-bar" style={{ gap: 6, marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>{SHEET_ICON[activeSheet]} {SHEET_LABEL[activeSheet]}</strong>
              <span className="muted small">{activeData.rows.length} dòng</span>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => msAddRow(activeSheet)}>➕ Dòng</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => msClearSheet(activeSheet)} disabled={activeData.rows.length === 0}>🗑 Xoá sheet này</button>
            </div>
            {activeData.rows.length === 0 ? (
              <p className="muted small" style={{ padding: 16, textAlign: 'center', margin: 0 }}>
                Sheet này chưa có dữ liệu. Bấm "🚀 AI Vision" trên hoặc "➕ Dòng" để thêm thủ công.
              </p>
            ) : (
              <div className="atgt-table-wrap" style={{ maxHeight: 360 }}>
                <table className="atgt-table">
                  <thead>
                    <tr>
                      {activeData.header.map((h, i) => (
                        <th key={i}>
                          <input className="td-input" style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600 }}
                            value={h} onChange={(e) => msUpdateHeader(activeSheet, i, e.target.value)} />
                        </th>
                      ))}
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeData.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>
                            <input className="td-input" style={{ padding: '4px 8px', fontSize: 12 }}
                              value={cell} onChange={(e) => msUpdateCell(activeSheet, ri, ci, e.target.value)} />
                          </td>
                        ))}
                        <td><button type="button" className="atgt-del-btn" onClick={() => msDeleteRow(activeSheet, ri)}>🗑</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Advanced fallback toggle */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13, cursor: 'pointer' }} onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▾' : '▸'} Advanced (Tesseract OCR + AI prompt thủ công + bảng cũ 1-sheet)
        </h2>
        {showAdvanced && (
          <div className="td-section-body" style={sectionBodyStyle}>
            <p className="muted small" style={{ marginTop: 0 }}>
              💡 Phần dưới chỉ dùng khi AI Vision không đọc được ảnh. Tesseract.js đọc rất kém với chữ tay tiếng Việt.
            </p>
            {/* Tesseract OCR */}
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>OCR Tesseract.js (engine ~3.5 MB lần đầu)</strong>
              <div className="dos-action-bar" style={{ gap: 6, marginTop: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => void handleRunOcr()}
                  disabled={!s.imageBase64 || ocrRunning}>
                  {ocrRunning ? `⏳ ${ocrProgress}%` : '🔠 Chạy Tesseract'}
                </button>
                {ocrRunning && (
                  <div className="ocr-progress-bar" style={{ flex: 1 }}>
                    <div className="ocr-progress-fill" style={{ width: `${ocrProgress}%` }} />
                  </div>
                )}
              </div>
              <textarea
                className="lisp-editor"
                value={s.ocrText}
                onChange={(e) => update('ocrText', e.target.value)}
                placeholder="Text OCR raw (sửa được)..."
                style={{ minHeight: 100, marginTop: 6, fontSize: 11 }}
                spellCheck={false}
              />
            </div>

            {/* AI prompt copy */}
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 12 }}>Copy text + prompt → ChatGPT/Claude.ai bên ngoài</strong>
              <textarea
                className="lisp-editor"
                value={s.aiPrompt}
                onChange={(e) => update('aiPrompt', e.target.value)}
                style={{ minHeight: 60, marginTop: 6, fontSize: 11 }}
                spellCheck={false}
              />
              <div className="dos-action-bar" style={{ gap: 6, marginTop: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void navigator.clipboard.writeText(`${s.aiPrompt}\n\n---TEXT OCR---\n${s.ocrText}`)}>📋 Copy prompt + text</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleAiPrompt}>🤖 AI rewrite</button>
              </div>
            </div>

            {/* Single-sheet bảng cũ */}
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 12 }}>Bảng cũ 1-sheet (legacy)</strong>
              <div className="dos-action-bar" style={{ gap: 6, marginTop: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleGroqVisionParse()}
                  disabled={!s.imageBase64}>🤖 AI Vision 1-sheet</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleParseToTable} disabled={!s.ocrText.trim()}>📊 Parse text</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addRow} disabled={s.parsedHeader.length === 0}>➕ Dòng</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={addColumn} disabled={s.parsedHeader.length === 0}>➕ Cột</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleExportExcel()}
                  disabled={s.parsedHeader.length === 0}>📤 Xuất Excel 1-sheet</button>
              </div>
              {s.parsedHeader.length > 0 && (
                <div className="atgt-table-wrap" style={{ maxHeight: 240, marginTop: 6 }}>
                  <table className="atgt-table">
                    <thead>
                      <tr>
                        {s.parsedHeader.map((h, i) => (
                          <th key={i}>
                            <input className="td-input" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600 }}
                              value={h} onChange={(e) => updateHeader(i, e.target.value)} />
                          </th>
                        ))}
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.parsedRows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>
                              <input className="td-input" style={{ padding: '4px 8px', fontSize: 11 }}
                                value={cell} onChange={(e) => updateRow(ri, ci, e.target.value)} />
                            </td>
                          ))}
                          <td><button type="button" className="atgt-del-btn" onClick={() => deleteRow(ri)}>🗑</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
