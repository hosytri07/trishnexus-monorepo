/**
 * UpdateButton — 13-09: nút "⬆ Cập nhật vX" trên topbar, CÙNG cơ chế S-RETC/TrishQR.
 * Mở app → kiểm latest.json ở GitHub Releases (tauri-plugin-updater, ký minisign) →
 * có bản mới thì hiện nút; bấm → tải (hiện %) → cài → mở lại app. Chạy web (PWA) thì ẩn.
 * Chỉ dùng wrapper trong lib/platform.ts nên bản web không kéo theo @tauri-apps/*.
 */
import { useEffect, useState } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { checkForUpdate, downloadAndInstallUpdate, isTauri, relaunchApp } from '../lib/platform';

export function UpdateButton(): JSX.Element | null {
  const [version, setVersion] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!isTauri()) return;
    const run = (): void => {
      void checkForUpdate().then((r) => { if (r.available && r.version) { setVersion(r.version); setNotes(r.body ?? ''); } });
    };
    run();
    const t = window.setInterval(run, 6 * 60 * 60 * 1000); // kiểm lại mỗi 6 giờ khi app mở lâu
    return () => window.clearInterval(t);
  }, []);

  if (!version) return null;

  async function install(): Promise<void> {
    if (state === 'busy') return;
    if (!window.confirm(`Cập nhật TrishFinance lên v${version}?\n\n${notes || 'Có gì mới: xem trishteam.io.vn'}\n\nApp sẽ tự đóng và mở lại sau khi cài.`)) return;
    setState('busy'); setPct(0);
    try {
      await downloadAndInstallUpdate((loaded, total) => { if (total > 0) setPct(Math.round((loaded / total) * 100)); });
      setState('done');
      await relaunchApp();
    } catch (e) {
      console.error('[update]', e);
      setState('err');
    }
  }

  const label = state === 'busy' ? `Đang tải ${pct}%…` : state === 'done' ? 'Đang mở lại…' : state === 'err' ? 'Cập nhật lỗi — thử lại' : `Cập nhật v${version}`;
  return (
    <button type="button" className="btn-primary" onClick={() => void install()} disabled={state === 'busy' || state === 'done'}
      title={notes || 'Có bản mới'} style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
      <ArrowUpCircle className="h-4 w-4" /> {label}
    </button>
  );
}
