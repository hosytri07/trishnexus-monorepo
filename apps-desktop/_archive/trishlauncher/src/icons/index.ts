/**
 * Icon registry cho launcher — static import 10 PNG 256×256 RGBA.
 *
 * Vite hash từng file + inline-url vào bundle. Tổng ~345 KiB cho 10
 * icon (nhẹ hẳn so với placeholder 1024×1024 gradient ~780 KiB của
 * `scripts/qa/gen-icons.py` Phase 14.5.2). Icon thật do Trí thiết kế
 * từ session trước rebuild Tauri, đã xoá background (alpha channel).
 *
 * Nguồn gốc: `apps/trishlauncher/src/trishlauncher/resources/logos/`
 * (launcher Qt/Python cũ). Không xoá folder cũ đó — giữ làm archive.
 *
 * Phase 14.5.5.a — 2026-04-24.
 * Phase 14.5.5.a.1 (fix icon copy nhầm) — 2026-04-24.
 */

import trishlauncher from './trishlauncher.png';
import trishcheck from './trishcheck.png';
import trishclean from './trishclean.png';
import trishfont from './trishfont.png';
import trishtype from './trishtype.png';
import trishimage from './trishimage.png';
import trishnote from './trishnote.png';
import trishlibrary from './trishlibrary.png';
import trishsearch from './trishsearch.png';
import trishdesign from './trishdesign.png';
// Phase 39.4 — 5 app mới có icon riêng
import trishshortcut from './trishshortcut.png';
import trishdrive from './trishdrive.png';
import trishfinance from './trishfinance.png';
import trishiso from './trishiso.png';
import trishoffice from './trishoffice.png';

export const APP_ICONS: Record<string, string> = {
  trishlauncher,
  trishcheck,
  trishclean,
  trishfont,
  trishtype,
  trishimage,
  trishnote,
  trishlibrary,
  trishsearch,
  trishdesign,
  trishshortcut,
  trishdrive,
  trishfinance,
  trishiso,
  trishoffice,
};

/**
 * Launcher tự-reference cho topbar brand logo.
 */
export const LAUNCHER_ICON = trishlauncher;

/**
 * Fallback cho app chưa có icon (không nên xảy ra ở v1 nhưng defensive).
 */
export function iconFor(appId: string): string | undefined {
  return APP_ICONS[appId];
}
