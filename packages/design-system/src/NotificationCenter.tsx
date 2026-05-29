/**
 * Phase 78.13.11–12 — NotificationCenter shared widget.
 *
 * Bell icon + unread badge ở topbar 4 app desktop. Click → dropdown list
 * "có gì mới" cross-resource:
 *   - Font packs mới release (fontpacks collection)
 *   - ATGT block mới có release_notes (atgt_blocks)
 *   - LISP library mới có release_notes (lisp_library)
 *
 * Cách dùng:
 *   <AppTopbar extras={<NotificationCenter appHint="utilities" />} />
 *
 * Phase 78.13.12 enhancements:
 *   - Realtime: onSnapshot listener trên 3 collection — admin push → bell update
 *     ngay (không cần user reload).
 *   - Multi-device sync: lastSeen lưu cả localStorage (fast initial)
 *     và Firestore `user_notifications/{uid}.last_seen` (cross-device).
 *   - "Mark all as read" button trong dropdown.
 *   - Filter checkbox theo kind (font/atgt/lisp).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Firestore } from 'firebase/firestore';

const LAST_SEEN_KEY = 'trishteam.notifications.last_seen';
const FILTER_KEY = 'trishteam.notifications.filters';
const QUIET_KEY = 'trishteam.notifications.quiet_hours';
// Phase 78.13.14
const SNOOZE_KEY = 'trishteam.notifications.snoozed';
const SOUND_KEY = 'trishteam.notifications.sound_enabled';
const LAST_COUNT_KEY = 'trishteam.notifications.last_count'; // detect new arrivals

// i18n
type Lang = 'vi' | 'en';
type I18n = Record<string, { vi: string; en: string }>;
const STRINGS: I18n = {
  notifications:       { vi: '📬 Thông báo',         en: '📬 Notifications' },
  live:                { vi: '● live',                en: '● live' },
  quiet:               { vi: '🔕 quiet',              en: '🔕 quiet' },
  markAllRead:         { vi: '✓ Đọc hết',             en: '✓ Mark all read' },
  settings:            { vi: 'Cài đặt',               en: 'Settings' },
  newBadge:            { vi: '● MỚI',                 en: '● NEW' },
  pinned:              { vi: '📌 Ghim',               en: '📌 Pinned' },
  empty:               { vi: 'Chưa có thông báo nào. Admin upload resource có release_notes sẽ xuất hiện ở đây.', en: 'No notifications yet. Resources with release notes will appear here.' },
  emptyFiltered:       { vi: 'Không có thông báo cho filter hiện tại.', en: 'No notifications match current filter.' },
  connecting:          { vi: '⟳ Đang kết nối realtime...', en: '⟳ Connecting realtime...' },
  quietHours:          { vi: '🔕 Giờ yên tĩnh',       en: '🔕 Quiet hours' },
  quietHoursDesc:      { vi: 'Trong khoảng này, badge dim xám + chuông im. Vẫn nhận notification nhưng không gây phân tâm.', en: 'During this period, badge dims grey + bell mutes. Notifications still arrive but won\'t distract.' },
  enableQuiet:         { vi: 'Bật giờ yên tĩnh',      en: 'Enable quiet hours' },
  enableSound:         { vi: '🔊 Âm thanh khi có thông báo mới', en: '🔊 Sound when new notification arrives' },
  from:                { vi: 'Từ',                    en: 'From' },
  toHour:              { vi: 'giờ → đến',             en: 'h → to' },
  hour:                { vi: 'giờ',                   en: 'h' },
  snooze:              { vi: 'Ẩn tạm',                en: 'Snooze' },
  snooze1h:            { vi: '1 giờ',                 en: '1 hour' },
  snooze4h:            { vi: '4 giờ',                 en: '4 hours' },
  snoozeMorning:       { vi: 'Sáng mai (8h)',         en: 'Tomorrow morning (8am)' },
  snooze1d:            { vi: '1 ngày',                en: '1 day' },
  hintUtilities:       { vi: '💡 Mở tab Font để cài pack mới', en: '💡 Open Font tab to install new pack' },
  hintWork:            { vi: '💡 Mở Design / Library xem block/lisp mới', en: '💡 Open Design / Library to see new blocks/lisp' },
  hintAdmin:           { vi: '💡 Mở panel tương ứng để quản lý', en: '💡 Open relevant panel to manage' },
  hintFinance:         { vi: '💡 Notification từ admin TrishTEAM', en: '💡 Notifications from TrishTEAM admin' },
};
function t(lang: Lang, key: keyof typeof STRINGS): string {
  return STRINGS[key]?.[lang] ?? key;
}

type ResourceKind = 'fontpack' | 'atgt' | 'lisp' | 'announcement';

interface NotificationItem {
  id: string;
  kind: ResourceKind;
  title: string;
  notes: string;
  date: number;
  badge?: string;
  /** Phase 78.13.14 — chỉ áp dụng cho announcement (Broadcast với pinned=true) */
  pinned?: boolean;
}

