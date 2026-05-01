/**
 * SettingsModal — Phase 22.5.
 * Gather all admin/maintenance toggles into 1 popup:
 *   • Theme switch
 *   • Backup JSON / Restore JSON
 *   • Reset dữ liệu mẫu
 *   • Kiểm tra cập nhật (Tauri updater)
 *   • Audit log preview
 *   • About / version
 */

import { ChangeEvent } from 'react';
import { Settings as SettingsIcon, X, Sun, Moon, Download, Upload, RefreshCcw, Trash2, Info, Cloud, CloudUpload, CloudDownload } from 'lucide-react';

export type AuditLogLite = { id: string; time: string; action: string };

type Props = {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  appVersion: string;
  onCheckUpdate: () => void;
  updateChecking: boolean;
  updateStatus: string | null;
  onExportJson: () => void;
  onImportJson: (e: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  // Phase 22.6.F sync
  onSyncUp: () => void;
  onSyncDown: () => void;
  syncing: boolean;
  lastSyncTime: string;
  logs: AuditLogLite[];
  onClose: () => void;
};

export function SettingsModal({
  theme, setTheme,
  appVersion, onCheckUpdate, updateChecking, updateStatus,
  onExportJson, onImportJson,
  onReset,
  onSyncUp, onSyncDown, syncing, lastSyncTime,
  logs,
  onClose,
}: Props): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" /> Cài đặt
            </h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>
              Giao diện · sao lưu · cập nhật · nhật ký
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} title="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Theme */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Giao diện
          </label>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className={theme === 'light' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTheme('light')}
              style={{ flex: 1 }}
            >
              <Sun className="h-4 w-4" /> Sáng
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTheme('dark')}
              style={{ flex: 1 }}
            >
              <Moon className="h-4 w-4" /> Tối
            </button>
          </div>
        </div>

        {/* Phase 22.6.F — Sync Cloud */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Đồng bộ Cloud (Firestore)
          </label>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Lưu/tải toàn bộ database lên Firebase. Dùng để chuyển máy hoặc collab team. Mỗi tài khoản = 1 database riêng.
            {lastSyncTime && <> Sync gần nhất: <b>{new Date(lastSyncTime).toLocaleString('vi-VN')}</b></>}
          </p>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={onSyncUp} disabled={syncing} style={{ flex: 1 }}>
              <CloudUpload className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Đồng bộ lên Cloud
            </button>
            <button className="btn-secondary" onClick={onSyncDown} disabled={syncing} style={{ flex: 1 }}>
              <CloudDownload className="h-4 w-4" /> Tải về từ Cloud
            </button>
          </div>
        </div>

        {/* Backup JSON */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Sao lưu / khôi phục dữ liệu
          </label>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Tất cả hồ sơ, mục lục, thiết bị, mượn/trả, biểu mẫu lưu trong localStorage. Backup JSON để mang sang máy khác hoặc chia sẻ với team.
          </p>
          <div className="flex gap-2 mt-3">
            <button className="btn-secondary" onClick={onExportJson} style={{ flex: 1 }}>
              <Download className="h-4 w-4" /> Backup JSON
            </button>
            <label className="btn-secondary cursor-pointer" style={{ flex: 1, justifyContent: 'center' }}>
              <Upload className="h-4 w-4" /> Khôi phục JSON
              <input type="file" accept=".json,application/json" onChange={onImportJson} className="hidden" />
            </label>
          </div>
          <button
            className="btn-danger mt-2"
            onClick={onReset}
            style={{ width: '100%' }}
          >
            <Trash2 className="h-4 w-4" /> Khôi phục dữ liệu mẫu (reset)
          </button>
        </div>

        {/* Update */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Phiên bản & cập nhật
          </label>
          <div className="flex items-center justify-between mt-2 p-3 rounded-2xl" style={{ background: 'var(--color-surface-row)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>v{appVersion}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>TrishTEAM ecosystem · 2026</div>
            </div>
            <button className="btn-primary" onClick={onCheckUpdate} disabled={updateChecking}>
              <RefreshCcw className={`h-4 w-4 ${updateChecking ? 'animate-spin' : ''}`} />
              {updateChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </button>
          </div>
          {updateStatus && (
            <div className="mt-2 p-3 rounded-xl flex gap-2 items-start" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{updateStatus}</div>
            </div>
          )}
        </div>

        {/* Audit log */}
        <div className="mt-5">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
            Nhật ký thao tác (gần nhất)
          </label>
          <div className="mt-2 space-y-2" style={{ maxHeight: 220, overflow: 'auto' }}>
            {logs.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Chưa có log nào.</div>}
            {logs.slice(0, 20).map(l => (
              <div key={l.id} className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{new Date(l.time).toLocaleString('vi-VN')}</div>
                <div style={{ marginTop: 2 }}>{l.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
