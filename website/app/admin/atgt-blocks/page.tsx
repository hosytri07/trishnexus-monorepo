'use client';

/**
 * /admin/atgt-blocks — Phase 42 wave 8.3.
 *
 * Quản lý DANH MỤC BLOCK ATGT (Firestore /atgt_blocks/{id}).
 * Trí thêm dần các block .dwg (Biển báo, Cọc tiêu, Vạch sơn, Đèn THP, ...) → TrishDesign fetch về.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';
import { Plus, Edit2, Trash2, RefreshCw, Shapes } from 'lucide-react';

/**
 * Schema /atgt_blocks/{id}
 *   id          → cũng là docId
 *   label       → tên hiển thị tiếng Việt (vd "Biển báo W210")
 *   fileName    → tên file .dwg (vd "W210.dwg")
 *   category    → free-form (vd "Biển báo", "Cọc tiêu", "Vạch sơn", "Đèn THP", "Hộ lan", "Cống ngang"...)
 *   description → mô tả thêm
 *   colorIndex  → AutoCAD ACI color (1..255), default 7 (white/black)
 *   hatchName   → AutoCAD hatch pattern (optional, vd "SOLID")
 *   defaultScale → tỷ lệ scale block insert mặc định (default 1)
 *   updated_at  → ms epoch
 */
interface AtgtBlock {
  id: string;
  label: string;
  fileName: string;
  category: string;
  /** Phase 42 wave 9 — Ý nghĩa tài sản */
  meaning?: string;
  /** Phase 42 wave 9 — Dạng địa vật */
  shapeKind?: 'block' | 'linetype';
  /** Phase 42 wave 9 — Hướng so với tim tuyến */
  orientation?: 'perpendicular' | 'parallel';
  description?: string;
  colorIndex?: number;
  hatchName?: string;
  defaultScale?: number;
  updated_at?: number;
}

const CATEGORY_SUGGESTIONS = [
  'Biển báo',
  'Cọc tiêu',
  'Vạch sơn',
  'Đèn tín hiệu',
  'Hộ lan',
  'Cống ngang',
  'Rãnh dọc',
  'Gương cầu',
  'Tiêu phản quang',
  'Khác',
];

const EMPTY: AtgtBlock = {
  id: '',
  label: '',
  fileName: '',
  category: 'Biển báo',
  meaning: '',
  shapeKind: 'block',
  orientation: 'perpendicular',
  description: '',
  colorIndex: 7,
  hatchName: '',
  defaultScale: 1,
};

