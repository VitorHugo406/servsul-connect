// Tarefas › "Visão geral" (/tarefas/visao-geral): every mural the person can open, side by side — KPIs across
// all murals, one row per mural (progresso, em aberto, atrasados, vencem em 7 dias, concluídos em 30 dias,
// situação) and the late cards of all murals. Read-only; clicking opens the mural or the card. Cards in a
// conclusion column count as done (same rule as the mural list). Styles: board-views.css (bvx-/in-/pf-).
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import '@/styles/board-views.css';

type B = { id: string; name: string };
type T = { id: string; title: string; task_number: number | null; board_id: string; status: string; due_date: string | null; completed_at: string | null; completed_late: boolean | null };
type Row = { b: B; total: number; done: number; open: number; late: number; week: number; done30: number; pct: number };
type K = 'name' | 'pct' | 'open' | 'late' | 'week' | 'done30';
const db = supabase as any;
const DAY = 864e5;

export function PortfolioView({ boards, onBack, onOpenBoard, onOpenTask }: { boards: B[]; onBack: () => void; onOpenBoard: (id: string) => void; onOpenTask: (boardId: string, taskId: string) => void }) {
  const [tasks, setTasks] = useState<T[] | null>(null);
  const [concl, setConcl] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: K; asc: boolean }>({ k: 'late', asc: false });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const ids = boards.map((b) => b.id); if (!ids.length) { setTasks([]); return; }
      const out: T[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const part = ids.slice(i, i + 50);
        for (let from = 0; from < 20000; from += 1000) {
          const { data } = await db.from('tasks').select('id,title,task_number,board_id,status,due_date,completed_at,completed_late').in('board_id', part).eq('is_template', false).eq('is_archived', false).range(from, from + 999);
          out.push(...(data || [])); if (!data || data.length < 1000) break;
        }
      }
      const { data: cs } = await db.from('task_board_columns').select('id').in('board_id', ids).eq('is_conclusion', true);
      if (!alive) return;
      setConcl(new Set(((cs || []) as { id: string }[]).map((c) => c.id))); setTasks(out);
    })();
    return () => { alive = false; };
  }, [boards]);

  const now = Date.now();
  const done = (t: T) => !!t.completed_at || concl.has(t.status);
  const isLate = (t: T) => !done(t) && !!t.due_date && +new Date(t.due_date) < now;
  const rows = useMemo<Row[]>(() => {
    if (!tasks) return [];
    const by = new Map<string, T[]>(); for (const t of tasks) { const a = by.get(t.board_id) || []; a.push(t); by.set(t.board_id, a); }
    return boards.map((b) => { const ts = by.get(b.id) || []; const d = ts.filter(done).length;
      return { b, total: ts.length, done: d, open: ts.length - d, late: ts.filter(isLate).length, week: ts.filter((t) => !done(t) && t.due_date && +new Date(t.due_date) >= now && +new Date(t.due_date) < now + 7 * DAY).length, done30: ts.filter((t) => t.completed_at && +new Date(t.completed_at) > now - 30 * DAY).length, pct: ts.length ? Math.round((d / ts.length) * 100) : 0 }; });
  }, [tasks, boards, concl]); // eslint-disable-line react-hooks/exhaustive-deps

  const f = q.trim().toLowerCase();
  const list = rows.filter((r) => !f || r.b.name.toLowerCase().includes(f)).sort((x, y) => { const a = sort.k === 'name' ? x.b.name.toLowerCase() : x[sort.k]; const b = sort.k === 'name' ? y.b.name.toLowerCase() : y[sort.k]; const r = a < b ? -1 : a > b ? 1 : 0; return sort.asc ? r : -r; });
  const tot = rows.reduce((a, r) => ({ open: a.open + r.open, late: a.late + r.late, done30: a.done30 + r.done30, week: a.week + r.week }), { open: 0, late: 0, done30: 0, week: 0 });
  const recent = (tasks || []).filter((t) => t.completed_at && t.due_date && +new Date(t.completed_at) > now - 30 * DAY);
  const onTime = recent.length ? Math.round((recent.filter((t) => !t.completed_late && +new Date(t.completed_at!) <= +new Date(t.due_date!)).length / recent.length) * 100) : null;
  const lateCards = (tasks || []).filter(isLate).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 20);
  const bname = new Map(boards.map((b) => [b.id, b.name]));
  const H = ({ k, children, w }: { k: K; children: React.ReactNode; w?: number }) => (
    <th style={w ? { width: w } : undefined}><button type="button" onClick={() => setSort((s) => (s.k === k ? { k, asc: !s.asc } : { k, asc: k === 'name' }))}>{children}{sort.k === k ? (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}</button></th>);
  const tag = (r: Row) => !r.total ? ['Sem cards', '#8b93a7'] : r.late ? [`${r.late} atrasado(s)`, '#d92d20'] : r.open === 0 ? ['Concluído', '#15803d'] : ['Em dia', '#2f6fed'];
  const daysLate = (d: string) => Math.max(1, Math.floor((now - +new Date(d)) / DAY));

  return (
    <div className="mt-pg">
      <div className="bvx" style={{ height: '100%' }}>
        <div className="bvx-bar">
          <button type="button" className="bvx-btn bvx-ibtn" onClick={onBack} aria-label="Voltar aos murais"><ArrowLeft className="h-4 w-4" /></button>
          <b>Visão geral dos murais</b><span className="bvx-mut">{boards.length} mural(is)</span><span className="bvx-sp" />
          <label className="mt-srch"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar mural" aria-label="Buscar mural" /></label>
        </div>
        {tasks === null ? <div className="bvx-empty"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : (
          <div className="bvx-scroll in-pg">
            <div className="in-kpis">
              <div className="in-k"><span>Murais</span><b>{boards.length}</b></div>
              <div className="in-k"><span>Cards em aberto</span><b>{tot.open}</b></div>
              <div className="in-k"><span>Atrasados</span><b className={tot.late ? 'r' : ''}>{tot.late}</b></div>
              <div className="in-k"><span>Vencem em 7 dias</span><b>{tot.week}</b></div>
              <div className="in-k"><span>Concluídos (30 dias)</span><b className="g">{tot.done30}</b></div>
              <div className="in-k"><span>No prazo (30 dias)</span><b>{onTime == null ? '—' : `${onTime}%`}</b></div>
            </div>
            <section className="in-card in-wide">
              <header><h3>Murais</h3><span>Clique para abrir · ordene pelas colunas</span></header>
              <table className="bvx-tbl in-tbl">
                <thead><tr><H k="name">Mural</H><H k="pct" w={220}>Progresso</H><H k="open" w={110}>Em aberto</H><H k="late" w={110}>Atrasados</H><H k="week" w={130}>Vencem em 7 dias</H><H k="done30" w={150}>Concluídos (30 dias)</H><th style={{ width: 150 }}>Situação</th></tr></thead>
                <tbody>{list.map((r) => { const [tl, tc] = tag(r); return (
                  <tr key={r.b.id} className="bvx-row" onClick={() => onOpenBoard(r.b.id)}>
                    <td><span className="t" style={{ fontWeight: 500 }}>{r.b.name}</span></td>
                    <td><div className="in-tot"><div className="in-bar"><i style={{ width: `${r.pct}%` }} /></div><b>{r.pct}%</b></div></td>
                    <td>{r.open}</td><td className={r.late ? 'bvx-late' : ''}>{r.late}</td><td>{r.week}</td><td>{r.done30}</td>
                    <td><span className="bvx-pill" style={{ background: `color-mix(in srgb, ${tc} 14%, hsl(var(--card)))`, color: tc }}>{tl}</span></td>
                  </tr>); })}
                  {!list.length ? <tr><td colSpan={7} className="bvx-empty" style={{ maxWidth: 'none' }}>Nenhum mural encontrado.</td></tr> : null}
                </tbody>
              </table>
            </section>
            <section className="in-card in-wide">
              <header><h3>Atrasados em todos os murais</h3><span>{lateCards.length ? 'Os mais antigos primeiro' : 'Nenhum card atrasado'}</span></header>
              {lateCards.length ? (
                <table className="bvx-tbl in-tbl"><thead><tr><th>Card</th><th style={{ width: 240 }}>Mural</th><th style={{ width: 120 }}>Prazo</th><th style={{ width: 120 }}>Atraso</th></tr></thead>
                  <tbody>{lateCards.map((t) => (
                    <tr key={t.id} className="bvx-row" onClick={() => onOpenTask(t.board_id, t.id)}>
                      <td><div className="bvx-name">{t.task_number ? <span className="bvx-num">#{t.task_number}</span> : null}<span className="t">{t.title}</span></div></td>
                      <td>{bname.get(t.board_id)}</td><td className="bvx-late">{new Date(t.due_date!).toLocaleDateString('pt-BR')}</td><td>{daysLate(t.due_date!)} dia(s)</td>
                    </tr>))}</tbody></table>) : null}
            </section>
          </div>)}
      </div>
    </div>
  );
}
