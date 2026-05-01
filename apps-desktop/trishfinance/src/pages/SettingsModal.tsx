/**
 * SettingsModal — Phase 23.7.
 *
 * Global settings: Theme / Sync Firestore / Backup JSON / Reset / Auto-update / Audit log.
 */

import { useState, type ChangeEvent } from 'react';
import { Settings as SettingsIcon, X, Sun, Moon, Download, Upload, RefreshCcw, Trash2, Info, CloudUpload, CloudDownload, Cloud } from 'lucide-react';
import { collection, doc, getDoc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@trishteam/auth/react';
import { useFinanceDb, now, today, createId, appendLog, downloadBlob } from '../state';
import { EMPTY_DB, type FinanceDb } from '../types';
import { useDialog } from '../components/DialogProvider';

type Props = {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  appVersion: string;
  onClose: () => void;
};

export function SettingsModal({ theme, setTheme, appVersion, onClose }: Props): JSX.Element {
  const finance = useFinanceDb();
  const { db, setDb } = finance;
  const { profile } = useAuth();
  const dialog = useDialog();

  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => { try { return localStorage.getItem('trishfinance_last_sync') || ''; } catch { return ''; } });

  async function checkUpdate(): Promise<void> {
    setUpdateChecking(true); setUpdateStatus(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update?.available) {
        setUpdateStatus(`Có bản mới: v${update.version}`);
        const ok = await dialog.confirm(`Có bản cập nhật v${update.version}.\n\nTải + cài đặt + restart app ngay?`, { variant: 'info', okLabel: 'Cập nhật ngay' });
        if (ok) {
          await update.downloadAndInstall();
        }
      } else {
        setUpdateStatus('App đã là phiên bản mới nhất.');
      }
    } catch (e) {
      const msg = (e as Error).message || String(e);
      if (msg.includes('PLACEHOLDER') || msg.includes('pubkey')) {
        setUpdateStatus('Auto-update chưa setup — Trí cần gen RSA key + config.');
      } else {
        setUpdateStatus(`Lỗi: ${msg}`);
      }
    } finally {
      setUpdateChecking(false);
    }
  }

  async function syncToCloud(): Promise<void> {
    if (!profile?.id) { await dialog.alert('Cần đăng nhập trước.', { variant: 'warning' }); return; }
    setSyncing(true); setSyncMsg(null);
    try {
      const fdb = getFirestore();
      const ref = doc(collection(fdb, 'finance_database'), profile.id);
      await setDoc(ref, { ...db, updatedAt: serverTimestamp() });
      const t = now();
      setLastSyncTime(t);
      try { localStorage.setItem('trishfinance_last_sync', t); } catch {}
      setSyncMsg('✓ Đã sync lên Cloud');
      finance.update(d => appendLog(d, 'Sync lên Cloud thành công', 'system'));
    } catch (e) {
      setSyncMsg(`Lỗi sync: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function syncFromCloud(): Promise<void> {
    if (!profile?.id) { await dialog.alert('Cần đăng nhập trước.', { variant: 'warning' }); return; }
    const ok = await dialog.confirm('Tải dữ liệu từ Cloud sẽ GHI ĐÈ toàn bộ database localStorage hiện tại. Tiếp tục?', { variant: 'warning', okLabel: 'Ghi đè' });
    if (!ok) return;
    setSyncing(true); setSyncMsg(null);
    try {
      const fdb = getFirestore();
      const ref = doc(collection(fdb, 'finance_database'), profile.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { setSyncMsg('Cloud chưa có data — sync up trước đã.'); setSyncing(false); return; }
      const data = snap.data() as FinanceDb;
      // Migrate field cũ property/shop singular → array (backward compat)
      const migrated: any = { ...EMPTY_DB, ...data };
      if (migrated.property && !migrated.properties) migrated.properties = [{ ...migrated.property, id: 'prop-legacy', active: true, createdAt: now() }];
      if (migrated.shop && !migrated.shops) migrated.shops = [{ ...migrated.shop, id: 'shop-legacy', active: true, createdAt: now() }];
      delete migrated.property; delete migrated.shop;
      setDb(migrated);
      const t = now();
      setLastSyncTime(t);
      try { localStorage.setItem('trishfinance_last_sync', t); } catch {}
      setSyncMsg('✓ Đã tải từ Cloud');
    } catch (e) {
      setSyncMsg(`Lỗi: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }

  function exportJson(): void {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `trishfinance-backup-${today()}.json`);
  }

  async function importJson(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await dialog.confirm(`Import "${file.name}" sẽ GHI ĐÈ toàn bộ database. Tiếp tục?`, { variant: 'warning', okLabel: 'Ghi đè' });
    if (!ok) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as FinanceDb;
        const migrated: any = { ...EMPTY_DB, ...data };
        if (migrated.property && !migrated.properties) migrated.properties = [{ ...migrated.property, id: 'prop-legacy', active: true, createdAt: now() }];
        if (migrated.shop && !migrated.shops) migrated.shops = [{ ...migrated.shop, id: 'shop-legacy', active: true, createdAt: now() }];
        delete migrated.property; delete migrated.shop;
        setDb(migrated);
        await dialog.alert('Import thành công.', { variant: 'success' });
      } catch (err) {
        await dialog.alert(`Lỗi: ${(err as Error).message}`, { variant: 'danger' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function resetData(): Promise<void> {
    const ok = await dialog.confirm('XOÁ TOÀN BỘ database (nhà trọ + tài chính + bán hàng) về trống?\n\nKhông thể hoàn tác trừ khi có file backup.', { variant: 'danger', okLabel: 'Xoá hết' });
    if (!ok) return;
    const ok2 = await dialog.confirm('CHẮC CHẮN xoá hết? Hành động không thể hoàn tác.', { variant: 'danger', okLabel: 'Vẫn xoá' });
    if (!ok2) return;
    setDb({ ...EMPTY_DB, logs: [{ id: createId('log'), time: now(), action: 'Reset toàn bộ database', module: 'system' }] });
    await dialog.alert('Đã reset. App sẽ trở về trạng thái ban đầu.', { variant: 'success' });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="card-title flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> Cài đặt</h2>
            <p className="card-subtitle" style={{ marginTop: 4 }}>Giao diện · sync · sao lưu · cập nhật · nhật ký</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        {/* Theme */}
        <div className="mt-5">
          <SectionLabel>Giao diện</SectionLabel>
          <div className="flex gap-2 mt-2">
            <button type="button" className={theme === 'light' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTheme('light')} style={{ flex: 1 }}>
              <Sun className="h-4 w-4" /> Sáng
            </button>
            <button type="button" className={theme === 'dark' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTheme('dark')} style={{ flex: 1 }}>
              <Moon className="h-4 w-4" /> Tối
            </button>
          </div>
        </div>

        {/* Sync Cloud */}
        <div className="mt-5">
          <SectionLabel>Đồng bộ Cloud (Firestore)</SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Lưu/tải toàn bộ database lên Firebase. Mỗi tài khoản = 1 database riêng.
            {lastSyncTime && <> Sync gần nhất: <b>{new Date(lastSyncTime).toLocaleString('vi-VN')}</b></>}
          </p>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" onClick={syncToCloud} disabled={syncing} style={{ flex: 1 }}>
              <CloudUpload className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Đồng bộ lên Cloud
            </button>
            <button className="btn-secondary" onClick={syncFromCloud} disabled={syncing} style={{ flex: 1 }}>
              <CloudDownload className="h-4 w-4" /> Tải về từ Cloud
            </button>
          </div>
          {syncMsg && <div className="mt-2 p-3 rounded-xl flex gap-2 items-start" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Cloud className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{syncMsg}</div>
          </div>}
        </div>

        {/* Backup JSON */}
        <div className="mt-5">
          <SectionLabel>Sao lưu / Khôi phục JSON</SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Backup file local — chuyển máy hoặc giữ phòng hờ trước khi import.</p>
          <div className="flex gap-2 mt-3">
            <button className="btn-secondary" onClick={exportJson} style={{ flex: 1 }}>
              <Download className="h-4 w-4" /> Xuất JSON
            </button>
            <label className="btn-secondary cursor-pointer" style={{ flex: 1, justifyContent: 'center' }}>
              <Upload className="h-4 w-4" /> Khôi phục JSON
              <input type="file" accept=".json,application/json" onChange={importJson} className="hidden" />
            </label>
          </div>
          <button className="btn-danger mt-2" onClick={resetData} style={{ width: '100%' }}>
            <Trash2 className="h-4 w-4" /> Xoá hết database
          </button>
        </div>

        {/* Update */}
        <div className="mt-5">
          <SectionLabel>Phiên bản & cập nhật</SectionLabel>
          <div className="flex items-center justify-between mt-2 p-3 rounded-2xl" style={{ background: 'var(--color-surface-row)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>v{appVersion}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>TrishTEAM ecosystem · 2026</div>
            </div>
            <button className="btn-primary" onClick={checkUpdate} disabled={updateChecking}>
              <RefreshCcw className={`h-4 w-4 ${updateChecking ? 'animate-spin' : ''}`} />
              {updateChecking ? 'Đang kiểm tra...' : 'Kiểm tra'}
            </button>
          </div>
          {updateStatus && <div className="mt-2 p-3 rounded-xl flex gap-2 items-start" style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
            <div style={{ fontSize: 12 }}>{updateStatus}</div>
          </div>}
        </div>

        {/* Audit log */}
        <div className="mt-5">
          <SectionLabel>Nhật ký thao tác (gần nhất)</SectionLabel>
          <div className="mt-2 space-y-2" style={{ maxHeight: 200, overflow: 'auto' }}>
            {db.logs.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Chưa có log nào.</div>}
            {db.logs.slice(0, 30).map(l => (
              <div key={l.id} className="rounded-xl p-3" style={{ background: 'var(--color-surface-row)', fontSize: 12 }}>
                <div className="flex justify-between">
                  <b>{new Date(l.time).toLocaleString('vi-VN')}</b>
                  {l.module && <span className="badge">{l.module}</span>}
                </div>
                <div style={{ marginTop: 2, color: 'var(--color-text-secondary)' }}>{l.action}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: any }): JSX.Element {
  return <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.04 }}>{children}</label>;
}
