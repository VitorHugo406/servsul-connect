// Company admin billing center: plan, next charge, usage against limits, add-ons and payment history.
import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Plus, RefreshCw, Users, HardDrive, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCompanyPlan, COMPANY_PLAN_CHANGED } from '@/hooks/useCompanyPlan';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_LABEL } from '@/lib/planAccess';
import { toast } from 'sonner';

type Payment = { id: string; kind: string; description: string | null; amount_cents: number; paid_at: string; status: string };
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—');
const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1024)} KB`);
const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'Ativa', tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  trialing: { label: 'Em teste', tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  past_due: { label: 'Pagamento pendente', tone: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  canceled: { label: 'Cancelada', tone: 'bg-destructive/10 text-destructive' },
  free: { label: 'Cortesia', tone: 'bg-muted text-foreground' },
  pending: { label: 'Sem plano', tone: 'bg-muted text-muted-foreground' },
};
const CYCLE: Record<string, string> = { monthly: 'Mensal · renovação automática', annual: 'Anual · renovação automática', once: 'Mensal avulso · sem renovação automática' };

function Meter({ icon: Icon, label, used, limit, fmt = (n: number) => String(n) }: { icon: typeof Users; label: string; used: number; limit: number | null; fmt?: (n: number) => string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-foreground';
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between text-[13px] text-muted-foreground"><span className="flex items-center gap-1.5"><Icon className="h-4 w-4" />{label}</span><span>{limit === null ? 'Sem limite' : `${pct}%`}</span></div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{fmt(used)}<span className="text-sm font-normal text-muted-foreground">{limit === null ? '' : ` de ${fmt(limit)}`}</span></p>
      {limit !== null ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${tone}`} style={{ width: `${pct}%` }} /></div> : null}
      {limit !== null && pct >= 100 ? <p className="mt-2 text-[12px] text-destructive">Limite atingido: novos cadastros ficam bloqueados.</p> : null}
    </CardContent></Card>
  );
}

