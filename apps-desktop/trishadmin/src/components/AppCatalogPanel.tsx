/**
 * Phase 41 — AppCatalogPanel.
 *
 * Quản lý app catalog Firestore-backed cho TrishLauncher.
 * Thay vì edit static JSON tay (RegistryPanel cũ), panel này:
 *   - List app ở /apps_catalog/{appId} Firestore
 *   - Add/Edit/Delete với form structured (logo URL, version, download, category)
 *   - Cho phép add app NGOÀI hệ sinh thái (Photoshop, AutoCAD, OBS, VLC, etc.)
 *     → TrishLauncher sẽ render chúng cùng các app TrishTEAM
 *   - Seed 1 lần từ apps-registry.json hiện tại
 */
import { useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  orderBy,
  query,
} from 'firebase/firestore';

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
  release_at?: string;
  publisher?: string;
  homepage_url?: string;
  download_url_windows?: string;
  download_url_macos?: string;
  download_url_linux?: string;
  changelog_url?: string;
  size_mb?: number;
  login_required?: 'none' | 'trishteam' | 'key';
  display_order?: number;
  updated_at?: number;
}

const COLLECTION = 'apps_catalog';

const CATEGORY_LABEL: Record<Category, string> = {
  ecosystem: '🟢 Hệ sinh thái TrishTEAM',
  external: '🔵 Bên ngoài (Đối tác / 3rd party)',
  utility: '🟡 Tiện ích nhỏ',
};

const STATUS_LABEL: Record<Status, string> = {
  draft: '✏ Nháp',
  released: '✅ Đã phát hành',
  deprecated: '⛔ Ngừng hỗ trợ',
};

const EMPTY: CatalogApp = {
  id: '',
  name: '',
  tagline: '',
  category: 'external',
  logo_url: '',
  version: '1.0.0',
  status: 'draft',
  login_required: 'none',
};

