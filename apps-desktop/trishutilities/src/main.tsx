/**
 * TrishUtilities - Phase 44.4 entry point.
 *
 * Boot flow:
 *   1. import design-system side effects
 *   2. applyAppAccent('utilities') -> <html data-app="utilities"> (accent tim)
 *   3. applyTheme dua tren localStorage
 *   4. wrap <AuthProvider>
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

import '@trishteam/design-system';

applyAppAccent('utilities');
applyTheme(loadTheme('trishutilities:theme'), 'trishutilities:theme');

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
