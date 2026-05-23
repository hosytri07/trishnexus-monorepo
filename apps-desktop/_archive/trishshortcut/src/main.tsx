import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { App } from './App';
import logoUrl from './assets/logo.png';
import '@trishteam/design-system';
import './styles.css';
import './theme-bridge.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthApp
        appName="TrishShortcut"
        tagline="Quản lý shortcut Windows full features"
        logoUrl={logoUrl}
      >
        <App />
      </AuthApp>
    </div>
  </StrictMode>,
);
