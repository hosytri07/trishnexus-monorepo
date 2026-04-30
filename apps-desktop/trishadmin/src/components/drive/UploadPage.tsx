/**
 * UploadPage — Phase 22.5b + 22.7c
 * Chunked upload (49MB/chunk) — file ≤ 2GB.
 * Optional: folder + ghi chú.
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Upload, AlertCircle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';

interface ProgressEvent {
  op: string;
  file_id: string;
  current_chunk: number;
  total_chunks: number;
  bytes_done: number;
  total_bytes: number;
}

interface UploadResult {
  file_id: string;
  name: string;
  size_bytes: number;
  sha256_hex: string;
  total_chunks: number;
}

interface FolderRow {
  id: string;
  name: string;
  parent_id?: string | null;
  created_at: number;
}

interface MtprotoStatus {
  configured: boolean;
  authorized: boolean;
}

export function UploadPage({ uid, onUploadDone }: { uid: string; onUploadDone: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<ProgressEvent | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [useMtproto, setUseMtproto] = useState<boolean>(() => {
    return localStorage.getItem('trishdrive-pipeline') === 'mtproto';
  });
  const [mtprotoReady, setMtprotoReady] = useState<boolean>(false);

  useEffect(() => {
    void loadFolders();
    void loadMtprotoStatus();
    const unlistenPromise = listen<ProgressEvent>('drive-progress', (e) => {
      if (e.payload.op === 'upload') {
        setProgressData(e.payload);
      }
    });
    return () => { unlistenPromise.then(fn => fn()); };
  }, []);

  useEffect(() => {
    localStorage.setItem('trishdrive-pipeline', useMtproto ? 'mtproto' : 'botapi');
  }, [useMtproto]);

  async function loadFolders() {
    try {
      const f = await invoke<FolderRow[]>('folder_list');
      setFolders(f);
    } catch (e) {
      console.warn('[folder_list]', e);
    }
  }

  async function loadMtprotoStatus() {
    try {
      const s = await invoke<MtprotoStatus>('mtproto_status', { uid });
      const ready = s.configured && s.authorized;
      setMtprotoReady(ready);
      if (!ready && useMtproto) setUseMtproto(false); // auto-fallback nếu chưa setup
    } catch {
      setMtprotoReady(false);
    }
  }

  async function pickFile() {
    setErr(null);
    setResult(null);
    try {
      const selected = await openDialog({ multiple: false, title: 'Chọn file upload lên Telegram' });
      if (!selected || typeof selected !== 'string') return;
      setPickedPath(selected);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function doUpload() {
    if (!pickedPath) {
      setErr('Chưa chọn file');
      return;
    }
    setBusy(true);
    setErr(null);
    setProgressData(null);
    setStartTime(Date.now());
    try {
      const command = useMtproto && mtprotoReady ? 'file_upload_mtproto' : 'file_upload';
      const r = await invoke<UploadResult>(command, {
        uid,
        filePath: pickedPath,
        folderId: folderId || null,
        note: note.trim() || null,
      });
      setResult(r);
      setProgressData(null);
      onUploadDone();
      setTimeout(() => {
        setPickedPath(null);
        setNote('');
      }, 2000);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const filename = pickedPath ? pickedPath.split(/[\\/]/).pop() : null;

  return (
    <div className="card max-w-3xl">
      <div className="card-header">
        <div>
          <h2 className="card-title">Upload file mới</h2>
          <p className="card-subtitle">
            File chia chunk 49MB + mã hoá AES-256-GCM trước khi upload Telegram. Limit 2GB/file (Bot API). Phase 23 dùng MTProto sẽ ≤ 4GB.
          </p>
        </div>
      </div>

      {/* Drop zone / picker */}
      <div
        className="mt-4 p-8 text-center transition cursor-pointer"
        style={{
          border: '2px dashed var(--color-border-default)',
          borderRadius: 14,
          background: pickedPath ? 'var(--color-accent-soft)' : 'transparent',
          opacity: busy ? 0.7 : 1,
        }}
        onClick={() => !busy && pickFile()}
      >
        {pickedPath ? (
          <>
            <FileUp className="h-10 w-10 mx-auto" style={{ color: 'var(--color-accent-primary)' }} />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {filename}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>
              {pickedPath}
            </div>
          </>
        ) : (
          <>
            <FileUp className="h-12 w-12 mx-auto" style={{ color: 'var(--color-text-muted)' }} />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Click để chọn file
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Encrypt + chunk + upload + index SQLite tự động
            </div>
          </>
        )}
      </div>

      {/* Pipeline toggle — MTProto vs Bot API */}
      <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--color-surface-row)', border: '1px solid var(--color-border-default)' }}>
        <div className="flex items-start justify-between gap-3">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Phương thức upload
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.5 }}>
              {useMtproto && mtprotoReady ? (
                <><strong style={{ color: 'var(--color-accent-primary)' }}>MTProto</strong> · chunk 100MB · upload thẳng từ user account · file 2GB ~20 chunks (nhanh 5x)</>
              ) : (
                <><strong>Bot API</strong> · chunk 19MB · qua Telegram bot · file 2GB ~108 chunks {!mtprotoReady && '· (Setup MTProto ở Settings để tăng tốc)'}</>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer" style={{ opacity: mtprotoReady ? 1 : 0.5 }}>
            <input
              type="checkbox"
              checked={useMtproto && mtprotoReady}
              onChange={e => setUseMtproto(e.target.checked)}
              disabled={!mtprotoReady || busy}
              style={{ width: 16, height: 16, accentColor: 'var(--color-accent-primary)' }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Dùng MTProto
            </span>
          </label>
        </div>
      </div>

      {/* Folder + Note (optional) */}
      <div className="grid gap-3 mt-4 md:grid-cols-2">
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Folder (tuỳ chọn)</label>
          <select
            className="select-field"
            value={folderId}
            onChange={e => setFolderId(e.target.value)}
            style={{ marginTop: 4 }}
            disabled={busy}
          >
            <option value="">📂 Không thuộc folder nào (root)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>Ghi chú (tuỳ chọn)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="VD: Báo cáo Q1 — gửi Hùng"
            className="input-field"
            style={{ marginTop: 4 }}
            disabled={busy}
          />
        </div>
      </div>

      {busy && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--color-surface-row)' }}>
          <div className="flex justify-between items-baseline mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {progressData ? `Chunk ${progressData.current_chunk}/${progressData.total_chunks}` : 'Chuẩn bị...'}
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-primary)' }}>
              {progressData ? `${Math.round((progressData.bytes_done / Math.max(1, progressData.total_bytes)) * 100)}%` : '0%'}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--color-surface-muted)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: progressData ? `${(progressData.bytes_done / Math.max(1, progressData.total_bytes)) * 100}%` : '0%',
              height: '100%',
              background: 'var(--color-accent-gradient)',
              transition: 'width 250ms ease-out',
              borderRadius: 4,
            }} />
          </div>
          {progressData && (
            <div className="flex justify-between mt-2" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>{formatBytes(progressData.bytes_done)} / {formatBytes(progressData.total_bytes)}</span>
              <span>{formatSpeed(progressData.bytes_done, startTime)} · còn ~{formatEta(progressData.bytes_done, progressData.total_bytes, startTime)}</span>
            </div>
          )}
        </div>
      )}

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
              {formatBytes(result.size_bytes)} · {result.total_chunks} chunk · SHA256 {result.sha256_hex.slice(0, 12)}...
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 justify-end">
        {pickedPath && !busy && (
          <button className="btn-secondary" onClick={() => { setPickedPath(null); setNote(''); }}>Bỏ chọn</button>
        )}
        <button className="btn-primary" onClick={pickedPath ? doUpload : pickFile} disabled={busy}>
          <Upload className="h-4 w-4" /> {pickedPath ? 'Upload' : 'Chọn file'}
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

function formatSpeed(bytesDone: number, startMs: number): string {
  const elapsedSec = Math.max(0.5, (Date.now() - startMs) / 1000);
  const speed = bytesDone / elapsedSec;
  return `${formatBytes(speed)}/s`;
}

function formatEta(bytesDone: number, totalBytes: number, startMs: number): string {
  if (bytesDone <= 0) return '...';
  const elapsedSec = Math.max(0.5, (Date.now() - startMs) / 1000);
  const speed = bytesDone / elapsedSec;
  const remaining = (totalBytes - bytesDone) / speed;
  if (remaining < 60) return `${Math.round(remaining)}s`;
  if (remaining < 3600) return `${Math.round(remaining / 60)}m`;
  return `${(remaining / 3600).toFixed(1)}h`;
}
