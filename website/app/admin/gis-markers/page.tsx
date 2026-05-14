/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * /admin/gis-markers — Phase 42.
 *
 * Quản lý danh mục mốc tọa độ TrishDesign GIS-MAP:
 *   - Mốc đường chuyền các cấp (I, II, III, IV)
 *   - Mốc đường chuyền giả định
 *   - Biển báo, cọc H, Km
 *
 * Filter theo Tỉnh + Quốc lộ.
 */

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';
import { MapPin, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';

type MarkerType = 'duong_chuyen_1' | 'duong_chuyen_2' | 'duong_chuyen_3' | 'duong_chuyen_gd' | 'bien_bao' | 'coc_h' | 'km';

interface GisMarker {
  id: string;
  type: MarkerType;
  name: string;       // VD "Mốc HC.II.012"
  province: string;   // VD "Đà Nẵng"
  route?: string;     // VD "QL14B"
  station_m?: number; // Lý trình (m) — vd 12500 = Km12+500
  x: number;          // VN2000 X
  y: number;          // VN2000 Y
  z?: number;         // Cao độ (m)
  note?: string;
}

const TYPE_LABEL: Record<MarkerType, string> = {
  duong_chuyen_1: 'Mốc đường chuyền I',
  duong_chuyen_2: 'Mốc đường chuyền II',
  duong_chuyen_3: 'Mốc đường chuyền III',
  duong_chuyen_gd: 'Mốc giả định',
  bien_bao: 'Biển báo',
  coc_h: 'Cọc H',
  km: 'Cọc Km',
};

const PROVINCES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Bình Thuận', 'Đồng Nai', 'Lâm Đồng'];

const EMPTY: GisMarker = { id: '', type: 'duong_chuyen_2', name: '', province: 'Đà Nẵng', x: 0, y: 0 };

export default function AdminGisMarkersPage() {
  const [items, setItems] = useState<GisMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterRoute, setFilterRoute] = useState<string>('');
  const [filterType, setFilterType] = useState<MarkerType | 'all'>('all');
  const [editing, setEditing] = useState<GisMarker | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const db = requireDb();
      const snap = await getDocs(query(collection(db, 'gis_markers'), limit(500)));
      setItems(snap.docs.map((d) => d.data() as GisMarker));
    } catch (err) {
      setToast({ msg: `Load fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
    setLoading(false);
  }

  async function handleSave(m: GisMarker) {
    if (!m.id || !m.name) { setToast({ msg: 'ID + Tên bắt buộc', kind: 'err' }); return; }
    try {
      const db = requireDb();
      await setDoc(doc(db, 'gis_markers', m.id), { ...m, updated_at: Date.now() }, { merge: true });
      setToast({ msg: `✅ Lưu ${m.name}`, kind: 'ok' });
      setEditing(null); setShowAdd(false);
      await reload();
    } catch (err) {
      setToast({ msg: `Lưu fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  async function handleDelete(m: GisMarker) {
    if (!window.confirm(`Xóa "${m.name}"?`)) return;
    try {
      const db = requireDb();
      await deleteDoc(doc(db, 'gis_markers', m.id));
      setToast({ msg: `🗑 Đã xóa`, kind: 'ok' });
      await reload();
    } catch (err) {
      setToast({ msg: `Xóa fail: ${err}`, kind: 'err' });
    }
  }

  const filtered = items.filter((m) => {
    if (filterProvince !== 'all' && m.province !== filterProvince) return false;
    if (filterRoute && !(m.route ?? '').toLowerCase().includes(filterRoute.toLowerCase())) return false;
    if (filterType !== 'all' && m.type !== filterType) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">GIS Markers — Mốc tọa độ</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Danh mục tọa độ TrishDesign cho user truy cập. Mốc đường chuyền các cấp, mốc giả định, biển báo, cọc Km/H.
            Lưu Firestore <code className="text-xs bg-zinc-900 px-1.5 py-0.5 rounded">/gis_markers</code>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => { setEditing({ ...EMPTY, id: `marker_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }); setShowAdd(true); }}
          className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Thêm mốc
        </button>
        <button onClick={() => void reload()} className="px-4 py-2 rounded-lg border border-zinc-800 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <select value={filterProvince} onChange={(e) => setFilterProvince(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
          <option value="all">Tất cả tỉnh ({items.length})</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="text" placeholder="Quốc lộ (vd QL14B)" value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-sm" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as MarkerType | 'all')}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
          <option value="all">Tất cả loại</option>
          {(Object.keys(TYPE_LABEL) as MarkerType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <span className="text-xs text-zinc-500">{filtered.length}/{items.length}</span>
      </div>

      {toast && (
        <div onClick={() => setToast(null)}
          className={`px-4 py-2 rounded-lg cursor-pointer text-sm ${toast.kind === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Loại</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Tên</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Tỉnh</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">QL</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Lý trình</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">X (VN2000)</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Y (VN2000)</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Z</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-zinc-400">Ghi chú</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="text-center py-8 text-zinc-500">⏳</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-zinc-500">Chưa có mốc nào. Bấm "Thêm mốc".</td></tr>
            )}
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-zinc-800/50 hover:bg-zinc-900">
                <td className="px-3 py-2 text-xs">{TYPE_LABEL[m.type]}</td>
                <td className="px-3 py-2 font-semibold">{m.name}</td>
                <td className="px-3 py-2">{m.province}</td>
                <td className="px-3 py-2 text-xs">{m.route ?? '—'}</td>
                <td className="px-3 py-2 text-xs">{m.station_m != null ? `Km${Math.floor(m.station_m / 1000)}+${(m.station_m % 1000).toString().padStart(3, '0')}` : '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.x.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.y.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs">{m.z?.toFixed(2) ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-zinc-400 max-w-[200px] truncate">{m.note ?? '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => setEditing(m)} className="text-xs px-2 py-1 rounded bg-zinc-800 mr-1"><Edit2 className="w-3 h-3 inline" /></button>
                  <button onClick={() => void handleDelete(m)} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400"><Trash2 className="w-3 h-3 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <MarkerForm marker={editing} isNew={showAdd} onSave={(m) => void handleSave(m)} onCancel={() => { setEditing(null); setShowAdd(false); }} />
      )}
    </div>
  );
}

function MarkerForm({ marker, isNew, onSave, onCancel }: { marker: GisMarker; isNew: boolean; onSave: (m: GisMarker) => void; onCancel: () => void }) {
  const [form, setForm] = useState<GisMarker>(marker);
  const set = <K extends keyof GisMarker>(k: K, v: GisMarker[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div onClick={onCancel} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold mb-4">{isNew ? '➕ Thêm mốc' : `✏ Sửa: ${marker.name}`}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Loại" req>
            <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as MarkerType)}>
              {(Object.keys(TYPE_LABEL) as MarkerType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </FormField>
          <FormField label="Tên" req hint="VD: Mốc HC.II.012, Cọc H1.250">
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Mốc HC.II.012" />
          </FormField>
          <FormField label="Tỉnh" req>
            <select className="input" value={form.province} onChange={(e) => set('province', e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FormField>
          <FormField label="Quốc lộ" hint="VD: QL14B, QL1A">
            <input className="input" value={form.route ?? ''} onChange={(e) => set('route', e.target.value)} placeholder="QL14B" />
          </FormField>
          <FormField label="Lý trình (m)" hint="VD: 12500 = Km12+500">
            <input type="number" className="input" value={form.station_m ?? ''} onChange={(e) => set('station_m', e.target.value ? Number(e.target.value) : undefined)} />
          </FormField>
          <FormField label="X (VN2000)" req>
            <input type="number" step="0.01" className="input" value={form.x} onChange={(e) => set('x', Number(e.target.value))} />
          </FormField>
          <FormField label="Y (VN2000)" req>
            <input type="number" step="0.01" className="input" value={form.y} onChange={(e) => set('y', Number(e.target.value))} />
          </FormField>
          <FormField label="Cao độ Z (m)">
            <input type="number" step="0.01" className="input" value={form.z ?? ''} onChange={(e) => set('z', e.target.value ? Number(e.target.value) : undefined)} />
          </FormField>
          <FormField label="Ghi chú" full>
            <textarea className="input" rows={2} value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="VD: Mốc đặt sát chân taluy phía tây, dễ tìm" />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancel} className="px-4 py-2 rounded border border-zinc-700 text-sm">Hủy</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 rounded bg-emerald-500 text-white font-semibold text-sm">{isNew ? 'Tạo' : 'Lưu'}</button>
        </div>
      </div>
      <style jsx>{`.input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgb(63 63 70); background: rgb(9 9 11); color: white; font-size: 13px; outline: none; }`}</style>
    </div>
  );
}

function FormField({ label, hint, req, full, children }: { label: string; hint?: string; req?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
        {label} {req && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}
