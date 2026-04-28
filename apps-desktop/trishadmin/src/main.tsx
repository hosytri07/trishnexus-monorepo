import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { Root } from './Root.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { applyTheme, loadSettings } from './settings.js';
import './styles.css';

// Apply theme từ settings local trước khi React mount để tránh flash
applyTheme(loadSettings().theme);

// Global error handlers — log mọi lỗi vào console + show fallback nếu cần
window.addEventListener('error', (e) => {
  console.error('[window.onerror]', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason);
});

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <ErrorBoundary>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </ErrorBoundary>,
);
