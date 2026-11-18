// Other ways to see a mural (desktop): "Lista" (sortable table of the cards) and "Calendário" (cards on their due day).
// Both use the board's already-filtered cards and open the same card dialog; nothing is saved here.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';

type T = { id: string; title: string; status: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; assigned_to?: string | null; task_number?: number | null; created_at?: string | null; is_archived?: boolean | null };
type C = { id: string; title: string; color?: string | null; is_conclusion?: boolean | null; position?: number | null };
export type BoardViewMode = 'board' | 'list' | 'calendar';

const PRIO: Record<string, [string, number, string]> = { urgent: ['Urgente', 0, '#dc2626'], high: ['Alta', 1, '#f97316'], medium: ['Média', 2, '#3b82f6'], low: ['Baixa', 3, '#6b7280'] };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const dkey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function BoardAltView({ mode, tasks, columns, onOpen, dark }: { mode: BoardViewMode; tasks: T[]; columns: C[]; onOpen: (t: T) => void; dark?: boolean }) {
  const { users } = useActiveUsers(); const { profile } = useAuth();
  const nameOf = (id?: string | null) => { if (!id) return ''; if (id === profile?.id) return profile?.display_name || profile?.name || 'Você'; const u = users.find((x) => x.id === id); return u ? (u.display_name || u.name) : ''; };
  const col = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const done = (t: T) => !!t.completed_at || !!col.get(t.status)?.is_conclusion;
  const late = (t: T) => !!t.due_date && !done(t) && new Date(t.due_date).getTime() < Date.now();
  const live = tasks.filter((t) => !t.is_archived);
  const panel = `h-full overflow-auto rounded-2xl border border-border bg-background/95 ${dark ? 'shadow-2xl' : ''}`;
  return mode === 'list' ? <ListView tasks={live} col={col} nameOf={nameOf} onOpen={onOpen} done={done} late={late} cls={panel} columns={columns} />
    : <CalView tasks={live} col={col} onOpen={onOpen} done={done} late={late} cls={panel} />;
}

