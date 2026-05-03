/**
 * TrishAdmin — AutoLISP Library Panel (Phase 28.14).
 *
 * Admin curate file .lsp cho TrishTEAM:
 *   - Upload .lsp lên kênh Telegram (chỉ định ở 🔐 API Keys → tg_lisp_chat)
 *   - Lưu metadata vào Firestore /lisp_library/{id}
 *   - User TrishDesign sẽ list + Tải + Load vào AutoCAD
 *
 * Bot token + chat ID đọc từ Firestore admin-keys (đã sync xuống localStorage).
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  type LispLibraryEntry,
  LISP_CATEGORIES,
  listLispLibrary,
  addLispLibraryEntry,
  updateLispLibraryEntry,
  deleteLispLibraryEntry,
  loadApiKey,
  getActiveTenantId,
} from '@trishteam/admin-keys';

interface UploadDraft {
  name: string;
  command: string;
  description: string;
  category: string;
  note: string;
}

const EMPTY_DRAFT: UploadDraft = {
  name: '', command: '', description: '', category: 'Khác', note: '',
};

function fmtTime(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function LispLibraryPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [entries, setEntries] = useState<LispLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [draft, setDraft] = useState<UploadDraft>(EMPTY_DRAFT);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LispLibraryEntry>>({});

  function flash(msg: string): void {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 3000);
  }

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const list = await listLispLibrary();
      setEntries(list);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handlePickFile(): Promise<void> {
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: 'AutoLISP', extensions: ['lsp', 'fas', 'vlx'] }],
      });
      if (typeof picked === 'string' && picked) {
        setFilePath(picked);
        // Auto-fill name từ filename nếu draft.name rỗng
        const filename = picked.split(/[\\/]/).pop() ?? '';
        if (!draft.name) {
          setDraft((d) => ({ ...d, name: filename.replace(/\.(lsp|fas|vlx)$/i, '') }));
        }
      }
    } catch (e) {
      flash(`✗ Lỗi pick file: ${String(e)}`);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!filePath) { flash('Chưa chọn file.'); return; }
    if (!draft.name.trim()) { flash('Chưa nhập tên LISP.'); return; }

    const tenant = getActiveTenantId();
    const botToken = (await loadApiKey(tenant, 'tg_feedback_bot')).trim();
    const chatId = (await loadApiKey(tenant, 'tg_lisp_chat')).trim();
    if (!botToken) { flash('✗ Chưa cấu hình Telegram Bot Token. Vào 🔐 API Keys.'); return; }
    if (!chatId) { flash('✗ Chưa cấu hình Telegram Channel cho LISP library. Vào 🔐 API Keys.'); return; }

    setUploading(true);
    try {
      // 1. Read file bytes (qua Rust)
      const filenameOnly = filePath.split(/[\\/]/).pop() ?? 'file.lsp';
      const fileSize = await invoke<number>('file_size', { path: filePath }).catch(() => 0);
      const fileBytes = await invoke<number[]>('read_file_bytes', { path: filePath });

      // 2. Send to Telegram channel
      const result = await invoke<{ fileId: string; filePath: string }>('tg_upload_lisp', {
        req: {
          botToken,
          chatId,
          caption: `📄 ${draft.name} · ${draft.command || '(no cmd)'} · ${draft.category}`,
          filename: filenameOnly,
          fileData: fileBytes,
        },
      });

      // 3. Save metadata to Firestore
      await addLispLibraryEntry({
        name: draft.name.trim(),
        command: draft.command.trim().toUpperCase(),
        description: draft.description.trim(),
        category: draft.category,
        filename: filenameOnly,
        fileId: result.fileId,
        filePath: result.filePath,
        size: fileSize || fileBytes.length,
        uploadedAt: Date.now(),
        uploadedBy: firebaseUser?.uid ?? '',
        uploadedByEmail: firebaseUser?.email ?? '',
        note: draft.note.trim(),
      });

      flash(`✓ Đã upload "${draft.name}" lên cloud library.`);
      setDraft(EMPTY_DRAFT);
      setFilePath(null);
      await loadAll();
    } catch (e) {
      flash(`✗ Upload lỗi: ${String(e).slice(0, 200)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(entry: LispLibraryEntry): Promise<void> {
    if (!window.confirm(`Xoá "${entry.name}" khỏi cloud library? File trên Telegram vẫn còn nhưng metadata sẽ mất.`)) return;
    try {
      await deleteLispLibraryEntry(entry.id);
      flash(`✓ Đã xoá "${entry.name}"`);
      await loadAll();
    } catch (e) {
      flash(`✗ Xoá lỗi: ${String(e)}`);
    }
  }

  function startEdit(entry: LispLibraryEntry): void {
    setEditingId(entry.id);
    setEditDraft({ name: entry.name, command: entry.command, description: entry.description, category: entry.category, note: entry.note });
  }
  async function handleSaveEdit(): Promise<void> {
    if (!editingId) return;
    try {
      await updateLispLibraryEntry(editingId, editDraft);
      flash('✓ Đã cập nhật metadata');
      setEditingId(null);
      setEditDraft({});
      await loadAll();
    } catch (e) {
      flash(`✗ Update lỗi: ${String(e)}`);
    }
  }

  const filtered = entries.filter((e) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (e.name.toLowerCase().includes(q)
      || e.command.toLowerCase().includes(q)
      || e.description.toLowerCase().includes(q)
      || e.filename.toLowerCase().includes(q));
  });

  return (
    <div className="panel">
      <header className="panel-head">
        <div>
          <h1>🧩 AutoLISP Library — TrishTEAM curated</h1>
          <p className="muted">
            Admin upload .lsp lên kênh Telegram → user TrishDesign tải về + load AutoCAD.
            Bot + channel cấu hình ở <strong>🔐 API Keys</strong>.
          </p>
        </div>
        <div className="panel-actions">
          {savedFlash && <span className="td-saved-flash">{savedFlash}</span>}
          <button className="btn btn-ghost btn-sm" onClick={() => void loadAll()} disabled={loading}>🔄 Reload</button>
        </div>
      </header>

      {error && <div className="error-banner">⚠ {error}</div>}

      {/* Upload form */}
      <section style={{ marginBottom: 16, padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📤 Upload LISP mới</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
          <input className="td-input" placeholder="Tên LISP (vd: Chia tim đường)"
            value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="td-input" placeholder="Lệnh (vd: CHIATIM)"
            value={draft.command} onChange={(e) => setDraft({ ...draft, command: e.target.value })} />
          <select className="td-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {LISP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input className="td-input" placeholder="Chức năng / mô tả"
          value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          style={{ width: '100%', marginBottom: 8 }} />
        <input className="td-input" placeholder="Ghi chú (optional)"
          value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          style={{ width: '100%', marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => void handlePickFile()}>📎 Chọn file .lsp</button>
          <span className="muted small" style={{ flex: 1 }}>{filePath ?? 'Chưa chọn'}</span>
          <button type="button" className="btn btn-primary" onClick={() => void handleUpload()}
            disabled={!filePath || !draft.name.trim() || uploading}>
            {uploading ? '⏳ Đang upload...' : '📤 Upload + Lưu metadata'}
          </button>
        </div>
      </section>

      {/* List */}
      <section style={{ padding: 16, background: 'var(--surface, #1a1a1a)', border: '1px solid var(--border, #2a2a2a)', borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1 }}>📚 {filtered.length}/{entries.length} LISP trong library</h2>
          <input className="td-input" placeholder="Tìm..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 200 }} />
        </div>
        {loading ? (
          <p className="muted small" style={{ padding: 16 }}>⏳ Đang tải...</p>
        ) : entries.length === 0 ? (
          <p className="muted small" style={{ padding: 16 }}>Chưa có LISP. Upload từ form trên.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>STT</th>
                  <th>Tên</th>
                  <th>Lệnh</th>
                  <th>Mô tả</th>
                  <th>Nhóm</th>
                  <th>Upload</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => editingId === e.id ? (
                  <tr key={e.id} style={{ background: 'var(--color-accent-soft)' }}>
                    <td>{i + 1}</td>
                    <td><input className="td-input" value={editDraft.name ?? ''} onChange={(ev) => setEditDraft({ ...editDraft, name: ev.target.value })} /></td>
                    <td><input className="td-input" value={editDraft.command ?? ''} onChange={(ev) => setEditDraft({ ...editDraft, command: ev.target.value })} /></td>
                    <td><input className="td-input" value={editDraft.description ?? ''} onChange={(ev) => setEditDraft({ ...editDraft, description: ev.target.value })} /></td>
                    <td>
                      <select className="td-select" value={editDraft.category ?? 'Khác'} onChange={(ev) => setEditDraft({ ...editDraft, category: ev.target.value })}>
                        {LISP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="small">{fmtTime(e.uploadedAt)}<br />{e.uploadedByEmail}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => void handleSaveEdit()}>💾</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingId(null); setEditDraft({}); }}>✗</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td><strong>{e.name}</strong><br /><span className="muted small">{e.filename}</span></td>
                    <td><code>{e.command || '—'}</code></td>
                    <td>{e.description || '—'}</td>
                    <td>{e.category || 'Khác'}</td>
                    <td className="small">{fmtTime(e.uploadedAt)}<br />{e.uploadedByEmail}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(e)} title="Sửa metadata">✏</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => void handleDelete(e)} title="Xoá">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
