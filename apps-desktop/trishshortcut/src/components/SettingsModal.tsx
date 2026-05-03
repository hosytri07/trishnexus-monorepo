/**
 * SettingsModal — Phase 32.11 + 32.12
 *
 * Tabs:
 *   - Giao diện: theme, grid size
 *   - Quick launcher: overlay hotkey
 *   - Dữ liệu: backup/restore JSON, mở folder
 *   - Giới thiệu: version, links
 */

import { useState } from 'react';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { X, Palette, Keyboard, Database, Info, Download, Upload, FolderOpen, AlertCircle } from 'lucide-react';
import type { AppSettings, BackupBundle } from '../types';
import { buildBackup, restoreBackup } from '../storage';
import { Toggle } from './Toggle';

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onRestore: () => void;
  onClose: () => void;
  version: string;
}

type Tab = 'appearance' | 'hotkey' | 'data' | 'about';

export function SettingsModal({ settings, onSave, onRestore, onClose, version }: Props): JSX.Element {
  const [tab, setTab] = useState<Tab>('appearance');
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    setDraft({ ...draft, [key]: value });
  }

  function commit(): void {
    onSave(draft);
    onClose();
  }

  async function handleExport(): Promise<void> {
    setMsg(null);
    try {
      const bundle = buildBackup();
      const path = await saveDialog({
        defaultPath: `trishshortcut-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (typeof path !== 'string') return;
      const json = JSON.stringify(bundle, null, 2);
      // Write file qua Tauri fs - nhưng plugin-fs chưa wire. Workaround: dùng download
      // hoặc invoke command Rust. Phase này dùng Blob + download URL.
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split(/[\\/]/).pop() ?? 'backup.json';
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ kind: 'ok', text: `✓ Đã export backup. Browser tải xuống: ${a.download}` });
    } catch (e) {
      setMsg({ kind: 'err', text: `Export fail: ${(e as Error).message}` });
    }
  }

  async function handleImport(): Promise<void> {
    setMsg(null);
    try {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (typeof path !== 'string') return;

      const res = await fetch(`/${path}`);
      // Web fetch của file path local không work cross-origin. Dùng FileReader thay.
      // Workaround: dùng input type=file ẩn trigger.
      // Hoặc đơn giản hơn: invoke Rust command read file. Phase này hard skip,
      // dùng alternative: hidden file input.
      void res; // unused
      // Trigger hidden file input
      const fileInput = document.getElementById('import-json-input') as HTMLInputElement | null;
      if (fileInput) fileInput.click();
    } catch (e) {
      setMsg({ kind: 'err', text: `Import fail: ${(e as Error).message}` });
    }
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as BackupBundle;
      if (!confirm(`Import ${bundle.shortcuts?.length ?? 0} shortcut + ${bundle.workspaces?.length ?? 0} workspace?\n\nDữ liệu hiện tại sẽ bị THAY THẾ.`)) {
        return;
      }
      restoreBackup(bundle);
      onRestore();
      setMsg({ kind: 'ok', text: `✓ Đã import backup` });
    } catch (e2) {
      setMsg({ kind: 'err', text: `JSON không hợp lệ: ${(e2 as Error).message}` });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,14,12,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          maxWidth: 640, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Cài đặt</h2>
          <button className="btn btn-secondary btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '0 18px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <TabBtn icon={<Palette size={14} />} label="Giao diện" active={tab === 'appearance'} onClick={() => setTab('appearance')} />
          <TabBtn icon={<Keyboard size={14} />} label="Hotkey" active={tab === 'hotkey'} onClick={() => setTab('hotkey')} />
          <TabBtn icon={<Database size={14} />} label="Dữ liệu" active={tab === 'data'} onClick={() => setTab('data')} />
          <TabBtn icon={<Info size={14} />} label="Giới thiệu" active={tab === 'about'} onClick={() => setTab('about')} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {tab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Theme">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['light', 'dark', 'auto'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => update('theme', t)}
                      className={draft.theme === t ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ flex: 1 }}
                    >
                      {t === 'light' ? '☀️ Sáng' : t === 'dark' ? '🌙 Tối' : '🔄 Theo OS'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Kích thước thẻ shortcut">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['small', 'medium', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update('grid_size', s)}
                      className={draft.grid_size === s ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{ flex: 1 }}
                    >
                      {s === 'small' ? 'Nhỏ' : s === 'medium' ? 'Vừa' : 'Lớn'}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Phase 32.12 — Close behavior: 2 mode rõ ràng */}
              <Field label="Khi bấm nút X (đóng cửa sổ)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    onClick={() => update('minimize_to_tray_on_close', true)}
                    style={radioOptionStyle(draft.minimize_to_tray_on_close)}
                  >
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>🔽 Thu xuống tray</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        App vẫn chạy nền. Hotkey toàn cục vẫn hoạt động. Click icon tray để mở lại.
                      </div>
                    </div>
                    {draft.minimize_to_tray_on_close && <span style={{ color: 'var(--color-accent-primary)', fontSize: 18 }}>✓</span>}
                  </button>
                  <button
                    onClick={() => update('minimize_to_tray_on_close', false)}
                    style={radioOptionStyle(!draft.minimize_to_tray_on_close)}
                  >
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>❌ Tắt hẳn app</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Thoát hoàn toàn. Hotkey toàn cục cũng tắt. Phải mở lại từ Start Menu.
                      </div>
                    </div>
                    {!draft.minimize_to_tray_on_close && <span style={{ color: 'var(--color-accent-primary)', fontSize: 18 }}>✓</span>}
                  </button>
                </div>
              </Field>

              <ToggleRow
                label="Khởi động cùng Windows"
                hint="Auto-start app khi đăng nhập Windows."
                checked={draft.start_with_windows}
                onChange={(v) => update('start_with_windows', v)}
              />
            </div>
          )}

          {tab === 'hotkey' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Hotkey mở Quick Launcher (overlay)">
                <input
                  type="text"
                  value={draft.overlay_hotkey}
                  onChange={(e) => update('overlay_hotkey', e.target.value)}
                  placeholder="CmdOrCtrl+Space"
                  className="ws-input"
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                  Format: <code>CmdOrCtrl</code>, <code>Ctrl</code>, <code>Alt</code>, <code>Shift</code>, <code>Super</code> + ký tự.<br />
                  Ví dụ: <code>CmdOrCtrl+Space</code> · <code>Alt+F1</code> · <code>Ctrl+Shift+L</code>
                </p>
              </Field>

              <ToggleRow
                label="Smart suggest (gợi ý theo thời gian)"
                hint="Top widget hiện app phù hợp giờ trong ngày (vd 8h sáng → Outlook)."
                checked={draft.smart_suggest}
                onChange={(v) => update('smart_suggest', v)}
              />

              <div style={{ padding: 12, background: 'var(--color-surface-row)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                💡 Hotkey riêng cho từng shortcut / workspace: cấu hình trong form Sửa của shortcut/workspace đó.
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Backup / Restore">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => void handleExport()}>
                    <Download size={14} /> Export JSON (tải về máy)
                  </button>
                  <button className="btn btn-secondary" onClick={() => void handleImport()}>
                    <Upload size={14} /> Import JSON (thay thế dữ liệu hiện tại)
                  </button>
                  <input
                    id="import-json-input"
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={onFilePicked}
                  />
                </div>
              </Field>

              <Field label="Folder dữ liệu local">
                <div style={{ padding: 10, background: 'var(--color-surface-row)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
                  Shortcuts + workspaces + settings: localStorage<br />
                  Icon cache: <code>%LOCALAPPDATA%\vn.trishteam.shortcut\icons</code>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    void import('@tauri-apps/plugin-opener').then((m) =>
                      m.openPath(`${(globalThis as any).process?.env?.LOCALAPPDATA ?? ''}\\vn.trishteam.shortcut`),
                    ).catch(() => {});
                  }}
                >
                  <FolderOpen size={14} /> Mở folder dữ liệu
                </button>
              </Field>

              {msg && (
                <div
                  style={{
                    display: 'flex', gap: 8, padding: 10,
                    background: msg.kind === 'ok' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${msg.kind === 'ok' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
                    borderRadius: 8,
                  }}
                >
                  <AlertCircle size={14} style={{ color: msg.kind === 'ok' ? 'var(--semantic-success)' : '#ef4444', flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: msg.kind === 'ok' ? 'var(--semantic-success)' : '#dc2626' }}>{msg.text}</div>
                </div>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                TrishShortcut
              </div>
              <div>
                Quản lý shortcut Windows: apps, games, folders, URLs với icon hiển thị,
                workspace mode, hotkey toàn cục, quick launcher overlay.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Phiên bản:</span>
                <span style={{ fontFamily: 'monospace' }}>{version}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Tác giả:</span>
                <span>TrishTEAM · hosytri77@gmail.com</span>
                <span style={{ color: 'var(--color-text-muted)' }}>Hệ sinh thái:</span>
                <span>https://trishteam.io.vn</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" onClick={commit}>Lưu</button>
        </div>
      </div>

      <style>{`
        .ws-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--color-border-default);
          border-radius: 8px;
          background: var(--color-surface-bg-elevated);
          color: var(--color-text-primary);
          font-size: 13px;
          font-family: inherit;
          outline: none;
        }
        .ws-input:focus { border-color: var(--color-accent-primary); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: 12, background: 'var(--color-surface-row)', borderRadius: 8,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{hint}</div>}
      </div>
      <div style={{ paddingTop: 2 }}>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function radioOptionStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px',
    background: active ? 'var(--color-accent-soft)' : 'var(--color-surface-row)',
    border: `1px solid ${active ? 'var(--color-accent-primary)' : 'var(--color-border-default)'}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 150ms',
  };
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '12px 14px',
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        marginBottom: -1,
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontSize: 13, fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
