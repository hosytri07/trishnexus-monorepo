/**
 * ErrorBoundary — surface React errors thay vì màn hình đen.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[TrishAdmin ErrorBoundary]', error, info);
    this.setState({ error, info });
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#1a0f0f',
            color: '#fca5a5',
            padding: 32,
            fontFamily: 'monospace',
            fontSize: 13,
            overflowY: 'auto',
          }}
        >
          <h1 style={{ color: '#ef4444', fontSize: 22, marginTop: 0 }}>
            ⚠ Lỗi runtime — TrishAdmin crash
          </h1>
          <p>
            <strong>{this.state.error.name}:</strong> {this.state.error.message}
          </p>
          <details open style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Stack trace</summary>
            <pre
              style={{
                background: '#0f0808',
                padding: 12,
                borderRadius: 6,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {this.state.error.stack ?? '(không có stack)'}
            </pre>
          </details>
          {this.state.info && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                Component stack
              </summary>
              <pre
                style={{
                  background: '#0f0808',
                  padding: 12,
                  borderRadius: 6,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {this.state.info.componentStack}
              </pre>
            </details>
          )}
          <p style={{ marginTop: 20 }}>
            Reload app (Ctrl+R) hoặc paste lỗi cho dev fix.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
