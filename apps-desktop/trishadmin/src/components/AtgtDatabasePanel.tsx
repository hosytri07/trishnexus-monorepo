/**
 * TrishAdmin Phase 43 wave 12.1 — Quản lý database ATGT (Firestore /atgt_blocks).
 *
 * Port từ web admin /admin/atgt-blocks. Admin CRUD danh mục block ATGT
 * (415 tài sản theo database-c41a296c.xlsx) trực tiếp từ TrishAdmin desktop.
 *
 * Schema /atgt_blocks/{id}:
 *   label, fileName (.dwg), category, meaning, shapeKind, orientation,
 *   description, colorIndex, hatchName, defaultScale
 *
 * Features:
 *   - List + filter theo nhóm + search
 *   - Add / Edit / Delete với dialog
 *   - Bulk import Excel database-c41a296c.xlsx (sheet "Database")
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

interface AtgtBlock {
  id: string;
  label: string;
  fileName: string;
  category: string;
  meaning?: string;
  shapeKind?: 'block' | 'linetype';
  orientation?: 'perpendicular' | 'parallel';
  description?: string;
  colorIndex?: number;
  hatchName?: string;
  defaultScale?: number;
  updated_at?: number;
}

const CATEGORY_OPTIONS = [
  'Biển báo', 'Vạch sơn', 'Đèn tín hiệu', 'Hộ lan mềm', 'Cọc tiêu',
  'Rãnh dọc', 'Cống ngang', 'Tiêu phản quang', 'Gương cầu lồi', 'Lí trình', 'Khác',
];

const CATEGORY_COLOR: Record<string, number> = {
  'Biển báo': 1, 'Vạch sơn': 2, 'Đèn tín hiệu': 3, 'Hộ lan mềm': 4,
  'Cọc tiêu': 5, 'Rãnh dọc': 6, 'Cống ngang': 30, 'Tiêu phản quang': 7,
  'Gương cầu lồi': 8, 'Lí trình': 9,
};

const EMPTY: AtgtBlock = {
  id: '', label: '', fileName: '', category: 'Biển báo', meaning: '',
  shapeKind: 'block', orientation: 'perpendicular',
  colorIndex: 7, hatchName: '', defaultScale: 1,
};

export function AtgtDatabasePanel(): JSX.Element {
  const [items, setItems] = useState<AtgtBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<AtgtBlock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [importing, setImporting] = useState(false);

  useEffect(() => { void reload(); }, []);

  async function reload(): Promise<void> {
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, 'atgt_blocks'), orderBy('label'), limit(1000)));
      setItems(snap.docs.map((d) => d.data() as AtgtBlock));
    } catch (err) {
      setToast(`✗ Load fail: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  async function handleSave(b: AtgtBlock): Promise<void> {
    if (!b.id || !b.label || !b.fileName) {
      setToast('✗ ID + Label + Tên file bắt buộc');
      return;
    }
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'atgt_blocks', b.id), { ...b, updated_at: Date.now() }, { merge: true });
      setToast(`✅ Lưu ${b.label}`);
      setEditing(null); setShowAdd(false);
      await reload();
    } catch (err) {
      setToast(`✗ Lưu fail: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete(b: AtgtBlock): Promise<void> {
    if (!window.confirm(`Xóa "${b.label}" (${b.fileName})?`)) return;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'atgt_blocks', b.id));
      setToast(`🗑 Đã xóa ${b.label}`);
      await reload();
    } catch (err) {
      setToast(`✗ Xóa fail: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleBulkImport(): Promise<void> {
    // Đơn giản: hỏi user paste TSV/CSV (vd export sheet "Database" từ Excel)
    const text = window.prompt(
      'Paste TSV/CSV với cột: STT | Tên file | Dạng địa vật | Tên địa vật | Ý nghĩa | Hướng | Loại tài sản | Ghi chú\n\n(Export sheet "Database" từ Excel rồi paste)',
    );
    if (!text || !text.trim()) return;
    setImporting(true);
    try {
      const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
      const parsed: AtgtBlock[] = [];
      for (const ln of lines) {
        const parts = ln.split(/\t|,/).map((p) => p.trim());
        // Skip header
        if (/STT|stt|Tên file/.test(parts.slice(0, 2).join(' '))) continue;
        const tenFile = parts[1] ?? '';
        if (!tenFile) continue;
        const id = tenFile.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (!id) continue;
        const dang = parts[2] ?? '';
        const tenDiaVat = parts[3] ?? '';
        const yNghia = parts[4] ?? '';
        const huong = parts[5] ?? '';
        const loai = parts[6] ?? 'Khác';
        const ghiChu = parts[7] ?? '';
        parsed.push({
          id,
          fileName: tenFile.toLowerCase().endsWith('.dwg') ? tenFile : `${tenFile}.dwg`,
          label: tenDiaVat,
          meaning: yNghia,
          shapeKind: /linetype/i.test(dang) ? 'linetype' : 'block',
          orientation: /song/i.test(huong) ? 'parallel' : 'perpendicular',
          category: loai,
          description: ghiChu,
          colorIndex: CATEGORY_COLOR[loai] ?? 7,
          defaultScale: 1,
        });
      }
      if (parsed.length === 0) {
        setToast('✗ Không parse được dòng nào');
        setImporting(false);
        return;
      }
      if (!window.confirm(`Import ${parsed.length} block vào Firestore (overwrite nếu trùng ID)?`)) {
        setImporting(false);
        return;
      }
      const db = getFirebaseDb();
      let written = 0;
      // Batch 400 docs (Firestore limit 500)
      for (let i = 0; i < parsed.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = parsed.slice(i, i + 400);
        for (const b of chunk) {
          batch.set(doc(db, 'atgt_blocks', b.id), { ...b, updated_at: Date.now() }, { merge: true });
        }
        await batch.commit();
        written += chunk.length;
        setToast(`⏳ Đã import ${written}/${parsed.length}...`);
      }
      setToast(`✅ Import xong ${written} block`);
      await reload();
    } catch (err) {
      setToast(`✗ Import fail: ${err instanceof Error ? err.message : String(err)}`);
    }
    setImporting(false);
  }

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORY_OPTIONS);
    items.forEach((it) => { if (it.category) set.add(it.category); });
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterCategory !== 'all' && it.category !== filterCategory) return false;
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        return (
          it.label.toLowerCase().includes(q) ||
          it.fileName.toLowerCase().includes(q) ||
          (it.meaning ?? '').toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filterCategory, searchText]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="ts-app" style={{ padding: 24, maxWidth: 1400 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🗂 ATGT Database — Quản lý 9 loại tài sản</h1>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => { setEditing({ ...EMPTY }); setShowAdd(true); }} style={btnPrimary}>+ Thêm block</button>
        <button type="button" onClick={() => void handleBulkImport()} style={btnGhost} disabled={importing}>📥 Bulk import (paste TSV)</button>
        <button type="button" onClick={() => void reload()} style={btnGhost} disabled={loading}>🔄 Reload</button>
      </header>

      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
        Schema: <code>label</code>, <code>fileName</code> (.dwg), <code>category</code>, <code>meaning</code>,
        {' '}<code>shapeKind</code>, <code>orientation</code>, <code>colorIndex</code>, <code>defaultScale</code>.
        {' '}TrishDesign user fetch dropdown từ Firestore này.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input}>
          <option value="all">Tất cả nhóm ({items.length})</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="🔎 Tìm theo tên / file / mô tả..."
          value={searchText} onChange={(e) => setSearchText(e.target.value)}
          style={{ ...input, minWidth: 280, flex: 1 }} />
        <span style={{ color: '#6b7280', fontSize: 13 }}>Hiển thị: <strong>{filtered.length}</strong></span>
      </div>

      {loading ? <p>Đang tải...</p>
        : filtered.length === 0 ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: 16, borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13 }}>⚠ Database rỗng. Bấm "📥 Bulk import" để load 415 block từ Excel database-c41a296c.xlsx.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', maxHeight: 'calc(100vh - 240px)' }}>
            <table style={tableStyle}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Label</th>
                  <th style={thStyle}>File</th>
                  <th style={thStyle}>Nhóm</th>
                  <th style={thStyle}>Ý nghĩa</th>
                  <th style={thStyle}>Dạng</th>
                  <th style={thStyle}>Hướng</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td style={tdStyle}><code style={{ fontSize: 11 }}>{b.id}</code></td>
                    <td style={tdStyle}><strong>{b.label}</strong></td>
                    <td style={tdStyle}><code style={{ fontSize: 11 }}>{b.fileName}</code></td>
                    <td style={tdStyle}>{b.category}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{b.meaning ?? '—'}</td>
                    <td style={tdStyle}>{b.shapeKind === 'linetype' ? '〰 LT' : '⬜ Block'}</td>
                    <td style={tdStyle}>{b.orientation === 'parallel' ? '↔' : '⊥'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => setEditing(b)} style={btnMini}>✏</button>
                      <button type="button" onClick={() => void handleDelete(b)} style={{ ...btnMini, color: '#dc2626' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {editing && (
        <EditDialog
          value={editing}
          isNew={showAdd}
          categories={categories}
          onSave={(v) => void handleSave(v)}
          onCancel={() => { setEditing(null); setShowAdd(false); }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          padding: '10px 16px', borderRadius: 8,
          background: toast.startsWith('✗') ? '#dc2626' : toast.startsWith('⏳') ? '#f59e0b' : '#10b981',
          color: '#fff', fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: 500,
        }}>{toast}</div>
      )}
    </div>
  );
}

function EditDialog({ value, isNew, categories, onSave, onCancel }: {
  value: AtgtBlock; isNew: boolean; categories: string[];
  onSave: (v: AtgtBlock) => void; onCancel: () => void;
}): JSX.Element {
  const [v, setV] = useState<AtgtBlock>(value);
  function patch(p: Partial<AtgtBlock>): void { setV((cur) => ({ ...cur, ...p })); }
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', padding: 24, borderRadius: 12,
        minWidth: 560, maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isNew ? '➕ Thêm block' : `✏ Sửa: ${value.label}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="ID (slug)">
            <input style={input} value={v.id} disabled={!isNew}
              placeholder="bb_w210"
              onChange={(e) => patch({ id: e.target.value.toLowerCase().replace(/[^a-z0-9._-]+/g, '_') })} />
          </Field>
          <Field label="Nhóm">
            <input list="cat-list" style={input} value={v.category}
              onChange={(e) => patch({ category: e.target.value })} />
            <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Tên hiển thị (label)">
            <input style={input} value={v.label}
              onChange={(e) => patch({ label: e.target.value })} />
          </Field>
          <Field label="Tên file .dwg">
            <input style={input} value={v.fileName}
              onChange={(e) => patch({ fileName: e.target.value })} />
          </Field>
          <Field label="Dạng">
            <select style={input} value={v.shapeKind ?? 'block'}
              onChange={(e) => patch({ shapeKind: e.target.value as 'block' | 'linetype' })}>
              <option value="block">⬜ Block (INSERT)</option>
              <option value="linetype">〰 Linetype (PLINE)</option>
            </select>
          </Field>
          <Field label="Hướng">
            <select style={input} value={v.orientation ?? 'perpendicular'}
              onChange={(e) => patch({ orientation: e.target.value as 'perpendicular' | 'parallel' })}>
              <option value="perpendicular">⊥ Vuông góc</option>
              <option value="parallel">↔ Song song</option>
            </select>
          </Field>
          <Field label="Ý nghĩa">
            <input style={input} value={v.meaning ?? ''}
              onChange={(e) => patch({ meaning: e.target.value })} />
          </Field>
          <Field label="Màu ACI">
            <input type="number" min={1} max={255} style={input} value={v.colorIndex ?? 7}
              onChange={(e) => patch({ colorIndex: Number(e.target.value) || 7 })} />
          </Field>
          <Field label="Tỷ lệ scale">
            <input type="number" step={0.1} style={input} value={v.defaultScale ?? 1}
              onChange={(e) => patch({ defaultScale: Number(e.target.value) || 1 })} />
          </Field>
          <Field label="Hatch (tùy chọn)">
            <input style={input} value={v.hatchName ?? ''}
              onChange={(e) => patch({ hatchName: e.target.value })} />
          </Field>
          <Field label="Mô tả thêm" wide>
            <input style={input} value={v.description ?? ''}
              onChange={(e) => patch({ description: e.target.value })} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Hủy</button>
          <button type="button" onClick={() => onSave(v)} style={btnPrimary}>💾 Lưu</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: wide ? 'span 2' : 'auto' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 5,
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', background: '#10b981', color: '#fff',
  border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 12px', background: 'transparent', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, cursor: 'pointer',
};
const btnMini: React.CSSProperties = {
  padding: '3px 8px', background: 'transparent', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, cursor: 'pointer', marginLeft: 3,
};
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb', fontWeight: 600, fontSize: 12, color: '#374151',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 10px', borderBottom: '1px solid #e5e7eb',
};
