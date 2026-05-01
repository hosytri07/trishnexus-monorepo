import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import App from './App.tsx';
import packageJson from '../package.json' with { type: 'json' };
import '@trishteam/design-system';
import './index.css';

installTauriTelemetry({
  app: 'trishfinance',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
