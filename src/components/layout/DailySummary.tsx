// "Seu dia" (PC): once a day, on the first desktop visit after 05:00, a short summary of the person's cards
// (atrasados, vencem hoje), approvals waiting for them and today's calendar events. Only shows when there is
// something; "Não mostrar automaticamente" turns it off for this browser (localStorage `ewvon:daily-off:<profile>`).
// Also opens on demand with the window event `ewvon:daily-summary`.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, BadgeCheck, CalendarDays, CircleAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type C = { id: string; title: string; task_number: number | null; board_id: string; due_date: string };
type Ev = { title: string; start_date: string };
const db = supabase as any;
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage off */ } } };

export function DailySummary() {
  const { profile, user } = useAuth(); const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ late: C[]; today: C[]; approvals: { task_id: string; title: string; board_id: string }[]; events: Ev[]; boards: Map<string, string> } | null>(null);

  const load = async (force: boolean) => {
    if (!profile?.id) return;
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const end = new Date(start.getTime() + 864e5);
    const { data: co } = await db.from('task_assignees').select('task_id').eq('profile_id', profile.id).limit(1000);
    const ids = (co || []).map((r: { task_id: string }) => r.task_id);
    const base = () => db.from('tasks').select('id,title,task_number,board_id,due_date,status').is('completed_at', null).eq('is_template', false).eq('is_archived', false).not('board_id', 'is', null).not('due_date', 'is', null).lt('due_date', end.toISOString());
    const [a, b, ap, ev] = await Promise.all([
      base().eq('assigned_to', profile.id).limit(300),
      ids.length ? base().in('id', ids.slice(0, 500)) : Promise.resolve({ data: [] }),
      db.from('task_approvals').select('task_id').eq('approver_id', profile.id).eq('status', 'pending').limit(50),
      db.from('calendar_events').select('title,start_date').eq('created_by', user?.id || '').gte('start_date', start.toISOString()).lt('start_date', end.toISOString()).order('start_date').limit(10),
    ]);
    const m = new Map<string, C & { status: string }>(); for (const t of [...(a.data || []), ...(b.data || [])]) m.set(t.id, t);
    let cards = [...m.values()];
    // cards already in a conclusion column count as done
    const bids = [...new Set(cards.map((c) => c.board_id))];
    const apIds = ((ap.data || []) as { task_id: string }[]).map((x) => x.task_id);
    const { data: apTasks } = apIds.length ? await db.from('tasks').select('id,title,board_id').in('id', apIds) : { data: [] };
    const allB = [...new Set([...bids, ...((apTasks || []) as { board_id: string }[]).map((x) => x.board_id)])];
    const [{ data: cols }, { data: bs }] = await Promise.all([
      bids.length ? db.from('task_board_columns').select('id').in('board_id', bids).eq('is_conclusion', true) : Promise.resolve({ data: [] }),
      allB.length ? db.from('task_boards').select('id,name').in('id', allB) : Promise.resolve({ data: [] }),
    ]);
    const concl = new Set(((cols || []) as { id: string }[]).map((c) => c.id));
    cards = cards.filter((c) => !concl.has(c.status)).sort((x, y) => x.due_date.localeCompare(y.due_date));
    const res = { late: cards.filter((c) => new Date(c.due_date) < now), today: cards.filter((c) => new Date(c.due_date) >= now), approvals: ((apTasks || []) as { id: string; title: string; board_id: string }[]).map((t) => ({ task_id: t.id, title: t.title, board_id: t.board_id })), events: (ev.data || []) as Ev[], boards: new Map(((bs || []) as { id: string; name: string }[]).map((x) => [x.id, x.name])) };
    setData(res);
    const any = res.late.length + res.today.length + res.approvals.length + res.events.length > 0;
    if (force || any) setOpen(true);
  };

  useEffect(() => {
    if (!profile?.id) return;
    const day = new Date().toLocaleDateString('sv-SE'); const k = `ewvon:daily-seen:${profile.id}`;
    const off = store.get(`ewvon:daily-off:${profile.id}`) === '1';
    const t = window.setTimeout(() => { if (!off && new Date().getHours() >= 5 && store.get(k) !== day) { store.set(k, day); void load(false); } }, 2500);
    const h = () => void load(true); window.addEventListener('ewvon:daily-summary', h);
    return () => { window.clearTimeout(t); window.removeEventListener('ewvon:daily-summary', h); };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const go = (boardId: string, taskId: string) => { const n = data.boards.get(boardId) || 'mural'; setOpen(false); navigate(`/tarefas/${slug(n)}-${boardId}?abrir=${taskId}`); };
  const hm = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dm = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const first = (profile?.display_name || profile?.name || '').split(' ')[0];
  const h = new Date().getHours(); const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const Sec = ({ icon: I, title, tone, children, n }: { icon: typeof AlarmClock; title: string; tone?: string; children: React.ReactNode; n: number }) => n ? (
    <section className="space-y-1"><h4 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${tone || 'text-muted-foreground'}`}><I className="h-3.5 w-3.5" />{title} · {n}</h4>{children}</section>) : null;
  const Row = ({ c, right }: { c: C; right: string }) => (
    <button type="button" onClick={() => go(c.board_id, c.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
      <span className="text-xs text-muted-foreground">#{c.task_number}</span><span className="min-w-0 flex-1 truncate">{c.title}</span><span className="truncate text-xs text-muted-foreground">{data.boards.get(c.board_id)}</span><span className="w-12 text-right text-xs">{right}</span>
    </button>);
  const empty = !data.late.length && !data.today.length && !data.approvals.length && !data.events.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-4">
        <div><DialogTitle className="text-lg">{hello}{first ? `, ${first}` : ''}</DialogTitle><p className="text-sm text-muted-foreground">Seu dia em um resumo.</p></div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {empty ? <p className="py-6 text-center text-sm text-muted-foreground">Nada pendente para hoje.</p> : null}
          <Sec icon={CircleAlert} title="Atrasados" tone="text-red-600 dark:text-red-400" n={data.late.length}>{data.late.slice(0, 8).map((c) => <Row key={c.id} c={c} right={dm(c.due_date)} />)}</Sec>
          <Sec icon={AlarmClock} title="Vencem hoje" n={data.today.length}>{data.today.slice(0, 8).map((c) => <Row key={c.id} c={c} right={hm(c.due_date)} />)}</Sec>
          <Sec icon={BadgeCheck} title="Esperando sua aprovação" n={data.approvals.length}>{data.approvals.map((a) => (
            <button key={a.task_id} type="button" onClick={() => go(a.board_id, a.task_id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"><span className="min-w-0 flex-1 truncate">{a.title}</span><span className="truncate text-xs text-muted-foreground">{data.boards.get(a.board_id)}</span></button>))}</Sec>
          <Sec icon={CalendarDays} title="Agenda de hoje" n={data.events.length}>{data.events.map((e, i) => <div key={i} className="flex items-center gap-2 px-2 py-1 text-sm"><span className="w-12 text-xs text-muted-foreground">{hm(e.start_date)}</span><span className="truncate">{e.title}</span></div>)}</Sec>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { if (profile?.id) store.set(`ewvon:daily-off:${profile.id}`, '1'); setOpen(false); }}>Não mostrar automaticamente</button>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setOpen(false); navigate('/calendario'); }}>Abrir calendário</Button><Button size="sm" onClick={() => setOpen(false)}>Ok</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
