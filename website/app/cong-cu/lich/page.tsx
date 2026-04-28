import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';
import { HolidaysTimelineWidget } from '@/components/widgets/holidays-widget';
import { CalendarEventsWidget } from '@/components/widgets/calendar-events-widget';

export const metadata = {
  title: 'Lịch · Ngày lễ — TrishTEAM',
  description: 'Lịch âm dương + ngày lễ Việt Nam + lịch công tác cá nhân.',
};

export default function CalendarPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/" className="inline-flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={15} /> Quay lại Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar size={26} strokeWidth={1.75} style={{ color: 'var(--color-accent-primary)' }} />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Lịch · Ngày lễ</h1>
        </div>
        <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
          Lịch âm dương Việt Nam + ngày lễ chính thức + lịch công tác cá nhân (sync khi đăng nhập).
        </p>
      </header>

      <div className="space-y-6">
        <HolidaysTimelineWidget />
        <CalendarEventsWidget />
      </div>
    </main>
  );
}
