/**
 * TrishAdmin Phase 43 wave 13 — Merged ATGT Blocks Panel.
 *
 * 1 panel duy nhất quản lý:
 *   1. Database 415 block ATGT (Firestore /atgt_blocks) — CRUD + bulk import
 *   2. ZIP file (GitHub Release) — upload + auto-check entries vs database
 *
 * Workflow:
 *   - Admin upload zip → Rust github_upload_release_asset → Rust read_zip_entries
 *     → save zipEntries vào Firestore /system_config/atgt_blocks_zip.zipEntries
 *   - Database table mỗi row hiện ✓ (có file zip) hoặc ⚠ (chưa có)
 *
 * Dark theme đồng bộ TrishAdmin (dùng ts-app class + var(--*) tokens).
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit, writeBatch, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

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

interface ZipConfig {
  version: string;
  url: string;
  fileName: string;
  size: number;
  uploaded_at: number;
  note?: string;
  zipEntries?: string[];
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

const REPO_OWNER = 'hosytri07';
const REPO_NAME = 'trishnexus-monorepo';
const PAT_KEY = 'trishadmin:github-pat';

export function AtgtBlocksPanel(): JSX.Element {
  // Database state
  const [items, setItems] = useState<AtgtBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [zipFilter, setZipFilter] = useState<'all' | 'has' | 'missing'>('all');
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<AtgtBlock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // ZIP config state
  const [zipConfig, setZipConfig] = useState<ZipConfig | null>(null);
  const [zipUploadExpanded, setZipUploadExpanded] = useState(false);
  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem(PAT_KEY) ?? ''; } catch { return ''; }
  });
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('trishdesign-blocks-atgt.zip');
  const [tag, setTag] = useState<string>('trishdesign-blocks-atgt-v1.0.0');
  const [releaseName, setReleaseName] = useState<string>('ATGT Blocks v1.0.0');
  const [note, setNote] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => { void reload(); }, []);

  async function reload(): Promise<void> {
    setLoading(true);
    try {
      const db = getFirebaseDb();
      const [snapBlocks, snapZip] = await Promise.all([
        getDocs(query(collection(db, 'atgt_blocks'), orderBy('label'), limit(1000))),
        getDoc(doc(db, 'system_config', 'atgt_blocks_zip')),
      ]);
      setItems(snapBlocks.docs.map((d) => d.data() as AtgtBlock));
      setZipConfig(snapZip.exists() ? (snapZip.data() as ZipConfig) : null);
    } catch (err) {
      setToast(`✗ Load fail: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  // Compute zip entries set (lowercase for case-insensitive match)
  const zipEntriesSet = useMemo(() => {
    const set = new Set<string>();
    (zipConfig?.zipEntries ?? []).forEach((e) => set.add(e.toLowerCase()));
    return set;
  }, [zipConfig]);

  function hasZipFile(fileName: string): boolean {
    if (!fileName) return false;
    return zipEntriesSet.has(fileName.toLowerCase());
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
    const text = window.prompt(
      'Paste TSV/CSV từ sheet "Database" của Excel database-c41a296c.xlsx\n\nCột: STT | Tên file | Dạng địa vật | Tên địa vật | Ý nghĩa | Hướng | Loại tài sản | Ghi chú',
    );
    if (!text || !text.trim()) return;
    setImporting(true);
    try {
      const lines = text.split(/\r?\n/).filter((ln) => ln.trim().length > 0);
      const parsed: AtgtBlock[] = [];
      for (const ln of lines) {
        const parts = ln.split(/\t|,/).map((p) => p.trim());
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

  function saveToken(v: string): void {
    setToken(v);
    try { localStorage.setItem(PAT_KEY, v); } catch { /* ignore */ }
  }

  async function handlePickFile(): Promise<void> {
    try {
      const selected = await openDialog({
        title: 'Chọn file ZIP block ATGT',
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
        multiple: false,
      });
      if (typeof selected === 'string') {
        setFilePath(selected);
        const nm = selected.split(/[\\/]/).pop() ?? 'blocks.zip';
        setFileName(nm);
      }
    } catch (e) {
      setToast(`✗ Pick file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!token.trim()) { setToast('✗ Thiếu GitHub PAT'); return; }
    if (!filePath) { setToast('✗ Chưa chọn file .zip'); return; }
    if (!tag.trim()) { setToast('✗ Thiếu tag'); return; }
    setUploading(true);
    setToast('⏳ Đang đọc danh sách file trong zip...');
    try {
      // Step 1: Read zip entries TRƯỚC khi upload (cho biết có file gì)
      let zipEntries: string[] = [];
      try {
        zipEntries = await invoke<string[]>('read_zip_entries', { filePath });
      } catch (e) {
        console.warn('read_zip_entries fail:', e);
      }

      // Step 2: Upload lên GitHub Release
      setToast(`⏳ Upload ${zipEntries.length} file lên GitHub Release...`);
      const result = await invoke<{ releaseId: number; assetId: number; assetName: string; downloadUrl: string; sizeBytes: number }>(
        'github_upload_release_asset',
        {
          token: token.trim(),
          owner: REPO_OWNER,
          repo: REPO_NAME,
          tag: tag.trim(),
          releaseName: releaseName.trim() || tag.trim(),
          filePath,
          fileName,
        },
      );

      // Step 3: Cập nhật Firestore config (kèm zipEntries)
      const db = getFirebaseDb();
      const versionMatch = tag.match(/v?(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1]! : tag;
      const cfg: ZipConfig = {
        version,
        url: result.downloadUrl,
        fileName: result.assetName,
        size: result.sizeBytes,
        uploaded_at: Date.now(),
        note: note.trim() || undefined,
        zipEntries,
      };
      await setDoc(doc(db, 'system_config', 'atgt_blocks_zip'), cfg);
      setToast(`✅ Upload ${zipEntries.length} file (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB) + cập nhật database status`);
      await reload();
    } catch (e) {
      setToast(`✗ Upload fail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORY_OPTIONS);
    items.forEach((it) => { if (it.category) set.add(it.category); });
    return Array.from(set);
  }, [items]);

  // Stats: bao nhiêu block có/chưa có file zip
  const stats = useMemo(() => {
    let has = 0, missing = 0;
    for (const it of items) {
      if (hasZipFile(it.fileName)) has++;
      else missing++;
    }
    return { has, missing, total: items.length };
  }, [items, zipEntriesSet]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filterCategory !== 'all' && it.category !== filterCategory) return false;
      if (zipFilter === 'has' && !hasZipFile(it.fileName)) return false;
      if (zipFilter === 'missing' && hasZipFile(it.fileName)) return false;
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
  }, [items, filterCategory, zipFilter, searchText, zipEntriesSet]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="ts-app" style={{ padding: 20, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ============= Header ============= */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🚸 ATGT Blocks — Database + ZIP</h1>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setZipUploadExpanded((v) => !v)} style={btnGhost}>
          {zipUploadExpanded ? '▲ Đóng upload' : '📦 Upload ZIP mới'}
        </button>
        <button type="button" onClick={() => { setEditing({ ...EMPTY }); setShowAdd(true); }} style={btnPrimary}>+ Thêm block</button>
        <button type="button" onClick={() => void handleBulkImport()} style={btnGhost} disabled={importing}>📥 Bulk import</button>
        <button type="button" onClick={() => void reload()} style={btnGhost} disabled={loading}>🔄</button>
      </header>

      {/* ============= ZIP Config + Upload (top) ============= */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: 'var(--ts-text-1)' }}>📦 ZIP hiện tại:</span>
          {zipConfig ? (
            <>
              <span style={badgeOk}>v{zipConfig.version}</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {zipConfig.fileName}</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {(zipConfig.size / 1024 / 1024).toFixed(2)} MB</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {(zipConfig.zipEntries?.length ?? 0)} file .dwg</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {new Date(zipConfig.uploaded_at).toLocaleString('vi-VN')}</span>
            </>
          ) : (
            <span style={{ color: 'var(--ts-text-2)' }}>⚠ Chưa có ZIP nào</span>
          )}
          <span style={{ flex: 1 }} />
          {items.length > 0 && (
            <>
              <span style={badgeOk}>✓ Có file: {stats.has}</span>
              <span style={badgeWarn}>⚠ Chưa có: {stats.missing}</span>
            </>
          )}
        </div>

        {zipUploadExpanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ts-border)' }}>
            <Field label="GitHub PAT (scope `repo`)" hint="Lấy ở github.com/settings/tokens → Tokens (classic) → Generate. Lưu localStorage.">
              <input type="password" style={input} value={token}
                onChange={(e) => saveToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              <Field label="Tag">
                <input style={input} value={tag} onChange={(e) => setTag(e.target.value)} />
              </Field>
              <Field label="Release name">
                <input style={input} value={releaseName} onChange={(e) => setReleaseName(e.target.value)} />
              </Field>
              <Field label="Ghi chú">
                <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="(tùy chọn)" />
              </Field>
            </div>
            <Field label="File ZIP local">
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => void handlePickFile()} style={btnGhost}>📂 Chọn file...</button>
                <input style={{ ...input, flex: 1 }} value={filePath} readOnly placeholder="Chưa chọn file" />
              </div>
            </Field>
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={() => void handleUpload()} disabled={uploading || !filePath || !token.trim()}
                style={{ ...btnPrimary, opacity: uploading || !filePath || !token.trim() ? 0.5 : 1 }}>
                {uploading ? '⏳ Đang upload...' : '🚀 Upload + Auto-check database'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ============= Database filters + table ============= */}
      <section style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>📋 Database ({items.length}):</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input}>
            <option value="all">Tất cả nhóm</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={zipFilter} onChange={(e) => setZipFilter(e.target.value as 'all' | 'has' | 'missing')} style={input}>
            <option value="all">Tất cả ZIP status</option>
            <option value="has">✓ Có trong ZIP</option>
            <option value="missing">⚠ Chưa có ZIP</option>
          </select>
          <input type="text" placeholder="🔎 Tìm tên / file / ý nghĩa..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            style={{ ...input, minWidth: 240, flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ts-text-2)' }}>Hiển thị: <strong>{filtered.length}</strong></span>
        </div>

        {loading ? <p style={{ color: 'var(--ts-text-2)' }}>Đang tải...</p>
          : items.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', padding: 16, borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13 }}>⚠ Database rỗng. Bấm "📥 Bulk import" để load 415 block từ Excel database-c41a296c.xlsx.</p>
            </div>
          ) : (
            <div style={{ overflow: 'auto', flex: 1, borderRadius: 6, border: '1px solid var(--ts-border)' }}>
              <table style={tableStyle}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ts-bg-2)', zIndex: 1 }}>
                  <tr>
                    <th style={{ ...thStyle, width: 36 }}>ZIP</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Label</th>
                    <th style={thStyle}>File .dwg</th>
                    <th style={thStyle}>Nhóm</th>
                    <th style={thStyle}>Ý nghĩa</th>
                    <th style={thStyle}>Dạng/Hướng</th>
                    <th style={{ ...thStyle, width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const inZip = hasZipFile(b.fileName);
                    return (
                      <tr key={b.id}>
                        <td style={tdStyle}>
                          {inZip
                            ? <span style={iconOk} title="✓ File có trong ZIP">✓</span>
                            : <span style={iconWarn} title="⚠ File CHƯA có trong ZIP">⚠</span>}
                        </td>
                        <td style={tdStyle}><code style={code}>{b.id}</code></td>
                        <td style={tdStyle}><strong>{b.label}</strong></td>
                        <td style={tdStyle}><code style={code}>{b.fileName}</code></td>
                        <td style={tdStyle}>{b.category}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--ts-text-2)' }}>{b.meaning ?? '—'}</td>
                        <td style={tdStyle}>
                          {b.shapeKind === 'linetype' ? '〰' : '⬜'} {b.orientation === 'parallel' ? '↔' : '⊥'}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => setEditing(b)} style={btnMini}>✏</button>
                          <button type="button" onClick={() => void handleDelete(b)} style={{ ...btnMini, color: '#dc2626' }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </section>

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
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: 600,
          zIndex: 9999,
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--ts-bg-1)', padding: 24, borderRadius: 12,
        minWidth: 560, maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid var(--ts-border)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      }}>
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 16 }}>{isNew ? '➕ Thêm block' : `✏ Sửa: ${value.label}`}</h2>
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
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Hủy</button>
          <button type="button" onClick={() => onSave(v)} style={btnPrimary}>💾 Lưu</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ts-text-1)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--ts-text-2)' }}>{hint}</span>}
    </label>
  );
}

