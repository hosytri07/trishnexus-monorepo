/**
 * Phase 40.2 — Multi-tenant companies hook.
 *
 * Quản lý danh sách Company + active company. Active company lưu localStorage
 * theo key `trishoffice:active_company_id`.
 *
 * Auto-create 1 default company khi user TrishTEAM mở Office lần đầu (companies
 * list rỗng) — tên "Công ty mặc định". User có thể đổi tên / tạo thêm trong
 * Settings → Công ty.
 */
import { useCallback, useEffect, useState } from 'react';
import { loadAll, saveAll, generateId } from './storage';
import type { Company } from './types';

const COMPANIES_COLLECTION = 'companies';
const ACTIVE_COMPANY_KEY = 'trishoffice:active_company_id';

export interface UseCompaniesResult {
  companies: Company[];
  activeCompany: Company | null;
  activeCompanyId: string | null;
  loading: boolean;
  /** Tạo company mới + tự switch active */
  createCompany: (input: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'active'>) => Company;
  /** Update info company */
  updateCompany: (id: string, patch: Partial<Omit<Company, 'id' | 'created_at'>>) => void;
  /** Switch active company (đổi context cho toàn app) */
  switchCompany: (id: string) => void;
  /** Tạo company default cho ecosystem user vừa login lần đầu */
  bootstrapDefaultCompany: (ownerUid: string, displayName: string) => Company;
  /** Reload từ localStorage */
  reload: () => void;
}

export function useCompanies(): UseCompaniesResult {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const list = loadAll<Company>(COMPANIES_COLLECTION);
    setCompanies(list);
    try {
      const stored = window.localStorage.getItem(ACTIVE_COMPANY_KEY);
      if (stored && list.some((c) => c.id === stored)) {
        setActiveCompanyId(stored);
      } else if (list.length > 0) {
        // Default: pick first company
        setActiveCompanyId(list[0]!.id);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const reload = useCallback((): void => {
    const list = loadAll<Company>(COMPANIES_COLLECTION);
    setCompanies(list);
  }, []);

  const persist = useCallback((next: Company[]): void => {
    setCompanies(next);
    saveAll<Company>(COMPANIES_COLLECTION, next);
  }, []);

  const createCompany = useCallback(
    (input: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'active'>): Company => {
      const now = Date.now();
      const newCompany: Company = {
        id: generateId('cmp'),
        ...input,
        active: true,
        created_at: now,
        updated_at: now,
      };
      const next = [newCompany, ...companies];
      persist(next);
      setActiveCompanyId(newCompany.id);
      try {
        window.localStorage.setItem(ACTIVE_COMPANY_KEY, newCompany.id);
      } catch {
        /* ignore */
      }
      return newCompany;
    },
    [companies, persist],
  );

  const updateCompany = useCallback(
    (id: string, patch: Partial<Omit<Company, 'id' | 'created_at'>>): void => {
      persist(
        companies.map((c) =>
          c.id === id ? { ...c, ...patch, updated_at: Date.now() } : c,
        ),
      );
    },
    [companies, persist],
  );

  const switchCompany = useCallback((id: string): void => {
    setActiveCompanyId(id);
    try {
      window.localStorage.setItem(ACTIVE_COMPANY_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const bootstrapDefaultCompany = useCallback(
    (ownerUid: string, displayName: string): Company => {
      // Check nếu đã có company của user này → trả về company đầu tiên
      const existing = companies.find((c) => c.owner_uid === ownerUid);
      if (existing) {
        if (activeCompanyId !== existing.id) {
          switchCompany(existing.id);
        }
        return existing;
      }
      // Tạo default
      return createCompany({
        name: `Công ty của ${displayName}`,
        code: 'DEFAULT',
        logo: '🏢',
        owner_uid: ownerUid,
      });
    },
    [companies, activeCompanyId, createCompany, switchCompany],
  );

  const activeCompany = activeCompanyId
    ? companies.find((c) => c.id === activeCompanyId) ?? null
    : null;

  return {
    companies,
    activeCompany,
    activeCompanyId,
    loading,
    createCompany,
    updateCompany,
    switchCompany,
    bootstrapDefaultCompany,
    reload,
  };
}
