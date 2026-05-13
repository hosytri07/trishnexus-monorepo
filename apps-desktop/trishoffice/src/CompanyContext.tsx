/**
 * Phase 40.3 — CompanyContext.
 *
 * Provides active company info to all components without prop drilling.
 * useCollection reads activeCompanyId from this context to scope data per-company.
 *
 * Wraps useCompanies() hook — exposed at top of tree via <CompanyProvider>.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useCompanies, type UseCompaniesResult } from './useCompanies';

const CompanyCtx = createContext<UseCompaniesResult | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }): JSX.Element {
  const value = useCompanies();
  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export function useCompanyContext(): UseCompaniesResult {
  const ctx = useContext(CompanyCtx);
  if (!ctx) {
    throw new Error('useCompanyContext must be used within <CompanyProvider>');
  }
  return ctx;
}

/**
 * Lightweight hook: chỉ return activeCompanyId (or null).
 * Safe to use BEFORE <CompanyProvider> mounts (returns null).
 */
export function useActiveCompanyId(): string | null {
  const ctx = useContext(CompanyCtx);
  return ctx?.activeCompanyId ?? null;
}
