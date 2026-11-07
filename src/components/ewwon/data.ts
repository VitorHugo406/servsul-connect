// Ewwon mobile data layer: reads and writes the existing Supabase tables
// (profiles, sectors, messages, direct_messages, private_groups, announcements,
// tasks, meeting_bookings) plus the tables added for the mobile app
// (chat_member_prefs, user_preferences, support_tickets, chat_reactions, push_devices).
import { supabase as typedSupabase } from '@/integrations/supabase/client';
import { optimizeImageFile } from '@/lib/imageOptimization';
import {
  STATUS_TO_DB, StatusKey, dataUrlToBlob, fmtTime, hueFromColor, hueOf, initials, MONTHS_LONG, MONTHS_SHORT,
  relDays, safeStore, sinceLabel, statusFromDb, timeToHm,
} from './util';

// New tables are not in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = typedSupabase as any;

export const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', gerente: 'Gerente', supervisor: 'Supervisor', diretoria: 'Diretoria', colaborador: 'Colaborador',
};

export interface Person {
  id: string; userId: string; n: string; i: string; hue: number; role: string; dept: string; sectorId: string | null;
  st: StatusKey; h: [string, string]; days: number[]; mail: string; bio: string; since: string;
  photo: string | null; cover: string | null; birth: string | null; me?: boolean;
}
export interface Msg { id: string; t: string; at: string; h: string; me: boolean; from: string | null; r: string[]; mine: string[]; pending?: boolean }
export interface ChatSet { pin: boolean; mute: boolean; muteUntil: number; muteDur: number; fs: number; ff: number; col: number; wall: number }
export interface Summary { id?: string; on: boolean; h: number; d: number; it: Record<string, boolean> }
export type ChatKind = 'sector' | 'dm' | 'group';
export interface Chat {
  key: string; kind: ChatKind; id: string; g: boolean; n: string; i: string; hue: number; s: string;
  p?: string; mem: string[]; adm: string[]; desc: string; photo: string | null; cover: string | null;
  u: number; last: { t: string; at: string; me: boolean; from: string | null } | null;
  m: Msg[]; loaded: boolean; set: ChatSet; wp: string | null; canEdit: boolean; canSummary: boolean;
  sum?: Summary; welcome?: boolean;
}
export interface Notice { id: string; title: string; body: string; preview: string; at: string; unread: boolean; acked: boolean; pinned: boolean; author: string; priority: string }
export interface Ticket { id: string; t: string; s: string; c: string; d: string; who?: string | null }
export interface DeskTicket {
  id: number; label: string; companyId: string; companyName: string; reporterId: string; reporterName: string; reporterEmail: string;
  category: string; area: string; severity: string; description: string; screenshotPath: string | null; device: Row; status: string;
  assigneeId: string | null; assigneeName: string | null; createdAt: string; updatedAt: string;
}
export const TICKET_STATUS = ['Recebido', 'Em análise', 'Resolvido', 'Fechado'];
export const TICKET_COLOR: Record<string, string> = { Recebido: '#7cc6ff', 'Em análise': '#ffc36b', Resolvido: '#46d37b', Fechado: '#8b8b94' };
export interface Dashboard {
  tasksTotal: number; tasksDone: number; late: number; open: number; actions: number; activity: number[];
  counters: { msg: number; tasks: number; meet: number; late: number };
  nextMeeting: { time: string; room: string; title: string; inLabel: string; at: string } | null;
  chart: Record<'7' | '30', { v: number[]; l: string[]; p: string }>;
  meetToday: number; doneMonth: number;
}
export interface Birthdays {
  today: { personId: string; age: number | null }[];
  month: { label: string; count: number };
  upcoming: { personId: string; day: string; mon: string; inDays: number; age: number | null }[];
}
export type Prefs = Record<string, number>;
export const DEFAULT_PREFS: Prefs = {
  n: 1, nm: 1, nv: 1, nr: 1, ns: 0, ndm: 1, ngrp: 1, snd: 1, vib: 1, prev: 1, quiet: 0, theme: 0, red: 0,
  enter: 1, read: 1, vis: 0, showst: 1, showhr: 1, dl: 0,
};
export const DEFAULT_SET: ChatSet = { pin: false, mute: false, muteUntil: 0, muteDur: 2, fs: 1, ff: 0, col: 0, wall: 0 };

