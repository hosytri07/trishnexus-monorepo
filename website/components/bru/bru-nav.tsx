'use client';

/**
 * BruNav — Phase 78 Brutalist navigation.
 *
 * Minimal top nav, no sidebar. Logo trái + 5 link giữa + Sign In/Up hoặc User menu phải.
 * Mobile: hamburger → drawer full-screen.
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Shield, ArrowRight, LogIn, ChevronDown, User, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV_LINKS = [
  { label: 'Ứng dụng', href: '/apps' },
  { label: 'Tải về', href: '/downloads' },
  { label: 'Blog', href: '/blog' },
  { label: 'Hướng dẫn', href: '/huong-dan' },
  { label: 'QR', href: '/qr' },
];

export function BruNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isAdmin, logout, user, role } = useAuth();

  // Click outside to close user menu
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [userMenuOpen]);

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    router.push('/');
  }

  const displayName = user?.name || user?.fullName || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initial = (user?.avatar_initials || displayName?.[0] || 'U').toUpperCase();
  const roleLabel = role === 'admin' ? 'ADMIN' : role === 'user' ? 'USER' : role === 'trial' ? 'TRIAL' : 'GUEST';

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(10, 14, 14, 0.85)',
          backdropFilter: 'saturate(140%) blur(12px)',
          borderBottom: '1px solid var(--bru-border)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--bru-max-width)',
            margin: '0 auto',
            padding: '20px var(--bru-page-px)',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.04em',
              color: 'var(--bru-fg)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            TRISH<span style={{ color: 'var(--bru-accent)' }}>TEAM</span>
            <span
              className="bru-mono"
              style={{
                marginLeft: 12,
                padding: '2px 6px',
                border: '1px solid var(--bru-border-strong)',
                borderRadius: 4,
                fontSize: 10,
                color: 'var(--bru-fg-dim)',
              }}
            >
              v1.0
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            style={{
              display: 'none',
              gap: 4,
              flex: 1,
              justifyContent: 'center',
            }}
            className="md:!flex"
          >
            {NAV_LINKS.map((l) => {
              const active =
                l.href === '/' ? pathname === '/' : pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="bru-mono"
                  style={{
                    padding: '8px 14px',
                    color: active ? 'var(--bru-accent)' : 'var(--bru-fg-dim)',
                    textDecoration: 'none',
                    fontSize: 12,
                    transition: 'color 120ms',
                    borderBottom: active
                      ? '2px solid var(--bru-accent)'
                      : '2px solid transparent',
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Right cluster — Phase 78.6: bỏ Admin button riêng (đã chuyển vào dropdown) */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            {/* Cmd+K hint */}
            <kbd
              className="hidden md:inline-flex bru-mono"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--bru-border)',
                borderRadius: 4,
                fontSize: 10,
                color: 'var(--bru-fg-muted)',
                fontFamily: 'var(--font-family-mono), monospace',
              }}
              title="Bấm Cmd/Ctrl+K để search nhanh"
            >
              ⌘ K
            </kbd>
            {!isAuthenticated ? (
              /* Phase 78.7 — Chi 1 button Sign In (trang /login co toggle Sign Up rieng) */
              <Link
                href="/login"
                className="bru-btn bru-btn-primary bru-btn-sm"
              >
                <LogIn size={14} strokeWidth={2.5} />
                Đăng nhập
                <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            ) : (
              /* User menu dropdown */
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="bru-btn-sm"
                  style={{
                    gap: 10,
                    paddingLeft: 6,
                    paddingRight: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid var(--bru-border)',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--bru-fg)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'border-color 120ms, background 120ms',
                  }}
                  aria-label={`User menu: ${displayName}`}
                  aria-expanded={userMenuOpen}
                  title={displayName}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--bru-accent)';
                    e.currentTarget.style.background = 'var(--bru-accent-soft)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--bru-border)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {user?.photo_url ? (
                    <img
                      src={user.photo_url}
                      alt=""
                      width={28}
                      height={28}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                        border: '1px solid var(--bru-accent)',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--bru-accent)',
                        color: 'var(--bru-accent-fg)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </span>
                  )}
                  <span
                    className="hidden md:inline-flex"
                    style={{
                      fontWeight: 700,
                      textTransform: 'none',
                      letterSpacing: 'normal',
                      fontSize: 13,
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {displayName}
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    style={{
                      transition: 'transform 150ms',
                      transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  />
                </button>

                {userMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      minWidth: 280,
                      background: 'var(--bru-bg-elevated)',
                      border: '2px solid var(--bru-border-strong)',
                      borderRadius: 4,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      boxShadow: '6px 6px 0 var(--bru-accent)',
                      zIndex: 100,
                    }}
                  >
                    {/* Header: avatar + name + role badge + email */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '14px 14px 12px',
                        borderBottom: '1px solid var(--bru-border)',
                        marginBottom: 4,
                      }}
                    >
                      {user?.photo_url ? (
                        <img
                          src={user.photo_url}
                          alt=""
                          width={44}
                          height={44}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: '2px solid var(--bru-accent)',
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'var(--bru-accent)',
                            color: 'var(--bru-accent-fg)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: 20,
                            flexShrink: 0,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {initial}
                        </span>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: 'var(--bru-fg)',
                              letterSpacing: '-0.01em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 160,
                            }}
                          >
                            {displayName}
                          </span>
                          {/* Role badge */}
                          <span
                            className="bru-mono"
                            style={{
                              padding: '2px 6px',
                              borderRadius: 3,
                              fontSize: 9,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              background: isAdmin ? '#F87171' : 'var(--bru-accent-soft)',
                              color: isAdmin ? '#fff' : 'var(--bru-accent)',
                              border: isAdmin ? '1px solid #F87171' : '1px solid var(--bru-accent)',
                            }}
                          >
                            {roleLabel}
                          </span>
                        </div>
                        <div
                          className="bru-mono"
                          style={{
                            fontSize: 10,
                            color: displayEmail ? 'var(--bru-fg-muted)' : 'var(--bru-fg-faint)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontStyle: displayEmail ? 'normal' : 'italic',
                          }}
                          title={displayEmail || 'Chưa có email'}
                        >
                          {displayEmail || '(chưa có email)'}
                        </div>
                      </div>
                    </div>

                    {[
                      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                      { href: '/profile', icon: User, label: 'Hồ sơ' },
                      { href: '/settings', icon: Settings, label: 'Cài đặt' },
                      ...(isAdmin ? [{ href: '/admin', icon: Shield, label: 'Admin Panel' }] : []),
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setUserMenuOpen(false)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            color: 'var(--bru-fg)',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 2,
                            transition: 'background 80ms',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bru-bg)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Icon size={14} strokeWidth={2} />
                          {item.label}
                        </Link>
                      );
                    })}
                    <hr style={{ border: 'none', borderTop: '1px solid var(--bru-border)', margin: '4px 0' }} />
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#F87171',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 2,
                        transition: 'background 80ms',
                        textAlign: 'left',
                        width: '100%',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(248, 113, 113, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <LogOut size={14} strokeWidth={2.5} />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="md:!hidden"
              style={{
                width: 40,
                height: 40,
                border: '2px solid var(--bru-fg)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--bru-fg)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Mở menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bru-bg)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--bru-page-px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: 'var(--bru-fg)',
                textDecoration: 'none',
              }}
            >
              TRISH<span style={{ color: 'var(--bru-accent)' }}>TEAM</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 40,
                height: 40,
                border: '2px solid var(--bru-fg)',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--bru-fg)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>
          <nav style={{ marginTop: 64, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 'clamp(40px, 8vw, 72px)',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'var(--bru-fg)',
                  textDecoration: 'none',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--bru-border)',
                }}
              >
                {l.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 'clamp(40px, 8vw, 72px)',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'var(--bru-accent)',
                  textDecoration: 'none',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--bru-border)',
                }}
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 'clamp(40px, 8vw, 72px)',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'var(--bru-accent)',
                  textDecoration: 'none',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--bru-border)',
                }}
              >
                Đăng nhập →
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
