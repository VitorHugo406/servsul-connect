// Self-service company subscription with Mercado Pago (monthly preapproval).
//
// Routes (verify_jwt = false; each route authenticates itself):
//   POST /billing/plans      public: active plans and whether payments are configured.
//   POST /billing/signup     public: validates the company + admin data, stores a pending signup
//                            (password AES-GCM encrypted), creates the Mercado Pago subscription and
//                            returns its checkout URL plus a private status token.
//   POST /billing/status     public: { id, token } -> signup status (no secrets).
//   POST /billing/webhook    Mercado Pago notifications. The body is never trusted: every resource is
//                            fetched again from Mercado Pago's API with our access token.
//   POST /billing/reconcile  hourly cron (Vault secret header) or super admin: re-checks open signups
//                            and retries failed provisioning, so a lost notification never loses a sale.
//
// Secrets (Supabase > Edge Functions > Secrets): MP_ACCESS_TOKEN (required), MP_WEBHOOK_SECRET
// (recommended, validates x-signature), SITE_URL (default https://ewvon.vercel.app).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { esc, layout, mailerConfigured, sendMail } from '../_shared/mailer.ts';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const MP_API = 'https://api.mercadopago.com';
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
const LOGO_BUCKET = 'company-logos';
const PERIOD_GRACE_DAYS = 3;
const CYCLES = ['monthly', 'annual', 'once'] as const;
const periodDays = (cycle: string) => (cycle === 'annual' ? 366 : 31);
// One rule for the yearly price (the plan's own value, or 12 months with 8% off), used by signup, renewals, add-ons and reminders.
const annualCents = (p: any): number => (p?.annual_price_cents ?? Math.round((p?.price_cents ?? 0) * 12 * 0.92));
const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing/webhook`;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

// ---------- helpers ----------
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// AES-GCM key derived (HKDF) from the service role key, which only exists on the server.
let keyPromise: Promise<CryptoKey> | null = null;
const signupKey = () => (keyPromise ??= (async () => {
  const base = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ewvon-company-signup'), info: enc.encode('admin-password-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
})());
async function encryptSecret(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await signupKey(), enc.encode(plain)));
  const out = new Uint8Array(iv.length + ct.length); out.set(iv); out.set(ct, iv.length);
  return 'v1:' + b64(out);
}
async function decryptSecret(stored: string) {
  const raw = unb64(stored.replace(/^v1:/, ''));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await signupKey(), raw.slice(12));
  return new TextDecoder().decode(pt);
}
const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

const passwordRuleError = (pw: unknown): string | null =>
  typeof pw !== 'string' || pw.length < 6 || pw.length > 72 || /\s/.test(pw) || !/\p{L}/u.test(pw) || !/\p{Lu}/u.test(pw) || !/\d/.test(pw) || !/[^\p{L}\d\s]/u.test(pw)
    ? 'A senha deve ter pelo menos 6 caracteres, com letra maiúscula, número e caractere especial, sem espaços.'
    : null;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'empresa';

const tokenMode = () => { const t = Deno.env.get('MP_ACCESS_TOKEN') || ''; return !t ? 'missing' : t.startsWith('TEST-') ? 'test' : 'production'; };

let lastTokenAlert = 0;
async function mp(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('MP_ACCESS_TOKEN');
  if (!token) throw Object.assign(new Error('Pagamento ainda não configurado'), { status: 503 });
  const r = await fetch(MP_API + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    // The key was revoked/expired: nobody could pay and nothing would tell us. Warn the super admin (at most once an hour).
    if ((r.status === 401 || r.status === 403) && Date.now() - lastTokenAlert > 3600e3) {
      lastTokenAlert = Date.now();
      void notifySuperAdmin(`*Mercado Pago recusou a chave de acesso*\n\nO Mercado Pago respondeu ${r.status} a uma consulta (${path.split('?')[0]}). Enquanto isso não for resolvido, novos pagamentos não abrem e confirmações podem atrasar. Gere uma nova chave no painel do Mercado Pago e atualize o segredo MP_ACCESS_TOKEN.`);
    }
    throw Object.assign(new Error(`Mercado Pago ${r.status}: ${body?.message || body?.error || 'erro'}`), { status: 502, mp: body });
  }
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

// Message in the "Comunicados" chat of a company's base admin (the one created with the subscription).
async function notifyCompanyAdmin(companyId: string, text: string) {
  try {
    const { data: signup } = await admin.from('company_signups').select('admin_email').eq('company_id', companyId).eq('status', 'active').order('created_at').limit(1).maybeSingle();
    let target: any = null;
    if (signup?.admin_email) ({ data: target } = await admin.from('profiles').select('id, email, name').eq('company_id', companyId).ilike('email', signup.admin_email).maybeSingle());
    if (!target) ({ data: target } = await admin.from('profiles').select('id, email, name').eq('company_id', companyId).eq('autonomy_level', 'admin').eq('is_active', true).order('created_at').limit(1).maybeSingle());
    if (target) await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: target.id, content: text, company_id: companyId });
    return target as { id: string; email: string; name: string } | null;
  } catch (e) { console.error('notifyCompanyAdmin', e); return null; }
}

const gb = (b: number) => (b / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' GB';
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Sold storage vs what the Supabase plan allows: alerts the super admin whenever the situation changes.
async function checkSystemCapacity(): Promise<string> {
  try {
    const { data: o } = await admin.rpc('system_storage_overview');
    if (!o) return 'sem dados';
    const cap = Number(o.capacity_bytes), committed = Number(o.committed_bytes), files = Number(o.files_bytes), db = Number(o.db_bytes), dbCap = Number(o.db_capacity_bytes);
    const issues: string[] = [];
    if (committed > cap) issues.push(`Vendido às empresas: ${gb(committed)} · o plano do Supabase libera ${gb(cap)} de arquivos`);
    if (files >= cap * 0.8) issues.push(`Arquivos já usam ${gb(files)} de ${gb(cap)} (${Math.round((files / cap) * 100)}%)`);
    if (db >= dbCap * 0.8) issues.push(`Banco de dados usa ${Math.round(db / 1024 ** 2)} MB de ${Math.round(dbCap / 1024 ** 2)} MB`);
    const state = issues.length ? issues.map((i) => i.split(':')[0].split(' ')[0]).join('|') + ':' + Math.floor(committed / 1024 ** 3) : 'ok';
    const { data: cfg } = await admin.from('billing_settings').select('capacity_alert_state').limit(1).maybeSingle();
    if ((cfg?.capacity_alert_state || 'ok') === state) return 'capacidade: sem mudança';
    await admin.from('billing_settings').update({ capacity_alert_state: state }).not('extra_user_cents', 'is', null);
    if (issues.length) await notifySuperAdmin(`*Atenção: armazenamento do sistema*\n\n${issues.map((i) => '• ' + i).join('\n')}\n\nPara não travar os uploads das empresas, aumente o plano do Supabase (Settings > Billing; o plano Pro inclui 100 GB de arquivos e 8 GB de banco) e depois atualize a capacidade na aba Armazenamento.`);
    else await notifySuperAdmin('*Armazenamento do sistema normalizado*\n\nO espaço vendido às empresas cabe no plano atual do Supabase.');
    return 'capacidade: alerta ' + state;
  } catch (e) { return 'capacidade: ' + (e as Error).message; }
}

// Expiry / next-charge e-mails (5 days before) and near-full storage notices for each company.
async function sendReminders(out: Record<string, string>) {
  const { data: subs } = await admin.from('company_subscriptions').select('company_id, plan_id, status, billing_cycle, current_period_end, provider_subscription_id, reminder_sent_for, storage_alert_level, extra_users, extra_storage_gb').in('status', ['active', 'past_due']).not('plan_id', 'is', null);
  if (!subs?.length) return;
  const cfg = await billingSettings();
  const { data: comps } = await admin.from('companies').select('id, name, is_system').in('id', subs.map((x: any) => x.company_id));
  const byId = new Map((comps ?? []).map((c: any) => [c.id, c]));
  for (const sub of subs as any[]) {
    const comp: any = byId.get(sub.company_id);
    if (!comp || comp.is_system) continue;
    try {
      // 1. Expiry / charge reminder.
      const due = new Date(sub.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5;
      const daysLeft = Math.ceil((due - Date.now()) / 864e5);
      if (sub.current_period_end && daysLeft <= 5 && daysLeft >= -PERIOD_GRACE_DAYS && sub.reminder_sent_for !== sub.current_period_end) {
        const { data: plan } = await admin.from('subscription_plans').select('name, price_cents, annual_price_cents').eq('id', sub.plan_id).maybeSingle();
        const base = sub.billing_cycle === 'annual' ? annualCents(plan) : (plan?.price_cents ?? 0);
        const total = base + extrasMonthlyCents(sub, cfg) * (sub.billing_cycle === 'annual' ? 12 : 1);
        const date = new Date(due).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const auto = sub.billing_cycle !== 'once' && !!sub.provider_subscription_id;
        const when = daysLeft > 1 ? `em ${daysLeft} dias (${date})` : daysLeft === 1 ? `amanhã (${date})` : daysLeft === 0 ? `hoje (${date})` : `desde ${date}`;
        const title = auto ? `A próxima cobrança do ewvon é ${when}` : `O plano ${daysLeft < 0 ? 'venceu' : 'vence'} ${when}`;
        const body = auto
          ? `A cobrança automática de <b>${brl(total)}</b> do plano <b>${esc(plan?.name)}</b> da empresa <b>${esc(comp.name)}</b> acontece ${when}, no cartão ou conta cadastrada no Mercado Pago. Confira se o meio de pagamento está válido para não interromper o acesso.`
          : `O plano <b>${esc(plan?.name)}</b> da empresa <b>${esc(comp.name)}</b> ${daysLeft < 0 ? 'venceu' : 'vence'} ${when}. Para continuar usando o sistema, renove por <b>${brl(total)}</b> em <b>Pagamentos</b> > <b>Renovar por mais 1 mês</b>.`;
        const target = await notifyCompanyAdmin(sub.company_id, `*${title.replace(/<[^>]+>/g, '')}*\n\n${body.replace(/<[^>]+>/g, '')}`);
        if (target?.email && mailerConfigured()) {
          await sendMail({ to: target.email, subject: `ewvon · ${title}`, fromName: undefined, html: layout(`<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#18181b"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1><p style="font-size:14px;line-height:1.6;margin:0 0 18px">Olá, ${esc((target.name || '').split(' ')[0])}! ${body}</p><a href="${SITE_URL}/pagamentos" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-size:14px;font-weight:600">Abrir Pagamentos</a></div>`, title) });
        }
        await admin.from('company_subscriptions').update({ reminder_sent_for: sub.current_period_end }).eq('company_id', sub.company_id);
        out['lembrete:' + comp.name] = target ? 'enviado' : 'sem administrador';
      }
      // 2. Storage almost full (90% and 100%), only to the base admin in the Comunicados chat.
      const { data: lim } = await admin.rpc('company_limits', { _company_id: sub.company_id });
      const limit = Number((Array.isArray(lim) ? lim[0] : lim)?.storage_bytes || 0);
      if (limit > 0) {
        const { data: used } = await admin.rpc('company_storage_used', { _company_id: sub.company_id });
        const pct = (Number(used) / limit) * 100;
        const level = pct >= 100 ? 100 : pct >= 90 ? 90 : pct < 80 ? 0 : sub.storage_alert_level;
        if (level > (sub.storage_alert_level || 0)) {
          await notifyCompanyAdmin(sub.company_id, level >= 100
            ? `*Armazenamento cheio*\n\nA empresa usou ${gb(Number(used))} de ${gb(limit)} e novos arquivos estão bloqueados. Compre mais espaço em Pagamentos > Comprar extras (${brl(cfg.storage_pack_cents)} a cada ${cfg.storage_pack_gb} GB/mês) ou apague arquivos antigos.`
            : `*Armazenamento quase cheio*\n\nA empresa já usou ${Math.floor(pct)}% (${gb(Number(used))} de ${gb(limit)}). Quando chegar a 100%, novos arquivos serão bloqueados. Você pode comprar mais espaço em Pagamentos > Comprar extras.`);
          out['armazenamento:' + comp.name] = level + '%';
        }
        if (level !== (sub.storage_alert_level || 0)) await admin.from('company_subscriptions').update({ storage_alert_level: level }).eq('company_id', sub.company_id);
      }
    } catch (e) { out['lembrete:' + comp.name] = 'erro: ' + (e as Error).message; }
  }
}