export interface Boot {
  me: Person; people: Record<string, Person>; chats: Chat[]; notices: Notice[]; dashboard: Dashboard;
  birthdays: Birthdays; tickets: Ticket[]; prefs: Prefs; companyId: string; isAdmin: boolean;
  canPostNotices: boolean; sectorsCount: number; supportStaff: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function toPerson(p: Row, sectors: Map<string, Row>, meId: string): Person {
  const name = p.display_name || p.name || 'Usuário';
  const days = Array.isArray(p.work_days) && p.work_days.length === 7 ? p.work_days.map((x: boolean) => (x ? 1 : 0)) : [1, 1, 1, 1, 1, 0, 0];
  const sec = p.sector_id ? sectors.get(p.sector_id) : null;
  return {
    id: p.id, userId: p.user_id, n: name, i: initials(name), hue: hueOf(p.id),
    role: ROLE_LABEL[p.autonomy_level] || 'Colaborador', dept: sec?.name || 'Sem setor', sectorId: p.sector_id,
    st: statusFromDb(p.user_status), h: [timeToHm(p.work_start, '08:00'), timeToHm(p.work_end, '17:00')], days,
    mail: p.email || '', bio: p.description || '', since: sinceLabel(p.created_at), photo: p.avatar_url || null,
    cover: p.cover_url || null, birth: p.birth_date || null, me: p.id === meId,
  };
}

const PROFILE_COLS = 'id,user_id,name,display_name,email,avatar_url,cover_url,description,sector_id,autonomy_level,birth_date,created_at,user_status,work_start,work_end,work_days,is_active,company_id';

function sectorReadKey(profileId: string, sectorId: string) { return `read:${profileId}:sector:${sectorId}`; }

function summaryFromRow(r: Row | null): Summary {
  const metrics: string[] = Array.isArray(r?.metrics) ? r.metrics : ['total_messages', 'pending_tasks', 'overdue_tasks'];
  const t = (r?.send_time || '08:00').slice(0, 5);
  return {
    id: r?.id, on: !!r?.is_active, h: t === '12:00' ? 1 : t === '18:00' ? 2 : 0, d: r?.weekdays_only ? 0 : 1,
    it: {
      msg: metrics.includes('total_messages'), pend: metrics.includes('pending_tasks'), late: metrics.includes('overdue_tasks'),
      done: metrics.includes('completed_on_time') || metrics.includes('completed_late'),
    },
  };
}

function setFromRow(r: Row | null): ChatSet {
  if (!r) return { ...DEFAULT_SET };
  const until = r.muted_until ? new Date(r.muted_until).getTime() : 0;
  return {
    pin: !!r.pinned, mute: !!r.muted, muteUntil: until, muteDur: r.muted ? (until ? 0 : 2) : 2,
    fs: r.font_size ?? 1, ff: r.font_family ?? 0, col: r.bubble_color ?? 0, wall: r.wallpaper ?? 0,
  };
}

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export async function bootstrap(opts: {
  profileId: string; companyId: string; isAdmin: boolean; accessibleSectorIds: string[]; canPostNotices: boolean;
}): Promise<Boot> {
  const { profileId, companyId, isAdmin } = opts;
  const { data: auth } = await sb.auth.getUser();
  const authUserId: string | undefined = auth?.user?.id;
  const now = new Date();
  const nowIso = now.toISOString();
  const today0 = startOfDay(now);
  const d30 = new Date(today0.getTime() - 34 * 864e5);
  const d7 = new Date(today0.getTime() - 6 * 864e5);

  const [profilesR, sectorsR, groupsR, prefsR, chatPrefsR, noticesR, readsR, ticketsR, staffR] = await Promise.all([
    sb.from('profiles').select(PROFILE_COLS).eq('company_id', companyId).eq('is_active', true).order('name'),
    sb.from('sectors').select('id,name,color,company_id').order('name'),
    sb.from('private_groups').select('id,name,description,avatar_url,cover_url,wallpaper,automations,created_by,updated_at').eq('company_id', companyId),
    sb.from('user_preferences').select('data').eq('profile_id', profileId).maybeSingle(),
    sb.from('chat_member_prefs').select('*').eq('profile_id', profileId),
    sb.from('announcements').select('id,title,content,priority,is_pinned,created_at,start_at,expire_at,author_id').eq('company_id', companyId)
      .or(`start_at.is.null,start_at.lte.${nowIso}`).or(`expire_at.is.null,expire_at.gt.${nowIso}`)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(60),
    authUserId ? sb.from('announcement_reads').select('announcement_id,acked_at').eq('user_id', authUserId) : Promise.resolve({ data: [] }),
    sb.from('support_tickets').select('id,description,category,status,created_at,assignee_name').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(30),
    sb.rpc('is_support_staff'),
  ]);

  const sectorRows: Row[] = (sectorsR.data || []).filter((s: Row) => !s.company_id || s.company_id === companyId || s.id === GERAL_SECTOR_ID);
  const sectorMap = new Map<string, Row>(sectorRows.map((s: Row) => [s.id, s]));
  const people: Record<string, Person> = {};
  for (const p of profilesR.data || []) people[p.id] = toPerson(p, sectorMap, profileId);
  if (!people[profileId]) {
    const { data: meRow } = await sb.from('profiles').select(PROFILE_COLS).eq('id', profileId).maybeSingle();
    if (meRow) people[profileId] = toPerson(meRow, sectorMap, profileId);
  }
  const me = people[profileId];
  if (!me) throw new Error('Perfil não encontrado');

  const prefs: Prefs = { ...DEFAULT_PREFS, ...((prefsR.data?.data as Prefs) || {}) };
  const chatPrefs = new Map<string, Row>((chatPrefsR.data || []).map((r: Row) => [r.chat_key, r]));

  // --- sectors the user can talk in
  const accessible = new Set(opts.accessibleSectorIds);
  accessible.add(GERAL_SECTOR_ID);
  if (me.sectorId) accessible.add(me.sectorId);
  const sectors = sectorRows.filter((s) => isAdmin || accessible.has(s.id));
  const sectorIds = sectors.map((s) => s.id);

  // --- groups
  const groups: Row[] = groupsR.data || [];
  const groupIds = groups.map((g) => g.id);

  const [sectorMsgsR, dmR, groupMsgsR, groupReadsR, summariesR, membersR] = await Promise.all([
    sectorIds.length ? sb.from('messages').select('id,sector_id,author_id,content,created_at').in('sector_id', sectorIds).eq('company_id', companyId).order('created_at', { ascending: false }).limit(400) : Promise.resolve({ data: [] }),
    sb.from('direct_messages').select('id,sender_id,receiver_id,content,is_read,created_at').eq('company_id', companyId).or(`sender_id.eq.${profileId},receiver_id.eq.${profileId}`).order('created_at', { ascending: false }).limit(800),
    groupIds.length ? sb.from('private_group_messages').select('id,group_id,sender_id,content,created_at').in('group_id', groupIds).order('created_at', { ascending: false }).limit(600) : Promise.resolve({ data: [] }),
    groupIds.length && authUserId ? sb.from('private_group_message_reads').select('group_id,last_read_at').eq('user_id', authUserId) : Promise.resolve({ data: [] }),
    sb.from('scheduled_summaries').select('*').eq('company_id', companyId).eq('frequency', 'daily'),
    groupIds.length ? sb.from('private_group_members').select('group_id,profile_id,user_id,role').in('group_id', groupIds) : Promise.resolve({ data: [] }),
  ]);
  const membersByGroup = new Map<string, Row[]>();
  for (const m of membersR.data || []) membersByGroup.set(m.group_id, [...(membersByGroup.get(m.group_id) || []), m]);
  const summaryByTarget = new Map<string, Row>((summariesR.data || []).map((r: Row) => [`${r.target_type}:${r.target_id}`, r]));

  const chats: Chat[] = [];
  const allIds = Object.keys(people);

  // sector chats
  const sectorLast = new Map<string, Row>();
  const sectorUnread = new Map<string, number>();
  for (const m of sectorMsgsR.data || []) {
    if (!sectorLast.has(m.sector_id)) sectorLast.set(m.sector_id, m);
    const readAt = safeStore.get<number>(sectorReadKey(profileId, m.sector_id), 0);
    if (m.author_id !== profileId && readAt && new Date(m.created_at).getTime() > readAt) sectorUnread.set(m.sector_id, (sectorUnread.get(m.sector_id) || 0) + 1);
  }
  for (const s of sectors) {
    const mem = s.id === GERAL_SECTOR_ID ? allIds : allIds.filter((id) => people[id].sectorId === s.id);
    const key = `sector:${s.id}`;
    const l = sectorLast.get(s.id);
    chats.push({
      key, kind: 'sector', id: s.id, g: true, n: s.name, i: initials(s.name), hue: hueFromColor(s.color, s.id), s: `${mem.length} membros`,
      mem, adm: mem.filter((id) => people[id].role === 'Administrador'), desc: s.id === GERAL_SECTOR_ID ? 'Canal geral da empresa: recados rápidos e conversas entre todos os setores.' : `Canal do setor ${s.name}.`,
      photo: null, cover: null, u: Math.min(sectorUnread.get(s.id) || 0, 99),
      last: l ? { t: l.content, at: l.created_at, me: l.author_id === profileId, from: l.author_id } : null,
      m: [], loaded: false, set: setFromRow(chatPrefs.get(key) || null), wp: null, canEdit: false, canSummary: isAdmin && s.id !== GERAL_SECTOR_ID,
      sum: summaryFromRow(summaryByTarget.get(key) || null),
    });
  }

  // direct chats (one per partner that already has messages)
  const dmByPartner = new Map<string, { last: Row; u: number }>();
  for (const m of dmR.data || []) {
    const partner = m.sender_id === profileId ? m.receiver_id : m.sender_id;
    if (!people[partner]) continue;
    const cur = dmByPartner.get(partner) || { last: m, u: 0 };
    if (m.receiver_id === profileId && !m.is_read) cur.u++;
    dmByPartner.set(partner, cur);
  }
  for (const [partner, v] of dmByPartner) chats.push(makeDm(people[partner], v.last, v.u, profileId, chatPrefs.get(`dm:${partner}`) || null));

  // private groups
  const groupLast = new Map<string, Row>();
  const groupReads = new Map<string, number>((groupReadsR.data || []).map((r: Row) => [r.group_id, new Date(r.last_read_at).getTime()]));
  const groupUnread = new Map<string, number>();
  for (const m of groupMsgsR.data || []) {
    if (!groupLast.has(m.group_id)) groupLast.set(m.group_id, m);
    const readAt = groupReads.get(m.group_id) || 0;
    if (m.sender_id !== profileId && new Date(m.created_at).getTime() > readAt) groupUnread.set(m.group_id, (groupUnread.get(m.group_id) || 0) + 1);
  }
  for (const g of groups) {
    const members: Row[] = membersByGroup.get(g.id) || [];
    if (!members.some((m) => m.profile_id === profileId)) continue;
    const key = `group:${g.id}`;
    const l = groupLast.get(g.id);
    const adm = members.filter((m) => m.role === 'admin').map((m) => m.profile_id);
    const wall = g.wallpaper || {};
    const set = setFromRow(chatPrefs.get(key) || null);
    if (!chatPrefs.get(key) && typeof wall.preset === 'number') set.wall = wall.preset;
    chats.push({
      key, kind: 'group', id: g.id, g: true, n: g.name, i: initials(g.name), hue: hueOf(g.id), s: `${members.length} membros`,
      mem: members.map((m) => m.profile_id).filter((id) => people[id]), adm, desc: g.description || '',
      photo: g.avatar_url || null, cover: g.cover_url || null, u: Math.min(groupUnread.get(g.id) || 0, 99),
      last: l ? { t: l.content, at: l.created_at, me: l.sender_id === profileId, from: l.sender_id } : { t: 'Grupo criado', at: g.updated_at, me: false, from: null },
      m: [], loaded: false, set, wp: wall.photo || null, canEdit: adm.includes(profileId) || isAdmin, canSummary: adm.includes(profileId) || isAdmin,
      sum: summaryFromRow(summaryByTarget.get(key) || null), welcome: g.automations?.welcome !== false,
    });
  }
  sortChats(chats);

  // --- notices
  const reads = new Map<string, Row>((readsR.data || []).map((r: Row) => [r.announcement_id, r]));
  const notices: Notice[] = (noticesR.data || []).map((a: Row) => {
    const body = String(a.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      id: a.id, title: a.title, body, preview: body.slice(0, 80), at: a.created_at, unread: !reads.has(a.id), acked: !!reads.get(a.id)?.acked_at,
      pinned: !!a.is_pinned, author: people[a.author_id]?.n || 'Administração', priority: a.priority || 'normal',
    };
  });

  // --- dashboard (only the signed-in user's own data)
  const dashboard = await loadDashboard(profileId, companyId, today0, d7, d30, chats);

  // --- birthdays
  const birthdays = computeBirthdays(people);

  const tickets: Ticket[] = (ticketsR.data || []).map(toTicket);

  return {
    me, people, chats, notices, dashboard, birthdays, tickets, prefs, companyId, isAdmin, canPostNotices: opts.canPostNotices,
    sectorsCount: sectors.length, supportStaff: staffR?.data === true,
  };
}

export function makeDm(p: Person, last: Row | null, u: number, meId: string, prefRow: Row | null): Chat {
  return {
    key: `dm:${p.id}`, kind: 'dm', id: p.id, g: false, p: p.id, n: p.n, i: p.i, hue: p.hue, s: p.dept, mem: [meId, p.id], adm: [], desc: '',
    photo: p.photo, cover: p.cover, u: Math.min(u, 99),
    last: last ? { t: last.content, at: last.created_at, me: last.sender_id === meId, from: last.sender_id } : null,
    m: [], loaded: false, set: setFromRow(prefRow), wp: null, canEdit: false, canSummary: false,
  };
}

export function sortChats(chats: Chat[]) {
  chats.sort((a, b) => {
    const ta = a.last ? new Date(a.last.at).getTime() : 0;
    const tb = b.last ? new Date(b.last.at).getTime() : 0;
    return tb - ta;
  });
}

function toTicket(r: Row): Ticket {
  const colors: Record<string, string> = { Recebido: '#7cc6ff', 'Em análise': '#ffc36b', Resolvido: '#46d37b', Fechado: '#8b8b94' };
  const d = String(r.description || r.category || '');
  const num = /^\d+$/.test(String(r.id)) ? String(r.id).padStart(4, '0') : String(r.id).slice(0, 6).toUpperCase();
  return { id: '#EW-' + num, t: d.slice(0, 38) + (d.length > 38 ? '…' : ''), s: r.status, c: colors[r.status] || '#7cc6ff', d: relDays(r.created_at), who: r.assignee_name || null };
}

async function loadDashboard(profileId: string, companyId: string, today0: Date, d7: Date, d30: Date, chats: Chat[]): Promise<Dashboard> {
  const now = new Date();
  const month0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const assigneeR = await sb.from('task_assignees').select('task_id').eq('profile_id', profileId).limit(1000);
  const extraIds: string[] = (assigneeR.data || []).map((r: Row) => r.task_id);
  const cols = 'id,due_date,completed_at,is_archived,status';
  const [ownR, extraR, bookingsR, partR, sentA, sentB, sentC] = await Promise.all([
    sb.from('tasks').select(cols).eq('assigned_to', profileId).eq('is_archived', false).limit(1000),
    extraIds.length ? sb.from('tasks').select(cols).in('id', extraIds.slice(0, 300)).eq('is_archived', false) : Promise.resolve({ data: [] }),
    sb.from('meeting_bookings').select('id,title,starts_at,ends_at,booked_by,room:meeting_rooms(name)').eq('company_id', companyId).gte('ends_at', today0.toISOString()).order('starts_at').limit(100),
    sb.from('meeting_booking_participants').select('booking_id').eq('profile_id', profileId).limit(500),
    sb.from('messages').select('created_at').eq('author_id', profileId).gte('created_at', d7.toISOString()).limit(1000),
    sb.from('direct_messages').select('created_at').eq('sender_id', profileId).gte('created_at', d7.toISOString()).limit(1000),
    sb.from('private_group_messages').select('created_at').eq('sender_id', profileId).gte('created_at', d7.toISOString()).limit(1000),
  ]);
  const seen = new Set<string>();
  const tasks: Row[] = [];
  for (const t of [...(ownR.data || []), ...(extraR.data || [])]) if (!seen.has(t.id)) { seen.add(t.id); tasks.push(t); }
  const done = (t: Row) => !!t.completed_at || t.status === 'done' || t.status === 'completed';
  const open = tasks.filter((t) => !done(t));
  const late = open.filter((t) => t.due_date && new Date(t.due_date) < now).length;
  const doneToday = tasks.filter((t) => t.completed_at && new Date(t.completed_at) >= today0).length;
  const doneMonth = tasks.filter((t) => t.completed_at && new Date(t.completed_at) >= month0).length;

  // completed per day (7) and per week (5)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const a = new Date(d7.getTime() + i * 864e5), b = new Date(a.getTime() + 864e5);
    return tasks.filter((t) => t.completed_at && new Date(t.completed_at) >= a && new Date(t.completed_at) < b).length;
  });
  const perWeek = Array.from({ length: 5 }, (_, i) => {
    const a = new Date(d30.getTime() + i * 7 * 864e5), b = new Date(a.getTime() + 7 * 864e5);
    return tasks.filter((t) => t.completed_at && new Date(t.completed_at) >= a && new Date(t.completed_at) < b).length;
  });
  const norm = (v: number[]) => { const mx = Math.max(...v, 1); return v.map((x) => Math.max(4, Math.round((x / mx) * 100))); };
  const rate = (n: number) => { const tot = n + open.length; return tot ? Math.round((n / tot) * 100) + '%' : '0%'; };
  const dayL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const dayLabels = Array.from({ length: 7 }, (_, i) => dayL[new Date(d7.getTime() + i * 864e5).getDay()]);

  // meetings where the user booked or participates
  const mine = new Set((partR.data || []).map((r: Row) => r.booking_id));
  const myBookings: Row[] = (bookingsR.data || []).filter((b: Row) => b.booked_by === profileId || mine.has(b.id));
  const meetToday = myBookings.filter((b) => new Date(b.starts_at) < new Date(today0.getTime() + 864e5)).length;
  const next = myBookings.find((b) => new Date(b.ends_at) > now) || null;
  let nextMeeting: Dashboard['nextMeeting'] = null;
  if (next) {
    const ms = new Date(next.starts_at).getTime() - now.getTime();
    const mins = Math.max(0, Math.round(ms / 60000));
    const inLabel = ms <= 0 ? 'agora' : mins < 60 ? `${mins} min` : mins < 24 * 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${Math.floor(mins / 1440)} d`;
    const st = new Date(next.starts_at);
    const sameDay = st.toDateString() === now.toDateString();
    nextMeeting = {
      time: (sameDay ? '' : `${String(st.getDate()).padStart(2, '0')}/${String(st.getMonth() + 1).padStart(2, '0')} `) + st.toTimeString().slice(0, 5),
      room: (Array.isArray(next.room) ? next.room[0]?.name : next.room?.name) || 'Sala de reunião', title: next.title || 'Reunião', inLabel, at: next.starts_at,
    };
  }

  // activity: messages sent per day over the last 7 days
  const sent = [...(sentA.data || []), ...(sentB.data || []), ...(sentC.data || [])];
  const activity = Array.from({ length: 7 }, (_, i) => {
    const a = new Date(d7.getTime() + i * 864e5), b = new Date(a.getTime() + 864e5);
    return sent.filter((r: Row) => new Date(r.created_at) >= a && new Date(r.created_at) < b).length;
  });
  const unread = chats.reduce((a, c) => a + c.u, 0);

  return {
    tasksTotal: open.length + doneToday, tasksDone: doneToday, late, open: open.length, actions: sent.length, activity,
    counters: { msg: unread, tasks: open.length, meet: meetToday, late },
    nextMeeting,
    chart: {
      7: { v: norm(perDay), l: dayLabels, p: rate(perDay.reduce((a, b) => a + b, 0)) },
      30: { v: norm(perWeek), l: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'], p: rate(perWeek.reduce((a, b) => a + b, 0)) },
    },
    meetToday, doneMonth,
  };
}

export function computeBirthdays(people: Record<string, Person>): Birthdays {
  const now = new Date();
  const today0 = startOfDay(now);
  const list: { personId: string; next: Date; age: number | null; month: number }[] = [];
  for (const p of Object.values(people)) {
    if (!p.birth) continue;
    const [y, mo, d] = p.birth.split('-').map((x) => parseInt(x, 10));
    if (!mo || !d) continue;
    let next = new Date(now.getFullYear(), mo - 1, d);
    if (next < today0) next = new Date(now.getFullYear() + 1, mo - 1, d);
    const age = y && y > 1900 ? next.getFullYear() - y : null;
    list.push({ personId: p.id, next, age, month: mo - 1 });
  }
  list.sort((a, b) => a.next.getTime() - b.next.getTime());
  const isToday = (d: Date) => d.getTime() === today0.getTime();
  return {
    today: list.filter((b) => isToday(b.next)).map((b) => ({ personId: b.personId, age: b.age })),
    month: { label: MONTHS_LONG[now.getMonth()], count: list.filter((b) => b.month === now.getMonth()).length },
    upcoming: list.filter((b) => !isToday(b.next)).slice(0, 12).map((b) => ({
      personId: b.personId, day: String(b.next.getDate()).padStart(2, '0'), mon: MONTHS_SHORT[b.next.getMonth()],
      inDays: Math.round((b.next.getTime() - today0.getTime()) / 864e5), age: b.age,
    })),
  };
}

// ---------------------------------------------------------------- messages

export async function loadMessages(chat: Chat, meId: string): Promise<Msg[]> {
  let rows: Row[] = [];
  if (chat.kind === 'sector') {
    const r = await sb.from('messages').select('id,author_id,content,created_at').eq('sector_id', chat.id).order('created_at', { ascending: false }).limit(60);
    rows = (r.data || []).map((m: Row) => ({ id: m.id, from: m.author_id, t: m.content, at: m.created_at }));
  } else if (chat.kind === 'dm') {
    // Both directions of the pair (sender/receiver are always me or the partner).
    const pair = [meId, chat.id];
    const r = await sb.from('direct_messages').select('id,sender_id,content,created_at')
      .in('sender_id', pair).in('receiver_id', pair)
      .order('created_at', { ascending: false }).limit(60);
    rows = (r.data || []).map((m: Row) => ({ id: m.id, from: m.sender_id, t: m.content, at: m.created_at }));
  } else {
    const r = await sb.from('private_group_messages').select('id,sender_id,content,created_at').eq('group_id', chat.id).order('created_at', { ascending: false }).limit(60);
    rows = (r.data || []).map((m: Row) => ({ id: m.id, from: m.sender_id, t: m.content, at: m.created_at }));
  }
  rows.reverse();
  const ids = rows.map((m) => m.id);
  const reactions = new Map<string, { r: string[]; mine: string[] }>();
  if (ids.length) {
    const rr = chat.kind === 'sector'
      ? await sb.from('message_reactions').select('message_id,emoji,profile_id').in('message_id', ids)
      : await sb.from('chat_reactions').select('message_id,emoji,profile_id').in('message_id', ids);
    for (const x of rr.data || []) {
      const cur = reactions.get(x.message_id) || { r: [], mine: [] };
      if (!cur.r.includes(x.emoji)) cur.r.push(x.emoji);
      if (x.profile_id === meId) cur.mine.push(x.emoji);
      reactions.set(x.message_id, cur);
    }
  }
  return rows.map((m) => toMsg(m, meId, reactions.get(m.id)));
}

export function toMsg(m: { id: string; from: string; t: string; at: string }, meId: string, rx?: { r: string[]; mine: string[] }): Msg {
  return { id: m.id, t: plainText(m.t), at: m.at, h: fmtTime(m.at), me: m.from === meId, from: m.from === meId ? null : m.from, r: rx?.r || [], mine: rx?.mine || [] };
}

/** Messages may contain light HTML/markdown from the desktop chat; the mobile bubbles show plain text. */
export function plainText(s: string): string {
  return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

export async function sendMessage(chat: Chat, meId: string, companyId: string, text: string): Promise<{ id: string; at: string }> {
  if (chat.kind === 'sector') {
    const r = await sb.from('messages').insert({ content: text, author_id: meId, sector_id: chat.id, company_id: companyId }).select('id,created_at').single();
    if (r.error) throw r.error;
    return { id: r.data.id, at: r.data.created_at };
  }
  if (chat.kind === 'dm') {
    const r = await sb.from('direct_messages').insert({ sender_id: meId, receiver_id: chat.id, content: text, company_id: companyId }).select('id,created_at').single();
    if (r.error) throw r.error;
    return { id: r.data.id, at: r.data.created_at };
  }
  const r = await sb.from('private_group_messages').insert({ group_id: chat.id, sender_id: meId, content: text }).select('id,created_at').single();
  if (r.error) throw r.error;
  void sb.from('private_groups').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);
  return { id: r.data.id, at: r.data.created_at };
}

export async function react(chat: Chat, messageId: string, emoji: string, add: boolean, meId: string) {
  const table = chat.kind === 'sector' ? 'message_reactions' : 'chat_reactions';
  if (add) {
    const row: Row = { message_id: messageId, profile_id: meId, emoji };
    if (chat.kind !== 'sector') row.chat_kind = chat.kind;
    const r = await sb.from(table).insert(row);
    if (r.error && r.error.code !== '23505') throw r.error;
  } else {
    const r = await sb.from(table).delete().eq('message_id', messageId).eq('profile_id', meId).eq('emoji', emoji);
    if (r.error) throw r.error;
  }
}

export async function markRead(chat: Chat, meId: string) {
  if (chat.kind === 'sector') {
    safeStore.set(sectorReadKey(meId, chat.id), Date.now());
    return;
  }
  if (chat.kind === 'dm') {
    await sb.from('direct_messages').update({ is_read: true }).eq('sender_id', chat.id).eq('receiver_id', meId).eq('is_read', false);
    return;
  }
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return;
  await sb.from('private_group_message_reads').upsert({ group_id: chat.id, user_id: auth.user.id, last_read_at: new Date().toISOString() }, { onConflict: 'group_id,user_id' });
}

/** Sector chats only start counting unread after the first visit on this device. */
export function primeSectorRead(meId: string, sectorId: string) {
  if (!safeStore.get<number>(sectorReadKey(meId, sectorId), 0)) safeStore.set(sectorReadKey(meId, sectorId), Date.now());
}

// ---------------------------------------------------------------- prefs

export async function saveChatPrefs(chat: Chat, s: ChatSet, meId: string, companyId: string) {
  const r = await sb.from('chat_member_prefs').upsert({
    profile_id: meId, company_id: companyId, chat_key: chat.key, pinned: s.pin, muted: s.mute, muted_until: s.mute && s.muteUntil ? new Date(s.muteUntil).toISOString() : null,
    font_size: s.fs, font_family: s.ff, bubble_color: s.col, wallpaper: s.wall, updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id,chat_key' });
  if (r.error) throw r.error;
}

export async function savePrefs(prefs: Prefs, meId: string, companyId: string) {
  const r = await sb.from('user_preferences').upsert({ profile_id: meId, company_id: companyId, data: prefs, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
  if (r.error) throw r.error;
}

// ---------------------------------------------------------------- profile

export async function setStatus(st: StatusKey, clearAfterMs: number | null) {
  const { data: auth } = await sb.auth.getUser();
  const r = await sb.from('profiles').update({
    user_status: STATUS_TO_DB[st], status_until: clearAfterMs ? new Date(Date.now() + clearAfterMs).toISOString() : null,
  }).eq('user_id', auth?.user?.id);
  if (r.error) throw r.error;
}

export async function updateMe(p: { bio: string; h: [string, string]; days: number[] }) {
  const { data: auth } = await sb.auth.getUser();
  const r = await sb.from('profiles').update({
    description: p.bio.slice(0, 140), work_start: p.h[0], work_end: p.h[1], work_days: p.days.map(Boolean),
  }).eq('user_id', auth?.user?.id);
  if (r.error) throw r.error;
}

/** Uploads an image to the public avatars bucket under the user's own folder and returns its URL. */
export async function uploadImage(file: File, kind: string, maxDimension = 1200): Promise<string> {
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Sessão expirada');
  const optimized = await optimizeImageFile(file, maxDimension);
  if (optimized.size > 2 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 2 MB)');
  const ext = (optimized.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uid}/ewwon-${kind}-${Date.now()}.${ext}`;
  const up = await sb.storage.from('avatars').upload(path, optimized, { cacheControl: '3600', upsert: true });
  if (up.error) throw up.error;
  return sb.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl as string;
}

