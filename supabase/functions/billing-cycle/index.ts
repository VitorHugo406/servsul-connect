// Mudar a forma de cobrança da empresa pela aba Pagamentos: avulso -> mensal/anual automático, ou mensal <-> anual.
// Mantém o plano atual (subir de plano é o pedido 'plan_change' da função billing). O cartão é cadastrado no Mercado Pago
// (preapproval_plan com período grátis até o fim do período já pago), então a 1ª cobrança automática só acontece no vencimento:
// ninguém paga duas vezes. Quando a assinatura fica "authorized", a empresa passa para o novo ciclo e a assinatura antiga
// (se houver) é cancelada. As renovações seguintes são tratadas pela função billing (applyRecurring / reconcileRenewals).
//   POST {action:'preview'|'start', billing_cycle}   login do administrador da empresa (JWT)
//   POST {action:'check', order_id}                   login do administrador (ao voltar do Mercado Pago)
//   POST {action:'sweep'}                             cron (cabeçalho x-billing-cron, segredo do Vault)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const MP_API = 'https://api.mercadopago.com';
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
const PERIOD_GRACE_DAYS = 3;
const annualCents = (p: any): number => (p?.annual_price_cents ?? Math.round((p?.price_cents ?? 0) * 12 * 0.92));
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || origin === 'https://ewvon.com' || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const label = (c: string) => (c === 'annual' ? 'anual' : c === 'once' ? 'mensal avulso' : 'mensal');

async function mp(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) throw Object.assign(new Error('Pagamento ainda não configurado'), { status: 503 });
  const r = await fetch(MP_API + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Mercado Pago ${r.status}: ${body?.message || body?.error || 'erro'}`), { status: 502, mp: body });
  return body;
}
async function notifySuperAdmin(text: string) {
  try {
    const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
    const ids = (supers ?? []).map((r: any) => r.user_id);
    if (!ids.length) return;
    const { data: target } = await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle();
    if (target) await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: target.id, content: text, company_id: ADMIN_COMPANY_ID });
  } catch (e) { console.error('notifySuperAdmin', e); }
}
async function billingSettings() {
  const { data } = await admin.from('billing_settings').select('extra_user_cents, storage_pack_gb, storage_pack_cents').limit(1).maybeSingle();
  return data ?? { extra_user_cents: 990, storage_pack_gb: 5, storage_pack_cents: 990 };
}
const extrasMonthlyCents = (sub: any, cfg: any) => (sub.extra_users || 0) * cfg.extra_user_cents + Math.ceil((sub.extra_storage_gb || 0) / cfg.storage_pack_gb) * cfg.storage_pack_cents;

/** Valor por ciclo (plano + extras) e dias até o vencimento atual (período grátis do cartão). */
async function quote(sub: any, target: 'monthly' | 'annual') {
  const { data: plan } = await admin.from('subscription_plans').select('id, name, price_cents, annual_price_cents').eq('id', sub.plan_id).maybeSingle();
  const cfg = await billingSettings();
  const amount = (target === 'annual' ? annualCents(plan) : (plan?.price_cents ?? 0)) + extrasMonthlyCents(sub, cfg) * (target === 'annual' ? 12 : 1);
  const dueMs = new Date(sub.current_period_end || Date.now()).getTime() - PERIOD_GRACE_DAYS * 864e5;
  const daysLeft = Math.max(0, Math.floor((dueMs - Date.now()) / 864e5));
  return { plan, amount_cents: amount, days_left: daysLeft, first_charge_at: new Date(Date.now() + daysLeft * 864e5).toISOString() };
}

/** Assinatura do cartão autorizada: a empresa passa para o novo ciclo (idempotente). */
async function apply(order: any, pre: any): Promise<string> {
  if (pre?.status !== 'authorized') return `aguardando (${pre?.status || 'sem assinatura'})`;
  if (pre.preapproval_plan_id !== order.mp_plan_id) return 'referência divergente';
  const { data: claimed } = await admin.from('billing_orders').update({ status: 'paid', payment_id: String(pre.id), paid_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending').select('*').maybeSingle();
  if (!claimed) return 'já aplicado';
  const { data: sub } = await admin.from('company_subscriptions').select('*').eq('company_id', order.company_id).maybeSingle();
  const old = sub?.provider_subscription_id && sub.provider_subscription_id !== String(pre.id) && sub.billing_cycle !== 'once' ? String(sub.provider_subscription_id) : null;
  await admin.from('company_subscriptions').update({ billing_cycle: order.target_cycle, provider: 'mercadopago', provider_subscription_id: String(pre.id), provider_customer_id: null }).eq('company_id', order.company_id);
  let oldNote = '';
  if (old) {
    try { await mp(`/preapproval/${encodeURIComponent(old)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }); oldNote = ` · assinatura antiga ${old} cancelada`; }
    catch (e) { oldNote = ` · NÃO consegui cancelar a assinatura antiga ${old}: cancele no Mercado Pago para não cobrar duas vezes`; console.error('cancel old', e); }
  }
  // outros pedidos abertos de troca de ciclo desta empresa ficam sem efeito
  await admin.from('billing_orders').update({ status: 'canceled' }).eq('company_id', order.company_id).eq('kind', 'cycle_change').eq('status', 'pending');
  const { data: comp } = await admin.from('companies').select('name').eq('id', order.company_id).maybeSingle();
  await notifySuperAdmin(`*Forma de cobrança alterada*\n\nEmpresa: ${comp?.name}\nDe: ${label(sub?.billing_cycle || 'once')} para ${label(order.target_cycle)} automático\nValor por ciclo: ${brl(order.amount_cents)}\nAssinatura Mercado Pago: ${pre.id}${oldNote}`);
  return 'aplicado';
}

