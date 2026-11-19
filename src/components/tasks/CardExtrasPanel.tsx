// Inside the card dialog: the mural's custom fields (edit in place), the start date used by the Linha do tempo, and
// dependencies ("Bloqueado por" / "Bloqueia"). Uses the BoardExtrasProvider of the open mural; renders nothing when the
// card is opened outside a mural.
import { useEffect, useState } from 'react';
import { Link2, Lock, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBoardExtras, fieldText, type CustomField } from '@/hooks/useBoardExtras';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

type Mini = { id: string; task_number: number | null; title: string; completed_at: string | null; status: string };
const ymd = (d?: string | null) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

function FieldInput({ f, value, onChange, disabled }: { f: CustomField; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  useEffect(() => { setTxt(value == null ? '' : String(value)); }, [value]);
  const cls = 'h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary disabled:opacity-60';
  if (f.type === 'checkbox') return <button type="button" disabled={disabled} onClick={() => onChange(!value)} className={`h-8 rounded-md border px-3 text-sm ${value ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-border'}`}>{value ? 'Sim' : 'Não'}</button>;
  if (f.type === 'select') return (
    <div className="flex flex-wrap gap-1.5">{f.options.map((o) => { const on = value === o; return <button key={o} type="button" disabled={disabled} onClick={() => onChange(on ? null : o)} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>{o}</button>; })}{!f.options.length ? <span className="text-xs text-muted-foreground">Sem opções configuradas</span> : null}</div>);
  if (f.type === 'date') return <input type="date" className={cls} disabled={disabled} value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value || null)} />;
  const num = f.type === 'number' || f.type === 'money';
  const commit = () => { const t = txt.trim(); if (!t) { if (value != null) onChange(null); return; } if (num) { const n = Number(t.replace(/\./g, '').replace(',', '.')); if (!isNaN(n) && n !== value) onChange(n); else if (isNaN(n)) setTxt(value == null ? '' : String(value)); } else if (t !== value) onChange(t.slice(0, 500)); };
  return <div className="relative">{f.type === 'money' ? <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span> : null}
    <input className={cls + (f.type === 'money' ? ' pl-8' : '')} disabled={disabled} inputMode={num ? 'decimal' : undefined} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder={num ? '0' : '—'} /></div>;
}

export function CardExtrasPanel({ task, boardId, readOnly, onUpdateTask, conclusionIds }: { task: { id: string; start_date?: string | null; due_date?: string | null }; boardId: string; readOnly?: boolean; onUpdateTask?: (id: string, u: Record<string, unknown>) => Promise<unknown>; conclusionIds?: Set<string> }) {
  const x = useBoardExtras();
  const [all, setAll] = useState<Mini[]>([]);
  const [q, setQ] = useState(''); const [pick, setPick] = useState(false);
  useEffect(() => { void (supabase as any).from('tasks').select('id,task_number,title,completed_at,status').eq('board_id', boardId).eq('is_archived', false).eq('is_template', false).order('task_number').limit(2000).then(({ data }: { data: Mini[] | null }) => setAll(data || [])); }, [boardId, pick]);
  if (!x) return null;
  const byId = new Map(all.map((t) => [t.id, t]));
  const blockers = x.blockersOf(task.id).map((id) => byId.get(id)).filter(Boolean) as Mini[];
  const blocking = x.blockingOf(task.id).map((id) => byId.get(id)).filter(Boolean) as Mini[];
  const isDone = (t: Mini) => !!t.completed_at || !!conclusionIds?.has(t.status);
  const openBlockers = blockers.filter((t) => !isDone(t));
  const cands = all.filter((t) => t.id !== task.id && !blockers.some((b) => b.id === t.id) && (!q.trim() || `#${t.task_number} ${t.title}`.toLowerCase().includes(q.trim().toLowerCase()))).slice(0, 30);
  const Chip = ({ t, onRemove }: { t: Mini; onRemove?: () => void }) => (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${isDone(t) ? 'border-emerald-300 text-muted-foreground line-through' : 'border-border'}`}>
      <span className="text-muted-foreground">#{t.task_number}</span><span className="truncate">{t.title}</span>
      {onRemove && !readOnly ? <button type="button" onClick={onRemove} aria-label="Remover dependência"><X className="h-3 w-3" /></button> : null}
    </span>);
  return (
    <div className="mx-4 my-2 space-y-3 rounded-lg border border-border p-3">
      {x.fields.length ? (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="h-4 w-4 text-muted-foreground" />Campos</div>
          <div className="grid gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr]">
            {x.fields.map((f) => [
              <span key={f.id + 'l'} className="self-center truncate text-xs text-muted-foreground" title={f.name}>{f.name}</span>,
              <div key={f.id + 'v'}><FieldInput f={f} value={x.valueOf(task.id, f.id)} disabled={readOnly} onChange={(v) => void x.setValue(task.id, f.id, v)} /></div>,
            ])}
          </div>
        </div>) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Início (linha do tempo)</span>
        <input type="date" disabled={readOnly || !onUpdateTask} className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={ymd(task.start_date)}
          onChange={(e) => { const v = e.target.value; void onUpdateTask?.(task.id, { start_date: v ? new Date(`${v}T09:00:00`).toISOString() : null }); }} aria-label="Data de início" />
        {task.start_date && task.due_date && new Date(task.start_date) > new Date(task.due_date) ? <span className="text-red-600">O início está depois do prazo</span> : null}
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4 text-muted-foreground" />Dependências
          {openBlockers.length ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><Lock className="h-3 w-3" />Bloqueado</span> : null}</div>
        <div className="space-y-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-muted-foreground">Bloqueado por</span>
            {blockers.map((t) => <Chip key={t.id} t={t} onRemove={() => void x.removeDep(task.id, t.id)} />)}
            {!readOnly ? (
              <Popover open={pick} onOpenChange={setPick}>
                <PopoverTrigger asChild><button type="button" className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 hover:bg-muted"><Plus className="h-3 w-3" />Adicionar</button></PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-2">
                  <div className="relative mb-2"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card deste mural" className="h-8 pl-7 text-sm" autoFocus /></div>
                  <div className="max-h-64 space-y-0.5 overflow-auto">{cands.length ? cands.map((t) => <button key={t.id} type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { void x.addDep(task.id, t.id); setPick(false); setQ(''); }}><span className="text-xs text-muted-foreground">#{t.task_number}</span><span className="truncate">{t.title}</span></button>) : <p className="p-2 text-xs text-muted-foreground">Nenhum card encontrado.</p>}</div>
                </PopoverContent>
              </Popover>) : null}
          </div>
          {blocking.length ? <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-muted-foreground">Bloqueia</span>{blocking.map((t) => <Chip key={t.id} t={t} />)}</div> : null}
          {openBlockers.length ? <p className="text-amber-700 dark:text-amber-300">Este card só pode ser concluído depois que os cards acima forem concluídos.</p> : null}
        </div>
      </div>
    </div>
  );
}
