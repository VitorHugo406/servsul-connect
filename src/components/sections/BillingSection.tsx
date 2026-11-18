// Central de pagamentos do administrador da empresa — porta fiel do design "Pagamentos - cliente" (Tela_de_Avisos_7).
// CSS em src/styles/billing.css (prefixo bl-, escopo .bl-pg). Plano atual, compra de extras, uso do plano e histórico com recibos.
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyPlan, COMPANY_PLAN_CHANGED } from '@/hooks/useCompanyPlan';
import { useAuth } from '@/contexts/AuthContext';
import { FEATURE_LABEL } from '@/lib/planAccess';
import { toast } from 'sonner';
import { appConfirm } from '@/lib/appDialog';
import { useBillingGate } from '@/hooks/useBillingGate';

type PlanOption = { id: string; name: string; description: string | null; price_cents: number; annual_price_cents: number | null; max_users: number; max_sectors: number; storage_gb: number };
type Payment = { id: string; kind: string; description: string | null; amount_cents: number; paid_at: string; status: string; provider_payment_id: string | null; receipt_number: number | null };
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDay = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const fmtHour = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtBytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1).replace('.', ',')} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1).replace('.', ',')} MB` : `${Math.round(b / 1024)} KB`);
const recNo = (n: number | null) => (n ? 'REC-' + String(n).padStart(6, '0') : '');
// Error body of a non-2xx edge function response.
async function readError(error: unknown): Promise<string | null> {
  try { const b = await (error as any)?.context?.json?.(); return b?.error || null; } catch { return null; }
}
const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'Ativa', tone: '' },
  trialing: { label: 'Em teste', tone: 'bl-nt2' },
  past_due: { label: 'Pagamento pendente', tone: 'bl-wa' },
  canceled: { label: 'Cancelada', tone: 'bl-er' },
  free: { label: 'Cortesia', tone: 'bl-nt2' },
  pending: { label: 'Sem plano', tone: 'bl-nt2' },
};
const PAY_STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Pago', tone: '' }, paid: { label: 'Pago', tone: '' }, confirmed: { label: 'Pago', tone: '' },
  pending: { label: 'Pendente', tone: 'bl-wa' }, refunded: { label: 'Reembolsado', tone: 'bl-wa' }, charged_back: { label: 'Contestado', tone: 'bl-er' }, rejected: { label: 'Recusado', tone: 'bl-er' },
};
const CYCLE: Record<string, string> = { monthly: 'Mensal · renovação automática', annual: 'Anual · renovação automática', once: 'Mensal avulso · sem renovação automática' };

const Check = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;
const IcUsers = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .6 3 2.4 3 5" /></svg>;
const IcBuilding = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></svg>;
const IcDisk = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 14h18v6H3zM3 14l3-9h12l3 9M7 17h.01" /></svg>;

function Meter({ icon, label, used, limit, fmt = (n: number) => String(n), one, many }: { icon: React.ReactNode; label: string; used: number; limit: number | null; fmt?: (n: number) => string; one?: string; many?: string }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? 'bl-rd' : pct >= 80 ? 'bl-am' : '';
  const left = limit === null ? null : Math.max(0, limit - used);
  return (
    <div className="bl-u">
      <div className="bl-uh"><span>{icon}{label}</span><em>{limit === null ? 'Sem limite' : `${pct}%`}</em></div>
      <div className="bl-v">{fmt(used)}{limit === null ? '' : <small> de {fmt(limit)}</small>}</div>
      {limit !== null ? <div className="bl-br"><i className={tone} style={{ width: `${pct}%` }} /></div> : null}
      <div className={`bl-s${pct >= 100 ? ' bl-rd' : ''}`}>{limit === null ? 'Sem limite no plano' : pct >= 100 ? 'Limite atingido: novos cadastros ficam bloqueados.' : one ? (left === 1 ? `1 ${one} disponível` : `${left} ${many} disponíveis`) : `${fmt(left as number)} disponível`}</div>
    </div>
  );
}

function Stepper({ value, set, min = 1, max, label }: { value: number; set: (n: number) => void; min?: number; max: number; label: string }) {
  return (
    <div className="bl-st">
      <button type="button" aria-label="Diminuir" disabled={value <= min} onClick={() => set(Math.max(min, value - 1))}>−</button>
      <input type="text" inputMode="numeric" value={value} aria-label={label} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); set(Math.max(min, Math.min(max, n || min))); }} />
      <button type="button" aria-label="Aumentar" disabled={value >= max} onClick={() => set(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function BillingSection() {
  const { isAdmin, profile } = useAuth();
  const { plan, loading, reload } = useCompanyPlan();
  const { gate } = useBillingGate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState(1);
  const [packs, setPacks] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => { void supabase.functions.invoke('billing/plans', { body: {} }).then(({ data }) => setPlans(((data as any)?.plans || []).filter((p: PlanOption) => p.id !== 'teste'))); }, []);
  useEffect(() => {
    const cid = (profile as any)?.company_id as string | undefined;
    if (cid) void supabase.from('companies').select('name').eq('id', cid).maybeSingle().then(({ data }) => setCompanyName((data as any)?.name || ''));
  }, [profile]);

  const changePlan = async (target: PlanOption) => {
    setBusy('plan:' + target.id);
    const { data: q, error } = await supabase.functions.invoke('billing/order', { body: { kind: 'plan_change', plan_id: target.id, preview: true } });
    setBusy(null);
    if (error || (q as any)?.error || !q) { toast.error((q as any)?.error || await readError(error) || 'Não foi possível calcular a mudança.'); return; }
    const pay = (q as any).amount_cents >= 100;
    const ok = await appConfirm({
      title: `Mudar para o plano ${target.name}?`,
      message: pay
        ? `Você paga agora ${brl((q as any).amount_cents)}, a diferença proporcional dos ${(q as any).days_left} dia(s) que faltam até a próxima cobrança. Depois, a cobrança passa a ser ${brl((q as any).new_recurring_cents)}${plan?.billing_cycle === 'annual' ? '/ano' : '/mês'} (mais os extras).`
        : `A mudança vale agora, sem cobrança. A próxima cobrança já vem com o valor do novo plano: ${brl((q as any).new_recurring_cents)}${plan?.billing_cycle === 'annual' ? '/ano' : '/mês'} (mais os extras).`,
      confirmText: pay ? 'Pagar diferença' : 'Mudar plano',
    });
    if (!ok) return;
    setBusy('plan:' + target.id);
    const { data, error: err2 } = await supabase.functions.invoke('billing/order', { body: { kind: 'plan_change', plan_id: target.id } });
    setBusy(null);
    if ((data as any)?.applied) { toast.success(`Plano alterado para ${target.name}.`); window.dispatchEvent(new Event(COMPANY_PLAN_CHANGED)); void reload(); return; }
    if (err2 || !(data as any)?.checkout_url) { toast.error((data as any)?.error || await readError(err2) || 'Não foi possível abrir o pagamento agora.'); return; }
    window.location.assign((data as any).checkout_url);
  };

  /** Avulso -> mensal/anual automático (ou mensal <-> anual), no mesmo plano: o cartão é cadastrado agora e a 1ª cobrança é no vencimento. */
  const changeCycle = async (cycle: 'monthly' | 'annual') => {
    setBusy('cycle:' + cycle);
    const { data: q, error } = await supabase.functions.invoke('billing-cycle', { body: { action: 'preview', billing_cycle: cycle } });
    setBusy(null);
    if (error || (q as any)?.error || !q) { toast.error((q as any)?.error || await readError(error) || 'Não foi possível calcular agora.'); return; }
    const first = new Date((q as any).first_charge_at).toLocaleDateString('pt-BR');
    const ok = await appConfirm({
      title: `Passar para cobrança ${cycle === 'annual' ? 'anual' : 'mensal'} automática?`,
      message: `Você cadastra o cartão no Mercado Pago agora e não paga nada hoje. A primeira cobrança automática de ${brl((q as any).amount_cents)}${cycle === 'annual' ? ' por ano' : ' por mês'} acontece em ${first}${(q as any).days_left > 0 ? ', quando acaba o período que você já pagou' : ''}. Depois disso a renovação é automática; dá para cancelar quando quiser.`,
      confirmText: 'Cadastrar cartão',
    });
    if (!ok) return;
    setBusy('cycle:' + cycle);
    const { data, error: e2 } = await supabase.functions.invoke('billing-cycle', { body: { action: 'start', billing_cycle: cycle } });
    setBusy(null);
    if (e2 || !(data as any)?.checkout_url) { toast.error((data as any)?.error || await readError(e2) || 'Não foi possível abrir o cadastro do cartão agora.'); return; }
    window.location.assign((data as any).checkout_url);
  };

  const loadPayments = useCallback(async () => {
    const { data } = await (supabase as any).from('company_payments').select('id, kind, description, amount_cents, paid_at, status, provider_payment_id, receipt_number').order('paid_at', { ascending: false }).limit(50);
    setPayments((data || []) as Payment[]);
    setUpdatedAt(new Date());
  }, []);
  useEffect(() => { void loadPayments(); }, [loadPayments]);
  useEffect(() => {
    // Back from the Mercado Pago checkout: refresh a few times while the payment is confirmed.
    const pedido = new URLSearchParams(window.location.search).get('pedido');
    if (!pedido) return;
    let n = 0, cycleDone = false;
    const tick = async () => {
      n++;
      // Troca da forma de cobrança: confirma no Mercado Pago (não depende só do aviso automático).
      if (!cycleDone) {
        const { data } = await supabase.functions.invoke('billing-cycle', { body: { action: 'check', order_id: pedido } });
        const st = (data as any)?.status;
        if (st === 'aplicado') { cycleDone = true; toast.success('Forma de cobrança alterada. A cobrança passa a ser automática.'); }
        else if (st === 'nao_e_troca' || st === 'cancelado') cycleDone = true;
      }
      void reload(); void loadPayments(); window.dispatchEvent(new Event(COMPANY_PLAN_CHANGED));
    };
    void tick();
    const t = window.setInterval(() => { void tick(); if (n >= 12) window.clearInterval(t); }, 5000);
    return () => window.clearInterval(t);
  }, [reload, loadPayments]);

  const order = async (kind: 'extra_users' | 'extra_storage' | 'once_renewal' | 'regularize', quantity = 1) => {
    setBusy(kind);
    const { data, error } = await supabase.functions.invoke('billing/order', { body: { kind, quantity } });
    setBusy(null);
    if (error || !data?.checkout_url) { toast.error((data as any)?.error || await readError(error) || 'Não foi possível abrir o pagamento agora.'); return; }
    window.location.assign(data.checkout_url);
  };

  /** The receipt PDF is built by the `receipt` function (same layout as the e-mailed one); only the company's admin may download it. */
  const downloadReceipt = async (p: Payment) => {
    setBusy('rec:' + p.id);
    try {
      const { data, error } = await supabase.functions.invoke('receipt', { body: { download: true, payment_id: p.id } });
      const b64 = (data as any)?.base64 as string | undefined;
      if (error || !b64) { toast.error((data as any)?.error || await readError(error) || 'Não foi possível gerar o recibo agora.'); return; }
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = (data as any).filename || 'recibo.pdf'; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { setBusy(null); }
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Data', 'Hora', 'Descrição', 'Recibo', 'Forma', 'ID do pagamento', 'Valor', 'Situação'], ...payments.map((p) => [fmtDay(p.paid_at), fmtHour(p.paid_at), p.description || 'Pagamento', recNo(p.receipt_number), 'Mercado Pago', p.provider_payment_id || '', (p.amount_cents / 100).toFixed(2).replace('.', ','), (PAY_STATUS[p.status] || { label: p.status }).label])];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pagamentos-ewvon.csv'; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 4000);
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
  const once = plan.billing_cycle === 'once';
  const daysLeft = plan.current_period_end ? Math.ceil((new Date(plan.current_period_end).getTime() - Date.now()) / 864e5) : null;
  const lastReceipt = payments.find((p) => p.receipt_number);
  const totalPaid = payments.filter((p) => ['approved', 'paid', 'confirmed'].includes(p.status)).reduce((s, p) => s + p.amount_cents, 0);
  const features = plan.features.length && !plan.features.includes('*') ? plan.features.map((f) => FEATURE_LABEL[f]).filter(Boolean) : [];
  const usersLimit = plan.limits.users, storageLimit = plan.limits.storage_bytes;
  const packBytes = prices.storage_pack_gb * 1024 ** 3;

  return (
    <div className="dk-pg bl-pg">
      <div className="bl-bar"><span>{updatedAt ? 'Atualizado agora' : 'Atualizando...'}{companyName ? ` · Conta ${companyName}` : ''}</span>
        <button className="bl-btn" onClick={() => { void reload(); void loadPayments(); }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>Atualizar</button></div>

      {gate.state === 'pending' ? (
        <div className="bl-warn">
          <div><b>Pagamento pendente</b>
            <p>Não identificamos o pagamento do plano. Regularize em até {gate.days_to_block} dia(s) (até {fmtDay(gate.blocked_at || null)}); depois disso o acesso de todos os usuários da empresa fica suspenso até o pagamento{gate.amount_cents != null ? ` · valor ${brl(gate.amount_cents)}` : ''}.</p></div>
          <button className="bl-btn bl-pri" onClick={() => void order('regularize')} disabled={busy !== null}>{busy === 'regularize' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Pagar agora</button>
        </div>
      ) : null}

      <div className="bl-top">
        <section className="bl-panel bl-pl" aria-label="Plano atual">
          <div className="bl-ph"><div><div className="bl-lab">Plano atual</div><h2>{plan.plan_name || 'Sem plano'}</h2><div className="bl-sub">{CYCLE[plan.billing_cycle] || ''}</div></div><span className={`bl-ok ${st.tone}`}>{st.label}</span></div>
          <div className="bl-fc">
            <div className="bl-f"><div className="bl-l">{once ? 'Válido até' : 'Próxima cobrança'}</div><div className="bl-v">{fmtDay(plan.current_period_end)}</div>
              {daysLeft !== null ? <div className={`bl-s${daysLeft >= 0 ? ' bl-g' : ''}`}>{daysLeft > 0 ? `Faltam ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}` : daysLeft === 0 ? 'Vence hoje' : `Venceu há ${-daysLeft} ${daysLeft === -1 ? 'dia' : 'dias'}`}</div> : null}</div>
            {paidPlan ? <div className="bl-f"><div className="bl-l">{once ? 'Valor para renovar 1 mês' : 'Valor da próxima cobrança'}</div><div className="bl-v">{brl(once ? (plan.price_cents ?? 0) + extrasMonthly : nextTotal)}</div><div className="bl-s">{once ? 'Pagamento único' : extrasMonthly ? 'Inclui extras' : plan.billing_cycle === 'annual' ? 'Cobrança anual' : 'Cobrança mensal'}</div></div> : null}
            <div className="bl-f"><div className="bl-l">Renovação</div><div className="bl-v">{once ? 'Manual' : 'Automática'}</div><div className="bl-s">{once ? 'Sem cobrança automática' : plan.billing_cycle === 'annual' ? 'Cobrança automática anual' : 'Cobrança automática mensal'}</div></div>
          </div>
          {paidPlan ? (
            <div className="bl-acts">
              {once ? <button className="bl-btn bl-pri" onClick={() => void order('once_renewal')} disabled={busy !== null}>{busy === 'once_renewal' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Renovar por mais 1 mês</button> : null}
              {lastReceipt ? <button className="bl-btn" onClick={() => void downloadReceipt(lastReceipt)} disabled={busy !== null}>{busy === 'rec:' + lastReceipt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Baixar último recibo</button> : null}
            </div>
          ) : null}
          {features.length ? <div><div className="bl-lab">Incluído no plano</div><div className="bl-inc">{features.map((f) => <div key={f}><Check /> {f}</div>)}</div></div> : null}
        </section>

        <section className="bl-panel bl-ex" aria-label="Comprar extras">
          <h2>Comprar extras</h2>
          {!paidPlan ? <div className="bl-nt">Disponível para empresas com plano pago.</div> : <>
            <div className="bl-it"><div><b>Usuários extras</b><span className="bl-d">{brl(prices.extra_user_cents)} por usuário/mês</span></div>
              <div className="bl-qr"><Stepper value={users} set={setUsers} max={500} label="Quantidade de usuários" /><button className="bl-btn bl-pri" onClick={() => void order('extra_users', users)} disabled={busy !== null}>{busy === 'extra_users' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Pagar {brl(prices.extra_user_cents * users * monthsLeft)}</button></div>
              {usersLimit !== null ? <div className="bl-nl"><span>Limite de usuários</span><span><b>{usersLimit}</b> → <b>{usersLimit + users}</b></span></div> : null}</div>
            <div className="bl-it"><div><b>Armazenamento extra</b><span className="bl-d">{brl(prices.storage_pack_cents)} por {prices.storage_pack_gb} GB/mês</span></div>
              <div className="bl-qr"><Stepper value={packs} set={setPacks} max={100} label={`Quantidade de blocos de ${prices.storage_pack_gb} GB`} /><button className="bl-btn bl-pri" onClick={() => void order('extra_storage', packs)} disabled={busy !== null}>{busy === 'extra_storage' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Pagar {brl(prices.storage_pack_cents * packs * monthsLeft)}</button></div>
              {storageLimit !== null ? <div className="bl-nl"><span>Limite de armazenamento</span><span><b>{fmtBytes(storageLimit)}</b> → <b>{fmtBytes(storageLimit + packs * packBytes)}</b></span></div> : null}</div>
            <div className="bl-nt">{plan.billing_cycle === 'annual' ? `Agora você paga os ${monthsLeft} mês(es) até a renovação anual; depois o extra entra junto na cobrança automática.` : once ? 'Agora você paga 1 mês; o extra entra junto na próxima renovação.' : 'Agora você paga 1 mês; depois o extra entra junto na cobrança automática mensal.'}</div>
          </>}
        </section>
      </div>

      <section className="bl-panel" aria-label="Uso do plano">
        <div className="bl-sh">Uso do plano<span>Limites contratados no plano atual</span></div>
        <div className="bl-us">
          <Meter icon={<IcUsers />} label="Usuários ativos" used={plan.usage.users} limit={plan.limits.users} one="vaga" many="vagas" />
          <Meter icon={<IcBuilding />} label="Setores (fora o Geral)" used={plan.usage.sectors} limit={plan.limits.sectors} one="setor" many="setores" />
          <Meter icon={<IcDisk />} label="Armazenamento" used={plan.usage.storage_bytes} limit={plan.limits.storage_bytes} fmt={fmtBytes} />
        </div>
      </section>

      {paidPlan ? (() => {
        const monthly = (plan.price_cents ?? 0) + extrasMonthly;
        const annual = (plan.annual_price_cents ?? Math.round((plan.price_cents ?? 0) * 12 * 0.92)) + extrasMonthly * 12;
        const opts: { id: 'once' | 'monthly' | 'annual'; name: string; price: string; desc: string }[] = [
          { id: 'once', name: 'Avulso', price: `${brl(monthly)}/mês`, desc: 'Você paga cada mês quando quiser (Pix, boleto ou cartão). Sem cobrança automática.' },
          { id: 'monthly', name: 'Mensal automático', price: `${brl(monthly)}/mês`, desc: 'Cobrado no cartão todo mês, sem você precisar lembrar.' },
          { id: 'annual', name: 'Anual automático', price: `${brl(annual)}/ano`, desc: `Cobrado no cartão uma vez por ano${annual < monthly * 12 ? ` · economia de ${brl(monthly * 12 - annual)} por ano` : ''}.` },
        ];
        return (
          <section className="bl-panel" aria-label="Forma de cobrança">
            <div className="bl-sh">Forma de cobrança<span>Mude quando quiser: o período que você já pagou é respeitado.</span></div>
            <div className="bl-pl2" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
              {opts.map((o) => {
                const cur = plan.billing_cycle === o.id;
                return (
                  <div key={o.id} className={`bl-it${cur ? ' bl-cur' : ''}`}>
                    <b>{o.name}</b>
                    <div className="bl-v" style={{ fontSize: 20, fontWeight: 600 }}>{o.price}</div>
                    <span className="bl-d">{o.desc}</span>
                    {cur ? <span className="bl-d" style={{ fontWeight: 600, color: 'var(--dkx-tx-1c2430,#1C2430)' }}>Forma atual</span>
                      : o.id === 'once' ? <span className="bl-d">Para voltar ao avulso, fale com o suporte.</span>
                      : <button className="bl-btn bl-pri" disabled={busy !== null} onClick={() => void changeCycle(o.id as 'monthly' | 'annual')}>{busy === 'cycle:' + o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Mudar para {o.id === 'annual' ? 'anual' : 'mensal'}</button>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })() : null}

      {paidPlan && plans.length > 1 ? (
        <section className="bl-panel" aria-label="Mudar de plano">
          <div className="bl-sh">Mudar de plano<span>Ao subir você paga só a diferença proporcional; ao descer, vale na hora e o novo valor entra na próxima cobrança.</span></div>
          <div className="bl-pl2">
            {plans.map((p) => {
              const current = p.id === plan.plan_id;
              const price = plan.billing_cycle === 'annual' ? (p.annual_price_cents ?? p.price_cents * 12) : p.price_cents;
              return (
                <div key={p.id} className={`bl-it${current ? ' bl-cur' : ''}`}>
                  <b>{p.name}</b>
                  <div className="bl-v" style={{ fontSize: 20, fontWeight: 600 }}>{brl(price)}<small style={{ fontSize: 12.5, fontWeight: 400, color: '#4A5563' }}>{plan.billing_cycle === 'annual' ? '/ano' : '/mês'}</small></div>
                  <span className="bl-d">{p.max_users} usuários · {p.max_sectors} setores · {p.storage_gb} GB</span>
                  {current ? <span className="bl-d" style={{ fontWeight: 600, color: 'var(--dkx-tx-1c2430,#1C2430)' }}>Plano atual</span>
                    : <button className="bl-btn" disabled={busy !== null} onClick={() => void changePlan(p)}>{busy === 'plan:' + p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{(p.price_cents > (plan.price_cents ?? 0)) ? 'Subir para este' : 'Mudar para este'}</button>}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="bl-panel" aria-label="Histórico de pagamentos">
        <div className="bl-sh">Histórico de pagamentos<button className="bl-btn" onClick={exportCsv} disabled={!payments.length}>Exportar</button></div>
        {!payments.length ? <div className="bl-empty">Nenhum pagamento registrado ainda.</div> : (
          <>
            <div className="bl-tw"><table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th>ID do pagamento</th><th className="bl-r">Valor</th><th>Situação</th><th className="bl-r">Recibo</th></tr></thead>
              <tbody>
                {payments.map((p) => {
                  const ps = PAY_STATUS[p.status] || { label: p.status, tone: 'bl-nt2' };
                  return (
                    <tr key={p.id}>
                      <td>{fmtDay(p.paid_at)}<div className="bl-su">{fmtHour(p.paid_at)}</div></td>
                      <td><div className="bl-tt">{p.description || 'Pagamento'}</div>{p.receipt_number ? <div className="bl-su">Recibo {recNo(p.receipt_number)}</div> : null}</td>
                      <td>Mercado Pago</td><td>{p.provider_payment_id || '—'}</td><td className="bl-r bl-tt">{brl(p.amount_cents)}</td>
                      <td><span className={`bl-pg2 ${ps.tone}`}>{ps.label}</span></td>
                      <td className="bl-r">{p.receipt_number ? <button className="bl-btn" onClick={() => void downloadReceipt(p)} disabled={busy !== null}>{busy === 'rec:' + p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Baixar recibo</button> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <div className="bl-ft"><span>{payments.length} {payments.length === 1 ? 'pagamento' : 'pagamentos'}</span><span>Total pago: <b>{brl(totalPaid)}</b></span></div>
          </>
        )}
      </section>
    </div>
  );
}
