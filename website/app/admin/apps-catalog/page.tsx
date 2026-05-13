/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * /admin/apps-catalog — Phase 41.
 *
 * Web equivalent của TrishAdmin desktop AppCatalogPanel — quản lý Firestore
 * /apps_catalog/{appId} source of truth cho TrishLauncher.
 *
 * Cho phép admin add app NGOÀI hệ sinh thái (Photoshop, AutoCAD, OBS) với
 * logo + link tải. Launcher fetch realtime.
 */

import { useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { requireDb } from '@/lib/firebase';
import { Package, Plus, RefreshCw, Edit2, Trash2, ExternalLink, Sprout } from 'lucide-react';

type Category = 'ecosystem' | 'external' | 'utility';
type Status = 'draft' | 'released' | 'deprecated';

interface CatalogApp {
  id: string;
  name: string;
  tagline: string;
  description?: string;
  category: Category;
  logo_url: string;
  version: string;
  status: Status;
  publisher?: string;
  homepage_url?: string;
  download_url_windows?: string;
  display_order?: number;
}

const CAT_LABEL: Record<Category, { label: string; color: string }> = {
  ecosystem: { label: '🟢 Hệ sinh thái', color: 'bg-emerald-500/20 text-emerald-400' },
  external: { label: '🔵 Bên ngoài', color: 'bg-blue-500/20 text-blue-400' },
  utility: { label: '🟡 Tiện ích', color: 'bg-amber-500/20 text-amber-400' },
};

const STATUS_LABEL: Record<Status, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'bg-zinc-500/20 text-zinc-400' },
  released: { label: 'Đã phát hành', color: 'bg-emerald-500/20 text-emerald-400' },
  deprecated: { label: 'Ngừng hỗ trợ', color: 'bg-red-500/20 text-red-400' },
};

