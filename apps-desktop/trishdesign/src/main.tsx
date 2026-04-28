import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@trishteam/auth/react';
import { Root } from './Root.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <AuthProvider>
    <Root />
  </AuthProvider>,
);
