import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import App from './App.tsx';
import logoUrl from './assets/logo.png';
import packageJson from '../package.json' with { type: 'json' };
import '@trishteam/design-system';
import './index.css';

installTauriTelemetry({
  app: 'trishfinance',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthApp
      appName="TrishFinance"
      tagline="Quản lý nhà trọ + tài chính + POS bán hàng"
      logoUrl={logoUrl}
    >
      <App />
    </AuthApp>
  </StrictMode>,
);
