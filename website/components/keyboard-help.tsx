'use client';

/**
 * KeyboardHelp — modal list phím tắt trên toàn bộ ứng dụng.
 *
 * Mở:
 *  - User gõ "?" (Shift+/) → listener keyboard event
 *  - Command Palette > "Xem toàn bộ phím tắt" → dispatch CustomEvent
 *    'trishteam:open-kbd-help'
 *
 * Đóng: Escape / click backdrop / click nút close.
 *
 * Grouped shortcut:
 *  - Global: Cmd+K · Shift+/ · F · T
 *  - Navigation: G+D · G+O · G+S · G+B · G+P (vim-like leader key "G")
 *  - Command Palette nội bộ: ↑ ↓ Enter
 */
import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

type Shortcut = { keys: string[]; label: string };
type Group = { title: string; items: Shortcut[] };

const GROUPS: Group[] = [
  {
    title: 'Toàn cục',
    items: [
      { keys: ['⌘', 'K'], label: 'Mở Command Palette' },
      { keys: ['Ctrl', 'K'], label: 'Mở Command Palette (Windows/Linux)' },
      { keys: ['Shift', '/'], label: 'Mở bảng phím tắt này' },
      { keys: ['F'], label: 'Bật/tắt Focus Mode (ẩn sidebar + decor)' },
      { keys: ['T'], label: 'Đổi Dark/Light theme' },
      { keys: ['Esc'], label: 'Đóng modal / panel đang mở' },
    ],
  },
  {
    title: 'Điều hướng nhanh (vim-style)',
    items: [
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'O'], label: 'Ôn thi lái xe' },
      { keys: ['G', 'C'], label: 'Chứng chỉ Xây dựng' },
      { keys: ['G', 'S'], label: 'Biển báo' },
      { keys: ['G', 'B'], label: 'Cầu Việt Nam' },
      { keys: ['G', 'P'], label: 'Bảng tin' },
    ],
  },
  {
    title: 'Command Palette',
    items: [
      { keys: ['↑'], label: 'Chọn lệnh phía trên' },
      { keys: ['↓'], label: 'Chọn lệnh phía dưới' },
      { keys: ['↵'], label: 'Thực thi lệnh đang chọn' },
    ],
  },
  {
    title: 'Widget Notes · Pomodoro',
    items: [
      { keys: ['Ctrl', 'Enter'], label: 'Lưu quick note' },
      { keys: ['Space'], label: 'Start/Stop Pomodoro (khi đang hover widget)' },
    ],
  },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // "?" → Shift+/
      const isQuestion = e.key === '?' || (e.shiftKey && e.key === '/');
      // Chỉ trigger khi không đang focus vào input/textarea
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isQuestion && !inField) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    }
    function onCustomOpen() {
      setOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('trishteam:open-kbd-help', onCustomOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('trishteam:open-kbd-help', onCustomOpen);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="kbd-backdrop" onClick={() => setOpen(false)} role="dialog" aria-label="Bảng phím tắt">
      <div className="kbd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <div className="kbd-title">
            <Keyboard size={18} strokeWidth={2} />
            <span>Phím tắt</span>
          </div>
          <button
            type="button"
            className="kbd-close"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="kbd-body">
          {GROUPS.map((g) => (
            <div key={g.title} className="kbd-group">
              <div className="kbd-group-title">{g.title}</div>
              <div className="kbd-rows">
                {g.items.map((sc, i) => (
                  <div key={i} className="kbd-row">
                    <div className="kbd-keys">
                      {sc.keys.map((k, ki) => (
                        <kbd key={ki} className="kbd-key">{k}</kbd>
                      ))}
                    </div>
                    <span className="kbd-label">{sc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="kbd-foot">
          Cowork-mode TrishTEAM · Phase 11.5.13
        </div>

        <style jsx>{`
          .kbd-backdrop {
            position: fixed;
            inset: 0;
            z-index: 500;
            background: var(--color-surface-overlay);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            padding-top: 10vh;
            animation: kbd-fade 150ms ease;
          }
          @keyframes kbd-fade { from { opacity: 0 } to { opacity: 1 } }
          .kbd-panel {
            width: min(720px, 94vw);
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            background: var(--color-surface-bg_elevated);
            border: 1px solid var(--color-border-default);
            border-radius: 14px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.55);
            overflow: hidden;
            animation: kbd-rise 200ms cubic-bezier(0.2, 0, 0, 1);
          }
          @keyframes kbd-rise {
            from { transform: translateY(20px); opacity: 0 }
            to { transform: translateY(0); opacity: 1 }
          }
          .kbd-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            border-bottom: 1px solid var(--color-border-subtle);
          }
          .kbd-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            color: var(--color-text-primary);
          }
          .kbd-title :global(svg) {
            color: var(--color-accent-primary);
          }
          .kbd-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border: 1px solid var(--color-border-subtle);
            background: transparent;
            color: var(--color-text-muted);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.15s;
          }
          .kbd-close:hover {
            background: var(--color-surface-muted);
            color: var(--color-text-primary);
            border-color: var(--color-border-default);
          }
          .kbd-body {
            flex: 1;
            overflow-y: auto;
            padding: 8px 18px 18px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px 28px;
          }
          .kbd-group {
            break-inside: avoid;
          }
          .kbd-group-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-accent-primary);
            margin: 12px 0 8px;
          }
          .kbd-rows {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .kbd-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 6px 8px;
            border-radius: 6px;
            transition: background 0.15s;
          }
          .kbd-row:hover {
            background: var(--color-surface-muted);
          }
          .kbd-keys {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
          }
          .kbd-key {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 22px;
            padding: 0 6px;
            font-size: 11px;
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-weight: 600;
            color: var(--color-text-primary);
            background: var(--color-surface-muted);
            border: 1px solid var(--color-border-default);
            border-radius: 4px;
            box-shadow: 0 1px 0 var(--color-border-strong);
          }
          .kbd-label {
            font-size: 12px;
            color: var(--color-text-secondary);
            text-align: right;
          }
          .kbd-foot {
            padding: 8px 18px;
            border-top: 1px solid var(--color-border-subtle);
            font-size: 11px;
            color: var(--color-text-muted);
            text-align: center;
          }
          @media (max-width: 640px) {
            .kbd-body {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
