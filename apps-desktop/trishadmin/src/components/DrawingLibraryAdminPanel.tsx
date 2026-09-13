/**
 * DrawingLibraryAdminPanel — quản lý Thư viện bản vẽ (collection `drawing_library`).
 *
 * Admin thêm/sửa/xoá chi tiết điển hình + bản vẽ mẫu. Upload file DWG/PDF lên
 * GitHub Release (tái dùng github-uploader) → tự điền url + sha256 + size.
 * User xem qua DrawingLibraryPanel trong TrishWork (đọc realtime collection này).
 */

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import { writeAudit } from '../lib/firestore-admin.js';
import { computeSha256, getGithubPat, uploadAssetToRelease } from '../lib/github-uploader.js';

type Category = 'detail' | 'sample';
const CATS: { id: Category; label: string }[] = [
  { id: 'detail', label: 'Chi tiết điển hình' },
  { id: 'sample', label: 'Bản vẽ mẫu' },
];
const SUBGROUPS: Record<Category, string[]> = {
  detail: ['Cống', 'Rãnh', 'Bó vỉa', 'Hố ga', 'Mái taluy', 'Mặt đường', 'Biển báo', 'Khác'],
  sample: ['Mặt cắt ngang', 'Trắc dọc', 'Bình đồ', 'Khung tên', 'Hồ sơ mẫu', 'Khác'],
};
const REPO_KEY = 'trishadmin.drawings.repo';
const DEFAULT_REPO = 'hosytri07/trishnexus-drawings';

interface Item {
  id: string;
  name?: string;
  category?: Category;
  subgroup?: string;
  description?: string;
  file_type?: string;
  file_url?: string;
  sha256?: string;
  size_bytes?: number;
  thumbnail_url?: string;
  block_id?: string;
  tags?: string[];
  release_notes?: string;
}

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

const EMPTY: Item = { id: '', name: '', category: 'detail', subgroup: '', description: '', tags: [] };

