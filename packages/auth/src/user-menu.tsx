/**
 * UserMenu — avatar + dropdown ở topbar standalone apps.
 *
 * Hiển thị:
 *   - avatar (chữ cái đầu của display_name / email)
 *   - dropdown: email, role badge, demo expiry, nút Đăng xuất
 *
 * Usage: đặt cuối topbar-actions cạnh nút Cài đặt.
 *
 *   <div className="topbar-actions">
 *     <button>...</button>
 *     <UserMenu />
 *   </div>
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './react.js';
import type { UserRole } from '@trishteam/data';

const ROLE_LABEL: Record<UserRole | 'guest', string> = {
  admin: '👑 Admin',
  user: '✓ Đã kích hoạt',
  demo: '⏱ Demo',
  trial: '🔒 Trial',
  guest: '? Khách',
};

const ROLE_COLOR: Record<UserRole | 'guest', string> = {
  admin: '#A855F7',
  user: '#10B981',
  demo: '#F59E0B',
  trial: '#9CA3AF',
  guest: '#9CA3AF',
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function UserMenu(): JSX.Element | null {
  const { firebaseUser, profile, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click outside → close
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent): void {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  if (!firebaseUser) return null;

  const display = profile?.display_name || firebaseUser.email || '?';
  const initial = display.charAt(0).toUpperCase();
  const email = firebaseUser.email ?? '';
  const roleColor = ROLE_COLOR[role];
  const roleLabel = ROLE_LABEL[role];

  let demoLine: string | null = null;
  if (role === 'demo' && profile?.demo_expires_at) {
    const ms = profile.demo_expires_at - Date.now();
    if (ms > 0) {
      const days = Math.ceil(ms / DAY_MS);
      demoLine = `Còn ${days} ngày demo`;
    } else {
      demoLine = 'Demo đã hết hạn';
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${display} — ${roleLabel}`}
        aria-label="Tài khoản"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${roleColor}`,
          background: roleColor,
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0,
        }}
      >
        {initial}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 260,
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 10,
            boxShadow:
              '0 10px 25px -5px rgba(0,0,0,0.18), 0 8px 10px -6px rgba(0,0,0,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
            color: 'var(--text, #111827)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border, #e5e7eb)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: roleColor,
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {display}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted, #6b7280)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={email}
              >
                {email}
              </div>
            </div>
          </div>

          {/* Role + demo info */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border, #e5e7eb)',
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                background: `${roleColor}22`,
                color: roleColor,
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 11,
                marginBottom: demoLine ? 6 : 0,
              }}
            >
              {roleLabel}
            </div>
            {demoLine && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted, #6b7280)',
                  marginTop: 4,
                }}
              >
                {demoLine}
              </div>
            )}
            {role === 'trial' && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--muted, #6b7280)',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                Liên hệ admin để được nâng cấp.
              </div>
            )}
          </div>

          {/* Action: Sign out */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            style={{
              width: '100%',
              padding: '11px 16px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#dc2626',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
            }}
          >
            🚪 Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
