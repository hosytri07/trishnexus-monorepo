/**
 * Dashboard homepage — TrishTEAM.
 *
 * Grid (Phase 11.5.24d — QuickNotes dời từ Row 5 lên Row 1 cạnh Ecosystem):
 *   Banner: AnnouncementsBanner (admin message, dismissible).
 *   Row 1:   Clock/Weather/Holidays/News (trái) · Ecosystem + QuickNotes (phải stack).
 *   Row 2:   Gas · Gold · Exchange rate — 3 card tài chính.
 *   Row 3:   Pomodoro · Financial Calc · Calendar Events — productivity.
 *   Row 4:   Quick Access (2/3) · Activity (1/3).
 *   Row 4.5: QR Code Generator (Phase 11.5.22 — thay vị trí ExternalApps cũ).
 *   Row 6:   Daily Tip (full).
 *   Row 7:   Feedback · Author contact.
 */
import { ClockWidget } from '@/components/widgets/clock-widget';
import { WeatherWidget } from '@/components/widgets/weather-widget';
import { HolidaysTimelineWidget } from '@/components/widgets/holidays-widget';
import { EcosystemWidget } from '@/components/widgets/ecosystem-widget';
import { GasPricesWidget } from '@/components/widgets/gas-prices-widget';
import { GoldPricesWidget } from '@/components/widgets/gold-prices-widget';
import { ExchangeRateWidget } from '@/components/widgets/exchange-rate-widget';
import { PomodoroWidget } from '@/components/widgets/pomodoro-widget';
import { FinancialCalcWidget } from '@/components/widgets/financial-calc-widget';
import { CalendarEventsWidget } from '@/components/widgets/calendar-events-widget';
import { QuickAccessWidget } from '@/components/widgets/quick-access-widget';
// Phase 11.5.21: ExternalAppsWidget tạm gỡ — user không cần 12 shortcut
// ra ngoài. File `components/widgets/external-apps-widget.tsx` vẫn giữ
// lại để dùng nếu sau này muốn bật lại một nhóm tiện ích nhỏ hơn.
// import { ExternalAppsWidget } from '@/components/widgets/external-apps-widget';
import { ActivityWidget } from '@/components/widgets/activity-widget';
import { NewsWidget } from '@/components/widgets/news-widget';
import { QuickNotesWidget } from '@/components/widgets/notes-widget';
import { DailyTipWidget } from '@/components/widgets/tip-widget';
import { FeedbackWidget } from '@/components/widgets/feedback-widget';
import { AuthorContactWidget } from '@/components/widgets/author-contact-widget';
import { QrGeneratorWidget } from '@/components/widgets/qr-generator-widget';
import { UniversalSearchWidget } from '@/components/widgets/universal-search-widget';
import { AnnouncementsBanner } from '@/components/announcements-banner';

export default function DashboardPage() {
  return (
    <main className="max-w-[88rem] mx-auto px-6 py-8 space-y-6">
      {/* Banner: admin announcements (active + not dismissed) */}
      <AnnouncementsBanner />

      {/* Phase 12.2: Universal search đặt trên đầu — entry point nhanh
          cho apps/notes/announcement/action. Mini widget, Enter → /search */}
      <UniversalSearchWidget />

      {/* Row 1 (Phase 11.5.24d): cột trái (Clock+Weather, Holidays, News);
          cột phải (Ecosystem + QuickNotes stack để lấp chỗ trống dưới 10 app). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ClockWidget />
            <WeatherWidget />
          </div>
          <HolidaysTimelineWidget />
          <NewsWidget />
        </div>
        <div className="flex flex-col gap-6">
          <EcosystemWidget />
          <QuickNotesWidget />
        </div>
      </div>

      {/* Row 2: Gas · Gold · Exchange rate (3 card tài chính) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GasPricesWidget />
        <GoldPricesWidget />
        <ExchangeRateWidget />
      </div>

      {/* Row 3: Productivity — Pomodoro · Financial · Calendar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PomodoroWidget />
        <FinancialCalcWidget />
        <CalendarEventsWidget />
      </div>

      {/* Row 4: Quick Access (wider) · Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickAccessWidget />
        </div>
        <div className="lg:col-span-1">
          <ActivityWidget />
        </div>
      </div>

      {/* Row 4.5 (Phase 11.5.22): QR Code Generator — thay vị trí External Apps cũ.
          Auto-convert Drive/Docs/Sheets/Slides/Dropbox/YouTube → direct link. */}
      <QrGeneratorWidget />

      {/* Row 5 (Phase 11.5.24d): QuickNotes đã dời lên Row 1 (cột Ecosystem)
          để lấp chỗ trống dưới 10 app tiles — không duplicate ở đây. */}

      {/* Row 6: Daily Tip (full width) */}
      <DailyTipWidget />

      {/* Row 7: Feedback · Author contact (2 cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FeedbackWidget />
        <AuthorContactWidget />
      </div>

      {/* Footer note */}
      <footer
        className="pt-6 pb-2 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {'Phase 12 (hoàn tất) — Universal search (Fuse.js + VN fold) + '}
        {'widget dashboard + `/search` full-page (toggle Semantic) + '}
        {'`/api/embed` (Gemini text-embedding-004 / fallback hash) + '}
        {'Firestore `/semantic/{kind}/items/` + admin `/admin/reindex` + '}
        {'QuickNotes auto-reindex (debounce 2s). Domain `trishteam.io.vn` '}
        {'guide ở `docs/DOMAIN-TENTEN.md` · Kế tiếp: Phase 13 design v2 '}
        {'(shadcn + 6 theme).'}
      </footer>
    </main>
  );
}
