/**
 * SignRefPanel — Tra cứu Biển báo · Vạch sơn theo QCVN 41:2024.
 *
 * UI scaffold: filter theo nhóm + tìm kiếm + lưới thẻ + panel chi tiết +
 * nút "Chèn vào AutoCAD" (nối acad_com khi đã map block). Dữ liệu lấy từ
 * `sign-catalog.ts` (hiện rỗng — Trí nhồi sau).
 */

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  SIGN_CATALOG,
  SIGN_GROUPS,
  type SignGroup,
  type SignItem,
} from './sign-catalog.js';

function isInTauri(): boolean {
  return typeof window !== 'undefined' &&
    // @ts-expect-error tauri internal
    typeof window.__TAURI_INTERNALS__ !== 'undefined';
}

export function SignRefPanel(): JSX.Element {
  const [group, setGroup] = useState<SignGroup | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SignItem | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const sectionStyle: CSSProperties = { marginBottom: 12 };
  const bodyStyle: CSSProperties = { padding: '10px 14px' };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SIGN_CATALOG.filter((it) => {
      if (group !== 'all' && it.group !== group) return false;
      if (!q) return true;
      return (
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.keywords ?? '').toLowerCase().includes(q) ||
        (it.meaning ?? '').toLowerCase().includes(q)
      );
    });
  }, [group, query]);

  function showFlash(m: string): void {
    setFlash(m);
    setTimeout(() => setFlash(null), 2500);
  }

  async function handleInsertToCad(item: SignItem): Promise<void> {
    if (!isInTauri()) {
      showFlash('Chèn AutoCAD chỉ chạy trong app desktop.');
      return;
    }
    if (!item.block_id) {
      showFlash(`Biển ${item.code} chưa map block AutoCAD — sẽ bổ sung khi có thư viện block.`);
      return;
    }
    try {
      // TODO: nối thực sự khi đã map block_id → file block ATGT.
      await invoke('autocad_check_running');
      showFlash(`(Demo) Sẽ chèn block "${item.block_id}" cho ${item.code} vào AutoCAD.`);
    } catch (e) {
      showFlash(`✗ ${String(e)}`);
    }
  }

  return (
    <div className="td-panel">
      <header className="td-panel-head" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 4 }}>🚸 Tra cứu Biển báo · Vạch sơn (QCVN 41:2024)</h1>
        <p className="td-lead" style={{ fontSize: 12, marginBottom: 0 }}>
          Tra mã, ý nghĩa, kích thước theo cấp đường, thay đổi so với 41:2019 — và chèn thẳng vào AutoCAD.
        </p>
        {flash && <span className="td-saved-flash">{flash}</span>}
      </header>

      {/* Bộ lọc + tìm kiếm */}
      <section className="td-section" style={sectionStyle}>
        <div className="td-section-body" style={bodyStyle}>
          <input
            className="td-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Tìm theo mã (P.101…), tên biển, từ khoá…"
            style={{ width: '100%', padding: '8px 12px' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${group === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setGroup('all')}
            >
              Tất cả
            </button>
            {SIGN_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`btn btn-sm ${group === g.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setGroup(g.id)}
              >
                {g.icon} {g.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Lưới + chi tiết */}
      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>
          Kết quả — {filtered.length} mục
        </h2>
        <div className="td-section-body" style={{ ...bodyStyle, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* Lưới thẻ */}
          <div style={{ flex: '1 1 60%', minWidth: 0 }}>
            {SIGN_CATALOG.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--color-border, #3a3a3a)', borderRadius: 8 }}>
                <div style={{ fontSize: 32 }}>📋</div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Chưa có dữ liệu biển báo / vạch sơn.<br />
                  Dữ liệu (ảnh + bảng kích thước) sẽ được nạp sau.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>
                Không tìm thấy mục khớp.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {filtered.map((it) => {
                  const isSel = selected?.code === it.code;
                  return (
                    <button
                      key={it.code}
                      type="button"
                      onClick={() => setSelected(it)}
                      style={{
                        textAlign: 'center',
                        padding: 10,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: isSel ? '2px solid var(--color-accent, #34D399)' : '1px solid var(--color-border, #3a3a3a)',
                        background: isSel ? 'var(--color-accent-soft, rgba(52,211,153,0.10))' : 'transparent',
                      }}
                    >
                      <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {it.image_url || it.image_base64 ? (
                          <img src={it.image_url || it.image_base64} alt={it.code} style={{ maxHeight: 64, maxWidth: '100%' }} />
                        ) : (
                          <span style={{ fontSize: 28, opacity: 0.4 }}>🚸</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 12, marginTop: 4 }}>{it.code}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{it.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chi tiết */}
          <div style={{ flex: '1 1 40%', minWidth: 240, borderLeft: '1px solid var(--color-border-soft, #2a2a2a)', paddingLeft: 14 }}>
            {!selected ? (
              <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>
                Chọn 1 biển/vạch để xem chi tiết.
              </p>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {(selected.image_url || selected.image_base64) && (
                    <img src={selected.image_url || selected.image_base64} alt={selected.code} style={{ maxHeight: 80 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.code}</div>
                    <div className="muted">{selected.name}</div>
                  </div>
                </div>

                {selected.meaning && (
                  <p style={{ marginTop: 10, fontSize: 13 }}><strong>Ý nghĩa:</strong> {selected.meaning}</p>
                )}
                {selected.effect && (
                  <p style={{ fontSize: 13 }}><strong>Tác dụng / cách đặt:</strong> {selected.effect}</p>
                )}

                {selected.dims && selected.dims.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong style={{ fontSize: 12 }}>Kích thước theo cấp đường:</strong>
                    <table className="atgt-table" style={{ marginTop: 4, fontSize: 12 }}>
                      <thead><tr><th>Điều kiện</th><th>Kích thước</th><th>Ghi chú</th></tr></thead>
                      <tbody>
                        {selected.dims.map((d, i) => (
                          <tr key={i}><td>{d.condition}</td><td>{d.size}</td><td>{d.note ?? ''}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selected.changes && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#e0a458' }}>
                    <strong>Thay đổi so với 41:2019:</strong> {selected.changes}
                  </p>
                )}
                {selected.qc_ref && (
                  <p className="muted small" style={{ marginTop: 6 }}>📖 {selected.qc_ref}</p>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleInsertToCad(selected)}>
                    ✏ Chèn vào AutoCAD
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void navigator.clipboard.writeText(selected.code); showFlash('Đã copy mã'); }}>
                    📋 Copy mã
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