// ---------- provisioning (idempotent) ----------
async function provision(signupId: string, silent = false): Promise<{ ok: boolean; error?: string }> {
  // Claim the row so concurrent notifications never provision twice.
  const { data: claimed } = await admin.from('company_signups')
    .update({ status: 'provisioning', updated_at: new Date().toISOString() })
    .eq('id', signupId).in('status', ['pending_payment', 'failed']).select('*').maybeSingle();
  if (!claimed) return { ok: true }; // already provisioning or active
  const s: any = claimed;
  await admin.from('company_signups').update({ attempts: (s.attempts || 0) + 1 }).eq('id', s.id);
  try {
    // 1. Company (reuse the one from an earlier partial attempt).
    let companyId: string | null = s.company_id;
    if (!companyId) {
      let slug = s.slug as string;
      let ins = await admin.from('companies').insert({ name: s.company_name, slug, primary_color: s.primary_color, secondary_color: s.secondary_color, is_active: true }).select('id').single();
      if (ins.error && (ins.error as any).code === '23505') {
        // The address (slug) was taken by someone else after the checkout opened: keep the payment, pick a free variation.
        slug = `${String(s.slug).slice(0, 34)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5)}`;
        ins = await admin.from('companies').insert({ name: s.company_name, slug, primary_color: s.primary_color, secondary_color: s.secondary_color, is_active: true }).select('id').single();
        if (!ins.error) await admin.from('company_signups').update({ slug }).eq('id', s.id);
      }
      if (ins.error) throw new Error('Empresa: ' + ins.error.message);
      const c = ins.data;
      companyId = c.id;
      await admin.from('company_signups').update({ company_id: companyId }).eq('id', s.id);
    }
    // 2. Logo: move the uploaded file from pending/ to the company folder.
    if (s.logo_path && s.logo_path.startsWith('pending/')) {
      const ext = s.logo_path.split('.').pop() || 'png';
      const dest = `${s.slug}/logo-${Date.now()}.${ext}`;
      const { error: cpErr } = await admin.storage.from(LOGO_BUCKET).copy(s.logo_path, dest);
      if (!cpErr) {
        await admin.from('companies').update({ logo_url: dest }).eq('id', companyId);
        await admin.storage.from(LOGO_BUCKET).remove([s.logo_path]);
        await admin.from('company_signups').update({ logo_path: dest }).eq('id', s.id);
      } else console.error('logo copy', cpErr);
    }
    // 3. Subscription.
    const cycle = s.billing_cycle || 'monthly';
    const periodEnd = new Date(Date.now() + (periodDays(cycle) + PERIOD_GRACE_DAYS) * 864e5).toISOString();
    const { error: subErr } = await admin.from('company_subscriptions').upsert({ company_id: companyId, plan_id: s.plan_id, status: 'active', billing_cycle: cycle, provider: 'mercadopago', provider_subscription_id: cycle === 'once' ? null : s.preapproval_id, provider_customer_id: cycle === 'once' ? s.last_payment_id : null, current_period_end: periodEnd }, { onConflict: 'company_id' });
    if (subErr) throw new Error('Assinatura: ' + subErr.message);
    if (s.last_payment_id) { const { error: payErr } = await admin.from('company_payments').upsert({ company_id: companyId, provider_payment_id: String(s.last_payment_id), kind: 'signup', description: `Assinatura ${cycle === 'annual' ? 'anual' : cycle === 'once' ? 'mensal avulsa' : 'mensal'} · plano ${s.plan_id}`, amount_cents: s.amount_cents, paid_at: s.paid_at || new Date().toISOString() }, { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true }); if (payErr) console.error('company_payments', payErr); }
    // 4. Admin user.
    const { data: existingProfile } = await admin.from('profiles').select('user_id, company_id').ilike('email', s.admin_email).maybeSingle();
    let userId: string | null = existingProfile?.company_id === companyId ? existingProfile.user_id : null;
    if (existingProfile && !userId) throw new Error('O e-mail do administrador já está em uso em outra empresa.');
    if (!userId) {
      if (!s.password_enc) throw new Error('Senha do administrador indisponível.');
      const password = await decryptSecret(s.password_enc);
      const { data: created, error: cuErr } = await admin.auth.admin.createUser({ email: s.admin_email, password, email_confirm: true, user_metadata: { name: s.admin_name, display_name: s.admin_name.split(' ')[0], company_id: companyId } });
      if (cuErr || !created?.user) throw new Error('Administrador: ' + (cuErr?.message || 'falha ao criar'));
      userId = created.user.id;
    }
    const { error: pErr } = await admin.from('profiles').update({ company_id: companyId, name: s.admin_name, display_name: s.admin_name.split(' ')[0], autonomy_level: 'admin', is_active: true }).eq('user_id', userId);
    if (pErr) throw new Error('Perfil: ' + pErr.message);
    await admin.from('user_roles').upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
    await admin.from('user_permissions').upsert({ user_id: userId, can_post_announcements: true, can_delete_messages: true, can_access_management: true, can_access_password_change: true, can_create_war_room: true, can_access_orbs: true, can_access_meeting_rooms: true }, { onConflict: 'user_id' });
    // 5. Done: wipe the encrypted password.
    await admin.from('company_signups').update({ status: 'active', activated_at: new Date().toISOString(), password_enc: null, error: null, updated_at: new Date().toISOString() }).eq('id', s.id);
    await checkSystemCapacity();
    if (!silent) await notifySuperAdmin(`*Nova empresa assinante*\n\nEmpresa: ${s.company_name}\nPlano: ${s.plan_id} (${s.billing_cycle === 'annual' ? 'anual' : s.billing_cycle === 'once' ? 'mensal avulso' : 'mensal'})\nAdministrador: ${s.admin_name} (${s.admin_email})\nMercado Pago: ${s.preapproval_id || 'pagamento ' + s.last_payment_id}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('provision failed', s.id, msg);
    await admin.from('company_signups').update({ status: 'failed', error: msg.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', s.id);
    const att = s.attempts || 0;
    if (att === 0 || att === 3 || att === 7) await notifySuperAdmin(`*Falha ao criar empresa paga* (tentativa ${att + 1})\n\nEmpresa: ${s.company_name}\nE-mail: ${s.admin_email}\nPagamento confirmado: ${s.paid_at ? 'sim' : 'ainda não'}\nErro: ${msg}\n\nO sistema tenta de novo a cada 5 minutos (até 8 vezes). Depois disso é preciso resolver manualmente.`);
    // The customer has paid: tell them it is being finished instead of leaving them wondering.
    if (att === 0 && s.paid_at && mailerConfigured()) {
      try {
        await sendMail({ to: s.admin_email, subject: 'ewvon · Recebemos o seu pagamento', html: layout(`<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b"><h2 style="margin:0 0 8px;font-size:20px">Recebemos o seu pagamento</h2><p style="margin:0 0 12px;font-size:14px;color:#52525b">O pagamento da empresa <b>${esc(s.company_name)}</b> foi confirmado. Estamos finalizando a criação do acesso e você recebe um novo e-mail com o recibo assim que terminar, normalmente em poucos minutos.</p><p style="margin:0;font-size:13px;color:#71717a">Se passar de 1 hora, responda este e-mail ou escreva para ewvonsuporte@gmail.com. Você não será cobrado de novo.</p></div>`, 'Recebemos o seu pagamento') });
      } catch (mailErr) { console.error('failure mail', mailErr); }
    }
    return { ok: false, error: msg };
  }
}

