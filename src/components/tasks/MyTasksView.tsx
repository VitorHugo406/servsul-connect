// "Minhas tarefas" (Tarefas › Minhas tarefas): every open card of the signed-in person from ALL murals they can see
// (assigned_to = me, or co-assignee in task_assignees), grouped Atrasadas / Hoje / Próximos 7 dias / Depois / Sem prazo,
// plus "Concluídas nos últimos 7 dias". Filters by mural and search. Clicking a card opens its mural with the card
// (`?abrir=<task id>`). Read-only list: changes happen in the card itself (same rules as the kanban).
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sel } from '@/components/ui/Sel';
import '@/styles/board-views.css';

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

  return (
    <div className="mt-pg">
      <div className="bvx" style={{ height: '100%' }}>
        <div className="bvx-bar">
          <button type="button" className="bvx-btn bvx-ibtn" onClick={onBack} aria-label="Voltar aos murais"><ArrowLeft className="h-4 w-4" /></button>
          <b>Minhas tarefas</b>
          <span className="bvx-mut">{open} em aberto · {groups.late.length} atrasada(s)</span>
          <span className="bvx-sp" />
          <label className="mt-srch"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card ou mural" aria-label="Buscar" /></label>
          <Sel value={board} onChange={(e) => setBoard(e.target.value)} className="ui-sel min-w-[180px]"><option value="">Todos os murais</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
        </div>
        <div className="bvx-scroll">
          {loading ? <div className="bvx-empty"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : !rows.length ? (
            <div className="bvx-empty"><b style={{ display: 'block', color: 'hsl(var(--foreground))', fontSize: 15, marginBottom: 4 }}>Nenhum card com você</b>Quando alguém colocar você como responsável de um card, ele aparece aqui — de todos os murais.</div>
          ) : (Object.keys(GL) as G[]).map((g) => {
            const list = groups[g]; if (!list.length && g !== 'today') return null; const isClosed = closed.has(g);
            return (
              <section key={g} className={`mt-sec mt-${g}`}>
                <button type="button" className="mt-h" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                  {isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{GL[g]}<span className="bvx-n">{list.length}</span>
                </button>
                {isClosed ? null : !list.length ? <p className="mt-none">Nada para hoje.</p> : list.map((t) => {
                  const c = cols.get(t.status); const p = PRIO[t.priority || 'medium'] || PRIO.medium;
                  return (
                    <button key={t.id} type="button" className={`mt-row ${t.completed_at ? 'done' : ''}`} onClick={() => onOpenTask(t.board_id, t.id)}>
                      <span className={`bvx-chk ${t.completed_at ? 'on' : ''}`}><Check className="h-3 w-3" strokeWidth={3} /></span>
                      {t.task_number ? <span className="bvx-num">#{t.task_number}</span> : null}
                      <span className="mt-t">{t.title}</span>
                      <span className="mt-b" title="Mural">{bname.get(t.board_id) || 'Mural'}</span>
                      <span className="bvx-pill" style={pill(c?.color || '#8b93a7')}>{c?.title || '—'}</span>
                      <span className="bvx-pill" style={pill(p[1])}>{p[0]}</span>
                      <span className={`mt-d ${g === 'late' ? 'bvx-late' : ''}`}>{t.completed_at ? 'Concluída' : t.due_date ? fmt(t.due_date) : '—'}</span>
                    </button>);
                })}
              </section>);
          })}
        </div>
      </div>
    </div>
  );
}
