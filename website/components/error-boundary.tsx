'use client';

/**
 * ErrorBoundary — Phase 16.5.
 *
 * Bắt render error trong subtree, gửi về `/api/errors` qua `report()` và
 * hiển thị fallback UI tử tế (không làm user thấy white screen). Dùng
 * class component vì hooks chưa có API `getDerivedStateFromError` /
 * `componentDidCatch`.
 *
 * Cấp trên dùng:
 *   <ErrorBoundary fallback={<MyFallback />}>
 *     <SomethingMaybeCrash />
 *   </ErrorBoundary>
 *
 * Nếu không truyền `fallback`, mặc định hiển thị card "Đã có lỗi" với
 * nút "Thử lại" (reset state) + "Về dashboard".
 */
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { report } from '@/lib/error-report';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(
    error: Error,
    info: { componentStack?: string | null },
  ): void {
    report({
      kind: 'react',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <main className="max-w-xl mx-auto px-6 py-16 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: 'rgba(239,68,68,0.12)' }}
        >
          <AlertTriangle size={28} style={{ color: '#EF4444' }} />
        </div>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Đã có lỗi không mong muốn
        </h1>
        <p
          className="text-sm leading-relaxed mb-2"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Lỗi đã được tự động ghi nhận. Bạn có thể thử lại; nếu vẫn không
          được, quay về dashboard hoặc thông báo cho Trí.
        </p>
        <code
          className="block text-[11px] mb-6 mt-3 p-2 rounded font-mono text-left whitespace-pre-wrap"
          style={{
            background: 'var(--color-surface-muted)',
            color: 'var(--color-text-muted)',
            maxHeight: 160,
            overflow: 'auto',
          }}
        >
          {this.state.error.message}
        </code>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: 'var(--color-accent-gradient)',
              color: '#ffffff',
            }}
          >
            <RefreshCw size={14} /> Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md text-sm font-semibold"
            style={{
              background: 'var(--color-surface-muted)',
              color: 'var(--color-text-primary)',
            }}
          >
            <Home size={14} /> Về dashboard
          </Link>
        </div>
      </main>
    );
  }
}
