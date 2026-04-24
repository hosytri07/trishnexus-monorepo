'use client';

/**
 * PomodoroWidget — bộ đếm Pomodoro 25/5.
 *
 * Cycle: 4 focus 25' × 5' break + 1 long break 15' (sau 4 pomodoro).
 * State: mode ('focus'|'break'|'long'), remaining (giây), running, sessions (count).
 * Lưu sessions + streak ở localStorage key 'trishteam:pomodoro:stats' (day-based).
 *
 * Notification khi hết phiên (nếu user grant quyền).
 * Không dùng setInterval nặng — setTimeout recursively mỗi 1s khi running.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Target,
  Timer,
} from 'lucide-react';
import { WidgetCard } from './widget-card';

type Mode = 'focus' | 'break' | 'long';

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
  long: 15 * 60,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: 'Tập trung',
  break: 'Nghỉ ngắn',
  long: 'Nghỉ dài',
};

const MODE_ACCENT: Record<Mode, string> = {
  focus: '#EF4444',
  break: '#10B981',
  long: '#3B82F6',
};

const STATS_KEY = 'trishteam:pomodoro:stats';

type Stats = {
  date: string; // YYYY-MM-DD
  completed: number; // focus sessions finished today
  totalMinutes: number; // total focus minutes today
};

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadStats(): Stats {
  const today = todayKey();
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return { date: today, completed: 0, totalMinutes: 0 };
    const parsed = JSON.parse(raw) as Stats;
    if (parsed.date !== today) {
      return { date: today, completed: 0, totalMinutes: 0 };
    }
    return parsed;
  } catch {
    return { date: today, completed: 0, totalMinutes: 0 };
  }
}

function saveStats(s: Stats): void {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function formatMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: 'trishteam-pomodoro' });
  } catch {
    /* ignore */
  }
}

function beep() {
  try {
    type AudioCtxCtor = typeof AudioContext;
    const w = window as unknown as {
      AudioContext?: AudioCtxCtor;
      webkitAudioContext?: AudioCtxCtor;
    };
    const Ctx = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* ignore */
  }
}

