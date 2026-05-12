import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import App from './App.tsx';
import logoUrl from './assets/logo.png';
import packageJson from '../package.json' with { type: 'json' };
// Phase 24.3 — design-system package thay local index.css.
import '@trishteam/design-system';
import './index.css';

// Phase 22 — TrishTEAM ecosystem telemetry: window.onerror + unhandledrejection + Rust panic
installTauriTelemetry({
  app: 'trishiso',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

// Phase 38.9 — KeyGate (legacy 16-char) → AuthApp (login + TierGate có form Promo/Key)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthApp
      appName="TrishISO"
      tagline="Quản lý hồ sơ ISO + lịch bảo trì thiết bị"
      logoUrl={logoUrl}
    >
      <App />
    </AuthApp>
  </StrictMode>,
);
