'use client';

/**
 * ErrorReporter — Phase 16.5.
 *
 * Client component mount 1 lần trong `app/layout.tsx`. Nhiệm vụ duy nhất:
 * install global `error` + `unhandledrejection` handler rồi render null.
 *
 * React render error vẫn cần `<ErrorBoundary />` bọc quanh children —
 * xem `components/error-boundary.tsx`.
 */
import { useEffect } from 'react';
import { installGlobalErrorHandlers } from '@/lib/error-report';

export function ErrorReporter() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);
  return null;
}
