// Metas individuais: each person keeps their goals (percent, number or done/not done) and updates the progress;
// managers set goals for their team (the person is notified) and follow everyone's progress. Every progress change
// is kept in goal_updates. Goals can be linked to an evaluation (evaluation_goals). Migration 20261121010000.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { appConfirm } from '@/lib/appDialog';
import { Av, db, fmtD, pname, usePeople } from './rhShared';
import '@/styles/chat-extras.css';

type G = { id: string; profile_id: string; title: string; description: string | null; metric: 'percent' | 'number' | 'boolean'; unit: string | null; start_value: number; target_value: number; current_value: number; start_date: string | null; due_date: string | null; status: 'active' | 'done' | 'cancelled'; created_by: string | null };
export const goalPct = (g: G) => g.metric === 'boolean' ? (g.current_value >= 1 ? 100 : 0) : g.target_value === g.start_value ? (g.current_value >= g.target_value ? 100 : 0) : Math.max(0, Math.min(100, Math.round(((g.current_value - g.start_value) / (g.target_value - g.start_value)) * 100)));

export function GoalsTab({ isManager }: { isManager: boolean }) {
  const { profile } = useAuth();
  const { list: people, byId } = usePeople();
  const [rows, setRows] = useState<G[] | null>(null);
  const [edit, setEdit] = useState<Partial<G> | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const { data } = await db.from('goals').select('*').neq('status', 'cancelled').order('due_date', { ascending: true, nullsFirst: false }).limit(500); setRows(data || []); }, []);
  useEffect(() => { void load(); }, [load]);
  const mine = (rows || []).filter((g) => g.profile_id === profile?.id);
  const team = (rows || []).filter((g) => g.profile_id !== profile?.id);
  const byPerson = useMemo(() => { const m = new Map<string, G[]>(); for (const g of team) { const a = m.get(g.profile_id) || []; a.push(g); m.set(g.profile_id, a); } return [...m.entries()]; }, [team]);
  const save = async () => {
    if (!edit?.title?.trim() || !edit.profile_id) return;
    setBusy(true);
    const row = { profile_id: edit.profile_id, title: edit.title.trim(), description: edit.description?.trim() || null, metric: edit.metric || 'percent', unit: edit.metric === 'number' ? (edit.unit || null) : edit.metric === 'percent' ? '%' : null, start_value: Number(edit.start_value) || 0, target_value: edit.metric === 'boolean' ? 1 : edit.metric === 'percent' ? 100 : Number(edit.target_value) || 0, current_value: Number(edit.current_value) || 0, start_date: edit.start_date || null, due_date: edit.due_date || null };
    const { error } = edit.id ? await db.from('goals').update(row).eq('id', edit.id) : await db.from('goals').insert(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar. Você só define metas para você ou para quem você gerencia.'); return; }
    toast.success('Meta salva'); setEdit(null); void load();
  };
  const progress = async (g: G, v: number) => {
    const done = g.metric === 'boolean' ? v >= 1 : v >= g.target_value;
    const { error } = await db.from('goals').update({ current_value: v, status: done ? 'done' : 'active' }).eq('id', g.id);
    if (error) toast.error('Não foi possível atualizar.'); else void load();
  };
  const remove = async (g: G) => {
    if (!(await appConfirm({ title: 'Excluir a meta?', message: g.title, confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('goals').delete().eq('id', g.id);
    if (error) toast.error('Não foi possível excluir.'); else void load();
  };
  const card = (g: G) => { const pct = goalPct(g); const late = g.status !== 'done' && g.due_date && g.due_date < new Date().toISOString().slice(0, 10); return (
    <div key={g.id} className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3">
      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{g.title}</div>{g.description ? <div className="text-xs text-muted-foreground">{g.description}</div> : null}</div>
        {g.status === 'done' ? <span className="dk-chp dk-c-g"><CheckCircle2 className="mr-1 inline h-3 w-3" />Concluída</span> : late ? <span className="dk-chp dk-c-r">Atrasada</span> : g.due_date ? <span className="dk-chp dk-c-n">até {fmtD(g.due_date)}</span> : null}</div>
      <div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div><b className="w-10 text-right text-xs">{pct}%</b></div>
      <div className="flex items-center gap-1.5 text-xs">
        {g.metric === 'boolean' ? <label className="flex items-center gap-1.5"><input type="checkbox" checked={g.current_value >= 1} onChange={(e) => void progress(g, e.target.checked ? 1 : 0)} />Feito</label>
          : <><span className="text-muted-foreground">Atual</span><Input type="number" className="h-8 w-24" defaultValue={g.current_value} onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== g.current_value) void progress(g, v); }} aria-label="Valor atual" /><span className="text-muted-foreground">de {g.target_value}{g.metric === 'percent' ? '%' : g.unit ? ` ${g.unit}` : ''}</span></>}
        <span className="flex-1" />
        <button type="button" className="cx-iconbtn" aria-label="Editar meta" title="Editar" onClick={() => setEdit(g)}><Pencil className="h-4 w-4" /></button>
        <button type="button" className="cx-iconbtn" aria-label="Excluir meta" onClick={() => void remove(g)}><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>); };
  const exportRows = () => (rows || []).map((g) => [pname(byId.get(g.profile_id)), g.title, g.metric === 'boolean' ? 'Feito/Não feito' : g.metric === 'percent' ? 'Percentual' : 'Número', g.current_value, g.target_value, `${goalPct(g)}%`, g.due_date ? fmtD(g.due_date) : '', g.status === 'done' ? 'Concluída' : 'Em andamento']);
  return (
    <div className="flex flex-col">
      <div className="dk-bar"><div className="dk-ti" style={{ fontSize: 15 }}>Minhas metas</div><div className="dk-flt">
        <ExportMenu className="dk-btn" getData={() => ({ name: 'metas', sheet: 'Metas', headers: ['Pessoa', 'Meta', 'Tipo', 'Atual', 'Alvo', 'Progresso', 'Prazo', 'Situação'], rows: exportRows() })} />
        <button type="button" className="dk-btn pri" onClick={() => setEdit({ profile_id: profile?.id, metric: 'percent', start_value: 0, current_value: 0, target_value: 100 })}><Plus size={16} />Nova meta</button></div></div>
      {rows === null ? <div className="dk-empty"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : mine.length ? <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{mine.map(card)}</div> : <div className="dk-empty">Você ainda não tem metas.</div>}
      {isManager && byPerson.length ? byPerson.map(([pid, gs]) => (
        <div key={pid}><div className="dk-gh"><span style={{ background: 'hsl(var(--primary))' }} /><Av p={byId.get(pid)} size={22} /><b className="ml-2">{pname(byId.get(pid))}</b><span className="ml-2 font-normal text-muted-foreground">{gs.filter((g) => g.status === 'done').length}/{gs.length} concluídas</span></div>
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{gs.map(card)}</div></div>
      )) : null}
      {isManager ? <div className="p-4 pt-0"><button type="button" className="dk-btn" onClick={() => setEdit({ profile_id: '', metric: 'percent', start_value: 0, current_value: 0, target_value: 100 })}><Plus size={16} />Definir meta para alguém da equipe</button></div> : null}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o && !busy) setEdit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit?.id ? 'Editar meta' : 'Nova meta'}</DialogTitle><DialogDescription>Metas claras, com prazo e um jeito simples de medir.</DialogDescription></DialogHeader>
          {edit ? <div className="cx-form">
            {isManager && !edit.id ? <div><label className="cx-l">Pessoa</label><Sel className="ui-sel w-full" value={edit.profile_id || ''} onChange={(e) => setEdit({ ...edit, profile_id: e.target.value })} aria-label="Pessoa"><option value="">Escolha a pessoa</option>{people.map((p) => <option key={p.id} value={p.id}>{p.id === profile?.id ? `${pname(p)} (você)` : pname(p)}</option>)}</Sel></div> : null}
            <div><label className="cx-l" htmlFor="gl-t">Meta</label><Input id="gl-t" value={edit.title || ''} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Ex.: Reduzir o tempo de resposta aos clientes" /></div>
            <div><label className="cx-l" htmlFor="gl-d">Detalhes</label><Textarea id="gl-d" rows={2} maxLength={4000} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="cx-two">
              <div><label className="cx-l">Como medir</label><Sel className="ui-sel w-full" value={edit.metric || 'percent'} onChange={(e) => setEdit({ ...edit, metric: e.target.value as G['metric'] })} aria-label="Como medir"><option value="percent">Percentual (0–100%)</option><option value="number">Número</option><option value="boolean">Feito / não feito</option></Sel></div>
              <div><label className="cx-l" htmlFor="gl-due">Prazo</label><Input id="gl-due" type="date" value={edit.due_date || ''} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></div>
            </div>
            {edit.metric === 'number' ? <div className="grid grid-cols-3 gap-2">
              <div><label className="cx-l" htmlFor="gl-s">Início</label><Input id="gl-s" type="number" value={edit.start_value ?? 0} onChange={(e) => setEdit({ ...edit, start_value: Number(e.target.value) })} /></div>
              <div><label className="cx-l" htmlFor="gl-a">Alvo</label><Input id="gl-a" type="number" value={edit.target_value ?? 0} onChange={(e) => setEdit({ ...edit, target_value: Number(e.target.value) })} /></div>
              <div><label className="cx-l" htmlFor="gl-u">Unidade</label><Input id="gl-u" value={edit.unit || ''} maxLength={20} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="vendas" /></div>
            </div> : null}
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)} disabled={busy}>Cancelar</Button><Button onClick={() => void save()} disabled={busy || !edit?.title?.trim() || !edit?.profile_id}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
