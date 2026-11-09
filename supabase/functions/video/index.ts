// Video calls with Daily.co for calendar meetings.
//
// Routes (verify_jwt = false; each route checks the signed-in user):
//   POST /video/room  { event_id }  creator (or company admin): creates the private room for the meeting
//   POST /video/join  { event_id }  creator, invited participants or company admins: returns { url, token }
// Rooms are private: the link alone does not open the call, only a per-person token does.
// Monthly cap: new joins are refused once the month's participant-minutes (as reported by Daily) reach
// billing_settings.video_minutes_limit (default 9,500, under Daily's free allowance). The super admin is
// warned in the Comunicados chat at 80% and 100%.
// Secret: DAILY_API_KEY (Supabase > Edge Functions > Secrets).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE_URL = (Deno.env.get('SITE_URL') || 'https://ewvon.vercel.app').replace(/\/+$/, '');
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const EARLY_MIN = 30;           // can join 30 minutes before the start
const AFTER_END_MIN = 120;      // and until 2 hours after the end

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && (origin === SITE_URL || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) ? origin : SITE_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

async function daily(path: string, body: unknown) {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw Object.assign(new Error('A videochamada ainda não foi ativada no ewvon.'), { status: 503 });
  const r = await fetch(`https://api.daily.co/v1${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Daily ${r.status}: ${j?.info || j?.error || 'erro'}`), { status: 502 });
  return j;
}

