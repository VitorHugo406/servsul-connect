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

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const MP_API = 'https://api.mercadopago.com';
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
const LOGO_BUCKET = 'company-logos';
const PERIOD_GRACE_DAYS = 3;

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
      const { data: c, error } = await admin.from('companies').insert({ name: s.company_name, slug: s.slug, primary_color: s.primary_color, secondary_color: s.secondary_color, is_active: true }).select('id').single();
      if (error) throw new Error('Empresa: ' + error.message);
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
    const periodEnd = new Date(Date.now() + (31 + PERIOD_GRACE_DAYS) * 864e5).toISOString();
    const { error: subErr } = await admin.from('company_subscriptions').upsert({ company_id: companyId, plan_id: s.plan_id, status: 'active', provider: 'mercadopago', provider_subscription_id: s.preapproval_id, current_period_end: periodEnd }, { onConflict: 'company_id' });
    if (subErr) throw new Error('Assinatura: ' + subErr.message);
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
    await admin.from('user_permissions').upsert({ user_id: userId, can_post_announcements: true, can_delete_messages: true, can_access_management: true, can_access_password_change: true, can_create_war_room: true, can_access_bh: true, can_access_fechamento: true, can_access_orbs: true, can_access_meeting_rooms: true }, { onConflict: 'user_id' });
    // 5. Done: wipe the encrypted password.
    await admin.from('company_signups').update({ status: 'active', activated_at: new Date().toISOString(), password_enc: null, error: null, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (!silent) await notifySuperAdmin(`*Nova empresa assinante*\n\nEmpresa: ${s.company_name}\nPlano: ${s.plan_id}\nAdministrador: ${s.admin_name} (${s.admin_email})\nAssinatura Mercado Pago: ${s.preapproval_id}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('provision failed', s.id, msg);
    await admin.from('company_signups').update({ status: 'failed', error: msg.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', s.id);
    if ((s.attempts || 0) === 0 || (s.attempts || 0) >= 5) await notifySuperAdmin(`*Falha ao criar empresa paga*\n\nEmpresa: ${s.company_name}\nE-mail: ${s.admin_email}\nErro: ${msg}\n\nO sistema tenta de novo a cada hora.`);
    return { ok: false, error: msg };
  }
}

// Confirms a payment for a signup straight from Mercado Pago and provisions when approved.
async function checkSignupPaid(s: any): Promise<string> {
  if (!s.preapproval_id) return 'sem assinatura';
  const pre = await mp(`/preapproval/${encodeURIComponent(s.preapproval_id)}`);
  if (pre.external_reference !== s.id) return 'referência divergente';
  if (pre.status === 'cancelled') { await admin.from('company_signups').update({ status: 'canceled', password_enc: null }).eq('id', s.id).eq('status', 'pending_payment'); return 'cancelada'; }
  const search = await mp(`/authorized_payments/search?preapproval_id=${encodeURIComponent(s.preapproval_id)}`);
  const approved = (search?.results || []).find((p: any) => p?.payment?.status === 'approved' && Math.round(Number(p?.transaction_amount) * 100) >= s.amount_cents);
  if (!approved) return `aguardando (${pre.status})`;
  await admin.from('company_signups').update({ last_payment_id: String(approved.payment?.id || approved.id), paid_at: s.paid_at || new Date().toISOString() }).eq('id', s.id);
  const r = await provision(s.id);
  return r.ok ? 'provisionada' : 'falha: ' + r.error;
}

// Recurring charges for an active company.
async function applyRecurring(preapprovalId: string, paymentStatus: string, amount: number) {
  const { data: sub } = await admin.from('company_subscriptions').select('company_id, plan_id, current_period_end').eq('provider', 'mercadopago').eq('provider_subscription_id', preapprovalId).maybeSingle();
  if (!sub) return 'assinatura não vinculada';
  if (paymentStatus === 'approved') {
    const { data: plan } = await admin.from('subscription_plans').select('price_cents').eq('id', sub.plan_id).maybeSingle();
    if (plan && Math.round(amount * 100) < plan.price_cents) return 'valor abaixo do plano';
    const base = Math.max(Date.now(), new Date(sub.current_period_end || 0).getTime() - PERIOD_GRACE_DAYS * 864e5);
    await admin.from('company_subscriptions').update({ status: 'active', current_period_end: new Date(base + (31 + PERIOD_GRACE_DAYS) * 864e5).toISOString() }).eq('company_id', sub.company_id);
    return 'renovada';
  }
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(paymentStatus)) {
    await admin.from('company_subscriptions').update({ status: 'past_due' }).eq('company_id', sub.company_id);
    return 'pagamento recusado';
  }
  return 'ignorado';
}

// x-signature: "ts=...,v1=..." ; manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
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
      const { data } = await admin.from('subscription_plans').select('id, name, description, price_cents, max_users, max_sectors, storage_gb, features').eq('is_active', true).order('sort_order');
      return reply({ plans: data ?? [], payments_ready: !!Deno.env.get('MP_ACCESS_TOKEN') });
    }

    // ---- public: start a signup ----
    if (route === 'signup' && req.method === 'POST') {
      if (limited(ip, 8)) return reply({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, 429);
      if (!Deno.env.get('MP_ACCESS_TOKEN')) return reply({ error: 'Os pagamentos ainda estão sendo configurados. Tente novamente mais tarde.' }, 503);
      const raw = await req.text();
      if (raw.length > 2_000_000) return reply({ error: 'Dados muito grandes (logo até 1MB).' }, 413);
      const body = JSON.parse(raw || '{}');
      const planId = clean(body.plan_id, 40);
      const { data: plan } = await admin.from('subscription_plans').select('id, name, price_cents, is_active').eq('id', planId).maybeSingle();
      if (!plan || !plan.is_active) return reply({ error: 'Plano inválido.' }, 400);
      const companyName = clean(body.company?.name, 80);
      const adminName = clean(body.admin?.name, 80);
      const adminEmail = clean(body.admin?.email, 160).toLowerCase();
      const password = body.admin?.password;
      const payerEmail = clean(body.payer_email || body.admin?.email, 160).toLowerCase();
      if (companyName.length < 2) return reply({ error: 'Informe o nome da empresa.' }, 400);
      if (!isHex(body.company?.primary_color) || !isHex(body.company?.secondary_color)) return reply({ error: 'Cores inválidas.' }, 400);
      if (adminName.length < 3) return reply({ error: 'Informe o nome do administrador.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminEmail)) return reply({ error: 'Informe um e-mail válido.' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payerEmail)) return reply({ error: 'Informe o e-mail da conta Mercado Pago que fará o pagamento.' }, 400);
      const pe = passwordRuleError(password); if (pe) return reply({ error: pe }, 400);
      const { data: emailUsed } = await admin.from('profiles').select('id').ilike('email', adminEmail).limit(1);
      if (emailUsed?.length) return reply({ error: 'Este e-mail já tem uma conta no ewvon. Use outro e-mail para o administrador.' }, 409);
      const { data: openSignup } = await admin.from('company_signups').select('id').ilike('admin_email', adminEmail).in('status', ['pending_payment', 'provisioning', 'failed']).limit(1);
      if (openSignup?.length) {
        // Same e-mail starting again: cancel the previous unpaid attempt.
        await admin.from('company_signups').update({ status: 'canceled', password_enc: null }).eq('id', openSignup[0].id).eq('status', 'pending_payment');
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
        plan_id: plan.id, amount_cents: plan.price_cents, company_name: companyName, slug,
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
      // Mercado Pago subscription (first charge happens on checkout).
      try {
        const pre = await mp('/preapproval', { method: 'POST', body: JSON.stringify({
          reason: `ewvon · Plano ${plan.name} · ${companyName}`.slice(0, 120),
          external_reference: signup.id,
          payer_email: payerEmail,
          back_url: `${SITE_URL}/assinar/retorno?s=${signup.id}&t=${token}`,
          auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.price_cents / 100, currency_id: 'BRL' },
          status: 'pending',
        }) });
        await admin.from('company_signups').update({ preapproval_id: pre.id, checkout_url: pre.init_point }).eq('id', signup.id);
        return reply({ id: signup.id, token, checkout_url: pre.init_point });
      } catch (e) {
        console.error('preapproval', e, (e as any)?.mp);
        await admin.from('company_signups').update({ status: 'canceled', password_enc: null, error: String((e as Error).message).slice(0, 300) }).eq('id', signup.id);
        const payerProblem = /payer|collector|email/i.test(String((e as Error).message));
        return reply({ error: payerProblem ? 'O Mercado Pago não aceitou o e-mail do pagador. Use o e-mail da conta Mercado Pago que vai pagar a assinatura.' : 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.' }, payerProblem ? 400 : 502);
      }
    }

    // ---- public: status (needs the private token) ----
    if (route === 'status' && req.method === 'POST') {
      if (limited(ip + ':s', 120)) return reply({ error: 'Muitas consultas.' }, 429);
      const { id, token } = await req.json().catch(() => ({}));
      if (typeof id !== 'string' || typeof token !== 'string') return reply({ error: 'Dados inválidos' }, 400);
      const { data: s } = await admin.from('company_signups').select('*').eq('id', id).maybeSingle();
      if (!s || !timingSafeEqual(s.status_token_hash, await sha256(token))) return reply({ error: 'Cadastro não encontrado' }, 404);
      // When the visitor comes back from the checkout, confirm right away instead of waiting the webhook.
      if (s.status === 'pending_payment' && s.preapproval_id && Date.now() - new Date(s.updated_at).getTime() > 4000) {
        await admin.from('company_signups').update({ updated_at: new Date().toISOString() }).eq('id', s.id);
        try { await checkSignupPaid(s); } catch (e) { console.error('status check', e); }
      }
      const { data: now } = await admin.from('company_signups').select('status, company_name, slug, admin_email, checkout_url').eq('id', id).maybeSingle();
      return reply({ status: now?.status, company_name: now?.company_name, slug: now?.status === 'active' ? now.slug : null, admin_email: now?.admin_email, checkout_url: now?.status === 'pending_payment' ? now.checkout_url : null });
    }

    // ---- Mercado Pago notifications ----
    if (route === 'webhook') {
      const url = new URL(req.url);
      const body = await req.json().catch(() => ({}));
      const topic = String(body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic') || '');
      const dataId = String(body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
      if (!topic || !dataId || !/^[\w-]{1,64}$/.test(dataId)) return reply({ ok: true });
      const sigOk = await signatureOk(req, dataId);
      if (sigOk === false) { await admin.from('payment_events').insert({ provider: 'mercadopago', topic, resource_id: dataId, signature_ok: false, result: 'assinatura inválida' }); return reply({ error: 'invalid signature' }, 401); }
      let result = 'ignorado';
      if (topic === 'subscription_authorized_payment' || topic === 'authorized_payment') {
        const ap = await mp(`/authorized_payments/${encodeURIComponent(dataId)}`);
        const preId = String(ap.preapproval_id || '');
        const status = String(ap?.payment?.status || '');
        const { data: s } = await admin.from('company_signups').select('*').eq('preapproval_id', preId).maybeSingle();
        const { data: seen } = await admin.from('payment_events').select('id').eq('provider', 'mercadopago').eq('resource_id', dataId).eq('result', 'renovada').limit(1);
        if (s && s.status !== 'active') result = status === 'approved' ? await checkSignupPaid(s) : `primeiro pagamento: ${status}`;
        else if (s && String(ap?.payment?.id || '') === String(s.last_payment_id || '')) result = 'primeiro pagamento já aplicado';
        else if (seen?.length) result = 'já processado';
        else result = await applyRecurring(preId, status, Number(ap.transaction_amount || 0));
      } else if (topic === 'subscription_preapproval' || topic === 'preapproval') {
        const pre = await mp(`/preapproval/${encodeURIComponent(dataId)}`);
        const { data: s } = await admin.from('company_signups').select('*').eq('preapproval_id', dataId).maybeSingle();
        if (s && s.status !== 'active') result = await checkSignupPaid(s);
        else if (pre.status === 'cancelled' || pre.status === 'paused') {
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
        if (companyId) await admin.from('companies').delete().eq('id', companyId);
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
      await admin.from('company_signups').update({ status: 'expired', password_enc: null }).eq('status', 'pending_payment').lt('created_at', new Date(Date.now() - 3 * 864e5).toISOString());
      const { data: open } = await admin.from('company_signups').select('*').in('status', ['pending_payment', 'failed']).lt('attempts', 8).order('created_at').limit(40);
      for (const s of open ?? []) {
        try { out[s.id] = s.status === 'failed' && s.paid_at ? ((await provision(s.id)).ok ? 'provisionada' : 'falhou de novo') : await checkSignupPaid(s); }
        catch (e) { out[s.id] = 'erro: ' + (e as Error).message; }
      }
      // Provisioning stuck for more than 15 minutes (function crashed mid-way) -> retry.
      const { data: stuck } = await admin.from('company_signups').select('id').eq('status', 'provisioning').lt('updated_at', new Date(Date.now() - 15 * 60e3).toISOString());
      for (const s of stuck ?? []) { await admin.from('company_signups').update({ status: 'failed' }).eq('id', s.id).eq('status', 'provisioning'); out[s.id] = ((await provision(s.id)).ok ? 'retomada' : 'falhou'); }
      return reply({ ok: true, checked: out });
    }

    return reply({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('billing error', e);
    const status = (e as any)?.status || 500;
    return reply({ error: status === 503 ? 'Os pagamentos ainda estão sendo configurados.' : 'Erro interno. Tente novamente.' }, status);
  }
});
