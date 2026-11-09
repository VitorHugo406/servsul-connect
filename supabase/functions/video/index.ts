// Video calls with Daily.co: calendar meetings and chat calls (direct, group and sector conversations).
//
// Routes (verify_jwt = false; each route checks who is calling):
//   POST /video/room        { event_id }            meeting creator / company admin: creates the meeting room
//   POST /video/join        { event_id }            meeting creator, invited participants, company admins
//   POST /video/chat-start  { conv, target }        conversation member: creates a call, posts it in the chat
//   POST /video/chat-join   { room }                conversation member: joins a chat call
//   POST /video/refresh     (Vault secret header)   hourly cron: refreshes usage per company and sends alerts
// Rules:
//   * Only plans with the 'video_calls' feature (Empresarial), plus the system / exempt companies.
//   * Each company has billing_settings.video_free_minutes participant-minutes per month (UTC month).
//     At 80%, 90% and 100% the company's base admin is warned in the Comunicados chat. At 100% new calls are
//     blocked unless the admin opted in (Pagamentos > Videochamadas); extra minutes are then billed on the
//     next invoice at billing_settings.video_price_per_minute (the billing function adds them).
//   * Rooms are private: only a per-person token opens them.
// Secret: DAILY_API_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
const EARLY_MIN = 30, AFTER_END_MIN = 120, CHAT_CALL_HOURS = 3;
const CALL_PREFIX = '📹 ewvon-call:';

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const fail = (msg: string, status: number) => Object.assign(new Error(msg), { status, public: true });

