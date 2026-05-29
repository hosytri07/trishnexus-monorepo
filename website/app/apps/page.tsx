/**
 * /apps — Phase 78 catalog 4 desktop apps full detail.
 *
 * Mỗi app có anchor section: hero name, modules list, accent color.
 * Hash navigation từ homepage card → scroll to section.
 */
import Link from 'next/link';
import { Download, ArrowRight, Check } from 'lucide-react';
import { BruFooter } from '@/components/bru/bru-footer';

export const metadata = {
  title: 'Ứng dụng — TrishTEAM',
  description: '4 ứng dụng desktop native cho kỹ sư Việt: TrishWork, TrishUtilities, TrishFinance, TrishAdmin.',
};

const APPS = [
  {
    id: 'work',
    name: 'TrishWork',
    accent: '#34D399',
    tagline: 'Kỹ sư · Thư viện · ISO',
    hero: 'Bộ công cụ\nkỹ sư hạ tầng.',
    description:
      'Gộp 3 module Design + Library + ISO. Tạo bản vẽ AutoCAD, quản lý thư viện block, lập hồ sơ ISO theo quy chuẩn VN. Dành cho kỹ sư hạ tầng giao thông + xây dựng.',
    modules: [
      { name: 'Design', text: 'Generator block AutoCAD theo template — biển báo QC41:2024, cấu tạo cầu/cống/đường, mặt cắt ngang.' },
      { name: 'Library', text: 'Quản lý thư viện block .dwg + .dxf theo loại tài sản (9 nhóm ATGT). Sync GitHub Release.' },
      { name: 'ISO', text: 'Lập hồ sơ ISO chuẩn quốc gia: lý lịch tài sản, bảo trì, kiểm định.' },
    ],
    features: [
      'AutoCAD 2017-2024 tương thích',
      'Template block 200+ mặt cắt',
      'Sync thư viện 1-click qua GitHub',
      'Xuất Excel báo cáo ISO',
    ],
  },
  {
    id: 'utilities',
    name: 'TrishUtilities',
    accent: '#FBBF24',
    tagline: 'Dọn dẹp · Kiểm tra · Tải · Font · Shortcut',
    hero: '5 tiện ích hệ thống\ngộp 1 app.',
    description:
      'Tiện ích Windows hằng ngày — dọn rác, kiểm tra spec máy, tải file/Drive/MXH, quản lý font tiếng Việt + AutoCAD, shortcut launcher.',
    modules: [
      { name: 'Clean', text: 'Dọn cache + file rác (Temp, Recycle Bin, browser, AutoCAD .bak/.sv$). Pre-clean preview + undo 7 ngày.' },
      { name: 'Check', text: 'System info chi tiết, benchmark CPU/RAM/Disk/Net, Health Score, so MinSpec phần mềm.' },
      { name: 'Downloader', text: 'Tải file qua URL, video MXH (yt-dlp), Google Drive bulk folder, thư viện file TrishTEAM.' },
      { name: 'Font', text: 'Quản lý font tiếng Việt (UTM/VNI/TCVN) + AutoCAD .shx. Pack 1716 font cài 1-click. Scanner .dwg detect font thiếu.' },
      { name: 'Shortcut', text: 'Quét desktop/Start Menu/installed apps, gom shortcut, workspace mode, hotkey toàn cục, Ctrl+Space quick launcher.' },
    ],
    features: [
      '5 module trong 1 installer ~50MB',
      'Font pack 1,716 font tiếng Việt + AutoCAD',
      'Hotkey toàn cục Ctrl+Space',
      'DWG font scanner (heuristic + DXF parse 100%)',
    ],
  },
  {
    id: 'finance',
    name: 'TrishFinance',
    accent: '#2563EB',
    tagline: '12 loại business · POS · Nhà trọ · F&B · Spa · Gym...',
    hero: '12 business\ntrong 1 app.',
    description:
      'Quản lý 12 loại business nhỏ phổ biến tại Việt Nam — POS bán hàng, nhà trọ, cafe, gym, karaoke, photocopy, sân thể thao, spa, kho điện tử, tài chính cá nhân. Import sao kê ngân hàng tự động.',
    modules: [
      { name: 'Bán hàng', text: 'POS bán hàng tại quầy — quản kho, in hóa đơn, doanh thu theo ngày/tháng.' },
      { name: 'Nhà trọ', text: 'Quản lý phòng trọ — tiền phòng + điện + nước + dịch vụ, ngày đến hạn, hợp đồng.' },
      { name: 'Cafe / F&B', text: 'Order menu, table service, billing, kho nguyên liệu.' },
      { name: 'Gym', text: 'Member subscription, check-in, gói tập, doanh thu HLV.' },
      { name: 'Karaoke', text: 'Quản phòng hát, đặt phòng, menu đồ uống, billing.' },
      { name: 'Photocopy', text: 'In/photo theo trang/màu, sổ công nợ, in báo cáo.' },
      { name: 'Sân thể thao', text: 'Đặt sân theo giờ, lịch tuần, thanh toán cọc + bù.' },
      { name: 'Spa', text: 'Lịch hẹn, gói liệu trình, member, kho mỹ phẩm.' },
      { name: 'Kho điện tử', text: 'Quản lý bảo hành SKU điện tử, nhập xuất, IMEI.' },
      { name: 'Tài chính', text: 'Sổ thu chi cá nhân + doanh nghiệp, phân loại, ngân sách.' },
      { name: 'Bank Import', text: 'Import sao kê ngân hàng .xlsx/.csv → tự sync giao dịch.' },
      { name: 'Dashboard', text: 'Overview toàn business: doanh thu, top sản phẩm, cash flow.' },
    ],
    features: [
      'Multi-cửa hàng / multi-business cùng 1 tài khoản',
      'Import sao kê bank tự động (Vietcombank, ACB, BIDV, ...)',
      'Báo cáo Excel + PDF cuối tháng',
      'Sync Firebase realtime giữa các máy',
      'Hóa đơn in thermal 58mm/80mm hoặc PDF',
    ],
  },
] as const;