export default function AdminAtgtBlocksPage() {
  const [items, setItems] = useState<AtgtBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<AtgtBlock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const db = requireDb();
      const snap = await getDocs(query(collection(db, 'atgt_blocks'), orderBy('updated_at', 'desc'), limit(500)));
      setItems(snap.docs.map((d) => d.data() as AtgtBlock));
    } catch (err) {
      setToast({ msg: `Load fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
    setLoading(false);
  }

  async function handleSave(b: AtgtBlock) {
    if (!b.id || !b.label || !b.fileName) {
      setToast({ msg: 'ID + Label + Tên file .dwg là bắt buộc', kind: 'err' });
      return;
    }
    try {
      const db = requireDb();
      await setDoc(doc(db, 'atgt_blocks', b.id), { ...b, updated_at: Date.now() }, { merge: true });
      setToast({ msg: `✅ Lưu ${b.label}`, kind: 'ok' });
      setEditing(null); setShowAdd(false);
      await reload();
    } catch (err) {
      setToast({ msg: `Lưu fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  async function handleDelete(b: AtgtBlock) {
    if (!window.confirm(`Xóa "${b.label}" (${b.fileName})?`)) return;
    try {
      const db = requireDb();
      await deleteDoc(doc(db, 'atgt_blocks', b.id));
      setToast({ msg: `🗑 Đã xóa ${b.label}`, kind: 'ok' });
      await reload();
    } catch (err) {
      setToast({ msg: `Xóa fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORY_SUGGESTIONS);
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
          (it.description ?? '').toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filterCategory, searchText]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Shapes size={28} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🚸 Danh mục Block ATGT</h1>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => { setEditing({ ...EMPTY, id: '' }); setShowAdd(true); }}
          style={btnPrimary}
        >
          <Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Thêm block
        </button>
        <button type="button" onClick={() => void reload()} style={btnGhost} disabled={loading}>
          <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Reload
        </button>
      </header>

      <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
        Quản lý danh mục block <strong>.dwg</strong> dùng trong TrishDesign — module <strong>Vẽ hiện trạng ATGT</strong>.
        TrishDesign sẽ load danh sách này từ Firestore làm dropdown nhập liệu.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="all">Tất cả nhóm ({items.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="🔎 Tìm theo tên / file / mô tả..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ ...inputStyle, minWidth: 280, flex: 1 }}
        />
        <span style={{ color: '#6b7280', fontSize: 13 }}>Hiển thị: <strong>{filtered.length}</strong></span>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Chưa có block nào. Bấm "+ Thêm block" để thêm.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Tên hiển thị</th>
                <th style={thStyle}>Tên file</th>
                <th style={thStyle}>Nhóm</th>
                <th style={thStyle}>Ý nghĩa</th>
                <th style={thStyle}>Dạng</th>
                <th style={thStyle}>Hướng</th>
                <th style={thStyle}>Màu/Scale</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td style={tdStyle}><code>{b.id}</code></td>
                  <td style={tdStyle}><strong>{b.label}</strong></td>
                  <td style={tdStyle}><code>{b.fileName}</code></td>
                  <td style={tdStyle}>{b.category}</td>
                  <td style={{ ...tdStyle, color: '#374151', fontSize: 13 }}>{b.meaning ?? '—'}</td>
                  <td style={tdStyle}>{b.shapeKind === 'linetype' ? '〰 Linetype' : '⬜ Block'}</td>
                  <td style={tdStyle}>{b.orientation === 'parallel' ? '↔ Song song' : '⊥ Vuông góc'}</td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#6b7280' }}>ACI {b.colorIndex ?? 7} · ×{b.defaultScale ?? 1}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => setEditing(b)} style={btnGhost}>
                      <Edit2 size={14} />
                    </button>
                    <button type="button" onClick={() => void handleDelete(b)} style={{ ...btnGhost, color: '#dc2626' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editing || showAdd) && editing && (
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
          background: toast.kind === 'ok' ? '#10b981' : '#dc2626',
          color: '#fff', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function EditDialog({
  value, isNew, categories, onSave, onCancel,
}: {
  value: AtgtBlock;
  isNew: boolean;
  categories: string[];
  onSave: (v: AtgtBlock) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<AtgtBlock>(value);

  function patch(p: Partial<AtgtBlock>): void { setV((cur) => ({ ...cur, ...p })); }

  function autoFileName(): string {
    // Suggest fileName từ id nếu chưa có
    if (v.fileName) return v.fileName;
    if (!v.id) return '';
    return `${v.id}.dwg`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', padding: 24, borderRadius: 12,
        minWidth: 560, maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16 }}>{isNew ? '➕ Thêm block ATGT' : `✏ Sửa: ${value.label}`}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="ID (slug)">
            <input style={inputStyle} value={v.id} disabled={!isNew}
              placeholder="bien_bao_w210"
              onChange={(e) => patch({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, '_') })} />
          </Field>
          <Field label="Nhóm">
            <input list="atgt-cat-list" style={inputStyle} value={v.category}
              onChange={(e) => patch({ category: e.target.value })} />
            <datalist id="atgt-cat-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>

          <Field label="Tên hiển thị (tiếng Việt)">
            <input style={inputStyle} value={v.label}
              placeholder="Biển báo W210 — Giao nhau với đường ưu tiên"
              onChange={(e) => patch({ label: e.target.value })} />
          </Field>
          <Field label="Tên file .dwg">
            <input style={inputStyle} value={v.fileName || autoFileName()}
              placeholder="W210.dwg"
              onChange={(e) => patch({ fileName: e.target.value })} />
          </Field>

          <Field label="Dạng địa vật" hint="Block = INSERT 1 điểm. Linetype = chạy dọc tuyến">
            <select style={inputStyle} value={v.shapeKind ?? 'block'}
              onChange={(e) => patch({ shapeKind: e.target.value as 'block' | 'linetype' })}>
              <option value="block">⬜ Block (INSERT)</option>
              <option value="linetype">〰 Linetype (PLINE)</option>
            </select>
          </Field>
          <Field label="Hướng với tim tuyến" hint="Vuông góc = block đứng chéo tim. Song song = chạy dọc tim">
            <select style={inputStyle} value={v.orientation ?? 'perpendicular'}
              onChange={(e) => patch({ orientation: e.target.value as 'perpendicular' | 'parallel' })}>
              <option value="perpendicular">⊥ Vuông góc</option>
              <option value="parallel">↔ Song song</option>
            </select>
          </Field>

          <Field label="Ý nghĩa tài sản" hint="VD: Đường cấm, Cấm đi ngược chiều, Nguy hiểm giao nhau...">
            <input style={inputStyle} value={v.meaning ?? ''}
              onChange={(e) => patch({ meaning: e.target.value })} />
          </Field>
          <Field label="Màu ACI (AutoCAD)" hint="1=đỏ, 2=vàng, 3=xanh lá, 5=xanh lam, 7=trắng/đen">
            <input type="number" min={1} max={255} style={inputStyle} value={v.colorIndex ?? 7}
              onChange={(e) => patch({ colorIndex: Number(e.target.value) || 7 })} />
          </Field>

          <Field label="Tỷ lệ scale block">
            <input type="number" step={0.1} min={0.01} style={inputStyle} value={v.defaultScale ?? 1}
              onChange={(e) => patch({ defaultScale: Number(e.target.value) || 1 })} />
          </Field>

          <Field label="Hatch pattern (tùy chọn)" wide>
            <input style={inputStyle} value={v.hatchName ?? ''}
              placeholder="SOLID, ANSI31, EARTH... (để trống nếu không hatch)"
              onChange={(e) => patch({ hatchName: e.target.value })} />
          </Field>

          <Field label="Mô tả thêm" wide>
            <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={v.description ?? ''}
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

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: wide ? 'span 2' : 'auto' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#6b7280' }}>{hint}</span>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#10b981',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
  marginLeft: 4,
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb',
  fontWeight: 600,
  fontSize: 13,
  color: '#374151',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #e5e7eb',
};