export function PomodoroWidget() {
  const [mode, setMode] = useState<Mode>('focus');
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [pomoCount, setPomoCount] = useState(0); // focus completed in current cycle (reset sau long break)
  const [stats, setStats] = useState<Stats>({
    date: todayKey(),
    completed: 0,
    totalMinutes: 0,
  });
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [mounted, setMounted] = useState(false);

  // refs để handler setTimeout đọc latest values
  const modeRef = useRef(mode);
  const pomoCountRef = useRef(pomoCount);
  modeRef.current = mode;
  pomoCountRef.current = pomoCount;

  useEffect(() => {
    setMounted(true);
    setStats(loadStats());
    if (typeof Notification !== 'undefined') {
      setNotifPerm(Notification.permission);
    }
  }, []);

  const finishSession = useCallback(() => {
    const finishedMode = modeRef.current;
    setRunning(false);
    beep();

    if (finishedMode === 'focus') {
      // stats: +1 phiên focus hoàn tất
      setStats((s) => {
        const next: Stats = {
          date: s.date === todayKey() ? s.date : todayKey(),
          completed: (s.date === todayKey() ? s.completed : 0) + 1,
          totalMinutes:
            (s.date === todayKey() ? s.totalMinutes : 0) +
            DURATIONS.focus / 60,
        };
        saveStats(next);
        return next;
      });

      const nextPomo = pomoCountRef.current + 1;
      setPomoCount(nextPomo);

      if (nextPomo % 4 === 0) {
        setMode('long');
        setRemaining(DURATIONS.long);
        notify('Làm xong! 🍅', 'Đã đến giờ nghỉ dài (15 phút).');
      } else {
        setMode('break');
        setRemaining(DURATIONS.break);
        notify('Làm xong! 🍅', 'Nghỉ 5 phút nhé.');
      }
    } else {
      // Break xong → quay lại focus
      setMode('focus');
      setRemaining(DURATIONS.focus);
      notify('Hết giờ nghỉ ⏰', 'Bắt đầu phiên tập trung mới.');
      if (finishedMode === 'long') setPomoCount(0);
    }
  }, []);

  // Timer loop: setTimeout mỗi 1s
  useEffect(() => {
    if (!running) return undefined;
    if (remaining <= 0) {
      finishSession();
      return undefined;
    }
    const id = setTimeout(() => {
      setRemaining((r) => r - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [running, remaining, finishSession]);

  function toggle() {
    setRunning((v) => !v);
  }

  function reset() {
    setRunning(false);
    setRemaining(DURATIONS[mode]);
  }

  function skip() {
    finishSession();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setRemaining(DURATIONS[m]);
    setRunning(false);
  }

  async function toggleNotif() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    } else {
      setNotifPerm(Notification.permission);
    }
  }

  const accent = MODE_ACCENT[mode];
  const totalSecs = DURATIONS[mode];
  const progress = 1 - remaining / totalSecs;

  // Circle geometry
  const R = 46;
  const CIRC = 2 * Math.PI * R;

  const displayMMSS = useMemo(() => formatMMSS(remaining), [remaining]);

  return (
    <WidgetCard
      title="Pomodoro"
      icon={<Timer size={16} strokeWidth={2} />}
      action={
        <button
          type="button"
          onClick={toggleNotif}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
          style={{
            color:
              notifPerm === 'granted'
                ? 'var(--color-accent-primary)'
                : 'var(--color-text-muted)',
          }}
          title={
            notifPerm === 'granted'
              ? 'Đã bật thông báo'
              : 'Bật thông báo hệ thống'
          }
        >
          {notifPerm === 'granted' ? (
            <Bell size={12} strokeWidth={2} />
          ) : (
            <BellOff size={12} strokeWidth={2} />
          )}
          {notifPerm === 'granted' ? 'ON' : 'OFF'}
        </button>
      }
    >
      {/* Mode tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-md mb-4"
        style={{
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {(['focus', 'break', 'long'] as const).map((m) => {
          const active = mode === m;
          const Icon = m === 'focus' ? Target : Coffee;
          return (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded text-xs font-semibold transition-colors"
              style={{
                background: active ? 'var(--color-surface-card)' : 'transparent',
                color: active ? MODE_ACCENT[m] : 'var(--color-text-muted)',
                boxShadow: active ? 'var(--shadow-xs)' : 'none',
              }}
            >
              <Icon size={12} strokeWidth={2} />
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 140, height: 140 }}>
          <svg
            width="140"
            height="140"
            viewBox="0 0 100 100"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--color-border-default)"
              strokeWidth="3"
            />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={accent}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {displayMMSS}
            </div>
            <div
              className="text-[10px] uppercase tracking-wide mt-0.5"
              style={{ color: accent }}
            >
              {MODE_LABEL[mode]}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border hover:bg-[var(--color-surface-muted)] transition-colors"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
            title="Reset"
            aria-label="Reset"
          >
            <RotateCcw size={14} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-5 rounded-md font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: running
                ? 'var(--color-surface-muted)'
                : 'var(--color-accent-gradient)',
              color: running ? 'var(--color-text-primary)' : '#ffffff',
              border: running
                ? '1px solid var(--color-border-default)'
                : 'none',
              minWidth: 112,
            }}
          >
            {running ? (
              <>
                <Pause size={14} strokeWidth={2.25} />
                Tạm dừng
              </>
            ) : (
              <>
                <Play size={14} strokeWidth={2.25} />
                Bắt đầu
              </>
            )}
          </button>
          <button
            type="button"
            onClick={skip}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md border hover:bg-[var(--color-surface-muted)] transition-colors"
            style={{
              borderColor: 'var(--color-border-default)',
              color: 'var(--color-text-muted)',
            }}
            title="Bỏ qua phiên"
            aria-label="Skip"
          >
            <SkipForward size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Stats today */}
      {mounted && (
        <div
          className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.completed}
            </div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Hôm nay
            </div>
          </div>
          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {stats.totalMinutes}′
            </div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Tập trung
            </div>
          </div>
          <div className="text-center">
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {pomoCount}/4
            </div>
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Chu kỳ
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