export default function AppsPage() {
  return (
    <main className="bru">
      {/* HERO */}
      <section className="bru-section" style={{ paddingTop: 'clamp(64px, 10vw, 160px)' }}>
        <div className="bru-container">
          <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
            // 03 Ứng dụng desktop
          </div>
          <h1 className="bru-display-xl" style={{ marginBottom: 32 }}>
            BA ỨNG DỤNG.
            <br />
            <span className="bru-accent">MỘT HỆ SINH THÁI.</span>
          </h1>
          <p className="bru-body-lg" style={{ maxWidth: 720 }}>
            Mỗi app làm 1 nhóm việc — share authentication, share data model, share design system.
            Cài cái nào dùng cái đó, hoặc cài cả 4 cho ecosystem hoàn chỉnh.
          </p>
        </div>
      </section>

      {/* APP SECTIONS */}
      {APPS.map((app, idx) => (
        <section
          key={app.id}
          id={app.id}
          className="bru-section"
          style={{
            background: idx % 2 === 1 ? 'var(--bru-bg-elevated)' : 'transparent',
            borderTop: '2px solid var(--bru-border)',
            scrollMarginTop: 100,
          }}
        >
          <div className="bru-container">
            {/* Header section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="bru-mono"
                style={{ color: 'var(--bru-fg-muted)', fontSize: 14 }}
              >
                / 0{idx + 1}
              </span>
              <span className="bru-mono" style={{ color: app.accent, fontSize: 13 }}>
                {app.tagline}
              </span>
            </div>

            <h2
              className="bru-display-lg"
              style={{
                marginBottom: 24,
                color: 'var(--bru-fg)',
                whiteSpace: 'pre-line',
              }}
            >
              {app.hero.split('\n').map((line, i) => (
                <div key={i}>
                  {i === 1 ? <span style={{ color: app.accent }}>{line}</span> : line}
                </div>
              ))}
            </h2>

            <h3
              className="bru-h2"
              style={{ marginBottom: 32, fontSize: 32, fontWeight: 800 }}
            >
              <span style={{ color: app.accent }}>{app.name}</span>
            </h3>

            <p className="bru-body-lg" style={{ maxWidth: 720, marginBottom: 64 }}>
              {app.description}
            </p>

            {/* Modules grid */}
            <div className="bru-grid-3" style={{ marginBottom: 64 }}>
              {app.modules.map((m) => (
                <div
                  key={m.name}
                  className="bru-card"
                  style={{
                    borderColor: `${app.accent}40`,
                    background: 'transparent',
                  }}
                >
                  <h4
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      color: app.accent,
                      marginBottom: 12,
                    }}
                  >
                    {m.name}
                  </h4>
                  <p className="bru-body-sm">{m.text}</p>
                </div>
              ))}
            </div>

            {/* Features bullets */}
            <div className="bru-grid-2" style={{ alignItems: 'start' }}>
              <div>
                <div className="bru-eyebrow" style={{ marginBottom: 16 }}>
                  Tính năng chính
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {app.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--bru-border)',
                      }}
                    >
                      <Check size={18} strokeWidth={2.5} style={{ color: app.accent, flexShrink: 0, marginTop: 2 }} />
                      <span className="bru-body">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link href="/downloads" className="bru-btn bru-btn-primary">
                  <Download size={16} strokeWidth={2.5} />
                  Tải {app.name}
                </Link>
                <Link href="/huong-dan" className="bru-btn">
                  Hướng dẫn dùng
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* FINAL CTA */}
      <section className="bru-section">
        <div className="bru-container-narrow" style={{ textAlign: 'center' }}>
          <h2 className="bru-display-lg" style={{ marginBottom: 24 }}>
            Còn câu hỏi?
          </h2>
          <p className="bru-body-lg" style={{ marginBottom: 32 }}>
            Đọc <Link href="/huong-dan" style={{ color: 'var(--bru-accent)' }}>hướng dẫn</Link>,
            xem <Link href="/blog" style={{ color: 'var(--bru-accent)' }}>blog</Link>,
            hoặc email trực tiếp.
          </p>
          <Link href="/downloads" className="bru-btn bru-btn-primary bru-btn-lg">
            <Download size={18} strokeWidth={2.5} />
            Bắt đầu tải về
          </Link>
        </div>
      </section>

      <BruFooter />
    </main>
  );
}
