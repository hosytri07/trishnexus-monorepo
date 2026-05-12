import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { App } from './App.js';
import packageJson from '../package.json' with { type: 'json' };
// Phase 33 — design-system: Plus Jakarta Sans + emerald + utility CSS.
import '@trishteam/design-system';
import './styles.css';
import './theme-bridge.css';

// Phase 21 prep — telemetry: window.onerror + unhandledrejection + Rust panic
installTauriTelemetry({
  app: 'trishlauncher',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root container — check index.html');
}

// Phase 38.9 — KHÔNG gate Launcher (no login required).
// AuthProvider chỉ cấp context cho nút "🔑 Tài khoản" tùy chọn (xem AccountButton).
// User KHÔNG cần login để dùng Launcher.
createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <div className="ts-app" style={{ minHeight: '100vh' }}>
        <App />
      </div>
    </AuthProvider>
  </StrictMode>,
);
