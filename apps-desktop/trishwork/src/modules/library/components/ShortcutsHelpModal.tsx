/**
 * Phase 18.4.c — Keyboard shortcuts help modal.
 *
 * Mở qua Ctrl+/ hoặc nút ❓ trong topbar.
 * Liệt kê tất cả phím tắt theo nhóm:
 *   - Toàn cục (4 module switching, search, settings, help)
 *   - Ghi chú
 *   - Tài liệu
 *   - Thư viện
 *   - Ảnh
 *   - Editor (TipTap formatting)
 */

import { useEffect, useState } from 'react';

interface Shortcut {
  keys: string;
  desc: string;
}

interface ShortcutGroup {
  icon: string;
  title: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    icon: '🌐',
    title: 'Toàn cục',
    items: [
      { keys: 'Ctrl + 1', desc: 'Mở module Thư viện' },
      { keys: 'Ctrl + 2', desc: 'Mở module Ghi chú' },
      { keys: 'Ctrl + 3', desc: 'Mở module Tài liệu' },
      { keys: 'Ctrl + 4', desc: 'Mở module Ảnh' },
      { keys: 'Ctrl + K', desc: 'Tìm xuyên 4 module (global search)' },
      { keys: 'Ctrl + ,', desc: 'Mở/đóng Cài đặt' },
      { keys: 'Ctrl + /', desc: 'Hiện bảng phím tắt này' },
      { keys: 'Ctrl + Shift + N', desc: 'Mở/đóng Sticky note (ghi nhanh nổi)' },
      { keys: 'Esc', desc: 'Đóng modal hiện tại' },
    ],
  },
  {
    icon: '📝',
    title: 'Ghi chú',
    items: [
      { keys: 'Ctrl + N', desc: 'Tạo ghi chú mới (cá nhân)' },
      { keys: 'Ctrl + S', desc: 'Lưu thủ công ghi chú hiện tại' },
      { keys: 'Ctrl + Shift + D', desc: 'Mở/tạo ghi chú hôm nay (daily note)' },
      { keys: 'Delete', desc: 'Xóa ghi chú hiện tại (soft delete)' },
      { keys: '[[Title]]', desc: 'Wiki-link tới ghi chú khác (gõ trong nội dung)' },
    ],
  },
  {
    icon: '📄',
    title: 'Tài liệu',
    items: [
      { keys: 'Ctrl + N', desc: 'Tạo file mới (chọn template)' },
      { keys: 'Ctrl + O', desc: 'Mở file (.docx, .md, .html, .txt, .pdf)' },
      { keys: 'Ctrl + S', desc: 'Lưu (đuôi mặc định)' },
      { keys: 'Ctrl + Shift + S', desc: 'Lưu thành (chọn đuôi)' },
      { keys: '$x^2$', desc: 'Math notation (tự động giữ syntax khi export)' },
    ],
  },
  {
    icon: '✏ ',
    title: 'Editor (TipTap)',
    items: [
      { keys: 'Ctrl + B', desc: 'Đậm (Bold)' },
      { keys: 'Ctrl + I', desc: 'Nghiêng (Italic)' },
      { keys: 'Ctrl + U', desc: 'Gạch chân (Underline)' },
      { keys: 'Ctrl + Z', desc: 'Hoàn tác (Undo)' },
      { keys: 'Ctrl + Y', desc: 'Làm lại (Redo)' },
      { keys: 'Ctrl + Shift + 1..6', desc: 'Heading H1..H6' },
      { keys: 'Tab / Shift+Tab', desc: 'Thụt lề trong list' },
    ],
  },
  {
    icon: '📚',
    title: 'Thư viện',
    items: [
      { keys: '🔎 nút "Tìm nội dung"', desc: 'Tantivy full-text search PDF/TXT/MD' },
      { keys: '🌐 nút', desc: 'Thêm thư mục từ đường dẫn LAN/UNC' },
      { keys: 'Click row', desc: 'Mở chi tiết file (record open count)' },
      { keys: '📝 Note button', desc: 'Tạo ghi chú về file này' },
    ],
  },
  {
    icon: '🖼',
    title: 'Ảnh',
    items: [
      { keys: '+ Thêm', desc: 'Thêm thư mục ảnh (folder picker)' },
      { keys: '🌐 nút', desc: 'Thêm thư mục mạng LAN (UNC)' },
      { keys: '←  →', desc: 'Ảnh trước / sau' },
      { keys: '↑  ↓', desc: 'Lên / xuống 1 hàng (theo grid)' },
      { keys: 'PageUp/Down', desc: 'Nhảy 3 hàng' },
      { keys: 'Home / End', desc: 'Ảnh đầu / cuối' },
      { keys: 'Enter', desc: 'Mở ảnh bằng app HĐH' },
      { keys: 'Space', desc: 'Toggle chọn (trong chế độ chọn nhiều)' },
      { keys: 'View modes', desc: 'XL · LG · MD · SM · List (thay đổi cỡ thumb)' },
      { keys: 'Tên hiển thị', desc: 'Logical rename — file thật không đổi' },
      { keys: '📤 Xuất file', desc: 'Copy với tên mới + sidecar .note.txt' },
      { keys: '🏷 Đổi tên hàng loạt', desc: 'Pattern {n} {date} {folder} {orig} {ext}' },
    ],
  },
  {
    icon: '📕',
    title: 'PDF Tools',
    items: [
      { keys: '📊 Info', desc: 'Page count, size, metadata' },
      { keys: '🔗 Merge', desc: 'Gộp ≥2 PDF (sắp xếp ↑↓)' },
      { keys: '✂ Split', desc: 'Tách mỗi trang 1 file' },
      { keys: '📤 Extract', desc: 'Range "1-3, 5, 7-10"' },
      { keys: '🗑 Delete', desc: 'Xóa trang theo range' },
      { keys: '🔄 Rotate', desc: '90/180/270°' },
      { keys: '🖼 Images→PDF', desc: 'Gộp ảnh thành PDF (A4/Letter)' },
      { keys: '💧 Watermark', desc: 'Chữ chìm xoay góc tùy chỉnh' },
      { keys: '#️ Page numbers', desc: 'Đánh số "Trang X / Y" footer' },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export function ShortcutsHelpModal({ onClose }: Props): JSX.Element {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Filter: case-insensitive substring match
  const q = filter.trim().toLowerCase();
  const filteredGroups = q
    ? GROUPS.map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.keys.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q),
        ),
      })).filter((g) => g.items.length > 0)
    : GROUPS;

  return (
    <div className="modal-backdrop shortcuts-backdrop" onClick={onClose}>
      <div
        className="shortcuts-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Phím tắt"
      >
        <header className="shortcuts-head">
          <h2>⌨ Phím tắt TrishLibrary</h2>
          <input
            type="text"
            className="shortcuts-filter"
            placeholder="Lọc phím tắt…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
          />
          <button className="mini" onClick={onClose} title="Đóng (Esc)">
            ×
          </button>
        </header>

        <div className="shortcuts-body">
          {filteredGroups.length === 0 ? (
            <div className="shortcuts-empty muted">
              Không tìm thấy phím tắt khớp "<strong>{filter}</strong>"
            </div>
          ) : (
            <div className="shortcuts-grid">
              {filteredGroups.map((g) => (
                <section key={g.title} className="shortcuts-group">
                  <h3>
                    {g.icon} {g.title}{' '}
                    <span className="muted small">({g.items.length})</span>
                  </h3>
                  <ul>
                    {g.items.map((it, i) => (
                      <li key={i}>
                        <span className="shortcut-keys">
                          {renderKeys(it.keys)}
                        </span>
                        <span className="shortcut-desc">{it.desc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="shortcuts-foot muted small">
          <span>
            Tip: <kbd>Ctrl</kbd> + <kbd>/</kbd> mở/đóng panel này.
          </span>
          <span>{filteredGroups.reduce((s, g) => s + g.items.length, 0)} phím tắt</span>
        </footer>
      </div>
    </div>
  );
}

/** Convert "Ctrl + Shift + N" into <kbd> elements. */
function renderKeys(keys: string): JSX.Element {
  // Don't kbd-wrap text labels (containing " " other than separator) like 'View modes'
  const looksLikeKey = /^([A-Za-z0-9]|Ctrl|Shift|Alt|Tab|Esc|Enter|Delete|Backspace|→|←|↑|↓|\$.*|\[.*|🔎.*|🌐.*|\+ .*|📤 .*|📊 .*|🔗 .*|✂ .*|🗑 .*|🔄 .*|🖼 .*|💧 .*|#️.*|📝 .*|Click .*)/i;
  if (!keys.includes('+') && !looksLikeKey.test(keys)) {
    return <span className="shortcut-label">{keys}</span>;
  }
  if (keys.startsWith('$') || keys.startsWith('[[') || keys.startsWith('🔎') || keys.startsWith('🌐') || keys.startsWith('+') || keys.startsWith('📤') || keys.startsWith('📊') || keys.startsWith('🔗') || keys.startsWith('✂') || keys.startsWith('🗑') || keys.startsWith('🔄') || keys.startsWith('🖼') || keys.startsWith('💧') || keys.startsWith('#') || keys.startsWith('📝') || keys.startsWith('Click') || keys.startsWith('Tên') || keys.startsWith('View')) {
    return <span className="shortcut-label">{keys}</span>;
  }
  const parts = keys.split('+').map((s) => s.trim());
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          <kbd>{p}</kbd>
          {i < parts.length - 1 && <span className="kbd-plus"> + </span>}
        </span>
      ))}
    </>
  );
}
