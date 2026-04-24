/**
 * Client-side error reporting — Phase 16.5.
 *
 * Lightweight, self-hosted (không phụ thuộc Sentry) — gửi event tới
 * `/api/errors` qua `navigator.sendBeacon` (fallback `fetch keepalive`).
 * Schema event trùng hình với Web Vitals:
 *   {
 *     kind: 'error' | 'unhandledrejection' | 'react',
 *     message: string,          // cắt 500 ký tự
 *     stack?: string,           // cắt 4000 ký tự
 *     source?: string,          // file url (onerror source)
 *     line?: number,
 *     column?: number,
 *     componentStack?: string,  // React ErrorBoundary
 *     path: string,             // pathname (không query)
 *     ua: string,               // cắt 120 ký tự
 *     ts: number,               // client epoch ms (server vẫn stamp lại)
 *     release?: string,         // NEXT_PUBLIC_APP_VERSION (để map source map sau)
 *   }
 *
 * Dedupe: nhớ 20 hash cuối cùng trong runtime, bỏ qua trùng (tránh spam
 * khi cùng một exception bùng nổ). Không persist — reload tab reset.
 *
 * Pluggable: nếu sau này mount Sentry/GlitchTip, thay `report()` gọi
 * `Sentry.captureException()` thay vì `/api/errors`. Consumer không đổi.
 */

const MAX_DEDUPE = 20;
const seenHashes: string[] = [];

export type ReportKind = 'error' | 'unhandledrejection' | 'react';

export interface ReportInput {
  kind: ReportKind;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  componentStack?: string;
}

function hash(s: string): string {
  // FNV-1a 32-bit (dedupe only, không phải crypto).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function trunc(s: string | undefined, n: number): string | undefined {
  if (!s) return undefined;
  return s.length > n ? s.slice(0, n) : s;
}

export function report(input: ReportInput): void {
  if (typeof window === 'undefined') return;

  const msg = trunc(input.message, 500) ?? '';
  const stack = trunc(input.stack, 4000);
  const componentStack = trunc(input.componentStack, 2000);

  const fingerprint = hash(
    `${input.kind}|${msg}|${stack?.split('\n')[0] ?? ''}`,
  );
  if (seenHashes.includes(fingerprint)) return;
  seenHashes.push(fingerprint);
  if (seenHashes.length > MAX_DEDUPE) seenHashes.shift();

  const payload = {
    kind: input.kind,
    message: msg,
    stack,
    source: trunc(input.source, 300),
    line: typeof input.line === 'number' ? input.line : undefined,
    column: typeof input.column === 'number' ? input.column : undefined,
    componentStack,
    path: window.location.pathname,
    ua: navigator.userAgent.slice(0, 120),
    ts: Date.now(),
    release:
      process.env.NEXT_PUBLIC_APP_VERSION ?? undefined,
    fingerprint,
  };
  const body = JSON.stringify(payload);

  try {
    if ('sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/errors', blob)) return;
    }
  } catch {
    /* fallback */
  }
  try {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* ignore */
  }
}

let installed = false;

/**
 * Cài global handler cho runtime (browser). Gọi 1 lần trong
 * `<ErrorReporterInstaller />` client component (load trong layout).
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  window.addEventListener('error', (ev) => {
    // Filter resource loading errors (img/script 404) — không cần báo.
    if (ev.message === 'Script error.' && !ev.error) return;
    report({
      kind: 'error',
      message: ev.message || String(ev.error ?? 'unknown error'),
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
      source: ev.filename,
      line: ev.lineno,
      column: ev.colno,
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    let message = 'Unhandled rejection';
    let stack: string | undefined;
    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        /* keep default */
      }
    }
    report({ kind: 'unhandledrejection', message, stack });
  });
}
