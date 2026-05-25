/**
 * TrishWork - Phase 44.3 entry point + Phase 53 sticky window split.
 *
 * Boot flow main:
 *   1. import design-system side effects (font + theme.css + 4 accent rules)
 *   2. applyAppAccent('work') -> set <html data-app="work">
 *   3. applyTheme dua tren localStorage (default light)
 *   4. wrap <AuthProvider> de useAuth() chay duoc trong App
 *
 * Phase 53 — Sticky window: URL `?sticky=1` → render <StickyApp /> standalone
 * (no AuthProvider, no AppShell). Sticky widget chia sẻ localStorage với main.
 */

import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import {
  applyAppAccent,
  applyTheme,
  loadTheme,
} from '@trishteam/design-system';
import { AuthProvider } from '@trishteam/auth/react';
import { App } from './App.js';
import { StickyApp } from './components/StickyApp.js';

// Side-effect: import font + theme.css + 4 accent rules
import '@trishteam/design-system';

applyAppAccent('work');
applyTheme(loadTheme('trishwork:theme'), 'trishwork:theme');

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

// Phase 53 — Detect sticky window via URL query
const isStickyWindow = new URLSearchParams(window.location.search).get('sticky') === '1';

if (isStickyWindow) {
  // Sticky widget: minimal app, KHÔNG auth + KHÔNG AppShell
  createRoot(rootEl).render(
    <StrictMode>
      <div className="ts-app" style={{ minHeight: '100vh' }}>
        <StickyApp />
      </div>
    </StrictMode>,
  );
} else {
  // Main window: full app với auth
  createRoot(rootEl).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  );
}
