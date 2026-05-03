/**
 * FilesPage — Phase 22.5+22.6+22.7
 *
 * List file SQLite + actions:
 *   - Download → invoke file_download → save dialog
 *   - Delete → invoke file_delete (xoá Telegram message + SQLite row)
 *   - Search filename
 *   - Sort by name/date/size
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';

interface ProgressEvent {
  op: string;
  file_id: string;
  current_chunk: number;
  total_chunks: number;
  bytes_done: number;
  total_bytes: number;
}
import { Download, Trash2, FileText, Image as ImgIcon, Film, Music, Archive, FileQuestion, Loader2, RefreshCw, AlertCircle, Share2, Copy, X, CheckCircle2, Folder, FolderPlus, Edit3, MoveRight } from 'lucide-react';
import { useDialog } from './InlineDialog';

interface FileRow {
  id: string;
  name: string;
  size_bytes: number;
  mime?: string | null;
  sha256_hex: string;
  folder_id?: string | null;
  created_at: number;
  total_chunks: number;
  note?: string | null;
  pipeline?: string; // 'botapi' | 'mtproto' — Phase 23.4
}

interface FolderRow {
  id: string;
  name: string;
  parent_id?: string | null;
  created_at: number;
}

export function FilesPage({ uid, search, refreshTick }: { uid: string; search: string; refreshTick: number }): JSX.Element {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sort, setSort] = useState<'date' | 'name' | 'size'>('date');
  const { confirmAsync, promptAsync, alertAsync, DialogElement } = useDialog();
  const [shareModal, setShareModal] = useState<FileRow | null>(null);
  const [editModal, setEditModal] = useState<FileRow | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<ProgressEvent | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  useEffect(() => {
    const unlistenPromise = listen<ProgressEvent>('drive-progress', (e) => {
      if (e.payload.op === 'download') setDownloadProgress(e.payload);
    });
    return () => { unlistenPromise.then(fn => fn()); };
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [rows, fls] = await Promise.all([
        invoke<FileRow[]>('db_files_list', { folderId: null, search: null }),
        invoke<FolderRow[]>('folder_list'),
      ]);
      setFiles(rows);
      setFolders(fls);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createFolder() {
    const name = await promptAsync('Đặt tên folder mới:', '', { title: '📁 Tạo folder', placeholder: 'VD: Báo cáo Q1' });
    if (!name?.trim()) return;
    try {
      await invoke('folder_create', { name: name.trim(), parentId: null });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  async function renameFolder(folder: FolderRow) {
    const newName = await promptAsync('Tên mới:', folder.name, { title: '✏ Đổi tên folder' });
    if (!newName?.trim() || newName.trim() === folder.name) return;
    try {
      await invoke('folder_rename', { folderId: folder.id, newName: newName.trim() });
      await load();
    } catch (e) { setErr(String(e)); }
  }

  async function deleteFolder(folder: FolderRow) {
    const ok = await confirmAsync(
      `Xoá folder "${folder.name}"?\n\nFile trong folder sẽ về root, không bị xoá.`,
      { title: '🗑 Xoá folder', danger: true, okLabel: 'Xoá folder' }
    );
    if (!ok) return;
    try {
      await invoke('folder_delete', { folderId: folder.id });
      if (activeFolder === folder.id) setActiveFolder('');
      await load();
    } catch (e) { setErr(String(e)); }
  }

  const filtered = useMemo(() => {
    let f = files;
    // Folder filter
    if (activeFolder === '_root') {
      f = f.filter(r => !r.folder_id);
    } else if (activeFolder) {
      f = f.filter(r => r.folder_id === activeFolder);
    }
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(r => r.name.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q));
    }
    f = [...f].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size_bytes - a.size_bytes;
      return b.created_at - a.created_at;
    });
    return f;
  }, [files, search, sort, activeFolder]);

  async function downloadFile(file: FileRow) {
    setBusyId(file.id);
    setErr(null);
    setDownloadProgress(null);
    try {
      const dest = await saveDialog({
        defaultPath: file.name,
        title: `Lưu ${file.name}`,
      });
      if (!dest) {
        setBusyId(null);
        return;
      }
      const cmd = file.pipeline === 'mtproto' ? 'file_download_mtproto' : 'file_download';
      await invoke(cmd, { uid, fileId: file.id, destPath: dest });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusyId(null);
      setDownloadProgress(null);
    }
  }

  async function deleteFile(file: FileRow) {
    const ok = await confirmAsync(
      `Xoá "${file.name}"?\n\nFile sẽ vào Thùng rác 30 ngày trước khi xoá vĩnh viễn.`,
      { title: '🗑 Xoá file', danger: true, okLabel: 'Vào Thùng rác' }
    );
    if (!ok) return;
    setBusyId(file.id);
    setErr(null);
    try {
      await invoke('file_delete', { fileId: file.id });
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)));
    }
  }

  function clearSelection() { setSelectedIds(new Set()); }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirmAsync(
      `Xoá ${ids.length} file?\n\nTất cả sẽ vào Thùng rác 30 ngày trước khi xoá vĩnh viễn.`,
      { title: '🗑 Xoá nhiều file', danger: true, okLabel: `Vào Thùng rác (${ids.length})` }
    );
    if (!ok) return;
    setBulkBusy(true);
    setErr(null);
    try {
      for (const id of ids) {
        await invoke('file_delete', { fileId: id });
      }
      clearSelection();
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBulkBusy(false); }
  }

  async function bulkMove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (folders.length === 0) {
      await alertAsync('Chưa có folder nào — tạo folder trước khi move.', { title: '⚠ Không có folder', kindStyle: 'error' });
      return;
    }
    const opts = ['_root', ...folders.map(f => f.id)];
    const labels = ['📁 Root', ...folders.map(f => f.name)];
    const choiceStr = await promptAsync(
      `Move ${ids.length} file vào folder nào? Nhập số:\n\n` +
      opts.map((_, i) => `  ${i + 1}. ${labels[i]}`).join('\n'),
      '1',
      { title: `📦 Move ${ids.length} file`, placeholder: 'Số folder...' }
    );
    if (!choiceStr) return;
    const choice = parseInt(choiceStr, 10);
    if (isNaN(choice) || choice < 1 || choice > opts.length) {
      await alertAsync(`Số không hợp lệ (phải từ 1 đến ${opts.length}).`, { title: '⚠ Sai số', kindStyle: 'error' });
      return;
    }
    const targetFolderId = opts[choice - 1] === '_root' ? null : opts[choice - 1];
    setBulkBusy(true);
    setErr(null);
    try {
      for (const id of ids) {
        await invoke('file_update_meta', {
          fileId: id,
          name: null,
          folderId: targetFolderId,
          note: null,
        });
      }
      clearSelection();
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBulkBusy(false); }
  }

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { _root: 0 };
    for (const f of files) {
      if (!f.folder_id) counts._root += 1;
      else counts[f.folder_id] = (counts[f.folder_id] || 0) + 1;
    }
    return counts;
  }, [files]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr)' }}>
      {/* Folder sidebar */}
      <div className="card" style={{ padding: 14, height: 'fit-content', position: 'sticky', top: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Folders</div>
          <button className="icon-btn" title="Tạo folder mới" onClick={createFolder}><FolderPlus className="h-3.5 w-3.5" /></button>
        </div>
        <div className="space-y-0.5">
          <FolderBtn label="📂 Tất cả" count={files.length} active={activeFolder === ''} onClick={() => setActiveFolder('')} />
          <FolderBtn label="📁 Root" count={folderCounts._root || 0} active={activeFolder === '_root'} onClick={() => setActiveFolder('_root')} />
          {folders.map(f => (
            <div key={f.id} className="group flex items-center gap-1">
              <button
                className="flex-1 flex items-center gap-2 transition truncate"
                style={{
                  borderRadius: 8, padding: '6px 10px', fontSize: 12,
                  fontWeight: 500,
                  background: activeFolder === f.id ? 'var(--color-accent-soft)' : 'transparent',
                  color: activeFolder === f.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
                onClick={() => setActiveFolder(f.id)}
                title={f.name}
              >
                <Folder className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{f.name}</span>
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 'auto' }}>{folderCounts[f.id] || 0}</span>
              </button>
              <button className="icon-btn" style={{ padding: 3 }} onClick={(e) => { e.stopPropagation(); renameFolder(f); }}><Edit3 className="h-3 w-3" /></button>
              <button className="icon-btn-danger" style={{ padding: 3 }} onClick={(e) => { e.stopPropagation(); deleteFolder(f); }}><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {folders.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '10px 6px', fontStyle: 'italic' }}>
              Chưa có folder. Click + tạo folder mới.
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">
            {activeFolder === '' ? 'Tất cả file' : activeFolder === '_root' ? 'Root (không thuộc folder)' : folders.find(x => x.id === activeFolder)?.name || 'Folder'}
            {' '}({filtered.length})
          </h2>
          <p className="card-subtitle">
            Encrypted AES-256-GCM, lưu trong Telegram channel của bạn.
          </p>
        </div>
        <div className="flex gap-2">
          <select className="select-field" value={sort} onChange={e => setSort(e.target.value as typeof sort)} style={{ width: 140 }}>
            <option value="date">Mới nhất</option>
            <option value="name">Tên A-Z</option>
            <option value="size">Lớn nhất</option>
          </select>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </div>
      </div>

      {err && (
        <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mt-3 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-primary)' }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-accent-primary)' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)' }}>
            Đã chọn {selectedIds.size}/{filtered.length} file
          </div>
          <div className="flex gap-2 ml-auto">
            <button className="btn-secondary" onClick={bulkMove} disabled={bulkBusy}>
              <MoveRight className="h-4 w-4" /> Move folder
            </button>
            <button className="btn-secondary" onClick={bulkDelete} disabled={bulkBusy} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Xoá tất cả
            </button>
            <button className="btn-secondary" onClick={clearSelection} disabled={bulkBusy}>
              <X className="h-4 w-4" /> Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {loading && filtered.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 className="h-8 w-8 mx-auto animate-spin" />
          <div style={{ fontSize: 13, marginTop: 8 }}>Đang tải...</div>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <FileQuestion className="h-12 w-12 mx-auto" style={{ opacity: 0.5 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12, color: 'var(--color-text-primary)' }}>
            {search ? 'Không tìm thấy file nào' : 'Chưa có file nào'}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {search ? 'Thử từ khoá khác' : 'Vào tab "Upload" để upload file đầu tiên'}
          </div>
        </div>
      )}

      {shareModal && <ShareModal uid={uid} file={shareModal} onClose={() => setShareModal(null)} />}
      {editModal && <EditMetaModal file={editModal} folders={folders} onClose={() => setEditModal(null)} onSaved={() => { setEditModal(null); void load(); }} />}

      {filtered.length > 0 && (
        <div className="mt-4" style={{ width: '100%' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 30 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={toggleSelectAll}
                    style={{ width: 14, height: 14, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                  />
                </th>
                <th style={{ width: 40 }}></th>
                <th>Tên</th>
                <th style={{ width: 90, whiteSpace: 'nowrap' }}>Size</th>
                <th style={{ width: 110, whiteSpace: 'nowrap' }}>Ngày</th>
                <th style={{ width: 156, whiteSpace: 'nowrap' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ background: selectedIds.has(f.id) ? 'var(--color-accent-soft)' : undefined }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => toggleSelect(f.id)}
                      style={{ width: 14, height: 14, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ width: 40 }}><FileIcon mime={f.mime} /></td>
                  <td style={{ minWidth: 0, maxWidth: 0 }}>
                    <div className="flex items-center gap-2" style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={f.name}>{f.name}</span>
                      {f.pipeline === 'mtproto' && (
                        <span title="Upload qua MTProto user account" style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: 'var(--color-accent-primary)', letterSpacing: 0.4 }}>
                          MT
                        </span>
                      )}
                    </div>
                    {f.note && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: 2 }}>📝 {f.note}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>SHA {f.sha256_hex.slice(0, 8)}... · {f.total_chunks} chunk{f.total_chunks > 1 ? 's' : ''}</div>
                    {busyId === f.id && downloadProgress && downloadProgress.file_id === f.id && (
                      <div style={{ marginTop: 6, maxWidth: 360 }}>
                        <div className="flex justify-between" style={{ fontSize: 10, color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                          <span>⬇ Tải chunk {downloadProgress.current_chunk}/{downloadProgress.total_chunks}</span>
                          <span>{Math.round((downloadProgress.bytes_done / Math.max(1, downloadProgress.total_bytes)) * 100)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-surface-muted)', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(downloadProgress.bytes_done / Math.max(1, downloadProgress.total_bytes)) * 100}%`,
                            height: '100%',
                            background: 'var(--color-accent-gradient)',
                            transition: 'width 250ms',
                          }} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td>{formatBytes(f.size_bytes)}</td>
                  <td>{formatDate(f.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex gap-1.5 justify-end">
                      <button
                        className="icon-btn"
                        title="Download"
                        onClick={() => void downloadFile(f)}
                        disabled={busyId === f.id}
                      >
                        {busyId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                      <button
                        className="icon-btn"
                        title="Sửa tên / folder / ghi chú"
                        onClick={() => setEditModal(f)}
                        disabled={busyId === f.id}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        className="icon-btn"
                        title="Tạo link share"
                        onClick={() => setShareModal(f)}
                        disabled={busyId === f.id}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button
                        className="icon-btn-danger"
                        title="Xoá"
                        onClick={() => void deleteFile(f)}
                        disabled={busyId === f.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      {DialogElement}
    </div>
  );
}

function FolderBtn({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between transition"
      style={{
        borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 500,
        background: active ? 'var(--color-accent-soft)' : 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function EditMetaModal({ file, folders, onClose, onSaved }: { file: FileRow; folders: FolderRow[]; onClose: () => void; onSaved: () => void }): JSX.Element {
  const [name, setName] = useState(file.name);
  const [folderId, setFolderId] = useState(file.folder_id || '');
  const [note, setNote] = useState(file.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await invoke('file_update_meta', {
        fileId: file.id,
        name: name.trim() || null,
        folderId: folderId || null,
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) {
      setErr(String(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="card-title">Sửa thông tin file</h2>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 mt-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Tên file</label>
            <input className="input-field" style={{ marginTop: 4 }} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Folder</label>
            <select className="select-field" style={{ marginTop: 4 }} value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">📁 Root</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Ghi chú</label>
            <textarea
              className="input-field"
              style={{ marginTop: 4, minHeight: 80, resize: 'vertical' }}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Báo cáo Q1, version cuối..."
            />
          </div>
        </div>
        {err && (
          <div className="flex gap-2 items-start mt-3 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
          </div>
        )}
        <div className="flex gap-2 justify-end mt-5">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShareCreateResult {
  token: string;
  url: string;
  short_url?: string | null;
}

interface ExistingShare {
  token: string;
  file_id: string;
  file_name: string;
  url: string;
  short_url: string | null;
  created_at: number;
  expires_at: number | null;
  download_count: number;
  revoked: boolean;
}

function ShareModal({ uid, file, onClose }: { uid: string; file: FileRow; onClose: () => void }): JSX.Element {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiresHours, setExpiresHours] = useState<number>(24 * 7);
  const [maxDownloads, setMaxDownloads] = useState<number>(10);
  // Phase 26.1.E.1 — checkbox public mặc định OFF (Trí muốn quyết file nào hiện public).
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShareCreateResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Phase 25.0.F — preload existing shares (idempotent: 1 file = 1 link)
  const [existingShare, setExistingShare] = useState<ExistingShare | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [forceCreateNew, setForceCreateNew] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await invoke<ExistingShare[]>('share_list', { uid });
        const now = Date.now();
        const active = list.find((s) =>
          s.file_id === file.id
          && !s.revoked
          && (s.expires_at === null || s.expires_at > now)
        );
        if (active) setExistingShare(active);
      } catch (e) {
        console.warn('[share-modal] preload existing fail', e);
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [uid, file.id]);

  async function copyExistingUrl(): Promise<void> {
    if (!existingShare) return;
    try {
      await navigator.clipboard.writeText(existingShare.short_url || existingShare.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setErr('Không copy được'); }
  }

  async function create() {
    if (usePassword && password.length < 8) {
      setErr('Password share phải dài tối thiểu 8 ký tự');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Phase 25.0.F — nếu forceCreateNew && có existingShare → auto-revoke link cũ
      // để giữ idempotent: 1 file = 1 link active.
      if (forceCreateNew && existingShare) {
        try {
          await invoke('share_revoke', { uid, token: existingShare.token });
        } catch (re) {
          console.warn('[share-modal] revoke old fail (continue)', re);
        }
      }
      const r = await invoke<ShareCreateResult>('share_create', {
        uid,
        fileId: file.id,
        password: usePassword ? password : '', // empty → backend tự gen key, nhúng vào URL fragment
        expiresHours: expiresHours || null,
        maxDownloads: maxDownloads || null,
        isPublic, // Phase 26.1.E.1
      });
      setResult(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!result) return;
    // Ưu tiên short_url, fallback long URL nếu shortener fail
    const urlToCopy = result.short_url || result.url;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Không copy được — copy thủ công URL bên dưới');
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 520, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title">Chia sẻ file qua link</h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>{file.name}</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {/* Phase 25.0.F — File đã có link active → hiện link cũ thay vì tạo mới */}
        {loadingExisting ? (
          <div className="mt-4 p-4 text-center" style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            ⏳ Đang kiểm tra link share đã có...
          </div>
        ) : existingShare && !forceCreateNew && !result ? (
          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-accent-primary)', marginBottom: 6 }}>
                ✓ File này đã có link share
              </div>
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, marginBottom: 8 }}>
                Tạo từ {new Date(existingShare.created_at).toLocaleDateString('vi-VN')} ·{' '}
                {existingShare.download_count} lượt tải
                {existingShare.expires_at ? ` · Hết hạn ${new Date(existingShare.expires_at).toLocaleDateString('vi-VN')}` : ' · Không hết hạn'}
              </p>
              <div className="p-2 rounded" style={{ background: 'var(--color-surface-card)', border: '1px solid var(--color-border-default)', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                {existingShare.short_url || existingShare.url}
              </div>
              <button
                className="btn-primary mt-3"
                style={{ width: '100%' }}
                onClick={() => void copyExistingUrl()}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 inline" style={{ marginRight: 6 }} /> : <Copy className="h-4 w-4 inline" style={{ marginRight: 6 }} />}
                {copied ? 'Đã copy ✓' : 'Copy link share'}
              </button>
            </div>
            <button
              className="btn-secondary"
              style={{ width: '100%', borderStyle: 'dashed' }}
              onClick={() => setForceCreateNew(true)}
            >
              🔄 Tạo link MỚI thay thế (revoke link cũ)
            </button>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              💡 Nếu muốn xoá link share, vào tab <strong>Link share</strong> → revoke link.
            </p>
          </div>
        ) : !result ? (
          <>
            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-row)' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={e => setUsePassword(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Bảo vệ bằng password (an toàn hơn)
                  </span>
                </label>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, marginLeft: 24, lineHeight: 1.5 }}>
                  {usePassword
                    ? 'Người nhận phải nhập password để tải. Gửi URL + password qua 2 kênh khác nhau.'
                    : 'Tự-mở-khoá bằng key trong URL fragment (#k=...). Người nhận chỉ cần click link là tải. Server vẫn không decrypt được (key chỉ ở client).'}
                </p>
              </div>

              {usePassword && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Password share (≥ 8 ký tự)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Đặt password riêng cho file này"
                    className="input-field"
                    style={{ marginTop: 4 }}
                    autoFocus
                  />
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Người nhận cần password này để decrypt file. KHÔNG dùng password tài khoản TrishTEAM.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Hết hạn sau (giờ)</label>
                  <select className="select-field" value={expiresHours} onChange={e => setExpiresHours(Number(e.target.value))} style={{ marginTop: 4 }}>
                    <option value={1}>1 giờ</option>
                    <option value={24}>1 ngày</option>
                    <option value={24 * 7}>7 ngày</option>
                    <option value={24 * 30}>30 ngày</option>
                    <option value={0}>Không hết hạn</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Max lượt tải</label>
                  <select className="select-field" value={maxDownloads} onChange={e => setMaxDownloads(Number(e.target.value))} style={{ marginTop: 4 }}>
                    <option value={1}>1 lần</option>
                    <option value={5}>5 lần</option>
                    <option value={10}>10 lần</option>
                    <option value={50}>50 lần</option>
                    <option value={0}>Không giới hạn</option>
                  </select>
                </div>
              </div>

              {/* Phase 26.1.E.1 — Public/private toggle */}
              <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-subtle)' }}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    📚 Hiện trong Thư viện TrishTEAM
                  </span>
                </label>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, marginLeft: 24, lineHeight: 1.5 }}>
                  {isPublic
                    ? 'Mọi user đăng nhập TrishDrive User app sẽ thấy + tải file này từ tab "Thư viện TrishTEAM". Vẫn cần đầy đủ password / fragment key để decrypt.'
                    : 'Private — chỉ user có URL trực tiếp mới tải được. Mặc định tắt cho an toàn.'}
                </p>
              </div>
            </div>

            {err && (
              <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button className="btn-secondary" onClick={onClose}>Huỷ</button>
              <button className="btn-primary" onClick={create} disabled={busy || (usePassword && password.length < 8)}>
                <Share2 className="h-4 w-4" /> {busy ? 'Đang tạo...' : 'Tạo link share'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
              <div style={{ fontSize: 12, color: 'var(--color-accent-primary)' }}>
                <strong>Link share đã tạo!</strong> Gửi cả URL và password cho người nhận (qua 2 kênh khác nhau cho an toàn).
              </div>
            </div>

            <div className="mt-4">
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                Link rút gọn {result.short_url ? <span style={{ color: 'var(--color-accent-primary)', fontWeight: 600 }}>(copy gửi cho người nhận)</span> : ''}
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={result.short_url || result.url}
                  readOnly
                  className="input-field"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}
                />
                <button className="btn-secondary" onClick={copyUrl}>
                  {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Đã copy' : 'Copy'}
                </button>
              </div>
              {result.short_url && (
                <details className="mt-2" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <summary style={{ cursor: 'pointer' }}>Link đầy đủ (dự phòng)</summary>
                  <div style={{ marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all', padding: 6, background: 'var(--color-surface-row)', borderRadius: 4 }}>
                    {result.url}
                  </div>
                </details>
              )}
            </div>

            {usePassword && password ? (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--color-surface-row)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Password (gửi riêng cho người nhận)</div>
                <div style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--color-text-primary)', marginTop: 4 }}>{password}</div>
              </div>
            ) : (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Tự-mở-khoá</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  Key đã nhúng vào URL fragment (#k=...). Người nhận chỉ cần click link là tự tải. Không cần password riêng.
                </div>
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button className="btn-primary" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FileIcon({ mime }: { mime?: string | null }): JSX.Element {
  const m = mime || '';
  let Icon = FileText;
  if (m.startsWith('image/')) Icon = ImgIcon;
  else if (m.startsWith('video/')) Icon = Film;
  else if (m.startsWith('audio/')) Icon = Music;
  else if (m.includes('zip') || m.includes('tar') || m.includes('compressed')) Icon = Archive;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: 'var(--color-accent-soft)',
      color: 'var(--color-accent-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString('vi-VN');
}
