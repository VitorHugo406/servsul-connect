// Other ways to see a mural (desktop), in a clean work-management style:
//  - Lista: sections per column (collapsible), task rows with a round check, assignee avatar, due date, status pill,
//    priority pill and labels; sortable headers; thin grid.
//  - Calendário: month grid (weekdays wide, weekend narrow), cards as soft coloured bars with the assignee avatar.
// Both use the board's already-filtered cards and open the normal card dialog; nothing is saved here.
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as Caret } from 'lucide-react';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/board-views.css';

type T = { id: string; title: string; status: string; priority?: string | null; due_date?: string | null; completed_at?: string | null; assigned_to?: string | null; task_number?: number | null; is_archived?: boolean | null };
type C = { id: string; title: string; color?: string | null; is_conclusion?: boolean | null; position?: number | null };
type L = { id?: string; name: string; color?: string | null };
type P = { name: string; avatar: string | null };
export type BoardViewMode = 'board' | 'list' | 'calendar';

const PRIO: Record<string, [string, number, string]> = { urgent: ['Urgente', 0, '#e5484d'], high: ['Alta', 1, '#f76b15'], medium: ['Média', 2, '#d9a400'], low: ['Baixa', 3, '#30a46c'] };
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const dkey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const ini = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
/** soft pill: tinted background, strong text in the same hue */
const pill = (hex?: string | null) => { const c = hex || '#8b93a7'; return { background: `color-mix(in srgb, ${c} 18%, hsl(var(--card)))`, color: `color-mix(in srgb, ${c} 78%, hsl(var(--foreground)))` }; };

function Av({ p, id }: { p: P | null; id?: string | null }) {
  if (!p) return null;
  return <span className="bvx-av" title={p.name} style={p.avatar ? { backgroundImage: `url(${p.avatar})` } : { background: `hsl(${hueOf(id || p.name)} 45% 52%)` }}>{p.avatar ? '' : ini(p.name)}</span>;
}

export function BoardAltView({ mode, tasks, columns, onOpen, labelsOf }: { mode: BoardViewMode; tasks: T[]; columns: C[]; onOpen: (t: T) => void; dark?: boolean; labelsOf?: (taskId: string) => L[] }) {
  const { users } = useActiveUsers(); const { profile } = useAuth();
  const person = (id?: string | null): P | null => {
    if (!id) return null;
    if (id === profile?.id) return { name: profile?.display_name || profile?.name || 'Você', avatar: profile?.avatar_url || null };
    const u = users.find((x) => x.id === id); return u ? { name: u.display_name || u.name, avatar: u.avatar_url || null } : null;
  };
  const cols = useMemo(() => [...columns].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [columns]);
  const col = useMemo(() => new Map(cols.map((c) => [c.id, c])), [cols]);
  const done = (t: T) => !!t.completed_at || !!col.get(t.status)?.is_conclusion;
  const late = (t: T) => !!t.due_date && !done(t) && new Date(t.due_date).getTime() < Date.now();
  const live = tasks.filter((t) => !t.is_archived);
  const ctx = { col, cols, person, onOpen, done, late, labelsOf: labelsOf || (() => []) };
  return <div className="bvx">{mode === 'list' ? <ListView tasks={live} {...ctx} /> : <CalView tasks={live} {...ctx} />}</div>;
}

type Ctx = { tasks: T[]; col: Map<string, C>; cols: C[]; person: (id?: string | null) => P | null; onOpen: (t: T) => void; done: (t: T) => boolean; late: (t: T) => boolean; labelsOf: (id: string) => L[] };
type K = 'title' | 'who' | 'due' | 'prio';

