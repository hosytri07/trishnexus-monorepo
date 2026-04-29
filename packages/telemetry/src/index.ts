/**
 * @trishteam/telemetry — entry point
 *
 * 2 API chính:
 *   - reportError(payload)   → ghi /errors/{env}/samples/{auto-id}
 *   - reportVital(payload)   → ghi /vitals/{env}/samples/{auto-id}
 *
 * Cross-platform:
 *   - Web (Next.js): import từ '@trishteam/telemetry/browser' — POST tới /api/errors + /api/vitals
 *   - Desktop (Tauri): import từ '@trishteam/telemetry/tauri' — fallback về REST endpoint web khi offline
 *
 * Server-side (Vercel API route đã có sẵn): /api/errors + /api/vitals (Phase 16.3 + 16.5).
 *
 * Phase 21 prep (2026-04-29) — gộp logic phân tán trong website/lib/error-report.ts
 * + window.onerror handler vào package này để 7 desktop app dùng chung.
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface ErrorPayload {
  /** App ID: 'trishlauncher' | 'trishlibrary' | 'trishadmin' | 'trishfont' | 'trishcheck' | 'trishclean' | 'trishdesign' | 'website' */
  app: string;
  /** Phiên bản app, vd "2.0.0-1" hoặc "3.0.0" */
  version: string;
  /** OS + arch, vd "windows_x64" "linux_x64" "darwin_arm64" */
  platform: string;
  /** Mức độ */
  severity: ErrorSeverity;
  /** Tên / class lỗi, vd "TypeError" "PanicError" "FetchError" */
  name: string;
  /** Message human-readable */
  message: string;
  /** Stack trace (cắt 8KB nếu dài hơn) */
  stack?: string;
  /** Context bổ sung — JSON-stringifiable, max 4KB */
  context?: Record<string, unknown>;
  /** UID Firebase nếu user đã login */
  uid?: string;
  /** Timestamp client (ms) — server sẽ overwrite bằng serverTimestamp */
  ts?: number;
  /** Fingerprint dedupe — nếu không cung cấp, server tự tính FNV-1a từ name+message+stack[0:200] */
  fingerprint?: string;
}

export type VitalName = 'LCP' | 'FID' | 'INP' | 'CLS' | 'TTFB' | 'FCP' | 'TTI' | 'MEMORY' | 'CPU' | 'STARTUP';
export type VitalRating = 'good' | 'needs-improvement' | 'poor' | 'unknown';

export interface VitalPayload {
  app: string;
  version: string;
  platform: string;
  /** Web Vitals chuẩn hoặc desktop-specific */
  name: VitalName;
  /** Giá trị raw (ms cho time, ratio cho CLS, MB cho memory, %  cho CPU) */
  value: number;
  /** Đánh giá theo ngưỡng Web Vitals — server tự fill nếu unknown */
  rating?: VitalRating;
  /** Đường dẫn web hoặc tên màn hình desktop */
  path?: string;
  uid?: string;
  ts?: number;
}

/**
 * Truncate string xuống max bytes (UTF-8 length).
 * Dùng để giới hạn payload trước khi gửi server.
 */
export function truncateString(s: string | undefined, maxBytes: number): string | undefined {
  if (!s) return s;
  // approximate by char count (1 char ~ 1 byte ASCII, 3 byte VN diacritic)
  if (s.length <= maxBytes) return s;
  return s.slice(0, maxBytes) + '…';
}

/**
 * FNV-1a hash 32-bit, hex string. Dùng làm fingerprint dedupe.
 * Cùng implementation với website/lib/error-report.ts.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Tính fingerprint deterministic cho dedupe.
 * Format: name + ":" + message[:120] + ":" + stack[:200]
 */
export function computeFingerprint(p: Pick<ErrorPayload, 'name' | 'message' | 'stack'>): string {
  const seed = `${p.name}:${(p.message || '').slice(0, 120)}:${(p.stack || '').slice(0, 200)}`;
  return fnv1a(seed);
}

/**
 * Sanitize payload trước khi gửi: cắt size, fill defaults.
 */
export function sanitizeError(p: ErrorPayload): ErrorPayload {
  return {
    app: (p.app || 'unknown').slice(0, 32),
    version: (p.version || '0.0.0').slice(0, 32),
    platform: (p.platform || 'unknown').slice(0, 32),
    severity: p.severity || 'error',
    name: (p.name || 'Error').slice(0, 64),
    message: truncateString(p.message || '', 1024) || '',
    stack: truncateString(p.stack, 8192),
    context: p.context, // server sẽ JSON.stringify check size
    uid: p.uid?.slice(0, 64),
    ts: p.ts ?? Date.now(),
    fingerprint: p.fingerprint || computeFingerprint(p),
  };
}

export function sanitizeVital(p: VitalPayload): VitalPayload {
  return {
    app: (p.app || 'unknown').slice(0, 32),
    version: (p.version || '0.0.0').slice(0, 32),
    platform: (p.platform || 'unknown').slice(0, 32),
    name: p.name,
    value: Number.isFinite(p.value) ? Math.round(p.value * 1000) / 1000 : 0,
    rating: p.rating,
    path: p.path?.slice(0, 256),
    uid: p.uid?.slice(0, 64),
    ts: p.ts ?? Date.now(),
  };
}

/**
 * Đánh giá rating theo ngưỡng Web Vitals chuẩn 2024.
 * Reference: https://web.dev/articles/vitals
 */
export function classifyVital(name: VitalName, value: number): VitalRating {
  if (!Number.isFinite(value)) return 'unknown';
  switch (name) {
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'FID':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'INP':
      return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'STARTUP':
      // Desktop app cold start — chuẩn TrishTEAM tự đặt
      return value <= 1500 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
  }
}
