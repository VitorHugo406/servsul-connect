// Super admin: companies that subscribed through /assinar (Mercado Pago). Shows each signup's state
// and lets the super admin run the payment reconciliation right away.
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

type Signup = { id: string; status: string; plan_id: string; amount_cents: number; company_name: string; admin_email: string; error: string | null; attempts: number; created_at: string; activated_at: string | null };
const LABEL: Record<string, string> = { pending_payment: 'Aguardando pagamento', provisioning: 'Criando empresa', active: 'Ativa', failed: 'Falhou (tentando de novo)', expired: 'Expirada sem pagamento', canceled: 'Cancelada' };
const TONE: Record<string, string> = { active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', failed: 'bg-destructive/10 text-destructive', pending_payment: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', provisioning: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' };
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SignupsPanel() {
  const [rows, setRows] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await (supabase as any).from('company_signups').select('id, status, plan_id, amount_cents, company_name, admin_email, error, attempts, created_at, activated_at').order('created_at', { ascending: false }).limit(30);
    setRows((data || []) as Signup[]); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const reconcile = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('billing/reconcile', { body: {} });
    setBusy(false);
    if (error) { toast.error('Não foi possível conferir os pagamentos agora.'); return; }
    toast.success('Pagamentos conferidos com o Mercado Pago.');
    void load();
  };
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div><p className="text-[15px] font-semibold">Assinaturas pelo site</p><p className="text-[13px] text-muted-foreground">Empresas que assinaram em /assinar. A conferência com o Mercado Pago também roda sozinha a cada 5 minutos.</p></div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => void reconcile()} disabled={busy}><RefreshCw className={'mr-2 h-4 w-4' + (busy ? ' animate-spin' : '')} />Conferir agora</Button>
        </div>
        {loading ? <p className="px-4 py-6 text-sm text-muted-foreground">Carregando…</p> : !rows.length ? <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma assinatura pelo site ainda.</p> : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.company_name}</p><p className="truncate text-[13px] text-muted-foreground">{r.admin_email} · {r.plan_id} · {brl(r.amount_cents)}/mês · {new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>{r.error && r.status !== 'active' ? <p className="truncate text-[12px] text-destructive">{r.error}</p> : null}</div>
                <span className={'rounded-md px-2 py-1 text-xs font-medium ' + (TONE[r.status] || 'bg-muted text-muted-foreground')}>{LABEL[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
