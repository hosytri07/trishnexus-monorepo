/**
 * ShortcutForm — Phase 32.2
 *
 * Modal thêm/sửa 1 shortcut. 7 fields:
 *   - name, type, target (with file picker)
 *   - working_dir (auto-fill từ target parent)
 *   - args
 *   - run_as_admin checkbox
 *   - group dropdown (load từ DEFAULT_GROUPS + custom)
 *   - tags (comma-separated input)
 *   - notes (textarea)
 *
 * Buttons: Huỷ + Lưu. Form validation: name + target required.
 */

import { useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { X, FolderOpen, Globe, FileText, Loader2, Save, AlertCircle } from 'lucide-react';
import type { Shortcut, ShortcutType, ShortcutGroup } from '../types';
import { genId } from '../storage';
import { extractIconFromExe, fetchFavicon, iconUrl } from '../tauri-bridge';
import { Toggle } from './Toggle';

interface Props {
  /** null = thêm mới; Shortcut = sửa */
  initial: Shortcut | null;
  groups: ShortcutGroup[];
  onClose: () => void;
  onSave: (shortcut: Shortcut) => void;
}

const TYPE_OPTIONS: { value: ShortcutType; label: string; emoji: string }[] = [
  { value: 'app', label: 'Ứng dụng (.exe)', emoji: '📱' },
  { value: 'game', label: 'Game (.exe)', emoji: '🎮' },
  { value: 'folder', label: 'Thư mục', emoji: '📁' },
  { value: 'url', label: 'URL website', emoji: '🌐' },
  { value: 'file', label: 'File (mở bằng default app)', emoji: '📄' },
  { value: 'uwp', label: 'UWP / Microsoft Store', emoji: '🪟' },
  { value: 'command', label: 'Lệnh hệ thống (notepad/calc/cmd...)', emoji: '💻' },
];

export function ShortcutForm({ initial, groups, onClose, onSave }: Props): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ShortcutType>(initial?.type ?? 'app');
  const [target, setTarget] = useState(initial?.target ?? '');
  const [workingDir, setWorkingDir] = useState(initial?.working_dir ?? '');
  const [args, setArgs] = useState(initial?.args ?? '');
  const [runAsAdmin, setRunAsAdmin] = useState(initial?.run_as_admin ?? false);
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [hotkey, setHotkey] = useState(initial?.global_hotkey ?? '');
  const [group, setGroup] = useState<ShortcutGroup>(initial?.group ?? groups[0] ?? 'Apps');
  const [tags, setTags] = useState<string>(initial?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [iconPath, setIconPath] = useState<string | undefined>(initial?.icon_path);
  const [extractingIcon, setExtractingIcon] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto suggest name từ target khi user pick file mới
  useEffect(() => {
    if (initial) return; // chỉ auto-fill khi thêm mới
    if (!target) return;
    if (name) return;
    const m = target.match(/[\\/]([^\\/]+?)(\.\w+)?$/);
    if (m && m[1]) setName(m[1]);
  }, [target, name, initial]);

  // Auto suggest working_dir từ target parent (cho .exe)
  useEffect(() => {
    if (initial) return;
    if (!target) return;
    if (workingDir) return;
    if (type !== 'app' && type !== 'game') return;
    const m = target.match(/^(.+)[\\/][^\\/]+$/);
    if (m && m[1]) setWorkingDir(m[1]);
  }, [target, workingDir, type, initial]);

  async function pickFile(): Promise<void> {
    try {
      const filters: { name: string; extensions: string[] }[] = [];
      if (type === 'app' || type === 'game') {
        filters.push({ name: 'Ứng dụng', extensions: ['exe', 'lnk', 'bat', 'cmd'] });
      } else if (type === 'file') {
        filters.push({ name: 'Tất cả', extensions: ['*'] });
      }
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters: filters.length > 0 ? filters : undefined,
      });
      if (typeof selected === 'string') {
        setTarget(selected);
      }
    } catch (e) {
      setErr(`Pick file fail: ${(e as Error).message}`);
    }
  }

  async function pickFolder(): Promise<void> {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === 'string') setTarget(selected);
    } catch (e) {
      setErr(`Pick folder fail: ${(e as Error).message}`);
    }
  }

  async function autoExtractIcon(): Promise<void> {
    if (!target) return;
    setExtractingIcon(true);
    setErr(null);
    try {
      let path: string | null = null;
      if (type === 'app' || type === 'game' || type === 'file') {
        path = await extractIconFromExe(target);
      } else if (type === 'url') {
        path = await fetchFavicon(target);
      }
      if (path) setIconPath(path);
      else setErr('Không extract được icon (Phase 32.3 chưa wire — sẽ có sau)');
    } finally {
      setExtractingIcon(false);
    }
  }

  function submit(): void {
    setErr(null);
    if (!name.trim()) {
      setErr('Tên shortcut bắt buộc');
      return;
    }
    if (!target.trim()) {
      setErr('Target (đường dẫn / URL) bắt buộc');
      return;
    }

    const now = Date.now();
    const sc: Shortcut = {
      id: initial?.id ?? genId('sc'),
      name: name.trim(),
      type,
      target: target.trim(),
      working_dir: workingDir.trim() || undefined,
      args: args.trim() || undefined,
      run_as_admin: runAsAdmin || undefined,
      favorite: favorite || undefined,
      icon_path: iconPath,
      group,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      global_hotkey: hotkey.trim() || undefined,
      click_count: initial?.click_count ?? 0,
      last_used_at: initial?.last_used_at,
      created_at: initial?.created_at ?? now,
      updated_at: now,
      notes: notes.trim() || undefined,
    };
    onSave(sc);
  }

  const isEdit = initial !== null;
  const showFilePicker = type === 'app' || type === 'game' || type === 'file';
  const showFolderPicker = type === 'folder';
  const showUrlInput = type === 'url';
  const showUwpInput = type === 'uwp';
  const showCommandInput = type === 'command';

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
          maxWidth: 540, width: '100%', maxHeight: '90vh', overflow: 'auto',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14, padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {isEdit ? 'Sửa shortcut' : 'Thêm shortcut mới'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              {isEdit ? `ID: ${initial!.id}` : 'Điền thông tin shortcut bạn muốn lưu'}
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Type */}
          <Field label="Loại shortcut">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ShortcutType)}
              className="input-field"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Target */}
          <Field label={
            showUrlInput ? 'URL' :
            showUwpInput ? 'AppUserModelID UWP' :
            showCommandInput ? 'Lệnh / tên app trên PATH' :
            'Đường dẫn'
          }>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={
                  showUrlInput ? 'https://example.com' :
                  showUwpInput ? 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App' :
                  showCommandInput ? 'notepad / calc / cmd / powershell / explorer' :
                  showFolderPicker ? 'C:\\Path\\To\\Folder' :
                  'C:\\Program Files\\App\\app.exe'
                }
                className="input-field"
                style={{ flex: 1 }}
              />
              {showFilePicker && (
                <button className="btn btn-secondary btn-icon" onClick={() => void pickFile()} title="Chọn file">
                  <FileText size={14} />
                </button>
              )}
              {showFolderPicker && (
                <button className="btn btn-secondary btn-icon" onClick={() => void pickFolder()} title="Chọn folder">
                  <FolderOpen size={14} />
                </button>
              )}
              {showUrlInput && (
                <button className="btn btn-secondary btn-icon" onClick={() => void autoExtractIcon()} title="Lấy favicon" disabled={!target || extractingIcon}>
                  {extractingIcon ? <Loader2 size={14} className="spin" /> : <Globe size={14} />}
                </button>
              )}
            </div>
            {showUwpInput && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                Mở PowerShell, gõ <code>Get-StartApps</code> để xem AppID đầy đủ.
              </p>
            )}
          </Field>

          {/* Name */}
          <Field label="Tên hiển thị">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Visual Studio Code"
              className="input-field"
              autoFocus={!isEdit}
            />
          </Field>

          {/* Working dir + Args (chỉ app/game) */}
          {(type === 'app' || type === 'game') && (
            <>
              <Field label="Working directory (optional)">
                <input
                  type="text"
                  value={workingDir}
                  onChange={(e) => setWorkingDir(e.target.value)}
                  placeholder="Mặc định = parent của exe"
                  className="input-field"
                />
              </Field>
              <Field label="Command-line args (optional)">
                <input
                  type="text"
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder='VD: --new-window "C:\projects"'
                  className="input-field"
                />
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 12px', background: 'var(--color-surface-row)', borderRadius: 8 }}>
                <Toggle checked={runAsAdmin} onChange={setRunAsAdmin} size="sm" />
                <span>Chạy as Administrator (UAC prompt)</span>
              </div>
            </>
          )}

          {/* Group + Favorite */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Field label="Nhóm">
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="input-field"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px',
                background: favorite ? 'rgba(245,158,11,0.10)' : 'var(--color-surface-row)',
                border: `1px solid ${favorite ? '#f59e0b' : 'var(--color-border-default)'}`,
                borderRadius: 8,
                fontSize: 13,
                color: favorite ? '#b45309' : 'var(--color-text-secondary)',
                fontWeight: favorite ? 600 : 400,
              }}
            >
              <Toggle checked={favorite} onChange={setFavorite} size="sm" accentColor="#f59e0b" />
              <span>⭐ Yêu thích</span>
            </div>
          </div>

          {/* Phase 32.7 — Hotkey toàn cục */}
          <Field label="Hotkey toàn cục (optional)">
            <input
              type="text"
              value={hotkey}
              onChange={(e) => setHotkey(e.target.value)}
              placeholder="VD: CmdOrCtrl+Alt+1"
              className="input-field"
              style={{ fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Bấm tổ hợp phím này ở bất kỳ đâu để launch shortcut. Để trống nếu không cần.
            </p>
          </Field>

          {/* Tags */}
          <Field label="Tags (comma-separated, optional)">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="VD: dev, ide, daily"
              className="input-field"
            />
          </Field>

          {/* Notes */}
          <Field label="Ghi chú (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú riêng — không hiển thị lên card."
              className="input-field"
              rows={2}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          {/* Icon preview */}
          {iconPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--color-surface-row)', borderRadius: 8 }}>
              <img src={iconUrl(iconPath) ?? ''} alt="" style={{ width: 32, height: 32, borderRadius: 6 }} />
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Icon đã extract — sẽ hiển thị trên card</div>
            </div>
          )}
          {!iconPath && (target && (type === 'app' || type === 'game' || type === 'file')) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void autoExtractIcon()}
              disabled={extractingIcon}
              style={{ alignSelf: 'flex-start' }}
            >
              {extractingIcon ? <Loader2 size={14} className="spin" /> : '🎨'} Lấy icon từ file
            </button>
          )}

          {err && (
            <div style={{ display: 'flex', gap: 8, padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
            <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || !target.trim()}>
              <Save size={14} />
              {isEdit ? 'Lưu thay đổi' : 'Thêm shortcut'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .input-field {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--color-border-default);
          border-radius: 8px;
          background: var(--color-surface-bg-elevated);
          color: var(--color-text-primary);
          font-size: 13px;
          font-family: inherit;
          outline: none;
          transition: border-color 150ms;
        }
        .input-field:focus {
          border-color: var(--color-accent-primary);
        }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
