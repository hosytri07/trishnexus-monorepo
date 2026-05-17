/**
 * TrishAdmin Phase 43 wave 13 — Merged ATGT Blocks Panel.
 * Wave 13.4 — Bỏ browser popup, dùng inline modal textarea + confirm dialog.
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
  const [items, setItems] = useState<AtgtBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [zipFilter, setZipFilter] = useState<'all' | 'has' | 'missing'>('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'zip' | 'id' | 'label' | 'fileName' | 'category' | 'meaning' | 'shapeKind'>('label');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = useState<AtgtBlock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AtgtBlock | null>(null);

  const [zipConfig, setZipConfig] = useState<ZipConfig | null>(null);
  const [zipUploadExpanded, setZipUploadExpanded] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

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
      setToast(`X Load fail: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  }

  const zipEntriesSet = useMemo(() => {
    const set = new Set<string>();
    (zipConfig?.zipEntries ?? []).forEach((e) => set.add(e.toLowerCase()));
    return set;
  }, [zipConfig]);

  function hasZipFile(fn: string): boolean {
    if (!fn) return false;
    return zipEntriesSet.has(fn.toLowerCase());
  }

  async function handleSave(b: AtgtBlock): Promise<void> {
    if (!b.id || !b.label || !b.fileName) {
      setToast('X ID + Label + Tên file bắt buộc');
      return;
    }
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'atgt_blocks', b.id), { ...b, updated_at: Date.now() }, { merge: true });
      setToast(`OK Lưu ${b.label}`);
      setEditing(null); setShowAdd(false);
      await reload();
    } catch (err) {
      setToast(`X Lưu fail: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleDelete(b: AtgtBlock): void {
    setConfirmDelete(b);
  }

  async function actuallyDelete(b: AtgtBlock): Promise<void> {
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, 'atgt_blocks', b.id));
      setToast(`Đã xóa ${b.label}`);
      await reload();
    } catch (err) {
      setToast(`X Xóa fail: ${err instanceof Error ? err.message : String(err)}`);
    }
    setConfirmDelete(null);
  }

  function openBulkImport(): void {
    setBulkImportText('');
    setBulkImportOpen(true);
  }

  async function handleBulkImportSubmit(): Promise<void> {
    const raw = bulkImportText;
    if (!raw || !raw.trim()) { setToast('X Chưa nhập dữ liệu'); return; }
    setImporting(true);
    setBulkImportOpen(false);
    try {
      const text = raw.replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).map((ln) => ln.trimEnd()).filter((ln) => ln.trim().length > 0);
      if (lines.length === 0) {
        setToast('X Không có dòng dữ liệu nào');
        setImporting(false);
        return;
      }
      const firstLine = lines[0]!;
      const sep = firstLine.includes('\t') ? '\t' : ',';
      const splitRow = (ln: string): string[] => ln.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
      const headerCells = splitRow(firstLine);
      const hasHeader = headerCells.some((c) => /^STT$|^Tên\s*file$|^Dạng/i.test(c));
      let dataRows = lines.slice(hasHeader ? 1 : 0).map(splitRow);
      dataRows = dataRows.filter((r) => r.some((c) => c && c.length > 0));

      let offset = 0;
      if (dataRows.length > 0) {
        const c0 = dataRows[0]![0] ?? '';
        if (c0 && !/^\d+$/.test(c0)) offset = -1;
      }

      const parsed: AtgtBlock[] = [];
      for (let r = 0; r < dataRows.length; r++) {
        const cells = dataRows[r]!;
        const get = (i: number): string => cells[i + 1 + offset] ?? '';
        const tenFile = get(0);
        if (!tenFile) continue;
        if (/^STT$|Tên\s*file/i.test(tenFile)) continue;
        const id = tenFile.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (!id) continue;
        const dang = get(1);
        const tenDiaVat = get(2);
        const yNghia = get(3);
        const huong = get(4);
        const loai = get(5) || 'Khác';
        const ghiChu = get(6);
        parsed.push({
          id,
          fileName: tenFile.toLowerCase().endsWith('.dwg') ? tenFile : `${tenFile}.dwg`,
          label: tenDiaVat || tenFile,
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
        const sepName = sep === '\t' ? 'TAB' : 'COMMA';
        const sampleStr = JSON.stringify(dataRows[0] ?? []);
        setToast(`X Không parse được. ${dataRows.length} dòng raw, sep=${sepName}, hasHeader=${hasHeader}, offset=${offset}, sample=${sampleStr}`);
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
        setToast(`Đã import ${written}/${parsed.length}...`);
      }
      setToast(`OK Import xong ${written} block`);
      await reload();
    } catch (err) {
      setToast(`X Import fail: ${err instanceof Error ? err.message : String(err)}`);
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
      setToast(`X Pick file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!token.trim()) { setToast('X Thiếu GitHub PAT'); return; }
    if (!filePath) { setToast('X Chưa chọn file .zip'); return; }
    if (!tag.trim()) { setToast('X Thiếu tag'); return; }
    setUploading(true);
    setToast('Đang đọc list file trong zip...');
    try {
      let zipEntries: string[] = [];
      try {
        zipEntries = await invoke<string[]>('read_zip_entries', { filePath });
      } catch (e) {
        console.warn('read_zip_entries fail:', e);
      }
      setToast(`Upload ${zipEntries.length} file lên GitHub Release...`);
      const result = await invoke<{ releaseId: number; assetId: number; assetName: string; downloadUrl: string; sizeBytes: number }>(
        'github_upload_release_asset',
        {
          token: token.trim(),
          owner: REPO_OWNER, repo: REPO_NAME,
          tag: tag.trim(),
          releaseName: releaseName.trim() || tag.trim(),
          filePath, fileName,
        },
      );
      const db = getFirebaseDb();
      const versionMatch = tag.match(/v?(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1]! : tag;
      const cfg: ZipConfig = {
        version, url: result.downloadUrl,
        fileName: result.assetName,
        size: result.sizeBytes,
        uploaded_at: Date.now(),
        note: note.trim() || undefined,
        zipEntries,
      };
      await setDoc(doc(db, 'system_config', 'atgt_blocks_zip'), cfg);
      setToast(`OK Upload ${zipEntries.length} file (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB) + cập nhật DB status`);
      await reload();
    } catch (e) {
      setToast(`X Upload fail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(CATEGORY_OPTIONS);
    items.forEach((it) => { if (it.category) set.add(it.category); });
    return Array.from(set);
  }, [items]);

  const stats = useMemo(() => {
    let has = 0, missing = 0;
    for (const it of items) {
      if (hasZipFile(it.fileName)) has++;
      else missing++;
    }
    return { has, missing, total: items.length };
  }, [items, zipEntriesSet]);

  const filtered = useMemo(() => {
    const list = items.filter((it) => {
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
    list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortBy) {
        case 'zip': av = hasZipFile(a.fileName) ? 1 : 0; bv = hasZipFile(b.fileName) ? 1 : 0; break;
        case 'id': av = a.id; bv = b.id; break;
        case 'label': av = a.label; bv = b.label; break;
        case 'fileName': av = a.fileName; bv = b.fileName; break;
        case 'category': av = a.category; bv = b.category; break;
        case 'meaning': av = a.meaning ?? ''; bv = b.meaning ?? ''; break;
        case 'shapeKind': av = `${a.shapeKind ?? ''}-${a.orientation ?? ''}`; bv = `${b.shapeKind ?? ''}-${b.orientation ?? ''}`; break;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), 'vi', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [items, filterCategory, zipFilter, searchText, zipEntriesSet, sortBy, sortDir]);

  function handleSort(col: typeof sortBy): void {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
  }
  function sortIndicator(col: typeof sortBy): string {
    if (sortBy !== col) return ' ↕';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="ts-app" style={{ padding: 20, height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>ATGT Blocks — Database + ZIP</h1>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => setZipUploadExpanded((v) => !v)} style={btnGhost}>
          {zipUploadExpanded ? 'Đóng upload' : 'Upload ZIP mới'}
        </button>
        <button type="button" onClick={() => { setEditing({ ...EMPTY }); setShowAdd(true); }} style={btnPrimary}>+ Thêm block</button>
        <button type="button" onClick={openBulkImport} style={btnGhost} disabled={importing}>Bulk import</button>
        <button type="button" onClick={() => void reload()} style={btnGhost} disabled={loading}>Reload</button>
      </header>

      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>ZIP hiện tại:</span>
          {zipConfig ? (
            <>
              <span style={badgeOk}>v{zipConfig.version}</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {zipConfig.fileName}</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {(zipConfig.size / 1024 / 1024).toFixed(2)} MB</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {(zipConfig.zipEntries?.length ?? 0)} file .dwg</span>
              <span style={{ color: 'var(--ts-text-2)' }}>· {new Date(zipConfig.uploaded_at).toLocaleString('vi-VN')}</span>
            </>
          ) : (
            <span style={{ color: 'var(--ts-text-2)' }}>Chưa có ZIP nào</span>
          )}
          <span style={{ flex: 1 }} />
          {items.length > 0 && (
            <>
              <span style={badgeOk}>Có file: {stats.has}</span>
              <span style={badgeWarn}>Chưa có: {stats.missing}</span>
            </>
          )}
        </div>

        {zipUploadExpanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--ts-border)' }}>
            <Field label="GitHub PAT (scope `repo`)" hint="Lấy ở github.com/settings/tokens">
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
                <button type="button" onClick={() => void handlePickFile()} style={btnGhost}>Chọn file...</button>
                <input style={{ ...input, flex: 1 }} value={filePath} readOnly placeholder="Chưa chọn file" />
              </div>
            </Field>
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={() => void handleUpload()} disabled={uploading || !filePath || !token.trim()}
                style={{ ...btnPrimary, opacity: uploading || !filePath || !token.trim() ? 0.5 : 1 }}>
                {uploading ? 'Đang upload...' : 'Upload + Auto-check database'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Database ({items.length}):</span>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={input}>
            <option value="all">Tất cả nhóm</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={zipFilter} onChange={(e) => setZipFilter(e.target.value as 'all' | 'has' | 'missing')} style={input}>
            <option value="all">Tất cả ZIP status</option>
            <option value="has">Có trong ZIP</option>
            <option value="missing">Chưa có ZIP</option>
          </select>
          <input type="text" placeholder="Tìm tên / file / ý nghĩa..."
            value={searchText} onChange={(e) => setSearchText(e.target.value)}
            style={{ ...input, minWidth: 240, flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--ts-text-2)' }}>Hiển thị: <strong>{filtered.length}</strong></span>
        </div>

        {loading ? <p style={{ color: 'var(--ts-text-2)' }}>Đang tải...</p>
          : items.length === 0 ? (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', padding: 16, borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 13 }}>Database rỗng. Bấm "Bulk import" để load 415 block từ Excel database-c41a296c.xlsx.</p>
            </div>
          ) : (
            <div style={{ overflow: 'auto', flex: 1, borderRadius: 6, border: '1px solid var(--ts-border)' }}>
              <table style={tableStyle}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--ts-bg-2)', zIndex: 1 }}>
                  <tr>
                    <th style={{ ...thStyle, width: 56, cursor: 'pointer' }} onClick={() => handleSort('zip')} title="Block file đã có trong ZIP chưa?">ZIP{sortIndicator('zip')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('id')} title="Slug Firestore docId">ID{sortIndicator('id')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('label')} title="Tên hiển thị (vd P.101)">Label{sortIndicator('label')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('fileName')} title="Tên file .dwg">File .dwg{sortIndicator('fileName')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('category')} title="Loại tài sản">Nhóm{sortIndicator('category')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('meaning')} title="Diễn giải ý nghĩa">Ý nghĩa{sortIndicator('meaning')}</th>
                    <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('shapeKind')} title="Block / Linetype · Vuông góc / Song song">Dạng/Hướng{sortIndicator('shapeKind')}</th>
                    <th style={{ ...thStyle, width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const inZip = hasZipFile(b.fileName);
                    return (
                      <tr key={b.id} style={zipConfig && !inZip ? { background: 'rgba(245,158,11,0.04)' } : undefined}>
                        <td style={tdStyle}>
                          {zipConfig
                            ? (inZip
                                ? <span style={pillOk} title={`File ${b.fileName} đã có trong ZIP v${zipConfig.version}`}>✓ Có</span>
                                : <span style={pillWarn} title={`File ${b.fileName} CHƯA có trong ZIP`}>✗ Thiếu</span>)
                            : <span style={pillNeutral} title="Chưa có ZIP nào upload">—</span>}
                        </td>
                        <td style={tdStyle}><code style={code}>{b.id}</code></td>
                        <td style={tdStyle}><strong>{b.label}</strong></td>
                        <td style={tdStyle}><code style={code}>{b.fileName}</code></td>
                        <td style={tdStyle}>{b.category}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--ts-text-2)' }}>{b.meaning ?? '—'}</td>
                        <td style={tdStyle}>
                          {b.shapeKind === 'linetype' ? 'LT' : 'Block'} / {b.orientation === 'parallel' ? '||' : '⊥'}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => setEditing(b)} style={btnMini}>Sửa</button>
                          <button type="button" onClick={() => handleDelete(b)} style={{ ...btnMini, color: '#dc2626' }}>Xóa</button>
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

      {bulkImportOpen && (
        <BulkImportDialog
          value={bulkImportText}
          onChange={setBulkImportText}
          onSubmit={() => void handleBulkImportSubmit()}
          onCancel={() => setBulkImportOpen(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Xóa block"
          message={`Xóa "${confirmDelete.label}" (${confirmDelete.fileName})?`}
          danger
          onConfirm={() => void actuallyDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          padding: '10px 16px', borderRadius: 8,
          background: toast.startsWith('X') ? '#dc2626' : '#10b981',
          color: '#fff', fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          maxWidth: 600, zIndex: 9999,
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
    <div style={modalBackdrop} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={modalContent}>
        <h2 style={modalTitle}>{isNew ? 'Thêm block' : `Sửa: ${value.label}`}</h2>
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
              <option value="block">Block (INSERT)</option>
              <option value="linetype">Linetype (PLINE)</option>
            </select>
          </Field>
          <Field label="Hướng">
            <select style={input} value={v.orientation ?? 'perpendicular'}
              onChange={(e) => patch({ orientation: e.target.value as 'perpendicular' | 'parallel' })}>
              <option value="perpendicular">Vuông góc</option>
              <option value="parallel">Song song</option>
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
          <button type="button" onClick={() => onSave(v)} style={btnPrimary}>Lưu</button>
        </div>
      </div>
    </div>
  );
}

function BulkImportDialog({ value, onChange, onSubmit, onCancel }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void;
}): JSX.Element {
  return (
    <div style={modalBackdrop} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        ...modalContent, minWidth: 760, maxWidth: 900,
      }}>
        <h2 style={modalTitle}>Bulk import database từ Excel</h2>
        <p style={{ fontSize: 12, color: 'var(--ts-text-2)', margin: '0 0 4px' }}>
          Mở Excel database-c41a296c.xlsx → sheet "Database" → Ctrl+A → Ctrl+C → Paste vào ô bên dưới.
        </p>
        <p style={{ fontSize: 11, color: 'var(--ts-text-2)', margin: '0 0 8px' }}>
          Cột: STT | Tên file | Dạng địa vật | Tên địa vật | Ý nghĩa | Hướng | Loại tài sản | Ghi chú
        </p>
        <textarea autoFocus value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="Paste content TSV/CSV ở đây..."
          style={{
            width: '100%', minHeight: 320,
            padding: '10px 12px',
            border: '1px solid var(--ts-border)', borderRadius: 6,
            background: 'var(--ts-bg-0)', color: 'var(--ts-text-1)',
            fontFamily: 'monospace', fontSize: 12,
            outline: 'none', resize: 'vertical',
            boxSizing: 'border-box',
          }} />
        <p style={{ fontSize: 11, color: 'var(--ts-text-2)', margin: '8px 0' }}>
          {value ? `${value.split(/\r?\n/).filter((l) => l.trim()).length} dòng` : '0 dòng'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Hủy</button>
          <button type="button" onClick={onSubmit} disabled={!value.trim()}
            style={{ ...btnPrimary, opacity: !value.trim() ? 0.5 : 1 }}>Import</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, danger, onConfirm, onCancel }: {
  title: string; message: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}): JSX.Element {
  return (
    <div style={modalBackdrop} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={{
        ...modalContent, minWidth: 400, maxWidth: 500,
      }}>
        <h2 style={modalTitle}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--ts-text-2)', margin: '0 0 16px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={btnGhost}>Hủy</button>
          <button type="button" onClick={onConfirm}
            style={{ ...btnPrimary, background: danger ? '#dc2626' : 'var(--ts-accent)' }}>
            {danger ? 'Xóa' : 'OK'}
          </button>
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

const card: React.CSSProperties = { background: 'var(--ts-bg-1)', border: '1px solid var(--ts-border)', borderRadius: 8, padding: 12 };
const input: React.CSSProperties = { padding: '5px 10px', border: '1px solid var(--ts-border)', borderRadius: 5, fontSize: 12, outline: 'none', background: 'var(--ts-bg-0)', color: 'var(--ts-text-1)', width: '100%', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '6px 12px', background: 'var(--ts-accent)', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '5px 10px', background: 'transparent', color: 'var(--ts-text-1)', border: '1px solid var(--ts-border)', borderRadius: 5, fontSize: 12, cursor: 'pointer' };
const btnMini: React.CSSProperties = { padding: '2px 7px', background: 'transparent', color: 'var(--ts-text-1)', border: '1px solid var(--ts-border)', borderRadius: 3, fontSize: 11, cursor: 'pointer', marginLeft: 3 };
const badgeOk: React.CSSProperties = { padding: '2px 8px', background: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 12, fontSize: 11, fontWeight: 600 };
const badgeWarn: React.CSSProperties = { padding: '2px 8px', background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 12, fontSize: 11, fontWeight: 600 };
const iconOk: React.CSSProperties = { display: 'inline-block', color: '#10b981', fontWeight: 700, fontSize: 14 };
const iconWarn: React.CSSProperties = { display: 'inline-block', color: '#f59e0b', fontWeight: 700, fontSize: 14 };
const pillOk: React.CSSProperties = { padding: '1px 7px', background: 'rgba(16,185,129,0.18)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
const pillWarn: React.CSSProperties = { padding: '1px 7px', background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' };
const pillNeutral: React.CSSProperties = { padding: '1px 7px', background: 'transparent', color: 'var(--ts-text-2)', border: '1px solid var(--ts-border)', borderRadius: 10, fontSize: 10, fontWeight: 600 };
const code: React.CSSProperties = { fontSize: 11, color: 'var(--ts-text-2)' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid var(--ts-border)', fontWeight: 600, fontSize: 11, color: 'var(--ts-text-2)' };
const tdStyle: React.CSSProperties = { padding: '5px 10px', borderBottom: '1px solid var(--ts-border)', color: 'var(--ts-text-1)' };
const modalBackdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent: React.CSSProperties = { background: 'var(--ts-bg-1)', padding: 20, borderRadius: 12, minWidth: 560, maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--ts-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' };
const modalTitle: React.CSSProperties = { marginTop: 0, marginBottom: 16, fontSize: 16, color: 'var(--ts-text-1)' };
