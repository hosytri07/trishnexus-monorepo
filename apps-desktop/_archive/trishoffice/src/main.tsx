import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthApp } from '@trishteam/auth/react';
import { AuthProvider as OfficeAuthProvider } from './auth/AuthContext';
import { SyncProvider } from './sync/SyncContext';
import { CompanyProvider } from './CompanyContext';
import { App } from './App';
import logoUrl from './assets/logo.png';
import '@trishteam/design-system';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

// Phase 38.9 — KeyGate (legacy 16-char) → AuthApp (login + TierGate có form Promo/Key)
// AuthApp = AuthProvider + LoginScreen + TierGate (gate role trial/demo/user/admin).
// Sau khi pass tier gate, render Sync + Office Auth layers như cũ.
createRoot(container).render(
  <StrictMode>
    <div className="ts-app" style={{ minHeight: '100vh' }}>
      {/* Layer 1: Firebase auth + role gate (TrishTEAM ecosystem) */}
      <AuthApp
        appName="TrishOffice"
        tagline="HRM/ERP-light cho công ty — nhân sự · chấm công · tài sản"
        logoUrl={logoUrl}
      >
        {/* Layer 2: Sync context — provide ownerUid cho useCollection auto-sync */}
        <SyncProvider>
          {/* Phase 40.3 — Multi-tenant: provide activeCompanyId xuống mọi nơi qua context */}
          <CompanyProvider>
            {/* Layer 3: Local user management (mỗi cty tự tạo account NV) */}
            <OfficeAuthProvider>
              <App />
            </OfficeAuthProvider>
          </CompanyProvider>
        </SyncProvider>
      </AuthApp>
    </div>
  </StrictMode>,
);
