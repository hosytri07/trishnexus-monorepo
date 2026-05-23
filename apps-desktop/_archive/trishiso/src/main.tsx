import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import App from './App.tsx';
import packageJson from '../package.json' with { type: 'json' };
// Phase 24.3 — design-system package thay local index.css.
import '@trishteam/design-system';
import './index.css';

// Phase 22 — TrishTEAM ecosystem telemetry: window.onerror + unhandledrejection + Rust panic
installTauriTelemetry({
  app: 'trishiso',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

// Phase 40.1 — App.tsx tự manage AuthProvider riêng.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
