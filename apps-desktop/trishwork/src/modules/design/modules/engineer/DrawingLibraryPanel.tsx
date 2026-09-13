/**
 * DrawingLibraryPanel — Thư viện bản vẽ (chi tiết điển hình + bản vẽ mẫu).
 *
 * Đọc realtime Firestore collection `drawing_library`. Duyệt theo nhánh + nhóm
 * con + tìm kiếm, xem chi tiết, tải file, chèn block vào AutoCAD (khi có block_id).
 * Admin upload qua TrishAdmin (làm sau). Chưa có dữ liệu → hiện trạng thái chờ.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import {
  DRAWING_CATEGORIES,
  DRAWING_SUBGROUPS,
  type DrawingCategory,
  type DrawingItem,
} from './drawing-library.js';

function isInTauri(): boolean {
  return typeof window !== 'undefined' &&
    // @ts-expect-error tauri internal
    typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

function fmtSize(b?: number): string {
  if (!b) return '';
  if (b > 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b > 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

export function DrawingLibraryPanel(): JSX.Element {
  const [items, setItems] = useState<DrawingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<DrawingCategory>('detail');
  const [subgroup, setSubgroup] = useState<string>('all');
  const [query_, setQuery] = useState('');
  const [selected, setSelected] = useState<DrawingItem | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const sectionStyle: CSSProperties = { marginBottom: 12 };
  const bodyStyle: CSSProperties = { padding: '10px 14px' };

  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(getFirebaseDb(), 'drawing_library'), orderBy('name'));
      unsub = onSnapshot(
        q,
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DrawingItem, 'id'>) })));
          setLoading(false);
        },
        () => setLoading(false),
      );
    } catch {
      setLoading(false);
    }
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = query_.trim().toLowerCase();
    return items.filter((it) => {
      if (it.category !== cat) return false;
      if (subgroup !== 'all' && it.subgroup !== subgroup) return false;
      if (!s) return true;
      return (
        it.name.toLowerCase().includes(s) ||
        (it.keywords ?? '').toLowerCase().includes(s) ||
        (it.tags ?? []).join(' ').toLowerCase().includes(s)
      );
    });
  }, [items, cat, subgroup, query_]);

  function showFlash(m: string): void {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  }

  async function handleInsert(it: DrawingItem): Promise<void> {
    if (!isInTauri()) { showFlash('Chèn AutoCAD chỉ chạy trong app desktop.'); return; }
    if (!it.block_id) { showFlash(`"${it.name}" là bản vẽ/PDF — hãy tải về, chưa hỗ trợ chèn block.`); return; }
    try {
      await invoke('autocad_check_running');
      showFlash(`(Demo) Sẽ chèn block "${it.block_id}" vào AutoCAD.`);
    } catch (e) { showFlash(`✗ ${String(e)}`); }
  }

  async function handleDownload(it: DrawingItem): Promise<void> {
    if (!it.file_url) { showFlash('Mục này chưa có file tải.'); return; }
    try {
      // Mở link tải bằng trình duyệt mặc định qua plugin opener (đã có sẵn trong app).
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(it.file_url);
    } catch {
      window.open(it.file_url, '_blank');
    }
  }

  const subs = DRAWING_SUBGROUPS[cat];

  return (
    <div className="td-panel">
      <header className="td-panel-head" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 4 }}>📚 Thư viện bản vẽ</h1>
        <p className="td-lead" style={{ fontSize: 12, marginBottom: 0 }}>
          Chi tiết điển hình & bản vẽ mẫu — tải về hoặc chèn thẳng vào AutoCAD.
        </p>
        {flash && <span className="td-saved-flash">{flash}</span>}
      </header>

      {/* Nhánh + nhóm con + tìm kiếm */}
      <section className="td-section" style={sectionStyle}>
        <div className="td-section-body" style={bodyStyle}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DRAWING_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`btn btn-sm ${cat === c.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setCat(c.id); setSubgroup('all'); setSelected(null); }}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <input
            className="td-input"
            value={query_}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Tìm theo tên, tag…"
            style={{ width: '100%', padding: '8px 12px', marginTop: 8 }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn-sm ${subgroup === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubgroup('all')}>Tất cả</button>
            {subs.map((sg) => (
              <button key={sg} type="button" className={`btn btn-sm ${subgroup === sg ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSubgroup(sg)}>{sg}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Lưới + chi tiết */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>{filtered.length} mục</h2>
        <div className="td-section-body" style={{ ...bodyStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 60%', minWidth: 0 }}>
            {loading ? (
              <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>Đang tải…</p>
            ) : items.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--color-border, #3a3a3a)', borderRadius: 8 }}>
                <div style={{ fontSize: 32 }}>📐</div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Thư viện chưa có bản vẽ.<br />Admin sẽ upload chi tiết điển hình & bản vẽ mẫu sau.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>Không tìm thấy mục khớp.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {filtered.map((it) => {
                  const isSel = selected?.id === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setSelected(it)}
                      style={{
                        textAlign: 'center', padding: 10, borderRadius: 8, cursor: 'pointer',
                        border: isSel ? '2px solid var(--color-accent, #34D399)' : '1px solid var(--color-border, #3a3a3a)',
                        background: isSel ? 'var(--color-accent-soft, rgba(52,211,153,0.10))' : 'transparent',
                      }}
                    >
                      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {it.thumbnail_url ? (
                          <img src={it.thumbnail_url} alt={it.name} style={{ maxHeight: 76, maxWidth: '100%' }} />
                        ) : (
                          <span style={{ fontSize: 30, opacity: 0.4 }}>{it.file_type === 'pdf' ? '📄' : '📐'}</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12, marginTop: 4 }}>{it.name}</div>
                      {it.subgroup && <div className="muted" style={{ fontSize: 11 }}>{it.subgroup}</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chi tiết */}
          <div style={{ flex: '1 1 40%', minWidth: 240, borderLeft: '1px solid var(--color-border-soft, #2a2a2a)', paddingLeft: 14 }}>
            {!selected ? (
              <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>Chọn 1 bản vẽ để xem chi tiết.</p>
            ) : (
              <div>
                {selected.thumbnail_url && (
                  <img src={selected.thumbnail_url} alt={selected.name} style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6 }} />
                )}
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{selected.name}</div>
                <div className="muted small">
                  {selected.subgroup ? `${selected.subgroup} · ` : ''}{(selected.file_type ?? '').toUpperCase()} {fmtSize(selected.size_bytes)}
                </div>
                {selected.description && <p style={{ fontSize: 13, marginTop: 8 }}>{selected.description}</p>}
                {selected.release_notes && (
                  <p style={{ fontSize: 12, marginTop: 6, color: '#34D399' }}>📝 {selected.release_notes}</p>
                )}
                {selected.tags && selected.tags.length > 0 && (
                  <div className="muted small" style={{ marginTop: 6 }}>🏷 {selected.tags.join(', ')}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleDownload(selected)} disabled={!selected.file_url}>⬇ Tải về</button>
                  {selected.block_id && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleInsert(selected)}>✏ Chèn vào AutoCAD</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
