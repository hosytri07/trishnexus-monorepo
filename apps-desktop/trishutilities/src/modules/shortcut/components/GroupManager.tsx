/**
 * GroupManager — Phase 32.2
 * Modal quản lý nhóm: add/edit/delete custom groups.
 */

import { useState } from 'react';
import { X, Plus, Trash2, Edit3, Check } from 'lucide-react';
import type { ShortcutGroup } from '../types';

interface Props {
  groups: ShortcutGroup[];
  shortcutsCount: Map<string, number>; // group → số shortcut
  onSave: (groups: ShortcutGroup[]) => void;
  onClose: () => void;
}

export function GroupManager({ groups, shortcutsCount, onSave, onClose }: Props): JSX.Element {
  const [list, setList] = useState<ShortcutGroup[]>([...groups]);
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  function add(): void {
    const v = newName.trim();
    if (!v) return;
    if (list.includes(v)) return;
    setList([...list, v]);
    setNewName('');
  }

  function startEdit(idx: number): void {
    setEditingIdx(idx);
    setEditValue(list[idx]);
  }

  function commitEdit(): void {
    if (editingIdx === null) return;
    const v = editValue.trim();
    if (!v) {
      setEditingIdx(null);
      return;
    }
    const next = [...list];
    next[editingIdx] = v;
    setList(next);
    setEditingIdx(null);
  }

  function remove(idx: number): void {
    const name = list[idx];
    const count = shortcutsCount.get(name) ?? 0;
    if (count > 0) {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Nhóm "${name}" có ${count} shortcut. Xoá nhóm sẽ không xoá shortcut nhưng các shortcut đó sẽ chuyển về nhóm "Apps". Tiếp tục?`)) {
        return;
      }
    }
    setList(list.filter((_, i) => i !== idx));
  }

  function save(): void {
    onSave(list);
    onClose();
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
          maxWidth: 420, width: '100%',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 14, padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Quản lý nhóm
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
              Thêm / sửa / xoá nhóm. Shortcut trong nhóm bị xoá sẽ chuyển về "Apps".
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* List */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((name, idx) => (
            <div
              key={`${name}-${idx}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px',
                background: 'var(--color-surface-row)',
                borderRadius: 8,
              }}
            >
              {editingIdx === idx ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); }}
                    autoFocus
                    className="input-field"
                    style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                  />
                  <button className="btn btn-secondary btn-icon" onClick={commitEdit} title="Lưu">
                    <Check size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-primary)' }}>{name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {shortcutsCount.get(name) ?? 0} mục
                  </span>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => startEdit(idx)}
                    title="Sửa tên"
                    style={{ width: 28, height: 28 }}
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => remove(idx)}
                    title="Xoá nhóm"
                    style={{ width: 28, height: 28, color: '#ef4444' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Tên nhóm mới (vd: Office, Media)"
            className="input-field"
            style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
          />
          <button className="btn btn-primary" onClick={add} disabled={!newName.trim()}>
            <Plus size={14} /> Thêm
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" onClick={save}>Lưu</button>
        </div>
      </div>
    </div>
  );
}
