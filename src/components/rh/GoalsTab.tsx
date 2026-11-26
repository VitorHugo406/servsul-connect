// Metas individuais: each person keeps their goals (percent, number or done/not done) and updates the progress;
// managers set goals for their team (the person is notified) and follow everyone's progress. Every progress change
// is kept in goal_updates. Goals can be linked to an evaluation (evaluation_goals). Migration 20261121010000.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sel } from '@/components/ui/Sel';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { appConfirm } from '@/lib/appDialog';
import { Av, RhEmpty, RhHead, RhSec, RhSt, db, fmtD, pname, usePeople } from './rhShared';
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
  const [shut, setShut] = useState<Set<string>>(new Set());
  const todayIso = new Date().toISOString().slice(0, 10);
  const unit = (g: G) => (g.metric === 'percent' ? '%' : g.unit ? ` ${g.unit}` : '');
  const goalRow = (g: G) => { const pct = goalPct(g); const late = g.status !== 'done' && !!g.due_date && g.due_date < todayIso; return (
    <div key={g.id} className="rh-row rh-goal">
      <div className="rh-main">
        <div className="rh-t" style={g.status === 'done' ? { color: 'hsl(var(--muted-foreground))' } : undefined}>{g.title}</div>
        <div className="rh-m">{[g.due_date ? `prazo ${fmtD(g.due_date)}` : 'sem prazo', g.metric === 'boolean' ? 'feito / não feito' : `meta ${g.target_value}${unit(g)}`].join(' · ')}</div>
        {g.description ? <div className="rh-q">{g.description}</div> : null}
      </div>
      <div className="rh-prog"><div className="rh-bar"><i style={{ width: `${pct}%`, ...(g.status === 'done' ? { background: 'hsl(142 60% 40%)' } : late ? { background: 'hsl(0 70% 52%)' } : {}) }} /></div><b>{pct}%</b></div>
      <div className="rh-upd">
        {g.metric === 'boolean' ? <button type="button" className={'dk-btn' + (g.current_value >= 1 ? '' : ' pri')} onClick={() => void progress(g, g.current_value >= 1 ? 0 : 1)}>{g.current_value >= 1 ? 'Desfazer' : <><CheckCircle2 size={15} />Marcar feita</>}</button>
          : <label className="rh-val"><input key={`${g.id}:${g.current_value}`} type="number" defaultValue={g.current_value} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== g.current_value) void progress(g, v); }} aria-label="Valor atual" /><span>/ {g.target_value}{unit(g)}</span></label>}
      </div>
      <div className="rh-end">
        {g.status === 'done' ? <RhSt k="ok">Concluída</RhSt> : late ? <RhSt k="no">Atrasada</RhSt> : <RhSt k="blue">Em andamento</RhSt>}
        <button type="button" className="dk-ic" aria-label="Editar meta" title="Editar" onClick={() => setEdit(g)}><Pencil size={15} /></button>
        <button type="button" className="dk-ic" aria-label="Excluir meta" title="Excluir" onClick={() => void remove(g)}><Trash2 size={15} /></button>
      </div>
    </div>); };
  const sortG = (gs: G[]) => [...gs].sort((x, y) => (x.status === 'done' ? 1 : 0) - (y.status === 'done' ? 1 : 0) || (x.due_date || '9999').localeCompare(y.due_date || '9999'));
  const exportRows = () => (rows || []).map((g) => [pname(byId.get(g.profile_id)), g.title, g.metric === 'boolean' ? 'Feito/Não feito' : g.metric === 'percent' ? 'Percentual' : 'Número', g.current_value, g.target_value, `${goalPct(g)}%`, g.due_date ? fmtD(g.due_date) : '', g.status === 'done' ? 'Concluída' : 'Em andamento']);
  const newMine = () => setEdit({ profile_id: profile?.id, metric: 'percent', start_value: 0, current_value: 0, target_value: 100 });
  const avg = (gs: G[]) => (gs.length ? Math.round(gs.reduce((t, g) => t + goalPct(g), 0) / gs.length) : 0);
  return (
    <div className="rh-area">
      <RhHead title="Metas" desc="Defina o que quer alcançar, com prazo e um jeito simples de medir. Atualize o valor atual e o progresso é calculado sozinho.">
        <ExportMenu className="dk-btn" getData={() => ({ name: 'metas', sheet: 'Metas', headers: ['Pessoa', 'Meta', 'Tipo', 'Atual', 'Alvo', 'Progresso', 'Prazo', 'Situação'], rows: exportRows() })} />
        {isManager ? <button type="button" className="dk-btn" onClick={() => setEdit({ profile_id: '', metric: 'percent', start_value: 0, current_value: 0, target_value: 100 })}><Plus size={16} />Meta para a equipe</button> : null}
        <button type="button" className="dk-btn pri" onClick={newMine}><Plus size={16} />Nova meta</button>
      </RhHead>
      <RhSec title="Minhas metas" n={mine.length || undefined} right={mine.length ? <span className="rh-m" style={{ marginTop: 0 }}>{mine.filter((g) => g.status === 'done').length} de {mine.length} concluídas · média {avg(mine)}%</span> : null}>
        {rows === null ? <div className="rh-empty"><Loader2 className="h-5 w-5 animate-spin" /></div> : mine.length ? <div className="rh-list">{sortG(mine).map(goalRow)}</div>
          : <RhEmpty title="Você ainda não tem metas" text="Ex.: “Concluir o curso de Excel até março” ou “Atender 120 chamados no mês”." action={<button type="button" className="dk-btn" onClick={newMine}><Plus size={16} />Nova meta</button>} />}
      </RhSec>
      {isManager && byPerson.length ? (
        <RhSec title="Metas da equipe" n={byPerson.length}>
          <div className="flex flex-col gap-2.5">
            {byPerson.map(([pid, gs]) => { const p = byId.get(pid); const closed = shut.has(pid); const late = gs.filter((g) => g.status !== 'done' && g.due_date && g.due_date < todayIso).length; return (
              <div key={pid} className="rh-list">
                <button type="button" className="rh-row rh-click rh-ph" aria-expanded={!closed} onClick={() => setShut((s0) => { const n = new Set(s0); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; })}>
                  <Av p={p} size={30} />
                  <div className="rh-main"><div className="rh-t">{pname(p)}</div><div className="rh-m">{gs.filter((g) => g.status === 'done').length} de {gs.length} concluídas{late ? ` · ${late} atrasada${late > 1 ? 's' : ''}` : ''}</div></div>
                  <div className="rh-prog"><div className="rh-bar"><i style={{ width: `${avg(gs)}%` }} /></div><b>{avg(gs)}%</b></div>
                  <ChevronDown size={17} style={{ transform: closed ? 'rotate(-90deg)' : undefined, transition: 'transform .15s', color: 'hsl(var(--muted-foreground))' }} />
                </button>
                {closed ? null : sortG(gs).map(goalRow)}
              </div>); })}
          </div>
        </RhSec>
      ) : null}
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
