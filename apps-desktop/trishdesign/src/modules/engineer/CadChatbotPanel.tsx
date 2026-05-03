/**
 * TrishDesign Phase 28.5 — Chatbot AutoCAD AI.
 *
 * Workflow:
 *   1. User gõ prompt tiếng Việt (vd "vẽ vòng tròn r=5 tại 10,20")
 *   2. Engine: rule-based parser (50+ pattern) HOẶC Claude API (nếu có key)
 *   3. AI sinh AutoCAD command sequence
 *   4. Preview + edit commands
 *   5. 1-click gửi vào AutoCAD active session
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { autoCadStatus, autoCadSendCommands, autoCadEnsureDocument } from '../../lib/autocad.js';

const LS_KEY = 'trishdesign:chat-db';
const API_KEY_LS = 'trishdesign:claude-api-key';
const GROQ_KEY_LS = 'trishdesign:groq-api-key';
const GEMINI_KEY_LS = 'trishdesign:gemini-api-key';

interface ChatMsg {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  commands?: string[];     // Parsed AutoCAD commands
  timestamp: number;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
}

interface ChatDb {
  threads: ChatThread[];
  activeThreadId: string | null;
}

function emptyDb(): ChatDb { return { threads: [], activeThreadId: null }; }
function newId(prefix: string): string { return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000).toString(36)}`; }

function loadDb(): ChatDb {
  if (typeof window === 'undefined') return emptyDb();
  try { return JSON.parse(window.localStorage.getItem(LS_KEY) ?? '{"threads":[],"activeThreadId":null}'); }
  catch { return emptyDb(); }
}
function saveDb(db: ChatDb): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}

// =====================================================================
// Examples library — 50+ pattern Tiếng Việt → AutoCAD commands
// =====================================================================

interface Example {
  prompt: string;
  commands: string[];
  category: string;
}

const EXAMPLES: Example[] = [
  // Vẽ basic
  { category: 'Cơ bản', prompt: 'Vẽ đường thẳng từ 0,0 đến 100,0',                         commands: ['._LINE 0,0 100,0 '] },
  { category: 'Cơ bản', prompt: 'Vẽ đường thẳng dài 50m theo trục X',                       commands: ['._LINE 0,0 50,0 '] },
  { category: 'Cơ bản', prompt: 'Vẽ vòng tròn bán kính 5 tại 0,0',                          commands: ['._CIRCLE 0,0 5'] },
  { category: 'Cơ bản', prompt: 'Vẽ vòng tròn r=10 tại 50,50',                              commands: ['._CIRCLE 50,50 10'] },
  { category: 'Cơ bản', prompt: 'Vẽ hình chữ nhật 20x10',                                   commands: ['._RECTANG 0,0 20,10'] },
  { category: 'Cơ bản', prompt: 'Vẽ hình chữ nhật từ 10,10 đến 30,20',                      commands: ['._RECTANG 10,10 30,20'] },
  { category: 'Cơ bản', prompt: 'Vẽ ellipse trục dài 10, trục ngắn 5',                      commands: ['._ELLIPSE 0,0 10,0 5'] },
  { category: 'Cơ bản', prompt: 'Vẽ đa giác 6 cạnh nội tiếp đường tròn r=5',                commands: ['._POLYGON 6 0,0 I 5'] },
  { category: 'Cơ bản', prompt: 'Vẽ điểm tại 10,10',                                         commands: ['._POINT 10,10'] },
  { category: 'Cơ bản', prompt: 'Vẽ cung tròn 3 điểm',                                       commands: ['._ARC 0,0 5,5 10,0'] },

  // Text
  { category: 'Text',  prompt: 'Viết text "Hello" tại 0,0 cao 2.5',                          commands: ['._-TEXT 0,0 2.5 0 Hello\n'] },
  { category: 'Text',  prompt: 'Viết text "Lý trình Km0+000" cao 3',                         commands: ['._-TEXT 0,0 3 0 Lý trình Km0+000\n'] },
  { category: 'Text',  prompt: 'Viết text MC center "TRỤC TIM" cao 5 tại 50,0',              commands: ['._-TEXT J MC 50,0 5 0 TRỤC TIM\n'] },

  // Layer
  { category: 'Layer', prompt: 'Tạo layer DUONG màu vàng',                                   commands: ['._-LAYER M DUONG C 2 DUONG \n\n'] },
  { category: 'Layer', prompt: 'Tạo layer KHUONG_DUONG màu đỏ',                              commands: ['._-LAYER M KHUONG_DUONG C 1 KHUONG_DUONG \n\n'] },
  { category: 'Layer', prompt: 'Set layer current là TIM',                                   commands: ['._-LAYER S TIM \n\n'] },
  { category: 'Layer', prompt: 'Tắt tất cả layer trừ DUONG',                                 commands: ['._-LAYER OFF * \n','._-LAYER ON DUONG \n'] },

  // Hatch
  { category: 'Hatch', prompt: 'Vẽ hatch ANSI31 trong vùng vừa chọn',                        commands: ['._-HATCH P ANSI31 1 0 S L \n\n\n'] },
  { category: 'Hatch', prompt: 'Hatch SOLID trong vòng tròn',                                commands: ['._-HATCH P SOLID 1 0 S L \n\n\n'] },

  // Modify
  { category: 'Modify', prompt: 'Xóa tất cả',                                                commands: ['._ERASE ALL \n'] },
  { category: 'Modify', prompt: 'Zoom toàn bộ',                                              commands: ['._ZOOM E\n'] },
  { category: 'Modify', prompt: 'Zoom about',                                                commands: ['._ZOOM A\n'] },
  { category: 'Modify', prompt: 'Lưu file',                                                  commands: ['._QSAVE\n'] },
  { category: 'Modify', prompt: 'Dọn purge tất cả',                                          commands: ['(command "._-PURGE" "A" "*" "N")\n'] },
  { category: 'Modify', prompt: 'Audit fix lỗi bản vẽ',                                      commands: ['(command "._AUDIT" "Y")\n'] },

  // Move/Copy/Rotate
  { category: 'Modify', prompt: 'Move các đối tượng vừa vẽ tới vị trí 100,100',              commands: ['._MOVE L \n0,0 100,100\n'] },
  { category: 'Modify', prompt: 'Copy các đối tượng vừa vẽ',                                 commands: ['._COPY L \n0,0 \n'] },
  { category: 'Modify', prompt: 'Rotate 90 độ tại gốc',                                      commands: ['._ROTATE L \n0,0 90\n'] },
  { category: 'Modify', prompt: 'Scale 2 lần tại gốc',                                       commands: ['._SCALE L \n0,0 2\n'] },
  { category: 'Modify', prompt: 'Mirror đối xứng qua trục X',                                commands: ['._MIRROR L \n0,0 100,0 N\n'] },
  { category: 'Modify', prompt: 'Offset 5 đv ra ngoài',                                      commands: ['._OFFSET 5 L \n\n'] },

  // Dimension
  { category: 'Dim',   prompt: 'Đo khoảng cách 2 điểm 0,0 và 100,0',                         commands: ['._DIST 0,0 100,0\n'] },
  { category: 'Dim',   prompt: 'Tính diện tích các đối tượng vừa vẽ',                        commands: ['._AREA O L\n'] },
  { category: 'Dim',   prompt: 'Vẽ kích thước thẳng từ 0,0 đến 100,0 đặt tại y=10',          commands: ['._DIMLINEAR 0,0 100,0 50,10\n'] },
  { category: 'Dim',   prompt: 'Vẽ kích thước bán kính',                                     commands: ['._DIMRADIUS L 30,30\n'] },

  // Block
  { category: 'Block', prompt: 'Insert block "BIENBAO" tại 0,0',                             commands: ['._-INSERT BIENBAO 0,0 1 1 0\n'] },
  { category: 'Block', prompt: 'Tạo block "DEN_THINH" từ đối tượng vừa vẽ',                  commands: ['._-BLOCK DEN_THINH 0,0 L \n'] },

  // Hatch + draw cho cầu đường
  { category: 'CầuĐường', prompt: 'Vẽ mặt cắt đường rộng 7m, dài 100m',                     commands: ['._RECTANG 0,-3.5 100,3.5'] },
  { category: 'CầuĐường', prompt: 'Vẽ tim đường vàng đứt từ 0,0 đến 100,0',                 commands: ['._-LAYER M TIM C 2 TIM \n\n', '._-LAYER LT DASHED TIM \n\n', '._LINE 0,0 100,0 '] },
  { category: 'CầuĐường', prompt: 'Vẽ vạch ngang đường tại x=20, dài 7m',                    commands: ['._LINE 20,-3.5 20,3.5 '] },
  { category: 'CầuĐường', prompt: 'Vẽ cọc H1 tại x=0',                                       commands: ['._LINE 0,-4 0,4 ', '._-TEXT 0,5 0.5 90 H1=0\n'] },

  // System variables
  { category: 'Setvar', prompt: 'Set FILEDIA = 0',                                            commands: ['._FILEDIA\n0\n'] },
  { category: 'Setvar', prompt: 'Set HPISLANDDETECTION = 2',                                  commands: ['._-SETVAR HPISLANDDETECTION 2\n'] },
  { category: 'Setvar', prompt: 'Set Units mm chế độ Decimal',                                commands: ['(command "._-UNITS" "2" "0" "1" "0" "0" "N")\n'] },

  // Selection
  { category: 'Select', prompt: 'Chọn tất cả',                                                commands: ['._SELECT ALL\n'] },
  { category: 'Select', prompt: 'Chọn theo Crossing Window',                                  commands: ['._SELECT C \n'] },
];

// =====================================================================
// Rule-based parser: prompt VN → commands
// =====================================================================

function parsePromptToCommands(prompt: string): { commands: string[]; matched: boolean; explanation: string } {
  const lower = prompt.toLowerCase().trim();

  // Phase 28.7: ƯU TIÊN rule-based với số cụ thể TRƯỚC fuzzy match
  // Parse pattern WxH (vd "50x30", "100 x 50") + đoạn "kích thước"
  const wxhMatch = lower.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  // Parse all numbers (loại bỏ trùng nếu wxh đã capture)
  const numbers = (lower.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

  // RECTANG (chữ nhật) — phải check trước vì có WxH
  if (lower.includes('chữ nhật') || lower.includes('rect') || lower.includes('hình hộp')) {
    let w = 20, h = 10;
    if (wxhMatch) {
      w = Number(wxhMatch[1]) || w;
      h = Number(wxhMatch[2]) || h;
    } else if (numbers.length >= 2) {
      w = numbers[0]!; h = numbers[1]!;
    }
    return { commands: [`._RECTANG 0,0 ${w},${h}`], matched: true, explanation: `Vẽ RECTANG ${w}×${h}` };
  }

  // CIRCLE — bán kính (r=)
  if (lower.includes('vòng tròn') || lower.includes('hình tròn') || lower.includes('circle')) {
    let r = 5, cx = 0, cy = 0;
    const rMatch = lower.match(/(?:r|bán\s*kính|đường\s*kính)\s*[=:]?\s*(\d+(?:\.\d+)?)/i);
    if (rMatch) r = Number(rMatch[1]) || r;
    else if (numbers.length >= 1) r = numbers[0]!;
    // Position "tại x,y"
    const posMatch = lower.match(/tại\s+(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)/);
    if (posMatch) { cx = Number(posMatch[1])!; cy = Number(posMatch[2])!; }
    return { commands: [`._CIRCLE ${cx},${cy} ${r}`], matched: true, explanation: `Vẽ CIRCLE r=${r} tại (${cx},${cy})` };
  }

  // LINE — từ x1,y1 đến x2,y2
  if (lower.includes('đường thẳng') || (lower.includes('line') && !lower.includes('linear'))) {
    let x1 = 0, y1 = 0, x2 = 100, y2 = 0;
    const fromTo = lower.match(/từ\s+(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)\s+(?:đến|tới)\s+(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)/);
    if (fromTo) { x1 = +fromTo[1]!; y1 = +fromTo[2]!; x2 = +fromTo[3]!; y2 = +fromTo[4]!; }
    else if (numbers.length >= 4) { [x1, y1, x2, y2] = numbers as [number, number, number, number]; }
    return { commands: [`._LINE ${x1},${y1} ${x2},${y2} `], matched: true, explanation: `Vẽ LINE từ (${x1},${y1}) đến (${x2},${y2})` };
  }

  // POLYGON — đa giác N cạnh
  const polyMatch = lower.match(/đa\s*giác\s+(\d+)\s*cạnh/);
  if (polyMatch) {
    const n = Number(polyMatch[1]) || 6;
    const r = numbers.find((v) => v !== n) ?? 5;
    return { commands: [`._POLYGON ${n} 0,0 I ${r}`], matched: true, explanation: `Vẽ POLYGON ${n} cạnh nội tiếp r=${r}` };
  }

  // ELLIPSE
  if (lower.includes('ellipse') || lower.includes('elip')) {
    const [a = 10, b = 5] = numbers;
    return { commands: [`._ELLIPSE 0,0 ${a},0 ${b}`], matched: true, explanation: `Vẽ ELLIPSE trục dài ${a}, ngắn ${b}` };
  }

  // ZOOM
  if (lower.includes('zoom')) {
    if (lower.includes('toàn') || lower.includes('extent')) return { commands: ['._ZOOM E\n'], matched: true, explanation: 'Zoom Extents' };
    if (lower.includes('window')) return { commands: ['._ZOOM W\n'], matched: true, explanation: 'Zoom Window' };
    return { commands: ['._ZOOM E\n'], matched: true, explanation: 'Zoom Extents' };
  }

  // ERASE / Xóa
  if (lower.includes('xóa') || lower.includes('erase') || lower.includes('xoa') || lower.includes('delete')) {
    if (lower.includes('tất cả') || lower.includes('all')) return { commands: ['._ERASE ALL \n'], matched: true, explanation: 'Xóa tất cả' };
    return { commands: ['._ERASE L \n'], matched: true, explanation: 'Xóa đối tượng vừa vẽ' };
  }

  // LAYER
  if (lower.includes('layer') || lower.includes('lớp')) {
    const nameMatch = lower.match(/(?:layer|lớp)\s+["']?([a-z0-9_]+)["']?/i);
    const name = nameMatch?.[1]?.toUpperCase() ?? 'NEW_LAYER';
    const colorMatch = lower.match(/màu\s+(\w+)/i);
    const colorMap: Record<string, number> = { đỏ: 1, vàng: 2, xanh: 3, lá: 3, lam: 5, tím: 6, trắng: 7, xám: 8 };
    const color = colorMap[colorMatch?.[1]?.toLowerCase() ?? ''] ?? 7;
    if (lower.includes('tạo') || lower.includes('create')) {
      return { commands: [`._-LAYER M ${name} C ${color} ${name} \n\n`], matched: true, explanation: `Tạo layer ${name} màu ${color}` };
    }
    if (lower.includes('set') || lower.includes('chọn') || lower.includes('current')) {
      return { commands: [`._-LAYER S ${name} \n\n`], matched: true, explanation: `Set layer current = ${name}` };
    }
  }

  // FALLBACK: fuzzy match với examples (lower threshold)
  let best: Example | null = null;
  let bestScore = 0;
  for (const ex of EXAMPLES) {
    const exLower = ex.prompt.toLowerCase();
    const tokens = exLower.split(/\s+/).filter((t) => t.length > 3);
    let score = 0;
    for (const t of tokens) if (lower.includes(t)) score++;
    if (score > bestScore) { bestScore = score; best = ex; }
  }
  if (best && bestScore >= 3) {
    return { commands: best.commands, matched: true, explanation: `Pattern match (fuzzy): "${best.prompt}"` };
  }

  // Không match
  return {
    commands: [],
    matched: false,
    explanation: 'Chưa hiểu lệnh. Hãy thử cụ thể hơn (vd: "vẽ vòng tròn r=5 tại 10,20", "vẽ chữ nhật 50x30", "tạo layer DUONG màu vàng") hoặc chọn từ Examples library.',
  };
}

type DialogState =
  | { kind: 'prompt'; title: string; value: string; onSubmit: (v: string) => void }
  | { kind: 'confirm'; title: string; message: string; danger?: boolean; onConfirm: () => void }
  | null;

export function CadChatbotPanel(): JSX.Element {
  const [db, setDbState] = useState<ChatDb>(() => loadDb());
  const [input, setInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [acadRunning, setAcadRunning] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(API_KEY_LS) ?? '' : ''));
  const [groqKey, setGroqKey] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(GROQ_KEY_LS) ?? '' : ''));
  const [geminiKey, setGeminiKey] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem(GEMINI_KEY_LS) ?? '' : ''));

  // Phase 28.9 — Listen sync event để cập nhật key live khi admin set ở TrishAdmin
  useEffect(() => {
    function onSync(): void {
      setApiKey(localStorage.getItem(API_KEY_LS) ?? '');
      setGroqKey(localStorage.getItem(GROQ_KEY_LS) ?? '');
      setGeminiKey(localStorage.getItem(GEMINI_KEY_LS) ?? '');
    }
    window.addEventListener('trishdesign:apikey-synced', onSync);
    return () => window.removeEventListener('trishdesign:apikey-synced', onSync);
  }, []);
  const [aiThinking, setAiThinking] = useState(false);
  const [editingCmds, setEditingCmds] = useState<Record<string, string>>({});
  const [showCmdsFor, setShowCmdsFor] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<DialogState>(null);

  // Phase 28.10 — Active engine + backup chain (UI clarity)
  const activeEngine = groqKey ? '⚡ Groq Llama 3.3 70B' : geminiKey ? '✨ Gemini 2.0 Flash' : apiKey ? '🔑 Claude' : '⚙ Rule-based';
  const backups: string[] = [];
  if (groqKey && geminiKey) backups.push('✨ Gemini');
  if ((groqKey || geminiKey) && apiKey) backups.push('🔑 Claude');
  if (groqKey || geminiKey || apiKey) backups.push('⚙ Rule-based');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { saveDb(db); }, [db]);
  function setDb(updater: (prev: ChatDb) => ChatDb): void { setDbState((prev) => updater(prev)); }
  function flash(m: string): void { setStatusMsg(m); setTimeout(() => setStatusMsg(''), 2500); }

  useEffect(() => {
    autoCadStatus().then((s) => setAcadRunning(s.running));
    const t = setInterval(() => autoCadStatus().then((s) => setAcadRunning(s.running)), 5000);
    return () => clearInterval(t);
  }, []);

  const activeThread = useMemo(
    () => db.threads.find((t) => t.id === db.activeThreadId) ?? null,
    [db.threads, db.activeThreadId],
  );

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages.length]);

  function ensureThread(): ChatThread {
    if (activeThread) return activeThread;
    const t: ChatThread = {
      id: newId('th'), title: 'Cuộc trò chuyện mới',
      messages: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    setDb((prev) => ({ ...prev, threads: [...prev.threads, t], activeThreadId: t.id }));
    return t;
  }

  function addMessage(threadId: string, msg: ChatMsg): void {
    setDb((prev) => ({
      ...prev,
      threads: prev.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, msg], updatedAt: Date.now() }
          : t,
      ),
    }));
  }

  async function handleSend(): Promise<void> {
    const text = input.trim();
    if (!text) return;
    const thread = ensureThread();
    setInput('');
    // Set title nếu là message đầu
    if (thread.messages.length === 0) {
      setDb((prev) => ({
        ...prev,
        threads: prev.threads.map((t) => (t.id === thread.id ? { ...t, title: text.slice(0, 50) } : t)),
      }));
    }
    addMessage(thread.id, { id: newId('m'), role: 'user', text, timestamp: Date.now() });

    setAiThinking(true);
    try {
      // Common system prompt cho mọi AI
      const systemPromptBase = `Bạn là AI chuyên gia AutoCAD và thiết kế cầu đường VN.
Khi user gõ tiếng Việt mô tả cần vẽ, bạn sinh ra DANH SÁCH AutoCAD command line raw.
Format response: trả ra JSON object { "explanation": "...", "commands": ["._LINE ...", "._CIRCLE ..."] } - KHÔNG có markdown code block.
Dùng underscore prefix command "._LINE" để force English. Spaces giữa params, \\n để xuống dòng prompt.
Tham khảo: ._LINE x,y x,y "" / ._CIRCLE x,y r / ._RECTANG x1,y1 x2,y2 / ._-LAYER M name C color name "" / ._-TEXT x,y h r text / ._ZOOM E.`;

      function tryParseJson(reply: string, sourceLabel: string): boolean {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            addMessage(thread.id, {
              id: newId('m'), role: 'ai',
              text: parsed.explanation ?? `(${sourceLabel} sinh commands)`,
              commands: parsed.commands ?? [],
              timestamp: Date.now(),
            });
            return true;
          } catch { /* fallthrough */ }
        }
        addMessage(thread.id, { id: newId('m'), role: 'ai', text: reply, timestamp: Date.now() });
        return true;
      }

      // 1. Try Groq Cloud (free, fastest)
      if (groqKey.trim()) {
        try {
          const reply = await invoke<string>('groq_chat', {
            req: {
              apiKey: groqKey.trim(),
              model: 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemPromptBase },
                { role: 'user', content: text },
              ],
              maxTokens: 1024,
            },
          });
          if (tryParseJson(reply, 'Groq AI')) return;
        } catch (e) {
          flash(`✗ Groq: ${String(e)} — fallback Gemini`);
        }
      }

      // 2. Try Gemini (free)
      if (geminiKey.trim()) {
        try {
          const reply = await invoke<string>('gemini_chat', {
            req: {
              apiKey: geminiKey.trim(),
              model: 'gemini-2.0-flash',
              system: systemPromptBase,
              messages: [{ role: 'user', content: text }],
              maxTokens: 1024,
            },
          });
          if (tryParseJson(reply, 'Gemini AI')) return;
        } catch (e) {
          flash(`✗ Gemini: ${String(e)} — fallback Claude/rule-based`);
        }
      }

      // 3. Try Claude API nếu có key (paid)
      if (apiKey.trim()) {
        try {
          const systemPrompt = `Bạn là AI chuyên gia AutoCAD và thiết kế cầu đường VN.
Khi user gõ tiếng Việt mô tả cần vẽ, bạn sinh ra DANH SÁCH AutoCAD command line raw.
Format response: trả ra JSON object { "explanation": "...", "commands": ["._LINE ...", "._CIRCLE ..."] } - KHÔNG có markdown code block.
Dùng underscore prefix command "._LINE" để force English. Spaces giữa params, \\n để xuống dòng prompt.
Tham khảo: ._LINE x,y x,y "" / ._CIRCLE x,y r / ._RECTANG x1,y1 x2,y2 / ._-LAYER M name C color name "" / ._-TEXT x,y h r text / ._ZOOM E.`;
          const reply = await invoke<string>('claude_chat', {
            req: {
              apiKey: apiKey.trim(),
              model: 'claude-3-5-sonnet-20241022',
              system: systemPrompt,
              messages: [{ role: 'user', content: text }],
              maxTokens: 1024,
            },
          });
          // Parse JSON
          const jsonMatch = reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            addMessage(thread.id, {
              id: newId('m'), role: 'ai',
              text: parsed.explanation ?? '(AI sinh commands)',
              commands: parsed.commands ?? [],
              timestamp: Date.now(),
            });
            return;
          }
          // Fallback: hiển thị raw
          addMessage(thread.id, { id: newId('m'), role: 'ai', text: reply, timestamp: Date.now() });
          return;
        } catch (e) {
          flash(`✗ Claude API: ${String(e)} — fallback Groq/rule-based`);
        }
      }

      // 4. Rule-based parser fallback (no AI)
      const parsed = parsePromptToCommands(text);
      addMessage(thread.id, {
        id: newId('m'), role: 'ai',
        text: parsed.explanation,
        commands: parsed.matched ? parsed.commands : [],
        timestamp: Date.now(),
      });
    } finally {
      setAiThinking(false);
    }
  }

  async function handleSendCommands(msgId: string, commands: string[]): Promise<void> {
    if (!acadRunning) {
      flash('✗ Chưa kết nối AutoCAD.');
      return;
    }
    if (commands.length === 0) {
      flash('Không có lệnh để gửi.');
      return;
    }
    try {
      await autoCadEnsureDocument();
      const sent = await autoCadSendCommands(commands);
      flash(`✓ Đã gửi ${sent} lệnh vào AutoCAD`);
    } catch (e) { flash(`✗ ${String(e)}`); }
  }

  function handleNewThread(): void {
    const t: ChatThread = {
      id: newId('th'), title: 'Cuộc trò chuyện mới',
      messages: [], createdAt: Date.now(), updatedAt: Date.now(),
    };
    setDb((prev) => ({ ...prev, threads: [...prev.threads, t], activeThreadId: t.id }));
  }

  function handleDeleteThread(id: string): void {
    const t = db.threads.find((x) => x.id === id); if (!t) return;
    setDialog({
      kind: 'confirm', title: 'Xóa cuộc trò chuyện', danger: true,
      message: `Xóa "${t.title}"?`,
      onConfirm: () => setDb((prev) => ({
        ...prev,
        threads: prev.threads.filter((x) => x.id !== id),
        activeThreadId: prev.activeThreadId === id ? null : prev.activeThreadId,
      })),
    });
  }

  function handleClearAllThreads(): void {
    if (db.threads.length === 0) { flash('Không có lịch sử để xoá'); return; }
    setDialog({
      kind: 'confirm', title: '🗑 Xoá TOÀN BỘ lịch sử chat', danger: true,
      message: `Xoá hết ${db.threads.length} cuộc trò chuyện? Hành động này không thể hoàn tác.`,
      onConfirm: () => setDb((_prev) => ({ threads: [], activeThreadId: null })),
    });
  }

  function handlePickExample(ex: Example): void {
    setInput(ex.prompt);
    setShowExamples(false);
  }

  function handleSaveApiKey(): void {
    setDialog({
      kind: 'prompt', title: 'Claude API Key (để trống = dùng Groq/rule-based)', value: apiKey,
      onSubmit: (key) => {
        setApiKey(key);
        try { localStorage.setItem(API_KEY_LS, key); } catch { /* ignore */ }
        flash(key ? '✓ Đã lưu Claude API key' : '✓ Đã xoá Claude API key');
      },
    });
  }

  function handleSaveGroqKey(): void {
    setDialog({
      kind: 'prompt', title: 'Groq API Key (free tier — console.groq.com)', value: groqKey,
      onSubmit: (key) => {
        setGroqKey(key);
        try { localStorage.setItem(GROQ_KEY_LS, key); } catch { /* ignore */ }
        flash(key ? '✓ Đã lưu Groq API key (Llama 3.3 70B)' : '✓ Đã xoá Groq API key');
      },
    });
  }

  return (
    <>
      <div className="chat-shell">
        <div className="chat-sidebar">
          <div className="chat-sidebar-head">
            <h3>💬 Lịch sử ({db.threads.length})</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="btn btn-ghost" title="Xoá toàn bộ lịch sử" onClick={handleClearAllThreads} disabled={db.threads.length === 0}>🗑</button>
              <button type="button" className="btn btn-primary" title="Cuộc trò chuyện mới" onClick={handleNewThread}>➕</button>
            </div>
          </div>
          <div className="chat-thread-list">
            {db.threads.length === 0 ? (
              <p className="muted small" style={{ padding: 12, textAlign: 'center' }}>Chưa có cuộc trò chuyện.</p>
            ) : db.threads.slice().reverse().map((t) => (
              <div key={t.id} className={`chat-thread-item${t.id === db.activeThreadId ? ' chat-thread-active' : ''}`}
                onClick={() => setDb((prev) => ({ ...prev, activeThreadId: t.id }))}>
                <div className="chat-thread-title">{t.title}</div>
                <div className="muted small">{t.messages.length} tin · {new Date(t.updatedAt).toLocaleDateString('vi-VN')}</div>
                <button type="button" className="atgt-del-btn chat-thread-del" onClick={(e) => { e.stopPropagation(); handleDeleteThread(t.id); }}>🗑</button>
              </div>
            ))}
          </div>
          <div className="chat-sidebar-foot">
            <span className="muted small" style={{ fontSize: 11 }}>
              AI: {groqKey ? '⚡ Groq Llama' : geminiKey ? '✨ Gemini Flash' : apiKey ? '🔑 Claude' : '⚙ Rule-based'}
              {!apiKey && !groqKey && !geminiKey && (
                <span style={{ display: 'block', fontSize: 10, marginTop: 4 }}>
                  (Liên hệ Admin để cấu hình AI)
                </span>
              )}
            </span>
            <span className="muted small" style={{ fontSize: 10 }}>
              AutoCAD: {acadRunning ? <span style={{ color: '#16a34a' }}>● ON</span> : <span style={{ color: '#dc2626' }}>● OFF</span>}
            </span>
          </div>
        </div>

        <div className="chat-main">
          <div className="chat-head">
            <h2>🤖 Chatbot AutoCAD AI</h2>
            <p className="muted small" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>Gõ lệnh tiếng Việt → AI sinh AutoCAD command.</span>
              <span style={{ padding: '2px 8px', background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', borderRadius: 4, fontWeight: 600 }}>
                Đang dùng: {activeEngine}
              </span>
              {backups.length > 0 && (
                <span style={{ fontSize: 11 }}>
                  Backup: {backups.join(' → ')}
                </span>
              )}
              <span style={{ fontSize: 11 }}>
                AutoCAD: {acadRunning ? <span style={{ color: '#16a34a' }}>● ON</span> : <span style={{ color: '#dc2626' }}>● OFF</span>}
              </span>
            </p>
            {statusMsg && <span className="td-saved-flash">{statusMsg}</span>}
          </div>

          <div className="chat-body">
            {!activeThread || activeThread.messages.length === 0 ? (
              <div className="chat-welcome">
                <h3>👋 Chào, hãy gõ lệnh tiếng Việt!</h3>
                <p className="muted small">VD: vẽ vòng tròn r=5 tại 10,20 · tạo layer DUONG màu đỏ · zoom toàn bộ</p>
                <button type="button" className="btn btn-primary" onClick={() => setShowExamples(true)}>📚 Xem 50+ examples</button>
              </div>
            ) : (
              activeThread.messages.map((m) => (
                <div key={m.id} className={`chat-msg chat-msg-${m.role}`}>
                  <div className="chat-msg-head">
                    <span className="chat-msg-icon">{m.role === 'user' ? '🙋' : '🤖'}</span>
                    <span className="chat-msg-role">{m.role === 'user' ? 'Bạn' : 'AI'}</span>
                  </div>
                  <div className="chat-msg-text">{m.text}</div>
                  {m.commands && m.commands.length > 0 && (
                    <div className="chat-msg-cmds">
                      <div className="chat-cmds-head">
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setShowCmdsFor((p) => ({ ...p, [m.id]: !p[m.id] }))}>
                          {showCmdsFor[m.id] ? '▾' : '▸'} {showCmdsFor[m.id] ? 'Ẩn' : 'Xem'} code ({m.commands.length} lệnh)
                        </button>
                        <button type="button" className="btn btn-primary" onClick={() => void handleSendCommands(m.id, editingCmds[m.id]?.split('\n').filter(Boolean) ?? m.commands ?? [])}
                          disabled={!acadRunning}>▶ Gửi vào AutoCAD</button>
                      </div>
                      {showCmdsFor[m.id] && (
                        <textarea className="lisp-editor" style={{ minHeight: 90, marginTop: 6 }}
                          value={editingCmds[m.id] ?? m.commands.join('\n')}
                          onChange={(e) => setEditingCmds({ ...editingCmds, [m.id]: e.target.value })}
                          spellCheck={false} />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {aiThinking && (
              <div className="chat-msg chat-msg-ai">
                <div className="chat-msg-head"><span>🤖</span><span>AI</span></div>
                <div className="chat-msg-text"><span className="chat-thinking">⏳ AI đang nghĩ...</span></div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="chat-input-bar">
            <button type="button" className="btn btn-ghost" onClick={() => setShowExamples(!showExamples)}>📚</button>
            <textarea className="td-input chat-input" rows={2}
              placeholder="Gõ lệnh tiếng Việt... (Enter gửi, Shift+Enter xuống dòng)"
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }} />
            <button type="button" className="btn btn-primary" onClick={() => void handleSend()} disabled={!input.trim() || aiThinking}>
              {aiThinking ? '⏳' : '✨ Gửi'}
            </button>
          </div>
        </div>

        {showExamples && (
          <div className="chat-examples">
            <div className="chat-examples-head">
              <h3>📚 50+ Examples library</h3>
              <button type="button" className="atgt-del-btn" onClick={() => setShowExamples(false)}>✗</button>
            </div>
            <div className="chat-examples-list">
              {Array.from(new Set(EXAMPLES.map((e) => e.category))).map((cat) => (
                <div key={cat} className="chat-examples-group">
                  <div className="dos-list-group-title">{cat}</div>
                  {EXAMPLES.filter((e) => e.category === cat).map((ex, i) => (
                    <button key={i} type="button" className="chat-example-item" onClick={() => { setInput(ex.prompt); setShowExamples(false); }}>
                      <span>{ex.prompt}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <DialogModal state={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function DialogModal({ state, onClose }: { state: DialogState; onClose: () => void }): JSX.Element {
  const [input, setInput] = useState('');
  useEffect(() => { if (state?.kind === 'prompt') setInput(state.value); }, [state]);
  if (!state) return <></>;
  function submit(): void {
    if (state?.kind === 'prompt') { state.onSubmit(input); }
    else if (state?.kind === 'confirm') state.onConfirm();
    onClose();
  }
  return (
    <div className="atgt-dialog-backdrop" onClick={onClose}>
      <div className="atgt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="atgt-dialog-title">{state.title}</div>
        {state.kind === 'prompt' ? (
          <input type="password" className="td-input" autoFocus value={input}
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
