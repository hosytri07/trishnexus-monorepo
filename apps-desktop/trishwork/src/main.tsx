/**
 * TrishWork - Phase 44.3 entry point.
 *
 * Boot flow:
 *   1. import design-system side effects (font + theme.css + 4 accent rules)
 *   2. applyAppAccent('work') -> set <html data-app="work">
 *   3. applyTheme dua tren localStorage (default light)
 *   4. wrap <AuthProvider> de useAuth() chay duoc trong App
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

// Side-effect: import font + theme.css + 4 accent rules
import '@trishteam/design-system';

applyAppAccent('work');
applyTheme(loadTheme('trishwork:theme'), 'trishwork:theme');

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
