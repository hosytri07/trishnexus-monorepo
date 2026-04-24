'use client';

/**
 * WebVitalsReporter — Phase 16.3.
 *
 * Capture Core Web Vitals + custom Next.js metrics qua
 * `useReportWebVitals` (Next.js 14). Mỗi metric gửi qua
 * `navigator.sendBeacon` tới `/api/vitals` (non-blocking, dùng kể cả khi
 * tab đóng). Fallback `fetch keepalive` nếu sendBeacon không tồn tại.
 *
 * Metrics thu thập:
 *   - LCP   Largest Contentful Paint (mục tiêu <2.5s)
 *   - FID   First Input Delay        (mục tiêu <100ms — đã thay bằng INP)
 *   - CLS   Cumulative Layout Shift  (mục tiêu <0.1)
 *   - INP   Interaction to Next Paint (mục tiêu <200ms)
 *   - TTFB  Time To First Byte       (mục tiêu <800ms)
 *   - FCP   First Contentful Paint   (mục tiêu <1.8s)
 *
 * Custom Next.js metrics (gắn name khác):
 *   - Next.js-hydration, Next.js-route-change-to-render, ...
 *
 * Privacy: không gửi URL query string, chỉ pathname. Không gửi user id.
 * Backend sẽ stamp uid từ auth cookie nếu có (phase sau).
 */
import { useReportWebVitals } from 'next/web-vitals';

interface VitalPayload {
  name: string;
  value: number;
  id: string;
  delta: number;
  navigationType?: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  path: string;
  ts: number;
  ua?: string;
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined') return;
    const payload: VitalPayload = {
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      id: metric.id,
      delta: Math.round(metric.delta * 100) / 100,
      navigationType:
        'navigationType' in metric
          ? (metric as { navigationType?: string }).navigationType
          : undefined,
      rating:
        'rating' in metric
          ? (metric as { rating?: 'good' | 'needs-improvement' | 'poor' }).rating
          : undefined,
      path: window.location.pathname,
      ts: Date.now(),
      ua: navigator.userAgent.slice(0, 120),
    };
    const body = JSON.stringify(payload);
    try {
      if ('sendBeacon' in navigator) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/vitals', blob);
        return;
      }
    } catch {
      /* fallback fetch */
    }
    try {
      fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* swallow — non-critical */
      });
    } catch {
      /* ignore */
    }
  });

  return null;
}