export function DrawingLibraryAdminPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<Item>(EMPTY);
  const [tagsText, setTagsText] = useState('');
  const [repo, setRepo] = useState(() => localStorage.getItem(REPO_KEY) || DEFAULT_REPO);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), 'drawing_library'), orderBy('name')));
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Item, 'id'>) })));
    } catch (e) { setMsg(`✗ Tải lỗi: ${String(e)}`); }
  }
  useEffect(() => { void load(); }, []);

  function flash(m: string): void { setMsg(m); setTimeout(() => setMsg(null), 3000); }
  function set<K extends keyof Item>(k: K, v: Item[K]): void { setForm((p) => ({ ...p, [k]: v })); }

  function editItem(it: Item): void {
    setForm(it);
    setTagsText((it.tags ?? []).join(', '));
  }
  function resetForm(): void { setForm(EMPTY); setTagsText(''); }

  async function handleFile(file: File): Promise<void> {
    const pat = getGithubPat();
    if (!pat) { flash('Chưa có GitHub PAT — set ở panel API Keys trước.'); return; }
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) { flash('Repo không hợp lệ (dạng owner/repo).'); return; }
    setBusy(true);
    try {
      const sha = await computeSha256(file);
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const res = await uploadAssetToRelease({
        pat, owner, repo: repoName, releaseTag: 'drawings', file,
        releaseBody: 'Thư viện bản vẽ TrishWork',
      });
      setForm((p) => ({
        ...p,
        file_url: res.download_url,
        sha256: sha,
        size_bytes: res.size_bytes,
        file_type: ext === 'dwg' || ext === 'dxf' || ext === 'pdf' ? ext : p.file_type,
      }));
      flash('✓ Upload xong — đã điền link/sha/size.');
    } catch (e) { flash(`✗ Upload lỗi: ${String(e)}`); }
    finally { setBusy(false); }
  }

  async function handleSave(): Promise<void> {
    const name = (form.name || '').trim();
    if (!name) { flash('Nhập tên bản vẽ.'); return; }
    const id = form.id || slugify(name) || `dwg-${Date.now()}`;
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const data: Item = {
      ...form, id, name, tags,
      release_date: Date.now() as unknown as number,
    } as Item;
    try {
      await setDoc(doc(getFirebaseDb(), 'drawing_library', id), { ...data, id }, { merge: true });
      await writeAudit({
        action: 'drawing_library.save', actor_uid: firebaseUser?.uid ?? '',
        actor_email: firebaseUser?.email ?? undefined, target_type: 'drawing_library',
        target_id: id, target_label: name, details: { category: form.category },
      });
      flash('✓ Đã lưu.');
      resetForm();
      await load();
    } catch (e) { flash(`✗ Lưu lỗi: ${String(e)}`); }
  }

  async function handleDelete(it: Item): Promise<void> {
    if (!window.confirm(`Xoá "${it.name}" khỏi thư viện?`)) return;
    try {
      await deleteDoc(doc(getFirebaseDb(), 'drawing_library', it.id));
      await writeAudit({
        action: 'drawing_library.delete', actor_uid: firebaseUser?.uid ?? '',
        actor_email: firebaseUser?.email ?? undefined, target_type: 'drawing_library',
        target_id: it.id, target_label: it.name, details: {},
      });
      flash('✓ Đã xoá.');
      await load();
    } catch (e) { flash(`✗ Xoá lỗi: ${String(e)}`); }
  }

  const subs = SUBGROUPS[form.category ?? 'detail'];
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginTop: 10 };
  const inp: React.CSSProperties = { width: '100%', padding: 7, marginTop: 3 };

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 380px', minWidth: 320 }}>
        <h1 style={{ marginBottom: 4 }}>📚 Thư viện bản vẽ</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
          Thêm chi tiết điển hình & bản vẽ mẫu. User xem trong TrishWork → Khảo sát·Thiết kế → Thư viện bản vẽ.
        </p>

        <label style={lbl}>Repo GitHub Release (owner/repo)</label>
        <input style={inp} value={repo} onChange={(e) => { setRepo(e.target.value); localStorage.setItem(REPO_KEY, e.target.value); }} />

        <label style={lbl}>Tên bản vẽ *</label>
        <input style={inp} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="VD: Cống tròn D1000" />

        <label style={lbl}>Nhánh</label>
        <select style={inp} value={form.category} onChange={(e) => { set('category', e.target.value as Category); set('subgroup', ''); }}>
          {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <label style={lbl}>Nhóm con</label>
        <select style={inp} value={form.subgroup ?? ''} onChange={(e) => set('subgroup', e.target.value)}>
          <option value="">— chọn —</option>
          {subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <label style={lbl}>Mô tả</label>
        <textarea style={{ ...inp, minHeight: 56 }} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />

        <label style={lbl}>File DWG/DXF/PDF</label>
        <input type="file" accept=".dwg,.dxf,.pdf" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        {busy && <div style={{ fontSize: 12, marginTop: 4 }}>⏳ Đang upload…</div>}
        {form.file_url && <div style={{ fontSize: 11, marginTop: 4, color: '#34d399', wordBreak: 'break-all' }}>✓ {form.file_url}</div>}

        <label style={lbl}>Hoặc dán link file (nếu không upload)</label>
        <input style={inp} value={form.file_url ?? ''} onChange={(e) => set('file_url', e.target.value)} placeholder="https://…" />

        <label style={lbl}>Link ảnh xem trước (thumbnail)</label>
        <input style={inp} value={form.thumbnail_url ?? ''} onChange={(e) => set('thumbnail_url', e.target.value)} placeholder="https://… (tuỳ chọn)" />

        <label style={lbl}>Block ID (nếu chèn được vào CAD — tuỳ chọn)</label>
        <input style={inp} value={form.block_id ?? ''} onChange={(e) => set('block_id', e.target.value)} />

        <label style={lbl}>Tags (phân cách dấu phẩy)</label>
        <input style={inp} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="cong, thoat nuoc, d1000" />

        <label style={lbl}>Ghi chú (hiện cho user — tuỳ chọn)</label>
        <input style={inp} value={form.release_notes ?? ''} onChange={(e) => set('release_notes', e.target.value)} />

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>💾 Lưu</button>
          <button type="button" className="btn btn-ghost" onClick={resetForm}>+ Mới</button>
          {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: '1 1 360px', minWidth: 300 }}>
        <h2 style={{ fontSize: 15 }}>Đã có ({items.length})</h2>
        {items.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Chưa có mục nào.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: '1px solid var(--color-border-subtle, #333)', borderRadius: 8, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              {it.thumbnail_url && <img src={it.thumbnail_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {CATS.find((c) => c.id === it.category)?.label}{it.subgroup ? ` · ${it.subgroup}` : ''}{it.file_type ? ` · ${it.file_type.toUpperCase()}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => editItem(it)}>✏</button>
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => void handleDelete(it)}>🗑</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
