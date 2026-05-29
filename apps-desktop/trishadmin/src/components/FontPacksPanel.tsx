/**
 * Phase 78.13 — FontPacks Admin Panel.
 *
 * CRUD font packs trong Firestore collection `fontpacks/{id}`.
 * Replace workflow manual GitHub: edit manifest.json → commit → push.
 *
 * Admin có 2 cách deploy:
 *   1. "Export manifest.json" → download file → commit lên repo fontpacks
 *      (giữ tương thích app cũ đang đọc raw.githubusercontent.com).
 *   2. App tương lai sẽ đọc trực tiếp từ Firestore (cần update tauri-bridge).
 */
import { useCallback, useEffect, useState } from 'react';
import { getFirebaseDb } from '@trishteam/auth';
import { useAuth } from '@trishteam/auth/react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { writeAudit } from '../lib/firestore-admin.js';
import {
  computeSha256,
  getGithubPat,
  uploadAssetToRelease,
} from '../lib/github-uploader.js';

interface FontPack {
  id: string;
  name: string;
  version: string;
  description: string;
  kind: 'windows' | 'autocad' | 'mixed';
  size_bytes: number;
  file_count: number;
  tags: string[];
  preview_image: string;
  download_url: string;
  sha256: string;
  // Phase 78.13.9 — Ghi chú admin cho user khi pack mới upload
  release_notes?: string;        // Markdown / plain text, hiển thị trong app + website
  release_date?: number;          // Epoch ms, default = updated_at
  author_note?: string;           // Ghi chú nội bộ (admin-only, không show user)
}

const COLLECTION = 'fontpacks';

const EMPTY: FontPack = {
  id: '',
  name: '',
  version: '1.0.0',
  description: '',
  kind: 'mixed',
  size_bytes: 0,
  file_count: 0,
  tags: [],
  preview_image: '',
  download_url: '',
  sha256: '',
  release_notes: '',
  release_date: undefined,
  author_note: '',
};

