// Personal calendar feed (iCal / .ics) for Google Agenda, Outlook and iPhone: GET /ical?t=<token>.
// The token comes from calendar_feeds (RPC my_calendar_feed, "Agenda no celular" in Calendário). The feed holds the
// person's cards with a due date (assigned to them, directly or as co-assignee) and their calendar events/meetings,
// from 60 days ago to one year ahead. Read-only, no JWT: the 40-hex token is the credential; regenerate to revoke.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE = 'https://ewvon.com';
const esc = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = (line: string) => { const out: string[] = []; let s = line; while (new TextEncoder().encode(s).length > 74) { let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); };
/** local date parts in São Paulo */
const sp = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get('t') || '').replace(/\.ics$/, '');
  if (!/^[0-9a-f]{40}$/.test(token)) return new Response('Link inválido', { status: 404 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: feed } = await db.from('calendar_feeds').select('profile_id').eq('token', token).maybeSingle();
  if (!feed) return new Response('Link inválido ou desativado', { status: 404 });
  const { data: me } = await db.from('profiles').select('id, user_id, company_id, is_active, name, display_name').eq('id', feed.profile_id).maybeSingle();
  if (!me || !me.is_active) return new Response('Link desativado', { status: 404 });
  void db.from('calendar_feeds').update({ last_at: new Date().toISOString() }).eq('profile_id', me.id);

  const from = new Date(Date.now() - 60 * 864e5).toISOString(); const to = new Date(Date.now() + 366 * 864e5).toISOString();
  const { data: co } = await db.from('task_assignees').select('task_id').eq('profile_id', me.id).limit(2000);
  const coIds = (co || []).map((r: any) => r.task_id);
  const sel = 'id, task_number, title, description, due_date, completed_at, board_id, status, priority';
  const q1 = db.from('tasks').select(sel).eq('company_id', me.company_id).eq('assigned_to', me.id).eq('is_archived', false).eq('is_template', false).gte('due_date', from).lte('due_date', to).limit(2000);
  const q2 = coIds.length ? db.from('tasks').select(sel).eq('company_id', me.company_id).in('id', coIds.slice(0, 1000)).eq('is_archived', false).eq('is_template', false).gte('due_date', from).lte('due_date', to) : Promise.resolve({ data: [] });
  const { data: parts } = await db.from('meeting_participants').select('event_id').eq('profile_id', me.id).limit(2000);
  const evIds = (parts || []).map((r: any) => r.event_id);
  const evSel = 'id, title, description, start_date, end_date, all_day, meeting_link, task_id';
  const e1 = db.from('calendar_events').select(evSel).eq('company_id', me.company_id).eq('created_by', me.user_id).gte('start_date', from).lte('start_date', to).limit(2000);
  const e2 = evIds.length ? db.from('calendar_events').select(evSel).eq('company_id', me.company_id).in('id', evIds.slice(0, 1000)).gte('start_date', from).lte('start_date', to) : Promise.resolve({ data: [] });
  const [r1, r2, r3, r4] = await Promise.all([q1, q2, e1, e2]);
  const tasks = new Map<string, any>(); for (const t of [...((r1 as any).data || []), ...((r2 as any).data || [])]) tasks.set(t.id, t);
  const events = new Map<string, any>(); for (const e of [...((r3 as any).data || []), ...((r4 as any).data || [])]) events.set(e.id, e);
  const boardIds = [...new Set([...tasks.values()].map((t) => t.board_id).filter(Boolean))];
  const { data: boards } = boardIds.length ? await db.from('task_boards').select('id, name').in('id', boardIds) : { data: [] };
  const bname = new Map((boards || []).map((b: any) => [b.id, b.name]));

  const now = utc(new Date());
  const L: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ewvon//Agenda//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('ewvon — ' + (me.display_name || me.name))}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  for (const t of tasks.values()) {
    const d = new Date(t.due_date); const p = sp(d); const allDay = p.hour === '00' && p.minute === '00';
    const link = `${SITE}/tarefas?board=${t.board_id}&task=${t.id}`;
    L.push('BEGIN:VEVENT', `UID:task-${t.id}@ewvon.com`, `DTSTAMP:${now}`);
    if (allDay) { const ds = `${p.year}${p.month}${p.day}`; const n = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + 1)); L.push(`DTSTART;VALUE=DATE:${ds}`, `DTEND;VALUE=DATE:${n.toISOString().slice(0, 10).replace(/-/g, '')}`); }
    else L.push(`DTSTART:${utc(d)}`, `DTEND:${utc(new Date(d.getTime() + 30 * 60e3))}`);
    L.push(`SUMMARY:${esc(`${t.completed_at ? '✅ ' : '📌 '}#${t.task_number ?? ''} ${t.title}`)}`,
      `DESCRIPTION:${esc(`Mural: ${bname.get(t.board_id) || ''}\n${(t.description || '').replace(/<[^>]+>/g, ' ').slice(0, 800)}\n\nAbrir no ewvon: ${link}`)}`,
      `URL:${link}`, `STATUS:${t.completed_at ? 'CONFIRMED' : 'TENTATIVE'}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  for (const e of events.values()) {
    const s = new Date(e.start_date); const en = e.end_date ? new Date(e.end_date) : new Date(s.getTime() + 60 * 60e3);
    L.push('BEGIN:VEVENT', `UID:event-${e.id}@ewvon.com`, `DTSTAMP:${now}`);
    if (e.all_day) { const a = sp(s); const b = sp(new Date(Math.max(en.getTime(), s.getTime()) + 864e5)); L.push(`DTSTART;VALUE=DATE:${a.year}${a.month}${a.day}`, `DTEND;VALUE=DATE:${b.year}${b.month}${b.day}`); }
    else L.push(`DTSTART:${utc(s)}`, `DTEND:${utc(en > s ? en : new Date(s.getTime() + 30 * 60e3))}`);
    L.push(`SUMMARY:${esc(e.title || 'Evento')}`, `DESCRIPTION:${esc(`${(e.description || '').slice(0, 800)}${e.meeting_link ? `\n\nLink: ${e.meeting_link}` : ''}`)}`);
    if (e.meeting_link && /^https:\/\//.test(e.meeting_link)) L.push(`URL:${e.meeting_link}`);
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return new Response(L.map(fold).join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="ewvon.ics"', 'Cache-Control': 'private, max-age=300' } });
});
