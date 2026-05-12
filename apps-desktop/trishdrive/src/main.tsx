import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { App } from './App.tsx';
import logoUrl from './assets/logo.png';
import packageJson from '../package.json' with { type: 'json' };
// Phase 24.3.G — design-system: Plus Jakarta + emerald + utility CSS.
import '@trishteam/design-system';
import './index.css';

installTauriTelemetry({
  app: 'trishdrive',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

// Phase 38.9 — KeyGate (legacy 16-char) → AuthApp (login + TierGate có form Promo/Key)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthApp
      appName="TrishDrive"
      tagline="Cloud storage cá nhân qua Telegram Bot — encrypt AES-256"
      logoUrl={logoUrl}
    >
      <App />
    </AuthApp>
  </StrictMode>,
);
