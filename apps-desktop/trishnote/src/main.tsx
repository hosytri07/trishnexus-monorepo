import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { Root } from './Root.js';
import { DialogProvider } from './components/Dialog.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

// Phase 17.2 — Bỏ StrictMode (double-mount effect làm loading state stuck).
createRoot(container).render(
  <AuthProvider>
    <DialogProvider>
      <Root />
    </DialogProvider>
  </AuthProvider>,
);
