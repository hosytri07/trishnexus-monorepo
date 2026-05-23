/**
 * Phase 18.4.d — Backup / Restore modal.
 *
 * 2 chế độ:
 *   - Sao lưu: build bundle → save dialog JSON file
 *   - Khôi phục: open dialog JSON → parse → restore → reload window
 */

import { useEffect, useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  buildBackupBundle,
  readBackupFrom,
  restoreBackup,
  suggestBackupFilename,
  writeBackupTo,
  loadAutoBackupPrefs,
  saveAutoBackupPrefs,
  getLastBackupMs,
  type AutoBackupPrefs,
  type BackupBundle,
  type RestoreSummary,
} from '../lib/backup.js';

interface Props {
  uid: string | null;
  appVersion: string;
  onClose: () => void;
}

type Mode = 'menu' | 'backup' | 'restore-confirm' | 'restored' | 'auto';

export function BackupModal({ uid, appVersion, onClose }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('menu');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<{
    path: string;
    bundle: BackupBundle;
  } | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  async function handleBackup(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const bundle = await buildBackupBundle(uid, appVersion);
      const target = await saveDialog({
        defaultPath: suggestBackupFilename(),
        filters: [{ name: 'TrishLibrary Backup', extensions: ['json'] }],
      });
      if (!target) {
        setBusy(false);
        return;
      }
      const path = typeof target === 'string' ? target : null;
      if (!path) {
        setBusy(false);
        return;
      }
      await writeBackupTo(path, bundle);
      setLastBackupPath(path);
      setMode('backup');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePickRestore(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const picked = await openDialog({
        multiple: false,
        filters: [{ name: 'TrishLibrary Backup', extensions: ['json'] }],
      });
      if (typeof picked !== 'string') {
        setBusy(false);
        return;
      }
      const bundle = await readBackupFrom(picked);
      setRestoreCandidate({ path: picked, bundle });
      setMode('restore-confirm');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!restoreCandidate) return;
    setBusy(true);
    setErr(null);
    try {
      const summary = await restoreBackup(restoreCandidate.bundle);
      setRestoreSummary(summary);
      setMode('restored');
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleReload(): void {
    window.location.reload();
  }

  function basename(p: string): string {
    return p.split(/[\\/]/).pop() ?? p;
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="backup-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sao lưu"
      >
        <header className="backup-head">
          <h2>💾 Sao lưu / Khôi phục dữ liệu</h2>
          <button className="mini" onClick={onClose} disabled={busy} title="Đóng (Esc)">
            ×
          </button>
        </header>

        <div className="backup-body">
          {err && (
            <div
              style={{
                background: 'rgba(196, 67, 51, 0.10)',
                color: 'var(--danger, #c43)',
                padding: 8,
                borderRadius: 4,
                marginBottom: 12,
              }}
            >
              ⚠ {err}
            </div>
          )}

          {mode === 'menu' && (
            <>
              <p className="muted small" style={{ marginTop: 0 }}>
                Sao lưu toàn bộ dữ liệu vào 1 file JSON: notes, library, image
                folders/notes/rename, dashboard meta, settings.{' '}
                <strong>Không bao gồm:</strong> Tantivy index + thumbnail cache (rebuildable).
              </p>

              <div className="backup-options">
                <button
                  className="backup-option-card"
                  onClick={() => void handleBackup()}
                  disabled={busy}
                >
                  <span className="backup-option-icon">💾</span>
                  <div>
                    <strong>Tạo bản sao lưu mới</strong>
                    <p className="muted small">
                      Build bundle JSON + chọn nơi lưu (file <code>.json</code>).
                    </p>
                  </div>
                </button>

                <button
                  className="backup-option-card"
                  onClick={() => void handlePickRestore()}
                  disabled={busy}
                >
                  <span className="backup-option-icon">📥</span>
                  <div>
                    <strong>Khôi phục từ bản sao lưu</strong>
                    <p className="muted small">
                      Chọn file <code>.json</code> đã sao lưu trước đó. Sẽ ghi đè dữ liệu hiện tại.
                    </p>
                  </div>
                </button>

                <button
                  className="backup-option-card"
                  onClick={() => setMode('auto')}
                  disabled={busy}
                >
                  <span className="backup-option-icon">🔁</span>
                  <div>
                    <strong>Sao lưu tự động</strong>
                    <p className="muted small">
                      Bật/tắt auto-backup theo chu kỳ (mỗi 1/6/24 giờ) vào folder cố định.
                    </p>
                  </div>
                </button>
              </div>

              <div className="backup-tip muted small">
                💡 <strong>Mẹo:</strong> Sao lưu định kỳ trước khi cập nhật app hoặc thử
                tính năng mới. File <code>.json</code> nên đặt ở Cloud (Google Drive,
                OneDrive, Dropbox) để đa máy.
              </div>
            </>
          )}

          {mode === 'backup' && lastBackupPath && (
            <div className="backup-success">
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>✓</div>
              <h3 style={{ textAlign: 'center', margin: '0 0 12px', color: '#2bb673' }}>
                Đã sao lưu thành công
              </h3>
              <p className="muted small" style={{ textAlign: 'center' }}>
                File:
              </p>
              <code className="backup-path">{lastBackupPath}</code>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setMode('menu')}>
                  ← Quay lại
                </button>
                <button className="btn btn-primary" onClick={onClose}>
                  Đóng
                </button>
              </div>
            </div>
          )}

          {mode === 'restore-confirm' && restoreCandidate && (
            <div className="backup-restore-confirm">
              <h3 style={{ marginTop: 0 }}>⚠ Xác nhận khôi phục</h3>
              <div className="backup-info-grid">
                <span className="muted">File</span>
                <code>{basename(restoreCandidate.path)}</code>
                <span className="muted">Ngày sao lưu</span>
                <span>{new Date(restoreCandidate.bundle.created_at).toLocaleString()}</span>
                <span className="muted">App version</span>
                <code>{restoreCandidate.bundle.app_version}</code>
                <span className="muted">UID gốc</span>
                <code>{restoreCandidate.bundle.uid ?? '(no uid)'}</code>
                <span className="muted">localStorage entries</span>
                <strong>{Object.keys(restoreCandidate.bundle.localStorage).length}</strong>
                <span className="muted">Data files</span>
                <strong>{Object.keys(restoreCandidate.bundle.data_dir_files).length}</strong>
              </div>
              <p
                style={{
                  background: 'rgba(217, 119, 0, 0.10)',
                  border: '1px solid rgba(217, 119, 0, 0.3)',
                  padding: 10,
                  borderRadius: 4,
                  marginTop: 12,
                  fontSize: 13,
                }}
              >
                <strong>⚠ Cẩn thận:</strong> Khôi phục sẽ <em>ghi đè</em> dữ liệu hiện tại
                (notes, image folders, dashboard...). Khuyến nghị tạo bản sao lưu hiện tại
                trước khi khôi phục.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setMode('menu')} disabled={busy}>
                  Hủy
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void handleConfirmRestore()}
                  disabled={busy}
                  style={{ background: '#d97700', borderColor: '#d97700' }}
                >
                  {busy ? '⏳ Đang khôi phục…' : '↻ Khôi phục (ghi đè)'}
                </button>
              </div>
            </div>
          )}

          {mode === 'auto' && (
            <AutoBackupSettings onBack={() => setMode('menu')} />
          )}

          {mode === 'restored' && restoreSummary && (
            <div className="backup-success">
              <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>✓</div>
              <h3 style={{ textAlign: 'center', margin: '0 0 12px', color: '#2bb673' }}>
                Khôi phục thành công
              </h3>
              <div className="backup-info-grid" style={{ marginTop: 12 }}>
                <span className="muted">localStorage restored</span>
                <strong>{restoreSummary.ls_restored}</strong>
                {restoreSummary.ls_skipped > 0 && (
                  <>
                    <span className="muted">localStorage skipped</span>
                    <strong>{restoreSummary.ls_skipped}</strong>
                  </>
                )}
                <span className="muted">Data files restored</span>
                <strong>{restoreSummary.data_files_restored}</strong>
                {restoreSummary.data_files_failed > 0 && (
                  <>
                    <span className="muted">Data files failed</span>
                    <strong style={{ color: 'var(--danger, #c43)' }}>
                      {restoreSummary.data_files_failed}
                    </strong>
                  </>
                )}
              </div>
              <p style={{ marginTop: 16, fontSize: 13 }}>
                ⚡ <strong>Quan trọng:</strong> Reload app để các module nạp lại data.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={onClose}>
                  Bỏ qua (không reload)
                </button>
                <button className="btn btn-primary" onClick={handleReload}>
                  ↻ Reload app
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Phase 18.4.e — Auto-backup settings panel
// ============================================================

function AutoBackupSettings({ onBack }: { onBack: () => void }): JSX.Element {
  const [prefs, setPrefs] = useState<AutoBackupPrefs>(() => loadAutoBackupPrefs());
  const [savedFlash, setSavedFlash] = useState(false);

  async function pickFolder(): Promise<void> {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === 'string') {
        setPrefs((p) => ({ ...p, folder: picked }));
      }
    } catch (e) {
      console.warn('pick folder fail:', e);
    }
  }

  function save(): void {
    saveAutoBackupPrefs(prefs);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  const lastBackup = getLastBackupMs();
  const lastBackupText =
    lastBackup > 0 ? new Date(lastBackup).toLocaleString('vi-VN') : 'Chưa có';

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>🔁 Sao lưu tự động</h3>
      <p className="muted small">
        Khi bật, app sẽ tự động tạo file backup JSON vào folder cố định theo chu kỳ.
        Backup chạy ngầm khi mở app + định kỳ kiểm tra.
      </p>

      <div className="backup-info-grid" style={{ marginBottom: 14 }}>
        <span className="muted">Lần cuối</span>
        <span>{lastBackupText}</span>
        <span className="muted">Trạng thái</span>
        <span>
          {prefs.enabled ? (
            <span style={{ color: '#2bb673' }}>✓ Đang bật</span>
          ) : (
            <span style={{ color: '#999' }}>○ Đã tắt</span>
          )}
        </span>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => setPrefs((p) => ({ ...p, enabled: e.target.checked }))}
        />
        <strong>Bật sao lưu tự động</strong>
      </label>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Chu kỳ
      </label>
      <div className="segmented" style={{ marginBottom: 14 }}>
        {[
          { v: 1, label: 'Mỗi giờ' },
          { v: 6, label: '6 giờ' },
          { v: 24, label: '24 giờ (mặc định)' },
        ].map((opt) => (
          <button
            key={opt.v}
            type="button"
            className={`seg-btn ${prefs.interval_hours === opt.v ? 'active' : ''}`}
            onClick={() => setPrefs((p) => ({ ...p, interval_hours: opt.v }))}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>
        Folder lưu file backup
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <code
          style={{
            flex: 1,
            background: 'var(--bg)',
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontSize: 11,
            wordBreak: 'break-all',
          }}
        >
          {prefs.folder || '(chưa chọn)'}
        </code>
        <button className="btn btn-ghost btn-sm" onClick={() => void pickFolder()}>
          📁 Chọn…
        </button>
      </div>

      <p className="muted small" style={{ fontSize: 12 }}>
        💡 Recommend: chọn folder Cloud (Google Drive / OneDrive / Dropbox) để file
        backup được sync auto qua nhiều máy.
      </p>

      {savedFlash && (
        <p style={{ color: '#2bb673', fontSize: 13 }}>✓ Đã lưu cài đặt</p>
      )}

      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}
      >
        <button className="btn btn-ghost" onClick={onBack}>
          ← Quay lại
        </button>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={prefs.enabled && !prefs.folder}
          title={prefs.enabled && !prefs.folder ? 'Chọn folder trước khi bật' : ''}
        >
          ✓ Lưu cài đặt
        </button>
      </div>
    </div>
  );
}
