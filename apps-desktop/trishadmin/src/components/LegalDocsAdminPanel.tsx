/**
 * LegalDocsAdminPanel — quản lý "Thông tư · Văn bản mới" (collection `legal_docs`).
 *
 * Admin thêm/sửa/xoá văn bản, upload file (PDF/doc) lên GitHub Release (tái dùng
 * github-uploader) → tự điền link. User xem qua LegalDocsPanel trong TrishWork.
 */

import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import { writeAudit } from '../lib/firestore-admin.js';
import { getGithubPat, uploadAssetToRelease } from '../lib/github-uploader.js';

type Cat = 'thongtu' | 'nghidinh' | 'quyetdinh' | 'tieuchuan' | 'quychuan' | 'vanban';
const CATS: { id: Cat; label: string }[] = [
  { id: 'thongtu', label: 'Thông tư' },
  { id: 'nghidinh', label: 'Nghị định' },
  { id: 'quyetdinh', label: 'Quyết định' },
  { id: 'tieuchuan', label: 'Tiêu chuẩn (TCVN)' },
  { id: 'quychuan', label: 'Quy chuẩn (QCVN)' },
  { id: 'vanban', label: 'Văn bản khác' },
];
const REPO_KEY = 'trishadmin.legaldocs.repo';
const DEFAULT_REPO = 'hosytri07/trishnexus-drawings';

interface Doc {
  id: string;
  title?: string;
  doc_number?: string;
  category?: Cat;
  issuing_body?: string;
  issue_date?: string;
  summary?: string;
  file_url?: string;
  tags?: string[];
  created_at?: number;
}

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
const EMPTY: Doc = { id: '', title: '', doc_number: '', category: 'thongtu', issuing_body: '', issue_date: '', summary: '', tags: [] };