// =============== Dark theme styles đồng bộ TrishAdmin ===============

const card: React.CSSProperties = {
  background: 'var(--ts-bg-1)',
  border: '1px solid var(--ts-border)',
  borderRadius: 8,
  padding: 12,
};

const input: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--ts-border)',
  borderRadius: 5,
  fontSize: 12,
  outline: 'none',
  background: 'var(--ts-bg-0)',
  color: 'var(--ts-text-1)',
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--ts-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 5,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '5px 10px',
  background: 'transparent',
  color: 'var(--ts-text-1)',
  border: '1px solid var(--ts-border)',
  borderRadius: 5,
  fontSize: 12,
  cursor: 'pointer',
};

const btnMini: React.CSSProperties = {
  padding: '2px 7px',
  background: 'transparent',
  color: 'var(--ts-text-1)',
  border: '1px solid var(--ts-border)',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
  marginLeft: 3,
};

const badgeOk: React.CSSProperties = {
  padding: '2px 8px',
  background: 'rgba(16,185,129,0.18)',
  color: '#10b981',
  border: '1px solid rgba(16,185,129,0.4)',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};

const badgeWarn: React.CSSProperties = {
  padding: '2px 8px',
  background: 'rgba(245,158,11,0.18)',
  color: '#f59e0b',
  border: '1px solid rgba(245,158,11,0.4)',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
};

const iconOk: React.CSSProperties = {
  display: 'inline-block',
  color: '#10b981',
  fontWeight: 700,
  fontSize: 14,
};

const iconWarn: React.CSSProperties = {
  display: 'inline-block',
  color: '#f59e0b',
  fontWeight: 700,
  fontSize: 14,
};

const code: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ts-text-2)',
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  borderBottom: '1px solid var(--ts-border)',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--ts-text-2)',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid var(--ts-border)',
  color: 'var(--ts-text-1)',
};
