'use client';

/**
 * CommandPalette — Cmd+K / Ctrl+K spotlight kiểu Raycast/Linear.
 *
 * Lightweight impl (không cần cmdk lib):
 *  - Mở bằng Cmd/Ctrl+K, đóng bằng Escape / click outside / select
 *  - Fuzzy search client-side (substring match, case-insensitive, accents-folded)
 *  - Navigation: ↑ ↓ chuyển pick, Enter execute
 *  - Commands chia group: Navigation · Actions · Apps
 *  - Có thể mở rộng: gắn vào global event để component khác push command
 *
 * Không lưu state ngoài → state-less, an toàn SSR.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Car,
  FileBadge,
  Signpost,
  Waypoints,
  Newspaper,
  Settings,
  LogIn,
  Sun,
  Moon,
  Sparkles,
  Command as CommandIcon,
  type LucideIcon,
} from 'lucide-react';

type CmdGroup = 'Điều hướng' | 'Hành động' | 'Ứng dụng';

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: CmdGroup;
  icon: LucideIcon;
  shortcut?: string;
  href?: string;
  run?: () => void;
};

/** Bỏ dấu tiếng Việt để search dễ hơn ("lai xe" match "lái xe"). */
function foldVN(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

type ThemeHook = {
  theme: 'dark' | 'light';
  toggle: () => void;
};

export function CommandPalette({ theme }: { theme?: ThemeHook }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** Command registry — static cho đơn giản. Có thể mở rộng thành global store. */
  const COMMANDS: Cmd[] = useMemo(
    () => [
      // Navigation
      { id: 'home', label: 'Dashboard', hint: 'Trang chủ', group: 'Điều hướng', icon: Home, href: '/' },
      { id: 'driving', label: 'Ôn thi lái xe', hint: 'A1 · B1 · B2 · C', group: 'Điều hướng', icon: Car, href: '/driving-test' },
      { id: 'certs', label: 'Chứng chỉ Xây dựng', hint: '345 câu hỏi', group: 'Điều hướng', icon: FileBadge, href: '/certificates' },
      { id: 'signs', label: 'Biển báo giao thông', hint: 'QC41:2024', group: 'Điều hướng', icon: Signpost, href: '/traffic-signs' },
      { id: 'bridges', label: 'Cầu Việt Nam', hint: '7.897 cầu', group: 'Điều hướng', icon: Waypoints, href: '/bridges' },
      { id: 'posts', label: 'Bảng tin', hint: 'Bài viết mới', group: 'Điều hướng', icon: Newspaper, href: '/posts' },

      // Actions
      {
        id: 'toggle-theme',
        label: theme?.theme === 'dark' ? 'Chuyển sang Light mode' : 'Chuyển sang Dark mode',
        hint: 'Đổi giao diện sáng/tối',
        group: 'Hành động',
        icon: theme?.theme === 'dark' ? Sun : Moon,
        shortcut: 'T',
        run: () => theme?.toggle(),
      },
      {
        id: 'keyboard-help',
        label: 'Xem toàn bộ phím tắt',
        hint: 'Mở bảng phím tắt',
        group: 'Hành động',
        icon: CommandIcon,
        shortcut: '?',
        run: () => {
          window.dispatchEvent(new CustomEvent('trishteam:open-kbd-help'));
        },
      },
      {
        id: 'focus-mode',
        label: 'Bật/tắt Focus Mode',
        hint: 'Ẩn sidebar + decor',
        group: 'Hành động',
        icon: Sparkles,
        shortcut: 'F',
        run: () => {
          window.dispatchEvent(new CustomEvent('trishteam:toggle-focus'));
        },
      },
      { id: 'login', label: 'Đăng nhập', hint: 'Firebase Auth (Phase 11.6)', group: 'Hành động', icon: LogIn, href: '/login' },
      { id: 'settings', label: 'Cài đặt', hint: 'Tùy chọn tài khoản', group: 'Hành động', icon: Settings, href: '/settings' },

      // External apps (shortcut)
      { id: 'gmail', label: 'Mở Gmail', group: 'Ứng dụng', icon: Sparkles, href: 'https://mail.google.com' },
      { id: 'drive', label: 'Mở Google Drive', group: 'Ứng dụng', icon: Sparkles, href: 'https://drive.google.com' },
      { id: 'zalo', label: 'Mở Zalo Web', group: 'Ứng dụng', icon: Sparkles, href: 'https://chat.zalo.me' },
      { id: 'gh', label: 'Mở GitHub', group: 'Ứng dụng', icon: Sparkles, href: 'https://github.com' },
    ],
    [theme?.theme]
  );

  /** Lọc theo query + group giữ nguyên thứ tự. */
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = foldVN(query.trim());
    return COMMANDS.filter((c) => {
      const hay = foldVN(`${c.label} ${c.hint ?? ''} ${c.group}`);
      return hay.includes(q);
    });
  }, [query, COMMANDS]);

  /** Group map — giữ thứ tự Điều hướng → Hành động → Ứng dụng. */
  const grouped = useMemo(() => {
    const order: CmdGroup[] = ['Điều hướng', 'Hành động', 'Ứng dụng'];
    return order
      .map((g) => ({ group: g, items: filtered.filter((c) => c.group === g) }))
      .filter((x) => x.items.length > 0);
  }, [filtered]);

  /** Flat list để pick bằng index. */
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Keep picked in-range khi filter đổi
  useEffect(() => {
    if (picked >= flat.length) setPicked(0);
  }, [flat.length, picked]);

  // Global shortcut: Cmd/Ctrl+K toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus input when open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setPicked(0);
    }
  }, [open]);

  const execute = (cmd: Cmd) => {
    setOpen(false);
    if (cmd.run) {
      cmd.run();
      return;
    }
    if (cmd.href) {
      if (cmd.href.startsWith('http')) {
        window.open(cmd.href, '_blank', 'noopener,noreferrer');
      } else {
        router.push(cmd.href);
      }
    }
  };

  const onListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPicked((p) => (p + 1) % Math.max(flat.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPicked((p) => (p - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[picked];
      if (cmd) execute(cmd);
    }
  };

  if (!open) return null;

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)} role="dialog" aria-label="Command palette">
      <div
        className="cmdk-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="cmdk-search">
          <Search size={16} strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm lệnh, trang, hành động… (vd: lai xe, theme, focus)"
            aria-label="Command palette search"
          />
          <kbd>ESC</kbd>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {grouped.length === 0 ? (
            <div className="cmdk-empty">Không tìm thấy lệnh nào.</div>
          ) : (
            grouped.map((g) => {
              // offset index global cho item trong group này
              let offset = 0;
              for (const gg of grouped) {
                if (gg.group === g.group) break;
                offset += gg.items.length;
              }
              return (
                <div key={g.group} className="cmdk-group">
                  <div className="cmdk-group-label">{g.group}</div>
                  {g.items.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    const active = offset + idx === picked;
                    return (
                      <button
                        type="button"
                        key={cmd.id}
                        className={`cmdk-item${active ? ' is-active' : ''}`}
                        onMouseEnter={() => setPicked(offset + idx)}
                        onClick={() => execute(cmd)}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <div className="cmdk-item-main">
                          <div className="cmdk-item-label">{cmd.label}</div>
                          {cmd.hint && <div className="cmdk-item-hint">{cmd.hint}</div>}
                        </div>
                        {cmd.shortcut && <kbd className="cmdk-item-kbd">{cmd.shortcut}</kbd>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> di chuyển</span>
          <span><kbd>↵</kbd> chọn</span>
          <span><kbd>Esc</kbd> đóng</span>
        </div>

        <style jsx>{`
          .cmdk-backdrop {
            position: fixed;
            inset: 0;
            z-index: 500;
            background: var(--color-surface-overlay);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            padding-top: 12vh;
            animation: cmdk-fade 150ms ease;
          }
          @keyframes cmdk-fade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .cmdk-panel {
            width: min(640px, 92vw);
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            background: var(--color-surface-bg_elevated);
            border: 1px solid var(--color-border-default);
            border-radius: 12px;
            box-shadow: var(--shadow-2xl, 0 30px 60px rgba(0,0,0,0.6));
            overflow: hidden;
            animation: cmdk-rise 200ms cubic-bezier(0.2, 0, 0, 1);
          }
          @keyframes cmdk-rise {
            from { transform: translateY(16px) scale(0.98); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
          }
          .cmdk-search {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--color-border-subtle);
            color: var(--color-text-muted);
          }
          .cmdk-search input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: var(--color-text-primary);
            font-size: 14px;
            font-family: inherit;
          }
          .cmdk-search kbd {
            font-size: 10px;
            padding: 2px 6px;
            border: 1px solid var(--color-border-default);
            border-radius: 4px;
            background: var(--color-surface-muted);
            color: var(--color-text-muted);
          }
          .cmdk-list {
            flex: 1;
            overflow-y: auto;
            padding: 6px 0;
          }
          .cmdk-group {
            padding: 4px 6px 8px;
          }
          .cmdk-group-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-text-muted);
            padding: 4px 12px 6px;
          }
          .cmdk-item {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 8px 12px;
            border: none;
            background: transparent;
            color: var(--color-text-primary);
            border-radius: 6px;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
            font-size: 13px;
            transition: background 0.1s;
          }
          .cmdk-item.is-active {
            background: var(--color-surface-muted);
          }
          .cmdk-item :global(svg) {
            flex-shrink: 0;
            color: var(--color-text-muted);
          }
          .cmdk-item.is-active :global(svg) {
            color: var(--color-accent-primary);
          }
          .cmdk-item-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          .cmdk-item-label {
            font-weight: 500;
          }
          .cmdk-item-hint {
            font-size: 11px;
            color: var(--color-text-muted);
          }
          .cmdk-item-kbd {
            font-size: 10px;
            padding: 2px 6px;
            border: 1px solid var(--color-border-default);
            border-radius: 4px;
            background: var(--color-surface-muted);
            color: var(--color-text-muted);
            font-family: 'JetBrains Mono', monospace;
          }
          .cmdk-empty {
            padding: 28px 16px;
            text-align: center;
            color: var(--color-text-muted);
            font-size: 13px;
          }
          .cmdk-foot {
            display: flex;
            gap: 16px;
            padding: 8px 14px;
            border-top: 1px solid var(--color-border-subtle);
            font-size: 11px;
            color: var(--color-text-muted);
          }
          .cmdk-foot kbd {
            font-size: 10px;
            padding: 1px 5px;
            margin-right: 3px;
            border: 1px solid var(--color-border-default);
            border-radius: 3px;
            background: var(--color-surface-muted);
          }
        `}</style>
      </div>
    </div>
  );
}