export function AppCatalogPanel(): JSX.Element {
  const [apps, setApps] = useState<CatalogApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [editing, setEditing] = useState<CatalogApp | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload(): Promise<void> {
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(query(collection(db, COLLECTION), orderBy('display_order', 'asc')));
      setApps(snap.docs.map((d) => d.data() as CatalogApp));
    } catch (err) {
      // Có thể catalog chưa có orderBy index — fallback no order
      try {
        const db = getFirebaseDb();
        const snap = await getDocs(collection(db, COLLECTION));
        setApps(snap.docs.map((d) => d.data() as CatalogApp));
      } catch (err2) {
        setToast({ msg: `Load fail: ${err2 instanceof Error ? err2.message : String(err2)}`, kind: 'err' });
      }
    }
    setLoading(false);
  }

  async function handleSave(app: CatalogApp): Promise<void> {
    if (!app.id || !app.name) {
      setToast({ msg: 'ID + Tên bắt buộc', kind: 'err' });
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(app.id)) {
      setToast({ msg: 'ID chỉ chứa a-z, 0-9, _, -', kind: 'err' });
      return;
    }
    try {
      const db = getFirebaseDb();
      const payload = { ...app, updated_at: Date.now() };
      await setDoc(doc(db, COLLECTION, app.id), payload, { merge: true });
      setToast({ msg: `✅ Lưu ${app.name}`, kind: 'ok' });
      setEditing(null);
      setShowAdd(false);
      await reload();
    } catch (err) {
      setToast({ msg: `Lưu fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  async function handleDelete(app: CatalogApp): Promise<void> {
    if (!window.confirm(`Xóa "${app.name}" khỏi catalog? Launcher sẽ không thấy app này nữa.`)) return;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, COLLECTION, app.id));
      setToast({ msg: `🗑 Đã xóa ${app.name}`, kind: 'ok' });
      await reload();
    } catch (err) {
      setToast({ msg: `Xóa fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  async function handleSeedFromRegistry(): Promise<void> {
    if (!window.confirm('Seed 10 app TrishTEAM mặc định vào Firestore (chỉ chạy 1 lần đầu)? Không ghi đè app đã tồn tại.')) return;
    const seed: CatalogApp[] = [
      { id: 'trishlauncher', name: 'TrishLauncher', tagline: 'Hub trung tâm hệ sinh thái', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishlauncher.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 1 },
      { id: 'trishoffice', name: 'TrishOffice', tagline: 'HRM/ERP-light cho công ty', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishoffice.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 2 },
      { id: 'trishdrive', name: 'TrishDrive', tagline: 'File manager + Cloud sync + Media downloader', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishdrive.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 3 },
      { id: 'trishfinance', name: 'TrishFinance', tagline: 'Quản lý tài chính & POS đa ngành', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishfinance.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 4 },
      { id: 'trishiso', name: 'TrishISO', tagline: 'Quản lý ISO 9001 + checklist', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishiso.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 5 },
      { id: 'trishlibrary', name: 'TrishLibrary', tagline: 'Tủ sách + OCR + chuyển đổi tài liệu', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishlibrary.png', version: '1.0.0', status: 'released', login_required: 'trishteam', display_order: 6 },
      { id: 'trishcheck', name: 'TrishCheck', tagline: 'Kiểm tra phần cứng máy tính', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishcheck.png', version: '1.0.0', status: 'released', login_required: 'none', display_order: 7 },
      { id: 'trishclean', name: 'TrishClean', tagline: 'Dọn rác hệ thống', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishclean.png', version: '1.0.0', status: 'released', login_required: 'none', display_order: 8 },
      { id: 'trishshortcut', name: 'TrishShortcut', tagline: 'Phím tắt Windows', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishshortcut.png', version: '1.0.0', status: 'released', login_required: 'none', display_order: 9 },
      { id: 'trishfont', name: 'TrishFont', tagline: 'Quản lý font chữ', category: 'ecosystem', logo_url: 'https://www.trishteam.io.vn/logos/trishfont.png', version: '1.0.0', status: 'released', login_required: 'none', display_order: 10 },
    ];
    try {
      const db = getFirebaseDb();
      const existing = new Set(apps.map((a) => a.id));
      let added = 0;
      for (const a of seed) {
        if (existing.has(a.id)) continue;
        await setDoc(doc(db, COLLECTION, a.id), { ...a, updated_at: Date.now() });
        added += 1;
      }
      setToast({ msg: `✅ Seed ${added} app mới (skip ${seed.length - added} đã có)`, kind: 'ok' });
      await reload();
    } catch (err) {
      setToast({ msg: `Seed fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
  }

  const filtered = filter === 'all' ? apps : apps.filter((a) => a.category === filter);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>📦 App Catalog (Firestore)</h1>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 12 }}>
          {apps.length} app
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        Source of truth cho TrishLauncher app list. Khác với <strong>RegistryPanel</strong> (edit static JSON),
        panel này lưu trực tiếp Firestore <code>/apps_catalog</code> → Launcher fetch realtime.
        Cho phép add app NGOÀI hệ sinh thái (VD: Photoshop, AutoCAD, OBS, VLC) với logo + link tải.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { setEditing({ ...EMPTY, id: '', display_order: apps.length + 1 }); setShowAdd(true); }}
          style={{ padding: '8px 14px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ➕ Thêm app mới
        </button>
        <button type="button" onClick={() => void handleSeedFromRegistry()}
          style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          🌱 Seed 10 app TrishTEAM (lần đầu)
        </button>
        <button type="button" onClick={() => void reload()} style={{ padding: '8px 14px', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border-default)', background: 'var(--color-surface-bg)', fontSize: 13 }}>
          <option value="all">Tất cả ({apps.length})</option>
          <option value="ecosystem">🟢 Hệ sinh thái ({apps.filter(a=>a.category==='ecosystem').length})</option>
          <option value="external">🔵 Bên ngoài ({apps.filter(a=>a.category==='external').length})</option>
          <option value="utility">🟡 Tiện ích ({apps.filter(a=>a.category==='utility').length})</option>
        </select>
      </div>

      {toast && (
        <div onClick={() => setToast(null)}
          style={{ padding: 10, borderRadius: 8, marginBottom: 14, cursor: 'pointer',
            background: toast.kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
            border: `1px solid ${toast.kind === 'ok' ? '#10B981' : '#DC2626'}`,
            color: toast.kind === 'ok' ? '#065F46' : '#991B1B', fontSize: 13 }}>
          {toast.msg}
        </div>
      )}

      {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>⏳ Đang tải...</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--color-surface-card)', borderRadius: 12, border: '1px dashed var(--color-border-default)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Chưa có app nào trong catalog. Bấm <strong>🌱 Seed 10 app TrishTEAM</strong> để khởi tạo.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map((app) => (
          <div key={app.id} style={{ padding: 16, background: 'var(--color-surface-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, display: 'flex', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--color-surface-row)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
              {app.logo_url ? <img src={app.logo_url} alt={app.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = '📦'; }} /> : '📦'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <strong style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{app.name}</strong>
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>v{app.version}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {app.tagline}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--color-surface-row)' }}>{CATEGORY_LABEL[app.category as Category] ?? app.category}</span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: app.status === 'released' ? 'rgba(16,185,129,0.15)' : app.status === 'draft' ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.15)' }}>{STATUS_LABEL[app.status as Status] ?? app.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setEditing(app)} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: '1px solid var(--color-border-default)', borderRadius: 6, cursor: 'pointer' }}>✏ Sửa</button>
                <button type="button" onClick={() => void handleDelete(app)} style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editing || showAdd) && editing && (
        <AppForm
          app={editing}
          isNew={showAdd}
          onSave={(a) => void handleSave(a)}
          onCancel={() => { setEditing(null); setShowAdd(false); }}
        />
      )}
    </div>
  );
}

function AppForm({ app, isNew, onSave, onCancel }: { app: CatalogApp; isNew: boolean; onSave: (a: CatalogApp) => void; onCancel: () => void }): JSX.Element {
  const [form, setForm] = useState<CatalogApp>(app);
  const set = <K extends keyof CatalogApp>(k: K, v: CatalogApp[K]): void => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '92%', maxHeight: '90vh', overflowY: 'auto', padding: 24, background: 'var(--color-surface-card)', borderRadius: 14, border: '1px solid var(--color-border-default)' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 14px' }}>{isNew ? '➕ Thêm app mới' : `✏ Sửa: ${app.name}`}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="ID (slug, lowercase)" req hint="VD: photoshop, autocad, obs-studio. KHÔNG đổi sau khi tạo.">
            <input type="text" value={form.id} disabled={!isNew} onChange={(e) => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              style={iStyle} placeholder="vd: photoshop" />
          </Field>
          <Field label="Tên hiển thị" req>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={iStyle} placeholder="VD: Adobe Photoshop" />
          </Field>
          <Field label="Tagline ngắn" full>
            <input type="text" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} style={iStyle} placeholder="VD: Phần mềm chỉnh sửa ảnh chuyên nghiệp" />
          </Field>
          <Field label="Mô tả chi tiết" full>
            <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={3} style={{ ...iStyle, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Mô tả dài (optional)" />
          </Field>
          <Field label="Logo URL (PNG/SVG)" full hint="URL public, dán từ Imgur/Cloudinary/CDN. Vuông tỉ lệ 1:1 đẹp nhất.">
            <input type="url" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} style={iStyle} placeholder="https://..." />
            {form.logo_url && <div style={{ marginTop: 6 }}><img src={form.logo_url} alt="preview" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--color-border-default)' }} /></div>}
          </Field>
          <Field label="Phân loại" req>
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)} style={iStyle}>
              <option value="ecosystem">🟢 Hệ sinh thái TrishTEAM</option>
              <option value="external">🔵 Bên ngoài (Adobe, Autodesk, etc.)</option>
              <option value="utility">🟡 Tiện ích nhỏ</option>
            </select>
          </Field>
          <Field label="Trạng thái">
            <select value={form.status} onChange={(e) => set('status', e.target.value as Status)} style={iStyle}>
              <option value="draft">✏ Nháp (chưa publish)</option>
              <option value="released">✅ Đã phát hành</option>
              <option value="deprecated">⛔ Ngừng hỗ trợ</option>
            </select>
          </Field>
          <Field label="Phiên bản">
            <input type="text" value={form.version} onChange={(e) => set('version', e.target.value)} style={iStyle} placeholder="1.0.0" />
          </Field>
          <Field label="Nhà phát hành / Publisher">
            <input type="text" value={form.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)} style={iStyle} placeholder="Adobe Inc. / TrishTEAM" />
          </Field>
          <Field label="Login required">
            <select value={form.login_required ?? 'none'} onChange={(e) => set('login_required', e.target.value as 'none' | 'trishteam' | 'key')} style={iStyle}>
              <option value="none">Không cần login</option>
              <option value="trishteam">Cần tài khoản TrishTEAM</option>
              <option value="key">Cần activation key</option>
            </select>
          </Field>
          <Field label="Dung lượng (MB)">
            <input type="number" value={form.size_mb ?? ''} onChange={(e) => set('size_mb', e.target.value ? Number(e.target.value) : undefined)} style={iStyle} placeholder="100" />
          </Field>
          <Field label="Homepage URL" full>
            <input type="url" value={form.homepage_url ?? ''} onChange={(e) => set('homepage_url', e.target.value)} style={iStyle} placeholder="https://www.adobe.com/photoshop" />
          </Field>
          <Field label="Download URL Windows" full>
            <input type="url" value={form.download_url_windows ?? ''} onChange={(e) => set('download_url_windows', e.target.value)} style={iStyle} placeholder="https://.../setup.exe" />
          </Field>
          <Field label="Download URL macOS">
            <input type="url" value={form.download_url_macos ?? ''} onChange={(e) => set('download_url_macos', e.target.value)} style={iStyle} placeholder="https://.../app.dmg" />
          </Field>
          <Field label="Download URL Linux">
            <input type="url" value={form.download_url_linux ?? ''} onChange={(e) => set('download_url_linux', e.target.value)} style={iStyle} placeholder="https://.../app.AppImage" />
          </Field>
          <Field label="Changelog URL" full>
            <input type="url" value={form.changelog_url ?? ''} onChange={(e) => set('changelog_url', e.target.value)} style={iStyle} placeholder="https://.../changelog" />
          </Field>
          <Field label="Display order (sắp xếp)">
            <input type="number" value={form.display_order ?? 99} onChange={(e) => set('display_order', Number(e.target.value))} style={iStyle} placeholder="1" />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onCancel} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--color-border-default)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
          <button type="button" onClick={() => onSave(form)} style={{ padding: '8px 14px', background: '#10B981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{isNew ? 'Tạo' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}

const iStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--color-border-default)', background: 'var(--color-surface-bg)',
  color: 'var(--color-text-primary)', fontSize: 13, outline: 'none',
};

function Field({ label, hint, req, full, children }: { label: string; hint?: string; req?: boolean; full?: boolean; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
        {label} {req && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}
