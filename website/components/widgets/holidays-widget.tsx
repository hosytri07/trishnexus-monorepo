'use client';

/**
 * HolidaysTimelineWidget — 5 ngày lễ VN sắp tới.
 * Nguồn: lib/vn-calendar (template solar + lunar).
 * Layout: vertical list compact, mỗi row: tên · badge nguồn · ngày · còn X ngày.
 *
 * Đặt dưới Clock+Weather để fill khoảng trống so với Ecosystem cao bên phải.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { WidgetCard } from './widget-card';
import { getUpcomingHolidays, type ResolvedHoliday } from '@/lib/vn-calendar';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Row({ h }: { h: ResolvedHoliday }) {
  const accent = h.source === 'lunar' ? '#F59E0B' : '#3B82F6';
  const countdownLabel = h.isToday
    ? 'Hôm nay'
    : h.daysLeft === 1
    ? 'Mai'
    : `${h.daysLeft}d`;

  return (
    <li
      className="flex items-center gap-2.5 py-1.5 border-b last:border-0"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      {/* Date chip nhỏ */}
      <div
        className="flex flex-col items-center justify-center shrink-0 rounded tabular-nums"
        style={{
          background: `${accent}15`,
          border: `1px solid ${accent}40`,
          width: 34,
          height: 34,
        }}
      >
        <div
          className="text-sm font-bold leading-none"
          style={{ color: accent }}
        >
          {pad(h.date.getDate())}
        </div>
        <div
          className="text-[9px] uppercase tracking-wide mt-0.5"
          style={{ color: accent, opacity: 0.8 }}
        >
          T{h.date.getMonth() + 1}
        </div>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div
          className="text-xs font-semibold truncate"
          style={{ color: 'var(--color-text-primary)' }}
          title={h.name}
        >
          {h.name}
        </div>
        <div
          className="text-[10px] mt-0.5 truncate"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {h.source === 'lunar' ? 'Âm' : 'Dương'} ·{' '}
          {pad(h.date.getDate())}/{pad(h.date.getMonth() + 1)}
        </div>
      </div>

      {/* Countdown */}
      <div
        className="text-[11px] font-semibold tabular-nums shrink-0"
        style={{ color: h.isToday ? '#10B981' : 'var(--color-text-secondary)' }}
      >
        {countdownLabel}
      </div>
    </li>
  );
}

export function HolidaysTimelineWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    // Cập nhật 1 giờ/lần — không cần tick nhanh.
    const id = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = useMemo<ResolvedHoliday[]>(() => {
    if (!now) return [];
    return getUpcomingHolidays(3, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now ? dayKey(now) : null]);

  return (
    <WidgetCard
      title="Ngày lễ sắp tới"
      icon={<CalendarClock size={16} strokeWidth={2} />}
      action={
        <span
          className="text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {upcoming.length} sự kiện
        </span>
      }
    >
      {upcoming.length === 0 ? (
        <div
          className="py-6 text-center text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Đang tính…
        </div>
      ) : (
        <ul className="-my-1">
          {upcoming.map((h) => (
            <Row key={`${h.name}-${h.date.toISOString()}`} h={h} />
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