export async function setMyImage(kind: 'avatar' | 'cover', url: string) {
  const { data: auth } = await sb.auth.getUser();
  const r = await sb.from('profiles').update(kind === 'avatar' ? { avatar_url: url } : { cover_url: url }).eq('user_id', auth?.user?.id);
  if (r.error) throw r.error;
}

// ---------------------------------------------------------------- groups

export async function updateGroup(chat: Chat, patch: { name: string; description: string; photo: string | null; cover: string | null; wall: number; wp: string | null; welcome?: boolean }) {
  const r = await sb.from('private_groups').update({
    name: patch.name.slice(0, 30), description: patch.description.slice(0, 160), avatar_url: patch.photo, cover_url: patch.cover,
    wallpaper: { preset: patch.wall, photo: patch.wp }, automations: { welcome: patch.welcome !== false }, updated_at: new Date().toISOString(),
  }).eq('id', chat.id);
  if (r.error) throw r.error;
}

export async function addGroupMember(chat: Chat, person: Person, meId: string, welcome: boolean) {
  const r = await sb.from('private_group_members').insert({ group_id: chat.id, user_id: person.userId, profile_id: person.id, role: 'member' });
  if (r.error) throw r.error;
  if (welcome) {
    await sb.from('private_group_messages').insert({ group_id: chat.id, sender_id: meId, content: `Boas-vindas, ${person.n.split(' ')[0]}! 👋` });
  }
}

