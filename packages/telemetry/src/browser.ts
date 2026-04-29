/**
 * @trishteam/telemetry/browser — adapter cho website (Next.js) + desktop renderer (Tauri webview).
 *
 * Strategy:
 *   - reportError: POST /api/errors (sendBeacon ưu tiên, fallback fetch keepalive)
 *   - reportVital: POST /api/vitals (cùng strategy)
 *   - Dedupe local: 20 fingerprint cuối, không gửi lại trong 1 phiên
 *   - Auto-install handler: window.onerror + unhandledrejection
 *
 * Endpoint base mặc định = origin hiện tại. Desktop app dùng `setEndpointBase('https://trishteam.io.vn')`.
 *
 * Phase 21 prep — thay thế website/lib/error-report.ts (giữ tương thích để rollback dễ).
 */

import {
  ErrorPayload,
  VitalPayload,
  sanitizeError,
  sanitizeVital,
  classifyVital,
} from './index.js';

const RECENT_FP_LIMIT = 20;
const recentFingerprints: string[] = [];
let endpointBase = ''; // empty = same-origin

export function setEndpointBase(url: string): void {
  endpointBase = url.replace(/\/$/, '');
}

function shouldDedupe(fp: string | undefined): boolean {
  if (!fp) return false;
  if (recentFingerprints.includes(fp)) return true;
  recentFingerprints.push(fp);
  if (recentFingerprints.length > RECENT_FP_LIMIT) {
    recentFingerprints.shift();
  }
  return false;
}

function postBeacon(path: string, body: unknown): void {
  const url = `${endpointBase}${path}`;
  const json = JSON.stringify(body);

  // sendBeacon ưu tiên (không bị abort khi page unload)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // fallback xuống fetch
    }
  }

  // Fallback fetch keepalive
  if (typeof fetch === 'function') {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {
      // swallow — telemetry không nên throw
    });
  }
}

/**
 * Báo lỗi lên server. No-op nếu không có window/fetch (SSR).
 */
export function reportError(payload: ErrorPayload): void {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizeError(payload);
  if (shouldDedupe(sanitized.fingerprint)) return;
  postBeacon('/api/errors', sanitized);
}

/**
 * Báo Web Vital. Server sẽ overwrite rating nếu unknown.
 */
export function reportVital(payload: VitalPayload): void {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizeVital(payload);
  if (!sanitized.rating || sanitized.rating === 'unknown') {
    sanitized.rating = classifyVital(sanitized.name, sanitized.value);
  }
  postBeacon('/api/vitals', sanitized);
}

/**
 * Cài window.onerror + unhandledrejection handler.
 * Trả về function cleanup() để uninstall.
 *
 * Gọi 1 lần ở entry app (vd src/main.tsx của desktop app, hoặc components/error-reporter.tsx của website).
 */
export interface InstallOptions {
  app: string;
  version: string;
  platform?: string; // mặc định "windows_x64" cho desktop, navigator.userAgent cho web
  uid?: () => string | undefined; // lazy lookup uid khi user login
}

export function installErrorHandlers(opts: InstallOptions): () => void {
  if (typeof window === 'undefined') return () => {};

  const platform = opts.platform || (typeof navigator !== 'undefined' ? guessPlatform(navigator.userAgent) : 'unknown');

  const onError = (event: ErrorEvent) => {
    reportError({
      app: opts.app,
      version: opts.version,
      platform,
      severity: 'error',
      name: event.error?.name || 'Error',
      message: event.message || event.error?.message || 'Unknown error',
      stack: event.error?.stack,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      uid: opts.uid?.(),
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const isError = reason instanceof Error;
    reportError({
      app: opts.app,
      version: opts.version,
      platform,
      severity: 'error',
      name: isError ? reason.name : 'UnhandledRejection',
      message: isError ? reason.message : String(reason).slice(0, 1024),
      stack: isError ? reason.stack : undefined,
      uid: opts.uid?.(),
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

function guessPlatform(ua: string): string {
  if (/Windows/.test(ua)) return 'windows_x64';
  if (/Mac OS|Macintosh/.test(ua)) return /ARM|aarch64/.test(ua) ? 'darwin_arm64' : 'darwin_x64';
  if (/Linux/.test(ua)) return 'linux_x64';
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad/.test(ua)) return 'ios';
  return 'unknown';
}
