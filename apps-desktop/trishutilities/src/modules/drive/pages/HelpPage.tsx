/**
 * HelpPage — Phase 26.1.G rewrite cho User app.
 * Bỏ admin sections (Setup Bot, Upload, Folder). Tập trung vào: paste link share,
 * browse Thư viện TrishTEAM, history + bookmark, bảo mật, khắc phục.
 */

import { useState } from 'react';
import {
  BookOpen, Download, Library, History, Shield, AlertTriangle,
  ChevronDown, ChevronRight, Mail,
} from 'lucide-react';

interface Section {
  id: string;
  icon: typeof BookOpen;
  title: string;
  body: JSX.Element;
}

const SECTIONS: Section[] = [
  {
    id: 'download',
    icon: Download,
    title: '1. Tải file qua link share',
    body: (
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <p>Admin TrishTEAM gửi link share qua Zalo / email / Telegram. Link có 2 dạng:</p>
        <ol style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Auto-key</strong>: <code>trishteam.io.vn/drive/share/abc...#k=...</code> — không cần password, click là tải</li>
          <li><strong>Có password</strong>: <code>trishteam.io.vn/drive/share/abc...</code> — admin gửi password riêng (Zalo / SMS)</li>
        </ol>
        <p style={{ marginTop: 8 }}><strong>Cách dùng:</strong></p>
        <ol style={{ paddingLeft: 20, marginTop: 4 }}>
          <li>Mở tab <strong>"Tải file"</strong></li>
          <li>Paste URL vào ô <em>Share URL</em></li>
          <li>Nhập password (nếu admin yêu cầu) — KHÔNG dùng password tài khoản TrishTEAM</li>
          <li>Bấm <em>"Chọn..."</em> → chọn thư mục lưu + tên file</li>
          <li>Bấm <em>"Tải file"</em> → app tự decrypt + verify SHA256 + lưu</li>
        </ol>
      </div>
    ),
  },
  {
    id: 'library',
    icon: Library,
    title: '2. Browse Thư viện TrishTEAM',
    body: (
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <p>Tab <strong>"Thư viện TrishTEAM"</strong> hiển thị file public do admin curate (TCVN, định mức, biểu mẫu, etc.):</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Filter theo folder (App / Tài liệu / Form / Dự án X) qua tab folder</li>
          <li>Search theo tên file</li>
          <li>Click <em>"Tải về"</em> → chọn dest → app tự tải + decrypt</li>
        </ul>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
          💡 Admin quyết định file nào hiện public. File private không hiện trong tab này — chỉ user có URL trực tiếp mới tải được.
        </p>
      </div>
    ),
  },
  {
    id: 'history',
    icon: History,
    title: '3. Lịch sử + bookmark',
    body: (
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <p>Tab <strong>"Lịch sử"</strong> lưu mọi file đã tải qua app:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li><strong>⭐ Bookmark</strong>: đánh dấu file thường xuyên dùng → filter "Bookmark" để xem nhanh</li>
          <li><strong>🏷 Tag</strong>: đặt nhãn tự do (vd "TCVN", "Dự án QL1A")</li>
          <li><strong>📝 Ghi chú</strong>: note cá nhân (vd "đã đọc, dùng cho báo cáo Q1")</li>
          <li><strong>📂 Mở folder chứa</strong>: click icon folder → mở Explorer trỏ vào file</li>
          <li><strong>📋 Copy SHA256</strong>: verify integrity manual</li>
          <li><strong>🗑 Xoá khỏi lịch sử</strong>: chỉ xoá record DB, file trên đĩa KHÔNG bị xoá</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'security',
    icon: Shield,
    title: '4. Bảo mật + zero-knowledge',
    body: (
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <p>TrishDrive zero-knowledge — server <strong>KHÔNG biết nội dung file</strong>:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>File mã hóa <strong>AES-256-GCM</strong> client-side trước khi admin upload Telegram</li>
          <li>Master key derive từ <strong>password share (PBKDF2 100k rounds)</strong></li>
          <li>Server chỉ giữ <em>encrypted blob</em> + chunks Telegram → không decrypt được nếu không có password</li>
          <li>Verify <strong>SHA256</strong> sau khi tải xong → đảm bảo file integrity</li>
          <li>Lịch sử + bookmark + tag + note lưu <strong>local máy</strong> (SQLite trong %APPDATA%/vn.trishteam.drive/user.db)</li>
        </ul>
        <p style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
          ⚠️ Mất password share = mất file. Admin cần gửi password lại hoặc tạo link share mới.
        </p>
      </div>
    ),
  },
  {
    id: 'troubleshoot',
    icon: AlertTriangle,
    title: '5. Khắc phục sự cố',
    body: (
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        <p><strong>"Sai password (decrypt fail)":</strong> Hỏi admin gửi lại password đúng. Password phân biệt hoa/thường.</p>
        <p style={{ marginTop: 8 }}><strong>"SHA256 mismatch":</strong> File corrupt khi tải — bấm tải lại. Nếu vẫn lỗi, báo admin.</p>
        <p style={{ marginTop: 8 }}><strong>"Share đã hết hạn / bị thu hồi":</strong> Admin set timer hết hạn. Liên hệ admin tạo link mới.</p>
        <p style={{ marginTop: 8 }}><strong>"Share đã đạt giới hạn lượt tải":</strong> Admin set max downloads. Liên hệ admin tăng quota hoặc tạo link mới.</p>
        <p style={{ marginTop: 8 }}><strong>"TypeError: Failed to fetch" trong Thư viện:</strong> Mạng yếu hoặc Vercel tạm down. Bấm Reload sau 30s.</p>
      </div>
    ),
  },
];

export function HelpPage(): JSX.Element {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(['download']));

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="card">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: 'var(--color-accent-primary)' }} />
          <h2 className="card-title">Hướng dẫn TrishDrive User app</h2>
        </div>
        <p className="card-subtitle" style={{ marginTop: 4 }}>
          Tải file từ admin TrishTEAM qua share link · zero-knowledge encryption · click từng mục để mở/đóng.
        </p>
      </div>

      {SECTIONS.map(s => {
        const open = openIds.has(s.id);
        const Icon = s.icon;
        return (
          <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(s.id)}
              style={{
                width: '100%', padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon className="h-4 w-4" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {s.title}
                </div>
              </div>
              {open ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />}
            </button>
            {open && (
              <div style={{ padding: '0 18px 18px 66px', borderTop: '1px solid var(--color-border-subtle)' }}>
                <div style={{ paddingTop: 14 }}>
                  {s.body}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Contact card */}
      <div className="card" style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent-primary)' }}>
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5" style={{ color: 'var(--color-accent-primary)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent-primary)' }}>Cần hỗ trợ?</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              Email: <strong>trishteam.official@gmail.com</strong> · Web: <a href="https://trishteam.io.vn" target="_blank" rel="noopener" style={{ color: 'var(--color-text-link)' }}>trishteam.io.vn</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
