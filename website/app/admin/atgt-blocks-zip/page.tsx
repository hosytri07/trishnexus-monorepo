'use client';

/**
 * /admin/atgt-blocks-zip — Phase 43 wave 10.5.
 *
 * Admin upload file .zip chứa các block .dwg ATGT lên Firebase Storage.
 * Lưu URL + metadata vào Firestore `/system_config/atgt_blocks_zip` (1 doc).
 *
 * TrishDesign Settings sẽ fetch URL từ doc này → tự download + extract.
 */

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { requireDb, requireStorage } from '@/lib/firebase';
import { Upload, RefreshCw, Archive } from 'lucide-react';

interface AtgtZipConfig {
  version: string;       // vd "1.0.0"
  url: string;
  fileName: string;
  size: number;
  uploaded_at: number;
  uploaded_by?: string;
  note?: string;
}

export default function AdminAtgtBlocksZipPage() {
  const [config, setConfig] = useState<AtgtZipConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('1.0.0');
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => { void reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const db = requireDb();
      const snap = await getDoc(doc(db, 'system_config', 'atgt_blocks_zip'));
      if (snap.exists()) setConfig(snap.data() as AtgtZipConfig);
      else setConfig(null);
    } catch (err) {
      setToast({ msg: `Load fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
    setLoading(false);
  }

  async function handleUpload() {
    if (!file) { setToast({ msg: 'Chưa chọn file .zip', kind: 'err' }); return; }
    if (!version.trim()) { setToast({ msg: 'Nhập version (vd 1.0.0)', kind: 'err' }); return; }
    setUploading(true);
    setProgress(0);
    try {
      const storage = requireStorage();
      const path = `atgt-blocks/blocks-v${version}.zip`;
      const sref = storageRef(storage, path);
      const buf = await file.arrayBuffer();
      // Upload (uploadBytes không có progress callback; dùng uploadBytesResumable nếu cần)
      await uploadBytes(sref, buf, { contentType: 'application/zip' });
      setProgress(100);
      const url = await getDownloadURL(sref);

      // Update Firestore config
      const db = requireDb();
      const cfg: AtgtZipConfig = {
        version: version.trim(),
        url,
        fileName: file.name,
        size: file.size,
        uploaded_at: Date.now(),
        note: note.trim() || undefined,
      };
      await setDoc(doc(db, 'system_config', 'atgt_blocks_zip'), cfg);

      setToast({ msg: `✅ Upload + cập nhật config v${version} thành công (${(file.size / 1024).toFixed(1)} KB)`, kind: 'ok' });
      setFile(null);
      setNote('');
      await reload();
    } catch (err) {
      setToast({ msg: `Upload fail: ${err instanceof Error ? err.message : String(err)}`, kind: 'err' });
    }
    setUploading(false);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Archive size={28} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📦 ATGT Blocks ZIP</h1>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => void reload()} style={btnGhost} disabled={loading}>
          <RefreshCw size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Reload
        </button>
      </header>

      <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
        Upload file <strong>.zip</strong> chứa các block <code>.dwg</code> tài sản ATGT lên Firebase Storage.
        TrishDesign sẽ tự fetch URL + giải nén vào <code>%APPDATA%\vn.trishteam.design\blocks\ATGT</code>.
      </p>

      {/* Current config */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Cấu hình hiện tại</h2>
        {loading ? <p>Đang tải...</p>
          : config ? (
            <table style={{ width: '100%', fontSize: 14 }}>
              <tbody>
                <tr><td style={tdLabel}>Version</td><td><strong>v{config.version}</strong></td></tr>
                <tr><td style={tdLabel}>File</td><td><code>{config.fileName}</code></td></tr>
                <tr><td style={tdLabel}>Kích thước</td><td>{(config.size / 1024).toFixed(1)} KB ({(config.size / 1024 / 1024).toFixed(2)} MB)</td></tr>
                <tr><td style={tdLabel}>Upload lúc</td><td>{new Date(config.uploaded_at).toLocaleString('vi-VN')}</td></tr>
                <tr><td style={tdLabel}>URL</td><td><a href={config.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{config.url}</a></td></tr>
                {config.note && <tr><td style={tdLabel}>Ghi chú</td><td>{config.note}</td></tr>}
              </tbody>
            </table>
          ) : <p style={{ color: '#6b7280' }}>⚠ Chưa có file zip nào. Upload bên dưới để dùng.</p>
        }
      </div>

      {/* Upload form */}
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Upload file mới</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
          <Field label="Version (vd 1.0.0, 1.0.1, 1.1.0)">
            <input type="text" style={inputStyle} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </Field>
          <Field label="Ghi chú (tùy chọn)">
            <input type="text" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: thêm 50 block biển báo mới" />
          </Field>
        </div>

        <Field label="File .zip">
          <input type="file" accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ ...inputStyle, padding: '6px 8px' }} />
        </Field>

        {file && (
          <p style={{ fontSize: 13, color: '#374151', margin: '8px 0' }}>
            <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB
          </p>
        )}

        {uploading && (
          <div style={{ background: '#e5e7eb', height: 8, borderRadius: 4, overflow: 'hidden', margin: '12px 0' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', transition: 'width 0.2s' }} />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!file || uploading || !version.trim()}
          style={{ ...btnPrimary, opacity: !file || uploading ? 0.5 : 1 }}
        >
          <Upload size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {uploading ? `Đang upload... ${progress}%` : 'Upload + Cập nhật config'}
        </button>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          padding: '10px 16px', borderRadius: 8,
          background: toast.kind === 'ok' ? '#10b981' : '#dc2626',
          color: '#fff', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: 500, wordBreak: 'break-word',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
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
  padding: '6px 12px',
  background: 'transparent',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 14,
  cursor: 'pointer',
};

const tdLabel: React.CSSProperties = {
  padding: '6px 12px 6px 0',
  fontWeight: 600,
  color: '#6b7280',
  fontSize: 13,
  width: 140,
  verticalAlign: 'top',
};
