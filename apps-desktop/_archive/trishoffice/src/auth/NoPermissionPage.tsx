/**
 * TrishOffice — No Permission Page (Phase 38.11).
 *
 * Hiển thị khi user thường của hệ sinh thái cố vào TrishOffice nhưng
 * không có quyền:
 *   - Không phải admin hệ sinh thái
 *   - Không có local AppUser do admin tạo
 *
 * Chỉ admin TrishTEAM (role='admin' từ Firebase) hoặc local user (do admin
 * trong app tạo) mới truy cập được.
 */

import { Shield, LogOut, Mail, RefreshCw } from 'lucide-react';
import { useAuth as useEcosystemAuth } from '@trishteam/auth/react';
import logoUrl from '../assets/logo.png';

export function NoPermissionPage(): JSX.Element {
  const { profile, firebaseUser, signOut } = useEcosystemAuth();
  const role = (profile as { role?: string } | null)?.role ?? 'guest';

  function handleSignOut(): void {
    // Phase 38.15 — Hard signout: clear Firebase localStorage + reload
    // (signOut() async có thể hang do network; làm sync trước để chắc chắn)
    try {
      // 1. Clear Firebase auth localStorage (nuke session)
      const fbKeys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith('firebase:') || k.includes('firebaseLocalStorage'))) {
          fbKeys.push(k);
        }
      }
      fbKeys.forEach((k) => window.localStorage.removeItem(k));
      // 2. Clear sessionStorage cũng
      window.sessionStorage.clear();
      // 3. Clear IndexedDB Firebase caches (best effort)
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        void indexedDB
          .databases()
          .then((dbs) =>
            dbs.forEach((db) => {
              if (db.name && db.name.toLowerCase().includes('firebase')) {
                indexedDB.deleteDatabase(db.name);
              }
            }),
          )
          .catch(() => {});
      }
      // 4. Fire-and-forget Firebase signOut (không đợi)
      void signOut().catch(() => {});
    } finally {
      // 5. Hard reload — dùng href = href để force fresh load
      window.location.href = window.location.href;
    }
  }

  function handleHardReset(): void {
    if (
      !window.confirm(
        '⚠️ Reset hoàn toàn TrishOffice?\n\n' +
          'Sẽ xóa TOÀN BỘ data local (users, departments, employees, payroll, Firebase cache, ...) và đăng xuất. App sẽ khởi động lại từ đầu.\n\n' +
          'Tiếp tục?',
      )
    ) {
      return;
    }
    // 1. Clear TOÀN BỘ localStorage (cả trishoffice + firebase)
    window.localStorage.clear();
    // 2. Clear sessionStorage
    window.sessionStorage.clear();
    // 3. Clear IndexedDB
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      void indexedDB
        .databases()
        .then((dbs) => dbs.forEach((db) => db.name && indexedDB.deleteDatabase(db.name)))
        .catch(() => {});
    }
    // 4. Fire-and-forget signOut
    try {
      void signOut().catch(() => {});
    } catch {
      /* ignore */
    }
    // 5. Hard reload
    window.location.href = window.location.href;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-surface-bg, #f4f3f0)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 480,
          maxWidth: '92vw',
          background: 'var(--color-surface-card, #fff)',
          color: 'var(--color-text-primary, #1f2937)',
          borderRadius: 14,
          padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          border: '1px solid var(--color-border-subtle, transparent)',
          textAlign: 'center',
        }}
      >
        {/* Logo + Shield overlay */}
        <div
          style={{
            position: 'relative',
            width: 88,
            height: 88,
            margin: '0 auto 16px',
          }}
        >
          <img
            src={logoUrl}
            alt="TrishOffice"
            style={{ width: 88, height: 88, objectFit: 'contain', opacity: 0.4 }}
          />
          <div
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 40,
              height: 40,
              borderRadius: 20,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid var(--color-surface-card, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={20} color="#dc2626" />
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--color-text-primary, #111827)',
          }}
        >
          Không có quyền truy cập TrishOffice
        </h1>

        <p
          style={{
            margin: '12px 0 0',
            fontSize: 13,
            color: 'var(--color-text-muted, #6B7280)',
            lineHeight: 1.6,
          }}
        >
          TrishOffice là app dành cho doanh nghiệp được cấp quyền nội bộ.
          <br />
          Chỉ <strong>admin hệ sinh thái TrishTEAM</strong> hoặc{' '}
          <strong>nhân viên có account do admin công ty tạo</strong> mới đăng nhập được.
        </p>

        {/* Account info */}
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: 'var(--color-surface-row, #F9FAFB)',
            border: '1px solid var(--color-border-subtle, #E5E7EB)',
            borderRadius: 10,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-text-muted, #6B7280)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Tài khoản TrishTEAM hiện tại
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginTop: 4,
              color: 'var(--color-text-primary, #111827)',
            }}
          >
            {profile?.display_name || firebaseUser?.email || 'Khách'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted, #6B7280)',
              marginTop: 2,
            }}
          >
            Email: {firebaseUser?.email ?? '—'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted, #6B7280)',
              marginTop: 2,
            }}
          >
            Role:{' '}
            <strong style={{ color: '#dc2626' }}>
              {role}
              {role === 'user' || role === 'trial'
                ? ' (chưa được cấp quyền TrishOffice)'
                : ''}
            </strong>
          </div>
        </div>

        {/* Action: contact admin */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--color-accent-soft, rgba(16, 185, 129, 0.08))',
            border: '1px solid var(--color-accent-soft, rgba(16, 185, 129, 0.2))',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--color-text-secondary, #4B5563)',
            lineHeight: 1.5,
            textAlign: 'left',
          }}
        >
          <Mail size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
          Liên hệ <strong>admin công ty</strong> để được cấp account login nội bộ,
          hoặc <strong>admin hệ sinh thái TrishTEAM</strong> để được cấp quyền dùng app.
        </div>

        {/* Action buttons */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => void handleSignOut()}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <LogOut size={14} /> Đăng xuất khỏi TrishTEAM
          </button>

          {/*
           * Phase 38.14 — Reset button chỉ hiển thị trong dev mode.
           * Production build (release) sẽ ẩn để user thường không xóa nhầm.
           */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleHardReset}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: 'var(--color-text-muted, #6B7280)',
                border: '1px solid var(--color-border-default, #D1D5DB)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title="DEV ONLY — Xóa toàn bộ data local + đăng xuất + reload"
            >
              <RefreshCw size={13} /> Reset hoàn toàn
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
