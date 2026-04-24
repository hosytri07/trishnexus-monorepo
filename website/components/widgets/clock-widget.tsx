'use client';

/**
 * ClockWidget — live clock HH:MM:SS + lịch dương + lịch âm + countdown ngày lễ VN.
 *
 * Client-only: server render placeholder để tránh hydration mismatch.
 * Tick mỗi giây cho giờ, tính lại lunar + holiday mỗi khi đổi ngày.
 *
 * Layout thiết kế cân với WeatherWidget (~240-280px cao):
 *   ┌───────────────────────┐
 *   │ 23:04:15              │  ← big time
 *   │ Thứ năm, 23/04/2026   │
 *   ├───────────────────────┤
 *   │ 🌙  7 tháng 3 (âm)    │  ← lunar
 *   │     Năm Bính Ngọ      │
 *   ├───────────────────────┤
 *   │ 🎉 Sắp tới             │  ← countdown
 *   │ Giải phóng miền Nam   │
 *   │ Còn 7 ngày · 30/04    │
 *   └───────────────────────┘
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock, Sparkles } from 'lucide-react';
import { WidgetCard } from './widget-card';
import {
  convertSolar2Lunar,
  getCanChiOfYear,
  getNextHoliday,
  type LunarDate,
  type ResolvedHoliday,
} from '@/lib/vn-calendar';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatSolarDate(d: Date): string {
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  const rest = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${weekday}, ${rest}`;
}

/** Key "YYYY-MM-DD" từ Date local — dùng để detect đổi ngày. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Recompute lunar + holiday chỉ khi đổi ngày (tiết kiệm hơn tick 1s).
  const todayKey = now ? dayKey(now) : null;

  const lunar = useMemo<LunarDate | null>(() => {
    if (!now) return null;
    return convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  const holiday = useMemo<ResolvedHoliday | null>(() => {
    if (!now) return null;
    return getNextHoliday(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  const canChiYear = lunar ? getCanChiOfYear(lunar.year) : '—';

  return (
    <WidgetCard title="Đồng hồ · Lịch" icon={<Clock size={16} strokeWidth={2} />}>
      <div className="flex flex-col gap-3">
        {/* Time + solar date */}
        <div>
          <div
            className="font-bold tabular-nums tracking-tight"
            style={{
              fontSize: 'clamp(2.25rem, 4.5vw, 3rem)',
              color: 'var(--color-text-primary)',
              lineHeight: 1,
            }}
          >
            {now ? formatTime(now) : '--:--:--'}
          </div>
          <div
            className="mt-1.5 text-sm capitalize"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {now ? formatSolarDate(now) : '--/--/----'}
          </div>
        </div>

        {/* Lunar */}
        <div
          className="flex items-start gap-2.5 pt-3 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <CalendarDays
            size={18}
            strokeWidth={2}
            style={{ color: 'var(--color-accent-primary)', marginTop: 2 }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {lunar
                ? `Ngày ${lunar.day} tháng ${lunar.month}${lunar.leap ? ' (nhuận)' : ''} (âm)`
                : '—'}
            </div>
            <div
              className="text-xs mt-0.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Năm {canChiYear}
            </div>
          </div>
        </div>

        {/* Holiday countdown */}
        <div
          className="flex items-start gap-2.5 pt-3 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <Sparkles
            size={18}
            strokeWidth={2}
            style={{ color: '#F59E0B', marginTop: 2 }}
          />
          <div className="min-w-0 flex-1">
            {holiday ? (
              <>
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                  title={holiday.name}
                >
                  {holiday.isToday ? `Hôm nay: ${holiday.name} 🎉` : holiday.name}
                </div>
                <div
                  className="text-xs mt-0.5 tabular-nums"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {holiday.isToday
                    ? 'Chúc mừng'
                    : `Còn ${holiday.daysLeft} ngày · ${pad(
                        holiday.date.getDate()
                      )}/${pad(holiday.date.getMonth() + 1)}`}
                </div>
              </>
            ) : (
              <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                —
              </div>
            )}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
