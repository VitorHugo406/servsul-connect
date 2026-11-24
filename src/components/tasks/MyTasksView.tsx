// "Minhas tarefas" (Tarefas › Minhas tarefas): every open card of the signed-in person from ALL murals they can see
// (assigned_to = me, or co-assignee in task_assignees), grouped Atrasadas / Hoje / Próximos 7 dias / Depois / Sem prazo,
// plus "Concluídas nos últimos 7 dias". Filters by mural and search. Clicking a card opens its mural with the card
// (`?abrir=<task id>`). Read-only list: changes happen in the card itself (same rules as the kanban).
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';
import '@/styles/my-tasks.css';

const db = supabase as any;
type R = { id: string; task_number: number | null; title: string; due_date: string | null; completed_at: string | null; priority: string | null; board_id: string; status: string };
type G = 'late' | 'today' | 'week' | 'later' | 'none' | 'done';
const GL: Record<G, string> = { late: 'Atrasadas', today: 'Hoje', week: 'Próximos 7 dias', later: 'Depois', none: 'Sem prazo', done: 'Concluídas nos últimos 7 dias' };
const PRIO: Record<string, [string, string]> = { urgent: ['Urgente', '#e5484d'], high: ['Alta', '#f76b15'], medium: ['Média', '#d9a400'], low: ['Baixa', '#30a46c'] };
const pill = (c: string) => ({ background: `color-mix(in srgb, ${c} 16%, hsl(var(--card)))`, color: `color-mix(in srgb, ${c} 80%, hsl(var(--foreground)))` });