async function daily(path: string, body?: unknown) {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw fail('A videochamada ainda não foi ativada no ewvon.', 503);
  const r = await fetch(`https://api.daily.co/v1${path}`, body === undefined
    ? { headers: { Authorization: `Bearer ${key}` } }
    : { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Daily ${r.status}: ${j?.info || j?.error || 'erro'}`), { status: 502 });
  return j;
}

async function dm(profileId: string, companyId: string, text: string) {
  await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: profileId, content: text, company_id: companyId });
}
async function notifySuperAdmin(text: string) {
  try {
    const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
    const ids = (supers ?? []).map((r: any) => r.user_id);
    if (!ids.length) return;
    const { data: t } = await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle();
    if (t) await dm(t.id, ADMIN_COMPANY_ID, text);
  } catch (e) { console.error('notifySuperAdmin', e); }
}
// The company's base admin (the one created with the subscription), else its first active admin.
async function notifyCompanyAdmin(companyId: string, text: string) {
  try {
    const { data: s } = await admin.from('company_signups').select('admin_email').eq('company_id', companyId).eq('status', 'active').order('created_at').limit(1).maybeSingle();
    let t: any = null;
    if (s?.admin_email) ({ data: t } = await admin.from('profiles').select('id').eq('company_id', companyId).ilike('email', s.admin_email).maybeSingle());
    if (!t) ({ data: t } = await admin.from('profiles').select('id').eq('company_id', companyId).eq('autonomy_level', 'admin').eq('is_active', true).order('created_at').limit(1).maybeSingle());
    if (t) await dm(t.id, companyId, text);
  } catch (e) { console.error('notifyCompanyAdmin', e); }
}

const month = () => new Date().toISOString().slice(0, 7);
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const n = (v: number) => v.toLocaleString('pt-BR');
async function settings() {
  const { data } = await admin.from('billing_settings').select('video_free_minutes, video_price_per_minute, video_minutes_limit').limit(1).maybeSingle();
  return { free: data?.video_free_minutes ?? 2500, price: Number(data?.video_price_per_minute ?? 0.045), globalLimit: data?.video_minutes_limit ?? 9500 };
}

// Plan access: system company, exempt companies and plans with 'video_calls'.
async function companyAccess(companyId: string) {
  const [{ data: comp }, { data: sub }] = await Promise.all([
    admin.from('companies').select('is_system').eq('id', companyId).maybeSingle(),
    admin.from('company_subscriptions').select('status, plan_id, video_overage_allowed').eq('company_id', companyId).maybeSingle(),
  ]);
  if (comp?.is_system || sub?.status === 'exempt') return { allowed: true, unlimited: true, overageAllowed: true };
  const { data: plan } = sub?.plan_id ? await admin.from('subscription_plans').select('features').eq('id', sub.plan_id).maybeSingle() : { data: null } as any;
  const allowed = ['active', 'trialing'].includes(sub?.status || '') && (plan?.features || []).includes('video_calls');
  return { allowed, unlimited: false, overageAllowed: !!sub?.video_overage_allowed };
}

// Refreshes participant-minutes of every company for the current month from Daily (at most every 5 min
// unless forced) and sends the 80/90/100% alerts.
async function refreshUsage(force = false) {
  const m = month();
  const { data: g } = await admin.from('video_usage').select('*').eq('month', m).maybeSingle();
  if (!force && g && Date.now() - new Date(g.updated_at).getTime() < 5 * 60e3) return;
  const now = new Date();
  const startUnix = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const perRoom = new Map<string, number>();
  let after = '', total = 0;
  for (let page = 0; page < 50; page++) {
    const j = await daily(`/meetings?timeframe_start=${startUnix}&limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`);
    const list = (j?.data ?? []) as any[];
    for (const mt of list) {
      const parts = (mt.participants ?? []) as any[];
      const sec = parts.length ? parts.reduce((t, p) => t + (Number(p.duration) || 0), 0) : (Number(mt.duration) || 0) * Math.max(1, Number(mt.max_participants) || 1);
      perRoom.set(mt.room, (perRoom.get(mt.room) || 0) + sec); total += sec;
    }
    if (list.length < 100) break;
    after = list[list.length - 1].id;
  }
  const cfg = await settings();
  const rooms = [...perRoom.keys()];
  const { data: map } = rooms.length ? await admin.from('video_rooms').select('name, company_id').in('name', rooms) : { data: [] } as any;
  const perCompany = new Map<string, number>();
  for (const r of map ?? []) perCompany.set(r.company_id, (perCompany.get(r.company_id) || 0) + (perRoom.get(r.name) || 0));
  for (const [companyId, sec] of perCompany) {
    const minutes = Math.ceil(sec / 60);
    const acc = await companyAccess(companyId);
    const { data: row } = await admin.from('company_video_usage').select('*').eq('company_id', companyId).eq('month', m).maybeSingle();
    const overage = acc.unlimited || !acc.overageAllowed ? 0 : Math.max(0, minutes - cfg.free);
    const next: any = { company_id: companyId, month: m, minutes, overage_minutes: overage, overage_cents: Math.round(overage * cfg.price * 100), updated_at: new Date().toISOString() };
    if (!acc.unlimited) {
      const pct = (minutes / cfg.free) * 100;
      const link = `${SITE_URL}/pagamentos`;
      if (pct >= 100 && !row?.alerted_100) {
        next.alerted_100 = next.alerted_90 = next.alerted_80 = true;
        await notifyCompanyAdmin(companyId, acc.overageAllowed
          ? `*Videochamadas: franquia grátis do mês usada*\n\nA empresa usou os ${n(cfg.free)} minutos grátis. Como a continuação está ativada, as chamadas seguem normalmente e cada minuto extra por participante custa ${brl(cfg.price)}, cobrado na próxima fatura. Acompanhe em Pagamentos: ${link}`
          : `*Videochamadas bloqueadas: franquia grátis do mês usada*\n\nA empresa usou os ${n(cfg.free)} minutos grátis de videochamada deste mês e novas chamadas estão bloqueadas até o dia 1º.\n\nQuer continuar agora? Em Pagamentos > Videochamadas, ative "Continuar após a franquia". Cada minuto extra por participante custa ${brl(cfg.price)} e entra na próxima fatura. ${link}`);
      } else if (pct >= 90 && !row?.alerted_90) {
        next.alerted_90 = next.alerted_80 = true;
        await notifyCompanyAdmin(companyId, `*Videochamadas: 90% da franquia do mês*\n\nJá foram usados ${n(minutes)} de ${n(cfg.free)} minutos grátis.${acc.overageAllowed ? ` Depois disso, cada minuto extra por participante custa ${brl(cfg.price)} na próxima fatura.` : ' Ao chegar em 100%, novas chamadas ficam bloqueadas, a menos que você ative a continuação em Pagamentos > Videochamadas.'} ${link}`);
      } else if (pct >= 80 && !row?.alerted_80) {
        next.alerted_80 = true;
        await notifyCompanyAdmin(companyId, `*Videochamadas: 80% da franquia do mês*\n\nJá foram usados ${n(minutes)} de ${n(cfg.free)} minutos grátis de videochamada deste mês. Detalhes em Pagamentos: ${link}`);
      }
    }
    await admin.from('company_video_usage').upsert(next);
  }
  // Whole-system usage: warn the platform owner about the Daily account.
  const totalMin = Math.ceil(total / 60);
  const gRow = { month: m, minutes: totalMin, alerted_80: g?.alerted_80 ?? false, alerted_100: g?.alerted_100 ?? false, updated_at: new Date().toISOString() };
  if (totalMin >= cfg.globalLimit && !gRow.alerted_100) { gRow.alerted_100 = gRow.alerted_80 = true; await notifySuperAdmin(`*Daily: uso do sistema passou de ${n(cfg.globalLimit)} minutos*\n\nTotal no mês: ${n(totalMin)} minutos-participante. Confira o plano e o cartão na conta do Daily para as chamadas não pararem.`); }
  else if (totalMin >= cfg.globalLimit * 0.8 && !gRow.alerted_80) { gRow.alerted_80 = true; await notifySuperAdmin(`*Daily: 80% do limite de referência do sistema*\n\nTotal no mês: ${n(totalMin)} de ${n(cfg.globalLimit)} minutos-participante.`); }
  await admin.from('video_usage').upsert(gRow);
}

// Can this company start or join a call right now?
async function gate(companyId: string) {
  const acc = await companyAccess(companyId);
  if (!acc.allowed) throw fail('Videochamadas estão disponíveis no plano Empresarial. O administrador pode mudar de plano em Pagamentos.', 402);
  if (acc.unlimited) return;
  try { await refreshUsage(); } catch (e) { console.error('usage', (e as Error).message); }
  const cfg = await settings();
  const { data: row } = await admin.from('company_video_usage').select('minutes').eq('company_id', companyId).eq('month', month()).maybeSingle();
  if ((row?.minutes ?? 0) >= cfg.free && !acc.overageAllowed) throw fail(`Os ${n(cfg.free)} minutos grátis de videochamada deste mês acabaram. O administrador pode liberar a continuação em Pagamentos > Videochamadas.`, 402);
}

async function createRoom(name: string, expUnix: number, companyId: string, kind: 'meeting' | 'chat', ref: string, by: string) {
  const room = await daily('/rooms', { name, privacy: 'private', properties: { exp: expUnix, eject_at_room_exp: true, enable_screenshare: true, enable_chat: true, enable_prejoin_ui: true, max_participants: 50 } });
  await admin.from('video_rooms').upsert({ name: room.name, company_id: companyId, kind, ref, created_by: by, expires_at: new Date(expUnix * 1000).toISOString() });
  return { name: room.name as string, url: room.url as string };
}
async function token(room: string, prof: any, owner: boolean, expUnix: number) {
  const t = await daily('/meeting-tokens', { properties: { room_name: room, user_name: (prof.display_name || prof.name || 'Participante').slice(0, 60), user_id: prof.id, is_owner: owner, exp: expUnix, eject_at_token_exp: true } });
  return t.token as string;
}

const meetingTimes = (ev: any) => {
  const start = new Date(ev.start_date).getTime();
  const end = ev.end_date ? new Date(ev.end_date).getTime() : start + 3600e3;
  return { start, end, roomExp: Math.floor((end + AFTER_END_MIN * 60e3) / 1000) };
};
async function ensureMeetingRoom(ev: any, by: string) {
  if (ev.video_room && ev.meeting_link) return { name: ev.video_room as string, url: ev.meeting_link as string };
  const { roomExp } = meetingTimes(ev);
  const room = await createRoom(`ewvon-${String(ev.id).replace(/-/g, '').slice(0, 20)}`, Math.max(roomExp, Math.floor(Date.now() / 1000) + 3600), ev.company_id, 'meeting', ev.id, by);
  await admin.from('calendar_events').update({ video_room: room.name, meeting_link: room.url }).eq('id', ev.id);
  return room;
}

// Is this person part of the conversation? Returns the normalized reference.
async function chatMember(prof: any, userId: string, isAdmin: boolean, conv: string, target: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(target)) return null;
  if (conv === 'dm') {
    const { data: other } = await admin.from('profiles').select('id').eq('id', target).eq('company_id', prof.company_id).maybeSingle();
    return other && target !== prof.id ? `dm:${[prof.id, target].sort().join(':')}` : null;
  }
  if (conv === 'group') {
    const { data: g } = await admin.from('private_groups').select('id').eq('id', target).eq('company_id', prof.company_id).maybeSingle();
    if (!g) return null;
    const { data: m } = await admin.from('private_group_members').select('id').eq('group_id', target).or(`profile_id.eq.${prof.id},user_id.eq.${userId}`).limit(1);
    return m?.length ? `group:${target}` : null;
  }
  if (conv === 'sector') {
    const { data: s } = await admin.from('sectors').select('id').eq('id', target).eq('company_id', prof.company_id).maybeSingle();
    if (!s) return null;
    if (isAdmin || prof.sector_id === target) return `sector:${target}`;
    const { data: extra } = await admin.from('user_additional_sectors').select('id').eq('user_id', userId).eq('sector_id', target).limit(1);
    return extra?.length ? `sector:${target}` : null;
  }
  return null;
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    if (route === 'refresh') {
      const { data: ok } = await admin.rpc('integrations_secret_ok', { _secret: req.headers.get('x-integrations-secret') || '' });
      if (ok !== true) return reply({ error: 'Unauthorized' }, 401);
      if (!Deno.env.get('DAILY_API_KEY')) return reply({ ok: true, skipped: 'sem chave' });
      await refreshUsage(true);
      return reply({ ok: true });
    }

    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
    if (!u?.user) return reply({ error: 'Faça login novamente.' }, 401);
    const body = await req.json().catch(() => ({}));
    const [{ data: prof }, { data: roles }] = await Promise.all([
      admin.from('profiles').select('id, name, display_name, company_id, sector_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', u.user.id),
    ]);
    if (!prof?.company_id) return reply({ error: 'Perfil não encontrado.' }, 404);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof.autonomy_level === 'admin';

    if (route === 'room' || route === 'join') {
      const eventId = String(body?.event_id || '');
      if (!/^[0-9a-f-]{36}$/.test(eventId)) return reply({ error: 'Reunião inválida.' }, 400);
      const { data: ev } = await admin.from('calendar_events').select('id, title, start_date, end_date, created_by, company_id, video_room, meeting_link').eq('id', eventId).maybeSingle();
      if (!ev || ev.company_id !== prof.company_id) return reply({ error: 'Reunião não encontrada.' }, 404);
      const isCreator = ev.created_by === u.user.id || ev.created_by === prof.id;
      if (route === 'room') {
        if (!isCreator && !isAdmin) return reply({ error: 'Só quem marcou a reunião pode criar a sala.' }, 403);
        const acc = await companyAccess(prof.company_id);
        if (!acc.allowed) return reply({ error: 'Videochamadas estão disponíveis no plano Empresarial.' }, 402);
        const room = await ensureMeetingRoom(ev, prof.id);
        return reply({ ok: true, url: room.url });
      }
      let invited = isCreator || isAdmin;
      if (!invited) { const { data: part } = await admin.from('meeting_participants').select('id').eq('event_id', ev.id).eq('profile_id', prof.id).maybeSingle(); invited = !!part; }
      if (!invited) return reply({ error: 'Você não foi convidado para esta reunião.' }, 403);
      const { start, end, roomExp } = meetingTimes(ev);
      const now = Date.now();
      if (now < start - EARLY_MIN * 60e3) return reply({ error: `A sala abre ${EARLY_MIN} minutos antes do início da reunião.` }, 400);
      if (now > end + AFTER_END_MIN * 60e3) return reply({ error: 'Esta reunião já terminou.' }, 400);
      await gate(prof.company_id);
      const room = await ensureMeetingRoom(ev, prof.id);
      return reply({ url: room.url, token: await token(room.name, prof, isCreator, Math.min(roomExp, Math.floor(now / 1000) + 6 * 3600)), title: ev.title });
    }

    if (route === 'chat-start') {
      const conv = String(body?.conv || ''), target = String(body?.target || '');
      const ref = await chatMember(prof, u.user.id, isAdmin, conv, target);
      if (!ref) return reply({ error: 'Você não participa desta conversa.' }, 403);
      await gate(prof.company_id);
      const exp = Math.floor(Date.now() / 1000) + CHAT_CALL_HOURS * 3600;
      const room = await createRoom(`ewvon-c${crypto.randomUUID().replace(/-/g, '').slice(0, 22)}`, exp, prof.company_id, 'chat', ref, prof.id);
      const content = `${CALL_PREFIX}${room.name}`;
      if (conv === 'dm') await admin.from('direct_messages').insert({ sender_id: prof.id, receiver_id: target, content, company_id: prof.company_id });
      else if (conv === 'group') await admin.from('private_group_messages').insert({ group_id: target, sender_id: prof.id, content });
      else await admin.from('messages').insert({ content, author_id: prof.id, sector_id: target, company_id: prof.company_id });
      return reply({ url: room.url, token: await token(room.name, prof, true, exp), title: 'Chamada de vídeo' });
    }

    if (route === 'chat-join') {
      const name = String(body?.room || '');
      if (!/^ewvon-c[0-9a-f]{22}$/.test(name)) return reply({ error: 'Chamada inválida.' }, 400);
      const { data: vr } = await admin.from('video_rooms').select('company_id, ref, expires_at').eq('name', name).maybeSingle();
      if (!vr || vr.company_id !== prof.company_id) return reply({ error: 'Chamada não encontrada.' }, 404);
      if (vr.expires_at && new Date(vr.expires_at).getTime() < Date.now()) return reply({ error: 'Esta chamada já terminou.' }, 400);
      const [conv, a, b] = String(vr.ref).split(':');
      const target = conv === 'dm' ? (a === prof.id ? b : b === prof.id ? a : '') : a;
      if (!target || !(await chatMember(prof, u.user.id, isAdmin, conv, target))) return reply({ error: 'Você não participa desta conversa.' }, 403);
      await gate(prof.company_id);
      const room = await daily(`/rooms/${name}`);
      return reply({ url: room.url, token: await token(name, prof, false, Math.floor(new Date(vr.expires_at!).getTime() / 1000)), title: 'Chamada de vídeo' });
    }
    return reply({ error: 'Not found' }, 404);
  } catch (e) {
    const err = e as any;
    console.error('video', err.message);
    return reply({ error: err.public || err.status === 503 ? err.message : 'Não foi possível abrir a videochamada agora. Tente de novo em instantes.' }, err.status || 500);
  }
});
