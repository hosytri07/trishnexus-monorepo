'use client';

/**
 * FocusMode — toggle chế độ "Focus" ẩn SideNav + decor + banner.
 *
 * Kích hoạt:
 *  - Phím "F" (khi không ở trong input/textarea)
 *  - CustomEvent 'trishteam:toggle-focus' (từ Command Palette)
 *  - Click nút nổi góc phải dưới (chỉ hiện khi Focus đang ON)
 *
 * State persist ở localStorage key `trishteam:focus_mode` ('1' / '0').
 * Khi ON: thêm class `focus-mode` vào <body>. Selector CSS (inject 1 lần
 * qua styled-jsx global) ẩn SideNav, ambient decor, banner.
 *
 * LƯU Ý về styled-jsx SWC 0.73 panic:
 *   Không đặt <style jsx> nested trong JSX conditional (như bên trong
 *   button chỉ render khi `on`). Gom vào 1 <style jsx global> top-level.
 */
import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'trishteam:focus_mode';

export function FocusMode() {
  const [on, setOn] = useState(false);

  // Hydrate từ localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === '1') {
        setOn(true);
        document.body.classList.add('focus-mode');
      }
    } catch {
      /* private mode */
    }
  }, []);

  // Sync body class + persist khi state đổi
  useEffect(() => {
    if (on) {
      document.body.classList.add('focus-mode');
    } else {
      document.body.classList.remove('focus-mode');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [on]);

  // Keyboard "F" + CustomEvent
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'f' && e.key !== 'F') return;
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (inField) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setOn((v) => !v);
    }
    function onToggle() {
      setOn((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('trishteam:toggle-focus', onToggle);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('trishteam:toggle-focus', onToggle);
    };
  }, []);

  return (
    <>
      {/* CSS toàn cục — chứa cả rules focus-mode và styling cho nút exit.
          ĐẶT Ở TOP-LEVEL để styled-jsx SWC 0.73 không bị panic. */}
      <style jsx global>{`
        body.focus-mode aside,
        body.focus-mode [data-ambient-decor],
        body.focus-mode .hidden-in-focus {
          display: none !important;
        }
        body.focus-mode .announcements-banner {
          display: none !important;
        }
        body.focus-mode main {
          margin-left: auto;
          margin-right: auto;
        }
        .trishteam-focus-exit-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 400;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--color-accent-primary);
          color: #0b1020;
          border: none;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(74, 222, 128, 0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          animation: trishteam-focus-pulse 250ms ease;
        }
        .trishteam-focus-exit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(74, 222, 128, 0.45);
        }
        @keyframes trishteam-focus-pulse {
          from {
            transform: translateY(6px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {on ? (
        <button
          type="button"
          onClick={() => setOn(false)}
          className="trishteam-focus-exit-btn"
          aria-label="Thoát Focus Mode"
          title="Thoát Focus Mode (F)"
        >
          <Sparkles size={14} strokeWidth={2.25} />
          <span>Focus</span>
          <X size={14} strokeWidth={2.25} />
        </button>
      ) : null}
    </>
  );
}
