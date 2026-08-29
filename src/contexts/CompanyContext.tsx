import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { applyBrand, resetBrand } from '@/lib/branding';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  is_system: boolean;
  enabled_modules: string[];
}

interface CompanyContextType {
  company: Company | null;
  loading: boolean;
  refresh: () => Promise<void>;
  hasModule: (m: string) => boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);
const COMPANY_CACHE_PREFIX = 'nuvexa:company:';

const readCachedCompany = (companyId: string): Company | null => {
  try {
    const raw = localStorage.getItem(`${COMPANY_CACHE_PREFIX}${companyId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Company;
    if (!parsed?.id || parsed.id !== companyId || !parsed.primary_color || !parsed.secondary_color) return null;
    parsed.enabled_modules = Array.isArray(parsed.enabled_modules) ? parsed.enabled_modules : [];
    return parsed;
  } catch {
    return null;
  }
};

const cacheCompany = (company: Company) => {
  try {
    localStorage.setItem(`${COMPANY_CACHE_PREFIX}${company.id}`, JSON.stringify(company));
  } catch {
    // Ignore storage quota/private-mode errors; the network source remains authoritative.
  }
};

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const companyId = (profile as any)?.company_id as string | undefined;
    if (!companyId) {
      setCompany(null);
      resetBrand();
      setLoading(false);
      return;
    }

    const cached = readCachedCompany(companyId);
    if (cached) {
      setCompany(cached);
      applyBrand(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const { data, error } = await (supabase as any)
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();

    if (!error && data) {
      const freshCompany = data as Company;
      freshCompany.enabled_modules = Array.isArray(freshCompany.enabled_modules) ? freshCompany.enabled_modules : [];
      cacheCompany(freshCompany);
      setCompany(freshCompany);
      applyBrand(freshCompany);
    }

    setLoading(false);
  }, [profile]);

  // Restore the last known official branding before the first browser paint.
  // This prevents the default Nuvexa palette from flashing while Supabase responds.
  useLayoutEffect(() => {
    const companyId = (profile as any)?.company_id as string | undefined;
    if (!companyId) return;
    const cached = readCachedCompany(companyId);
    if (cached) {
      setCompany(cached);
      applyBrand(cached);
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    return () => resetBrand();
  }, []);

  const hasModule = (m: string) => company?.enabled_modules?.includes(m) ?? false;

  // Only gate the authenticated company shell on a cold load. Public routes must remain available.
  const hasCompanyId = Boolean((profile as any)?.company_id);
  if (loading && user && hasCompanyId && !company) {
    return (
      <CompanyContext.Provider value={{ company: null, loading: true, refresh: load, hasModule: () => false }}>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Carregando identidade da empresa" /><p className="text-sm text-muted-foreground">Carregando identidade da empresa...</p></div>
        </div>
      </CompanyContext.Provider>
    );
  }

  return (
    <CompanyContext.Provider value={{ company, loading, refresh: load, hasModule }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
