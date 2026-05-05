import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { Root } from './Root.js';
import { KeyGate } from './KeyGate.js';
import packageJson from '../package.json' with { type: 'json' };
// Phase 30.1 — design-system: Plus Jakarta Sans + emerald + utility CSS.
// (index.ts đã side-effect import fonts + theme.css)
import '@trishteam/design-system';
import './styles.css';
// Bridge legacy CSS vars (--bg/--fg/--accent/...) → design-system tokens.
// Phải đặt SAU styles.css để override với specificity bằng nhau.
import './theme-bridge.css';

// Phase 21 prep — telemetry: window.onerror + unhandledrejection + Rust panic
// Endpoint = https://trishteam.io.vn/api/{errors,vitals}
installTauriTelemetry({
  app: 'trishlibrary',
  version: packageJson.version,
}).catch((err) => console.warn('[telemetry] init failed', err));

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

// Phase 16.2.d — Bỏ StrictMode (double-mount effect làm loading state stuck).
createRoot(container).render(
  <div className="ts-app" style={{ minHeight: '100vh' }}>
    <AuthProvider>
      <KeyGate>
        <Root />
      </KeyGate>
    </AuthProvider>
  </div>,
);
