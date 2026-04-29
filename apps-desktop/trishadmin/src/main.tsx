import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { Root } from './Root.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { applyTheme, loadSettings } from './settings.js';
import packageJson from '../package.json' with { type: 'json' };
import './styles.css';

// Apply theme từ settings local trước khi React mount để tránh flash
applyTheme(loadSettings().theme);

// Phase 21 prep — telemetry replace local console.error log
// installTauriTelemetry tự cài window.onerror + unhandledrejection + Tauri panic listener
installTauriTelemetry({
  app: 'trishadmin',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <ErrorBoundary>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </ErrorBoundary>,
);