export async function removeGroupMember(chat: Chat, personId: string) {
  const r = await sb.from('private_group_members').delete().eq('group_id', chat.id).eq('profile_id', personId);
  if (r.error) throw r.error;
}

export async function setGroupAdmin(chat: Chat, personId: string, admin: boolean) {
  const r = await sb.from('private_group_members').update({ role: admin ? 'admin' : 'member' }).eq('group_id', chat.id).eq('profile_id', personId);
  if (r.error) throw r.error;
}

export async function saveSummary(chat: Chat, s: Summary, companyId: string): Promise<string | undefined> {
  const metrics: string[] = [];
  if (s.it.msg) metrics.push('total_messages');
  if (s.it.pend) metrics.push('pending_tasks');
  if (s.it.late) metrics.push('overdue_tasks');
  if (s.it.done) metrics.push('completed_on_time', 'completed_late');
  const { data: auth } = await sb.auth.getUser();
  const row: Row = {
    target_type: chat.kind === 'sector' ? 'sector' : 'group', target_id: chat.id, frequency: 'daily',
    send_time: ['08:00', '12:00', '18:00'][s.h], metrics, format: 'text', is_active: s.on, weekdays_only: s.d === 0,
    company_id: companyId, updated_at: new Date().toISOString(),
  };
  if (s.id) {
    const r = await sb.from('scheduled_summaries').update(row).eq('id', s.id);
    if (r.error) throw r.error;
    return s.id;
  }
  const r = await sb.from('scheduled_summaries').insert({ ...row, created_by: auth?.user?.id }).select('id').single();
  if (r.error) throw r.error;
  return r.data.id;
}

