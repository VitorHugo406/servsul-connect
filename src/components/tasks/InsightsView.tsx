// Mural › Relatórios (desktop): KPIs, cards criados × concluídos nas últimas 8 semanas, cards por coluna, tempo médio
// para concluir, situação por pessoa (em aberto, atrasados, concluídos em 30 dias, horas do cronômetro em 30 dias) and
// "Movimentações por pessoa" (task_activities + task_comments in the chosen period: criou, moveu, checklist, comentou,
// editou — checklist/edit rows come from the triggers of migration 20261119090000) and a "Baixar PDF" that writes the same numbers with openReport (src/lib/reports.ts). Uses the board's already-filtered
// cards, so the filter panel also filters the report.
import { useEffect, useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { openReport } from '@/lib/reports';

type T = { id: string; title: string; status: string; due_date?: string | null; completed_at?: string | null; completed_late?: boolean | null; assigned_to?: string | null; created_at?: string; task_number?: number | null };
type C = { id: string; title: string; color?: string | null; is_conclusion?: boolean | null };
type P = { name: string; avatar: string | null };
const DAY = 864e5;
type Mv = { name: string; avatar: string | null; profileId: string | null; created: number; moved: number; checklist: number; comments: number; edits: number };
const MV_CREATE = new Set(['create', 'created']), MV_MOVE = new Set(['move', 'moved', 'complete']), MV_CHECK = new Set(['checklist_add', 'checklist_done', 'checklist_undone']), MV_EDIT = new Set(['assign', 'due', 'priority']);
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export function InsightsView({ tasks, cols, person, done, late, boardName, Av }: { tasks: T[]; cols: C[]; person: (id?: string | null) => P | null; done: (t: T) => boolean; late: (t: T) => boolean; boardName: string; Av: (p: { p: P | null; id?: string | null }) => JSX.Element | null }) {
  const [hours, setHours] = useState<Map<string, number>>(new Map());
  const [days, setDays] = useState(30);
  const [mv, setMv] = useState<Mv[] | null>(null);
  const since30 = Date.now() - 30 * DAY;
  useEffect(() => {
    const ids = tasks.map((t) => t.id); if (!ids.length) { setMv([]); return; }
    let alive = true; setMv(null);
    void (async () => {
      const db = supabase as any; const from = new Date(Date.now() - days * DAY).toISOString();
      const acts: { user_id: string; user_name: string; action_type: string }[] = []; const coms: { author_id: string }[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const part = ids.slice(i, i + 200);
        const [a, c] = await Promise.all([
          db.from('task_activities').select('user_id,user_name,action_type').in('task_id', part).gte('created_at', from).limit(5000),
          db.from('task_comments').select('author_id').in('task_id', part).gte('created_at', from).limit(5000),
        ]);
        acts.push(...(a.data || [])); coms.push(...(c.data || []));
      }
      const uids = [...new Set(acts.map((a) => a.user_id).filter(Boolean))];
      const pids = [...new Set(coms.map((c) => c.author_id).filter(Boolean))];
      const { data: ps } = uids.length || pids.length ? await db.from('profiles').select('id,user_id,name,display_name,avatar_url').or([uids.length ? `user_id.in.(${uids.join(',')})` : '', pids.length ? `id.in.(${pids.join(',')})` : ''].filter(Boolean).join(',')) : { data: [] };
      const byUser = new Map<string, any>(); const byProf = new Map<string, any>();
      for (const p of ps || []) { if (p.user_id) byUser.set(p.user_id, p); byProf.set(p.id, p); }
      const out = new Map<string, Mv>();
      const row = (key: string, p: any, fallback: string) => { let r = out.get(key); if (!r) { r = { name: p ? (p.display_name || p.name) : fallback, avatar: p?.avatar_url || null, profileId: p?.id || null, created: 0, moved: 0, checklist: 0, comments: 0, edits: 0 }; out.set(key, r); } return r; };
      for (const a of acts) {
        const p = byUser.get(a.user_id); const r = row(p?.id || 'u:' + a.user_id, p, a.user_name || 'Colaborador');
        if (MV_CREATE.has(a.action_type)) r.created++; else if (MV_MOVE.has(a.action_type)) r.moved++; else if (MV_CHECK.has(a.action_type)) r.checklist++; else if (MV_EDIT.has(a.action_type)) r.edits++;
      }
      for (const c of coms) { const p = byProf.get(c.author_id); row(p?.id || 'p:' + c.author_id, p, 'Colaborador').comments++; }
      const list = [...out.values()].map((r) => ({ r, t: r.created + r.moved + r.checklist + r.comments + r.edits })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t).map((x) => x.r);
      if (alive) setMv(list);
    })();
    return () => { alive = false; };
  }, [tasks, days]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ids = tasks.map((t) => t.id); if (!ids.length) { setHours(new Map()); return; }
    void (supabase as any).from('task_time_entries').select('profile_id,started_at,ended_at').in('task_id', ids.slice(0, 900)).gte('started_at', new Date(since30).toISOString()).then(({ data }: { data: { profile_id: string; started_at: string; ended_at: string | null }[] | null }) => {
      const h = new Map<string, number>(); for (const e of data || []) h.set(e.profile_id, (h.get(e.profile_id) || 0) + Math.max(0, ((e.ended_at ? +new Date(e.ended_at) : Date.now()) - +new Date(e.started_at)) / 36e5)); setHours(h);
    });
  }, [tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => {
    const total = tasks.length; const closed = tasks.filter(done); const open = tasks.filter((t) => !done(t)); const lt = open.filter(late);
    const withDue = closed.filter((t) => t.completed_at && t.due_date); const onTime = withDue.filter((t) => !t.completed_late && new Date(t.completed_at!) <= new Date(t.due_date!)).length;
    const lead = closed.filter((t) => t.completed_at && t.created_at && +new Date(t.completed_at) > since30 - 60 * DAY).map((t) => (+new Date(t.completed_at!) - +new Date(t.created_at!)) / DAY);
    const mon = mondayOf(new Date());
    const weeks = Array.from({ length: 8 }, (_, i) => { const a = new Date(mon.getTime() - (7 - i) * 7 * DAY); const b = new Date(a.getTime() + 7 * DAY);
      return { label: `${a.getDate()}/${a.getMonth() + 1}`, created: tasks.filter((t) => t.created_at && +new Date(t.created_at) >= +a && +new Date(t.created_at) < +b).length, done: tasks.filter((t) => t.completed_at && +new Date(t.completed_at) >= +a && +new Date(t.completed_at) < +b).length }; });
    const byCol = cols.map((c) => ({ c, n: tasks.filter((t) => t.status === c.id).length }));
    const ppl = new Map<string, { open: number; late: number; done30: number }>();
    for (const t of tasks) { const k = t.assigned_to || '__none'; const r = ppl.get(k) || { open: 0, late: 0, done30: 0 }; if (done(t)) { if (t.completed_at && +new Date(t.completed_at) > since30) r.done30++; } else { r.open++; if (late(t)) r.late++; } ppl.set(k, r); }
    return { total, closed: closed.length, open: open.length, late: lt.length, onTimePct: withDue.length ? Math.round((onTime / withDue.length) * 100) : null, lead: lead.length ? lead.reduce((a, b) => a + b, 0) / lead.length : null, weeks, byCol, ppl: [...ppl.entries()].sort((a, b) => b[1].open - a[1].open) };
  }, [tasks, cols]); // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = (id: string) => (id === '__none' ? 'Sem responsável' : person(id)?.name || 'Colaborador');
  const fmtH = (h: number) => (h ? `${h >= 10 ? Math.round(h) : h.toFixed(1).replace('.', ',')} h` : '—');
  const maxW = Math.max(1, ...s.weeks.flatMap((w) => [w.created, w.done]));
  const maxC = Math.max(1, ...s.byCol.map((x) => x.n));
  const pdf = () => openReport({
    eyebrow: 'Relatório do mural', title: boardName, subtitle: `Gerado em ${new Date().toLocaleString('pt-BR')}`, fileName: `relatorio-${boardName}`,
    blocks: [
      { type: 'kpis', items: [{ label: 'Cards', value: s.total }, { label: 'Concluídos', value: s.closed, tone: 'good' }, { label: 'Em aberto', value: s.open, tone: 'info' }, { label: 'Atrasados', value: s.late, tone: s.late ? 'bad' : 'neutral' }, { label: 'Concluídos no prazo', value: s.onTimePct == null ? '—' : `${s.onTimePct}%` }, { label: 'Tempo médio p/ concluir', value: s.lead == null ? '—' : `${s.lead.toFixed(1).replace('.', ',')} dias` }] },
      { type: 'bars', title: 'Concluídos por semana (últimas 8)', items: s.weeks.map((w) => ({ label: `Semana de ${w.label}`, value: w.done, max: maxW, tone: 'good' as const })) },
      { type: 'bars', title: 'Cards por coluna', items: s.byCol.map((x) => ({ label: x.c.title, value: x.n, max: maxC })) },
      ...(mv && mv.length ? [{ type: 'table' as const, title: `Movimentações por pessoa (últimos ${days} dias)`, headers: ['Pessoa', 'Criou', 'Moveu', 'Checklist', 'Comentou', 'Editou', 'Total'], rows: mv.map((r) => [r.name, r.created, r.moved, r.checklist, r.comments, r.edits, r.created + r.moved + r.checklist + r.comments + r.edits]) }] : []),
      { type: 'table', title: 'Situação por pessoa', headers: ['Pessoa', 'Em aberto', 'Atrasados', 'Concluídos (30 dias)', 'Horas (30 dias)'], rows: s.ppl.map(([id, r]) => [nameOf(id), r.open, { text: r.late, tone: r.late ? 'bad' : 'neutral' }, r.done30, fmtH(hours.get(id) || 0)]) },
    ],
  });
  const K = ({ l, v, tone, sub }: { l: string; v: string | number; tone?: string; sub?: string }) => <div className="in-k"><span>{l}</span><b className={tone}>{v}</b>{sub ? <small>{sub}</small> : null}</div>;
  const total = (r: Mv) => r.created + r.moved + r.checklist + r.comments + r.edits;
  const maxMv = Math.max(1, ...(mv || []).map(total));
  return (
    <>
      <div className="bvx-bar"><b>Relatórios</b><span className="bvx-mut">Usa os cards do filtro atual</span><span className="bvx-sp" />
        <div className="tl-seg" role="group" aria-label="Período">{[7, 30, 90].map((d) => <button key={d} type="button" className={days === d ? 'on' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>{d} dias</button>)}</div>
        <button type="button" className="bvx-btn" onClick={pdf}><FileDown className="h-4 w-4" />Baixar PDF</button></div>
      <div className="bvx-scroll in-pg">
        <div className="in-kpis">
          <K l="Cards" v={s.total} /><K l="Concluídos" v={s.closed} tone="g" sub={s.total ? `${Math.round((s.closed / s.total) * 100)}% do total` : undefined} /><K l="Em aberto" v={s.open} /><K l="Atrasados" v={s.late} tone={s.late ? 'r' : ''} />
          <K l="Concluídos no prazo" v={s.onTimePct == null ? '—' : `${s.onTimePct}%`} /><K l="Tempo médio p/ concluir" v={s.lead == null ? '—' : `${s.lead.toFixed(1).replace('.', ',')} dias`} />
        </div>
        <section className="in-card in-wide">
          <header><h3>Movimentações por pessoa</h3><span>Últimos {days} dias · cards criados, movidos, itens de checklist, comentários e edições (responsável, prazo, prioridade)</span></header>
          {mv === null ? <p className="in-empty">Carregando…</p> : !mv.length ? <p className="in-empty">Nenhuma movimentação neste período.</p> : (
            <table className="bvx-tbl in-tbl"><thead><tr><th>Pessoa</th><th>Criou</th><th>Moveu</th><th>Checklist</th><th>Comentou</th><th>Editou</th><th style={{ width: '28%' }}>Total</th></tr></thead>
              <tbody>{mv.map((r, i) => <tr key={i}><td><div className="bvx-who">{r.profileId ? <Av p={{ name: r.name, avatar: r.avatar }} id={r.profileId} /> : <span className="bvx-av">?</span>}<span className="t">{r.name}</span></div></td>
                <td>{r.created}</td><td>{r.moved}</td><td>{r.checklist}</td><td>{r.comments}</td><td>{r.edits}</td>
                <td><div className="in-tot"><div className="in-bar"><i style={{ width: `${(total(r) / maxMv) * 100}%` }} /></div><b>{total(r)}</b></div></td></tr>)}</tbody></table>)}
        </section>
        <div className="in-grid">
          <section className="in-card"><header><h3>Criados × concluídos</h3><span>Últimas 8 semanas</span></header>
            <div className="in-wk">{s.weeks.map((w) => <div key={w.label} className="in-wc"><div className="in-wb"><i style={{ height: `${(w.created / maxW) * 100}%` }} title={`${w.created} criados`} /><i className="d" style={{ height: `${(w.done / maxW) * 100}%` }} title={`${w.done} concluídos`} /></div><span>{w.label}</span></div>)}</div>
            <p className="in-leg"><i />Criados <i className="d" />Concluídos</p></section>
          <section className="in-card"><header><h3>Cards por coluna</h3><span>Situação atual</span></header>
            {s.byCol.map((x) => <div key={x.c.id} className="in-row"><span><i className="in-dot" style={{ background: x.c.color || '#8b93a7' }} />{x.c.title}</span><div className="in-bar"><i style={{ width: `${(x.n / maxC) * 100}%`, background: x.c.color || '#8b93a7' }} /></div><b>{x.n}</b></div>)}</section>
        </div>
        <section className="in-card in-wide"><header><h3>Situação por pessoa</h3><span>Cards de cada responsável</span></header>
          <table className="bvx-tbl in-tbl"><thead><tr><th>Pessoa</th><th>Em aberto</th><th>Atrasados</th><th>Concluídos (30 dias)</th><th>Horas (30 dias)</th></tr></thead>
            <tbody>{s.ppl.map(([id, r]) => <tr key={id}><td><div className="bvx-who">{id === '__none' ? <span className="bvx-av">?</span> : <Av p={person(id)} id={id} />}<span className="t">{nameOf(id)}</span></div></td><td>{r.open}</td><td className={r.late ? 'bvx-late' : ''}>{r.late}</td><td>{r.done30}</td><td>{fmtH(hours.get(id) || 0)}</td></tr>)}</tbody></table></section>
      </div>
    </>
  );
}
