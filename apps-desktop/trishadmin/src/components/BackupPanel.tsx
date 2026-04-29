/**
 * BackupPanel — Phase 19.24.1.
 *
 * Backup / Restore Firestore data từ TrishAdmin desktop.
 *
 * Features:
 *   - Backup now: export tất cả collections → save JSON file local
 *   - Restore from JSON: pick file → preview stats → confirm → import
 *   - Auto-backup: schedule mỗi 7 ngày (lưu localStorage timestamp)
 *   - Backup history: liệt kê các backup gần đây (paths trong localStorage)
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@trishteam/auth/react';
import {
  exportAll,
  importAll,
  computeStats,
  defaultBackupFilename,
  formatBytes,
  type BackupData,
  type BackupStats,
} from '../lib/backup.js';
import {
  pickJsonFile,
  pickSavePath,
  readTextFile,
  writeTextFile,
  isInTauri,
} from '../tauri-bridge.js';
import { writeAudit } from '../lib/firestore-admin.js';

const LAST_BACKUP_KEY = 'trishadmin.last_backup_at';
const BACKUP_HISTORY_KEY = 'trishadmin.backup_history';
const AUTO_BACKUP_INTERVAL_DAYS = 7;
const AUTO_BACKUP_REMINDER_KEY = 'trishadmin.last_auto_reminder';

interface BackupHistoryEntry {
  path: string;
  created_at: number;
  size_bytes: number;
  total_docs: number;
}

function loadHistory(): BackupHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(BACKUP_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackupHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(history: BackupHistoryEntry[]): void {
  try {
    window.localStorage.setItem(
      BACKUP_HISTORY_KEY,
      JSON.stringify(history.slice(0, 20)),
    );
  } catch {
    /* ignore */
  }
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BackupPanel(): JSX.Element {
  const { firebaseUser } = useAuth();
  const adminUid = firebaseUser?.uid ?? '';

  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [progress, setProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' | 'warn' } | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    data: BackupData;
    stats: BackupStats;
    path: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [history, setHistory] = useState<BackupHistoryEntry[]>(() => loadHistory());
  const [lastBackup, setLastBackup] = useState<number | null>(() => {
    try {
      const v = window.localStorage.getItem(LAST_BACKUP_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });

  function flash(tone: 'ok' | 'err' | 'warn', text: string): void {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 5000);
  }

  // Auto-backup reminder check (không tự backup, chỉ nhắc admin)
  useEffect(() => {
    if (!lastBackup) return;
    const ageDays = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
    if (ageDays < AUTO_BACKUP_INTERVAL_DAYS) return;
    // Throttle: chỉ nhắc 1 lần mỗi ngày
    let lastReminder = 0;
    try {
      const v = window.localStorage.getItem(AUTO_BACKUP_REMINDER_KEY);
      if (v) lastReminder = Number(v);
    } catch {
      /* ignore */
    }
    const sinceLastReminderHours = (Date.now() - lastReminder) / (1000 * 60 * 60);
    if (sinceLastReminderHours < 24) return;
    flash('warn', `Đã ${ageDays.toFixed(0)} ngày kể từ lần backup cuối — nên backup ngay.`);
    try {
      window.localStorage.setItem(AUTO_BACKUP_REMINDER_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, [lastBackup]);

  async function handleBackup(): Promise<void> {
    if (!isInTauri()) {
      flash('err', 'Chỉ chạy trong app desktop (không phải dev browser).');
      return;
    }
    setBusy('export');
    setProgress({ msg: 'Đang chuẩn bị…', pct: 0 });
    try {
      const data = await exportAll((msg, pct) => {
        setProgress({ msg, pct: pct ?? 0 });
      });
      const stats = computeStats(data);
      const path = await pickSavePath(defaultBackupFilename(), 'json');
      if (!path) {
        flash('warn', 'Đã huỷ. Không tạo backup.');
        return;
      }
      const json = JSON.stringify(data, null, 2);
      await writeTextFile(path, json);

      // Update state
      const now = Date.now();
      setLastBackup(now);
      try {
        window.localStorage.setItem(LAST_BACKUP_KEY, String(now));
      } catch {
        /* ignore */
      }
      const newEntry: BackupHistoryEntry = {
        path,
        created_at: now,
        size_bytes: stats.sizeBytes,
        total_docs: stats.totalDocs,
      };
      const next = [newEntry, ...history];
      setHistory(next);
      saveHistory(next);

      // Audit log
      try {
        await writeAudit({
          actor_uid: adminUid,
          action: 'backup_export',
          target_type: 'backup_file',
          target_label: path,
          details: {
            total_docs: stats.totalDocs,
            size_bytes: stats.sizeBytes,
          },
        });
      } catch (err) {
        console.warn('audit fail:', err);
      }

      flash(
        'ok',
        `✓ Đã backup ${stats.totalDocs} docs · ${formatBytes(stats.sizeBytes)} → ${path}`,
      );
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function handlePickRestore(): Promise<void> {
    if (!isInTauri()) {
      flash('err', 'Chỉ chạy trong app desktop.');
      return;
    }
    try {
      const path = await pickJsonFile('Chọn file backup JSON');
      if (!path) return;
      const text = await readTextFile(path);
      const data = JSON.parse(text) as BackupData;
      if (data.app !== 'TrishAdmin' || !data.collections) {
        flash('err', 'File không phải backup hợp lệ.');
        return;
      }
      const stats = computeStats(data);
      setRestorePreview({ data, stats, path });
      setConfirmText('');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleConfirmRestore(): Promise<void> {
    if (!restorePreview) return;
    if (confirmText !== 'RESTORE') {
      flash('err', 'Bạn cần gõ "RESTORE" để xác nhận.');
      return;
    }
    setBusy('import');
    setProgress({ msg: 'Bắt đầu restore…', pct: 0 });
    try {
      const result = await importAll(restorePreview.data, (msg, pct) => {
        setProgress({ msg, pct: pct ?? 0 });
      });
      // Audit
      try {
        await writeAudit({
          actor_uid: adminUid,
          action: 'backup_restore',
          target_type: 'backup_file',
          target_label: restorePreview.path,
          details: {
            imported: result.imported,
            failed: result.failed,
            backup_created_at: restorePreview.data.created_at,
          },
        });
      } catch (err) {
        console.warn('audit fail:', err);
      }
      flash(
        result.failed === 0 ? 'ok' : 'warn',
        `Restore xong: ${result.imported} thành công, ${result.failed} lỗi.`,
      );
      setRestorePreview(null);
      setConfirmText('');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const lastBackupAgeDays = lastBackup
    ? Math.floor((Date.now() - lastBackup) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = lastBackupAgeDays !== null && lastBackupAgeDays >= AUTO_BACKUP_INTERVAL_DAYS;

  return (
    <div className="panel-content">
      <header className="panel-header">
        <h1>💾 Backup / Restore</h1>
        <p className="muted">
          Sao lưu Firestore data ra file JSON local. Restore khôi phục từ file backup.
          Khuyến nghị backup mỗi {AUTO_BACKUP_INTERVAL_DAYS} ngày.
        </p>
      </header>

      {toast ? (
        <div
          className={`alert ${
            toast.tone === 'ok' ? 'alert-success' : toast.tone === 'warn' ? 'alert-warning' : 'alert-error'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      {progress ? (
        <div className="progress-card">
          <div className="progress-msg">{progress.msg}</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
          </div>
          <div className="progress-pct">{progress.pct.toFixed(0)}%</div>
        </div>
      ) : null}

      {/* Status card */}
      <section className="status-card">
        <div className="status-row">
          <span className="muted">Backup gần nhất:</span>
          <strong>
            {lastBackup
              ? `${formatDateTime(lastBackup)} · ${lastBackupAgeDays} ngày trước`
              : 'Chưa có backup nào'}
          </strong>
        </div>
        {isStale ? (
          <div className="alert alert-warning small">
            ⚠ Đã quá {AUTO_BACKUP_INTERVAL_DAYS} ngày, nên backup ngay.
          </div>
        ) : null}
      </section>

      {/* Actions */}
      <section className="actions-row">
        <button
          type="button"
          onClick={() => void handleBackup()}
          disabled={busy !== null}
          className="btn btn-primary"
        >
          {busy === 'export' ? '⏳ Đang backup…' : '⬇ Backup ngay'}
        </button>
        <button
          type="button"
          onClick={() => void handlePickRestore()}
          disabled={busy !== null}
          className="btn btn-warning"
        >
          ⬆ Restore từ file JSON
        </button>
      </section>

      {/* Restore preview modal */}
      {restorePreview ? (
        <section className="restore-preview">
          <h3>⚠ Xác nhận restore</h3>
          <p>
            File: <code>{restorePreview.path}</code>
          </p>
          <p className="muted small">
            Backup tạo lúc {formatDateTime(restorePreview.data.created_at)} ·{' '}
            {restorePreview.stats.totalDocs} docs · {formatBytes(restorePreview.stats.sizeBytes)}
          </p>

          <details>
            <summary>Chi tiết collection ({Object.keys(restorePreview.stats.collectionCounts).length})</summary>
            <ul className="collection-list">
              {Object.entries(restorePreview.stats.collectionCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <li key={name}>
                    <code>{name}</code>: {count} docs
                  </li>
                ))}
            </ul>
          </details>

          <div className="alert alert-error small">
            <strong>CẢNH BÁO:</strong> Restore sẽ <strong>ghi đè</strong> tất cả docs cùng ID.
            Action này KHÔNG undo được. Khuyến nghị backup hiện tại trước khi restore.
          </div>

          <label>
            Gõ <code>RESTORE</code> để xác nhận:
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              autoFocus
            />
          </label>

          <div className="actions-row">
            <button
              type="button"
              onClick={() => {
                setRestorePreview(null);
                setConfirmText('');
              }}
              disabled={busy === 'import'}
              className="btn btn-ghost"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmRestore()}
              disabled={busy === 'import' || confirmText !== 'RESTORE'}
              className="btn btn-danger"
            >
              {busy === 'import' ? '⏳ Đang restore…' : '⚠ Restore (ghi đè)'}
            </button>
          </div>
        </section>
      ) : null}

      {/* History */}
      {history.length > 0 ? (
        <section className="history-section">
          <h3>📜 Lịch sử backup ({history.length})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Đường dẫn</th>
                <th>Docs</th>
                <th>Kích thước</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map((h, i) => (
                <tr key={i}>
                  <td>{formatDateTime(h.created_at)}</td>
                  <td>
                    <code className="path-cell" title={h.path}>{h.path}</code>
                  </td>
                  <td>{h.total_docs}</td>
                  <td>{formatBytes(h.size_bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Info */}
      <section className="info-card muted small">
        <p>
          <strong>💡 Backup gồm:</strong> users, keys, posts, announcements, audit, feedback,
          short_links, trishteam_library (+ subcoll links), apps_meta, standards, dinh_muc,
          vat_lieu, roads_vn, sign_images, bridge_images, _meta/posts_counter.
        </p>
        <p>
          <strong>Không backup:</strong> per-user data (notes, library files), telemetry
          (vitals, errors). Files Cloudinary (ảnh) lưu riêng — không ở Firestore.
        </p>
      </section>
    </div>
  );
}