async function dailyGet(path: string) {
  const r = await fetch(`https://api.daily.co/v1${path}`, { headers: { Authorization: `Bearer ${Deno.env.get('DAILY_API_KEY')}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Daily ${r.status}: ${j?.info || j?.error || 'erro'}`);
  return j;
}

const SYSTEM_SENDER_ID = '00000000-0000-0000-0000-0000000000c1';
const ADMIN_COMPANY_ID = '00000000-0000-0000-0000-0000000000a1';
async function notifySuperAdmin(text: string) {
  try {
    const { data: supers } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
    const ids = (supers ?? []).map((r: any) => r.user_id);
    if (!ids.length) return;
    const { data: target } = await admin.from('profiles').select('id').in('user_id', ids).eq('company_id', ADMIN_COMPANY_ID).order('created_at').limit(1).maybeSingle();
    if (target) await admin.from('direct_messages').insert({ sender_id: SYSTEM_SENDER_ID, receiver_id: target.id, content: text, company_id: ADMIN_COMPANY_ID });
  } catch (e) { console.error('notifySuperAdmin', e); }
}

// Participant-minutes used this month (UTC), from Daily's meetings API; cached for 5 minutes.
async function monthlyUsage(): Promise<{ month: string; minutes: number; limit: number; row: any }> {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const [{ data: cfg }, { data: row }] = await Promise.all([
    admin.from('billing_settings').select('video_minutes_limit').limit(1).maybeSingle(),
    admin.from('video_usage').select('*').eq('month', month).maybeSingle(),
  ]);
  const limit = cfg?.video_minutes_limit ?? 9500;
  if (row && Date.now() - new Date(row.updated_at).getTime() < 5 * 60e3) return { month, minutes: row.minutes, limit, row };
  try {
    const startUnix = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
    let seconds = 0, after = '';
    for (let page = 0; page < 50; page++) {
      const j = await dailyGet(`/meetings?timeframe_start=${startUnix}&limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ''}`);
      const list = (j?.data ?? []) as any[];
      for (const m of list) {
        const parts = (m.participants ?? []) as any[];
        seconds += parts.length ? parts.reduce((t, p) => t + (Number(p.duration) || 0), 0) : (Number(m.duration) || 0) * Math.max(1, Number(m.max_participants) || 1);
      }
      if (list.length < 100) break;
      after = list[list.length - 1].id;
    }
    const minutes = Math.ceil(seconds / 60);
    const next = { month, minutes, alerted_80: row?.alerted_80 ?? false, alerted_100: row?.alerted_100 ?? false, updated_at: new Date().toISOString() };
    await admin.from('video_usage').upsert(next);
    return { month, minutes, limit, row: next };
  } catch (e) {
    console.error('usage', (e as Error).message);   // Daily unreachable: keep the last known value
    return { month, minutes: row?.minutes ?? 0, limit, row: row ?? { month, alerted_80: false, alerted_100: false } };
  }
}

async function usageAlerts(u: { month: string; minutes: number; limit: number; row: any }) {
  const pct = u.limit ? (u.minutes / u.limit) * 100 : 0;
  if (pct >= 100 && !u.row.alerted_100) {
    await admin.from('video_usage').update({ alerted_100: true, alerted_80: true }).eq('month', u.month);
    await notifySuperAdmin(`*Videochamadas bloqueadas até o fim do mês*\n\nO uso chegou a ${u.minutes.toLocaleString('pt-BR')} de ${u.limit.toLocaleString('pt-BR')} minutos-participante. Novas entradas em chamadas estão bloqueadas até o dia 1º para não gerar cobrança no Daily. Para liberar, cadastre um cartão no Daily e aumente o teto (billing_settings.video_minutes_limit).`);
  } else if (pct >= 80 && !u.row.alerted_80) {
    await admin.from('video_usage').update({ alerted_80: true }).eq('month', u.month);
    await notifySuperAdmin(`*Videochamadas: 80% do limite do mês*\n\nJá foram usados ${u.minutes.toLocaleString('pt-BR')} de ${u.limit.toLocaleString('pt-BR')} minutos-participante. Ao chegar no limite, novas chamadas ficam bloqueadas até o dia 1º.`);
  }
}

const times = (ev: any) => {
  const start = new Date(ev.start_date).getTime();
  const end = ev.end_date ? new Date(ev.end_date).getTime() : start + 3600e3;
  return { start, end, roomExp: Math.floor((end + AFTER_END_MIN * 60e3) / 1000) };
};

async function ensureRoom(ev: any): Promise<{ name: string; url: string }> {
  if (ev.video_room && ev.meeting_link) return { name: ev.video_room, url: ev.meeting_link };
  const { roomExp } = times(ev);
  const room = await daily('/rooms', {
    name: ev.video_room || `ewvon-${String(ev.id).replace(/-/g, '').slice(0, 20)}`,
    privacy: 'private',
    properties: { exp: Math.max(roomExp, Math.floor(Date.now() / 1000) + 3600), eject_at_room_exp: true, enable_screenshare: true, enable_chat: true, enable_prejoin_ui: true, max_participants: 50 },
  }).catch(async (e) => {
    // Room already exists (e.g. created earlier): reuse it.
    if (String(e.message).includes('already exists') && ev.video_room) return { name: ev.video_room, url: ev.meeting_link };
    throw e;
  });
  if (!ev.video_room || ev.meeting_link !== room.url) await admin.from('calendar_events').update({ video_room: room.name, meeting_link: room.url }).eq('id', ev.id);
  return { name: room.name, url: room.url };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } } as any;
    if (!u?.user) return reply({ error: 'Faça login novamente.' }, 401);
    const { event_id } = await req.json().catch(() => ({}));
    if (typeof event_id !== 'string' || !/^[0-9a-f-]{36}$/.test(event_id)) return reply({ error: 'Reunião inválida.' }, 400);

    const [{ data: prof }, { data: roles }, { data: ev }] = await Promise.all([
      admin.from('profiles').select('id, name, display_name, company_id, autonomy_level').eq('user_id', u.user.id).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', u.user.id),
      admin.from('calendar_events').select('id, title, start_date, end_date, created_by, company_id, video_room, meeting_link').eq('id', event_id).maybeSingle(),
    ]);
    if (!ev || !prof || ev.company_id !== prof.company_id) return reply({ error: 'Reunião não encontrada.' }, 404);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin') || prof.autonomy_level === 'admin';
    const isCreator = ev.created_by === u.user.id || ev.created_by === prof.id;

    if (route === 'room') {
      if (!isCreator && !isAdmin) return reply({ error: 'Só quem marcou a reunião pode criar a sala.' }, 403);
      const room = await ensureRoom(ev);
      return reply({ ok: true, url: room.url });
    }

    if (route === 'join') {
      let invited = isCreator || isAdmin;
      if (!invited) {
        const { data: part } = await admin.from('meeting_participants').select('id').eq('event_id', ev.id).eq('profile_id', prof.id).maybeSingle();
        invited = !!part;
      }
      if (!invited) return reply({ error: 'Você não foi convidado para esta reunião.' }, 403);
      const { start, end, roomExp } = times(ev);
      const now = Date.now();
      if (now < start - EARLY_MIN * 60e3) return reply({ error: `A sala abre ${EARLY_MIN} minutos antes do início da reunião.` }, 400);
      if (now > end + AFTER_END_MIN * 60e3) return reply({ error: 'Esta reunião já terminou.' }, 400);
      const usage = await monthlyUsage();
      await usageAlerts(usage);
      if (usage.minutes >= usage.limit) return reply({ error: 'O limite mensal de videochamadas do ewvon foi atingido. As chamadas voltam no dia 1º do próximo mês.' }, 429);
      const room = await ensureRoom(ev);
      const token = await daily('/meeting-tokens', { properties: {
        room_name: room.name, user_name: (prof.display_name || prof.name || 'Participante').slice(0, 60), user_id: prof.id,
        is_owner: isCreator, exp: Math.min(roomExp, Math.floor(now / 1000) + 6 * 3600), eject_at_token_exp: true,
      } });
      return reply({ url: room.url, token: token.token, title: ev.title });
    }
    return reply({ error: 'Not found' }, 404);
  } catch (e) {
    const status = (e as any)?.status || 500;
    console.error('video', (e as Error).message);
    return reply({ error: status === 503 ? (e as Error).message : 'Não foi possível abrir a videochamada agora. Tente de novo em instantes.' }, status);
  }
});
