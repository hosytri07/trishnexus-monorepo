/**
 * HelpPage — Phase 22.7d
 * Hướng dẫn sử dụng TrishDrive cho user mới.
 */

import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Bot, Upload, Download, Share2, Folder, ShieldCheck,
  ChevronDown, ChevronRight, ExternalLink, AlertTriangle, BookOpen, MessagesSquare,
} from 'lucide-react';

type SectionId = 'setup' | 'upload' | 'download' | 'share' | 'folder' | 'security' | 'troubleshoot';

const SECTIONS: Array<{
  id: SectionId;
  icon: typeof Bot;
  title: string;
  badge?: string;
}> = [
  { id: 'setup',        icon: Bot,         title: '1. Setup Telegram bot lần đầu', badge: 'Bắt buộc' },
  { id: 'upload',       icon: Upload,      title: '2. Upload file' },
  { id: 'download',     icon: Download,    title: '3. Download / Xoá file' },
  { id: 'share',        icon: Share2,      title: '4. Tạo link chia sẻ', badge: 'Mới' },
  { id: 'folder',       icon: Folder,      title: '5. Folder + ghi chú' },
  { id: 'security',     icon: ShieldCheck, title: '6. Bảo mật + zero-knowledge' },
  { id: 'troubleshoot', icon: AlertTriangle, title: '7. Khắc phục sự cố' },
];

export function HelpPage(): JSX.Element {
  const [open, setOpen] = useState<SectionId | null>('setup');

  return (
    <div className="max-w-4xl space-y-3">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title flex items-center gap-2"><BookOpen className="h-5 w-5" /> Hướng dẫn TrishDrive</h2>
            <p className="card-subtitle">
              Cloud Storage cá nhân qua Telegram · không giới hạn dung lượng · zero-knowledge encryption.
              Click từng mục để mở/đóng.
            </p>
          </div>
        </div>
      </div>

      {SECTIONS.map(s => {
        const Icon = s.icon;
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(isOpen ? null : s.id)}
              className="w-full flex items-center gap-3 text-left transition"
              style={{ padding: '14px 18px', background: isOpen ? 'var(--color-surface-row)' : 'transparent', cursor: 'pointer', border: 'none' }}
            >
              <div style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-primary)', padding: 8, borderRadius: 10 }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {s.title}
                  {s.badge && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--color-accent-gradient)', color: 'white', marginLeft: 8, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                      {s.badge}
                    </span>
                  )}
                </div>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {isOpen && (
              <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid var(--color-border-subtle)' }}>
                {s.id === 'setup' && <SetupSection />}
                {s.id === 'upload' && <UploadSection />}
                {s.id === 'download' && <DownloadSection />}
                {s.id === 'share' && <ShareSection />}
                {s.id === 'folder' && <FolderSection />}
                {s.id === 'security' && <SecuritySection />}
                {s.id === 'troubleshoot' && <TroubleshootSection />}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ background: 'var(--color-accent-soft)' }}>
        <div className="flex gap-3 items-start">
          <MessagesSquare className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent-primary)' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Câu hỏi khác?</div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              Email: <strong>trishteam.official@gmail.com</strong> · Web:{' '}
              <button onClick={() => openUrl('https://trishteam.io.vn')} style={{ color: 'var(--color-text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>trishteam.io.vn</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Section content
// ============================================================

function P({ children }: { children: React.ReactNode }): JSX.Element {
  return <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 12 }}>{children}</p>;
}

function H({ children }: { children: React.ReactNode }): JSX.Element {
  return <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 16 }}>{children}</h3>;
}

function Code({ children }: { children: React.ReactNode }): JSX.Element {
  return <code style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, background: 'var(--color-surface-row)', fontFamily: 'monospace', color: 'var(--color-accent-primary)' }}>{children}</code>;
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <button onClick={() => openUrl(href)} style={{ color: 'var(--color-text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {children} <ExternalLink className="h-3 w-3" />
    </button>
  );
}