export function MyTasksView({ boards, onBack, onOpenTask }: { boards: { id: string; name: string }[]; onBack: () => void; onOpenTask: (boardId: string, taskId: string) => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<R[]>([]);
  const [cols, setCols] = useState<Map<string, { title: string; color: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(''); const [board, setBoard] = useState('');
  const [closed, setClosed] = useState<Set<G>>(new Set(['done']));

  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    void (async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const sel = 'id, task_number, title, due_date, completed_at, priority, board_id, status';
      const { data: co } = await db.from('task_assignees').select('task_id').eq('profile_id', profile.id).limit(2000);
      const coIds = (co || []).map((r: { task_id: string }) => r.task_id);
      const base = () => db.from('tasks').select(sel).eq('is_archived', false).eq('is_template', false).not('board_id', 'is', null);
      const [a, b] = await Promise.all([
        base().eq('assigned_to', profile.id).limit(2000),
        coIds.length ? base().in('id', coIds.slice(0, 900)) : Promise.resolve({ data: [] }),
      ]);
      const map = new Map<string, R>(); for (const t of [...(a.data || []), ...(b.data || [])]) if (!t.completed_at || t.completed_at >= since) map.set(t.id, t);
      const list = [...map.values()];
      const boardIds = [...new Set(list.map((t) => t.board_id))];
      const { data: cs } = boardIds.length ? await db.from('task_board_columns').select('id, title, color, is_conclusion').in('board_id', boardIds) : { data: [] };
      if (!alive) return;
      const cm = new Map<string, { title: string; color: string | null }>(); const concl = new Set<string>();
      for (const c of cs || []) { cm.set(c.id, { title: c.title, color: c.color }); if (c.is_conclusion) concl.add(c.id); }
      // a card sitting in a conclusion column counts as done even without completed_at
      setRows(list.map((t) => (concl.has(t.status) && !t.completed_at ? { ...t, completed_at: t.due_date || new Date().toISOString() } : t)));
      setCols(cm); setLoading(false);
    })();
    return () => { alive = false; };
  }, [profile?.id]);

  const bname = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards]);
  const groups = useMemo(() => {
    const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const end = new Date(start.getTime() + 864e5); const week = new Date(start.getTime() + 8 * 864e5);
    const f = q.trim().toLowerCase();
    const out: Record<G, R[]> = { late: [], today: [], week: [], later: [], none: [], done: [] };
    for (const t of rows) {
      if (board && t.board_id !== board) continue;
      if (f && !t.title.toLowerCase().includes(f) && !(bname.get(t.board_id) || '').toLowerCase().includes(f)) continue;
      if (t.completed_at) { out.done.push(t); continue; }
      if (!t.due_date) { out.none.push(t); continue; }
      const d = new Date(t.due_date);
      if (d < now && d < start) out.late.push(t); else if (d < now) out.late.push(t); else if (d < end) out.today.push(t); else if (d < week) out.week.push(t); else out.later.push(t);
    }
    for (const k of Object.keys(out) as G[]) out[k].sort((x, y) => k === 'done' ? (y.completed_at || '').localeCompare(x.completed_at || '') : (x.due_date || '9').localeCompare(y.due_date || '9'));
    return out;
  }, [rows, q, board, bname]);
  const open = rows.filter((t) => !t.completed_at).length;
  const fmt = (d: string) => { const x = new Date(d); const t = x.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', ''); return (x.getHours() || x.getMinutes()) ? `${t}, ${x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : t; };

  const kpis: [G | 'open', string, number][] = [['open', 'Em aberto', open], ['late', 'Atrasadas', groups.late.length], ['today', 'Vencem hoje', groups.today.length], ['week', 'Próximos 7 dias', groups.week.length], ['done', 'Concluídas (7 dias)', groups.done.length]];
  const jump = (g: G | 'open') => { if (g === 'open') return; setClosed((s) => { const n = new Set(s); n.delete(g); return n; }); requestAnimationFrame(() => document.getElementById('mt2-' + g)?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const dueCls = (t: R, g: G) => t.completed_at ? 'ok' : g === 'late' ? 'late' : g === 'today' ? 'soon' : '';

  return (
    <div className="mt2">
      <header className="mt2-head">
        <button type="button" className="mt2-back" onClick={onBack} aria-label="Voltar aos murais"><ArrowLeft className="h-4 w-4" /></button>
        <div className="mt2-ttl"><h1>Minhas tarefas</h1><p>Seus cards de todos os murais, organizados por prazo</p></div>
        <span className="mt2-sp" />
        <label className="mt2-srch"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card ou mural" aria-label="Buscar" /></label>
        <Sel value={board} onChange={(e) => setBoard(e.target.value)} className="ui-sel min-w-[190px]"><option value="">Todos os murais</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
        <ExportMenu getData={() => ({ name: 'minhas-tarefas', sheet: 'Minhas tarefas', headers: ['Grupo', 'Número', 'Card', 'Mural', 'Status', 'Prioridade', 'Prazo'],
          rows: (Object.keys(GL) as G[]).flatMap((g) => groups[g].map((t) => [GL[g], t.task_number ?? '', t.title, bname.get(t.board_id) || '', cols.get(t.status)?.title || '', (PRIO[t.priority || 'medium'] || PRIO.medium)[0], t.completed_at ? 'Concluída' : t.due_date ? new Date(t.due_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''])) })} />
      </header>
      <div className="mt2-body">
        <div className="mt2-kpis">
          {kpis.map(([k, l, n]) => <button key={k} type="button" className={`mt2-kpi k-${k}`} onClick={() => jump(k)}><span>{l}</span><b>{n}</b></button>)}
        </div>
        {loading ? <div className="mt2-empty"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : !rows.length ? (
          <div className="mt2-empty"><b>Nenhum card com você</b>Quando alguém colocar você como responsável de um card, ele aparece aqui, de todos os murais.</div>
        ) : (Object.keys(GL) as G[]).map((g) => {
          const list = groups[g]; if (!list.length) return null; const isClosed = closed.has(g);
          return (
            <section key={g} id={'mt2-' + g} className={`mt2-sec s-${g}`}>
              <button type="button" className="mt2-sh" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })} aria-expanded={!isClosed}>
                <ChevronRight className={`mt2-chev h-4 w-4 ${isClosed ? '' : 'open'}`} /><i />{GL[g]}<span className="mt2-n">{list.length}</span>
              </button>
              {isClosed ? null : (
                <div className="mt2-list">
                  {list.map((t) => {
                    const c = cols.get(t.status); const p = PRIO[t.priority || 'medium'] || PRIO.medium;
                    return (
                      <button key={t.id} type="button" className={`mt2-row ${t.completed_at ? 'done' : ''}`} onClick={() => onOpenTask(t.board_id, t.id)}>
                        <span className={`mt2-chk ${t.completed_at ? 'on' : ''}`}><Check className="h-3 w-3" strokeWidth={3} /></span>
                        <span className="mt2-main"><span className="mt2-t">{t.title}</span><span className="mt2-sub">{t.task_number ? `#${t.task_number} · ` : ''}{bname.get(t.board_id) || 'Mural'}</span></span>
                        {c ? <span className="mt2-pill" style={pill(c.color || '#8b93a7')}><i style={{ background: c.color || '#8b93a7' }} />{c.title}</span> : <span />}
                        <span className="mt2-pill" style={pill(p[1])}>{p[0]}</span>
                        <span className={`mt2-due ${dueCls(t, g)}`}>{t.completed_at ? 'Concluída' : t.due_date ? fmt(t.due_date) : 'Sem prazo'}</span>
                        <ChevronRight className="mt2-go h-4 w-4" />
                      </button>);
                  })}
                </div>)}
            </section>);
        })}
      </div>
    </div>
  );
}
