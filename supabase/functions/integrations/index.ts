// Company integrations: Slack, Microsoft Teams (Workflows webhook) and WhatsApp Cloud API.
//
// Routes (verify_jwt = false; each route authenticates itself):
//   POST /integrations/save      company admin: { provider, enabled, events, config, secret? } (secret is encrypted)
//   POST /integrations/remove    company admin: { provider }
//   POST /integrations/test      company admin: { provider, to? } sends a test message
//   POST /integrations/dispatch  database triggers (Vault secret header): { company_id, event, ref }
// Secrets are AES-GCM encrypted with a key derived from the service role key; the app can never read them.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const PROVIDERS = ['slack', 'teams', 'whatsapp'] as const;
const EVENTS = ['announcement', 'important', 'task_assigned', 'meeting'] as const;
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

let keyP: Promise<CryptoKey> | null = null;
const key = () => (keyP ??= (async () => {
  const base = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('ewvon-integrations'), info: enc.encode('secret-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
})());
async function seal(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), enc.encode(plain)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return 'v1:' + b64(out);
}
async function open(stored: string) {
  const raw = unb64(stored.replace(/^v1:/, ''));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, await key(), raw.slice(12)));
}

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const clip = (s: unknown, n: number) => { const t = String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const phoneDigits = (p: unknown) => { let d = String(p ?? '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d.length >= 12 && d.length <= 15 ? d : null; };
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Msg = { title: string; text: string; url: string; whatsappTo?: string[] };

// Builds the message from the database (the trigger only sends ids).
async function buildMessage(companyId: string, event: string, ref: string): Promise<Msg | null> {
  if (event === 'announcement') {
    const { data: a } = await admin.from('announcements').select('title, content, company_id, author_id').eq('id', ref).maybeSingle();
    if (!a || a.company_id !== companyId) return null;
    const { data: au } = a.author_id ? await admin.from('profiles').select('name').eq('id', a.author_id).maybeSingle() : { data: null };
    const { data: people } = await admin.from('profiles').select('phone').eq('company_id', companyId).eq('is_active', true).not('phone', 'is', null).limit(300);
    return { title: `Novo aviso: ${clip(a.title, 120)}`, text: clip(a.content, 600) + (au?.name ? `\n— ${au.name}` : ''), url: `${SITE_URL}/avisos`, whatsappTo: (people ?? []).map((p: any) => phoneDigits(p.phone)).filter(Boolean) as string[] };
  }
  if (event === 'important') {
    const { data: a } = await admin.from('important_announcements').select('title, content, company_id').eq('id', ref).maybeSingle();
    if (!a || a.company_id !== companyId) return null;
    const { data: people } = await admin.from('profiles').select('phone').eq('company_id', companyId).eq('is_active', true).not('phone', 'is', null).limit(300);
    return { title: `Comunicado importante: ${clip(a.title, 120)}`, text: clip(a.content, 600), url: `${SITE_URL}/comunicados-importantes`, whatsappTo: (people ?? []).map((p: any) => phoneDigits(p.phone)).filter(Boolean) as string[] };
  }
  if (event === 'task_assigned') {
    const { data: t } = await admin.from('tasks').select('task_number, title, assigned_to, due_date, board_id, company_id').eq('id', ref).maybeSingle();
    if (!t || t.company_id !== companyId || !t.assigned_to) return null;
    const [{ data: who }, { data: board }] = await Promise.all([
      admin.from('profiles').select('name, phone').eq('id', t.assigned_to).maybeSingle(),
      t.board_id ? admin.from('task_boards').select('name').eq('id', t.board_id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    const due = t.due_date ? ` · prazo ${fmtWhen(t.due_date)}` : '';
    const phone = phoneDigits(who?.phone);
    return { title: `Card #${t.task_number ?? ''} atribuído a ${who?.name || 'alguém'}`, text: `${clip(t.title, 200)}${board?.name ? ` (mural ${clip(board.name, 60)})` : ''}${due}`, url: `${SITE_URL}/tarefas`, whatsappTo: phone ? [phone] : [] };
  }
  if (event === 'meeting') {
    const { data: e } = await admin.from('calendar_events').select('title, start_date, end_date, meeting_link, company_id').eq('id', ref).maybeSingle();
    if (!e || e.company_id !== companyId) return null;
    return { title: `Reunião marcada: ${clip(e.title, 120)}`, text: `${fmtWhen(e.start_date)}${e.end_date ? ' até ' + fmtWhen(e.end_date).split(' ').pop() : ''}${e.meeting_link ? `\nLink: ${e.meeting_link}` : ''}`, url: `${SITE_URL}/calendario` };
  }
  return null;
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const txt = await r.text().catch(() => '');
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
  return txt;
}

// Sends one message through one integration. Returns a short status text.
async function deliver(row: any, msg: Msg, testTo?: string): Promise<string> {
  const secret = await open(row.secret_enc);
  if (row.provider === 'slack') {
    await post(secret, { text: `*${msg.title}*\n${msg.text}\n<${msg.url}|Abrir no ewvon>` });
    return 'enviado ao Slack';
  }
  if (row.provider === 'teams') {
    await post(secret, { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
      body: [{ type: 'TextBlock', text: msg.title, weight: 'Bolder', size: 'Medium', wrap: true }, { type: 'TextBlock', text: msg.text, wrap: true }],
      actions: [{ type: 'Action.OpenUrl', title: 'Abrir no ewvon', url: msg.url }],
    } }] });
    return 'enviado ao Teams';
  }
  // WhatsApp Cloud API: business-initiated messages must use an approved template with one body variable.
  const cfg = row.config || {};
  const to = testTo ? [phoneDigits(testTo)].filter(Boolean) as string[] : [...new Set(msg.whatsappTo ?? [])];
  if (!to.length) return 'sem destinatário com telefone';
  const param = clip(`${msg.title}: ${msg.text.replace(/\n+/g, ' · ')}`, 900);
  let sent = 0; let lastErr = '';
  for (const n of to.slice(0, 300)) {
    try {
      await post(`https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phone_number_id)}/messages`, {
        messaging_product: 'whatsapp', to: n, type: 'template',
        template: { name: cfg.template_name, language: { code: cfg.language || 'pt_BR' }, components: [{ type: 'body', parameters: [{ type: 'text', text: param }] }] },
      }, { Authorization: `Bearer ${secret}` });
      sent++;
    } catch (e) { lastErr = (e as Error).message; }
  }
  if (!sent && lastErr) throw new Error(lastErr);
  return `WhatsApp: ${sent} de ${to.length} enviado(s)${lastErr ? ' · último erro: ' + lastErr.slice(0, 120) : ''}`;
}

async function companyAdmin(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
  if (!u?.user) return null;
  const [{ data: prof }, { data: roles }] = await Promise.all([
    admin.from('profiles').select('company_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
    admin.from('user_roles').select('role').eq('user_id', u.user.id),
  ]);
  const ok = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof?.autonomy_level === 'admin';
  return ok && prof?.company_id ? { userId: u.user.id, companyId: prof.company_id as string } : null;
}

function validate(provider: string, config: any, secret: string | undefined): string | null {
  if (provider === 'slack' && secret !== undefined && !/^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/.test(secret)) return 'Use o link de Incoming Webhook do Slack (começa com https://hooks.slack.com/services/).';
  if (provider === 'teams' && secret !== undefined) {
    let host = ''; try { const u = new URL(secret); host = u.protocol === 'https:' ? u.hostname : ''; } catch { /* invalid */ }
    if (!/(\.logic\.azure\.com|\.webhook\.office\.com|\.powerplatform\.com|\.environment\.api\.powerplatform\.com)$/.test(host)) return 'Use o link do fluxo "Postar em um canal quando uma solicitação de webhook for recebida" do Teams (Workflows).';
  }
  if (provider === 'whatsapp') {
    if (!/^\d{6,20}$/.test(String(config?.phone_number_id || ''))) return 'Informe o ID do número de telefone (Phone number ID) do WhatsApp.';
    if (!/^[a-z0-9_]{1,512}$/.test(String(config?.template_name || ''))) return 'Informe o nome do modelo de mensagem aprovado (letras minúsculas, números e _).';
    if (secret !== undefined && secret.length < 20) return 'Token de acesso do WhatsApp inválido.';
  }
  return null;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    if (route === 'dispatch') {
      const { data: ok } = await admin.rpc('integrations_secret_ok', { _secret: req.headers.get('x-integrations-secret') || '' });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      const { company_id, event, ref } = await req.json().catch(() => ({}));
      if (typeof company_id !== 'string' || !(EVENTS as readonly string[]).includes(event) || typeof ref !== 'string') return reply({ error: 'bad request' }, 400);
      const { data: rows } = await admin.from('company_integrations').select('*').eq('company_id', company_id).eq('enabled', true).contains('events', [event]).not('secret_enc', 'is', null);
      if (!rows?.length) return reply({ ok: true, skipped: true });
      const msg = await buildMessage(company_id, event, ref);
      if (!msg) return reply({ ok: true, skipped: true });
      const out: Record<string, string> = {};
      for (const row of rows) {
        let ok2 = true, detail = '';
        try { detail = await deliver(row, msg); } catch (e) { ok2 = false; detail = (e as Error).message; }
        out[row.provider] = detail;
        await admin.from('integration_deliveries').insert({ company_id, provider: row.provider, event, ok: ok2, detail: detail.slice(0, 300) });
        await admin.from('company_integrations').update({ last_status: ok2 ? 'ok' : 'erro', last_error: ok2 ? null : detail.slice(0, 300), last_used_at: new Date().toISOString() }).eq('id', row.id);
      }
      return reply({ ok: true, out });
    }

    const who = await companyAdmin(req);
    if (!who) return reply({ error: 'Somente o administrador da empresa pode configurar integrações.' }, 403);
    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || '');
    if (!(PROVIDERS as readonly string[]).includes(provider)) return reply({ error: 'Integração inválida.' }, 400);

    if (route === 'save') {
      const secret = typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : undefined;
      const config = provider === 'whatsapp' ? { phone_number_id: String(body.config?.phone_number_id || '').trim(), template_name: String(body.config?.template_name || '').trim(), language: /^[a-z]{2}(_[A-Z]{2})?$/.test(body.config?.language || '') ? body.config.language : 'pt_BR' } : {};
      const { data: existing } = await admin.from('company_integrations').select('id, secret_enc').eq('company_id', who.companyId).eq('provider', provider).maybeSingle();
      if (!secret && !existing?.secret_enc) return reply({ error: provider === 'whatsapp' ? 'Informe o token de acesso do WhatsApp.' : 'Informe o link do webhook.' }, 400);
      const bad = validate(provider, config, secret); if (bad) return reply({ error: bad }, 400);
      if (secret && provider !== 'whatsapp') (config as any).hint = (() => { try { return new URL(secret).hostname; } catch { return ''; } })();
      const events = (Array.isArray(body.events) ? body.events : []).filter((e: string) => (EVENTS as readonly string[]).includes(e));
      const row: any = { company_id: who.companyId, provider, enabled: body.enabled !== false, events, config, updated_by: who.userId, updated_at: new Date().toISOString() };
      if (secret) row.secret_enc = await seal(secret);
      const { error } = await admin.from('company_integrations').upsert(row, { onConflict: 'company_id,provider' });
      if (error) return reply({ error: 'Não foi possível salvar.' }, 500);
      return reply({ ok: true });
    }
    if (route === 'remove') {
      await admin.from('company_integrations').delete().eq('company_id', who.companyId).eq('provider', provider);
      return reply({ ok: true });
    }
    if (route === 'test') {
      const { data: row } = await admin.from('company_integrations').select('*').eq('company_id', who.companyId).eq('provider', provider).maybeSingle();
      if (!row?.secret_enc) return reply({ error: 'Salve a integração antes de testar.' }, 400);
      if (provider === 'whatsapp' && !phoneDigits(body.to)) return reply({ error: 'Informe um celular com DDD para o teste.' }, 400);
      const { data: comp } = await admin.from('companies').select('name').eq('id', who.companyId).maybeSingle();
      const msg: Msg = { title: 'Teste de integração do ewvon', text: `A integração da empresa ${comp?.name || ''} está funcionando.`, url: SITE_URL };
      try {
        const detail = await deliver(row, msg, body.to);
        await admin.from('company_integrations').update({ last_status: 'ok', last_error: null, last_used_at: new Date().toISOString() }).eq('id', row.id);
        await admin.from('integration_deliveries').insert({ company_id: who.companyId, provider, event: 'test', ok: true, detail });
        return reply({ ok: true, detail });
      } catch (e) {
        const detail = (e as Error).message.slice(0, 300);
        await admin.from('company_integrations').update({ last_status: 'erro', last_error: detail }).eq('id', row.id);
        await admin.from('integration_deliveries').insert({ company_id: who.companyId, provider, event: 'test', ok: false, detail });
        return reply({ error: `O serviço recusou o teste: ${detail}` }, 400);
      }
    }
    return reply({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('integrations', e);
    return reply({ error: 'Erro interno. Tente novamente.' }, 500);
  }
});
