// Plan, features, limits and usage of the signed-in user's company (get_my_company_plan).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { CompanyPlan } from '@/lib/planAccess';

export const COMPANY_PLAN_CHANGED = 'ewvon:company-plan-changed';
let cache: { companyId: string; plan: CompanyPlan | null } | null = null;

export function useCompanyPlan() {
  const { profile } = useAuth();
  const companyId = (profile as any)?.company_id as string | undefined;
  const [plan, setPlan] = useState<CompanyPlan | null>(cache && cache.companyId === companyId ? cache.plan : null);
  const [loading, setLoading] = useState(!plan);

  const load = useCallback(async () => {
    if (!companyId) return;
    const { data, error } = await (supabase as any).rpc('get_my_company_plan');
    if (!error) { cache = { companyId, plan: (data as CompanyPlan) ?? null }; setPlan(cache.plan); }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener(COMPANY_PLAN_CHANGED, on);
    return () => window.removeEventListener(COMPANY_PLAN_CHANGED, on);
  }, [load]);

  return { plan, loading, reload: load };
}
