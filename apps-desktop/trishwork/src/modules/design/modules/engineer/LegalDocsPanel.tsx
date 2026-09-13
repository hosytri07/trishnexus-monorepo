/**
 * LegalDocsPanel — Thông tư · Văn bản mới.
 *
 * Liệt kê văn bản/quyết định/nghị định/tiêu chuẩn/quy chuẩn admin upload
 * (Firestore collection `legal_docs`, realtime). Lọc theo loại + tìm kiếm,
 * click → mở link tải file. Văn bản thêm gần đây có badge "MỚI".
 */

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

export type LegalCategory =
  | 'thongtu' | 'nghidinh' | 'quyetdinh' | 'tieuchuan' | 'quychuan' | 'vanban';

export const LEGAL_CATEGORIES: { id: LegalCategory; label: string; icon: string }[] = [
  { id: 'thongtu', label: 'Thông tư', icon: '📋' },
  { id: 'nghidinh', label: 'Nghị định', icon: '📑' },
  { id: 'quyetdinh', label: 'Quyết định', icon: '📜' },
  { id: 'tieuchuan', label: 'Tiêu chuẩn (TCVN)', icon: '📐' },
  { id: 'quychuan', label: 'Quy chuẩn (QCVN)', icon: '📏' },
  { id: 'vanban', label: 'Văn bản khác', icon: '📄' },
];

export interface LegalDoc {
  id: string;
  title?: string;
  doc_number?: string;        // số hiệu, vd "41/2024/TT-BGTVT"
  category?: LegalCategory;
  issuing_body?: string;      // cơ quan ban hành
  issue_date?: string;        // ngày ban hành (text, admin nhập)
  summary?: string;
  file_url?: string;
  tags?: string[];
  created_at?: number;        // epoch ms — để sort + badge MỚI
}

const NEW_DAYS = 30;

function catMeta(id?: LegalCategory) {
  return LEGAL_CATEGORIES.find((c) => c.id === id);
}

export function LegalDocsPanel(): JSX.Element {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<LegalCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    try {
      const qy = query(collection(getFirebaseDb(), 'legal_docs'), orderBy('created_at', 'desc'));
      unsub = onSnapshot(
        qy,
        (snap) => { setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LegalDoc, 'id'>) }))); setLoading(false); },
        () => setLoading(false),
      );
    } catch { setLoading(false); }
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (cat !== 'all' && d.category !== cat) return false;
      if (!s) return true;
      return (
        (d.title ?? '').toLowerCase().includes(s) ||
        (d.doc_number ?? '').toLowerCase().includes(s) ||
        (d.issuing_body ?? '').toLowerCase().includes(s) ||
        (d.tags ?? []).join(' ').toLowerCase().includes(s)
      );
    });
  }, [docs, cat, q]);

  function showFlash(m: string): void { setFlash(m); setTimeout(() => setFlash(null), 2500); }

  async function openDoc(d: LegalDoc): Promise<void> {
    if (!d.file_url) { showFlash('Văn bản này chưa có link tải.'); return; }
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(d.file_url);
    } catch { window.open(d.file_url, '_blank'); }
  }

  const isNew = (d: LegalDoc): boolean =>
    !!d.created_at && Date.now() - d.created_at < NEW_DAYS * 86_400_000;

  const sectionStyle: CSSProperties = { marginBottom: 12 };
  const bodyStyle: CSSProperties = { padding: '10px 14px' };

  return (
    <div className="td-panel">
      <header className="td-panel-head" style={{ paddingBottom: 8 }}>
        <h1 style={{ marginBottom: 4 }}>📋 Thông tư · Văn bản mới</h1>
        <p className="td-lead" style={{ fontSize: 12, marginBottom: 0 }}>
          Văn bản, quyết định, tiêu chuẩn, quy chuẩn mới ban hành — bấm để tải về.
        </p>
        {flash && <span className="td-saved-flash">{flash}</span>}
      </header>

      <section className="td-section" style={sectionStyle}>
        <div className="td-section-body" style={bodyStyle}>
          <input
            className="td-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Tìm theo tên, số hiệu, cơ quan…"
            style={{ width: '100%', padding: '8px 12px' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className={`btn btn-sm ${cat === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCat('all')}>Tất cả</button>
            {LEGAL_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={`btn btn-sm ${cat === c.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCat(c.id)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="td-section" style={sectionStyle}>
        <h2 className="td-section-title" style={{ fontSize: 13 }}>{filtered.length} văn bản</h2>
        <div className="td-section-body" style={{ padding: docs.length ? 0 : '10px 14px' }}>
          {loading ? (
            <p className="muted small" style={{ textAlign: 'center', margin: 0, padding: 20 }}>Đang tải…</p>
          ) : docs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--color-border, #3a3a3a)', borderRadius: 8 }}>
              <div style={{ fontSize: 32 }}>📋</div>
              <p className="muted" style={{ marginTop: 8 }}>Chưa có văn bản nào. Admin sẽ cập nhật sau.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="muted small" style={{ textAlign: 'center', padding: 20 }}>Không tìm thấy.</p>
          ) : (
            <div className="atgt-table-wrap" style={{ maxHeight: 520 }}>
              <table className="atgt-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Loại</th>
                    <th>Tên / Số hiệu</th>
                    <th style={{ width: 180 }}>Cơ quan</th>
                    <th style={{ width: 110 }}>Ngày</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} style={{ cursor: d.file_url ? 'pointer' : 'default' }} onClick={() => void openDoc(d)}>
                      <td>{catMeta(d.category)?.icon} {catMeta(d.category)?.label ?? ''}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {d.title}
                          {isNew(d) && <span style={{ marginLeft: 6, fontSize: 9.5, padding: '1px 6px', borderRadius: 8, background: '#34D399', color: '#062b1e', fontWeight: 700 }}>MỚI</span>}
                        </div>
                        {d.doc_number && <div className="muted small">{d.doc_number}</div>}
                        {d.summary && <div className="muted small" style={{ marginTop: 2 }}>{d.summary}</div>}
                      </td>
                      <td className="muted small">{d.issuing_body ?? ''}</td>
                      <td className="muted small">{d.issue_date ?? ''}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-ghost" disabled={!d.file_url}
                          onClick={(e) => { e.stopPropagation(); void openDoc(d); }}>⬇ Tải</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