export default function AdminAppsCatalogPage() {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [editing, setEditing] = useState<CatalogApp | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const db = requireDb();
      const snap = await getDocs(collection(db, 'apps_catalog'));
      const list: CatalogApp[] = snap.docs.map((d) => d.data() as CatalogApp);
      list.sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));
      setApps(list);
    } catch (err) {
      setToast({ msg: `Load fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
    setLoading(false);
  }

  async function handleSave(app: CatalogApp) {
    if (!app.id || !app.name) { setToast({ msg: 'ID + Tên bắt buộc', kind: 'err' }); return; }
    if (!/^[a-z0-9_-]+$/.test(app.id)) { setToast({ msg: 'ID chỉ a-z 0-9 _ -', kind: 'err' }); return; }
    try {
      const db = requireDb();
      await setDoc(doc(db, 'apps_catalog', app.id), { ...app, updated_at: Date.now() }, { merge: true });
      setToast({ msg: `✅ Đã lưu ${app.name}`, kind: 'ok' });
      setEditing(null); setShowAdd(false);
      await reload();
    } catch (err) {
      setToast({ msg: `Lưu fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  async function handleDelete(app: CatalogApp) {
    if (!window.confirm(`Xóa "${app.name}"?`)) return;
    try {
      const db = requireDb();
      await deleteDoc(doc(db, 'apps_catalog', app.id));
      setToast({ msg: `🗑 Đã xóa ${app.name}`, kind: 'ok' });
      await reload();
    } catch (err) {
      setToast({ msg: `Xóa fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.category === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">App Catalog (Firestore)</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Source of truth cho TrishLauncher. Cho phép add app ngoài hệ sinh thái với logo + link tải.
            Path Firestore: <code className="text-xs bg-zinc-900 px-2 py-0.5 rounded">/apps_catalog/{`{appId}`}</code>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => { setEditing({ id: '', name: '', tagline: '', category: 'external', logo_url: '', version: '1.0.0', status: 'draft', display_order: apps.length + 1 }); setShowAdd(true); }}
          className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm flex items-center gap-2 hover:brightness-110">
          <Plus className="w-4 h-4" /> Thêm app mới
        </button>
        <button onClick={() => void reload()} className="px-4 py-2 rounded-lg border border-zinc-800 text-sm flex items-center gap-2 hover:bg-zinc-900">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
          <option value="all">Tất cả ({apps.length})</option>
          <option value="ecosystem">{CAT_LABEL.ecosystem.label} ({apps.filter((a) => a.category === 'ecosystem').length})</option>
          <option value="external">{CAT_LABEL.external.label} ({apps.filter((a) => a.category === 'external').length})</option>
          <option value="utility">{CAT_LABEL.utility.label} ({apps.filter((a) => a.category === 'utility').length})</option>
        </select>
      </div>

      {toast && (
        <div onClick={() => setToast(null)}
          className={`px-4 py-2 rounded-lg cursor-pointer text-sm ${toast.kind === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border border-red-500/30 text-red-300'}`}>
          {toast.msg}
        </div>
      )}

      {loading && <div className="text-zinc-500 text-sm py-8 text-center">⏳ Đang tải...</div>}

      {!loading && filtered.length === 0 && (
        <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl">
          <Sprout className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
          <p className="text-zinc-400 text-sm">Chưa có app nào. Bấm "Thêm app mới" để bắt đầu hoặc mở TrishAdmin desktop → Seed 10 app TrishTEAM.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((app) => (
          <div key={app.id} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
              {app.logo_url ? <img src={app.logo_url} alt={app.name} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm truncate">{app.name}</span>
                <span className="text-xs text-zinc-500">v{app.version}</span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 mt-1">{app.tagline}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${CAT_LABEL[app.category].color}`}>{CAT_LABEL[app.category].label}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_LABEL[app.status].color}`}>{STATUS_LABEL[app.status].label}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditing(app)} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Sửa</button>
                <button onClick={() => void handleDelete(app)} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>
                {app.homepage_url && <a href={app.homepage_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-1"><ExternalLink className="w-3 h-3" /></a>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <AppForm app={editing} isNew={showAdd} onSave={(a) => void handleSave(a)} onCancel={() => { setEditing(null); setShowAdd(false); }} />
      )}
    </div>
  );
}

function AppForm({ app, isNew, onSave, onCancel }: { app: CatalogApp; isNew: boolean; onSave: (a: CatalogApp) => void; onCancel: () => void }) {
  const [form, setForm] = useState<CatalogApp>(app);
  const set = <K extends keyof CatalogApp>(k: K, v: CatalogApp[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div onClick={onCancel} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div onClick={(e) => e.stopPropagation()} className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-bold mb-4">{isNew ? '➕ Thêm app mới' : `✏ Sửa: ${app.name}`}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="ID (slug)" req hint="vd: photoshop, autocad, obs-studio">
            <input className="input" value={form.id} disabled={!isNew} onChange={(e) => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="vd: photoshop" />
          </Field>
          <Field label="Tên" req>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Adobe Photoshop" />
          </Field>
          <Field label="Tagline" full>
            <input className="input" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Phần mềm chỉnh sửa ảnh chuyên nghiệp" />
          </Field>
          <Field label="Logo URL" full hint="URL public, paste từ CDN/Imgur. Vuông 1:1.">
            <input className="input" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://..." />
            {form.logo_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={form.logo_url} alt="" className="w-16 h-16 mt-2 object-contain rounded border border-zinc-800" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
          </Field>
          <Field label="Phân loại" req>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              <option value="ecosystem">🟢 Hệ sinh thái</option>
              <option value="external">🔵 Bên ngoài</option>
              <option value="utility">🟡 Tiện ích</option>
            </select>
          </Field>
          <Field label="Trạng thái">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as Status)}>
              <option value="draft">Nháp</option>
              <option value="released">Đã phát hành</option>
              <option value="deprecated">Ngừng hỗ trợ</option>
            </select>
          </Field>
          <Field label="Version"><input className="input" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="1.0.0" /></Field>
          <Field label="Publisher"><input className="input" value={form.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)} placeholder="Adobe Inc." /></Field>
          <Field label="Homepage URL" full><input className="input" value={form.homepage_url ?? ''} onChange={(e) => set('homepage_url', e.target.value)} placeholder="https://..." /></Field>
          <Field label="Download URL Windows" full><input className="input" value={form.download_url_windows ?? ''} onChange={(e) => set('download_url_windows', e.target.value)} placeholder="https://.../setup.exe" /></Field>
          <Field label="Display order"><input type="number" className="input" value={form.display_order ?? 99} onChange={(e) => set('display_order', Number(e.target.value))} /></Field>
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

function Field({ label, hint, req, full, children }: { label: string; hint?: string; req?: boolean; full?: boolean; children: React.ReactNode }) {
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
