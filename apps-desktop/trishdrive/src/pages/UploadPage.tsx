/**
 * UploadPage — Phase 22.5
 *
 * Drag-drop / Tauri dialog open file → encrypt + send → SQLite insert.
 * Limit 48MB Phase 22.5 (chunk lớn hơn ở Phase 22.5b).
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Upload, AlertCircle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';

interface UploadResult {
  file_id: string;
  name: string;
  size_bytes: number;
  sha256_hex: string;
}

export function UploadPage({ uid, onUploadDone }: { uid: string; onUploadDone: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pickAndUpload() {
    setErr(null);
    setResult(null);
    try {
      const selected = await openDialog({
        multiple: false,
        title: 'Chọn file upload lên Telegram',
      });
      if (!selected || typeof selected !== 'string') return;
      await doUpload(selected);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doUpload(filePath: string) {
    setBusy(true);
    setErr(null);
    setProgress('Đọc file + encrypt AES-256-GCM...');
    try {
      // Hiện chưa có streaming progress real-time (Phase 22.5b sẽ emit event)
      setProgress('Encrypt + upload Telegram...');
      const r = await invoke<UploadResult>('file_upload', { uid, filePath });
      setResult(r);
      setProgress('');
      onUploadDone();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-3xl">
      <div className="card-header">
        <div>
          <h2 className="card-title">Upload file mới</h2>
          <p className="card-subtitle">
            File được mã hoá AES-256-GCM trước khi upload Telegram. Limit Phase 22.5: 48MB/file (Phase 22.5b sẽ chunk ≥ 50MB).
          </p>
        </div>
      </div>

      <div
        className="mt-4 p-12 text-center transition cursor-pointer"
        style={{
          border: '2px dashed var(--color-border-default)',
          borderRadius: 14,
          background: busy ? 'var(--color-surface-row)' : 'transparent',
          opacity: busy ? 0.7 : 1,
        }}
        onClick={() => !busy && pickAndUpload()}
      >
        {busy ? (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Đang xử lý...
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>{progress}</div>
          </>
        ) : (
          <>
            <FileUp className="h-12 w-12 mx-auto" style={{ color: 'var(--color-text-muted)' }} />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Click để chọn file
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Encrypt → Upload → Index SQLite tự động
            </div>
          </>
        )}
      </div>

      {err && (
        <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
        </div>
      )}

      {result && (
        <div className="flex gap-2 items-start mt-4 p-3 rounded-xl" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
          <div style={{ fontSize: 12, color: 'var(--color-accent-primary)' }}>
            <div style={{ fontWeight: 600 }}>Upload OK: {result.name}</div>
            <div style={{ marginTop: 2, opacity: 0.85 }}>
              {formatBytes(result.size_bytes)} · SHA256 {result.sha256_hex.slice(0, 12)}... · file_id {result.file_id}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={pickAndUpload} disabled={busy}>
          <Upload className="h-4 w-4" /> Chọn file
        </button>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
