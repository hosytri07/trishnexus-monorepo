'use client';

/**
 * Activity log — Phase 11.7.3.
 *
 * Ghi event vào `/users/{uid}/events/{autoId}` (append-only) để
 * ActivityWidget subscribe realtime. Event shape gọn để không tốn quota:
 *
 *   {
 *     kind:  ActivityKind,     // 'login' | 'note_update' | 'app_open' | ...
 *     title: string,           // chuỗi hiển thị VN cho user
 *     meta?: Record<string, string | number | boolean>,
 *     createdAt: serverTimestamp,
 *   }
 *
 * Throttle client-side: mỗi kind gộp lần ghi gần nhất trong cửa sổ thời
 * gian THROTTLE_MS (localStorage key "trishteam:activity:last"). Tránh
 * spam Firestore khi user gõ QuickNotes liên tục.
 */
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type ActivityKind =
  | 'login'
  | 'logout'
  | 'register'
  | 'note_update'
  | 'app_open'
  | 'feedback_sent'
  | 'profile_update';

export interface ActivityEvent {
  kind: ActivityKind;
  title: string;
  meta?: Record<string, string | number | boolean>;
}

const THROTTLE_MS: Partial<Record<ActivityKind, number>> = {
  note_update: 60 * 60 * 1000, // 1h
  app_open: 5 * 60 * 1000, //  5m cùng app
  login: 60 * 1000, //  1 phút tránh double-log
};

const LS_KEY = 'trishteam:activity:last';

function loadThrottleMap(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveThrottleMap(m: Record<string, number>) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

function throttleKey(kind: ActivityKind, meta?: ActivityEvent['meta']) {
  // app_open thêm appId để mỗi app có window riêng.
  if (kind === 'app_open' && meta?.appId) return `app_open:${meta.appId}`;
  return kind;
}

/**
 * Ghi event. Nếu db null (guest / chưa cấu hình Firebase) hoặc uid
 * rỗng → no-op. Trả về true nếu đã ghi, false nếu bị throttle/no-op.
 */
export async function logActivity(
  uid: string | null | undefined,
  ev: ActivityEvent,
): Promise<boolean> {
  if (!uid || !db) return false;
  const now = Date.now();
  const window = THROTTLE_MS[ev.kind];
  if (window) {
    const map = loadThrottleMap();
    const key = throttleKey(ev.kind, ev.meta);
    const last = map[key] ?? 0;
    if (now - last < window) return false;
    map[key] = now;
    saveThrottleMap(map);
  }
  try {
    await addDoc(collection(db, 'users', uid, 'events'), {
      kind: ev.kind,
      title: ev.title,
      meta: ev.meta ?? {},
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn('[activity-log] write fail', err);
    return false;
  }
}

/** Format relative time VN: "vừa xong", "5 phút", "2 giờ", "3 ngày". */
export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return '—';
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'vừa xong';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ngày`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} tháng`;
  const y = Math.floor(mo / 12);
  return `${y} năm`;
}