export function FontPacksPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const [packs, setPacks] = useState<FontPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FontPack | null>(null);
  const [isNew, setIsNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const snap = await getDocs(collection(db, COLLECTION));
      const data = snap.docs.map((d) => d.data() as FontPack);
      data.sort((a, b) => a.name.localeCompare(b.name));
      setPacks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startNew(): void {
    setIsNew(true);
    setEditing({ ...EMPTY });
  }

  function startEdit(p: FontPack): void {
    setIsNew(false);
    setEditing({ ...p });
  }

  async function handleSave(): Promise<void> {
    if (!editing) return;
    if (!editing.id.trim()) {
      setError('ID không được để trống.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(editing.id)) {
      setError('ID chỉ chứa chữ thường, số, dấu gạch ngang.');
      return;
    }
    setError(null);
    try {
      const db = getFirebaseDb();
      // Phase 78.13.9 — Auto set release_date nếu admin chưa set
      const finalPack = {
        ...editing,
        release_date: editing.release_date ?? Date.now(),
      };
      await setDoc(doc(db, COLLECTION, editing.id), {
        ...finalPack,
        serverUpdatedAt: serverTimestamp(),
      });
      if (firebaseUser) {
        await writeAudit({
          action: isNew ? 'fontpack.create' : 'fontpack.update',
          actor_uid: firebaseUser.uid,
          actor_email: firebaseUser.email ?? undefined,
          target_type: 'fontpack',
          target_id: editing.id,
          target_label: editing.name,
          details: { version: editing.version, kind: editing.kind, size_bytes: editing.size_bytes, file_count: editing.file_count },
        });
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(p: FontPack): Promise<void> {
    if (!window.confirm(`Xoá pack "${p.name}"?`)) return;
    try {
      const db = getFirebaseDb();
      await deleteDoc(doc(db, COLLECTION, p.id));
      if (firebaseUser) {
        await writeAudit({
          action: 'fontpack.delete',
          actor_uid: firebaseUser.uid,
          actor_email: firebaseUser.email ?? undefined,
          target_type: 'fontpack',
          target_id: p.id,
          target_label: p.name,
          details: { version: p.version, kind: p.kind },
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleExport(): void {
    const manifest = {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      packs,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🔤 Font Packs</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            CRUD font packs. Export manifest.json để deploy lên repo
            <code style={code}>trishnexus-fontpacks</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void load()} style={btnGhost}>
            ⟲ Refresh
          </button>
          <button type="button" onClick={handleExport} style={btnGhost}>
            ↓ Export manifest.json
          </button>
          <button type="button" onClick={startNew} style={btnPrimary}>
            + Tạo pack mới
          </button>
        </div>
      </div>

      {error && (
        <div style={errBox}>⚠ {error}</div>
      )}

      {editing && (
        <PackEditor
          pack={editing}
          isNew={isNew}
          onChange={setEditing}
          onSave={() => void handleSave()}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)' }}>Đang tải...</div>
      ) : packs.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 6,
            color: 'var(--color-text-muted)',
          }}
        >
          Chưa có pack nào. Bấm "Tạo pack mới" để bắt đầu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {packs.map((p) => (
            <div
              key={p.id}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 6,
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                  <span style={tag}>{p.kind}</span>
                  <span style={tag}>v{p.version}</span>
                  <code style={code}>{p.id}</code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {p.description || <em>không có mô tả</em>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {p.file_count} files · {formatBytes(p.size_bytes)} · {p.tags.length} tags
                  {p.release_date && (
                    <> · 📅 {new Date(p.release_date).toLocaleDateString('vi-VN')}</>
                  )}
                </div>
                {p.release_notes && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--color-text-secondary)',
                      marginTop: 4,
                      padding: '4px 8px',
                      background: 'rgba(52,211,153,0.06)',
                      borderLeft: '2px solid #34d399',
                      borderRadius: 2,
                      maxHeight: 60,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    📝 {p.release_notes}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  <code style={code}>{p.download_url}</code>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button type="button" onClick={() => startEdit(p)} style={mini}>
                  ✎ Sửa
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(p)}
                  style={{ ...mini, background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}
                >
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PackEditor({
  pack,
  isNew,
  onChange,
  onSave,
  onCancel,
}: {
  pack: FontPack;
  isNew: boolean;
  onChange: (p: FontPack) => void;
  onSave: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  // Repo target — default trishnexus-fontpacks, admin có thể override
  const [repoOwner, setRepoOwner] = useState<string>(() => localStorage.getItem('trishadmin.fontpacks.owner') ?? 'hosytri07');
  const [repoName, setRepoName] = useState<string>(() => localStorage.getItem('trishadmin.fontpacks.repo') ?? 'trishnexus-fontpacks');

  function up<K extends keyof FontPack>(k: K, v: FontPack[K]): void {
    onChange({ ...pack, [k]: v });
  }

  async function analyzeZip(file: File): Promise<void> {
    setSelectedFile(file);
    setAnalyzing(true);
    setAnalyzeMsg(null);
    try {
      const sha256 = await computeSha256(file);
      const buf = await file.arrayBuffer();
      const file_count = countZipEntries(new Uint8Array(buf));
      onChange({
        ...pack,
        sha256,
        size_bytes: file.size,
        file_count: file_count > 0 ? file_count : pack.file_count,
      });
      setAnalyzeMsg(
        `✓ Đã tính: SHA256 + ${formatBytes(file.size)} + ${file_count} files. Bấm "Upload lên GitHub" để hoàn tất.`,
      );
    } catch (err) {
      setAnalyzeMsg(`✗ Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleUploadToGithub(): Promise<void> {
    if (!selectedFile) {
      setAnalyzeMsg('✗ Chưa chọn file .zip.');
      return;
    }
    if (!pack.id.trim() || !pack.version.trim()) {
      setAnalyzeMsg('✗ Cần điền ID + Version trước khi upload (tag = `{id}-v{version}`).');
      return;
    }
    const pat = getGithubPat();
    if (!pat) {
      setAnalyzeMsg('✗ Chưa có GitHub PAT. Vào "🔐 API Keys" → "🐙 GitHub PAT" để thiết lập.');
      return;
    }
    // Persist repo config
    try {
      localStorage.setItem('trishadmin.fontpacks.owner', repoOwner);
      localStorage.setItem('trishadmin.fontpacks.repo', repoName);
    } catch { /* ignore */ }

    setUploading(true);
    setUploadPct(0);
    setAnalyzeMsg('⟳ Đang upload tới GitHub Release...');
    try {
      const tag = `${pack.id}-v${pack.version}`;
      const result = await uploadAssetToRelease({
        pat,
        owner: repoOwner,
        repo: repoName,
        releaseTag: tag,
        file: selectedFile,
        assetName: `${pack.id}.zip`,
        releaseBody: `Auto-uploaded từ TrishAdmin FontPacksPanel.\n\n- Pack: **${pack.name}**\n- Version: \`${pack.version}\`\n- Size: ${formatBytes(selectedFile.size)}\n- SHA256: \`${pack.sha256}\``,
        onProgress: (p) => setUploadPct(p),
        overwrite: true,
      });
      onChange({
        ...pack,
        download_url: result.download_url,
        size_bytes: result.size_bytes,
      });
      setAnalyzeMsg(
        `✓ Upload xong! Asset: ${result.asset_name} (${formatBytes(result.size_bytes)}). URL đã autofill — chỉ cần bấm "Lưu" để publish.`,
      );
    } catch (err) {
      setAnalyzeMsg(`✗ Upload fail: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 16,
        background: 'var(--color-surface-bg)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
        {isNew ? '+ Pack mới' : `✎ Sửa pack "${pack.id}"`}
      </div>

      {/* Auto-upload tới GitHub Release */}
      <div
        style={{
          marginBottom: 12,
          padding: 12,
          background: 'rgba(251,191,36,0.08)',
          border: '1px dashed rgba(251,191,36,0.35)',
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚡ Auto-upload .zip → GitHub Release</div>
        <div style={{ color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 11.5 }}>
          Chọn file .zip → tính SHA256 + size + file_count → bấm Upload → tự tạo release với tag <code>{`{id}-v{version}`}</code> + push asset + autofill URL về form.
          Cần GitHub PAT (set ở tab 🔐 API Keys).
        </div>

        {/* Repo config (collapsible) */}
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            ⚙ Repo đích — owner / name
          </summary>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              type="text"
              value={repoOwner}
              onChange={(e) => setRepoOwner(e.target.value)}
              placeholder="owner"
              style={{ ...input, flex: '0 0 140px' }}
              disabled={uploading}
            />
            <span style={{ alignSelf: 'center', color: 'var(--color-text-muted)' }}>/</span>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="repo"
              style={{ ...input, flex: 1 }}
              disabled={uploading}
            />
          </div>
        </details>

        {/* File picker */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={analyzing || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyzeZip(f);
            }}
            style={{ fontSize: 12, flex: '1 1 240px' }}
          />
          <button
            type="button"
            onClick={() => void handleUploadToGithub()}
            disabled={!selectedFile || uploading || analyzing}
            style={{
              ...btnPrimary,
              opacity: !selectedFile || uploading || analyzing ? 0.5 : 1,
              cursor: !selectedFile || uploading || analyzing ? 'not-allowed' : 'pointer',
              padding: '6px 12px',
              fontSize: 12,
            }}
          >
            {uploading ? `⟳ ${Math.round(uploadPct * 100)}%` : '↑ Upload tới GitHub'}
          </button>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div style={{ marginTop: 8, height: 6, background: 'var(--color-surface-bg)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round(uploadPct * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #fbbf24, #34d399)',
                transition: 'width 200ms',
              }}
            />
          </div>
        )}

        {analyzeMsg && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11.5,
              color: analyzeMsg.startsWith('✓') ? '#34d399' : analyzeMsg.startsWith('⟳') ? '#fbbf24' : '#fca5a5',
            }}
          >
            {analyzeMsg}
          </div>
        )}
        {analyzing && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            ⟳ Đang tính SHA256 + đếm entries...
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="ID (slug, không đổi sau khi tạo)">
          <input
            type="text"
            value={pack.id}
            onChange={(e) => up('id', e.target.value)}
            disabled={!isNew}
            placeholder="vd: vn-tcvn3-classic"
            style={input}
          />
        </Field>
        <Field label="Tên hiển thị">
          <input type="text" value={pack.name} onChange={(e) => up('name', e.target.value)} style={input} />
        </Field>
        <Field label="Version">
          <input type="text" value={pack.version} onChange={(e) => up('version', e.target.value)} style={input} />
        </Field>
        <Field label="Loại">
          <select value={pack.kind} onChange={(e) => up('kind', e.target.value as FontPack['kind'])} style={input}>
            <option value="windows">windows</option>
            <option value="autocad">autocad</option>
            <option value="mixed">mixed</option>
          </select>
        </Field>
        <Field label="File count">
          <input
            type="number"
            value={pack.file_count}
            onChange={(e) => up('file_count', parseInt(e.target.value, 10) || 0)}
            style={input}
          />
        </Field>
        <Field label="Size (bytes)">
          <input
            type="number"
            value={pack.size_bytes}
            onChange={(e) => up('size_bytes', parseInt(e.target.value, 10) || 0)}
            style={input}
          />
        </Field>
        <Field label="Tags (comma-separated)" wide>
          <input
            type="text"
            value={pack.tags.join(', ')}
            onChange={(e) => up('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
            placeholder="vietnamese, tcvn3, unicode"
            style={input}
          />
        </Field>
        <Field label="Mô tả" wide>
          <textarea
            value={pack.description}
            onChange={(e) => up('description', e.target.value)}
            rows={2}
            style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>
        <Field label="Download URL (.zip)" wide>
          <input
            type="text"
            value={pack.download_url}
            onChange={(e) => up('download_url', e.target.value)}
            placeholder="https://github.com/hosytri07/trishnexus-fontpacks/releases/download/..."
            style={input}
          />
        </Field>
        <Field label="SHA256" wide>
          <input
            type="text"
            value={pack.sha256}
            onChange={(e) => up('sha256', e.target.value.trim())}
            placeholder="64 hex chars"
            style={{ ...input, fontFamily: 'ui-monospace, monospace' }}
          />
        </Field>
        <Field label="Preview image URL" wide>
          <input
            type="text"
            value={pack.preview_image}
            onChange={(e) => up('preview_image', e.target.value)}
            placeholder="(tuỳ chọn)"
            style={input}
          />
        </Field>

        {/* Phase 78.13.9 — Release notes hiển thị cho user */}
        <Field label="📝 Release notes (hiển thị cho user trong TrishUtilities + website)" wide>
          <textarea
            value={pack.release_notes ?? ''}
            onChange={(e) => up('release_notes', e.target.value)}
            rows={3}
            placeholder="VD: Thêm 200 font kỹ thuật. Sửa lỗi hiển thị tiếng Việt cho font UTM-Avo. Cập nhật theo TCVN 7322:2024."
            style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        {/* Phase 78.13.9 — Author note nội bộ admin */}
        <Field label="🔒 Ghi chú nội bộ (chỉ admin thấy, không hiển thị user)" wide>
          <textarea
            value={pack.author_note ?? ''}
            onChange={(e) => up('author_note', e.target.value)}
            rows={2}
            placeholder="VD: Build từ branch dev/font-v2, source: /raw/typography/. License: SIL OFL."
            style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onSave} style={btnPrimary}>
          Lưu
        </button>
        <button type="button" onClick={onCancel} style={btnGhost}>
          Hủy
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }): JSX.Element {
  return (
    <label style={{ gridColumn: wide ? '1 / -1' : 'auto', fontSize: 12 }}>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

/**
 * Đếm số entry trong ZIP bằng cách scan End Of Central Directory record (EOCD).
 * Magic bytes EOCD: 0x06054b50 — nằm gần cuối file. Offset 10 bytes sau magic
 * là "total entries in central dir" (u16, little-endian).
 *
 * Cách này nhẹ hơn parse toàn bộ central directory + không cần thư viện ngoài.
 * Trả 0 nếu không tìm thấy EOCD (file corrupted hoặc ZIP64).
 */
function countZipEntries(buf: Uint8Array): number {
  const EOCD_MAGIC = [0x50, 0x4b, 0x05, 0x06];
  const start = Math.max(0, buf.length - 65557); // EOCD comment max 65535 + 22 bytes
  for (let i = buf.length - 22; i >= start; i--) {
    if (
      buf[i] === EOCD_MAGIC[0] &&
      buf[i + 1] === EOCD_MAGIC[1] &&
      buf[i + 2] === EOCD_MAGIC[2] &&
      buf[i + 3] === EOCD_MAGIC[3]
    ) {
      // total entries: bytes at offset 10-11 (u16 LE)
      const total = buf[i + 10] | (buf[i + 11] << 8);
      return total;
    }
  }
  return 0;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-text-primary)',
  fontSize: 12.5,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--color-accent-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--color-surface-bg)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  fontSize: 13,
  cursor: 'pointer',
};

const mini: React.CSSProperties = {
  padding: '3px 9px',
  background: 'var(--color-surface-bg)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
  color: 'var(--color-text-primary)',
};

const tag: React.CSSProperties = {
  fontSize: 10.5,
  padding: '1px 6px',
  borderRadius: 99,
  background: 'var(--color-surface-muted)',
  color: 'var(--color-text-muted)',
};

const code: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11,
  background: 'var(--color-surface-bg)',
  padding: '1px 5px',
  borderRadius: 3,
};

const errBox: React.CSSProperties = {
  padding: '8px 12px',
  marginBottom: 12,
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)',
  color: '#fca5a5',
  borderRadius: 4,
  fontSize: 12.5,
};
