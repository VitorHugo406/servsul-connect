// Other ways to see a mural (desktop), in a clean work-management style:
//  - Lista: one flat table (no sections): round check (= conclude), title, then Status / Responsável / Prazo /
//    Prioridade / Etiquetas as columns. Status, responsável, prazo and prioridade are editable in the row and use the
//    SAME actions as the kanban (onMove = drag move with workflow rules/automations, onComplete, onUpdate).
//  - Calendário: month grid (weekdays wide, weekend narrow), cards as soft coloured bars with the assignee avatar;
//    dragging a card to another day changes its due date (keeps the time).
// Clicking a card opens the normal card dialog. War Room-locked cards are read-only.
import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Lock, UserX, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/board-views.css';
import { TimelineView } from './TimelineView';
import { WorkloadView } from './WorkloadView';
import { InsightsView } from './InsightsView';
import { useBoardExtras, fieldText } from '@/hooks/useBoardExtras';
import { ExportMenu } from '@/components/ui/ExportMenu';

type T = { id: string; title: string; status: string; created_at?: string; completed_late?: boolean | null; priority?: string | null; due_date?: string | null; start_date?: string | null; completed_at?: string | null; assigned_to?: string | null; task_number?: number | null; is_archived?: boolean | null };
type C = { id: string; title: string; color?: string | null; is_conclusion?: boolean | null; position?: number | null };
type L = { id?: string; name: string; color?: string | null };
type P = { name: string; avatar: string | null };
export type BoardViewMode = 'board' | 'list' | 'calendar' | 'timeline' | 'workload' | 'insights';

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

type Upd = Partial<Pick<T, 'priority' | 'due_date' | 'assigned_to'>> & { start_date?: string | null };
type Acts = { onMove?: (t: T, colId: string) => void; onComplete?: (t: T) => void; onUpdate?: (t: T, u: Upd) => void | Promise<void>; onDeleteMany?: (ids: string[]) => Promise<boolean>; locked?: { has: (id: string) => boolean } };

export function BoardAltView({ mode, tasks, columns, onOpen, labelsOf, onMove, onComplete, onUpdate, onDeleteMany, locked, boardName }: { mode: BoardViewMode; tasks: T[]; columns: C[]; onOpen: (t: T) => void; dark?: boolean; labelsOf?: (taskId: string) => L[]; boardName?: string } & Acts) {
  const { users: others } = useActiveUsers(); const { profile } = useAuth();
  // include yourself, so you can take a card in the Lista (useActiveUsers leaves you out)
  const users = useMemo(() => (profile && !others.some((u) => u.id === profile.id) ? [...others, { id: profile.id, name: profile.name, display_name: profile.display_name, avatar_url: profile.avatar_url } as (typeof others)[number]] : others), [others, profile]);
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
  const isLocked = (t: T) => !!locked?.has(t.id);
  const ctx = { col, cols, person, onOpen, done, late, labelsOf: labelsOf || (() => []), users, isLocked, onMove, onComplete, onUpdate, onDeleteMany };
  return <div className="bvx">{mode === 'list' ? <ListView tasks={live} {...ctx} boardName={boardName} /> : mode === 'timeline' ? <TimelineView tasks={live} cols={cols} person={person} onOpen={onOpen} done={done} late={late} isLocked={isLocked} onUpdate={onUpdate} Av={Av} />
    : mode === 'insights' ? <InsightsView tasks={live} cols={cols} person={person} done={done} late={late} boardName={boardName || 'Mural'} Av={Av} />
    : mode === 'workload' ? <WorkloadView tasks={live} cols={cols} users={users} person={person} onOpen={onOpen} done={done} late={late} Av={Av} /> : <CalView tasks={live} {...ctx} />}</div>;
}

type U = { id: string; name: string; display_name?: string | null; avatar_url?: string | null };
type Ctx = { tasks: T[]; col: Map<string, C>; cols: C[]; person: (id?: string | null) => P | null; onOpen: (t: T) => void; done: (t: T) => boolean; late: (t: T) => boolean; labelsOf: (id: string) => L[]; users: U[]; isLocked: (t: T) => boolean } & Acts;
type K = 'title' | 'status' | 'who' | 'due' | 'prio';
const stop = (e: React.SyntheticEvent) => e.stopPropagation();
/** yyyy-mm-dd of a stored due date in local time */
const ymd = (d?: string | null) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
/** new due date on another day, keeping the old time (or 18:00 when there was none) */
const withDay = (old: string | null | undefined, y: number, m: number, d: number) => { const o = old ? new Date(old) : null; const n = new Date(y, m, d, o ? o.getHours() : 18, o ? o.getMinutes() : 0); return n.toISOString(); };

