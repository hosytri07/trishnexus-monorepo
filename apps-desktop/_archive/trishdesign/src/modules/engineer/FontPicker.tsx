/**
 * TrishDesign Phase 43 wave 16.7 — FontPicker shared component.
 *
 * Scan font từ 3 nguồn (giống HHMĐ):
 *   - System TTF (queryLocalFonts API)
 *   - AutoCAD SHX (Program Files\Autodesk\AutoCAD <ver>\Fonts\) qua Tauri command
 *   - Preset (AUTOCAD_SHX_FONTS, VN_COMMON_TTF)
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const AUTOCAD_SHX_FONTS = [
  'romans.shx', 'romanc.shx', 'romand.shx', 'romant.shx',
  'simplex.shx', 'complex.shx', 'italic.shx', 'italicc.shx',
  'txt.shx', 'monotxt.shx',
  'isocp.shx', 'isocp2.shx', 'isocp3.shx',
  'iso3098a.shx', 'iso3098b.shx', 'iso3098c.shx', 'iso3098d.shx',
  'gothicg.shx', 'gothice.shx', 'gothici.shx',
  'scripts.shx', 'scriptc.shx',
  'vntime.shx', 'vntimeh.shx', 'vntime_d.shx',
];

export const VN_COMMON_TTF = [
  'vntime.ttf', 'vntimeh.ttf', 'vnarial.ttf', 'vnarialh.ttf',
  '.VnTime.ttf', '.VnTimeH.ttf', '.VnArial.ttf', '.VnArialH.ttf',
];

async function listAutoCadShxFonts(): Promise<string[]> {
  try {
    return await invoke<string[]>('list_autocad_shx_fonts');
  } catch {
    return [];
  }
}

export function FontPicker({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [acadShxFonts, setAcadShxFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let pending = 2;
    const done = () => { pending -= 1; if (pending === 0) setLoading(false); };
    const w = window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> };
    if (typeof w.queryLocalFonts === 'function') {
      w.queryLocalFonts()
        .then((fonts) => {
          const families = Array.from(new Set(fonts.map((f) => f.family))).sort();
          const ttfNames = families.map((fam) => `${fam.toLowerCase().replace(/\s+/g, '')}.ttf`);
          setSystemFonts(ttfNames);
        })
        .catch(() => {})
        .finally(done);
    } else { done(); }
    listAutoCadShxFonts().then((list) => setAcadShxFonts(list)).catch(() => {}).finally(done);
  }, []);

  const allShx = Array.from(new Set([...AUTOCAD_SHX_FONTS, ...acadShxFonts])).sort();
  const f = filter.toLowerCase();
  const matchShx = allShx.filter((x) => !f || x.toLowerCase().includes(f));
  const matchVN = VN_COMMON_TTF.filter((x) => !f || x.toLowerCase().includes(f));
  const matchSys = systemFonts.filter((x) => !f || x.toLowerCase().includes(f));
  const totalMatch = matchShx.length + matchVN.length + matchSys.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input
        type="text"
        placeholder="🔍 Gõ tên font để filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          height: 28, fontSize: 12, padding: '4px 8px',
          background: 'var(--color-bg-input, #0e0e12)',
          border: '1px solid var(--color-border-subtle, #2a2a30)',
          borderRadius: 4, color: 'inherit',
        }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 32, fontSize: 12, padding: '4px 8px',
          background: 'var(--color-bg-input, #0e0e12)',
          border: '1px solid var(--color-border-subtle, #2a2a30)',
          borderRadius: 4, color: 'inherit',
        }}
      >
        <option value={value}>★ {value}</option>
        {matchShx.length > 0 && (
          <optgroup label={`📐 AutoCAD SHX (${matchShx.length}${filter ? '/' + allShx.length : ''})`}>
            {matchShx.filter((font) => font !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {matchVN.length > 0 && (
          <optgroup label={`🇻🇳 Vietnamese TTF (${matchVN.length}${filter ? '/' + VN_COMMON_TTF.length : ''})`}>
            {matchVN.filter((font) => font !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {matchSys.length > 0 && (
          <optgroup label={`💻 Windows (${matchSys.length}${filter ? '/' + systemFonts.length : ''})`}>
            {matchSys.filter((font) => font !== value).map((font) => <option key={font} value={font}>{font}</option>)}
          </optgroup>
        )}
        {totalMatch === 0 && <option value="" disabled>Không tìm thấy font khớp filter</option>}
      </select>
      <span style={{ fontSize: 10, color: '#9CA3AF' }}>
        {loading ? 'Đang scan font…' :
         filter ? `Tìm thấy ${totalMatch} font khớp "${filter}"` :
         `${allShx.length} SHX${acadShxFonts.length > 0 ? ` (${acadShxFonts.length} AutoCAD)` : ''} + ${VN_COMMON_TTF.length} VN + ${systemFonts.length} Windows`}
      </span>
    </div>
  );
}