/** Procura no Mercado Pago a assinatura feita a partir do plano criado para o pedido. */
async function check(order: any): Promise<string> {
  if (!order?.mp_plan_id) return 'sem plano';
  const found = await mp(`/preapproval/search?preapproval_plan_id=${encodeURIComponent(order.mp_plan_id)}`);
  const subs = (found?.results || []).filter((p: any) => p?.preapproval_plan_id === order.mp_plan_id);
  const ok = subs.find((p: any) => p.status === 'authorized');
  if (!ok) return subs.length ? `aguardando (${subs[0].status})` : 'aguardando o cartão';
  return apply(order, ok);
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const cron = req.headers.get('x-billing-cron') || '';
    if (body?.action === 'sweep') {
      const { data: ok } = cron ? await admin.rpc('billing_cron_secret_ok', { _secret: cron }) : { data: false };
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      await admin.from('billing_orders').update({ status: 'canceled' }).eq('kind', 'cycle_change').eq('status', 'pending').lt('created_at', new Date(Date.now() - 7 * 864e5).toISOString());
      const { data: open } = await admin.from('billing_orders').select('*').eq('kind', 'cycle_change').eq('status', 'pending').not('mp_plan_id', 'is', null).limit(30);
      const out: Record<string, string> = {};
      for (const o of open ?? []) { try { out[o.id] = await check(o); } catch (e) { out[o.id] = 'erro: ' + (e as Error).message; } }
      return reply({ ok: true, checked: out });
    }

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
    if (!u?.user) return reply({ error: 'Faça login novamente.' }, 401);
    const [{ data: prof }, { data: roles }] = await Promise.all([
      admin.from('profiles').select('company_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', u.user.id),
    ]);
    const isCompanyAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof?.autonomy_level === 'admin';
    if (!prof?.company_id || !isCompanyAdmin) return reply({ error: 'Somente o administrador da empresa pode mudar a forma de cobrança.' }, 403);
    const { data: comp } = await admin.from('companies').select('id, name, is_system').eq('id', prof.company_id).maybeSingle();
    const { data: sub } = await admin.from('company_subscriptions').select('*').eq('company_id', prof.company_id).maybeSingle();
    if (!comp || comp.is_system || !sub?.plan_id || sub.status === 'exempt') return reply({ error: 'Esta empresa não tem plano pago.' }, 400);

    if (body?.action === 'check') {
      const id = String(body?.order_id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return reply({ error: 'Pedido inválido.' }, 400);
      const { data: order } = await admin.from('billing_orders').select('*').eq('id', id).eq('company_id', comp.id).eq('kind', 'cycle_change').maybeSingle();
      if (!order) return reply({ status: 'nao_e_troca' });
      if (order.status !== 'pending') return reply({ status: order.status === 'paid' ? 'aplicado' : 'cancelado' });
      const r = await check(order);
      return reply({ status: r === 'aplicado' || r === 'já aplicado' ? 'aplicado' : 'aguardando', detail: r });
    }

    const target = body?.billing_cycle === 'annual' ? 'annual' : body?.billing_cycle === 'monthly' ? 'monthly' : null;
    if (!target) return reply({ error: 'Escolha mensal ou anual.' }, 400);
    if (target === sub.billing_cycle) return reply({ error: 'A empresa já paga desta forma.' }, 400);
    if (sub.status !== 'active') return reply({ error: 'Regularize o pagamento pendente antes de mudar a forma de cobrança.' }, 400);
    const q = await quote(sub, target);
    if (!q.plan || q.amount_cents < 100) return reply({ error: 'Plano sem valor configurado.' }, 400);
    if (body?.action === 'preview') return reply({ amount_cents: q.amount_cents, days_left: q.days_left, first_charge_at: q.first_charge_at, plan_name: q.plan.name, cycle: target });
    if (body?.action !== 'start') return reply({ error: 'Pedido inválido.' }, 400);

    const { data: order, error: oErr } = await admin.from('billing_orders').insert({ company_id: comp.id, kind: 'cycle_change', quantity: 1, amount_cents: q.amount_cents, target_cycle: target, created_by: u.user.id }).select('id').single();
    if (oErr || !order) return reply({ error: 'Não foi possível criar o pedido.' }, 500);
    const back = `${SITE_URL}/pagamentos?pedido=${order.id}`;
    const auto: Record<string, unknown> = { frequency: target === 'annual' ? 12 : 1, frequency_type: 'months', transaction_amount: q.amount_cents / 100, currency_id: 'BRL' };
    if (q.days_left > 0) auto.free_trial = { frequency: q.days_left, frequency_type: 'days' };
    try {
      const plan_ = await mp('/preapproval_plan', { method: 'POST', body: JSON.stringify({ reason: `ewvon · Plano ${q.plan.name} · ${label(target)} · ${comp.name}`.slice(0, 120), back_url: back, auto_recurring: auto }) });
      await admin.from('billing_orders').update({ mp_plan_id: plan_.id, checkout_url: plan_.init_point }).eq('id', order.id);
      return reply({ id: order.id, checkout_url: plan_.init_point, amount_cents: q.amount_cents, days_left: q.days_left, first_charge_at: q.first_charge_at });
    } catch (e) {
      console.error('cycle_change checkout', e, (e as any)?.mp);
      await admin.from('billing_orders').update({ status: 'canceled' }).eq('id', order.id);
      return reply({ error: 'Não foi possível abrir o cadastro do cartão agora. Tente novamente em instantes.' }, 502);
    }
  } catch (e) {
    console.error('billing-cycle', e);
    const status = (e as any)?.status || 500;
    return reply({ error: status === 503 ? 'Os pagamentos ainda estão sendo configurados.' : 'Não foi possível concluir agora. Tente novamente.' }, status === 503 ? 503 : 500);
  }
});
