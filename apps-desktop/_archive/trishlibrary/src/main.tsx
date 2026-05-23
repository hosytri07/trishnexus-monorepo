import { createRoot } from 'react-dom/client';
import { AuthProvider, TierGate } from '@trishteam/auth/react';
import { installTauriTelemetry } from '@trishteam/telemetry/tauri';
import { Root } from './Root.js';
// Phase 38.2.0 — Dialog provider thay window.alert/confirm/prompt
import { DialogProvider } from './components/dialogs/DialogProvider.js';
// Sticky note như Windows Sticky Notes — cửa sổ riêng nổi trên desktop.
import { StickyApp } from './components/StickyApp.js';
import packageJson from '../package.json' with { type: 'json' };
// Phase 30.1 — design-system: Plus Jakarta Sans + emerald + utility CSS.
// (index.ts đã side-effect import fonts + theme.css)
import '@trishteam/design-system';
import './styles.css';
// Bridge legacy CSS vars (--bg/--fg/--accent/...) → design-system tokens.
// Phải đặt SAU styles.css để override với specificity bằng nhau.
import './theme-bridge.css';

// Detect cửa sổ sticky (load với ?sticky=1) → render StickyApp standalone,
// KHÔNG load AppShell + AuthProvider (sticky chỉ cần localStorage shared).
const urlParams = new URLSearchParams(window.location.search);
const isStickyWindow = urlParams.get('sticky') === '1';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

if (isStickyWindow) {
  // Sticky window: minimal app, không cần auth
  createRoot(container).render(
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <StickyApp />
    </div>,
  );
} else {
  // Main window: full app
  installTauriTelemetry({
    app: 'trishlibrary',
    version: packageJson.version,
  }).catch((err) => console.warn('[telemetry] init failed', err));

  createRoot(container).render(
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthProvider>
        <DialogProvider>
          <TierGate appName="TrishLibrary">
            <Root />
          </TierGate>
        </DialogProvider>
      </AuthProvider>
    </div>,
  );
}
