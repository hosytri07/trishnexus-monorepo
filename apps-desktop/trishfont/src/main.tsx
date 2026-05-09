import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { App } from './App.js';
import logoUrl from './assets/logo.png';
import packageJson from '../package.json' with { type: 'json' };
import '@trishteam/design-system';
import './styles.css';
import './theme-bridge.css';

installTauriTelemetry({
  app: 'trishfont',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthApp
        appName="TrishFont"
        tagline="Quản lý font Windows"
        logoUrl={logoUrl}
      >
        <App />
      </AuthApp>
    </div>
  </StrictMode>,
);
