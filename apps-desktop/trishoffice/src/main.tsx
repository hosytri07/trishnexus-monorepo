import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { App } from './App';
import { KeyGate } from './KeyGate';
import '@trishteam/design-system';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      <AuthProvider>
        <KeyGate>
          <App />
        </KeyGate>
      </AuthProvider>
    </div>
  </StrictMode>,
);