// ---------------------------------------------------------------- notices, birthdays, support

export async function markNotice(id: string, ack: boolean) {
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return;
  const row: Row = { announcement_id: id, user_id: uid, read_at: new Date().toISOString() };
  if (ack) row.acked_at = new Date().toISOString();
  const r = await sb.from('announcement_reads').upsert(row, { onConflict: 'announcement_id,user_id' });
  if (r.error) throw r.error;
}

export async function createNotice(meId: string, companyId: string, title: string, content: string, pinned: boolean) {
  const r = await sb.from('announcements').insert({ title, content, author_id: meId, company_id: companyId, is_pinned: pinned, priority: pinned ? 'high' : 'normal' }).select('id,created_at').single();
  if (r.error) throw r.error;
  return r.data as { id: string; created_at: string };
}

export async function sendWishes(meId: string, companyId: string, personId: string, text: string) {
  const r = await sb.from('direct_messages').insert({ sender_id: meId, receiver_id: personId, content: text, company_id: companyId }).select('id,created_at').single();
  if (r.error) throw r.error;
  return { id: r.data.id as string, at: r.data.created_at as string };
}

export async function createTicket(t: { category: string; area: string; severity: string; description: string; screenshot: string | null; device: Row }, meId: string, companyId: string): Promise<Ticket> {
  let screenshot_path: string | null = null;
  if (t.screenshot) {
    const { data: auth } = await sb.auth.getUser();
    const blob = dataUrlToBlob(t.screenshot);
    const path = `${auth?.user?.id}/support/${Date.now()}.${blob.type.includes('png') ? 'png' : 'jpg'}`;
    const up = await sb.storage.from('attachments').upload(path, blob, { upsert: false, contentType: blob.type });
    if (!up.error) screenshot_path = up.data.path;
  }
  const r = await sb.from('support_tickets').insert({
    profile_id: meId, company_id: companyId, category: t.category, area: t.area, severity: t.severity, description: t.description, screenshot_path, device: t.device,
  }).select('id,description,category,status,created_at').single();
  if (r.error) throw r.error;
  return toTicket(r.data);
}

