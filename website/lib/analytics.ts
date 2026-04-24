/**
 * Analytics helpers — Phase 16.6.
 *
 * Abstraction mỏng trên Umami. Nếu sau này đổi sang Plausible, chỉ sửa
 * `track()` — call site không đổi.
 *
 * Event shape: `(name: string, data?: Record<string, string|number|boolean>)`.
 *
 * Umami expose `window.umami` khi script đã load (script src từ
 * `NEXT_PUBLIC_UMAMI_SRC`, data-website-id = `NEXT_PUBLIC_UMAMI_WEBSITE_ID`).
 * Nếu script chưa sẵn sàng, event được đệm trong `queue[]` rồi flush khi
 * script chạm DOM (check mỗi 500ms tối đa 20 lần).
 *
 * Privacy:
 *   - Không gửi URL query string (Umami mặc định strip; ta cũng strip lần
 *     nữa ở `trackPageview()`).
 *   - Không gửi user id, không gửi IP (Umami anonymize at ingest).
 */

declare global {
  interface Window {
    umami?: {
      track: (
        eventOrName?: string | ((props: Record<string, unknown>) => Record<string, unknown>),
        data?: Record<string, unknown>,
      ) => void;
    };
  }
}

type EventData = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: string;
  data?: EventData;
}

const queue: QueuedEvent[] = [];
let installed = false;
let flushAttempts = 0;
const MAX_FLUSH = 20;

function flush(): void {
  if (typeof window === 'undefined') return;
  if (!window.umami) {
    flushAttempts += 1;
    if (flushAttempts > MAX_FLUSH) return;
    window.setTimeout(flush, 500);
    return;
  }
  while (queue.length > 0) {
    const ev = queue.shift()!;
    try {
      window.umami.track(ev.name, ev.data as Record<string, unknown>);
    } catch {
      /* swallow */
    }
  }
}

export function track(name: string, data?: EventData): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) return;

  if (window.umami) {
    try {
      window.umami.track(name, data as Record<string, unknown>);
    } catch {
      /* swallow */
    }
    return;
  }
  queue.push({ name, data });
  if (!installed) {
    installed = true;
    flushAttempts = 0;
    window.setTimeout(flush, 500);
  }
}

/**
 * Page view manual — Umami tự track pageview ở mọi navigation (Next.js
 * App Router hỗ trợ sẵn qua SPA mode). Gọi hàm này chỉ khi muốn override
 * path (ví dụ virtual page trong SPA widget).
 */
export function trackPageview(path?: string): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) return;
  if (!window.umami) {
    queue.push({ name: '__pageview__', data: path ? { path } : undefined });
    if (!installed) {
      installed = true;
      window.setTimeout(flush, 500);
    }
    return;
  }
  try {
    // Umami API: gọi `umami.track(props => ({...props, url}))` để override.
    if (path) {
      const url = path.split('?')[0];
      window.umami.track((props) => ({ ...props, url }));
    } else {
      window.umami.track();
    }
  } catch {
    /* swallow */
  }
}
