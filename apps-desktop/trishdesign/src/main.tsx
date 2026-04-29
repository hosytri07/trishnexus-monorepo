import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { Root } from './Root.js';
import packageJson from '../package.json' with { type: 'json' };
import './styles.css';

// Phase 21 prep — telemetry: window.onerror + unhandledrejection + Rust panic
installTauriTelemetry({
  app: 'trishdesign',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <AuthProvider>
    <Root />
  </AuthProvider>,
);
