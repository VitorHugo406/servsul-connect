// "Critérios" tab: the criteria models used by the evaluation forms.
// Experience model: registered ONLY by the company admin (managers just use it). Development model: admin or supervisors.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as E from '@/lib/evaluations';
import { PRESETS, type EvalKind } from '@/lib/evalPresets';

const MAX_EXPERIENCE = 14;   // the printed form keeps its layout up to this many criteria
const TITLE: Record<EvalKind, string> = { experience: 'Contrato de experiência', development: 'Desempenho e desenvolvimento' };

export function CriteriaModelPanel({ isAdmin }: { isAdmin: boolean }) {
  const [kind, setKind] = useState<EvalKind>('experience');
  const [rows, setRows] = useState<E.ModelCriterion[] | null>(null);
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; group: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = kind === 'development' || isAdmin;

  const load = useCallback(async () => {
    setRows(null);
    try { setRows(await E.listModel(kind, true)); } catch (e) { toast.error((e as Error).message); setRows([]); }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const names = [...PRESETS[kind].map((g) => g.group), ...(rows || []).map((r) => r.group_name || 'CRITÉRIOS')];
    return [...new Set(names)];
  }, [kind, rows]);
  const activeCount = (rows || []).filter((r) => r.is_active).length;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setEdit(null); await load(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const move = (g: string, idx: number, dir: -1 | 1) => {
    const list = (rows || []).filter((r) => (r.group_name || 'CRITÉRIOS') === g);
    const a = list[idx], b = list[idx + dir];
    if (a && b) void run(() => E.moveModelCriterion(a, b), 'Ordem atualizada');
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex w-fit rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {(['experience', 'development'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition', kind === k ? 'bg-white text-foreground shadow-sm dark:bg-zinc-950' : 'text-zinc-500 hover:text-foreground')}>{TITLE[k]}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-semibold text-foreground">Modelo de critérios · {TITLE[kind]}</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          {kind === 'experience'
            ? 'Estes critérios entram em todas as avaliações de experiência (45 e 90 dias) e no PDF. Só o administrador da empresa cadastra e altera este modelo.'
            : 'Critérios das avaliações de desenvolvimento. Ao criar uma avaliação, o gestor escolhe quais deles usar.'}
        </p>
        {!canEdit ? <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><Lock className="h-3.5 w-3.5" />Somente o administrador da empresa pode alterar o modelo de experiência.</p> : null}
        {kind === 'experience' ? <p className="mt-1 text-xs text-zinc-500">Ativos: {activeCount} de no máximo {MAX_EXPERIENCE} (limite para o PDF caber em uma página).</p> : null}
      </div>

      {!rows ? <p className="py-8 text-center text-sm text-zinc-500">Carregando…</p> : groups.map((g) => {
        const list = rows.filter((r) => (r.group_name || 'CRITÉRIOS') === g);
        if (!list.length && !canEdit) return null;
        return (
          <div key={g} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{g}</p>
              {canEdit ? <Button size="sm" variant="outline" className="rounded-lg" disabled={kind === 'experience' && activeCount >= MAX_EXPERIENCE} onClick={() => setEdit({ name: '', description: '', group: g })}><Plus className="mr-1 h-3.5 w-3.5" />Critério</Button> : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {list.map((c, idx) => (
                <div key={c.id} className={cn('flex items-start gap-2 rounded-2xl border border-zinc-200 bg-background p-3 dark:border-zinc-800', !c.is_active && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{c.name}{!c.is_active ? <span className="ml-2 text-xs text-zinc-500">(desativado)</span> : null}</p>
                    {c.description ? <p className="text-xs text-zinc-500">{c.description}</p> : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Subir" disabled={busy || idx === 0} onClick={() => move(g, idx, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Descer" disabled={busy || idx === list.length - 1} onClick={() => move(g, idx, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => setEdit({ id: c.id, name: c.name, description: c.description || '', group: g })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy || (!c.is_active && kind === 'experience' && activeCount >= MAX_EXPERIENCE)} onClick={() => void run(() => E.setModelCriterionActive(c.id, !c.is_active), c.is_active ? 'Critério desativado' : 'Critério ativado')}>{c.is_active ? 'Desativar' : 'Ativar'}</Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {edit ? (
        <Dialog open onOpenChange={(o) => { if (!o) setEdit(null); }}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader><DialogTitle>{edit.id ? 'Editar critério' : 'Novo critério'} · {edit.group}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input className="rounded-xl" maxLength={120} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Atendimento ao cliente" /></div>
              <div className="space-y-1.5"><Label>O que é avaliado (aparece abaixo do nome no PDF)</Label><Textarea className="rounded-xl" rows={3} maxLength={300} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button className="rounded-xl" disabled={busy || !edit.name.trim()} onClick={() => void run(() => E.saveModelCriterion(kind, { id: edit.id, name: edit.name, description: edit.description, group_name: edit.group, sort_order: (rows || []).filter((r) => (r.group_name || 'CRITÉRIOS') === edit.group).reduce((m, r) => Math.max(m, r.sort_order), 0) + 1 }), 'Critério salvo')}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