function SetupSection(): JSX.Element {
  return (
    <>
      <P>TrishDrive dùng <strong>Telegram bot riêng của bạn</strong> để upload file vào <strong>private channel</strong> của bạn. Free, không quota.</P>
      <H>Bước 1 — Tạo bot</H>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Mở Telegram → tìm <ExtLink href="https://t.me/BotFather">@BotFather</ExtLink></li>
        <li>Gõ <Code>/newbot</Code> → đặt tên (vd: <em>TrishDrive Personal</em>)</li>
        <li>Đặt username (phải kết thúc bằng <Code>bot</Code>, vd: <Code>tridrive_bot</Code>)</li>
        <li>BotFather trả về <strong>BOT TOKEN</strong> dạng <Code>123456789:AAxxxx</Code> — copy lại</li>
      </ol>
      <H>Bước 2 — Tạo private channel</H>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Telegram → New Channel → đặt tên + chọn <strong>Private</strong></li>
        <li>Vào Channel info → Administrators → Add Admin → tìm bot vừa tạo → cấp quyền</li>
        <li>Lấy CHANNEL ID: forward 1 tin nhắn từ channel cho <ExtLink href="https://t.me/RawDataBot">@RawDataBot</ExtLink> → copy <Code>chat.id</Code> dạng <Code>-1001234567890</Code></li>
      </ol>
      <H>Bước 3 — Setup trong app</H>
      <P>Mở TrishDrive → wizard sẽ hiện 4 bước → paste token + channel ID + đặt passphrase ≥ 8 ký tự.</P>
      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 12, marginTop: 12 }}>
        <strong style={{ fontSize: 12, color: '#dc2626' }}>⚠ KHÔNG QUÊN PASSPHRASE</strong>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Passphrase derive AES-256 master key. Nếu mất → file đã upload không decrypt lại được.
          Lưu password manager (1Password, Bitwarden) hoặc giấy đặt nơi an toàn.
        </p>
      </div>
    </>
  );
}

function UploadSection(): JSX.Element {
  return (
    <>
      <P>Upload bao nhiêu file cũng được, mỗi file lên tới vài GB. App tự chia chunk 19MB phía sau, recipient nhận được 1 file nguyên.</P>
      <H>Cách upload</H>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Tab <strong>Upload</strong> bên trái</li>
        <li>Click vào dropzone → chọn file</li>
        <li>(Tuỳ chọn) Chọn folder + nhập ghi chú</li>
        <li>Click <strong>Upload</strong></li>
        <li>Xem progress bar % real-time + tốc độ MB/s + ETA</li>
      </ol>
      <H>File lớn ≥ 1GB</H>
      <P>App đọc file streaming (không load full vào RAM), nên upload file 5GB+ vẫn OK. Chia chunk 19MB → 5GB ≈ 270 chunks → upload tuần tự ~30-60 phút tuỳ tốc độ mạng.</P>
      <H>Giới hạn hiện tại</H>
      <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Chunk size 19MB (Bot API getFile limit 20MB)</li>
        <li>Upload tuần tự (chưa parallel)</li>
        <li>Chưa pause/resume</li>
        <li>Dung lượng tổng: <strong>không giới hạn</strong> (Telegram free unlimited channel size)</li>
      </ul>
    </>
  );
}

function DownloadSection(): JSX.Element {
  return (
    <>
      <H>Download file của bạn</H>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Tab <strong>File của tôi</strong></li>
        <li>Click icon <strong>⬇</strong> trên row file muốn tải</li>
        <li>Chọn nơi save</li>
        <li>App stream chunks từ Telegram → decrypt → ghi file → verify SHA-256</li>
      </ol>
      <P>App tự động ghép tất cả chunks thành 1 file nguyên giống bản gốc. Recipient KHÔNG thấy chunks.</P>
      <H>Xoá file</H>
      <P>Click icon <strong>🗑</strong> → confirm → app xoá tất cả chunks trên Telegram channel + remove SQLite index. Không khôi phục được.</P>
      <H>Sửa thông tin</H>
      <P>Click icon <strong>✎</strong> → đổi tên file / chuyển folder / sửa ghi chú. Không ảnh hưởng nội dung file trên Telegram.</P>
    </>
  );
}

function ShareSection(): JSX.Element {
  return (
    <>
      <P>Tạo link share cho người khác tải file. Người nhận KHÔNG cần TrishDrive — chỉ cần browser + password bạn cấp.</P>
      <H>Cách tạo link</H>
      <ol style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Tab <strong>File của tôi</strong> → click icon <strong>🔗 Share</strong> trên row file</li>
        <li>Đặt password riêng (≥ 8 ký tự) cho lần share này</li>
        <li>Chọn thời hạn (1h / 1 ngày / 7 ngày / 30 ngày / không hết hạn)</li>
        <li>Chọn max lượt tải (1 / 5 / 10 / 50 / không giới hạn)</li>
        <li>Click <strong>Tạo link share</strong> → copy URL</li>
      </ol>
      <H>Gửi cho người nhận</H>
      <P>
        Gửi <strong>URL</strong> và <strong>password</strong> qua <strong>2 kênh khác nhau</strong> để an toàn (vd URL qua Zalo,
        password qua SMS). Recipient mở URL → nhập password → file tự decrypt + tải về browser.
      </P>
      <H>Quản lý link đã tạo</H>
      <P>Hiện tại link tự hết hạn theo cấu hình. Tương lai sẽ thêm tab "Shared by me" để xem và revoke.</P>
      <div style={{ background: 'var(--color-accent-soft)', borderRadius: 10, padding: 12, marginTop: 12 }}>
        <strong style={{ fontSize: 12, color: 'var(--color-accent-primary)' }}>🔒 Zero-knowledge</strong>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Server TrishTEAM KHÔNG có password → KHÔNG decrypt được file. File chỉ giải mã được trên trình duyệt
          recipient sau khi nhập đúng password.
        </p>
      </div>
    </>
  );
}