function ListView({ tasks, cols, person, onOpen, done, late, labelsOf }: Ctx) {
  const [sort, setSort] = useState<{ k: K; asc: boolean } | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const val = (t: T): string | number => !sort ? 0 : sort.k === 'title' ? t.title.toLowerCase() : sort.k === 'who' ? (person(t.assigned_to)?.name || '~').toLowerCase() : sort.k === 'due' ? (t.due_date ? new Date(t.due_date).getTime() : Infinity) : PRIO[t.priority || 'medium']?.[1] ?? 2;
  const order = (a: T[]) => !sort ? a : [...a].sort((x, y) => { const p = val(x), q = val(y); const r = p < q ? -1 : p > q ? 1 : 0; return sort.asc ? r : -r; });
  const H = ({ k, children, w }: { k?: K; children: React.ReactNode; w?: number }) => (
    <th style={w ? { width: w } : undefined}>{k ? <button type="button" onClick={() => setSort((s) => (s?.k === k ? (s.asc ? { k, asc: false } : null) : { k, asc: true }))}>{children}{sort?.k === k ? (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}</button> : children}</th>);
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <>
      <div className="bvx-bar"><b>Lista</b><span className="bvx-mut">{tasks.length} cards · {tasks.filter(done).length} concluídos</span><span className="bvx-sp" /><span className="bvx-mut">Clique no título de uma coluna para ordenar</span></div>
      <div className="bvx-scroll">
        <table className="bvx-tbl">
          <thead><tr><H k="title">Nome do card</H><H k="who" w={190}>Responsável</H><H k="due" w={130}>Prazo</H><H w={160}>Status</H><H k="prio" w={110}>Prioridade</H><H w={200}>Etiquetas</H></tr></thead>
          <tbody>
            {cols.map((c) => {
              const rows = order(tasks.filter((t) => t.status === c.id)); const isClosed = closed.has(c.id);
              return [
                <tr key={'s' + c.id} className="bvx-sec"><td colSpan={6}><button type="button" onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}>{isClosed ? <Caret className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{c.title}<span className="bvx-n">{rows.length}</span></button></td></tr>,
                ...(isClosed ? [] : rows.map((t) => {
                  const p = PRIO[t.priority || 'medium'] || PRIO.medium; const who = person(t.assigned_to); const labs = labelsOf(t.id); const ok = done(t);
                  return (
                    <tr key={t.id} className={`bvx-row ${ok ? 'bvx-done' : ''}`} onClick={() => onOpen(t)}>
                      <td><div className="bvx-name"><span className={`bvx-chk ${ok ? 'on' : ''}`}><Check className="h-3 w-3" strokeWidth={3} /></span>{t.task_number ? <span className="bvx-num">#{t.task_number}</span> : null}<span className="t">{t.title}</span></div></td>
                      <td>{who ? <div className="bvx-who"><Av p={who} id={t.assigned_to} /><span className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{who.name}</span></div> : <span className="bvx-mut">—</span>}</td>
                      <td className={late(t) ? 'bvx-late' : ''}>{t.due_date ? fmt(t.due_date) : <span className="bvx-mut">—</span>}</td>
                      <td><span className="bvx-pill" style={pill(c.color)}>{c.title}</span></td>
                      <td><span className="bvx-pill" style={pill(p[2])}>{p[0]}</span></td>
                      <td><div className="bvx-tags">{labs.length ? labs.slice(0, 3).map((l, i) => <span key={i} className="bvx-pill" style={pill(l.color)}>{l.name}</span>) : <span className="bvx-mut">—</span>}{labs.length > 3 ? <span className="bvx-mut">+{labs.length - 3}</span> : null}</div></td>
                    </tr>);
                })),
              ];
            })}
            {!tasks.length ? <tr><td colSpan={6} className="bvx-empty" style={{ maxWidth: 'none' }}>Nenhum card neste mural (ou no filtro atual).</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CalView({ tasks, col, person, onOpen, done, late }: Ctx) {
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const byDay = useMemo(() => { const map = new Map<string, T[]>(); for (const t of tasks) if (t.due_date) { const k = dkey(new Date(t.due_date)); map.set(k, [...(map.get(k) || []), t]); } return map; }, [tasks]);
  const noDue = tasks.filter((t) => !t.due_date).length;
  const first = new Date(m); const off = (first.getDay() + 6) % 7;   // weeks start on Monday
  const start = new Date(m); start.setDate(1 - off);
  const weeks = Math.ceil((off + new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = dkey(new Date());
  const Ev = ({ t }: { t: T }) => { const c = col.get(t.status); const s = pill(late(t) ? '#e5484d' : c?.color); return (
    <button type="button" className={`bvx-ev ${done(t) ? 'done' : ''}`} style={s} onClick={() => onOpen(t)} title={`${t.title} · ${c?.title || ''}`}><Av p={person(t.assigned_to)} id={t.assigned_to} /><span className="t">{t.title}</span></button>); };
  return (
    <>
      <div className="bvx-bar">
        <button type="button" className="bvx-btn" onClick={() => { const d = new Date(); setM(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hoje</button>
        <button type="button" className="bvx-btn bvx-ibtn" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className="bvx-btn bvx-ibtn" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
        <b>{MONTHS[m.getMonth()]} de {m.getFullYear()}</b>
        <span className="bvx-sp" />
        <span className="bvx-mut">{noDue ? `${noDue} card(s) sem prazo não aparecem no calendário` : 'Todos os cards têm prazo'}</span>
      </div>
      <div className="bvx-cal" style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(118px, 1fr))` }}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => <div key={d} className="bvx-dow">{d}</div>)}
        {days.map((d) => {
          const k = dkey(d); const list = byDay.get(k) || []; const out = d.getMonth() !== m.getMonth(); const we = d.getDay() === 0 || d.getDay() === 6;
          const shown = list.length > 3 ? list.slice(0, 2) : list;
          return (
            <div key={k} className={`bvx-day ${out ? 'out' : we ? 'we' : ''} ${k === today ? 'today' : ''}`}>
              <span className="bvx-dnum">{d.getDate()}</span>
              {shown.map((t) => <Ev key={t.id} t={t} />)}
              {list.length > 3 ? <button type="button" className="bvx-more" onClick={() => setOpenDay(k)}>+{list.length - 2} mais</button> : null}
              {openDay === k ? (
                <div className="bvx-pop">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}><b style={{ fontSize: 12.5 }}>{d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} · {list.length} cards</b><button type="button" className="bvx-btn bvx-ibtn" style={{ height: 24, width: 24 }} onClick={() => setOpenDay(null)} aria-label="Fechar">✕</button></div>
                  {list.map((t) => <Ev key={t.id} t={t} />)}
                </div>) : null}
            </div>);
        })}
      </div>
    </>
  );
}