// Confirms a payment for a signup straight from Mercado Pago and provisions when approved.
async function checkOncePaid(s: any): Promise<string> {
  const found = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(s.id)}&sort=date_created&criteria=desc`);
  const approved = (found?.results || []).find((p: any) => p?.status === 'approved' && p?.external_reference === s.id && Math.round(Number(p?.transaction_amount) * 100) >= s.amount_cents);
  if (!approved) { const last = (found?.results || [])[0]; return `aguardando pagamento${last ? ' (' + last.status + ')' : ''}`; }
  if (['expired', 'canceled'].includes(s.status)) {
    // Paid late (e.g. a boleto): create the company anyway while the encrypted password still exists.
    if (!s.password_enc) {
      await notifySuperAdmin(`*Pagamento recebido de cadastro encerrado*\n\n${s.company_name} (${s.admin_email}) pagou depois do prazo (pagamento ${approved.id}). Devolva pelo Mercado Pago ou crie a empresa manualmente.`);
      return 'pago após encerrar: aviso enviado';
    }
    await admin.from('company_signups').update({ status: 'pending_payment' }).eq('id', s.id).in('status', ['expired', 'canceled']);
  }
  await admin.from('company_signups').update({ last_payment_id: String(approved.id), paid_at: s.paid_at || new Date().toISOString() }).eq('id', s.id);
  const r = await provision(s.id);
  return r.ok ? 'provisionada' : 'falha: ' + r.error;
}

async function checkSignupPaid(signup: any): Promise<string> {
  let s = signup;
  if (s.billing_cycle === 'once') return checkOncePaid(s);
  let pre: any = s.preapproval_id ? await mp(`/preapproval/${encodeURIComponent(s.preapproval_id)}`) : null;
  if (!pre || pre.status === 'cancelled') {
    // A refused card cancels THAT subscription at Mercado Pago, but the buyer can try again (another card or method) on the same link:
    // look for another attempt under this plan instead of giving up on the signup.
    if (!s.mp_plan_id) { if (pre) { await admin.from('company_signups').update({ status: 'canceled', password_enc: null }).eq('id', s.id).eq('status', 'pending_payment'); return 'cancelada'; } return 'sem assinatura'; }
    const found = await mp(`/preapproval/search?preapproval_plan_id=${encodeURIComponent(s.mp_plan_id)}`);
    const subs = (found?.results || []).filter((p: any) => p?.preapproval_plan_id === s.mp_plan_id);
    const alive = subs.find((p: any) => p.status === 'authorized') || subs.find((p: any) => p.status === 'pending');
    if (!alive) {
      const refused = !!pre || subs.length > 0;
      if (refused) await admin.from('company_signups').update({ error: 'Pagamento recusado pelo Mercado Pago. Tente de novo com outro cartão.' }).eq('id', s.id).eq('status', 'pending_payment');
      return refused ? 'recusado: aguardando nova tentativa' : 'aguardando assinatura';
    }
    await admin.from('company_signups').update({ preapproval_id: alive.id, error: null }).eq('id', s.id);
    s = { ...s, preapproval_id: alive.id };
    pre = await mp(`/preapproval/${encodeURIComponent(alive.id)}`);
  }
  if (pre.preapproval_plan_id !== s.mp_plan_id && pre.external_reference !== s.id) return 'referência divergente';
  if (['expired', 'canceled'].includes(s.status) && ['authorized', 'pending'].includes(pre.status)) {
    // Paid through an old link after the signup was closed: stop the subscription and warn the super admin.
    try { await mp(`/preapproval/${encodeURIComponent(s.preapproval_id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }); } catch (e) { console.error('cancel late', e); }
    await notifySuperAdmin(`*Assinatura cancelada automaticamente*\n\nAlguém assinou pelo link de um cadastro já encerrado (${s.company_name}, ${s.admin_email}). A assinatura ${s.preapproval_id} foi cancelada. Se houve cobrança, devolva pelo Mercado Pago.`);
    return 'cadastro encerrado: assinatura cancelada';
  }
  const search = await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(s.preapproval_id)}`);
  const approved = (search?.results || []).find((p: any) => p?.payment?.status === 'approved' && Math.round(Number(p?.transaction_amount) * 100) >= s.amount_cents);
  if (!approved) return `aguardando (${pre.status})`;
  await admin.from('company_signups').update({ last_payment_id: String(approved.payment?.id || approved.id), paid_at: s.paid_at || new Date().toISOString() }).eq('id', s.id);
  const r = await provision(s.id);
  return r.ok ? 'provisionada' : 'falha: ' + r.error;
}

// Recurring charges for an active company.
async function applyRecurring(preapprovalId: string, paymentStatus: string, amount: number, paymentId = '') {
  const { data: sub } = await admin.from('company_subscriptions').select('company_id, plan_id, current_period_end, billing_cycle').eq('provider', 'mercadopago').eq('provider_subscription_id', preapprovalId).maybeSingle();
  if (!sub) return 'assinatura não vinculada';
  if (paymentStatus === 'approved') {
    const { data: plan } = await admin.from('subscription_plans').select('price_cents, annual_price_cents').eq('id', sub.plan_id).maybeSingle();
    const expected = sub.billing_cycle === 'annual' ? annualCents(plan) : plan?.price_cents;
    if (expected && Math.round(amount * 100) < expected) return 'valor abaixo do plano';
    const base = Math.max(Date.now(), new Date(sub.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5);
    await admin.from('company_subscriptions').update({ status: 'active', current_period_end: new Date(base + (periodDays(sub.billing_cycle) + PERIOD_GRACE_DAYS) * 864e5).toISOString(), pending_notice_for: null, suspended_notice_for: null, export_notice_for: null, final_notice_for: null, deletion_asked_for: null }).eq('company_id', sub.company_id);
    if (paymentId) await admin.from('company_payments').upsert({ company_id: sub.company_id, provider_payment_id: paymentId, kind: 'renewal', description: `Renovação ${sub.billing_cycle === 'annual' ? 'anual' : 'mensal'}`, amount_cents: Math.round(amount * 100) }, { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true });
    return 'renovada';
  }
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(paymentStatus)) {
    await admin.from('company_subscriptions').update({ status: 'past_due' }).eq('company_id', sub.company_id);
    return 'pagamento recusado';
  }
  return 'ignorado';
}

// ---------- add-ons and one-time renewals (billing_orders) ----------
async function billingSettings() {
  const { data } = await admin.from('billing_settings').select('extra_user_cents, storage_pack_gb, storage_pack_cents').limit(1).maybeSingle();
  return data ?? { extra_user_cents: 990, storage_pack_gb: 5, storage_pack_cents: 990 };
}
// Monthly value of the company's add-ons.
const extrasMonthlyCents = (sub: any, cfg: any) => (sub.extra_users || 0) * cfg.extra_user_cents + Math.ceil((sub.extra_storage_gb || 0) / cfg.storage_pack_gb) * cfg.storage_pack_cents;

// Keeps the automatic charge (monthly or annual) equal to plan + add-ons.
async function syncRecurringAmount(companyId: string): Promise<string> {
  const { data: sub } = await admin.from('company_subscriptions').select('*').eq('company_id', companyId).maybeSingle();
  if (!sub?.provider_subscription_id || sub.billing_cycle === 'once') return 'sem cobrança automática';
  const { data: plan } = await admin.from('subscription_plans').select('price_cents, annual_price_cents').eq('id', sub.plan_id).maybeSingle();
  const cfg = await billingSettings();
  const base = sub.billing_cycle === 'annual' ? annualCents(plan) : (plan?.price_cents ?? 0);
  const total = base + extrasMonthlyCents(sub, cfg) * (sub.billing_cycle === 'annual' ? 12 : 1);
  try {
    await mp(`/preapproval/${encodeURIComponent(sub.provider_subscription_id)}`, { method: 'PUT', body: JSON.stringify({ auto_recurring: { transaction_amount: total / 100, currency_id: 'BRL' } }) });
    return 'cobrança automática ajustada';
  } catch (e) {
    await notifySuperAdmin(`*Ajuste manual necessário*\n\nNão consegui atualizar o valor da assinatura ${sub.provider_subscription_id} para ${(total / 100).toFixed(2)}. Ajuste no Mercado Pago. Erro: ${(e as Error).message}`);
    return 'ajuste manual necessário';
  }
}

// Proportional difference to move to another plan until the next charge.
async function planChangeQuote(sub: any, target: any) {
  const { data: cur } = await admin.from('subscription_plans').select('price_cents, annual_price_cents').eq('id', sub.plan_id).maybeSingle();
  const annual = sub.billing_cycle === 'annual';
  const price = (p: any) => (annual ? annualCents(p) : (p?.price_cents ?? 0));
  const totalDays = annual ? 365 : 30;
  const endMs = new Date(sub.current_period_end || Date.now()).getTime() - PERIOD_GRACE_DAYS * 864e5;
  const daysLeft = Math.max(0, Math.min(totalDays, Math.ceil((endMs - Date.now()) / 864e5)));
  const diff = price(target) - price(cur);
  const amount = diff > 0 ? Math.round((diff * daysLeft) / totalDays) : 0;
  return { amount_cents: amount, days_left: daysLeft, upgrade: diff > 0, new_recurring_cents: price(target) };
}

async function applyOrder(orderId: string, payment: any): Promise<string> {
  if (payment?.status !== 'approved') return `pedido: pagamento ${payment?.status}`;
  const { data: order } = await admin.from('billing_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return 'pedido não encontrado';
  if (Math.round(Number(payment.transaction_amount) * 100) < order.amount_cents) return 'pedido: valor divergente';
  const { data: claimed } = await admin.from('billing_orders').update({ status: 'paid', payment_id: String(payment.id), paid_at: new Date().toISOString() }).eq('id', orderId).eq('status', 'pending').select('*').maybeSingle();
  if (!claimed) return 'pedido já aplicado';
  const cfg = await billingSettings();
  const { data: sub } = await admin.from('company_subscriptions').select('*').eq('company_id', order.company_id).maybeSingle();
  let label = '';
  if (order.kind === 'extra_users') {
    await admin.from('company_subscriptions').update({ extra_users: (sub?.extra_users || 0) + order.quantity }).eq('company_id', order.company_id);
    label = `${order.quantity} usuário(s) extra(s)`;
  } else if (order.kind === 'extra_storage') {
    await admin.from('company_subscriptions').update({ extra_storage_gb: (sub?.extra_storage_gb || 0) + order.quantity * cfg.storage_pack_gb }).eq('company_id', order.company_id);
    label = `${order.quantity * cfg.storage_pack_gb} GB extras`;
  } else if (order.kind === 'plan_change') {
    const { data: np } = await admin.from('subscription_plans').select('name').eq('id', order.target_plan_id).maybeSingle();
    await admin.from('company_subscriptions').update({ plan_id: order.target_plan_id }).eq('company_id', order.company_id);
    label = `mudança para o plano ${np?.name || order.target_plan_id} (diferença até a próxima cobrança)`;
  } else if (order.kind === 'regularize') {
    // Paid manually: access is back for one more month. A still-live automatic subscription is cancelled so a later retry does not charge twice.
    const base = Math.max(Date.now(), new Date(sub?.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5);
    if (sub?.provider_subscription_id && sub.billing_cycle !== 'once') {
      try { await mp(`/preapproval/${encodeURIComponent(sub.provider_subscription_id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }); } catch (e) { console.error('cancel preapproval on regularize', e); }
    }
    await admin.from('company_subscriptions').update({ status: 'active', billing_cycle: 'once', provider_subscription_id: null, provider_customer_id: String(payment.id), current_period_end: new Date(base + (31 + PERIOD_GRACE_DAYS) * 864e5).toISOString(), pending_notice_for: null, suspended_notice_for: null, export_notice_for: null, final_notice_for: null, deletion_asked_for: null }).eq('company_id', order.company_id);
    label = 'regularização do pagamento (1 mês)';
  } else {
    const base = Math.max(Date.now(), new Date(sub?.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5);
    await admin.from('company_subscriptions').update({ status: 'active', current_period_end: new Date(base + (31 + PERIOD_GRACE_DAYS) * 864e5).toISOString() }).eq('company_id', order.company_id);
    label = 'renovação de 1 mês';
  }
  await admin.from('company_payments').upsert({ company_id: order.company_id, provider_payment_id: String(payment.id), kind: order.kind, description: label.charAt(0).toUpperCase() + label.slice(1), amount_cents: order.amount_cents }, { onConflict: 'provider,provider_payment_id', ignoreDuplicates: true });
  const sync = order.kind === 'once_renewal' || order.kind === 'regularize' ? '' : ' · ' + await syncRecurringAmount(order.company_id);
  if (order.kind === 'extra_storage' || order.kind === 'plan_change') await checkSystemCapacity();
  const { data: comp } = await admin.from('companies').select('name').eq('id', order.company_id).maybeSingle();
  await notifySuperAdmin(`*Pagamento confirmado*\n\nEmpresa: ${comp?.name}\nItem: ${label}\nValor: R$ ${(order.amount_cents / 100).toFixed(2)}${sync}`);
  return 'pedido aplicado' + sync;
}