type K = 'num' | 'title' | 'col' | 'who' | 'due' | 'prio';
function ListView({ tasks, col, columns, nameOf, onOpen, done, late, cls }: { tasks: T[]; col: Map<string, C>; columns: C[]; nameOf: (id?: string | null) => string; onOpen: (t: T) => void; done: (t: T) => boolean; late: (t: T) => boolean; cls: string }) {
  const [sort, setSort] = useState<{ k: K; asc: boolean }>({ k: 'col', asc: true });
  const colPos = new Map(columns.map((c, i) => [c.id, c.position ?? i]));
  const rows = [...tasks].sort((a, b) => {
    const v = (t: T): string | number => sort.k === 'num' ? t.task_number ?? 0 : sort.k === 'title' ? t.title.toLowerCase() : sort.k === 'col' ? colPos.get(t.status) ?? 99 : sort.k === 'who' ? nameOf(t.assigned_to).toLowerCase() || '~' : sort.k === 'due' ? (t.due_date ? new Date(t.due_date).getTime() : Infinity) : PRIO[t.priority || 'medium']?.[1] ?? 2;
    const x = v(a), y = v(b); const r = x < y ? -1 : x > y ? 1 : 0; return sort.asc ? r : -r;
  });
  const H = ({ k, children, w }: { k: K; children: React.ReactNode; w?: string }) => (
    <th className={`sticky top-0 z-10 bg-muted/90 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${w || ''}`}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>{children}{sort.k === k ? (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}</button>
    </th>);
  return (
    <div className={cls}>
      <table className="w-full border-collapse text-sm">
        <thead><tr><H k="num" w="w-16">#</H><H k="title">Card</H><H k="col" w="w-44">Coluna</H><H k="who" w="w-44">Responsável</H><H k="due" w="w-36">Prazo</H><H k="prio" w="w-28">Prioridade</H></tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Nenhum card neste mural (ou no filtro atual).</td></tr> : rows.map((t) => {
            const c = col.get(t.status); const p = PRIO[t.priority || 'medium'] || PRIO.medium;
            return (
              <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer border-t border-border hover:bg-muted/50">
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{t.task_number ? `#${t.task_number}` : ''}</td>
                <td className={`px-3 py-2.5 font-medium ${done(t) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.title}</td>
                <td className="px-3 py-2.5"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c?.color || '#9ca3af' }} />{c?.title || '—'}</span></td>
                <td className="px-3 py-2.5 text-muted-foreground">{nameOf(t.assigned_to) || '—'}</td>
                <td className={`px-3 py-2.5 ${late(t) ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}{late(t) ? ' · atrasado' : ''}</td>
                <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: p[2] }} />{p[0]}</span></td>
              </tr>);
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalView({ tasks, col, onOpen, done, late, cls }: { tasks: T[]; col: Map<string, C>; onOpen: (t: T) => void; done: (t: T) => boolean; late: (t: T) => boolean; cls: string }) {
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const byDay = useMemo(() => { const map = new Map<string, T[]>(); for (const t of tasks) if (t.due_date) { const k = dkey(new Date(t.due_date)); map.set(k, [...(map.get(k) || []), t]); } return map; }, [tasks]);
  const noDue = tasks.filter((t) => !t.due_date).length;
  const start = new Date(m); start.setDate(1 - m.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = dkey(new Date());
  return (
    <div className={`${cls} flex flex-col p-3`}>
      <div className="mb-2 flex items-center gap-2">
        <button type="button" className="rounded-lg border border-border p-1.5 hover:bg-muted" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
        <b className="min-w-40 text-center">{MONTHS[m.getMonth()]} de {m.getFullYear()}</b>
        <button type="button" className="rounded-lg border border-border p-1.5 hover:bg-muted" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" className="ml-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted" onClick={() => { const d = new Date(); setM(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{noDue ? `${noDue} card(s) sem prazo não aparecem aqui` : 'Todos os cards têm prazo'}</span>
      </div>
      <div className="grid grid-cols-7 border-b border-border pb-1 text-center text-[11px] font-semibold uppercase text-muted-foreground">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px rounded-lg bg-border">
        {days.map((d) => {
          const k = dkey(d); const list = byDay.get(k) || []; const out = d.getMonth() !== m.getMonth();
          return (
            <div key={k} className={`relative flex min-h-[86px] flex-col gap-1 p-1.5 ${out ? 'bg-muted/40' : 'bg-background'}`}>
              <span className={`self-start rounded-full px-1.5 text-xs ${k === today ? 'bg-primary font-bold text-primary-foreground' : out ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>{d.getDate()}</span>
              <div className="flex min-h-0 flex-col gap-1">
                {(openDay === k ? [] : list.slice(0, list.length > 3 ? 2 : 3)).map((t) => { const c = col.get(t.status); return (
                  <button key={t.id} type="button" onClick={() => onOpen(t)} title={`${t.title} · ${c?.title || ''}`}
                    className={`shrink-0 truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[11.5px] ${done(t) ? 'bg-muted text-muted-foreground line-through' : late(t) ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-muted/60 text-foreground hover:bg-muted'}`}
                    style={{ borderLeftColor: c?.color || '#9ca3af', borderRadius: 6 }}>{t.title}</button>); })}
                {list.length > 3 && openDay !== k ? <button type="button" onClick={() => setOpenDay(k)} className="shrink-0 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-muted">+{list.length - 2} mais</button> : null}
              </div>
              {openDay === k ? (
                <div className="absolute left-0 top-0 z-30 flex max-h-72 w-[min(260px,180%)] flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl">
                  <div className="mb-1 flex items-center justify-between"><b className="text-xs">{d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · {list.length} cards</b><button type="button" className="rounded px-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => setOpenDay(null)} aria-label="Fechar">✕</button></div>
                  {list.map((t) => { const c = col.get(t.status); return (
                    <button key={t.id} type="button" onClick={() => onOpen(t)} className={`shrink-0 truncate rounded-md border-l-[3px] px-2 py-1 text-left text-xs ${done(t) ? 'bg-muted text-muted-foreground line-through' : late(t) ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-muted/60 hover:bg-muted'}`} style={{ borderLeftColor: c?.color || '#9ca3af', borderRadius: 6 }}>{t.title}</button>); })}
                </div>) : null}
            </div>);
        })}
      </div>
    </div>
  );
}
