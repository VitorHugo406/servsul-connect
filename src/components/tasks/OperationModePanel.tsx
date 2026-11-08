import { useMemo, useState } from 'react';
import { planOperation, type OpColumn, type OpTask } from '@/lib/operationMode';
import { Zap, Activity, Clock, AlertTriangle, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BoardTask } from '@/hooks/useBoardTasks';
import { TaskBoardColumn } from '@/hooks/useTaskBoards';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface OperationModeProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tasks: BoardTask[];
  columns: TaskBoardColumn[];
  members: unknown[];
  onUpdateTask: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  onMoveTask: (id: string, status: string, position: number) => Promise<unknown>;
  onRefetch: () => Promise<void>;
}

const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgente', high: 'Alta', medium: 'Média', low: 'Baixa' };

export function OperationModePanel({ open, onOpenChange, tasks, columns, onRefetch }: OperationModeProps) {
  const [criteria, setCriteria] = useState({
    priority: true,
    deadline: true,
    urgency: true,
  });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const toggleCriteria = (key: keyof typeof criteria) => {
    setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // What will change, computed live (one pass, see lib/operationMode).
  const plan = useMemo(() => planOperation(tasks as OpTask[], columns as unknown as OpColumn[], criteria), [tasks, columns, criteria]);
  const movedCols = plan.columns.filter((c) => c.moved > 0);

  const activateOperationMode = async () => {
    setRunning(true);
    const actions: string[] = [];
    try {
      const updates: Promise<{ error: unknown }>[] = [];
      const priorityOf = new Map(plan.priorityChanges.map((c) => [c.id, c.to]));
      const positionOf = new Map(plan.moves.map((m) => [m.id, m.position]));
      const ids = new Set([...priorityOf.keys(), ...positionOf.keys()]);
      for (const id of ids) {
        const patch: { priority?: string; position?: number } = {};
        if (priorityOf.has(id)) patch.priority = priorityOf.get(id);
        if (positionOf.has(id)) patch.position = positionOf.get(id);
        updates.push(Promise.resolve(supabase.from('tasks').update(patch).eq('id', id)) as Promise<{ error: unknown }>);
      }
      // Small batches: fast, without flooding the connection.
      let failed = 0;
      for (let k = 0; k < updates.length; k += 10) {
        const res = await Promise.all(updates.slice(k, k + 10));
        failed += res.filter((r) => r.error).length;
      }
      for (const c of plan.priorityChanges) actions.push(`Card #${c.number} "${c.title}": ${PRIORITY_LABEL[c.from]} → ${PRIORITY_LABEL[c.to]} (${c.reason === 'overdue' ? 'atrasado' : 'prazo em até 48h'})`);
      for (const c of movedCols) actions.push(`Coluna "${c.title}": ${c.moved} de ${c.total} card(s) mudaram de posição`);
      if (failed) actions.push(`❌ ${failed} alteração(ões) não foram salvas. Tente de novo.`);
      await onRefetch();
      if (actions.length === 0) actions.push('✅ Nada a mudar: o quadro já está organizado.');
    } catch (error) {
      console.error('Error in operation mode:', error);
      actions.push('❌ Erro ao processar algumas ações');
    }
    setResults(actions);
    setShowResults(true);
    setRunning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Modo Operação
          </DialogTitle>
          <DialogDescription>
            Reorganize automaticamente seu fluxo de trabalho com base nos critérios selecionados.
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">Selecione os critérios de reorganização das colunas:</p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.priority} onCheckedChange={() => toggleCriteria('priority')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Por Prioridade
                  </p>
                  <p className="text-xs text-muted-foreground">Reorganizar cards dentro de cada coluna por prioridade (urgente → baixo)</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.deadline} onCheckedChange={() => toggleCriteria('deadline')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-orange-500" /> Por Prazo
                  </p>
                  <p className="text-xs text-muted-foreground">Elevar prioridade de cards atrasados/próximos e reordenar por data</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.urgency} onCheckedChange={() => toggleCriteria('urgency')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-yellow-500" /> Por Urgência
                  </p>
                  <p className="text-xs text-muted-foreground">Combinar prioridade + prazo para ordenação final</p>
                </div>
              </label>

            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Prévia</p>
              {plan.moves.length === 0 && plan.priorityChanges.length === 0
                ? <p className="text-muted-foreground">O quadro já está organizado com esses critérios.</p>
                : <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {plan.priorityChanges.length ? <li>• {plan.priorityChanges.length} card(s) sobem de prioridade por causa do prazo</li> : null}
                    {movedCols.map((c) => <li key={c.id}>• "{c.title}": {c.moved} card(s) mudam de posição</li>)}
                  </ul>}
              <p className="mt-2 text-xs text-muted-foreground">Ordem: emergências, atrasados, prioridade (urgente → baixa), prazo mais próximo. Colunas de conclusão, modelos e cards arquivados não mudam.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-500 text-white">Concluído</Badge>
              <span className="text-sm text-muted-foreground">{results.length} ação(ões)</span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className="text-sm p-2 bg-muted rounded-lg">{r}</div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {!showResults ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={activateOperationMode} disabled={running || !Object.values(criteria).some(Boolean) || (plan.moves.length === 0 && plan.priorityChanges.length === 0)} className="gap-2">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                Ativar Modo Operação
              </Button>
            </>
          ) : (
            <Button onClick={() => { setShowResults(false); setResults([]); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