function ListView({ tasks, cols, col, person, onOpen, done, late, labelsOf, users, isLocked, onMove, onComplete, onUpdate, onDeleteMany, boardName }: Ctx & { boardName?: string }) {
  // ações em massa: selection by id (only cards still visible in the filter count)
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const picked = tasks.filter((t) => sel.has(t.id));
  const editable = picked.filter((t) => !isLocked(t));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = tasks.length > 0 && picked.length === tasks.length;
  const bulkDate = useRef<HTMLInputElement | null>(null);
  const runBulk = async (fn: (t: T) => unknown) => { setBulkBusy(true); for (const t of editable) await fn(t); setBulkBusy(false); };
  const ex = useBoardExtras(); const cf = ex?.fields || [];
  const [sort, setSort] = useState<{ k: K; asc: boolean } | null>(null);
  const colPos = (t: T) => cols.findIndex((c) => c.id === t.status);
  const val = (t: T): string | number => !sort ? colPos(t) : sort.k === 'title' ? t.title.toLowerCase() : sort.k === 'status' ? colPos(t) : sort.k === 'who' ? (person(t.assigned_to)?.name || '~').toLowerCase() : sort.k === 'due' ? (t.due_date ? new Date(t.due_date).getTime() : Infinity) : PRIO[t.priority || 'medium']?.[1] ?? 2;
  const rows = [...tasks].sort((x, y) => { const p = val(x), q = val(y); const r = p < q ? -1 : p > q ? 1 : 0; return !sort || sort.asc ? r : -r; });
  const H = ({ k, children, w }: { k?: K; children: React.ReactNode; w?: number }) => (
    <th style={w ? { width: w } : undefined}>{k ? <button type="button" onClick={() => setSort((s) => (s?.k === k ? (s.asc ? { k, asc: false } : null) : { k, asc: true }))}>{children}{sort?.k === k ? (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null}</button> : children}</th>);
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  const dateRef = useRef<Record<string, HTMLInputElement | null>>({});
  return (
    <>
      <div className="bvx-bar"><b>Lista</b><span className="bvx-mut">{tasks.length} cards · {tasks.filter(done).length} concluídos</span><span className="bvx-sp" /><span className="bvx-mut">Clique no card para abrir · mude status, responsável, prazo e prioridade direto na linha</span>
        <ExportMenu getData={() => ({ name: `cards-${boardName || 'mural'}`, sheet: 'Cards',
          headers: ['Número', 'Card', 'Status', 'Responsável', 'Prazo', 'Prioridade', 'Etiquetas', ...cf.map((f) => f.name), 'Concluído em'],
          rows: rows.map((t) => [t.task_number ?? '', t.title, col.get(t.status)?.title || '', person(t.assigned_to)?.name || '', t.due_date ? new Date(t.due_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '', (PRIO[t.priority || 'medium'] || PRIO.medium)[0], labelsOf(t.id).map((l) => l.name).join(', '), ...cf.map((f) => fieldText(f, ex?.valueOf(t.id, f.id))), t.completed_at ? new Date(t.completed_at).toLocaleDateString('pt-BR') : '']) })} /></div>
      {picked.length ? (
        <div className="bvx-bulk" role="toolbar" aria-label="Ações em massa">
          <b>{picked.length} selecionado(s)</b>{editable.length < picked.length ? <span className="bvx-mut">{picked.length - editable.length} bloqueado(s) pela War Room</span> : null}
          <span className="bvx-sp" />
          {onMove ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="bvx-btn" disabled={bulkBusy || !editable.length}>Mover para<ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">{cols.map((x) => <DropdownMenuItem key={x.id} onSelect={() => void runBulk((t) => t.status !== x.id && onMove(t, x.id))}><span className="mr-2 h-2.5 w-2.5 flex-none rounded-full" style={{ background: x.color || '#8b93a7' }} />{x.title}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
          {onUpdate ? <>
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="bvx-btn" disabled={bulkBusy || !editable.length}>Responsável<ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[320px] min-w-[220px] overflow-y-auto">
                <DropdownMenuItem onSelect={() => void runBulk((t) => onUpdate(t, { assigned_to: null }))}><UserX className="mr-2 h-4 w-4" />Sem responsável</DropdownMenuItem><DropdownMenuSeparator />
                {users.map((u) => <DropdownMenuItem key={u.id} onSelect={() => void runBulk((t) => onUpdate(t, { assigned_to: u.id }))}><span className="mr-2"><Av p={{ name: u.display_name || u.name, avatar: u.avatar_url || null }} id={u.id} /></span>{u.display_name || u.name}</DropdownMenuItem>)}
              </DropdownMenuContent></DropdownMenu>
            <button type="button" className="bvx-btn" disabled={bulkBusy || !editable.length} onClick={() => { const el = bulkDate.current; try { el?.showPicker(); } catch { el?.focus(); } }}>Prazo</button>
            <input ref={bulkDate} type="date" className="bvx-hidden-date" tabIndex={-1} aria-label="Prazo dos cards selecionados" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (!v) return; const [y, m, d] = v.split('-').map(Number); void runBulk((t) => onUpdate(t, { due_date: withDay(t.due_date, y, m - 1, d) })); }} />
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="bvx-btn" disabled={bulkBusy || !editable.length}>Prioridade<ChevronDown className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">{Object.entries(PRIO).map(([k, v]) => <DropdownMenuItem key={k} onSelect={() => void runBulk((t) => onUpdate(t, { priority: k }))}><span className="bvx-pill" style={pill(v[2])}>{v[0]}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
          </> : null}
          {onDeleteMany ? <button type="button" className="bvx-btn bvx-danger" disabled={bulkBusy || !editable.length} onClick={async () => { setBulkBusy(true); const ok = await onDeleteMany(editable.map((t) => t.id)); setBulkBusy(false); if (ok) setSel(new Set()); }}>Excluir</button> : null}
          <button type="button" className="bvx-btn bvx-ibtn" onClick={() => setSel(new Set())} aria-label="Limpar seleção" title="Limpar seleção"><X className="h-4 w-4" /></button>
        </div>) : null}
      <div className="bvx-scroll">
        <table className="bvx-tbl" style={{ minWidth: 1180 + cf.length * 150 }}>
          <thead><tr><th className="bvx-selh"><input type="checkbox" className="bvx-sel" checked={allOn} ref={(el) => { if (el) el.indeterminate = picked.length > 0 && !allOn; }} onChange={() => setSel(allOn ? new Set() : new Set(tasks.map((t) => t.id)))} aria-label="Selecionar todos" /></th><H k="title" w={320}>Nome do card</H><H k="status" w={170}>Status</H><H k="who" w={190}>Responsável</H><H k="due" w={130}>Prazo</H><H k="prio" w={120}>Prioridade</H><H w={200}>Etiquetas</H>{cf.map((f) => <H key={f.id} w={150}>{f.name}</H>)}</tr></thead>
          <tbody>
            {rows.map((t) => {
              const c = col.get(t.status); const p = PRIO[t.priority || 'medium'] || PRIO.medium; const who = person(t.assigned_to); const labs = labelsOf(t.id); const ok = done(t); const lk = isLocked(t);
              const edit = !lk;
              return (
                <tr key={t.id} className={`bvx-row ${ok ? 'bvx-done' : ''} ${sel.has(t.id) ? 'bvx-picked' : ''}`} onClick={() => onOpen(t)}>
                  <td className="bvx-selh" onClick={stop}><input type="checkbox" className="bvx-sel" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Selecionar card ${t.task_number || ''}`} /></td>
                  <td><div className="bvx-name">
                    <button type="button" className={`bvx-chk ${ok ? 'on' : ''}`} disabled={ok || lk || !onComplete} title={ok ? 'Concluído' : 'Marcar como concluído'} aria-label="Concluir card" onClick={(e) => { stop(e); onComplete?.(t); }}><Check className="h-3 w-3" strokeWidth={3} /></button>
                    {t.task_number ? <span className="bvx-num">#{t.task_number}</span> : null}<span className="t">{t.title}</span>{lk ? <Lock className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-label="Controlado pela War Room" /> : null}
                  </div></td>
                  <td onClick={stop}>
                    <DropdownMenu><DropdownMenuTrigger asChild disabled={!edit || !onMove}><button type="button" className="bvx-cell"><span className="bvx-pill" style={pill(c?.color)}>{c?.title || '—'}</span>{edit && onMove ? <ChevronDown className="bvx-cv h-3.5 w-3.5" /> : null}</button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[200px]">{cols.map((x) => <DropdownMenuItem key={x.id} onSelect={() => onMove?.(t, x.id)}><span className="mr-2 h-2.5 w-2.5 flex-none rounded-full" style={{ background: x.color || '#8b93a7' }} />{x.title}{x.id === t.status ? <Check className="ml-auto h-4 w-4" /> : null}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                  </td>
                  <td onClick={stop}>
                    <DropdownMenu><DropdownMenuTrigger asChild disabled={!edit || !onUpdate}><button type="button" className="bvx-cell">{who ? <div className="bvx-who"><Av p={who} id={t.assigned_to} /><span className="t" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{who.name}</span></div> : <span className="bvx-mut">—</span>}{edit && onUpdate ? <ChevronDown className="bvx-cv h-3.5 w-3.5" /> : null}</button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[220px] overflow-auto">
                        {t.assigned_to ? <><DropdownMenuItem onSelect={() => void onUpdate?.(t, { assigned_to: null })}><UserX className="mr-2 h-4 w-4" />Sem responsável</DropdownMenuItem><DropdownMenuSeparator /></> : null}
                        {[...users].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name, 'pt-BR')).map((u) => <DropdownMenuItem key={u.id} onSelect={() => void onUpdate?.(t, { assigned_to: u.id })}><span className="mr-2"><Av p={{ name: u.display_name || u.name, avatar: u.avatar_url || null }} id={u.id} /></span>{u.display_name || u.name}{u.id === t.assigned_to ? <Check className="ml-auto h-4 w-4" /> : null}</DropdownMenuItem>)}
                      </DropdownMenuContent></DropdownMenu>
                  </td>
                  <td onClick={stop} className={late(t) ? 'bvx-late' : ''}>
                    <button type="button" className="bvx-cell" disabled={!edit || !onUpdate} onClick={() => { const el = dateRef.current[t.id]; try { el?.showPicker(); } catch { el?.focus(); } }}>{t.due_date ? fmt(t.due_date) : <span className="bvx-mut">—</span>}</button>
                    <input ref={(el) => { dateRef.current[t.id] = el; }} type="date" className="bvx-hidden-date" tabIndex={-1} aria-label="Prazo" value={ymd(t.due_date)} onChange={(e) => { const v = e.target.value; if (!v) { void onUpdate?.(t, { due_date: null }); return; } const [y, m, d] = v.split('-').map(Number); void onUpdate?.(t, { due_date: withDay(t.due_date, y, m - 1, d) }); }} />
                  </td>
                  <td onClick={stop}>
                    <DropdownMenu><DropdownMenuTrigger asChild disabled={!edit || !onUpdate}><button type="button" className="bvx-cell"><span className="bvx-pill" style={pill(p[2])}>{p[0]}</span>{edit && onUpdate ? <ChevronDown className="bvx-cv h-3.5 w-3.5" /> : null}</button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start">{Object.entries(PRIO).map(([k, v]) => <DropdownMenuItem key={k} onSelect={() => void onUpdate?.(t, { priority: k })}><span className="bvx-pill" style={pill(v[2])}>{v[0]}</span>{(t.priority || 'medium') === k ? <Check className="ml-auto h-4 w-4" /> : null}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
                  </td>
                  <td><div className="bvx-tags">{labs.length ? labs.slice(0, 3).map((l, i) => <span key={i} className="bvx-pill bvx-tag" style={pill(l.color)}>{l.name}</span>) : <span className="bvx-mut">—</span>}{labs.length > 3 ? <span className="bvx-mut">+{labs.length - 3}</span> : null}</div></td>
                  {cf.map((f) => { const v = fieldText(f, ex?.valueOf(t.id, f.id)); return <td key={f.id} title={v}>{v || <span className="bvx-mut">—</span>}</td>; })}
                </tr>);
            })}
            {!tasks.length ? <tr><td colSpan={7 + cf.length} className="bvx-empty" style={{ maxWidth: 'none' }}>Nenhum card neste mural (ou no filtro atual).</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CalView({ tasks, col, person, onOpen, done, late, isLocked, onUpdate }: Ctx) {
  const [drag, setDrag] = useState<T | null>(null); const [over, setOver] = useState<string | null>(null);
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
    <button type="button" className={`bvx-ev ${done(t) ? 'done' : ''}`} style={s} onClick={() => onOpen(t)} title={`${t.title} · ${c?.title || ''}${onUpdate && !isLocked(t) ? ' · arraste para mudar o prazo' : ''}`}
      draggable={!!onUpdate && !isLocked(t)} onDragStart={(e) => { setDrag(t); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}><Av p={person(t.assigned_to)} id={t.assigned_to} /><span className="t">{t.title}</span></button>); };
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
            <div key={k} className={`bvx-day ${out ? 'out' : we ? 'we' : ''} ${k === today ? 'today' : ''} ${over === k ? 'drop' : ''}`}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); if (over !== k) setOver(k); }} onDragLeave={() => setOver((o) => (o === k ? null : o))}
              onDrop={(e) => { e.preventDefault(); const t = drag; setDrag(null); setOver(null); if (!t || dkey(new Date(t.due_date || 0)) === k) return; void onUpdate?.(t, { due_date: withDay(t.due_date, d.getFullYear(), d.getMonth(), d.getDate()) }); }}>
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
