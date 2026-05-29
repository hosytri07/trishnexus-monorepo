/**
 * /huong-dan — Phase 78.5 Brutalist guides hub.
 * Quick start + 3 app guide cards + FAQ + Troubleshooting + Contact.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  Download,
  Key,
  Settings,
  HelpCircle,
  AlertTriangle,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';

export const metadata: Metadata = {
  title: 'Hướng dẫn — TrishTEAM',
  description: 'Hướng dẫn sử dụng 3 app TrishTEAM: cài đặt, đăng ký tài khoản, từng tính năng, FAQ.',
};

const QUICK_STEPS = [
  {
    num: '01',
    icon: Download,
    title: 'Tải installer',
    text: 'Truy cập /downloads, chọn 1 trong 3 app — file .exe ~40-50 MB. Windows SmartScreen có thể cảnh báo lần đầu, chọn "More info → Run anyway".',
  },
  {
    num: '02',
    icon: Settings,
    title: 'Cài đặt',
    text: 'Double-click .exe → Next → chọn folder (mặc định Program Files) → Finish. Icon Desktop + Start Menu sinh tự động.',
  },
  {
    num: '03',
    icon: Key,
    title: 'Đăng ký & cấp quyền',
    text: 'Mở app → Sign Up với email/password hoặc Google. Lần đầu cần admin (Trí) cấp quyền app — liên hệ qua Telegram/Zalo dưới.',
  },
];

const APPS_GUIDE = [
  {
    id: 'trishwork',
    name: 'TrishWork',
    accent: '#34D399',
    tagline: 'Kỹ sư · Thư viện · ISO',
    modules: ['Design', 'Library', 'ISO'],
    description: 'Bộ công cụ kỹ sư hạ tầng — AutoCAD generator, thư viện block, hồ sơ ISO.',
    quickTips: [
      'Mở module Design → chọn template biển báo/cầu/cống → tạo block AutoCAD trong 1 click.',
      'Library: sync thư viện qua "Tải xuống mới nhất" từ GitHub Release.',
      'ISO: lập hồ sơ tài sản theo template QC41:2024, xuất Excel báo cáo cuối năm.',
    ],
    commonIssues: [
      { q: 'Không thấy AutoCAD trong app', a: 'Cài AutoCAD 2017-2024 trước. App scan registry tự detect.' },
      { q: 'Block tạo ra không có font', a: 'Cài TrishUtilities → tab Font → cài bộ Font cơ bản (1716 font).' },
    ],
  },
  {
    id: 'trishutilities',
    name: 'TrishUtilities',
    accent: '#FBBF24',
    tagline: 'Dọn dẹp · Kiểm tra · Tải · Font · Shortcut',
    modules: ['Clean', 'Check', 'Downloader', 'Font', 'Shortcut'],
    description: '5 module tiện ích Windows trong 1 app.',
    quickTips: [
      'Tab Dọn dẹp → Quick Clean → preview file rác → confirm xóa. Có undo 7 ngày.',
      'Tab Kiểm tra → System info + benchmark + Speed test mạng → so MinSpec phần mềm AutoCAD/Office.',
      'Tab Downloader → 4 sub-tab: file URL, video MXH (yt-dlp), Google Drive bulk folder, thư viện TrishTEAM.',
      'Tab Font → cài 1716 font tiếng Việt từ Pack TrishTEAM. Quét .dwg detect font thiếu trong file CAD.',
      'Tab Shortcut → quét Desktop/Start Menu/installed apps → workspace + hotkey toàn cục Ctrl+Space.',
    ],
    commonIssues: [
      { q: '"Access denied" khi cài font', a: 'Đó là font hệ thống Windows đang lock (Tahoma, Times, Palatino) — app đã auto-skip, KHÔNG phải lỗi.' },
      { q: 'Scan .dwg ra 0 font', a: 'File DWG R2004+ có nén string LZ77. Save As DXF hoặc DWG R14 trong AutoCAD rồi quét lại.' },
      { q: 'Cài font cần admin?', a: 'Chỉ cần khi cài font hệ thống. Pack font tiếng Việt cài vào user folder không cần admin.' },
    ],
  },
  {
    id: 'trishfinance',
    name: 'TrishFinance',
    accent: '#2563EB',
    tagline: 'POS · Nhà trọ · Thu chi',
    modules: ['POS', 'Nhà trọ', 'Thu chi'],
    description: 'Quản lý tài chính cá nhân + kinh doanh nhỏ.',
    quickTips: [
      'POS: tạo mặt hàng → bán hàng tại quầy → in hóa đơn → xem báo cáo doanh thu tháng.',
      'Nhà trọ: thêm phòng → set giá thuê + điện + nước → app tự nhắc đến hạn thu tiền.',
      'Thu chi: phân loại theo nhóm (Ăn uống, Đi lại, ...) → set ngân sách tháng → biểu đồ.',
    ],
    commonIssues: [
      { q: 'Có sync giữa nhiều máy không?', a: 'Có, qua Firebase. Đăng nhập cùng tài khoản trên 2+ máy, data đồng bộ realtime.' },
      { q: 'Export dữ liệu sang Excel?', a: 'Trong app → Settings → "Xuất Excel" → chọn loại (POS / Nhà trọ / Thu chi) → ngày bắt đầu/kết thúc.' },
    ],
  },
] as const;

const FAQ = [
  {
    q: 'App có miễn phí không?',
    a: 'Có. 3 app desktop free đầy đủ chức năng cơ bản. Free tier không giới hạn user/sync. Pro tier (sắp ra) thêm advanced features.',
  },
  {
    q: 'Có cần internet để dùng app không?',
    a: 'Không. App offline-first — mọi tính năng chạy local. Internet chỉ cần khi đăng nhập lần đầu và sync data giữa máy.',
  },
  {
    q: 'Có hỗ trợ macOS / Linux không?',
    a: 'Hiện chỉ Windows 10/11 x64. macOS + Linux build có thể có ở v2.0 (chưa lịch).',
  },
  {
    q: 'Tôi cần quyền Administrator để cài?',
    a: 'Có khi cài font vào C:\\Windows\\Fonts (Pack font TrishTEAM cài vào user folder không cần admin). Bấm chuột phải installer → "Run as administrator" nếu được hỏi UAC.',
  },
  {
    q: 'Làm sao update app khi có version mới?',
    a: 'Trong app → menu Settings → "Kiểm tra cập nhật" hoặc tự động báo khi có version mới (auto-update tooling Tauri 2 updater).',
  },
  {
    q: 'Data của tôi có riêng tư không?',
    a: 'Có. Data local lưu trong %APPDATA%\\TrishTEAM\\. Nếu bật sync, data encrypt before upload tới Firebase. Trí không đọc được data cá nhân.',
  },
];

export default function HuongDanPage() {
  return (
    <main className="bru">
      {/* HERO */}
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // Documentation
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32, lineHeight: 1.15 }}>
            HƯỚNG DẪN.
            <br />
            <span className="bru-accent">TỪNG BƯỚC.</span>
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 720, marginBottom: 32 }}>
            Cài đặt 3 app TrishTEAM trong 5 phút. Đăng ký miễn phí. Hỗ trợ tiếng Việt mọi nơi.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/downloads" className="bru-btn bru-btn-primary">
              <Download size={16} strokeWidth={2.5} />
              Tải ngay
            </Link>
            <a href="#faq" className="bru-btn">
              <HelpCircle size={16} strokeWidth={2.5} />
              Đọc FAQ
            </a>
          </div>
        </div>
      </section>

      {/* QUICK START 3 BƯỚC */}
      <section
        className="bru-section bru-section-sm"
        style={{ background: 'var(--bru-bg-elevated)', borderTop: '2px solid var(--bru-border)' }}
        id="quick-start"
      >
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 12 }}>
            // Quick start
          </div>
          <h2 className="bru-display-md" style={{ marginBottom: 48 }}>
            3 bước. <span className="bru-accent">5 phút.</span>
          </h2>
          <div className="bru-grid-3">
            {QUICK_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  style={{
                    borderTop: '4px solid var(--bru-accent)',
                    paddingTop: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span className="bru-mono" style={{ color: 'var(--bru-accent)', fontSize: 14 }}>
                      {s.num}
                    </span>
                    <Icon size={24} strokeWidth={2} style={{ color: 'var(--bru-fg)' }} />
                  </div>
                  <h3 className="bru-h3">{s.title}</h3>
                  <p className="bru-body-sm">{s.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* GUIDE PER APP */}
      <section className="bru-section" id="apps">
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 12 }}>
            // 03 Ứng dụng
          </div>
          <h2 className="bru-display-md" style={{ marginBottom: 48 }}>
            Hướng dẫn từng app.
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
            {APPS_GUIDE.map((app, idx) => (
              <article
                key={app.id}
                id={app.id}
                style={{
                  borderLeft: `4px solid ${app.accent}`,
                  paddingLeft: 'clamp(20px, 3vw, 40px)',
                  scrollMarginTop: 100,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span className="bru-mono" style={{ color: 'var(--bru-fg-muted)', fontSize: 14 }}>
                    / 0{idx + 1}
                  </span>
                  <h3
                    style={{
                      fontSize: 'clamp(28px, 3vw, 44px)',
                      fontWeight: 900,
                      letterSpacing: '-0.03em',
                      color: app.accent,
                      lineHeight: 1.05,
                    }}
                  >
                    {app.name}
                  </h3>
                </div>
                <p className="bru-mono" style={{ color: 'var(--bru-fg-dim)', marginBottom: 16, fontSize: 13 }}>
                  {app.tagline}
                </p>
                <p className="bru-body-lg" style={{ marginBottom: 24, maxWidth: 720 }}>
                  {app.description}
                </p>

                {/* Modules tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 32 }}>
                  {app.modules.map((m) => (
                    <span key={m} className="bru-tag" style={{ borderColor: app.accent, color: app.accent }}>
                      {m}
                    </span>
                  ))}
                </div>

                <div className="bru-grid-2" style={{ alignItems: 'start', gap: 32 }}>
                  {/* Quick tips */}
                  <div>
                    <div className="bru-eyebrow" style={{ marginBottom: 12, color: app.accent }}>
                      // Mẹo nhanh
                    </div>
                    <ol style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {app.quickTips.map((tip, i) => (
                        <li
                          key={i}
                          style={{
                            display: 'flex',
                            gap: 12,
                            paddingBottom: 10,
                            borderBottom: '1px solid var(--bru-border)',
                          }}
                        >
                          <span
                            className="bru-mono"
                            style={{
                              color: app.accent,
                              fontWeight: 800,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                          >
                            0{i + 1}
                          </span>
                          <span className="bru-body-sm" style={{ color: 'var(--bru-fg)' }}>
                            {tip}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Common issues */}
                  <div>
                    <div className="bru-eyebrow" style={{ marginBottom: 12, color: 'var(--bru-fg-muted)' }}>
                      // Vấn đề thường gặp
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {app.commonIssues.map((issue, i) => (
                        <details
                          key={i}
                          style={{
                            border: '1px solid var(--bru-border)',
                            borderRadius: 4,
                            background: 'var(--bru-bg-elevated)',
                          }}
                        >
                          <summary
                            style={{
                              cursor: 'pointer',
                              padding: 14,
                              fontWeight: 700,
                              fontSize: 13,
                              listStyle: 'none',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                            }}
                          >
                            <AlertTriangle size={14} style={{ color: app.accent, flexShrink: 0, marginTop: 2 }} strokeWidth={2.5} />
                            {issue.q}
                          </summary>
                          <p
                            className="bru-body-sm"
                            style={{
                              padding: '0 14px 14px',
                              margin: 0,
                              color: 'var(--bru-fg-dim)',
                              borderTop: '1px solid var(--bru-border)',
                              paddingTop: 12,
                            }}
                          >
                            {issue.a}
                          </p>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 32 }}>
                  <Link href="/downloads" className="bru-btn">
                    <Download size={14} strokeWidth={2.5} />
                    Tải {app.name}
                    <ArrowRight size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="bru-section"
        style={{ background: 'var(--bru-bg-elevated)', borderTop: '2px solid var(--bru-border)' }}
        id="faq"
      >
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 12 }}>
            // FAQ
          </div>
          <h2 className="bru-display-md" style={{ marginBottom: 48 }}>
            Câu hỏi <span className="bru-accent">thường gặp.</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 900 }}>
            {FAQ.map((f, i) => (
              <details
                key={i}
                style={{
                  border: '2px solid var(--bru-border)',
                  borderRadius: 4,
                  background: 'var(--bru-bg)',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    padding: '18px 20px',
                    fontWeight: 700,
                    fontSize: 15,
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    color: 'var(--bru-fg)',
                  }}
                >
                  <span className="bru-mono" style={{ color: 'var(--bru-accent)', fontSize: 12, flexShrink: 0 }}>
                    Q{(i + 1).toString().padStart(2, '0')}
                  </span>
                  <span style={{ flex: 1 }}>{f.q}</span>
                  <span style={{ color: 'var(--bru-fg-muted)', fontSize: 12 }}>+</span>
                </summary>
                <p
                  className="bru-body"
                  style={{
                    padding: '0 20px 20px 56px',
                    margin: 0,
                    color: 'var(--bru-fg-dim)',
                    borderTop: '1px solid var(--bru-border)',
                    paddingTop: 16,
                  }}
                >
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT FALLBACK */}
      <section className="bru-section bru-section-sm">
        <div className="bru-container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="bru-display-sm" style={{ marginBottom: 16 }}>
            Vẫn chưa giải quyết được?
          </h2>
          <p className="bru-body-lg" style={{ marginBottom: 32 }}>
            Gửi tin nhắn trực tiếp qua Telegram bot hoặc email — Trí phản hồi trong vài phút.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="mailto:trishteam.official@gmail.com" className="bru-btn bru-btn-primary">
              <Mail size={16} strokeWidth={2.5} />
              Email
            </a>
            <a
              href="https://t.me/+_f_Gqw2iy9M3Mjg1"
              target="_blank"
              rel="noopener noreferrer"
              className="bru-btn"
            >
              <MessageCircle size={16} strokeWidth={2.5} />
              Telegram
            </a>
          </div>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
