/**
 * Dashboard homepage — TrishTEAM (Phase 19.22 — slim).
 *
 * Layout (sau Phase 19.22):
 *   Banner: AnnouncementsBanner (Firestore real-time).
 *   Row 1:  Clock+Weather/Holidays/Calendar (trái) · Ecosystem+QuickNotes (phải).
 *   Row 2:  BlogPreviewWidget — list 5 bài mới nhất + ngày đăng.
 *   Row 3:  QR Code Generator (full width).
 *   Row 4:  Feedback · Author contact.
 *
 * Phase 19.22 update:
 *   - Bỏ DatabaseShowcase (đã có database trong sidebar)
 *   - Bỏ SiteFooter (gọn page chỉ giữ widgets)
 *   - Replace BlogCallToAction → BlogPreviewWidget (list bài có title + ngày)
 */
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
import { BlogPreviewWidget } from '@/components/widgets/blog-preview-widget';

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

      {/* Row 2 — Blog preview (5 bài mới nhất, title + ngày đăng) */}
      <BlogPreviewWidget />

      {/* Row 3 — QR Code Generator (full width) */}
      <QrGeneratorWidget />

      {/* Row 4 — Feedback · Author contact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedbackWidget />
        <AuthorContactWidget />
      </div>
    </main>
  );
}