export function LegalDocsAdminPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<Doc[]>([]);
  const [form, setForm] = useState<Doc>(EMPTY);
  const [tagsText, setTagsText] = useState('');
  const [repo, setRepo] = useState(() => localStorage.getItem(REPO_KEY) || DEFAULT_REPO);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(getFirebaseDb(), 'legal_docs'), orderBy('created_at', 'desc')));
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Doc, 'id'>) })));
    } catch (e) { setMsg(`✗ Tải lỗi: ${String(e)}`); }
  }
  useEffect(() => { void load(); }, []);

  function flash(m: string): void { setMsg(m); setTimeout(() => setMsg(null), 3000); }
  function set<K extends keyof Doc>(k: K, v: Doc[K]): void { setForm((p) => ({ ...p, [k]: v })); }
  function editItem(it: Doc): void { setForm(it); setTagsText((it.tags ?? []).join(', ')); }
  function resetForm(): void { setForm(EMPTY); setTagsText(''); }

  async function handleFile(file: File): Promise<void> {
    const pat = getGithubPat();
    if (!pat) { flash('Chưa có GitHub PAT — set ở panel API Keys.'); return; }
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) { flash('Repo không hợp lệ (owner/repo).'); return; }
    setBusy(true);
    try {
      const res = await uploadAssetToRelease({ pat, owner, repo: repoName, releaseTag: 'legal-docs', file, releaseBody: 'Thông tư · Văn bản TrishWork' });
      setForm((p) => ({ ...p, file_url: res.download_url }));
      flash('✓ Upload xong — đã điền link.');
    } catch (e) { flash(`✗ Upload lỗi: ${String(e)}`); }
    finally { setBusy(false); }
  }

  async function handleSave(): Promise<void> {
    const title = (form.title || '').trim();
    if (!title) { flash('Nhập tên văn bản.'); return; }
    const id = form.id || slugify(form.doc_number || title) || `doc-${Date.now()}`;
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const data: Doc = { ...form, id, title, tags, created_at: form.created_at ?? Date.now() };
    try {
      await setDoc(doc(getFirebaseDb(), 'legal_docs', id), { ...data, id }, { merge: true });
      await writeAudit({
        action: 'legal_docs.save', actor_uid: firebaseUser?.uid ?? '', actor_email: firebaseUser?.email ?? undefined,
        target_type: 'legal_docs', target_id: id, target_label: title, details: { category: form.category },
      });
      flash('✓ Đã lưu.'); resetForm(); await load();
    } catch (e) { flash(`✗ Lưu lỗi: ${String(e)}`); }
  }

  async function handleDelete(it: Doc): Promise<void> {
    if (!window.confirm(`Xoá "${it.title}"?`)) return;
    try {
      await deleteDoc(doc(getFirebaseDb(), 'legal_docs', it.id));
      await writeAudit({
        action: 'legal_docs.delete', actor_uid: firebaseUser?.uid ?? '', actor_email: firebaseUser?.email ?? undefined,
        target_type: 'legal_docs', target_id: it.id, target_label: it.title, details: {},
      });
      flash('✓ Đã xoá.'); await load();
    } catch (e) { flash(`✗ Xoá lỗi: ${String(e)}`); }
  }

  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginTop: 10 };
  const inp: React.CSSProperties = { width: '100%', padding: 7, marginTop: 3 };

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 380px', minWidth: 320 }}>
        <h1 style={{ marginBottom: 4 }}>📋 Thông tư · Văn bản mới</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 0 }}>
          Thêm văn bản/quyết định/tiêu chuẩn. User xem trong TrishWork → Khảo sát·Thiết kế → Thông tư · Văn bản mới.
        </p>

        <label style={lbl}>Repo GitHub Release (owner/repo)</label>
        <input style={inp} value={repo} onChange={(e) => { setRepo(e.target.value); localStorage.setItem(REPO_KEY, e.target.value); }} />

        <label style={lbl}>Tên văn bản *</label>
        <input style={inp} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="VD: QCVN 41:2024/BGTVT — Báo hiệu đường bộ" />

        <label style={lbl}>Số hiệu</label>
        <input style={inp} value={form.doc_number ?? ''} onChange={(e) => set('doc_number', e.target.value)} placeholder="VD: 41/2024/TT-BGTVT" />

        <label style={lbl}>Loại</label>
        <select style={inp} value={form.category} onChange={(e) => set('category', e.target.value as Cat)}>
          {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>

        <label style={lbl}>Cơ quan ban hành</label>
        <input style={inp} value={form.issuing_body ?? ''} onChange={(e) => set('issuing_body', e.target.value)} placeholder="VD: Bộ GTVT" />

        <label style={lbl}>Ngày ban hành</label>
        <input style={inp} value={form.issue_date ?? ''} onChange={(e) => set('issue_date', e.target.value)} placeholder="VD: 15/10/2024" />

        <label style={lbl}>Tóm tắt</label>
        <textarea style={{ ...inp, minHeight: 56 }} value={form.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />

        <label style={lbl}>File (PDF/doc…)</label>
        <input type="file" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
        {busy && <div style={{ fontSize: 12, marginTop: 4 }}>⏳ Đang upload…</div>}

        <label style={lbl}>Hoặc dán link file</label>
        <input style={inp} value={form.file_url ?? ''} onChange={(e) => set('file_url', e.target.value)} placeholder="https://…" />

        <label style={lbl}>Tags (phân cách dấu phẩy)</label>
        <input style={inp} value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="bien bao, atgt, duong bo" />

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>💾 Lưu</button>
          <button type="button" className="btn btn-ghost" onClick={resetForm}>+ Mới</button>
          {msg && <span style={{ fontSize: 13 }}>{msg}</span>}
        </div>
      </div>

      <div style={{ flex: '1 1 360px', minWidth: 300 }}>
        <h2 style={{ fontSize: 15 }}>Đã có ({items.length})</h2>
        {items.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Chưa có văn bản nào.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: '1px solid var(--color-border-subtle, #333)', borderRadius: 8, padding: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{it.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {CATS.find((c) => c.id === it.category)?.label}{it.doc_number ? ` · ${it.doc_number}` : ''}{it.issue_date ? ` · ${it.issue_date}` : ''}
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
