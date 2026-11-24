// Inside the card dialog: the mural's custom fields (edit in place), the start date used by the Linha do tempo, and
// dependencies ("Bloqueado por" / "Bloqueia"). Uses the BoardExtrasProvider of the open mural; renders nothing when the
// card is opened outside a mural.
import { useEffect, useState } from 'react';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Check, Lock, Plus, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBoardExtras, fieldText, type CustomField } from '@/hooks/useBoardExtras';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CardLinks } from './CardLinks';

type Mini = { id: string; task_number: number | null; title: string; completed_at: string | null; status: string };

// One property row value, Notion-style: no visible box until hover/focus, "Vazio" when empty, lists and dates open
// a small picker instead of showing every option.
function FieldInput({ f, value, onChange, disabled }: { f: CustomField; value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const show = (v: unknown) => v == null || v === '' ? '' : f.type === 'money' ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : f.type === 'number' ? Number(v).toLocaleString('pt-BR') : String(v);
  const [txt, setTxt] = useState(show(value));
  const [open, setOpen] = useState(false);
  useEffect(() => { setTxt(show(value)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  const cell = `flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm ${disabled ? '' : 'hover:bg-muted/70 focus-within:bg-muted/70'}`;
  const empty = <span className="text-muted-foreground/70">Vazio</span>;
  if (f.type === 'checkbox') return (
    <button type="button" disabled={disabled} onClick={() => onChange(!value)} className={cell}>
      <span className={`grid h-4 w-4 place-items-center rounded border ${value ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{value ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
      <span className={value ? '' : 'text-muted-foreground'}>{value ? 'Sim' : 'Não'}</span>
    </button>);
  if (f.type === 'select') return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cell}>{value ? <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[13px]">{String(value)}</span> : empty}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {f.options.map((o) => (
          <button key={o} type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { onChange(o); setOpen(false); }}>
            <span className="flex-1 truncate">{o}</span>{value === o ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>))}
        {!f.options.length ? <p className="px-2 py-1.5 text-xs text-muted-foreground">Sem opções configuradas</p> : null}
        {value ? <button type="button" className="mt-1 w-full rounded border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => { onChange(null); setOpen(false); }}>Limpar</button> : null}
      </PopoverContent>
    </Popover>);
  if (f.type === 'date') {
    const sel = value ? (() => { const [y, m, d] = String(value).split('-').map(Number); return new Date(y, m - 1, d); })() : undefined;
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return (
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild><button type="button" disabled={disabled} className={cell}>{value ? fieldText(f, value) : empty}</button></PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar mode="single" locale={ptBR} selected={sel} defaultMonth={sel} onSelect={(d) => { onChange(d ? ymd(d) : null); setOpen(false); }} initialFocus />
          {value ? <button type="button" className="w-full border-t border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => { onChange(null); setOpen(false); }}>Limpar data</button> : null}
        </PopoverContent>
      </Popover>);
  }
  const num = f.type === 'number' || f.type === 'money';
  const commit = () => { const t = txt.trim(); if (!t) { if (value != null) onChange(null); return; } if (num) { const n = Number(t.replace(/\./g, '').replace(',', '.')); if (!isNaN(n) && n !== value) onChange(n); else setTxt(show(value)); } else if (t !== value) onChange(t.slice(0, 500)); };
  return (
    <label className={cell}>
      {f.type === 'money' && txt ? <span className="text-muted-foreground">R$</span> : null}
      <input className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70 disabled:cursor-default" disabled={disabled} inputMode={num ? 'decimal' : undefined} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} placeholder="Vazio" />
    </label>);
}

export function CardExtrasPanel({ task, boardId, readOnly, conclusionIds, showLinks, showDeps, only }: { task: { id: string }; boardId: string; readOnly?: boolean; conclusionIds?: Set<string>; showLinks?: boolean; showDeps?: boolean; only?: 'fields' | 'rest' }) {
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
    <span className={`tdx-dep inline-flex max-w-full items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs ${isDone(t) ? 'border-emerald-300 text-muted-foreground line-through' : 'border-border'}`}>
      <span className="text-muted-foreground">#{t.task_number}</span><span className="truncate">{t.title}</span>
      {onRemove && !readOnly ? <button type="button" onClick={onRemove} aria-label="Remover dependência"><X className="h-3 w-3" /></button> : null}
    </span>);
  const H = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>;
  const depsVisible = showDeps || blockers.length > 0 || blocking.length > 0;
  return (
    <>
      {only !== 'rest' && x.fields.length ? (
        <div className="px-4 py-2">
          <H>Campos</H>
          <div className="-mx-2 max-w-[520px]">
            {x.fields.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="w-[130px] shrink-0 truncate px-2 text-[13px] text-muted-foreground" title={f.name}>{f.name}</span>
                <div className="min-w-0 flex-1"><FieldInput f={f} value={x.valueOf(task.id, f.id)} disabled={readOnly} onChange={(v) => void x.setValue(task.id, f.id, v)} /></div>
              </div>))}
          </div>
        </div>) : null}
      {only !== 'fields' && depsVisible ? (
        <div className="px-4 py-2">
          <H>Dependências {openBlockers.length ? <span className="inline-flex items-center gap-1 rounded-[6px] bg-amber-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><Lock className="h-3 w-3" />Bloqueado</span> : null}</H>
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-muted-foreground">Espera por</span>
              {blockers.map((t) => <Chip key={t.id} t={t} onRemove={() => void x.removeDep(task.id, t.id)} />)}
              {!readOnly ? (
                <Popover open={pick} onOpenChange={setPick}>
                  <PopoverTrigger asChild><button type="button" className="tdx-dep inline-flex h-7 items-center gap-1 rounded-[8px] border border-dashed border-border px-2.5 hover:bg-muted"><Plus className="h-3 w-3" />Adicionar</button></PopoverTrigger>
                  <PopoverContent align="start" className="w-80 p-2">
                    <div className="relative mb-2"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar card deste mural" className="h-8 pl-7 text-sm" autoFocus /></div>
                    <div className="max-h-64 space-y-0.5 overflow-auto">{cands.length ? cands.map((t) => <button key={t.id} type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { void x.addDep(task.id, t.id); setPick(false); setQ(''); }}><span className="text-xs text-muted-foreground">#{t.task_number}</span><span className="truncate">{t.title}</span></button>) : <p className="p-2 text-xs text-muted-foreground">Nenhum card encontrado.</p>}</div>
                  </PopoverContent>
                </Popover>) : null}
            </div>
            {blocking.length ? <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-muted-foreground">Segura</span>{blocking.map((t) => <Chip key={t.id} t={t} />)}</div> : null}
            {openBlockers.length ? <p className="text-amber-700 dark:text-amber-300">Só pode ser concluído depois dos cards acima.</p> : null}
          </div>
        </div>) : null}
      {only !== 'fields' ? <CardLinks taskId={task.id} readOnly={readOnly} forceOpen={showLinks} /> : null}
    </>
  );
}
