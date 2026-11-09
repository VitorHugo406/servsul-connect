// Company integrations: Slack, Microsoft Teams (Workflows webhook) and WhatsApp Cloud API.
//
// Routes (verify_jwt = false; each route authenticates itself):
//   POST /integrations/save      company admin: { provider, enabled, events, config, secret? } (secret is encrypted)
//   POST /integrations/remove    company admin: { provider }
//   POST /integrations/test      company admin: { provider, to? } sends a test message
//   POST /integrations/dispatch  database triggers (Vault secret header): { company_id, event, ref }
//   Google (each company registers its own OAuth client; each person connects their own account):
//   POST /integrations/google-start       any user: returns the Google consent URL
//   GET  /integrations/google-callback    Google redirect: stores the person's refresh token (encrypted)
//   POST /integrations/google-disconnect  any user: revokes and removes their connection
//   POST /integrations/google-token       any user: short-lived access token + picker keys for Google Drive
// Secrets are AES-GCM encrypted with a key derived from the service role key; the app can never read them.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const PROVIDERS = ['slack', 'teams', 'whatsapp', 'google'] as const;
const FN_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/integrations`;
const G_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file';
const EVENTS = ['announcement', 'important', 'task_assigned', 'meeting', 'calendar_sync'] as const;
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

// ---------- Google ----------
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
async function hmac(data: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! + ':google-state'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))));
}
async function googleClient(companyId: string) {
  const { data: row } = await admin.from('company_integrations').select('config, secret_enc, enabled').eq('company_id', companyId).eq('provider', 'google').maybeSingle();
  if (!row?.enabled || !row.secret_enc || !row.config?.client_id) return null;
  return { clientId: row.config.client_id as string, apiKey: (row.config.api_key || '') as string, projectNumber: (row.config.project_number || '') as string, secret: await open(row.secret_enc) };
}
async function googleAccess(userId: string): Promise<{ token: string; companyId: string } | null> {
  const { data: acc } = await admin.from('user_google_accounts').select('company_id, refresh_token_enc').eq('user_id', userId).maybeSingle();
  if (!acc) return null;
  const gc = await googleClient(acc.company_id); if (!gc) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: gc.clientId, client_secret: gc.secret, refresh_token: await open(acc.refresh_token_enc), grant_type: 'refresh_token' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) { await admin.from('user_google_accounts').update({ last_error: `Google recusou o acesso (${j.error || r.status}). Conecte a conta de novo.` }).eq('user_id', userId); return null; }
  return { token: j.access_token, companyId: acc.company_id };
}
const gEventId = (eventId: string) => 'ev' + eventId.replace(/-/g, '');   // only a-v and 0-9 (base32hex), stable per ewvon event

// Mirrors one ewvon calendar event into the Google Calendar of its creator and participants.
async function syncCalendar(companyId: string, eventId: string): Promise<string> {
  const { data: ev } = await admin.from('calendar_events').select('id, title, description, start_date, end_date, all_day, meeting_link, created_by, company_id').eq('id', eventId).maybeSingle();
  const { data: links } = await admin.from('google_event_links').select('user_id, google_event_id').eq('event_id', eventId);
  let wanted: string[] = [];
  if (ev && ev.company_id === companyId) {
    const { data: parts } = await admin.from('meeting_participants').select('profile_id').eq('event_id', eventId);
    const profileIds = [ev.created_by, ...(parts ?? []).map((p: any) => p.profile_id)].filter(Boolean);
    const { data: profs } = profileIds.length ? await admin.from('profiles').select('id, user_id').or(`id.in.(${profileIds.join(',')}),user_id.in.(${profileIds.join(',')})`) : { data: [] } as any;
    const userIds = [...new Set((profs ?? []).map((p: any) => p.user_id).filter(Boolean))] as string[];
    const { data: accs } = userIds.length ? await admin.from('user_google_accounts').select('user_id').in('user_id', userIds).eq('company_id', companyId) : { data: [] } as any;
    wanted = (accs ?? []).map((a: any) => a.user_id);
  }
  let done = 0;
  // Remove from people who are no longer in the event (or when the event was deleted).
  for (const l of (links ?? []).filter((l: any) => !wanted.includes(l.user_id))) {
    const acc = await googleAccess(l.user_id);
    if (acc) await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${l.google_event_id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${acc.token}` } }).catch(() => null);
    await admin.from('google_event_links').delete().eq('event_id', eventId).eq('user_id', l.user_id);
    done++;
  }
  if (!ev) return `removido de ${done} agenda(s)`;
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const end = ev.end_date || new Date(new Date(ev.start_date).getTime() + 3600e3).toISOString();
  const body: any = {
    summary: ev.title, location: ev.meeting_link || undefined,
    description: `${ev.description ? String(ev.description).slice(0, 3000) + '\n\n' : ''}Criado no ewvon: ${SITE_URL}/calendario`,
    start: ev.all_day ? { date: day(ev.start_date) } : { dateTime: new Date(ev.start_date).toISOString(), timeZone: 'America/Sao_Paulo' },
    end: ev.all_day ? { date: day(new Date(new Date(end).getTime() + 864e5).toISOString()) }  /* exclusive end date */ : { dateTime: new Date(end).toISOString(), timeZone: 'America/Sao_Paulo' },
  };
  const gid = gEventId(ev.id);
  for (const uid of wanted) {
    const acc = await googleAccess(uid); if (!acc) continue;
    const h = { Authorization: `Bearer ${acc.token}`, 'Content-Type': 'application/json' };
    let r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gid}`, { method: 'PATCH', headers: h, body: JSON.stringify({ ...body, status: 'confirmed' }) });
    if (r.status === 404) r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: h, body: JSON.stringify({ ...body, id: gid }) });
    if (r.ok || r.status === 409) { await admin.from('google_event_links').upsert({ event_id: ev.id, user_id: uid, google_event_id: gid, updated_at: new Date().toISOString() }); done++; }
    else await admin.from('user_google_accounts').update({ last_error: `Agenda Google: erro ${r.status} ao sincronizar "${clip(ev.title, 40)}".` }).eq('user_id', uid);
  }
  return `${done} agenda(s) atualizada(s)`;
}

async function signedIn(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
  if (!u?.user) return null;
  const { data: prof } = await admin.from('profiles').select('company_id').eq('user_id', u.user.id).maybeSingle();
  return prof?.company_id ? { userId: u.user.id as string, email: u.user.email as string, companyId: prof.company_id as string } : null;
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
  if (provider === 'google') {
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(String(config?.client_id || ''))) return 'O ID do cliente termina com .apps.googleusercontent.com.';
    if (!/^AIza[\w-]{30,}$/.test(String(config?.api_key || ''))) return 'A chave de API começa com AIza.';
    if (!/^\d{6,20}$/.test(String(config?.project_number || ''))) return 'Informe o número do projeto (só números).';
    if (secret !== undefined && !/^[\w-]{10,}$/.test(secret)) return 'Chave secreta do cliente inválida.';
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
    if (route === 'google-callback') {
      const url = new URL(req.url);
      const back = (r: string) => Response.redirect(`${SITE_URL}/integracoes?google=${r}`, 302);
      const [payload, sig] = String(url.searchParams.get('state') || '').split('.');
      if (!payload || !sig || sig !== await hmac(payload)) return back('erro');
      const st = JSON.parse(unb64url(payload));
      if (Date.now() > st.e || !url.searchParams.get('code')) return back(url.searchParams.get('error') === 'access_denied' ? 'cancelado' : 'erro');
      const gc = await googleClient(st.c); if (!gc) return back('erro');
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: gc.clientId, client_secret: gc.secret, redirect_uri: `${FN_URL}/google-callback`, grant_type: 'authorization_code' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.refresh_token) { console.error('google token', r.status, j.error); return back('erro'); }
      let email = ''; try { email = JSON.parse(unb64url(String(j.id_token).split('.')[1])).email || ''; } catch { /* no id token */ }
      await admin.from('user_google_accounts').upsert({ user_id: st.u, company_id: st.c, google_email: email, refresh_token_enc: await seal(j.refresh_token), scopes: j.scope || G_SCOPES, connected_at: new Date().toISOString(), last_error: null });
      return back('ok');
    }
    if (route === 'google-start' || route === 'google-disconnect' || route === 'google-token') {
      const me = await signedIn(req); if (!me) return reply({ error: 'Faça login novamente.' }, 401);
      if (route === 'google-start') {
        const gc = await googleClient(me.companyId); if (!gc) return reply({ error: 'O administrador da empresa ainda não configurou o Google na aba Integrações.' }, 400);
        const payload = b64url(JSON.stringify({ u: me.userId, c: me.companyId, e: Date.now() + 10 * 60e3 }));
        const q = new URLSearchParams({ client_id: gc.clientId, redirect_uri: `${FN_URL}/google-callback`, response_type: 'code', scope: G_SCOPES, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', login_hint: me.email || '', state: `${payload}.${await hmac(payload)}` });
        return reply({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
      }
      if (route === 'google-disconnect') {
        const { data: acc } = await admin.from('user_google_accounts').select('refresh_token_enc').eq('user_id', me.userId).maybeSingle();
        if (acc) { try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(await open(acc.refresh_token_enc))}`, { method: 'POST' }); } catch { /* already revoked */ } }
        await admin.from('user_google_accounts').delete().eq('user_id', me.userId);
        await admin.from('google_event_links').delete().eq('user_id', me.userId);
        return reply({ ok: true });
      }
      const acc = await googleAccess(me.userId); if (!acc) return reply({ error: 'Conecte sua conta Google na aba Integrações.' }, 400);
      const gc = await googleClient(acc.companyId);
      return reply({ access_token: acc.token, api_key: gc?.apiKey, client_id: gc?.clientId, project_number: gc?.projectNumber });
    }
    if (route === 'dispatch') {
      const { data: ok } = await admin.rpc('integrations_secret_ok', { _secret: req.headers.get('x-integrations-secret') || '' });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      const { company_id, event, ref } = await req.json().catch(() => ({}));
      if (typeof company_id !== 'string' || !(EVENTS as readonly string[]).includes(event) || typeof ref !== 'string') return reply({ error: 'bad request' }, 400);
      if (event === 'calendar_sync') {
        const detail = await syncCalendar(company_id, ref);
        return reply({ ok: true, detail });
      }
      const { data: rows } = await admin.from('company_integrations').select('*').eq('company_id', company_id).eq('enabled', true).contains('events', [event]).not('secret_enc', 'is', null);
      if (!rows?.length) return reply({ ok: true, skipped: true });
      const msg = await buildMessage(company_id, event, ref);
      if (!msg) return reply({ ok: true, skipped: true });
      const out: Record<string, string> = {};
      for (const row of rows) {
        if (row.provider === 'google') continue;  // Google only handles calendar_sync
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
      const config = provider === 'google' ? { client_id: String(body.config?.client_id || '').trim(), api_key: String(body.config?.api_key || '').trim(), project_number: String(body.config?.project_number || '').replace(/\D/g, '') } : provider === 'whatsapp' ? { phone_number_id: String(body.config?.phone_number_id || '').trim(), template_name: String(body.config?.template_name || '').trim(), language: /^[a-z]{2}(_[A-Z]{2})?$/.test(body.config?.language || '') ? body.config.language : 'pt_BR' } : {};
      const { data: existing } = await admin.from('company_integrations').select('id, secret_enc').eq('company_id', who.companyId).eq('provider', provider).maybeSingle();
      if (!secret && !existing?.secret_enc) return reply({ error: provider === 'google' ? 'Informe a chave secreta do cliente.' : provider === 'whatsapp' ? 'Informe o token de acesso do WhatsApp.' : 'Informe o link do webhook.' }, 400);
      const bad = validate(provider, config, secret); if (bad) return reply({ error: bad }, 400);
      if (secret && (provider === 'slack' || provider === 'teams')) (config as any).hint = (() => { try { return new URL(secret).hostname; } catch { return ''; } })();
      const events = provider === 'google' ? ['calendar_sync'] : (Array.isArray(body.events) ? body.events : []).filter((e: string) => (EVENTS as readonly string[]).includes(e) && e !== 'calendar_sync');
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
    if (route === 'test' && provider === 'google') return reply({ error: 'Para testar, conecte sua conta Google no cartão "Minha conta Google" e crie uma reunião no calendário.' }, 400);
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
