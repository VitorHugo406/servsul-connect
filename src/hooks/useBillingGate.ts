// Payment state of the signed-in user's company (pending warning / suspended), from get_my_billing_gate().
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type BillingGate = {
  state: 'ok' | 'pending' | 'blocked';
  company_name?: string; plan_name?: string; due_at?: string; blocked_at?: string; delete_at?: string;
  days_to_block?: number; days_to_delete?: number; is_owner?: boolean; owner_hint?: string | null;
  auto_renewal?: boolean; billing_cycle?: string; amount_cents?: number | null;
};
export const BILLING_GATE_CHANGED = 'ewvon-billing-gate-changed';

export function useBillingGate() {
  const { user } = useAuth();
  const [gate, setGate] = useState<BillingGate>({ state: 'ok' });
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!user) { setGate({ state: 'ok' }); setLoaded(true); return; }
    const { data, error } = await (supabase as any).rpc('get_my_billing_gate');
    if (!error && data && typeof data === 'object') setGate(data as BillingGate);
    setLoaded(true);
  }, [user]);
  useEffect(() => {
    void reload();
    const onVis = () => { if (document.visibilityState === 'visible') void reload(); };
    const t = window.setInterval(() => void reload(), 5 * 60e3);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(BILLING_GATE_CHANGED, reload);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener(BILLING_GATE_CHANGED, reload); };
  }, [reload]);
  return { gate, loaded, reload };
}
