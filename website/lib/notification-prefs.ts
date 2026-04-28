/**
 * lib/notification-prefs.ts — Phase 19.22.
 *
 * Cấu hình thông báo của user. Lưu trong Firestore /users/{uid}.preferences.notifications
 * cho user đã đăng nhập, fallback sang localStorage cho guest.
 *
 * Khi admin xuất bản blog post / cert update / system announcement,
 * server (function) sẽ check pref này trước khi push notification.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type NotifChannel = 'browser_push' | 'email';

export interface NotificationPrefs {
  /** Master toggle — false sẽ tắt tất cả */
  enabled: boolean;
  /** Kênh nhận: browser push (FCM) hay email */
  channels: NotifChannel[];
  /** Loại thông báo */
  topics: {
    /** Bài blog mới publish */
    blog_new_post: boolean;
    /** Có comment trên bài viết / câu hỏi của bạn (sau Phase 20) */
    comment_reply: boolean;
    /** Cập nhật cert exam (BXD ban hành QĐ mới) */
    cert_update: boolean;
    /** Thông báo hệ thống (admin announcement / maintenance) */
    system_announcement: boolean;
    /** Nhắc ôn thi định kỳ (đã enroll) */
    exam_reminder: boolean;
    /** Cập nhật QCVN/TCVN/định mức mới */
    standard_update: boolean;
  };
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  channels: ['browser_push'],
  topics: {
    blog_new_post: true,
    comment_reply: true,
    cert_update: true,
    system_announcement: true,
    exam_reminder: false,
    standard_update: true,
  },
};

const LS_KEY = 'trishteam:notification-prefs';

/** Đọc prefs cho 1 user (uid null = đọc localStorage). */
export async function loadPrefs(uid: string | null): Promise<NotificationPrefs> {
  // 1. Try Firestore for signed-in user
  if (uid && db) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const raw = snap.data()?.preferences?.notifications;
      if (raw && typeof raw === 'object') {
        return mergeWithDefaults(raw as Partial<NotificationPrefs>);
      }
    } catch {
      /* fall through to localStorage */
    }
  }
  // 2. localStorage fallback
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) return mergeWithDefaults(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS, topics: { ...DEFAULT_PREFS.topics } };
}

/** Lưu prefs. Cố gắng vào Firestore; luôn cache vào localStorage. */
export async function savePrefs(
  uid: string | null,
  prefs: NotificationPrefs,
): Promise<void> {
  // Always cache locally for offline / guest
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  if (uid && db) {
    try {
      await setDoc(
        doc(db, 'users', uid),
        { preferences: { notifications: prefs } },
        { merge: true },
      );
    } catch {
      /* swallow — keep local copy */
    }
  }
}

function mergeWithDefaults(p: Partial<NotificationPrefs>): NotificationPrefs {
  return {
    enabled: p.enabled ?? DEFAULT_PREFS.enabled,
    channels: Array.isArray(p.channels) ? p.channels : DEFAULT_PREFS.channels,
    topics: { ...DEFAULT_PREFS.topics, ...(p.topics ?? {}) },
  };
}

/** Yêu cầu permission từ browser cho push notifications. */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export interface TopicMeta {
  key: keyof NotificationPrefs['topics'];
  label: string;
  description: string;
  icon: string;
}

export const TOPIC_LIST: TopicMeta[] = [
  {
    key: 'blog_new_post',
    label: 'Bài blog mới',
    description: 'Khi TrishTEAM publish bài viết mới về kỹ thuật / hướng dẫn.',
    icon: '📰',
  },
  {
    key: 'cert_update',
    label: 'Cập nhật chứng chỉ XD',
    description: 'Khi BXD ban hành QĐ mới hoặc cập nhật ngân hàng câu hỏi.',
    icon: '🎓',
  },
  {
    key: 'standard_update',
    label: 'QCVN / TCVN / định mức mới',
    description: 'Văn bản pháp lý / tiêu chuẩn ngành mới được bổ sung.',
    icon: '📋',
  },
  {
    key: 'system_announcement',
    label: 'Thông báo hệ thống',
    description: 'Tính năng mới, bảo trì, và tin quan trọng từ team.',
    icon: '⚡',
  },
  {
    key: 'comment_reply',
    label: 'Phản hồi & comment',
    description: 'Có người trả lời câu hỏi / comment của bạn.',
    icon: '💬',
  },
  {
    key: 'exam_reminder',
    label: 'Nhắc ôn thi định kỳ',
    description: 'Nhắc bạn quay lại làm đề khi đã không vào trong 1 tuần.',
    icon: '⏰',
  },
];
