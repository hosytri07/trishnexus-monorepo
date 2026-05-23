/**
 * TrishOffice — Sync Context (Phase 38.18).
 *
 * Theo dõi Firebase user hiện tại và expose `ownerUid` cho `useCollection`
 * tự động sync localStorage ↔ Firestore.
 *
 * Logic:
 *   - Nếu firebaseUser non-null → ownerUid = firebaseUser.uid → enabled = true
 *   - Nếu null → enabled = false (tạm dùng localStorage only)
 *
 * Khi disabled, useCollection fallback về behavior cũ (chỉ localStorage).
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth as useEcosystemAuth } from '@trishteam/auth/react';

interface SyncContextValue {
  /** ownerUid cho Firestore path /trishoffice_companies/{ownerUid}/... */
  ownerUid: string | null;
  /** True nếu sync đang active (có Firebase user) */
  enabled: boolean;
}

const SyncCtx = createContext<SyncContextValue>({
  ownerUid: null,
  enabled: false,
});

export function SyncProvider({ children }: { children: ReactNode }): JSX.Element {
  const ecosystem = useEcosystemAuth();
  const ownerUid = ecosystem.firebaseUser?.uid ?? null;
  const enabled = !!ownerUid;

  return (
    <SyncCtx.Provider value={{ ownerUid, enabled }}>
      {children}
    </SyncCtx.Provider>
  );
}

export function useSync(): SyncContextValue {
  return useContext(SyncCtx);
}
