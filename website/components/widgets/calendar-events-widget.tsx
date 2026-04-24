'use client';

/**
 * CalendarEventsWidget — lịch công tác cá nhân cực nhỏ.
 *
 * Lưu events ở localStorage. Hiển thị 3-5 sự kiện sắp tới, sắp xếp theo ngày.
 * Form inline: tiêu đề + ngày (datetime-local) + ghi chú.
 * Click sự kiện → mở popover xóa.
 *
 * Không phải full calendar — chỉ là "to-do có ngày". Vừa đủ để user nhắc việc.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  Clock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

type Event = {
  id: string;
  title: string;
  /** ISO string (local time) */
  date: string;
  note?: string;
};

const STORAGE_KEY = 'trishteam:calendar:events';
const MAX_SHOWN = 5;

function loadEvents(): Event[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Event[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        typeof e.title === 'string' &&
        typeof e.date === 'string'
    );
  } catch {
    return [];
  }
}

function saveEvents(events: Event[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* ignore quota/private mode */
  }
}

function formatEventDate(iso: string): {
  dayLabel: string;
  timeLabel: string;
  countdown: string;
  isPast: boolean;
  isToday: boolean;
} {
  const d = new Date(iso);
  if (isNaN(d.getTime()))
    return {
      dayLabel: '--',
      timeLabel: '--:--',
      countdown: '--',
      isPast: false,
      isToday: false,
    };

  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const pad = (n: number) => n.toString().padStart(2, '0');

  let countdown: string;
  const absHours = Math.abs(diffMs) / (1000 * 60 * 60);
  if (sameDay && !isPast) {
    const hours = Math.round(absHours);
    countdown = hours < 1 ? 'Sắp tới' : `${hours}h`;
  } else if (isPast) {
    countdown = 'Đã qua';
  } else {
    const days = Math.ceil(absHours / 24);
    countdown = days === 1 ? 'Mai' : `${days} ngày`;
  }

  return {
    dayLabel: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
    timeLabel: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    countdown,
    isPast,
    isToday: sameDay,
  };
}

/** datetime-local mặc định — +1 giờ so hiện tại, tròn phút. */
function defaultDateTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0);
  d.setMilliseconds(0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CalendarEventsWidget() {
  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    if (mounted) saveEvents(events);
  }, [events, mounted]);

  useEffect(() => {
    if (adding) {
      setDraftDate((cur) => cur || defaultDateTimeLocal());
      // focus sau mount
      setTimeout(() => titleRef.current?.focus(), 20);
    }
  }, [adding]);

  const sorted = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => new Date(e.date).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, MAX_SHOWN);
  }, [events]);

  function handleSave() {
    const title = draftTitle.trim();
    if (!title || !draftDate) return;
    const ev: Event = {
      id: genId(),
      title,
      date: draftDate,
      note: draftNote.trim() || undefined,
    };
    setEvents((prev) => [...prev, ev]);
    setDraftTitle('');
    setDraftDate('');
    setDraftNote('');
    setAdding(false);
  }

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <WidgetCard
      title="Lịch công tác"
      icon={<CalendarPlus size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{
            color: adding
              ? 'var(--color-text-muted)'
              : 'var(--color-accent-primary)',
          }}
        >
          {adding ? <X size={12} /> : <Plus size={12} />}
          {adding ? 'Hủy' : 'Thêm'}
        </button>
      }
    >
      {/* Add form */}
      {adding && (
        <div
          className="mb-3 p-2.5 rounded-md space-y-2"
          style={{
            background: 'var(--color-surface-muted)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <input
            ref={titleRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Tiêu đề sự kiện…"
            className="w-full px-2.5 h-8 rounded-md text-sm outline-none border"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-primary)',
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="px-2 h-8 rounded-md text-xs outline-none border tabular-nums"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
                colorScheme: 'light dark',
              }}
            />
            <input
              type="text"
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="Ghi chú (tùy chọn)"
              className="px-2.5 h-8 rounded-md text-xs outline-none border"
              style={{
                background: 'var(--color-surface-card)',
                borderColor: 'var(--color-border-default)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!draftTitle.trim() || !draftDate}
            className="w-full h-8 rounded-md text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{
              background: 'var(--color-accent-gradient)',
              color: '#ffffff',
            }}
          >
            Lưu sự kiện
          </button>
        </div>
      )}

      {/* List */}
      {!mounted ? (
        <div
          className="py-6 text-center text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Đang tải…
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="py-6 text-center text-sm"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Chưa có sự kiện nào.
          {!adding && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-xs underline hover:opacity-70"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                Thêm sự kiện đầu tiên
              </button>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((e) => {
            const info = formatEventDate(e.date);
            const accent = info.isToday ? '#10B981' : '#3B82F6';
            return (
              <li
                key={e.id}
                className="group flex items-center gap-2.5 py-1.5 px-1.5 rounded-md border-b last:border-0"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <div
                  className="flex flex-col items-center justify-center shrink-0 rounded tabular-nums"
                  style={{
                    background: `${accent}15`,
                    border: `1px solid ${accent}40`,
                    width: 40,
                    height: 40,
                  }}
                >
                  <div
                    className="text-[11px] font-bold leading-none"
                    style={{ color: accent }}
                  >
                    {info.dayLabel}
                  </div>
                  <div
                    className="text-[9px] mt-0.5"
                    style={{ color: accent, opacity: 0.8 }}
                  >
                    {info.timeLabel}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold truncate"
                    style={{
                      color: 'var(--color-text-primary)',
                      textDecoration: info.isPast ? 'line-through' : 'none',
                      opacity: info.isPast ? 0.6 : 1,
                    }}
                    title={e.title}
                  >
                    {e.title}
                  </div>
                  {e.note && (
                    <div
                      className="text-[10px] truncate"
                      style={{ color: 'var(--color-text-muted)' }}
                      title={e.note}
                    >
                      {e.note}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                    style={{
                      background: info.isToday
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(59,130,246,0.10)',
                      color: info.isToday ? '#10B981' : '#3B82F6',
                    }}
                  >
                    <Clock size={9} strokeWidth={2} />
                    {info.countdown}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-muted)]"
                    aria-label={`Xóa ${e.title}`}
                  >
                    <Trash2
                      size={11}
                      strokeWidth={2}
                      style={{ color: '#EF4444' }}
                    />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mounted && events.length > MAX_SHOWN && (
        <div
          className="mt-2 pt-2 border-t text-[10px] text-center"
          style={{
            borderColor: 'var(--color-border-subtle)',
            color: 'var(--color-text-muted)',
          }}
        >
          + {events.length - MAX_SHOWN} sự kiện khác
        </div>
      )}
    </WidgetCard>
  );
}