export async function registerDevice(token: string, platform: 'android' | 'ios' | 'web', appVersion: string, meId: string, companyId: string) {
  await sb.from('push_devices').upsert({ profile_id: meId, company_id: companyId, token, platform, app_version: appVersion, updated_at: new Date().toISOString() }, { onConflict: 'token' });
}

// ---------------------------------------------------------------- realtime

export interface RealtimeHandlers {
  onMessage: (kind: ChatKind, row: Row) => void;
  onReaction: (kind: 'sector' | 'other', row: Row, removed: boolean) => void;
  onNotice: (row: Row) => void;
  onProfile: (row: Row) => void;
}

export function subscribe(companyId: string, meId: string, h: RealtimeHandlers): () => void {
  const ch = sb.channel(`ewwon-${meId}-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${companyId}` }, (p: Row) => h.onMessage('sector', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `receiver_id=eq.${meId}` }, (p: Row) => h.onMessage('dm', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_group_messages' }, (p: Row) => h.onMessage('group', p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (p: Row) => h.onReaction('sector', p.eventType === 'DELETE' ? p.old : p.new, p.eventType === 'DELETE'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, (p: Row) => h.onReaction('other', p.eventType === 'DELETE' ? p.old : p.new, p.eventType === 'DELETE'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `company_id=eq.${companyId}` }, (p: Row) => h.onNotice(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `company_id=eq.${companyId}` }, (p: Row) => h.onProfile(p.new))
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}

// ---------------------------------------------------------------- support desk (system company)

export function ticketLabel(id: number | string) {
  return '#EW-' + (/^\d+$/.test(String(id)) ? String(id).padStart(4, '0') : String(id).slice(0, 6).toUpperCase());
}

export async function listDeskTickets(): Promise<DeskTicket[]> {
  const r = await sb.rpc('support_list_tickets');
  if (r.error) throw r.error;
  return (r.data || []).map((t: Row) => ({
    id: t.id, label: ticketLabel(t.id), companyId: t.company_id, companyName: t.company_name || '—', reporterId: t.reporter_id,
    reporterName: t.reporter_name || 'Usuário', reporterEmail: t.reporter_email || '', category: t.category, area: t.area || '—',
    severity: t.severity || '—', description: t.description, screenshotPath: t.screenshot_path, device: t.device, status: t.status,
    assigneeId: t.assignee_profile_id, assigneeName: t.assignee_name, createdAt: t.created_at, updatedAt: t.updated_at,
  }));
}

export async function updateDeskTicket(id: number, status: string | null, take: boolean) {
  const r = await sb.rpc('support_update_ticket', { _id: id, _status: status, _take: take });
  if (r.error) throw r.error;
  return r.data as Row;
}

export async function ticketScreenshotUrl(path: string): Promise<string | null> {
  const r = await sb.storage.from('attachments').createSignedUrl(path, 600);
  return r.error ? null : (r.data?.signedUrl as string);
}

export function subscribeTickets(onChange: (row: Row, isNew: boolean) => void): () => void {
  const ch = sb.channel(`ewwon-tickets-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, (p: Row) => onChange(p.new, p.eventType === 'INSERT'))
    .subscribe();
  return () => { void sb.removeChannel(ch); };
}

// ---------------------------------------------------------------- create groups

export async function createGroup(name: string, description: string, members: Person[], me: Person, companyId: string): Promise<string> {
  const { data: auth } = await sb.auth.getUser();
  const g = await sb.from('private_groups').insert({
    name: name.slice(0, 30), description: description.slice(0, 160), created_by: auth?.user?.id, company_id: companyId,
    automations: { welcome: true },
  }).select('id').single();
  if (g.error) throw g.error;
  const id = g.data.id as string;
  // The creator joins first (allowed while the group is empty) and becomes its admin.
  const self = await sb.from('private_group_members').insert({ group_id: id, user_id: me.userId, profile_id: me.id, role: 'admin' });
  if (self.error) throw self.error;
  if (members.length) {
    const r = await sb.from('private_group_members').insert(members.map((p) => ({ group_id: id, user_id: p.userId, profile_id: p.id, role: 'member' })));
    if (r.error) throw r.error;
  }
  return id;
}