const KIND_META: Record<ResourceKind, { icon: string; label: string; color: string }> = {
  fontpack:     { icon: '🔤', label: 'Font Pack',     color: '#FBBF24' },
  atgt:         { icon: '🚸', label: 'ATGT Block',    color: '#F87171' },
  lisp:         { icon: '🧩', label: 'AutoLISP',      color: '#34D399' },
  announcement: { icon: '📢', label: 'Thông báo',     color: '#A78BFA' },
};

const ALL_KINDS: ResourceKind[] = ['announcement', 'fontpack', 'atgt', 'lisp'];

interface QuietHours {
  enabled: boolean;
  startHour: number; // 0..23
  endHour: number;   // 0..23 (nếu < startHour thì cross-midnight)
}

const DEFAULT_QUIET: QuietHours = { enabled: false, startHour: 22, endHour: 7 };

export interface NotificationCenterProps {
  /** Firestore instance — caller phải pass vào để tránh circular dep với @trishteam/auth. */
  db: Firestore | null;
  /** Firebase Auth uid của user hiện tại (null nếu chưa login) — dùng cho multi-device lastSeen sync. */
  currentUid: string | null;
  /** App đang dùng — chỉ để personalize tiêu đề dropdown, không filter. */
  appHint?: 'work' | 'utilities' | 'finance' | 'admin';
  /** Maximum items hiển thị trong dropdown (default 30). */
  maxItems?: number;
  /** Phase 78.13.14 — ngôn ngữ UI (default 'vi'). */
  lang?: 'vi' | 'en';
}

