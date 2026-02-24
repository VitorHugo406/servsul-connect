import { useState } from 'react';
import { Zap, Activity, Clock, AlertTriangle, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BoardTask } from '@/hooks/useBoardTasks';
import { TaskBoardColumn } from '@/hooks/useTaskBoards';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OperationModeProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tasks: BoardTask[];
  columns: TaskBoardColumn[];
  members: any[];
  onUpdateTask: (id: string, updates: any) => Promise<any>;
  onMoveTask: (id: string, status: string, position: number) => Promise<any>;
  onRefetch: () => Promise<void>;
}

export function OperationModePanel({ open, onOpenChange, tasks, columns, members, onUpdateTask, onMoveTask, onRefetch }: OperationModeProps) {
  const [criteria, setCriteria] = useState({
    priority: true,
    deadline: true,
    urgency: true,
    workload: false,
  });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  const toggleCriteria = (key: keyof typeof criteria) => {
    setCriteria(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activateOperationMode = async () => {
    setRunning(true);
    const actions: string[] = [];

    try {
      // 1. Priority: set urgent cards to highest priority
      if (criteria.priority) {
        const urgentLabelTasks = tasks.filter(t => t.priority === 'urgent');
        if (urgentLabelTasks.length > 0) {
          actions.push(`${urgentLabelTasks.length} card(s) urgente(s) identificado(s)`);
        }
      }

      // 2. Deadline: identify overdue and at-risk cards
      if (criteria.deadline) {
        const now = new Date();
        const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now);
        const atRisk = tasks.filter(t => {
          if (!t.due_date) return false;
          const due = new Date(t.due_date);
          const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
          return hoursLeft > 0 && hoursLeft <= 48;
        });

        // Bump priority on overdue cards
        for (const task of overdue) {
          if (task.priority !== 'urgent') {
            await onUpdateTask(task.id, { priority: 'urgent' });
            actions.push(`Card #${task.task_number} "${task.title}" → prioridade URGENTE (atrasado)`);
          }
        }

        // Bump at-risk to high
        for (const task of atRisk) {
          if (task.priority !== 'urgent' && task.priority !== 'high') {
            await onUpdateTask(task.id, { priority: 'high' });
            actions.push(`Card #${task.task_number} "${task.title}" → prioridade ALTA (prazo próximo)`);
          }
        }
      }

      // 3. Urgency: reorganize positions within columns by priority
      if (criteria.urgency) {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        for (const col of columns) {
          const colTasks = tasks
            .filter(t => t.status === col.id)
            .sort((a, b) => {
              const pa = priorityOrder[a.priority] ?? 2;
              const pb = priorityOrder[b.priority] ?? 2;
              if (pa !== pb) return pa - pb;
              // Secondary sort by due date
              if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
              if (a.due_date) return -1;
              if (b.due_date) return 1;
              return 0;
            });

          // Check if reorder is needed
          const needsReorder = colTasks.some((t, i) => t.position !== i);
          if (needsReorder && colTasks.length > 0) {
            for (let i = 0; i < colTasks.length; i++) {
              if (colTasks[i].position !== i) {
                await onUpdateTask(colTasks[i].id, { position: i });
              }
            }
            actions.push(`Coluna "${col.title}" reorganizada por prioridade/prazo`);
          }
        }
        // Refetch tasks to reflect new order
        await onRefetch();
      }

      // 4. Workload balancing
      if (criteria.workload && members.length > 0) {
        const memberTaskCounts: Record<string, number> = {};
        for (const m of members) {
          memberTaskCounts[m.profile_id] = tasks.filter(t => t.assigned_to === m.profile_id).length;
        }

        const avgTasks = Object.values(memberTaskCounts).reduce((a, b) => a + b, 0) / members.length;
        const overloaded = Object.entries(memberTaskCounts)
          .filter(([, count]) => count > avgTasks * 1.5 && count > 3);
        const underloaded = Object.entries(memberTaskCounts)
          .filter(([, count]) => count < avgTasks * 0.5);

        if (overloaded.length > 0 && underloaded.length > 0) {
          for (const [overProfileId, overCount] of overloaded) {
            const excess = Math.floor(overCount - avgTasks);
            const overTasks = tasks
              .filter(t => t.assigned_to === overProfileId && t.priority !== 'urgent')
              .sort((a, b) => {
                const po: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
                return (po[a.priority] ?? 1) - (po[b.priority] ?? 1);
              })
              .slice(0, Math.min(excess, underloaded.length));

            for (let i = 0; i < overTasks.length && i < underloaded.length; i++) {
              const [targetProfileId] = underloaded[i];
              await onUpdateTask(overTasks[i].id, { assigned_to: targetProfileId });
              const overMember = members.find(m => m.profile_id === overProfileId);
              const underMember = members.find(m => m.profile_id === targetProfileId);
              actions.push(
                `Card #${overTasks[i].task_number} redistribuído: ${overMember?.profile?.display_name || 'Sobrecarregado'} → ${underMember?.profile?.display_name || 'Disponível'}`
              );
            }
          }
        } else if (overloaded.length > 0) {
          for (const [pid] of overloaded) {
            const m = members.find(m => m.profile_id === pid);
            actions.push(`⚠️ ${m?.profile?.display_name || 'Membro'} está sobrecarregado (${memberTaskCounts[pid]} cards)`);
          }
        }
      }

      if (actions.length === 0) {
        actions.push('✅ Nenhuma ação necessária — o board já está otimizado!');
      }
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
            <p className="text-sm font-medium">Selecione os critérios de otimização:</p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.priority} onCheckedChange={() => toggleCriteria('priority')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Por Prioridade
                  </p>
                  <p className="text-xs text-muted-foreground">Priorizar cards urgentes e reorganizar filas</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.deadline} onCheckedChange={() => toggleCriteria('deadline')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-orange-500" /> Por Prazo
                  </p>
                  <p className="text-xs text-muted-foreground">Elevar prioridade de cards atrasados ou com prazo próximo</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.urgency} onCheckedChange={() => toggleCriteria('urgency')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-yellow-500" /> Por Urgência
                  </p>
                  <p className="text-xs text-muted-foreground">Reorganizar posição dos cards por prioridade e prazo</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={criteria.workload} onCheckedChange={() => toggleCriteria('workload')} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-500" /> Balanceamento de Carga
                  </p>
                  <p className="text-xs text-muted-foreground">Redistribuir tarefas automaticamente entre membros</p>
                </div>
              </label>
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
              <Button onClick={activateOperationMode} disabled={running || !Object.values(criteria).some(Boolean)} className="gap-2">
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