// Renewals of automatic subscriptions: the webhook can be lost, so once an hour every subscription close to its due date
// (or already late) is compared with Mercado Pago. A payment is applied only if it is not recorded yet (idempotent).
async function reconcileRenewals(out: Record<string, string>) {
  const { data: subs } = await admin.from('company_subscriptions').select('company_id, status, billing_cycle, current_period_end, provider_subscription_id')
    .in('status', ['active', 'past_due']).not('provider_subscription_id', 'is', null).neq('billing_cycle', 'once')
    .lt('current_period_end', new Date(Date.now() + (PERIOD_GRACE_DAYS + 2) * 864e5).toISOString()).limit(25);
  let n = 0, applied = 0;
  for (const sub of (subs ?? []) as any[]) {
    n++;
    try {
      const pre = await mp(`/preapproval/${encodeURIComponent(sub.provider_subscription_id)}`);
      if (pre.status === 'cancelled' && sub.status !== 'canceled') {
        await admin.from('company_subscriptions').update({ status: 'canceled' }).eq('company_id', sub.company_id);
        const { data: c } = await admin.from('companies').select('name').eq('id', sub.company_id).maybeSingle();
        await notifySuperAdmin(`*Assinatura cancelada no Mercado Pago*\n\nEmpresa: ${c?.name || sub.company_id}\nA assinatura ${sub.provider_subscription_id} foi cancelada (pelo cliente ou pelo Mercado Pago).`);
        out['renovacao:' + sub.company_id] = 'assinatura cancelada';
        continue;
      }
      if (pre.status === 'paused' && sub.status === 'active') await admin.from('company_subscriptions').update({ status: 'past_due' }).eq('company_id', sub.company_id);
      const found = await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(sub.provider_subscription_id)}`);
      const approved = (found?.results || []).filter((p: any) => p?.payment?.status === 'approved' && p?.payment?.id).slice(0, 4);
      if (!approved.length) continue;
      const ids = approved.map((p: any) => String(p.payment.id));
      const { data: known } = await admin.from('company_payments').select('provider_payment_id').eq('company_id', sub.company_id).in('provider_payment_id', ids);
      const have = new Set((known ?? []).map((k: any) => k.provider_payment_id));
      for (const ap of approved.slice().reverse()) {
        const pid = String(ap.payment.id);
        if (have.has(pid)) continue;
        const r = await applyRecurring(sub.provider_subscription_id, 'approved', Number(ap.transaction_amount || 0), pid);
        if (r === 'renovada') applied++;
        out['renovacao:' + sub.company_id] = r;
      }
    } catch (e) { out['renovacao:' + sub.company_id] = 'erro: ' + (e as Error).message; }
  }
  out.renovacoes = `${n} verificada(s), ${applied} aplicada(s)`;
}

// ---------- payment pending -> suspended -> data kept 30 days -> deletion request ----------
const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
async function mailOwner(companyId: string, subject: string, title: string, lines: string[], button?: { label: string; url: string }) {
  const { data: owner } = await admin.rpc('company_owner_email', { _cid: companyId });
  if (!owner || !mailerConfigured()) return false;
  const html = `<div style="background:#fff;border-radius:18px;padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b"><h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2>${lines.map((l) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#3f3f46">${l}</p>`).join('')}${button ? `<p style="margin:18px 0 0"><a href="${button.url}" style="display:inline-block;background:#14264a;color:#fff;text-decoration:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:600">${esc(button.label)}</a></p>` : ''}</div>`;
  try { await sendMail({ to: String(owner), subject: `ewvon · ${subject}`, html: layout(html, title) }); return true; } catch (e) { console.error('mailOwner', e); return false; }
}
async function superAdminProfileId(): Promise<string | null> {
  const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
  const ids = (supers ?? []).map((r: any) => r.user_id);
  if (!ids.length) return null;
  const { data } = await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle();
  return data?.id ?? null;
}
async function reconcileLifecycle(out: Record<string, string>) {
  const { data: subs } = await admin.from('company_subscriptions')
    .select('company_id, status, billing_cycle, current_period_end, provider_subscription_id, pending_notice_for, suspended_notice_for, export_notice_for, final_notice_for, deletion_asked_for')
    .in('status', ['active', 'past_due', 'canceled']).not('plan_id', 'is', null).is('trial_ends_at', null).not('current_period_end', 'is', null)
    .lt('current_period_end', new Date(Date.now() + 2 * 864e5).toISOString()).limit(60);
  if (!subs?.length) return;
  const { data: comps } = await admin.from('companies').select('id, name, slug, is_system').in('id', subs.map((x: any) => x.company_id));
  const byId = new Map((comps ?? []).map((c: any) => [c.id, c]));
  const DAY = 864e5, now = Date.now();
  for (const sub of subs as any[]) {
    const comp: any = byId.get(sub.company_id);
    if (!comp || comp.is_system) continue;
    try {
      const endIso: string = sub.current_period_end, end = new Date(endIso).getTime(), due = end - PERIOD_GRACE_DAYS * DAY;
      const deleteAt = end + 30 * DAY, login = `${SITE_URL}/auth?company=${encodeURIComponent(comp.slug)}`;
      const pendingFrom = due + (sub.provider_subscription_id ? 6 * 3600e3 : 0);
      const acts: string[] = [];
      // 1. Payment pending (from the due date): warning in Pagamentos (the page) + Comunicados + e-mail.
      if (now >= pendingFrom && now < end && sub.pending_notice_for !== endIso) {
        const days = Math.max(1, Math.ceil((end - now) / DAY));
        await notifyCompanyAdmin(sub.company_id, `*Pagamento pendente*\n\nNão identificamos o pagamento do plano da empresa ${comp.name}. Regularize em Pagamentos em até ${days} dia(s) (até ${fmtBR(new Date(end))}). Depois dessa data o acesso de todos os usuários da empresa fica suspenso até o pagamento.`);
        await mailOwner(sub.company_id, 'Pagamento pendente', 'Pagamento pendente', [`Não identificamos o pagamento do plano da empresa <b>${esc(comp.name)}</b>.`, `Regularize em <b>Pagamentos</b> em até <b>${days} dia(s)</b> (até ${fmtBR(new Date(end))}). Depois dessa data o acesso de <b>todos os usuários</b> da empresa fica suspenso até o pagamento ser feito.`], { label: 'Abrir o ewvon', url: login });
        await admin.from('company_subscriptions').update({ pending_notice_for: endIso }).eq('company_id', sub.company_id);
        acts.push('aviso de pendência');
      }
      // 2. Suspended: tell the creator e-mail how to pay and that the data will be deleted in 30 days.
      if (now >= end && sub.suspended_notice_for !== endIso) {
        await mailOwner(sub.company_id, 'Acesso suspenso por pagamento pendente', 'O acesso da empresa foi suspenso', [`O pagamento do plano da empresa <b>${esc(comp.name)}</b> não foi identificado e o acesso de todos os usuários está suspenso.`, `Para liberar tudo de volta, entre no ewvon com este e-mail e faça o pagamento (Pix, boleto ou cartão). Os dados estão guardados e voltam exatamente como estavam.`, `<b>Importante:</b> se o pagamento não for regularizado até <b>${fmtBR(new Date(deleteAt))}</b> (30 dias corridos), todos os dados da empresa serão apagados definitivamente. Antes disso você pode baixar tudo (usuários, tarefas, mensagens e mais) em um arquivo ZIP, entrando com este e-mail.`], { label: 'Pagar e liberar o acesso', url: login });
        await admin.from('company_subscriptions').update({ suspended_notice_for: endIso }).eq('company_id', sub.company_id);
        acts.push('aviso de suspensão');
      }
      // 3. Seven days before the deletion: the ZIP with all the data goes to the creator e-mail only.
      if (now >= deleteAt - 7 * DAY && sub.export_notice_for !== endIso) {
        try {
          const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/company-export`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-billing-cron': await cronSecret() }, body: JSON.stringify({ company_id: sub.company_id, email: true }) });
          if (r.ok) { await mailOwner(sub.company_id, 'Faltam 7 dias para a exclusão dos dados', 'Faltam 7 dias para a exclusão dos dados', [`O pagamento da empresa <b>${esc(comp.name)}</b> continua pendente. Se não for regularizado até <b>${fmtBR(new Date(deleteAt))}</b>, todos os dados serão apagados definitivamente.`, 'Enviamos em outro e-mail o arquivo ZIP com todos os dados (somente para este endereço).'], { label: 'Pagar e liberar o acesso', url: login }); await admin.from('company_subscriptions').update({ export_notice_for: endIso }).eq('company_id', sub.company_id); acts.push('ZIP enviado'); }
          else acts.push('ZIP falhou (' + r.status + ')');
        } catch (e) { acts.push('ZIP erro: ' + (e as Error).message); }
      }
      // 4. The day before.
      if (now >= deleteAt - 1 * DAY && now < deleteAt && sub.final_notice_for !== endIso) {
        await mailOwner(sub.company_id, 'Último dia para regularizar', 'Amanhã os dados da empresa serão apagados', [`Se o pagamento da empresa <b>${esc(comp.name)}</b> não for feito até <b>${fmtBR(new Date(deleteAt))}</b>, todos os dados serão apagados definitivamente.`], { label: 'Pagar e liberar o acesso', url: login });
        await admin.from('company_subscriptions').update({ final_notice_for: endIso }).eq('company_id', sub.company_id);
        acts.push('último aviso');
      }
      // 5. 30 days after the suspension: the super admin gets the card with the two buttons (nothing is deleted here).
      if (now >= deleteAt && sub.deletion_asked_for !== endIso) {
        const sa = await superAdminProfileId();
        if (sa) {
          const [{ count: people }, { data: used }] = await Promise.all([admin.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', comp.id), admin.rpc('company_storage_used', { _company_id: comp.id })]);
          const { data: reqRow, error } = await admin.from('company_deletion_requests').insert({ company_id: comp.id, company_name: comp.name, trial_ends_at: endIso, people: people ?? 0, storage_bytes: Number(used) || 0 }).select('id').single();
          if (error) throw error;
          await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: sa, company_id: ADMIN_COMPANY_ID, content: `*Excluir os dados de ${comp.name}?*\n\nO pagamento da empresa venceu em ${fmtBR(new Date(end))} e já se passaram 30 dias sem regularização. O acesso está suspenso e o ZIP com os dados já foi enviado ao e-mail de criação.\newvon-delete:${reqRow.id}` });
          await admin.from('company_subscriptions').update({ status: 'canceled', deletion_asked_for: endIso }).eq('company_id', sub.company_id);
          acts.push('pedido de exclusão enviado');
        } else acts.push('sem super admin');
      }
      if (acts.length) out['ciclo:' + comp.name] = acts.join(', ');
    } catch (e) { out['ciclo:' + comp.name] = 'erro: ' + (e as Error).message; }
  }
}
async function cronSecret(): Promise<string> {
  const { data } = await admin.rpc('billing_cron_secret_value');
  return String(data || '');
}

// x-signature: "ts=...,v1=..."  ; manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
async function signatureOk(req: Request, dataId: string): Promise<boolean | null> {
  const secret = Deno.env.get('MP_WEBHOOK_SECRET');
  if (!secret) return null;
  const sig = req.headers.get('x-signature') || '';
  const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get('x-request-id') || ''};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return timingSafeEqual(hex(await crypto.subtle.sign('HMAC', key, enc.encode(manifest))), parts.v1);
}

const hits = new Map<string, number[]>();
const limited = (ip: string, max: number) => {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60e3);
  list.push(now); hits.set(ip, list);
  return list.length > max;
};

// ---------- server ----------
Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

  try {
    // ---- public: active plans ----
    if (route === 'plans') {
      const { data } = await admin.from('subscription_plans').select('id, name, description, price_cents, annual_price_cents, max_users, max_sectors, storage_gb, features').eq('is_active', true).order('sort_order');
      return reply({ plans: data ?? [], payments_ready: !!Deno.env.get('MP_ACCESS_TOKEN'), mode: tokenMode() });
    }

    // ---- public: start a signup ----
    if (route === 'signup' && req.method === 'POST') {
      if (limited(ip, 8)) return reply({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);
      if (!Deno.env.get('MP_ACCESS_TOKEN')) return reply({ error: 'Os pagamentos ainda estão sendo configurados. Tente novamente mais tarde.' }, 503);
      const raw = await req.text();
      if (raw.length > 2_000_000) return reply({ error: 'Dados muito grandes (logo até 1MB).' }, 413);
      const body = JSON.parse(raw || '{}');
      const planId = clean(body.plan_id, 40);
      const { data: plan } = await admin.from('subscription_plans').select('id, name, price_cents, annual_price_cents, is_active').eq('id', planId).maybeSingle();
      if (!plan || !plan.is_active) return reply({ error: 'Plano inválido.' }, 400);
      const cycle = (CYCLES as readonly string[]).includes(body.billing_cycle) ? body.billing_cycle as string : 'monthly';
      const amountCents = cycle === 'annual' ? annualCents(plan) : plan.price_cents;
      const cycleLabel = cycle === 'annual' ? 'anual' : cycle === 'once' ? 'mensal avulso' : 'mensal';
      const companyName = clean(body.company?.name, 80);
      const adminName = clean(body.admin?.name, 80);
      const adminEmail = clean(body.admin?.email, 160).toLowerCase();
      const password = body.admin?.password;
      if (companyName.length < 2) return reply({ error: 'Informe o nome da empresa.' }, 400);
      if (!isHex(body.company?.primary_color) || !isHex(body.company?.secondary_color)) return reply({ error: 'Cores inválidas.' }, 400);
      if (adminName.length < 3) return reply({ error: 'Informe o nome do administrador.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminEmail)) return reply({ error: 'Informe um e-mail válido.' }, 400);
      const pe = passwordRuleError(password); if (pe) return reply({ error: pe }, 400);
      const { data: emailUsed } = await admin.from('profiles').select('id').ilike('email', adminEmail).limit(1);
      if (emailUsed?.length) return reply({ error: 'Este e-mail já tem uma conta no ewvon. Use outro e-mail para o administrador.' }, 409);
      // The login e-mail may exist in the authentication service without a profile (leftover): creating the company would then fail after the payment.
      const { data: authUsed } = await admin.rpc('auth_email_exists', { _email: adminEmail });
      if (authUsed === true) return reply({ error: 'Este e-mail já tem uma conta no ewvon. Use outro e-mail para o administrador.' }, 409);
      const { data: openSignup } = await admin.from('company_signups').select('*').ilike('admin_email', adminEmail).in('status', ['pending_payment', 'provisioning', 'failed']).limit(3);
      for (const prior of openSignup ?? []) {
        if (prior.status !== 'pending_payment') return reply({ error: 'Já existe um cadastro com este e-mail em andamento (pagamento confirmado). Aguarde o e-mail com o acesso ou fale com o suporte.' }, 409);
        // Same e-mail starting again: before dropping the previous attempt, make sure it was not paid in the meantime (Pix/boleto confirm later).
        let paid = false;
        try { paid = (await checkSignupPaid(prior)).startsWith('provision'); } catch (e) { console.error('prior check', e); }
        if (paid) return reply({ error: 'O pagamento desse cadastro acabou de ser confirmado. Aguarde o e-mail com o acesso ou fale com o suporte.' }, 409);
        // Superseded (not failed): the encrypted password is kept so a late Pix still creates the company; the database wipes it after the payment window.
        await admin.from('company_signups').update({ status: 'canceled' }).eq('id', prior.id).eq('status', 'pending_payment');
      }
      // Unique slug.
      let slug = slugify(companyName);
      for (let i = 0; i < 5; i++) {
        const { data: taken } = await admin.from('companies').select('id').eq('slug', slug).limit(1);
        const { data: takenSignup } = await admin.from('company_signups').select('id').eq('slug', slug).in('status', ['pending_payment', 'provisioning', 'failed']).limit(1);
        if (!taken?.length && !takenSignup?.length) break;
        slug = `${slugify(companyName).slice(0, 34)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5)}`;
      }
      const token = b64(crypto.getRandomValues(new Uint8Array(24))).replace(/[+/=]/g, '');
      const { data: signup, error: insErr } = await admin.from('company_signups').insert({
        plan_id: plan.id, amount_cents: amountCents, billing_cycle: cycle, company_name: companyName, slug,
        primary_color: body.company.primary_color.toLowerCase(), secondary_color: body.company.secondary_color.toLowerCase(),
        admin_name: adminName, admin_email: adminEmail, password_enc: await encryptSecret(password), status_token_hash: await sha256(token),
      }).select('id').single();
      if (insErr) { console.error(insErr); return reply({ error: 'Não foi possível iniciar o cadastro.' }, 500); }
      // Logo (optional): PNG/JPG/WEBP up to 1MB, stored privately until provisioning.
      const logo = body.company?.logo;
      if (logo?.data && typeof logo.data === 'string') {
        const type = ['image/png', 'image/jpeg', 'image/webp'].includes(logo.type) ? logo.type : null;
        const bytes = type ? unb64(logo.data.replace(/^data:[^,]+,/, '')) : null;
        if (bytes && bytes.length <= 1024 * 1024) {
          const path = `pending/${signup.id}.${type!.split('/')[1].replace('jpeg', 'jpg')}`;
          const { error: upErr } = await admin.storage.from(LOGO_BUCKET).upload(path, bytes, { contentType: type!, upsert: true });
          if (!upErr) await admin.from('company_signups').update({ logo_path: path }).eq('id', signup.id);
        }
      }
      const backUrl = `${SITE_URL}/assinar/retorno?s=${signup.id}&t=${token}`;
      try {
        if (cycle === 'once') {
          // One month paid once (Pix, boleto or card) through Checkout Pro; notifications come to our webhook.
          const pref = await mp('/checkout/preferences', { method: 'POST', body: JSON.stringify({
            items: [{ id: plan.id, title: `ewvon · Plano ${plan.name} · 1 mês`.slice(0, 120), description: companyName.slice(0, 120), quantity: 1, unit_price: amountCents / 100, currency_id: 'BRL' }],
            external_reference: signup.id,
            back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
            auto_return: 'approved',
            notification_url: WEBHOOK_URL,
            statement_descriptor: 'EWVON',
            date_of_expiration: new Date(Date.now() + 6 * 864e5).toISOString(),
          }) });
          await admin.from('company_signups').update({ mp_preference_id: pref.id, checkout_url: pref.init_point }).eq('id', signup.id);
          return reply({ id: signup.id, token, checkout_url: pref.init_point });
        }
        // Subscription plan exclusive to this signup: any Mercado Pago account can subscribe; the
        // resulting subscription is matched back by the plan id.
        const plan_ = await mp('/preapproval_plan', { method: 'POST', body: JSON.stringify({
          reason: `ewvon · Plano ${plan.name} · ${cycleLabel} · ${companyName}`.slice(0, 120),
          back_url: backUrl,
          auto_recurring: { frequency: cycle === 'annual' ? 12 : 1, frequency_type: 'months', transaction_amount: amountCents / 100, currency_id: 'BRL' },
        }) });
        await admin.from('company_signups').update({ mp_plan_id: plan_.id, checkout_url: plan_.init_point }).eq('id', signup.id);
        return reply({ id: signup.id, token, checkout_url: plan_.init_point });
      } catch (e) {
        console.error('checkout', e, (e as any)?.mp);
        await admin.from('company_signups').update({ status: 'canceled', password_enc: null, error: String((e as Error).message).slice(0, 300) }).eq('id', signup.id);
        return reply({ error: 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.' }, 502);
      }
    }

    // ---- company admin: buy add-ons or renew a one-time month ----
    if (route === 'order' && req.method === 'POST') {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
      if (!u?.user) return reply({ error: 'Faça login novamente.' }, 401);
      if (limited(ip + ':o', 20)) return reply({ error: 'Muitas tentativas. Tente em alguns minutos.' }, 429);
      const [{ data: prof }, { data: roles }] = await Promise.all([
        admin.from('profiles').select('company_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
        admin.from('user_roles').select('role').eq('user_id', u.user.id),
      ]);
      const isCompanyAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof?.autonomy_level === 'admin';
      if (!prof?.company_id || !isCompanyAdmin) return reply({ error: 'Somente o administrador da empresa pode fazer compras.' }, 403);
      const { data: comp } = await admin.from('companies').select('id, name, is_system').eq('id', prof.company_id).maybeSingle();
      const { data: sub } = await admin.from('company_subscriptions').select('*').eq('company_id', prof.company_id).maybeSingle();
      if (!comp || comp.is_system || !sub?.plan_id || sub.status === 'exempt') return reply({ error: 'Esta empresa não tem plano pago para fazer compras.' }, 400);
      const body = await req.json().catch(() => ({}));
      const kind = ['extra_users', 'extra_storage', 'once_renewal', 'plan_change', 'regularize'].includes(body?.kind) ? body.kind : null;
      if (kind === 'plan_change') {
        const targetId = clean(body?.plan_id, 40);
        const { data: target } = await admin.from('subscription_plans').select('id, name, price_cents, annual_price_cents, is_active').eq('id', targetId).maybeSingle();
        if (!target?.is_active) return reply({ error: 'Plano indisponível.' }, 400);
        if (target.id === sub.plan_id) return reply({ error: 'A empresa já está neste plano.' }, 400);
        const { data: blocker } = await admin.rpc('plan_change_blocker', { _company_id: comp.id, _plan_id: target.id });
        if (blocker) return reply({ error: blocker }, 400);
        const q = await planChangeQuote(sub, target);
        if (body?.preview) return reply({ ...q, plan_name: target.name });
        if (q.amount_cents < 100) {
          // Downgrade (or almost no time left): change now, the next charge already uses the new price.
          await admin.from('company_subscriptions').update({ plan_id: target.id }).eq('company_id', comp.id);
          const sync = await syncRecurringAmount(comp.id);
          await notifySuperAdmin(`*Mudança de plano*\n\nEmpresa: ${comp.name}\nNovo plano: ${target.name}\nSem cobrança agora · ${sync}`);
          return reply({ applied: true });
        }
        const { data: order, error: oErr } = await admin.from('billing_orders').insert({ company_id: comp.id, kind, quantity: 1, amount_cents: q.amount_cents, target_plan_id: target.id, created_by: u.user.id }).select('id').single();
        if (oErr) return reply({ error: 'Não foi possível criar o pedido.' }, 500);
        const back = `${SITE_URL}/pagamentos?pedido=${order.id}`;
        const pref = await mp('/checkout/preferences', { method: 'POST', body: JSON.stringify({
          items: [{ id: kind, title: `ewvon · Mudança para o plano ${target.name}`.slice(0, 120), description: `${comp.name} · diferença de ${q.days_left} dia(s)`.slice(0, 120), quantity: 1, unit_price: q.amount_cents / 100, currency_id: 'BRL' }],
          external_reference: `order:${order.id}`,
          back_urls: { success: back, pending: back, failure: back },
          auto_return: 'approved',
          notification_url: WEBHOOK_URL,
          statement_descriptor: 'EWVON',
          date_of_expiration: new Date(Date.now() + 6 * 864e5).toISOString(),
        }) });
        await admin.from('billing_orders').update({ mp_preference_id: pref.id, checkout_url: pref.init_point }).eq('id', order.id);
        return reply({ id: order.id, checkout_url: pref.init_point, amount_cents: q.amount_cents });
      }
      const qty = Math.max(1, Math.min(500, Math.floor(Number(body?.quantity) || 1)));
      if (!kind) return reply({ error: 'Pedido inválido.' }, 400);
      if (kind === 'once_renewal' && sub.billing_cycle !== 'once') return reply({ error: 'Sua assinatura renova automaticamente.' }, 400);
      if (kind === 'regularize') {
        // Only when the payment is late (pending or suspended). Once suspended, only the e-mail that created the company may pay/regularize.
        const due = new Date(sub.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5;
        if (!sub.current_period_end || Date.now() < due) return reply({ error: 'Não há pagamento pendente.' }, 400);
        if (Date.now() >= new Date(sub.current_period_end).getTime()) {
          const { data: ownerEmail } = await admin.rpc('company_owner_email', { _cid: comp.id });
          if (!ownerEmail || String(u.user.email || '').toLowerCase() !== String(ownerEmail).toLowerCase()) return reply({ error: 'Somente o e-mail que criou a empresa pode regularizar o pagamento.' }, 403);
        }
      }
      const cfg = await billingSettings();
      const { data: plan } = await admin.from('subscription_plans').select('name, price_cents').eq('id', sub.plan_id).maybeSingle();
      // Add-ons are charged now until the next renewal (whole months), then join the automatic charge.
      const monthsLeft = sub.billing_cycle === 'annual' ? Math.max(1, Math.ceil((new Date(sub.current_period_end || Date.now()).getTime() - Date.now()) / (30 * 864e5))) : 1;
      const unit = kind === 'extra_users' ? cfg.extra_user_cents : kind === 'extra_storage' ? cfg.storage_pack_cents : 0;
      const amount = kind === 'once_renewal' || kind === 'regularize' ? (plan?.price_cents ?? 0) + extrasMonthlyCents(sub, cfg) : unit * qty * monthsLeft;
      if (!amount) return reply({ error: 'Valor inválido.' }, 400);
      const title = kind === 'extra_users' ? `${qty} usuário(s) extra(s)` : kind === 'extra_storage' ? `${qty * cfg.storage_pack_gb} GB de armazenamento extra` : kind === 'regularize' ? `Regularização do pagamento · plano ${plan?.name} (1 mês)` : `Renovação de 1 mês · plano ${plan?.name}`;
      const { data: order, error: oErr } = await admin.from('billing_orders').insert({ company_id: comp.id, kind, quantity: kind === 'once_renewal' || kind === 'regularize' ? 1 : qty, amount_cents: amount, created_by: u.user.id }).select('id').single();
      if (oErr) return reply({ error: 'Não foi possível criar o pedido.' }, 500);
      const back = `${SITE_URL}/pagamentos?pedido=${order.id}`;
      const pref = await mp('/checkout/preferences', { method: 'POST', body: JSON.stringify({
        items: [{ id: kind, title: `ewvon · ${title}`.slice(0, 120), description: comp.name.slice(0, 120), quantity: 1, unit_price: amount / 100, currency_id: 'BRL' }],
        external_reference: `order:${order.id}`,
        back_urls: { success: back, pending: back, failure: back },
        auto_return: 'approved',
        notification_url: WEBHOOK_URL,
        statement_descriptor: 'EWVON',
        date_of_expiration: new Date(Date.now() + 6 * 864e5).toISOString(),
      }) });
      await admin.from('billing_orders').update({ mp_preference_id: pref.id, checkout_url: pref.init_point }).eq('id', order.id);
      return reply({ id: order.id, checkout_url: pref.init_point, amount_cents: amount, months: monthsLeft });
    }

    // ---- public: status (needs the private token) ----
    if (route === 'status' && req.method === 'POST') {
      if (limited(ip + ':s', 120)) return reply({ error: 'Muitas consultas.' }, 429);
      const { id, token } = await req.json().catch(() => ({}));
      if (typeof id !== 'string' || typeof token !== 'string') return reply({ error: 'Dados inválidos' }, 400);
      const { data: s } = await admin.from('company_signups').select('*').eq('id', id).maybeSingle();
      if (!s || !timingSafeEqual(s.status_token_hash, await sha256(token))) return reply({ error: 'Cadastro não encontrado' }, 404);
      // When the visitor comes back from the checkout, confirm right away instead of waiting the webhook.
      if (s.status === 'pending_payment' && (s.preapproval_id || s.mp_plan_id || s.mp_preference_id) && Date.now() - new Date(s.updated_at).getTime() > 4000) {
        await admin.from('company_signups').update({ updated_at: new Date().toISOString() }).eq('id', s.id);
        try { await checkSignupPaid(s); } catch (e) { console.error('status check', e); }
      }
      const { data: now } = await admin.from('company_signups').select('status, company_name, slug, admin_email, checkout_url, error').eq('id', id).maybeSingle();
      return reply({ refused: now?.status === 'pending_payment' && /recusad/i.test(now?.error || ''), status: now?.status, company_name: now?.company_name, slug: now?.status === 'active' ? now.slug : null, admin_email: now?.admin_email, checkout_url: now?.status === 'pending_payment' ? now.checkout_url : null });
    }

    // ---- Mercado Pago notifications ----
    if (route === 'webhook') {
      const url = new URL(req.url);
      const body = await req.json().catch(() => ({}));
      const topic = String(body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
      const dataId = String(body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
      if (!topic || !dataId || !/^[\w-]{1,64}$/.test(dataId)) return reply({ ok: true });
      const sigOk = await signatureOk(req, dataId);
      // A bad signature is only recorded: nothing in the body is trusted, every resource is re-fetched.
      let result = 'ignorado';
      if (topic === 'subscription_authorized_payment' || topic === 'authorized_payment') {
        const ap = await mp(`/authorized_payments/${encodeURIComponent(dataId)}`);
        const preId = String(ap.preapproval_id || '');
        const status = String(ap?.payment?.status || '');
        let { data: s } = await admin.from('company_signups').select('*').eq('preapproval_id', preId).maybeSingle();
        if (!s && preId) { const pre = await mp(`/preapproval/${encodeURIComponent(preId)}`); if (pre?.preapproval_plan_id) ({ data: s } = await admin.from('company_signups').select('*').eq('mp_plan_id', pre.preapproval_plan_id).maybeSingle()); }
        const { data: seen } = await admin.from('payment_events').select('id').eq('provider', 'mercadopago').eq('resource_id', dataId).eq('result', 'renovada').limit(1);
        if (s && s.status !== 'active') result = status === 'approved' ? await checkSignupPaid(s) : `primeiro pagamento: ${status}`;
        else if (s && String(ap?.payment?.id || '') === String(s.last_payment_id || '')) result = 'primeiro pagamento já aplicado';
        else if (seen?.length) result = 'já processado';
        else result = await applyRecurring(preId, status, Number(ap.transaction_amount || 0), String(ap?.payment?.id || ''));
      } else if (topic === 'payment') {
        const pay = await mp(`/v1/payments/${encodeURIComponent(dataId)}`);
        if (['refunded', 'charged_back', 'cancelled'].includes(String(pay?.status))) {
          // A payment we already counted was refunded or disputed: flag the company and warn the super admin (access is not removed automatically).
          const { data: cp } = await admin.from('company_payments').select('company_id, kind, amount_cents').eq('provider', 'mercadopago').eq('provider_payment_id', String(pay.id)).maybeSingle();
          if (cp) {
            if (['signup', 'renewal', 'once_renewal'].includes(cp.kind)) await admin.from('company_subscriptions').update({ status: 'past_due' }).eq('company_id', cp.company_id).eq('status', 'active');
            const { data: c } = await admin.from('companies').select('name').eq('id', cp.company_id).maybeSingle();
            await notifySuperAdmin(`*Pagamento ${pay.status === 'charged_back' ? 'contestado (chargeback)' : pay.status === 'refunded' ? 'devolvido' : 'cancelado'}*\n\nEmpresa: ${c?.name || cp.company_id}\nValor: ${brl(cp.amount_cents)} (${cp.kind})\nPagamento: ${pay.id}\nA assinatura da empresa foi marcada como "Pagamento pendente". Decida se mantém ou encerra o acesso.`);
            await admin.from('payment_events').insert({ provider: 'mercadopago', topic, resource_id: dataId, signature_ok: sigOk, result: ('pagamento ' + pay.status + ' registrado').slice(0, 200) });
            return reply({ ok: true });
          }
        }
        const orderRef = typeof pay?.external_reference === 'string' && /^order:[0-9a-f-]{36}$/.test(pay.external_reference) ? pay.external_reference.slice(6) : null;
        if (orderRef) {
          result = await applyOrder(orderRef, pay);
          await admin.from('payment_events').insert({ provider: 'mercadopago', topic, resource_id: dataId, signature_ok: sigOk, result: result.slice(0, 200) });
          return reply({ ok: true });
        }
        const ref = typeof pay?.external_reference === 'string' && /^[0-9a-f-]{36}$/.test(pay.external_reference) ? pay.external_reference : null;
        const { data: s } = ref ? await admin.from('company_signups').select('*').eq('id', ref).maybeSingle() : { data: null };
        if (s && s.billing_cycle === 'once' && s.status !== 'active') result = await checkOncePaid(s);
        else if (s) result = 'pagamento de cadastro já ativo';
      } else if (topic === 'subscription_preapproval' || topic === 'preapproval') {
        const pre = await mp(`/preapproval/${encodeURIComponent(dataId)}`);
        let { data: s } = await admin.from('company_signups').select('*').eq('preapproval_id', dataId).maybeSingle();
        if (!s && pre?.preapproval_plan_id) ({ data: s } = await admin.from('company_signups').select('*').eq('mp_plan_id', pre.preapproval_plan_id).maybeSingle());
        if (s && s.status !== 'active') result = await checkSignupPaid(s);
        else if (s && s.preapproval_id && s.preapproval_id !== dataId && ['authorized', 'pending'].includes(pre.status)) {
          // Same signup link used again after the company was created: cancel only this duplicate.
          try { await mp(`/preapproval/${encodeURIComponent(dataId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }); } catch (e) { console.error('cancel duplicate', e); }
          await notifySuperAdmin(`*Assinatura duplicada cancelada*\n\nO link de assinatura de ${s.company_name} foi usado de novo. A assinatura extra ${dataId} foi cancelada. Se houve cobrança, devolva pelo Mercado Pago.`);
          result = 'duplicada cancelada';
        } else if (pre.status === 'cancelled' || pre.status === 'paused') {
          await admin.from('company_subscriptions').update({ status: pre.status === 'cancelled' ? 'canceled' : 'past_due' }).eq('provider', 'mercadopago').eq('provider_subscription_id', dataId);
          result = 'assinatura ' + pre.status;
        }
      }
      await admin.from('payment_events').insert({ provider: 'mercadopago', topic, resource_id: dataId, signature_ok: sigOk, result: result.slice(0, 200) });
      return reply({ ok: true });
    }

    // ---- self-test (Vault secret only): provisions a throwaway company like a confirmed payment,
    //      checks every piece (including the admin login) and removes everything. ----
    if (route === 'selftest') {
      const { data: secretOk } = await admin.rpc('billing_cron_secret_ok', { _secret: req.headers.get('x-billing-cron') || '' });
      if (secretOk !== true) return reply({ error: 'Unauthorized' }, 401);
      const tag = crypto.randomUUID().slice(0, 8);
      const email = `selftest-${tag}@ewvon.invalid`;
      const password = `Teste@${tag}A1`;
      const report: Record<string, unknown> = {};
      let userId: string | null = null, companyId: string | null = null, signupId: string | null = null;
      try {
        const { data: plan } = await admin.from('subscription_plans').select('id, price_cents').eq('is_active', true).order('sort_order').limit(1).single();
        const { data: sg, error: e1 } = await admin.from('company_signups').insert({ plan_id: plan!.id, amount_cents: plan!.price_cents, company_name: `Teste automático ${tag}`, slug: `selftest-${tag}`, primary_color: '#111111', secondary_color: '#6366f1', admin_name: 'Teste Automatico', admin_email: email, password_enc: await encryptSecret(password), status_token_hash: await sha256(tag), preapproval_id: `selftest-${tag}`, paid_at: new Date().toISOString() }).select('id').single();
        if (e1) throw e1;
        signupId = sg.id;
        report.provision = await provision(sg.id, true);
        report.second_call_idempotent = await provision(sg.id, true);
        const { data: after } = await admin.from('company_signups').select('status, password_enc, company_id').eq('id', sg.id).single();
        companyId = after?.company_id ?? null;
        report.signup_active = after?.status === 'active';
        report.password_wiped = after?.password_enc === null;
        const { data: sub } = await admin.from('company_subscriptions').select('status, plan_id, provider').eq('company_id', companyId).maybeSingle();
        report.subscription_active = sub?.status === 'active' && sub?.provider === 'mercadopago';
        const { data: prof } = await admin.from('profiles').select('user_id, company_id, autonomy_level, is_active').ilike('email', email).maybeSingle();
        userId = prof?.user_id ?? null;
        report.admin_profile_ok = prof?.company_id === companyId && prof?.autonomy_level === 'admin' && prof?.is_active === true;
        const { data: role } = await admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
        report.admin_role_ok = !!role;
        const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
        const { data: login, error: le } = await anon.auth.signInWithPassword({ email, password });
        report.admin_login_ok = !!login?.session && !le;
      } catch (e) { report.error = e instanceof Error ? e.message : String(e); }
      finally {
        if (userId) { await admin.from('user_permissions').delete().eq('user_id', userId); await admin.from('user_roles').delete().eq('user_id', userId); await admin.from('profiles').delete().eq('user_id', userId); await admin.auth.admin.deleteUser(userId); }
        if (signupId) await admin.from('company_signups').delete().eq('id', signupId);
        if (companyId) { await admin.from('sectors').delete().eq('company_id', companyId); await admin.from('company_payments').delete().eq('company_id', companyId); await admin.from('company_subscriptions').delete().eq('company_id', companyId); const { error: delErr } = await admin.from('companies').delete().eq('id', companyId); if (delErr) report.cleanup_error = delErr.message; }
        report.cleaned = true;
      }
      return reply(report);
    }

    // ---- reconciliation: hourly cron or super admin ----
    if (route === 'reconcile') {
      const cronSecret = req.headers.get('x-billing-cron') || '';
      let allowed = false;
      if (cronSecret) { const { data } = await admin.rpc('billing_cron_secret_ok', { _secret: cronSecret }); allowed = data === true; }
      if (!allowed) {
        const tokenUser = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        const { data: u } = tokenUser ? await admin.auth.getUser(tokenUser) : { data: { user: null } } as any;
        if (u?.user) { const { data: r } = await admin.from('user_roles').select('role').eq('user_id', u.user.id).eq('role', 'super_admin').maybeSingle(); allowed = !!r; }
      }
      if (!allowed) return reply({ error: 'Unauthorized' }, 401);
      const out: Record<string, string> = {};
      // Expire unpaid signups after 3 days (wipes the encrypted password).
      await admin.from('company_signups').update({ status: 'expired', password_enc: null }).eq('status', 'pending_payment').neq('billing_cycle', 'once').lt('created_at', new Date(Date.now() - 3 * 864e5).toISOString());
      await admin.from('company_signups').update({ status: 'expired', password_enc: null }).eq('status', 'pending_payment').eq('billing_cycle', 'once').lt('created_at', new Date(Date.now() - 12 * 864e5).toISOString());
      // Superseded/closed attempts keep their encrypted password only for the payment window (12 days), then it is wiped.
      await admin.from('company_signups').update({ password_enc: null }).in('status', ['canceled', 'expired']).not('password_enc', 'is', null).lt('created_at', new Date(Date.now() - 13 * 864e5).toISOString());
      const { data: open } = await admin.from('company_signups').select('*').in('status', ['pending_payment', 'failed']).lt('attempts', 8).order('created_at').limit(40);
      for (const s of open ?? []) {
        try { out[s.id] = s.status === 'failed' && s.paid_at ? ((await provision(s.id)).ok ? 'provisionada' : 'falhou de novo') : await checkSignupPaid(s); }
        catch (e) { out[s.id] = 'erro: ' + (e as Error).message; }
      }
      // Add-on orders and one-time renewals waiting for payment (up to 12 days, boleto included).
      await admin.from('billing_orders').update({ status: 'canceled' }).eq('status', 'pending').lt('created_at', new Date(Date.now() - 12 * 864e5).toISOString());
      const { data: orders } = await admin.from('billing_orders').select('id').eq('status', 'pending').not('mp_preference_id', 'is', null).limit(40);
      for (const o of orders ?? []) {
        try {
          const found = await mp(`/v1/payments/search?external_reference=${encodeURIComponent('order:' + o.id)}&sort=date_created&criteria=desc`);
          const pay = (found?.results || []).find((p: any) => p?.status === 'approved');
          out['order:' + o.id] = pay ? await applyOrder(o.id, pay) : 'pedido aguardando';
        } catch (e) { out['order:' + o.id] = 'erro: ' + (e as Error).message; }
      }
      // Provisioning stuck for more than 15 minutes (function crashed mid-way) -> retry.
      const { data: stuck } = await admin.from('company_signups').select('id').eq('status', 'provisioning').lt('updated_at', new Date(Date.now() - 15 * 60e3).toISOString());
      for (const s of stuck ?? []) { await admin.from('company_signups').update({ status: 'failed' }).eq('id', s.id).eq('status', 'provisioning'); out[s.id] = ((await provision(s.id)).ok ? 'retomada' : 'falhou'); }
      // Renewals that never reached us (lost notification): check Mercado Pago once an hour.
      if (new Date().getUTCMinutes() < 5 || new URL(req.url).searchParams.get('force') === '1') { try { await reconcileRenewals(out); } catch (e) { out.renovacoes = 'erro: ' + (e as Error).message; } }
      if (new Date().getUTCMinutes() < 5 || new URL(req.url).searchParams.get('force') === '1') { try { await reconcileLifecycle(out); } catch (e) { out.ciclo = 'erro: ' + (e as Error).message; } }
      try { await sendReminders(out); } catch (e) { out.lembretes = 'erro: ' + (e as Error).message; }
      out.capacidade = await checkSystemCapacity();
      return reply({ ok: true, checked: out });
    }

    return reply({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('billing error', e);
    const status = (e as any)?.status || 500;
    return reply({ error: status === 503 ? 'Os pagamentos ainda estão sendo configurados.' : 'Erro interno. Tente novamente.' }, status);
  }
});