function FolderSection(): JSX.Element {
  return (
    <>
      <H>Tạo folder</H>
      <P>Sidebar trái Files page → click icon <strong>+</strong> bên cạnh "FOLDERS" → đặt tên.</P>
      <H>Move file vào folder</H>
      <P>Click icon <strong>✎</strong> trên file → dropdown "Folder" → chọn folder.</P>
      <H>Filter</H>
      <P>Click folder bên sidebar trái → page chỉ hiện file trong folder đó. Click "📁 Root" hiện file không thuộc folder nào. Click "📂 Tất cả" hiện toàn bộ.</P>
      <H>Đổi tên / xoá folder</H>
      <P>Hover folder → 2 icon <strong>✎ Rename</strong> + <strong>🗑 Delete</strong>. Khi xoá folder, file trong đó sẽ về Root (KHÔNG xoá file).</P>
      <H>Ghi chú per-file</H>
      <P>Mỗi file có ghi chú riêng (vd "Báo cáo Q1 — gửi Hùng"). Hiện inline trong table với icon 📝. Search bar tìm cả filename + note.</P>
    </>
  );
}

function SecuritySection(): JSX.Element {
  return (
    <>
      <H>Encryption</H>
      <P>Mỗi chunk file được mã hoá <strong>AES-256-GCM</strong> với master key derive từ passphrase qua <strong>PBKDF2-SHA256 200,000 rounds</strong>. Telegram chỉ thấy ciphertext, không decrypt được.</P>
      <H>Storage</H>
      <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>BOT_TOKEN + master key: lưu Windows Credential Manager (DPAPI), per-user</li>
        <li>File metadata + chunks index: SQLite local <Code>%APPDATA%/vn.trishteam.drive/index.db</Code></li>
        <li>File content: Telegram private channel của bạn (chỉ bot có quyền)</li>
      </ul>
      <H>Threat model</H>
      <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>✅ Telegram admin / Trí (TrishTEAM) → KHÔNG đọc được file (encrypted)</li>
        <li>✅ Người nhận chia sẻ link → chỉ decrypt được nếu có password</li>
        <li>⚠️ Mất passphrase → mất file vĩnh viễn (không có recovery)</li>
        <li>⚠️ Mất máy tính + ai đó truy cập DPAPI → có thể xem bot token (nhưng không decrypt content nếu không có passphrase)</li>
      </ul>
      <H>Best practices</H>
      <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li>Lưu passphrase trong password manager</li>
        <li>Bật Telegram 2-Step Verification</li>
        <li>Đặt password share riêng cho mỗi file (đừng dùng cùng 1 password)</li>
        <li>Set expires_at cho share link (mặc định 7 ngày)</li>
      </ul>
    </>
  );
}

function TroubleshootSection(): JSX.Element {
  return (
    <>
      <H>Upload fail giữa chừng</H>
      <P>App tự rollback (xoá file row SQLite). Nhưng các chunks đã upload vẫn còn trên Telegram channel — Trí có thể xoá thủ công bằng cách mở channel → delete messages.</P>
      <H>"Telegram trả message không có document"</H>
      <P>Có thể do Bot API limit hoặc network timeout. Thử lại upload, nếu vẫn fail check internet.</P>
      <H>Download chậm</H>
      <P>Telegram CDN free có rate limit. File 1GB có thể tải 5-15 phút. Bật MTProto trong Settings để tăng tốc.</P>
      <H>Quên passphrase</H>
      <P>KHÔNG có recovery — passphrase chỉ lưu trên máy bạn (DPAPI). Nếu mất → bắt buộc <strong>Reset config</strong> trong Settings, file đã upload sẽ trở thành dữ liệu rác trong Telegram channel (Trí phải xoá thủ công).</P>
      <H>Setup bot fail</H>
      <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8, marginTop: 8, paddingLeft: 20 }}>
        <li><strong>"unauthorized"</strong> → Bot token sai. Check lại với @BotFather (gõ <Code>/mybots</Code>)</li>
        <li><strong>"chat not found"</strong> → Channel ID sai. Forward 1 tin từ channel cho @RawDataBot</li>
        <li><strong>"bot is not a member"</strong> → Chưa add bot làm Admin của channel</li>
      </ul>
      <H>Share link "Share không tồn tại"</H>
      <P>Token sai hoặc đã bị Trí revoke. Tạo link mới.</P>
    </>
  );
}
