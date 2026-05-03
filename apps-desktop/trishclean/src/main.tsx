import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { App } from './App.js';
import packageJson from '../package.json' with { type: 'json' };
// Phase 30.4 — design-system: Plus Jakarta Sans + emerald + utility CSS.
import '@trishteam/design-system';
import './styles.css';
import './theme-bridge.css';

// Phase 21 prep — telemetry: window.onerror + unhandledrejection + Rust panic
installTauriTelemetry({
  app: 'trishclean',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <App />
    </div>
  </StrictMode>,
);