export function BillingSection() {
  const { isAdmin } = useAuth();
  const { plan, loading, reload } = useCompanyPlan();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState(1);
  const [packs, setPacks] = useState(1);

  const loadPayments = async () => {
    const { data } = await (supabase as any).from('company_payments').select('id, kind, description, amount_cents, paid_at, status').order('paid_at', { ascending: false }).limit(50);
    setPayments((data || []) as Payment[]);
  };
  useEffect(() => { void loadPayments(); }, []);
  useEffect(() => {
    // Back from the Mercado Pago checkout: refresh a few times while the payment is confirmed.
    if (!new URLSearchParams(window.location.search).get('pedido')) return;
    let n = 0;
    const t = window.setInterval(() => { n++; void reload(); void loadPayments(); window.dispatchEvent(new Event(COMPANY_PLAN_CHANGED)); if (n >= 12) window.clearInterval(t); }, 5000);
    return () => window.clearInterval(t);
  }, [reload]);

  const order = async (kind: 'extra_users' | 'extra_storage' | 'once_renewal', quantity = 1) => {
    setBusy(kind);
    const { data, error } = await supabase.functions.invoke('billing/order', { body: { kind, quantity } });
    setBusy(null);
    if (error || !data?.checkout_url) { toast.error((data as any)?.error || 'Não foi possível abrir o pagamento agora.'); return; }
    window.location.assign(data.checkout_url);
  };

  if (!isAdmin) return <div className="p-8 text-center text-sm text-muted-foreground">Somente o administrador da empresa vê os pagamentos.</div>;
  if (loading || !plan) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (plan.is_system || plan.status === 'exempt') return <div className="p-8 text-center text-sm text-muted-foreground">Esta empresa não tem cobrança.</div>;

  const st = STATUS[plan.status] || STATUS.pending;
  const prices = plan.prices || { extra_user_cents: 990, storage_pack_gb: 5, storage_pack_cents: 990 };
  const extrasMonthly = plan.extra_users * prices.extra_user_cents + Math.ceil(plan.extra_storage_gb / prices.storage_pack_gb) * prices.storage_pack_cents;
  const base = plan.billing_cycle === 'annual' ? (plan.annual_price_cents ?? 0) : (plan.price_cents ?? 0);
  const nextTotal = base + extrasMonthly * (plan.billing_cycle === 'annual' ? 12 : 1);
  const paidPlan = plan.status !== 'free' && plan.status !== 'pending' && !!plan.plan_id;
  const monthsLeft = plan.billing_cycle === 'annual' && plan.current_period_end ? Math.max(1, Math.ceil((new Date(plan.current_period_end).getTime() - Date.now()) / (30 * 864e5))) : 1;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader icon={<CreditCard />} title="Pagamentos" subtitle="Plano da empresa, limites de uso, compras de extras e histórico de pagamentos."
        actions={<Button variant="outline" size="sm" className="h-9" onClick={() => { void reload(); void loadPayments(); }}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-muted-foreground">Plano atual</p>
              <p className="mt-0.5 text-xl font-semibold">{plan.plan_name || 'Sem plano'}</p>
              <p className="text-[13px] text-muted-foreground">{CYCLE[plan.billing_cycle] || ''}</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${st.tone}`}>{st.label}</span>
          </div>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <p className="text-[13px] text-muted-foreground">{plan.billing_cycle === 'once' ? 'Válido até' : 'Próxima cobrança'}</p>
              <p className="font-medium">{fmtDate(plan.current_period_end)}</p>
            </div>
            {paidPlan ? <div>
              <p className="text-[13px] text-muted-foreground">{plan.billing_cycle === 'once' ? 'Valor para renovar 1 mês' : 'Valor da próxima cobrança'}</p>
              <p className="font-medium">{brl(plan.billing_cycle === 'once' ? (plan.price_cents ?? 0) + extrasMonthly : nextTotal)}{extrasMonthly ? <span className="text-[12px] text-muted-foreground"> (inclui extras)</span> : null}</p>
            </div> : null}
          </div>
          {plan.billing_cycle === 'once' && paidPlan ? (
            <Button className="mt-4 h-9" onClick={() => void order('once_renewal')} disabled={busy !== null}>{busy === 'once_renewal' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Renovar por mais 1 mês</Button>
          ) : null}
          {plan.features.length && !plan.features.includes('*') ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[13px] text-muted-foreground">Incluído no plano</p>
              <p className="mt-1 text-[13px]">{plan.features.map((f) => FEATURE_LABEL[f]).filter(Boolean).join(' · ')}</p>
            </div>
          ) : null}
        </CardContent></Card>

        <Card><CardContent className="space-y-4 p-5">
          <p className="text-[15px] font-semibold">Comprar extras</p>
          {!paidPlan ? <p className="text-[13px] text-muted-foreground">Disponível para empresas com plano pago.</p> : <>
            <div>
              <p className="text-[13px] text-muted-foreground">Usuários extras · {brl(prices.extra_user_cents)} por usuário/mês</p>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min={1} max={500} value={users} onChange={(e) => setUsers(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Quantidade de usuários" />
                <Button size="sm" className="h-9 flex-1" onClick={() => void order('extra_users', users)} disabled={busy !== null}>{busy === 'extra_users' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}Pagar {brl(prices.extra_user_cents * users * monthsLeft)}</Button>
              </div>
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Armazenamento extra · {brl(prices.storage_pack_cents)} por {prices.storage_pack_gb} GB/mês</p>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min={1} max={100} value={packs} onChange={(e) => setPacks(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm" aria-label="Pacotes de armazenamento" />
                <Button size="sm" className="h-9 flex-1" onClick={() => void order('extra_storage', packs)} disabled={busy !== null}>{busy === 'extra_storage' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}Pagar {brl(prices.storage_pack_cents * packs * monthsLeft)}</Button>
              </div>
            </div>
            <p className="text-[12px] text-muted-foreground">{plan.billing_cycle === 'annual' ? `Agora você paga os ${monthsLeft} mês(es) até a renovação anual; depois o extra entra junto na cobrança automática.` : plan.billing_cycle === 'once' ? 'Agora você paga 1 mês; o extra entra junto na próxima renovação.' : 'Agora você paga 1 mês; depois o extra entra junto na cobrança automática mensal.'}</p>
          </>}
        </CardContent></Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Meter icon={Users} label="Usuários ativos" used={plan.usage.users} limit={plan.limits.users} />
        <Meter icon={Building2} label="Setores" used={plan.usage.sectors} limit={plan.limits.sectors} />
        <Meter icon={HardDrive} label="Armazenamento" used={plan.usage.storage_bytes} limit={plan.limits.storage_bytes} fmt={fmtBytes} />
      </div>

      <Card><CardContent className="p-0">
        <div className="border-b border-border px-4 py-3"><p className="text-[15px] font-semibold">Histórico de pagamentos</p></div>
        {!payments.length ? <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p> : (
          <div className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{p.description || 'Pagamento'}</p><p className="text-[12px] text-muted-foreground">{new Date(p.paid_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>
                <span className="shrink-0 font-medium tabular-nums">{brl(p.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