export function NotificationCenter({ db, currentUid, appHint, maxItems = 30, lang = 'vi' }: NotificationCenterProps): JSX.Element {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(() => loadLocalLastSeen());
  const [enabledKinds, setEnabledKinds] = useState<Set<ResourceKind>>(() => loadFilters());
  const [quiet, setQuiet] = useState<QuietHours>(() => loadQuietHours());
  const [showSettings, setShowSettings] = useState(false);
  // Phase 78.13.14 — Snooze + Sound
  const [snoozeMap, setSnoozeMap] = useState<Record<string, number>>(() => loadSnoozeMap());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadSoundEnabled());
  const [snoozeMenuFor, setSnoozeMenuFor] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef<number>(loadLastCount());

  // Tick mỗi phút để recompute "đang quiet không" mà không cần rerender liên tục
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n: number) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const isQuietNow = useMemo(() => isInQuietHours(quiet, new Date()), [quiet]);

  // Phase 78.13.12 — Subscribe realtime + cross-device lastSeen
  useEffect(() => {
    let unsubscribers: Array<() => void> = [];
    let cancelled = false;

    async function setup(): Promise<void> {
      if (!db) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Dynamic import firebase/firestore để tránh kéo bundle nặng khi component chưa mount
        const firestoreLib = await import('firebase/firestore');
        if (cancelled) return;
        const { collection, onSnapshot, doc, getDoc } = firestoreLib;

        // Pull lastSeen từ Firestore (cross-device), merge với local (max).
        if (currentUid) {
          try {
            const userDocSnap = await getDoc(doc(db, 'user_notifications', currentUid));
            if (userDocSnap.exists()) {
              const remoteLastSeen = (userDocSnap.data() as { last_seen?: number }).last_seen ?? 0;
              const localLastSeen = loadLocalLastSeen();
              const merged = Math.max(remoteLastSeen, localLastSeen);
              if (merged > localLastSeen) {
                saveLocalLastSeen(merged);
                if (!cancelled) setLastSeen(merged);
              }
            }
          } catch {
            /* ignore — fallback to local-only */
          }
        }

        // Aggregate buffer cho 4 collection — re-render sau mỗi snapshot.
        const buffers: Record<ResourceKind, NotificationItem[]> = {
          fontpack: [],
          atgt: [],
          lisp: [],
          announcement: [],
        };

        function flush(): void {
          if (cancelled) return;
          const all = [
            ...buffers.fontpack,
            ...buffers.atgt,
            ...buffers.lisp,
            ...buffers.announcement,
          ];
          // Phase 78.13.14 — Pinned first (kept newest-first inside groups)
          all.sort((a, b) => {
            const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            if (pinDiff !== 0) return pinDiff;
            return b.date - a.date;
          });
          setItems(all.slice(0, maxItems));
          setLoading(false);
        }

        // fontpacks
        unsubscribers.push(
          onSnapshot(
            collection(db, 'fontpacks'),
            (snap) => {
              buffers.fontpack = [];
              snap.forEach((d) => {
                const data = d.data() as { name?: string; version?: string; release_notes?: string; release_date?: number };
                if (!data.release_notes) return;
                buffers.fontpack.push({
                  id: `fontpack:${d.id}`,
                  kind: 'fontpack',
                  title: `${data.name ?? d.id}${data.version ? ' v' + data.version : ''}`,
                  notes: data.release_notes,
                  date: data.release_date ?? 0,
                });
              });
              flush();
            },
            (err) => {
              if (!cancelled) setError(err.message);
            },
          ),
        );

        // atgt_blocks
        unsubscribers.push(
          onSnapshot(
            collection(db, 'atgt_blocks'),
            (snap) => {
              buffers.atgt = [];
              snap.forEach((d) => {
                const data = d.data() as { label?: string; category?: string; release_notes?: string; release_date?: number };
                if (!data.release_notes) return;
                buffers.atgt.push({
                  id: `atgt:${d.id}`,
                  kind: 'atgt',
                  title: data.label ?? d.id,
                  notes: data.release_notes,
                  date: data.release_date ?? 0,
                  badge: data.category,
                });
              });
              flush();
            },
            () => { /* silent */ },
          ),
        );

        // lisp_library
        unsubscribers.push(
          onSnapshot(
            collection(db, 'lisp_library'),
            (snap) => {
              buffers.lisp = [];
              snap.forEach((d) => {
                const data = d.data() as { name?: string; command?: string; release_notes?: string; release_date?: number };
                if (!data.release_notes) return;
                buffers.lisp.push({
                  id: `lisp:${d.id}`,
                  kind: 'lisp',
                  title: data.name ?? d.id,
                  notes: data.release_notes,
                  date: data.release_date ?? 0,
                  badge: data.command,
                });
              });
              flush();
            },
            () => { /* silent */ },
          ),
        );

        // Phase 78.13.13 — announcements (Broadcasts) với surface=desktop-bell|both
        unsubscribers.push(
          onSnapshot(
            collection(db, 'announcements'),
            (snap) => {
              buffers.announcement = [];
              const now = Date.now();
              snap.forEach((d) => {
                const data = d.data() as {
                  title?: string;
                  body?: string;
                  severity?: 'info' | 'warning' | 'critical';
                  surface?: 'website-banner' | 'desktop-bell' | 'both';
                  active?: boolean;
                  expires_at?: number;
                  created_at?: number;
                  published_at?: number;
                  pinned?: boolean;
                };
                // Filter: chỉ broadcast active + surface 'desktop-bell' hoặc 'both' (default both nếu undefined)
                const surface = data.surface ?? 'both';
                if (surface === 'website-banner') return;
                if (data.active === false) return;
                if (data.expires_at && data.expires_at > 0 && data.expires_at < now) return;
                buffers.announcement.push({
                  id: `announcement:${d.id}`,
                  kind: 'announcement',
                  title: data.title ?? '(không tiêu đề)',
                  notes: data.body ?? '',
                  date: data.published_at ?? data.created_at ?? 0,
                  badge: data.severity ? data.severity.toUpperCase() : undefined,
                  pinned: data.pinned === true,
                });
              });
              flush();
            },
            () => { /* silent */ },
          ),
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }

    void setup();
    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
    };
  }, [maxItems, db, currentUid]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function onClick(ev: MouseEvent): void {
      if (popRef.current && !popRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Filter: kind enabled + chưa bị snooze
  const filteredItems = useMemo(
    () => {
      const now = Date.now();
      return items.filter((it: NotificationItem) => {
        if (!enabledKinds.has(it.kind)) return false;
        const snoozeUntil = snoozeMap[it.id];
        if (snoozeUntil && snoozeUntil > now) return false;
        return true;
      });
    },
    [items, enabledKinds, snoozeMap],
  );

  const unreadCount = useMemo(
    () => filteredItems.filter((it: NotificationItem) => it.date > lastSeen).length,
    [filteredItems, lastSeen],
  );

  // Phase 78.13.14 — Phát chime khi unreadCount tăng (so với lần render trước)
  useEffect(() => {
    if (loading) return;
    const prev = lastCountRef.current;
    if (unreadCount > prev && soundEnabled && !isQuietNow) {
      void playChime();
    }
    lastCountRef.current = unreadCount;
    try {
      window.localStorage.setItem(LAST_COUNT_KEY, String(unreadCount));
    } catch { /* ignore */ }
  }, [unreadCount, loading, soundEnabled, isQuietNow]);

  async function persistLastSeen(value: number): Promise<void> {
    saveLocalLastSeen(value);
    setLastSeen(value);
    // Sync Firestore (best-effort, không block UI)
    if (!db || !currentUid) return;
    try {
      const firestoreLib = await import('firebase/firestore');
      const { doc, setDoc, serverTimestamp } = firestoreLib;
      await setDoc(
        doc(db, 'user_notifications', currentUid),
        { last_seen: value, updated_at: serverTimestamp() },
        { merge: true },
      );
    } catch {
      /* silent */
    }
  }

  function handleOpen(): void {
    setOpen((prev: boolean) => {
      const next = !prev;
      if (next && unreadCount > 0) {
        const now = Date.now();
        void persistLastSeen(now);
      }
      return next;
    });
  }

  function handleMarkAllRead(): void {
    if (filteredItems.length === 0) return;
    void persistLastSeen(Date.now());
  }

  function handleSnooze(itemId: string, hours: number | 'tomorrow-morning'): void {
    let until: number;
    if (hours === 'tomorrow-morning') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      until = d.getTime();
    } else {
      until = Date.now() + hours * 3_600_000;
    }
    const next = { ...snoozeMap, [itemId]: until };
    // Cleanup expired
    const now = Date.now();
    for (const k of Object.keys(next)) {
      const v = next[k];
      if (v !== undefined && v <= now && k !== itemId) delete next[k];
    }
    saveSnoozeMap(next);
    setSnoozeMap(next);
    setSnoozeMenuFor(null);
  }

  function toggleSound(): void {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? '1' : '0');
    } catch { /* ignore */ }
    if (next) {
      void playChime(); // preview
    }
  }

  function toggleKind(kind: ResourceKind): void {
    setEnabledKinds((prev: Set<ResourceKind>) => {
      const next = new Set<ResourceKind>(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      // Đảm bảo tối thiểu 1 kind enabled
      if (next.size === 0) return prev;
      saveFilters(next);
      return next;
    });
  }

  return (
    <div style={{ position: 'relative' }} ref={popRef}>
      <button
        type="button"
        onClick={handleOpen}
        title={
          isQuietNow
            ? `${unreadCount} thông báo (đang giờ yên tĩnh ${quiet.startHour}:00–${quiet.endHour}:00)`
            : unreadCount > 0
              ? `${unreadCount} thông báo mới`
              : 'Thông báo'
        }
        aria-label="Thông báo"
        style={{
          ...bellBtnStyle,
          opacity: isQuietNow ? 0.55 : 1,
        }}
      >
        <span style={{ fontSize: 14 }}>{isQuietNow ? '🔕' : '🔔'}</span>
        {unreadCount > 0 && (
          <span
            style={{
              ...badgeStyle,
              background: isQuietNow ? '#6b7280' : '#FBBF24',
              color: isQuietNow ? '#fff' : '#000',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={dropdownStyle}>
          <div style={dropdownHeaderStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              {t(lang, 'notifications')}
              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 99, background: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 600 }}>
                {t(lang, 'live')}
              </span>
              {isQuietNow && (
                <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 99, background: 'rgba(107,114,128,0.25)', color: '#9ca3af', fontWeight: 600 }}>
                  {t(lang, 'quiet')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {filteredItems.length > 0 && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title={t(lang, 'markAllRead')}
                  style={miniBtnStyle}
                >
                  {t(lang, 'markAllRead')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSettings((s: boolean) => !s)}
                title={t(lang, 'settings')}
                style={{ ...miniBtnStyle, background: showSettings ? 'var(--color-surface-muted)' : 'transparent' }}
              >
                ⚙
              </button>
            </div>
          </div>

          {showSettings && (
            <div style={settingsPanelStyle}>
              <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-primary)' }}>
                {t(lang, 'quietHours')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                {t(lang, 'quietHoursDesc')}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={quiet.enabled}
                  onChange={(e) => {
                    const next = { ...quiet, enabled: e.target.checked };
                    saveQuietHours(next);
                    setQuiet(next);
                  }}
                  style={{ accentColor: 'var(--color-accent-primary)' }}
                />
                {t(lang, 'enableQuiet')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 10 }}>
                <span>{t(lang, 'from')}</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quiet.startHour}
                  disabled={!quiet.enabled}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
                    const next = { ...quiet, startHour: v };
                    saveQuietHours(next);
                    setQuiet(next);
                  }}
                  style={quietInputStyle}
                />
                <span>{t(lang, 'toHour')}</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={quiet.endHour}
                  disabled={!quiet.enabled}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
                    const next = { ...quiet, endHour: v };
                    saveQuietHours(next);
                    setQuiet(next);
                  }}
                  style={quietInputStyle}
                />
                <span>{t(lang, 'hour')}</span>
              </div>
              {/* Phase 78.13.14 — Sound chime toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, cursor: 'pointer', paddingTop: 8, borderTop: '1px solid var(--color-border-subtle)' }}>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={toggleSound}
                  style={{ accentColor: 'var(--color-accent-primary)' }}
                />
                {t(lang, 'enableSound')}
              </label>
            </div>
          )}

          {/* Filter chips */}
          <div style={filterRowStyle}>
            {ALL_KINDS.map((k) => {
              const meta = KIND_META[k];
              const enabled = enabledKinds.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  title={enabled ? `Ẩn ${meta.label}` : `Hiện ${meta.label}`}
                  style={{
                    ...filterChipStyle,
                    background: enabled ? meta.color + '20' : 'transparent',
                    color: enabled ? meta.color : 'var(--color-text-muted)',
                    borderColor: enabled ? meta.color + '60' : 'var(--color-border-subtle)',
                    opacity: enabled ? 1 : 0.55,
                  }}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>

          {loading && (
            <div style={emptyStyle}>{t(lang, 'connecting')}</div>
          )}
          {error && (
            <div style={{ ...emptyStyle, color: '#fca5a5' }}>⚠ {error}</div>
          )}
          {!loading && !error && filteredItems.length === 0 && (
            <div style={emptyStyle}>
              {enabledKinds.size < ALL_KINDS.length
                ? t(lang, 'emptyFiltered')
                : t(lang, 'empty')}
            </div>
          )}

          {filteredItems.map((it: NotificationItem) => {
            const meta = KIND_META[it.kind] ?? KIND_META.announcement;
            const isUnread = it.date > lastSeen;
            const snoozeOpen = snoozeMenuFor === it.id;
            return (
              <div
                key={it.id}
                style={{
                  ...itemStyle,
                  background: it.pinned
                    ? 'rgba(167,139,250,0.08)'
                    : isUnread
                      ? 'rgba(251,191,36,0.06)'
                      : 'transparent',
                  borderLeft: it.pinned ? '2px solid #A78BFA' : 'none',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  {it.pinned && (
                    <span style={{ ...kindPillStyle, background: 'rgba(167,139,250,0.22)', color: '#A78BFA' }}>
                      {t(lang, 'pinned')}
                    </span>
                  )}
                  <span style={{ ...kindPillStyle, background: meta.color + '20', color: meta.color }}>
                    {meta.icon} {meta.label}
                  </span>
                  {it.badge && (
                    <span style={{ ...kindPillStyle, background: 'var(--color-surface-muted)', color: 'var(--color-text-muted)' }}>
                      {it.badge}
                    </span>
                  )}
                  {isUnread && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#FBBF24' }}>{t(lang, 'newBadge')}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setSnoozeMenuFor(snoozeOpen ? null : it.id)}
                    title={t(lang, 'snooze')}
                    style={snoozeBtnStyle}
                  >
                    💤
                  </button>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{it.title}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 60,
                    overflow: 'hidden',
                  }}
                >
                  {it.notes}
                </div>
                {it.date > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {new Date(it.date).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}
                  </div>
                )}
                {snoozeOpen && (
                  <div style={snoozeMenuStyle}>
                    <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                      💤 {t(lang, 'snooze')}
                    </div>
                    <button type="button" onClick={() => handleSnooze(it.id, 1)} style={snoozeOptStyle}>{t(lang, 'snooze1h')}</button>
                    <button type="button" onClick={() => handleSnooze(it.id, 4)} style={snoozeOptStyle}>{t(lang, 'snooze4h')}</button>
                    <button type="button" onClick={() => handleSnooze(it.id, 'tomorrow-morning')} style={snoozeOptStyle}>{t(lang, 'snoozeMorning')}</button>
                    <button type="button" onClick={() => handleSnooze(it.id, 24)} style={snoozeOptStyle}>{t(lang, 'snooze1d')}</button>
                  </div>
                )}
              </div>
            );
          })}

          {appHint && (
            <div style={footerHintStyle}>
              {appHint === 'utilities' && t(lang, 'hintUtilities')}
              {appHint === 'work' && t(lang, 'hintWork')}
              {appHint === 'admin' && t(lang, 'hintAdmin')}
              {appHint === 'finance' && t(lang, 'hintFinance')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function loadLocalLastSeen(): number {
  try {
    const v = window.localStorage.getItem(LAST_SEEN_KEY);
    if (v) return parseInt(v, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

function saveLocalLastSeen(value: number): void {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(value));
  } catch { /* ignore */ }
}

function loadFilters(): Set<ResourceKind> {
  try {
    const v = window.localStorage.getItem(FILTER_KEY);
    if (!v) return new Set<ResourceKind>(ALL_KINDS);
    const arr = JSON.parse(v) as string[];
    const valid: ResourceKind[] = arr.filter((k): k is ResourceKind =>
      (ALL_KINDS as string[]).includes(k),
    );
    return valid.length > 0 ? new Set<ResourceKind>(valid) : new Set<ResourceKind>(ALL_KINDS);
  } catch {
    return new Set<ResourceKind>(ALL_KINDS);
  }
}

function saveFilters(set: Set<ResourceKind>): void {
  try {
    window.localStorage.setItem(FILTER_KEY, JSON.stringify(Array.from(set)));
  } catch { /* ignore */ }
}

function loadQuietHours(): QuietHours {
  try {
    const v = window.localStorage.getItem(QUIET_KEY);
    if (!v) return DEFAULT_QUIET;
    const parsed = JSON.parse(v) as Partial<QuietHours>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
      startHour: clampHour(parsed.startHour ?? DEFAULT_QUIET.startHour),
      endHour: clampHour(parsed.endHour ?? DEFAULT_QUIET.endHour),
    };
  } catch {
    return DEFAULT_QUIET;
  }
}

function saveQuietHours(q: QuietHours): void {
  try {
    window.localStorage.setItem(QUIET_KEY, JSON.stringify(q));
  } catch { /* ignore */ }
}

function clampHour(h: number): number {
  return Math.max(0, Math.min(23, Math.floor(h)));
}

function loadSnoozeMap(): Record<string, number> {
  try {
    const v = window.localStorage.getItem(SNOOZE_KEY);
    if (!v) return {};
    const parsed = JSON.parse(v) as Record<string, number>;
    // Cleanup expired entries on load
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const k of Object.keys(parsed)) {
      const val = parsed[k];
      if (val !== undefined && val > now) cleaned[k] = val;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveSnoozeMap(m: Record<string, number>): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

function loadSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function loadLastCount(): number {
  try {
    const v = window.localStorage.getItem(LAST_COUNT_KEY);
    if (v) return parseInt(v, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

/**
 * Play a short "ding" chime using Web Audio API (no external asset).
 * 2 tones: 880Hz + 660Hz, ~200ms total, gentle envelope.
 */
async function playChime(): Promise<void> {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    function tone(freq: number, start: number, dur: number): void {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    }
    tone(880, 0, 0.12);
    tone(660, 0.08, 0.16);
    // Cleanup ctx sau khi xong
    setTimeout(() => { void ctx.close(); }, 400);
  } catch {
    /* AudioContext bị block hoặc không support — silent */
  }
}

/**
 * Trả true nếu hiện tại trong khoảng quiet hours.
 * Hỗ trợ cross-midnight: ví dụ 22:00 → 7:00 (qua đêm).
 */
function isInQuietHours(q: QuietHours, now: Date): boolean {
  if (!q.enabled) return false;
  const h = now.getHours();
  if (q.startHour === q.endHour) return false; // 0 giờ
  if (q.startHour < q.endHour) {
    // Same day: [start, end)
    return h >= q.startHour && h < q.endHour;
  }
  // Cross midnight: [start, 24) ∪ [0, end)
  return h >= q.startHour || h < q.endHour;
}

// ============================================================
// Styles
// ============================================================

const bellBtnStyle: CSSProperties = {
  position: 'relative',
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -4,
  right: -4,
  minWidth: 16,
  height: 16,
  padding: '0 4px',
  borderRadius: 99,
  background: '#FBBF24',
  color: '#000',
  fontSize: 9,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px solid var(--color-surface-card)',
};

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: 0,
  width: 380,
  maxHeight: 560,
  overflowY: 'auto',
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 8,
  boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
  zIndex: 1000,
};

const dropdownHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  background: 'var(--color-surface-card)',
  borderBottom: '1px solid var(--color-border-subtle)',
  zIndex: 1,
};

const filterRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '8px 12px',
  background: 'var(--color-surface-bg)',
  borderBottom: '1px solid var(--color-border-subtle)',
  flexWrap: 'wrap',
};

const filterChipStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 99,
  border: '1px solid',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const miniBtnStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 4,
  padding: '2px 8px',
  color: 'var(--color-text-muted)',
  fontSize: 10.5,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const itemStyle: CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const kindPillStyle: CSSProperties = {
  fontSize: 9.5,
  padding: '1px 6px',
  borderRadius: 99,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
};

const emptyStyle: CSSProperties = {
  padding: 24,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 12.5,
};

const snoozeBtnStyle: CSSProperties = {
  marginLeft: 'auto',
  width: 22,
  height: 22,
  padding: 0,
  borderRadius: 4,
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 11,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-muted)',
};

const snoozeMenuStyle: CSSProperties = {
  position: 'absolute',
  top: 32,
  right: 14,
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 6,
  padding: 6,
  zIndex: 1100,
  boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 140,
};

const snoozeOptStyle: CSSProperties = {
  padding: '4px 8px',
  background: 'transparent',
  border: 'none',
  borderRadius: 3,
  color: 'var(--color-text-primary)',
  fontSize: 11.5,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

const settingsPanelStyle: CSSProperties = {
  padding: '10px 14px',
  background: 'var(--color-surface-bg)',
  borderBottom: '1px solid var(--color-border-subtle)',
};

const quietInputStyle: CSSProperties = {
  width: 50,
  padding: '3px 6px',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  background: 'var(--color-surface-card)',
  color: 'var(--color-text-primary)',
  fontSize: 11.5,
  fontFamily: 'inherit',
  textAlign: 'center',
};

const footerHintStyle: CSSProperties = {
  padding: '8px 14px',
  fontSize: 11,
  color: 'var(--color-text-muted)',
  borderTop: '1px solid var(--color-border-subtle)',
  background: 'var(--color-surface-bg)',
  position: 'sticky',
  bottom: 0,
};
