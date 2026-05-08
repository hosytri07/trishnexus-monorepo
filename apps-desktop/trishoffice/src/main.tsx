import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider as KeyAuthProvider } from '@trishteam/auth/react';
import { AuthProvider as OfficeAuthProvider } from './auth/AuthContext';
import { SyncProvider } from './sync/SyncContext';
import { App } from './App';
import { KeyGate } from './KeyGate';
import '@trishteam/design-system';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      {/* Layer 1: Firebase auth + key activation (admin nội bộ cấp key) */}
      <KeyAuthProvider>
        <KeyGate>
          {/* Layer 2: Sync context — provide ownerUid cho useCollection auto-sync */}
          <SyncProvider>
            {/* Layer 3: Local user management (mỗi cty tự tạo account NV) */}
            <OfficeAuthProvider>
              <App />
            </OfficeAuthProvider>
          </SyncProvider>
        </KeyGate>
      </KeyAuthProvider>
    </div>
  </StrictMode>,
);
