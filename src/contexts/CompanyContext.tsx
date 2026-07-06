import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
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
    const { data, error } = await (supabase as any)
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();
    if (!error && data) {
      const c = data as Company;
      // Normalize enabled_modules
      c.enabled_modules = Array.isArray(c.enabled_modules) ? c.enabled_modules : [];
      setCompany(c);
      applyBrand(c);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    return () => resetBrand();
  }, []);

  const hasModule = (m: string) => {
    if (!company) return false;
    // Super admin's system company: hide most modules
    return company.enabled_modules?.includes(m) ?? false;
  };

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
