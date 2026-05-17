/**
 * TrishAdmin Phase 43 wave 11.1 — Upload ATGT Blocks ZIP lên GitHub Release.
 *
 * Workflow:
 *   1. Admin chọn file .zip local (Tauri dialog)
 *   2. Nhập tag (vd "trishdesign-blocks-atgt-v1.0.1") + release name
 *   3. Bấm Upload → Rust `github_upload_release_asset`:
 *      - GET /repos/{owner}/{repo}/releases/tags/{tag} (lookup hoặc tạo mới)
 *      - POST upload_url?name=<file> với Content-Type: application/zip
 *   4. Lưu download_url + metadata vào Firestore `/system_config/atgt_blocks_zip`
 *
 * GitHub PAT lưu localStorage (encrypted? không — admin private app).
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@trishteam/auth';

const PAT_KEY = 'trishadmin:github-pat';
const REPO_OWNER = 'hosytri07';
const REPO_NAME = 'trishnexus-monorepo';

interface CurrentConfig {
  version: string;
  url: string;
  fileName: string;
  size: number;
  uploaded_at: number;
  note?: string;
}

export function AtgtZipUploadPanel(): JSX.Element {
  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem(PAT_KEY) ?? ''; } catch { return ''; }
  });
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('trishdesign-blocks-atgt.zip');
  const [tag, setTag] = useState<string>('trishdesign-blocks-atgt-v1.0.0');
  const [releaseName, setReleaseName] = useState<string>('ATGT Blocks v1.0.0');
  const [note, setNote] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [current, setCurrent] = useState<CurrentConfig | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload() {
    try {
      const db = getFirebaseDb();
      const snap = await getDoc(doc(db, 'system_config', 'atgt_blocks_zip'));
      if (snap.exists()) setCurrent(snap.data() as CurrentConfig);
      else setCurrent(null);
    } catch (e) {
      console.warn('Reload config fail:', e);
    }
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
      setStatus(`✗ Pick file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleUpload(): Promise<void> {
    if (!token.trim()) { setStatus('✗ Thiếu GitHub Personal Access Token'); return; }
    if (!filePath) { setStatus('✗ Chưa chọn file .zip'); return; }
    if (!tag.trim()) { setStatus('✗ Thiếu tag'); return; }
    setUploading(true);
    setStatus('⏳ Đang upload lên GitHub Release...');
    try {
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

      setStatus(`✅ Upload thành công (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

      // Cập nhật Firestore /system_config/atgt_blocks_zip
      try {
        const db = getFirebaseDb();
        const versionMatch = tag.match(/v?(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1]! : tag;
        const cfg: CurrentConfig = {
          version,
          url: result.downloadUrl,
          fileName: result.assetName,
          size: result.sizeBytes,
          uploaded_at: Date.now(),
          note: note.trim() || undefined,
        };
        await setDoc(doc(db, 'system_config', 'atgt_blocks_zip'), cfg);
        setStatus(`✅ Upload + cập nhật Firestore config v${version} (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
        await reload();
      } catch (e) {
        setStatus(`⚠ Upload OK nhưng update Firestore fail: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      setStatus(`✗ Upload fail: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="ts-app" style={{ padding: 24, maxWidth: 900 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📦 ATGT Blocks ZIP — Upload GitHub Release</h1>
        <p style={{ color: '#6b7280', marginTop: 4, fontSize: 13 }}>
          Upload zip block ATGT lên <code>hosytri07/trishnexus-monorepo</code> Releases.
          TrishDesign sẽ tự fetch URL từ Firestore <code>/system_config/atgt_blocks_zip</code>.
        </p>
      </header>

      {/* Current config */}
      <section style={card}>
        <h2 style={h2}>Cấu hình hiện tại</h2>
        {current ? (
          <table style={{ width: '100%', fontSize: 13 }}>
            <tbody>
              <tr><td style={td1}>Version</td><td><strong>v{current.version}</strong></td></tr>
              <tr><td style={td1}>File</td><td><code>{current.fileName}</code></td></tr>
              <tr><td style={td1}>Kích thước</td><td>{(current.size / 1024 / 1024).toFixed(2)} MB</td></tr>
              <tr><td style={td1}>Upload</td><td>{new Date(current.uploaded_at).toLocaleString('vi-VN')}</td></tr>
              <tr><td style={td1}>URL</td><td><a href={current.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{current.url}</a></td></tr>
              {current.note && <tr><td style={td1}>Note</td><td>{current.note}</td></tr>}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#6b7280', fontSize: 13 }}>⚠ Chưa có zip nào trên Firestore. Upload lần đầu bên dưới.</p>
        )}
      </section>

      {/* Upload form */}
      <section style={card}>
        <h2 style={h2}>Upload file mới</h2>

        <Field label="GitHub Personal Access Token (scope `repo`)">
          <input type="password" style={input} value={token}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
          <small style={{ color: '#6b7280', fontSize: 11 }}>
            Lấy ở: <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>github.com/settings/tokens</a>
            {' '}→ Tokens (classic) → Generate token (scope `repo`). Token lưu localStorage cho lần sau.
          </small>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <Field label="Tag (vd trishdesign-blocks-atgt-v1.0.1)">
            <input style={input} value={tag} onChange={(e) => setTag(e.target.value)} />
          </Field>
          <Field label="Release name">
            <input style={input} value={releaseName} onChange={(e) => setReleaseName(e.target.value)} />
          </Field>
        </div>

        <Field label="Ghi chú (tùy chọn)">
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="VD: thêm 50 block biển báo mới" />
        </Field>

        <Field label="File ZIP (chọn từ máy local)">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => void handlePickFile()} style={btnGhost}>📂 Chọn file...</button>
            <input style={{ ...input, flex: 1 }} value={filePath} readOnly placeholder="Chưa chọn file" />
          </div>
        </Field>

        <Field label="Tên asset (tự fill từ file)">
          <input style={input} value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </Field>

        <div style={{ marginTop: 16 }}>
          <button type="button" onClick={() => void handleUpload()} disabled={uploading || !filePath || !token.trim()}
            style={{ ...btnPrimary, opacity: uploading || !filePath || !token.trim() ? 0.5 : 1 }}>
            {uploading ? '⏳ Đang upload...' : '🚀 Upload + Cập nhật config'}
          </button>
        </div>

        {status && (
          <p style={{ marginTop: 12, padding: '8px 12px', background: '#f3f4f6', borderLeft: '3px solid #10b981', fontSize: 13 }}>
            {status}
          </p>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const h2: React.CSSProperties = { marginTop: 0, fontSize: 16, marginBottom: 12 };

const input: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  padding: '10px 20px',
  background: '#10b981',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const td1: React.CSSProperties = {
  padding: '4px 12px 4px 0',
  fontWeight: 600,
  color: '#6b7280',
  fontSize: 12,
  width: 110,
  verticalAlign: 'top',
};
