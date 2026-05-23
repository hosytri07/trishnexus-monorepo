/**
 * ContextMenu — Phase 32.2
 *
 * Right-click menu trên shortcut card.
 * Items: Edit / Open file location / Run as admin / Copy path / Delete.
 */

import { useEffect, useRef } from 'react';
import { Edit3, FolderOpen, Shield, Copy, Trash2, Star } from 'lucide-react';
import type { Shortcut } from '../types';

interface Props {
  shortcut: Shortcut;
  x: number;
  y: number;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onOpenLocation: () => void;
  onRunAsAdmin: () => void;
  onCopyPath: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({
  shortcut, x, y, onEdit, onToggleFavorite, onOpenLocation, onRunAsAdmin, onCopyPath, onDelete, onClose,
}: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function escHandler(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  // Adjust position để không tràn viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 240);

  const isApp = shortcut.type === 'app' || shortcut.type === 'game';

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        minWidth: 200,
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 200,
      }}
    >
      <Item icon={<Edit3 size={14} />} label="Sửa" onClick={onEdit} />
      <Item
        icon={<Star size={14} fill={shortcut.favorite ? '#f59e0b' : 'none'} color={shortcut.favorite ? '#f59e0b' : 'currentColor'} />}
        label={shortcut.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
        onClick={onToggleFavorite}
      />
      {isApp && (
        <Item icon={<Shield size={14} />} label="Chạy as Admin" onClick={onRunAsAdmin} />
      )}
      <Item
        icon={<FolderOpen size={14} />}
        label={shortcut.type === 'url' ? 'Mở URL' : 'Mở vị trí file'}
        onClick={onOpenLocation}
      />
      <Item icon={<Copy size={14} />} label="Copy đường dẫn" onClick={onCopyPath} />
      <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 6px' }} />
      <Item
        icon={<Trash2 size={14} />}
        label="Xoá"
        onClick={onDelete}
        danger
      />
    </div>
  );
}

function Item({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        borderRadius: 6,
        fontSize: 13,
        color: danger ? '#ef4444' : 'var(--color-text-primary)',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'rgba(239,68,68,0.10)'
          : 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
      {label}
    </button>
  );
}
