/**
 * Dashboard homepage — TrishTEAM (Phase 19.1 — slim layout).
 *
 * Sau Phase 19.1 đã gỡ 8 widget khỏi homepage để gọn:
 *   - UniversalSearch · Gas/Gold/Exchange · DailyTip · Activity · News
 *   - Pomodoro · FinancialCalc · QuickAccess → MOVE qua left sidebar
 *
 * Layout mới (8 widget):
 *   Banner: AnnouncementsBanner.
 *   Row 1:  Clock+Weather/Holidays/Calendar (trái) · Ecosystem+QuickNotes (phải).
 *   Row 2:  Blog CTA — link tới /blog (admin post · user read).
 *   Row 3:  QR Code Generator (full width).
 *   Row 4:  Feedback · Author contact.
 */
import Link from 'next/link';
import {
  ArrowRight,
  BookMarked,
  Calculator,
  Newspaper,
  Package,
  Route,
  Signpost,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { ClockWidget } from '@/components/widgets/clock-widget';
import { WeatherWidget } from '@/components/widgets/weather-widget';
import { HolidaysTimelineWidget } from '@/components/widgets/holidays-widget';
import { EcosystemWidget } from '@/components/widgets/ecosystem-widget';
import { CalendarEventsWidget } from '@/components/widgets/calendar-events-widget';
import { QuickNotesWidget } from '@/components/widgets/notes-widget';
import { FeedbackWidget } from '@/components/widgets/feedback-widget';
import { AuthorContactWidget } from '@/components/widgets/author-contact-widget';
import { QrGeneratorWidget } from '@/components/widgets/qr-generator-widget';
import { AnnouncementsBanner } from '@/components/announcements-banner';

export default function DashboardPage() {
  return (
    <main className="max-w-[88rem] mx-auto px-6 py-8 space-y-6">
      {/* Banner: admin announcements (active + not dismissed) */}
      <AnnouncementsBanner />

      {/* Row 1 — 2 cột: trái (Clock+Weather/Holidays/Calendar), phải (Ecosystem+Notes) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ClockWidget />
            <WeatherWidget />
          </div>
          <HolidaysTimelineWidget />
          <CalendarEventsWidget />
        </div>
        <div className="flex flex-col gap-6">
          <EcosystemWidget />
          <QuickNotesWidget />
        </div>
      </div>

      {/* Row 2 — Blog CTA: thay thế News widget cũ. Trỏ tới /blog (admin post · user read). */}
      <BlogCallToAction />

      {/* Row 2.5 — Database Việt Nam showcase (Phase 19.21) */}
      <DatabaseShowcase />

      {/* Row 3 — QR Code Generator (full width) */}
      <QrGeneratorWidget />

      {/* Row 4 — Feedback · Author contact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedbackWidget />
        <AuthorContactWidget />
      </div>

      {/* Footer */}
      <SiteFooter />
    </main>
  );
}

/**
 * DatabaseShowcase — Phase 19.21 — quick-link grid cho 6 database VN.
 */
function DatabaseShowcase() {
  const items: { href: string; icon: LucideIcon; title: string; subtitle: string; count: string; color: string }[] = [
    { href: '/bien-bao', icon: Signpost, title: 'Biển báo QC41:2024', subtitle: 'Báo hiệu đường bộ VN', count: '451 biển', color: '#EF4444' },
    { href: '/cau-vn', icon: Waypoints, title: 'Cầu Việt Nam', subtitle: 'Database + bản đồ', count: '7.549 cầu', color: '#0EA5E9' },
    { href: '/duong-vn', icon: Route, title: 'Đường Việt Nam', subtitle: 'Cao tốc · QL · vành đai', count: '25 tuyến', color: '#F59E0B' },
    { href: '/quy-chuan', icon: BookMarked, title: 'Quy chuẩn / TCVN', subtitle: 'QCVN · TCVN · TT · NĐ', count: '19 văn bản', color: '#A855F7' },
    { href: '/dinh-muc', icon: Calculator, title: 'Định mức XD', subtitle: 'QĐ 1776 · hao phí', count: '17 mã', color: '#10B981' },
    { href: '/vat-lieu', icon: Package, title: 'Vật liệu XD', subtitle: 'Thép · xi măng · bê tông', count: '25 loại', color: '#06B6D4' },
  ];
  return (
    <section
      className="rounded-xl border p-5 md:p-6"
      style={{
        background: 'var(--color-surface-card)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <header className="mb-4">
        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
          🇻🇳 Database Việt Nam — XD &amp; Giao thông
        </h2>
        <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Tra cứu nhanh các bộ dữ liệu chuyên ngành. Cập nhật theo chuẩn 2024-2025.
        </p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="group flex items-start gap-3 p-3 rounded-lg border transition-all hover:scale-[1.01]"
              style={{
                background: 'var(--color-surface-bg_elevated)',
                borderColor: 'var(--color-border-subtle)',
                borderLeftWidth: 3,
                borderLeftColor: it.color,
              }}
            >
              <div
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-md"
                style={{ background: it.color + '22', color: it.color }}
              >
                <Icon size={18} strokeWidth={1.9} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {it.title}
                  </h3>
                </div>
                <p className="text-[11px] mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {it.subtitle}
                </p>
                <span
                  className="inline-flex items-center px-1.5 h-4 rounded text-[10px] font-bold"
                  style={{ background: it.color + '22', color: it.color }}
                >
                  {it.count}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * SiteFooter — Phase 19.21 — replaces old Phase 19.1 footer note with full site links.
 */
function SiteFooter() {
  const cols: { heading: string; links: { href: string; label: string }[] }[] = [
    {
      heading: 'Học tập',
      links: [
        { href: '/on-thi-lai-xe', label: 'Ôn thi lái xe' },
        { href: '/on-thi-chung-chi', label: 'Chứng chỉ XD' },
        { href: '/tin-hoc-vp', label: 'Tin học VP' },
        { href: '/tieng-anh', label: 'Tiếng Anh' },
      ],
    },
    {
      heading: 'Database',
      links: [
        { href: '/bien-bao', label: 'Biển báo QC41' },
        { href: '/cau-vn', label: 'Cầu VN' },
        { href: '/duong-vn', label: 'Đường VN' },
        { href: '/quy-chuan', label: 'Quy chuẩn / TCVN' },
        { href: '/dinh-muc', label: 'Định mức' },
        { href: '/vat-lieu', label: 'Vật liệu XD' },
      ],
    },
    {
      heading: 'Công cụ',
      links: [
        { href: '/cong-cu/qr-code', label: 'QR Code' },
        { href: '/cong-cu/may-tinh-tai-chinh', label: 'Máy tính TC' },
        { href: '/cong-cu/vn2000', label: 'VN2000 ↔ WGS84' },
        { href: '/cong-cu/don-vi', label: 'Đơn vị quy đổi' },
      ],
    },
    {
      heading: 'TrishTEAM',
      links: [
        { href: '/blog', label: 'Blog' },
        { href: '/downloads', label: 'Tải app desktop' },
        { href: '/ung-ho', label: 'Ủng hộ' },
        { href: '/profile', label: 'Hồ sơ' },
      ],
    },
  ];
  return (
    <footer
      className="mt-8 pt-8 border-t"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        {cols.map((col) => (
          <div key={col.heading}>
            <h4
              className="text-[11px] font-bold uppercase tracking-wider mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {col.heading}
            </h4>
            <ul className="space-y-1.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm transition-opacity hover:opacity-80"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="pt-4 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs"
        style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-muted)' }}
      >
        <p>
          © 2025-2026 Trish<strong style={{ color: 'var(--color-accent-primary)' }}>TEAM</strong>. Dashboard hệ sinh thái cá nhân của Trí.
        </p>
        <p className="italic">
          Made with care for Vietnamese civil engineers · Source data: BXD, BGTVT, GSO, TCVN.
        </p>
      </div>
    </footer>
  );
}

/**
 * BlogCallToAction — card to / call để dẫn user qua /blog.
 *
 * Thay thế NewsWidget (đã gỡ). Style giữ tone dark cyber của website chính —
 * border accent, gradient subtle, hover transition rõ.
 */
function BlogCallToAction() {
  return (
    <Link
      href="/blog"
      className="group block relative overflow-hidden rounded-xl border transition-all hover:scale-[1.005]"
      style={{
        background:
          'linear-gradient(135deg, var(--color-surface-card) 0%, var(--color-surface-bg_elevated) 100%)',
        borderColor: 'var(--color-border-default)',
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6 p-6 md:p-8">
        {/* Icon block */}
        <div
          className="shrink-0 inline-flex items-center justify-center rounded-lg"
          style={{
            width: 56,
            height: 56,
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <Newspaper
            size={28}
            strokeWidth={1.75}
            style={{ color: 'var(--color-accent-primary)' }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-1.5 mb-2 px-2 h-5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent-primary)',
            }}
          >
            BLOG · TIN TỨC · KIẾN THỨC
          </div>
          <h3
            className="text-xl md:text-2xl font-bold mb-1"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Đọc blog TrishTEAM
          </h3>
          <p
            className="text-sm md:text-base"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Bài viết về kỹ thuật cầu đường, hướng dẫn dùng app TrishTEAM, kinh
            nghiệm thi chứng chỉ + cập nhật mới nhất từ ecosystem.
          </p>
        </div>

        {/* CTA */}
        <div
          className="shrink-0 inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-semibold transition-transform group-hover:translate-x-1"
          style={{
            background: 'var(--color-accent-gradient)',
            color: '#ffffff',
            boxShadow: '0 2px 12px rgba(34, 211, 238, 0.18)',
          }}
        >
          Vào blog
          <ArrowRight size={16} strokeWidth={2.25} />
        </div>
      </div>
    </Link>
  );
}
