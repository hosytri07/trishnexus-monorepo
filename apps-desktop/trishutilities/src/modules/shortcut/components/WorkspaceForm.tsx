/**
 * WorkspaceForm — Phase 32.6
 *
 * Modal thêm/sửa workspace. Workspace = list shortcut IDs launch theo thứ tự
 * với delay giữa mỗi cái (mặc định 500ms).
 *
 * UI:
 *   - Tên + mô tả
 *   - Delay slider (200-3000ms)
 *   - Shortcut picker: list checkbox (search filter)
 *   - Order: dùng order tick (top-down trong list)
 *   - Buttons Huỷ + Lưu
 */

import { useMemo, useState } from 'react';
import { X, Search, Save, Zap, AlertCircle, GripVertical } from 'lucide-react';
import type { Workspace, Shortcut } from '../types';
import { genId } from '../storage';
import { iconUrl } from '../tauri-bridge';

interface Props {
  initial: Workspace | null;
  shortcuts: Shortcut[];
  onClose: () => void;
  onSave: (workspace: Workspace) => void;
}

export function WorkspaceForm({ initial, shortcuts, onClose, onSave }: Props): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.shortcut_ids ?? []);
  const [delay, setDelay] = useState<number>(initial?.launch_delay_ms ?? 500);
  const [hotkey, setHotkey] = useState(initial?.global_hotkey ?? '');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function toggleShortcut(id: string): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveUp(idx: number): void {
    if (idx === 0) return;
    const next = [...selectedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSelectedIds(next);
  }

  function moveDown(idx: number): void {
    if (idx === selectedIds.length - 1) return;
    const next = [...selectedIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setSelectedIds(next);
  }

  function submit(): void {
    setErr(null);
    if (!name.trim()) {
      setErr('Tên workspace bắt buộc');
      return;
    }
    if (selectedIds.length === 0) {
      setErr('Chọn ít nhất 1 shortcut để workspace có gì mà mở');
      return;
    }
    const now = Date.now();
    const ws: Workspace = {
      id: initial?.id ?? genId('ws'),
      name: name.trim(),
      description: description.trim() || undefined,
      shortcut_ids: selectedIds,
      launch_delay_ms: delay,
      global_hotkey: hotkey.trim() || undefined,
      icon_path: initial?.icon_path,
      created_at: initial?.created_at ?? now,
      updated_at: now,
    };
    onSave(ws);
  }

  // Filter shortcuts theo search
  const filteredShortcuts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (s) => s.name.toLowerCase().includes(q) || s.target.toLowerCase().includes(q),
    );
  }, [shortcuts, search]);

  const isEdit = initial !== null;
  const selectedShortcuts = selectedIds
    .map((id) => shortcuts.find((s) => s.id === id))
    .filter((s): s is Shortcut => Boolean(s));

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
          maxWidth: 720, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 18, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {isEdit ? 'Sửa workspace' : 'Tạo workspace mới'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                Workspace = nhóm shortcut launch cùng lúc với 1 click hoặc hotkey toàn cục.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Tên workspace">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Môi trường thiết kế · Khởi động sáng"
              className="ws-input"
              autoFocus={!isEdit}
            />
          </Field>

          <Field label="Mô tả (optional)">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú ngắn"
              className="ws-input"
            />
          </Field>

          <Field label="Hotkey toàn cục (optional)">
            <input
              type="text"
              value={hotkey}
              onChange={(e) => setHotkey(e.target.value)}
              placeholder="VD: CmdOrCtrl+Alt+W"
              className="ws-input"
              style={{ fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              Bấm tổ hợp phím này ở bất kỳ đâu để launch toàn workspace.
            </p>
          </Field>

          <Field label={`Delay giữa mỗi shortcut: ${delay}ms`}>
            <input
              type="range"
              min={200}
              max={3000}
              step={100}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span>200ms (nhanh, có thể nghẽn)</span>
              <span>3000ms (chậm, ổn định)</span>
            </div>
          </Field>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Thứ tự launch ({selectedShortcuts.length} shortcut)
            </label>
            {selectedShortcuts.length === 0 ? (
              <div style={{
                padding: 16, textAlign: 'center', fontSize: 12,
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface-row)',
                borderRadius: 8,
                border: '1px dashed var(--color-border-default)',
              }}>
                Chưa có shortcut nào. Tick các shortcut bên dưới để thêm.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedShortcuts.map((sc, idx) => (
                  <div
                    key={sc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px',
                      background: 'var(--color-accent-soft)',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <GripVertical size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span style={{ width: 22, textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {idx + 1}
                    </span>
                    {sc.icon_path ? (
                      <img src={iconUrl(sc.icon_path) ?? ''} alt="" style={{ width: 18, height: 18 }} />
                    ) : (
                      <span style={{ width: 18, textAlign: 'center' }}>📱</span>
                    )}
                    <span style={{ flex: 1, color: 'var(--color-text-primary)' }}>{sc.name}</span>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      style={{ width: 26, height: 26, fontSize: 11 }}
                      title="Lên"
                    >
                      ▲
                    </button>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => moveDown(idx)}
                      disabled={idx === selectedShortcuts.length - 1}
                      style={{ width: 26, height: 26, fontSize: 11 }}
                      title="Xuống"
                    >
                      ▼
                    </button>
                    <button
                      className="btn btn-secondary btn-icon"
                      onClick={() => toggleShortcut(sc.id)}
                      style={{ width: 26, height: 26, color: '#ef4444' }}
                      title="Bỏ khỏi workspace"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Picker */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              Thêm shortcut vào workspace
            </label>
            <div className="search-bar" style={{ width: 'auto', marginBottom: 8 }}>
              <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Tìm shortcut..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{
              maxHeight: 220, overflowY: 'auto',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 8, padding: 4,
            }}>
              {filteredShortcuts.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Không có shortcut nào khớp
                </div>
              ) : (
                filteredShortcuts.map((sc) => {
                  const isSelected = selectedIds.includes(sc.id);
                  return (
                    <div
                      key={sc.id}
                      onClick={() => toggleShortcut(sc.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: isSelected ? 'var(--color-accent-soft)' : 'transparent',
                        opacity: isSelected ? 1 : 0.85,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        style={{ accentColor: 'var(--color-accent-primary)' }}
                      />
                      {sc.icon_path ? (
                        <img src={iconUrl(sc.icon_path) ?? ''} alt="" style={{ width: 16, height: 16 }} />
                      ) : (
                        <span style={{ width: 16, textAlign: 'center' }}>📱</span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>{sc.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{sc.group}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {err && (
            <div style={{ display: 'flex', gap: 8, padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name.trim() || selectedIds.length === 0}
          >
            <Save size={14} /> {isEdit ? 'Lưu' : 'Tạo workspace'}
          </button>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
