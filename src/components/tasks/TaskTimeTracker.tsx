// Time tracking on a card (task_time_entries + RPC task_timer): start/stop a stopwatch (one running timer per person —
// starting here stops one running on another card), add time by hand ("1h30", "45m", "2"), see the total and the time
// per person, and delete your own entries. Everyone who sees the card sees the time; only your own entries are yours.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pause, Play, Plus, Timer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveUsers } from '@/hooks/useDirectMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const db = supabase as any;
type E = { id: string; profile_id: string; started_at: string; ended_at: string | null; note: string | null };
const secs = (e: E, now: number) => Math.max(0, ((e.ended_at ? new Date(e.ended_at).getTime() : now) - new Date(e.started_at).getTime()) / 1000);
export const fmtDur = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}min` : m ? `${m}min` : `${Math.floor(s)}s`; };
const clock = (s: number) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((n) => String(n).padStart(2, '0')).join(':');
/** "1h30", "1:30", "90m", "45min", "2" (hours) → minutes */
const parseMin = (v: string) => {
  const s = v.trim().toLowerCase().replace(',', '.'); if (!s) return 0;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:oras?)?\s*(\d+)?\s*(?:m|min)?$/); if (m) return Math.round(parseFloat(m[1]) * 60 + (m[2] ? +m[2] : 0));
  m = s.match(/^(\d+):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+)\s*(?:m|min|minutos?)$/); if (m) return +m[1];
  m = s.match(/^(\d+(?:\.\d+)?)$/); if (m) return Math.round(parseFloat(m[1]) * 60);
  return NaN;
};

export function TaskTimeTracker({ taskId }: { taskId: string }) {
  const { profile } = useAuth(); const { users } = useActiveUsers();
  const [list, setList] = useState<E[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [manual, setManual] = useState(false); const [amount, setAmount] = useState(''); const [note, setNote] = useState('');
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(async () => { const { data } = await db.from('task_time_entries').select('id,profile_id,started_at,ended_at,note').eq('task_id', taskId).order('started_at', { ascending: false }).limit(500); setList((data || []) as E[]); setLoading(false); }, [taskId]);
  useEffect(() => { void load(); }, [load]);
  const running = list.find((e) => !e.ended_at && e.profile_id === profile?.id);
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [running]);
  const total = useMemo(() => list.reduce((a, e) => a + secs(e, now), 0), [list, now]);
  const byPerson = useMemo(() => { const m = new Map<string, number>(); for (const e of list) m.set(e.profile_id, (m.get(e.profile_id) || 0) + secs(e, now)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [list, now]);
  const nameOf = (id: string) => id === profile?.id ? 'Você' : (users.find((u) => u.id === id)?.display_name || users.find((u) => u.id === id)?.name || 'Colaborador');

  const toggle = async () => {
    setBusy(true);
    const { error } = await db.rpc('task_timer', { _task: taskId, _action: running ? 'stop' : 'start' });
    setBusy(false);
    if (error) { toast.error('Não foi possível usar o cronômetro.'); return; }
    if (!running) toast.success('Cronômetro iniciado'); setNow(Date.now()); void load();
  };
  const addManual = async () => {
    const min = parseMin(amount);
    if (!min || isNaN(min) || min > 24 * 60) { toast.error('Informe o tempo, por exemplo 1h30 ou 45min (até 24h).'); return; }
    const end = new Date(); const start = new Date(end.getTime() - min * 60e3);
    const { error } = await db.from('task_time_entries').insert({ task_id: taskId, started_at: start.toISOString(), ended_at: end.toISOString(), note: note.trim() || null });
    if (error) { toast.error('Não foi possível registrar o tempo.'); return; }
    setAmount(''); setNote(''); setManual(false); toast.success('Tempo registrado'); void load();
  };
  const remove = async (e: E) => { const { error } = await db.from('task_time_entries').delete().eq('id', e.id); if (error) toast.error('Não foi possível excluir.'); else void load(); };
  const shown = showAll ? list : list.slice(0, 4);

  return (
    <div className="mx-4 my-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Timer className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Tempo</span>
        <span className="text-xs text-muted-foreground">{loading ? '…' : `Total ${fmtDur(total)}`}</span>
        <span className="flex-1" />
        {running ? <span className="font-mono text-sm tabular-nums text-emerald-600">{clock(secs(running, now))}</span> : null}
        <Button size="sm" variant={running ? 'destructive' : 'default'} onClick={() => void toggle()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : running ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}{running ? 'Parar' : 'Iniciar'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setManual(!manual)} aria-label="Adicionar tempo"><Plus className="h-4 w-4" /></Button>
      </div>
      {manual ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Tempo (ex.: 1h30)" className="h-8 w-36 text-sm" autoFocus onKeyDown={(e) => e.key === 'Enter' && void addManual()} aria-label="Tempo gasto" />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que foi feito (opcional)" maxLength={200} className="h-8 min-w-0 flex-1 text-sm" aria-label="Observação" />
          <Button size="sm" onClick={() => void addManual()}>Registrar</Button>
        </div>) : null}
      {byPerson.length > 1 ? <div className="mt-2 flex flex-wrap gap-1.5">{byPerson.map(([p, s]) => <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{nameOf(p)}: {fmtDur(s)}</span>)}</div> : null}
      {list.length ? (
        <ul className="mt-2 space-y-1">
          {shown.map((e) => (
            <li key={e.id} className="group flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-20 shrink-0 font-medium text-foreground">{e.ended_at ? fmtDur(secs(e, now)) : 'rodando…'}</span>
              <span className="truncate">{nameOf(e.profile_id)} · {new Date(e.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}{e.note ? ` · ${e.note}` : ''}</span>
              {e.profile_id === profile?.id && e.ended_at ? <button type="button" className="ml-auto opacity-0 group-hover:opacity-100" onClick={() => void remove(e)} aria-label="Excluir registro"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button> : null}
            </li>))}
          {list.length > 4 ? <li><button type="button" className="text-xs underline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Mostrar menos' : `Ver todos (${list.length})`}</button></li> : null}
        </ul>) : null}
    </div>
  );
}
