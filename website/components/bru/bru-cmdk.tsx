'use client';

/**
 * BruCmdK — Phase 78.6 Global Cmd+K search overlay.
 * Bấm Cmd/Ctrl+K mọi page → mở overlay search nhanh.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Boxes,
  Download,
  Newspaper,
  BookOpen,
  QrCode,
  LayoutDashboard,
  User,
  Settings,
  LogIn,
  GitBranch,
  Map,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: typeof Search;
  section: 'navigate' | 'tool' | 'account' | 'info';
  adminOnly?: boolean;
};

const COMMANDS: Cmd[] = [
  { id: 'home', label: 'Trang chủ', href: '/', icon: Home, section: 'navigate', hint: 'Landing' },
  { id: 'apps', label: 'Ứng dụng', hint: '3 desktop apps', href: '/apps', icon: Boxes, section: 'navigate' },
  { id: 'downloads', label: 'Tải về', hint: 'Installer .exe', href: '/downloads', icon: Download, section: 'navigate' },
  { id: 'blog', label: 'Blog', href: '/blog', icon: Newspaper, section: 'navigate' },
  { id: 'huong-dan', label: 'Hướng dẫn', hint: 'Quick start + FAQ', href: '/huong-dan', icon: BookOpen, section: 'navigate' },
  { id: 'changelog', label: 'Changelog', hint: 'Release notes', href: '/changelog', icon: GitBranch, section: 'info' },
  { id: 'roadmap', label: 'Roadmap', hint: 'Lộ trình công khai', href: '/roadmap', icon: Map, section: 'info' },
  { id: 'qr', label: 'QR Code Generator', hint: 'Tool', href: '/qr', icon: QrCode, section: 'tool' },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'account' },
  { id: 'profile', label: 'Hồ sơ cá nhân', href: '/profile', icon: User, section: 'account' },
  { id: 'settings', label: 'Cài đặt', href: '/settings', icon: Settings, section: 'account' },
  { id: 'login', label: 'Đăng nhập', href: '/login', icon: LogIn, section: 'account' },
  { id: 'signup', label: 'Đăng ký', href: '/login?mode=signup', icon: LogIn, section: 'account' },
  { id: 'admin', label: 'Admin Panel', hint: 'Chỉ admin', href: '/admin', icon: Shield, section: 'account', adminOnly: true },
];

const SECTION_LABELS: Record<Cmd['section'], string> = {
  navigate: 'Đi tới',
  tool: 'Công cụ',
  account: 'Tài khoản',
  info: 'Thông tin',
};

export function BruCmdK() {
  const router = useRouter();
  const { isAdmin, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleCommands = useMemo(() => {
    let cmds = COMMANDS.filter((c) => !c.adminOnly || isAdmin);
    // Hide login/signup if authenticated
    if (isAuthenticated) {
      cmds = cmds.filter((c) => c.id !== 'login' && c.id !== 'signup');
    } else {
      // Hide account-required pages if not authenticated
      cmds = cmds.filter((c) => !['dashboard', 'profile', 'settings'].includes(c.id));
    }
    if (!query.trim()) return cmds;
    const q = query.toLowerCase().trim();
    return cmds.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.hint?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [query, isAdmin, isAuthenticated]);

  // Open with Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus input when opened + reset selection
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Keyboard navigation in list
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, visibleCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = visibleCommands[selectedIdx];
      if (cmd) {
        router.push(cmd.href);
        setOpen(false);
      }
    }
  }

  if (!open) return null;

  // Group by section preserving order
  const grouped: Record<Cmd['section'], Cmd[]> = {
    navigate: [],
    tool: [],
    info: [],
    account: [],
  };
  visibleCommands.forEach((c) => grouped[c.section].push(c));

  let runningIdx = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(5, 8, 8, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        paddingLeft: 16,
        paddingRight: 16,
        animation: 'bru-fade-up 200ms var(--bru-ease) both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          background: 'var(--bru-bg-elevated)',
          border: '2px solid var(--bru-border-strong)',
          borderRadius: 4,
          boxShadow: '8px 8px 0 var(--bru-accent)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: '2px solid var(--bru-border)',
          }}
        >
          <Search size={18} strokeWidth={2.5} style={{ color: 'var(--bru-accent)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Tìm trang, công cụ, lệnh..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--bru-fg)',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          />
          <kbd
            className="bru-mono"
            style={{
              padding: '3px 8px',
              border: '1px solid var(--bru-border-strong)',
              borderRadius: 3,
              fontSize: 10,
              color: 'var(--bru-fg-muted)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 8,
          }}
        >
          {visibleCommands.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <p className="bru-body-sm">Không tìm thấy kết quả.</p>
            </div>
          ) : (
            <>
              {(Object.entries(grouped) as [Cmd['section'], Cmd[]][])
                .filter(([, list]) => list.length > 0)
                .map(([section, list]) => (
                  <div key={section} style={{ marginBottom: 8 }}>
                    <div
                      className="bru-mono"
                      style={{
                        padding: '8px 12px 4px',
                        fontSize: 9,
                        color: 'var(--bru-fg-muted)',
                        letterSpacing: '0.12em',
                      }}
                    >
                      // {SECTION_LABELS[section]}
                    </div>
                    {list.map((cmd) => {
                      const myIdx = runningIdx++;
                      const Icon = cmd.icon;
                      const active = myIdx === selectedIdx;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={() => {
                            router.push(cmd.href);
                            setOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIdx(myIdx)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            border: 'none',
                            background: active ? 'var(--bru-accent-soft)' : 'transparent',
                            borderLeft: active ? '3px solid var(--bru-accent)' : '3px solid transparent',
                            cursor: 'pointer',
                            color: 'var(--bru-fg)',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                            transition: 'background 80ms',
                            borderRadius: 2,
                          }}
                        >
                          <Icon size={14} strokeWidth={2} style={{ color: active ? 'var(--bru-accent)' : 'var(--bru-fg-dim)' }} />
                          <span style={{ flex: 1, fontWeight: active ? 700 : 600, fontSize: 13 }}>
                            {cmd.label}
                          </span>
                          {cmd.hint && (
                            <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 10 }}>
                              {cmd.hint}
                            </span>
                          )}
                          {active && <ArrowRight size={12} strokeWidth={2.5} style={{ color: 'var(--bru-accent)' }} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 18px',
            borderTop: '1px solid var(--bru-border)',
            background: 'var(--bru-bg-deep)',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div className="bru-mono" style={{ fontSize: 10, color: 'var(--bru-fg-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>
              <kbd
                style={{
                  padding: '1px 5px',
                  border: '1px solid var(--bru-border-strong)',
                  borderRadius: 2,
                  marginRight: 4,
                }}
              >
                ↑↓
              </kbd>
              Di chuyển
            </span>
            <span>
              <kbd
                style={{
                  padding: '1px 5px',
                  border: '1px solid var(--bru-border-strong)',
                  borderRadius: 2,
                  marginRight: 4,
                }}
              >
                ↵
              </kbd>
              Chọn
            </span>
            <span>
              <kbd
                style={{
                  padding: '1px 5px',
                  border: '1px solid var(--bru-border-strong)',
                  borderRadius: 2,
                  marginRight: 4,
                }}
              >
                ESC
              </kbd>
              Đóng
            </span>
          </div>
          <span className="bru-mono" style={{ fontSize: 10, color: 'var(--bru-accent)' }}>
            ⌘K / Ctrl+K
          </span>
        </div>
      </div>
    </div>
  );
}
