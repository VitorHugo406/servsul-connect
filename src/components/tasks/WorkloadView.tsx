// Mural › Carga de trabalho (desktop): one row per person with OPEN cards of this mural (plus "Sem responsável"),
// columns Atrasados / this week / next 3 weeks / Depois / Sem prazo. Cells are coloured by how many cards fall there
// (1–2 calm, 3–4 attention, 5+ overloaded) and open a list of the cards; each card opens the card dialog. The hours
// logged with the card timer this week are shown per person (task_time_entries).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type T = { id: string; title: string; status: string; due_date?: string | null; completed_at?: string | null; assigned_to?: string | null; task_number?: number | null };
type C = { id: string; title: string; is_conclusion?: boolean | null };
type U = { id: string; name: string; display_name?: string | null; avatar_url?: string | null };
type P = { name: string; avatar: string | null };
const DAY = 864e5;
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export function WorkloadView({ tasks, cols, users, person, onOpen, done, late, Av }: {
  tasks: T[]; cols: C[]; users: U[]; person: (id?: string | null) => P | null; onOpen: (t: T) => void; done: (t: T) => boolean; late: (t: T) => boolean;
  Av: (p: { p: P | null; id?: string | null }) => JSX.Element | null;
}) {
  const [cell, setCell] = useState<string | null>(null);
  const [hours, setHours] = useState<Map<string, number>>(new Map());
  const mon = mondayOf(new Date());
  const buckets = useMemo(() => [
    { k: 'late', label: 'Atrasados' },
    ...[0, 1, 2, 3].map((w) => { const a = new Date(mon.getTime() + w * 7 * DAY); const b = new Date(a.getTime() + 6 * DAY); return { k: 'w' + w, label: w === 0 ? 'Esta semana' : w === 1 ? 'Próxima semana' : `${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}` }; }),
    { k: 'later', label: 'Depois' }, { k: 'none', label: 'Sem prazo' },
  ], [mon.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = tasks.filter((t) => !done(t));
  const bucketOf = (t: T) => { if (late(t)) return 'late'; if (!t.due_date) return 'none'; const w = Math.floor((new Date(t.due_date).getTime() - mon.getTime()) / (7 * DAY)); return w < 0 ? 'late' : w <= 3 ? 'w' + w : 'later'; };
  const people = useMemo(() => {
    const m = new Map<string, T[]>(); for (const t of open) { const k = t.assigned_to || '__none'; m.set(k, [...(m.get(k) || []), t]); }
    return [...m.entries()].sort((a, b) => (a[0] === '__none' ? 1 : b[0] === '__none' ? -1 : b[1].length - a[1].length));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, cols]);
  useEffect(() => {
    const ids = tasks.map((t) => t.id); if (!ids.length) return;
    void (supabase as any).from('task_time_entries').select('profile_id,started_at,ended_at').in('task_id', ids.slice(0, 900)).gte('started_at', mon.toISOString()).then(({ data }: { data: { profile_id: string; started_at: string; ended_at: string | null }[] | null }) => {
      const h = new Map<string, number>(); for (const e of data || []) { const s = ((e.ended_at ? new Date(e.ended_at).getTime() : Date.now()) - new Date(e.started_at).getTime()) / 36e5; h.set(e.profile_id, (h.get(e.profile_id) || 0) + Math.max(0, s)); }
      setHours(h);
    });
  }, [tasks, mon.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const tone = (n: number) => (n >= 5 ? 'hot' : n >= 3 ? 'warm' : n ? 'ok' : '');
  return (
    <>
      <div className="bvx-bar"><b>Carga de trabalho</b><span className="bvx-mut">{open.length} cards em aberto · {people.filter(([k]) => k !== '__none').length} pessoa(s)</span><span className="bvx-sp" />
        <span className="wl-leg"><i className="ok" />1–2 <i className="warm" />3–4 <i className="hot" />5 ou mais</span></div>
      <div className="bvx-scroll">
        {!open.length ? <div className="bvx-empty">Nenhum card em aberto neste mural.</div> : (
          <table className="bvx-tbl wl-tbl">
            <thead><tr><th style={{ width: 230 }}>Pessoa</th><th style={{ width: 90 }}>Em aberto</th><th style={{ width: 110 }}>Horas (semana)</th>{buckets.map((b) => <th key={b.k}>{b.label}</th>)}</tr></thead>
            <tbody>
              {people.map(([pid, list]) => {
                const p = pid === '__none' ? null : person(pid) || (users.find((u) => u.id === pid) ? { name: users.find((u) => u.id === pid)!.display_name || users.find((u) => u.id === pid)!.name, avatar: null } : { name: 'Colaborador', avatar: null });
                const h = pid === '__none' ? 0 : hours.get(pid) || 0;
                return [
                  <tr key={pid}>
                    <td><div className="bvx-who">{p ? <Av p={p} id={pid} /> : <span className="bvx-av">?</span>}<span className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p ? p.name : 'Sem responsável'}</span></div></td>
                    <td><b>{list.length}</b></td>
                    <td>{h ? `${h >= 10 ? Math.round(h) : h.toFixed(1).replace('.', ',')} h` : <span className="bvx-mut">—</span>}</td>
                    {buckets.map((b) => { const n = list.filter((t) => bucketOf(t) === b.k).length; const id = `${pid}:${b.k}`; return (
                      <td key={b.k}><button type="button" disabled={!n} className={`wl-cell ${b.k === 'late' && n ? 'hot' : tone(n)} ${cell === id ? 'sel' : ''}`} onClick={() => setCell(cell === id ? null : id)}>{n || ''}</button></td>); })}
                  </tr>,
                  cell?.startsWith(pid + ':') ? (
                    <tr key={pid + 'x'} className="wl-x"><td colSpan={3 + buckets.length}>
                      <div className="wl-list">{list.filter((t) => bucketOf(t) === cell.split(':')[1]).map((t) => (
                        <button key={t.id} type="button" onClick={() => onOpen(t)}><span className="bvx-num">#{t.task_number}</span><span className="t">{t.title}</span><span className="bvx-mut">{cols.find((c) => c.id === t.status)?.title}</span>{t.due_date ? <span className={late(t) ? 'bvx-late' : 'bvx-mut'}>{new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span> : null}</button>))}</div>
                    </td></tr>) : null,
                ];
              })}
            </tbody>
          </table>)}
      </div>
    </>
  );
}
