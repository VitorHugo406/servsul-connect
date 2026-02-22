import { useState } from 'react';
import { Zap, Plus, Trash2, ArrowRight, Bell, MoveRight, AlertTriangle, CheckCircle, Tag, Clock, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AutomationRule, TRIGGER_TYPES, ACTION_TYPES, useAutomationRules } from '@/hooks/useAutomationRules';
import { TaskBoardColumn } from '@/hooks/useTaskBoards';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TRIGGER_ICONS: Record<string, any> = {
  deadline_approaching: Clock,
  stuck_days: Pause,
  checklist_complete: CheckCircle,
  label_urgent: Tag,
};

const ACTION_ICONS: Record<string, any> = {
  notify: Bell,
  move_column: MoveRight,
  set_priority: AlertTriangle,
  alert: AlertTriangle,
};

export function AutomationRulesPanel({ open, onOpenChange, boardId, taskId, columns }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  boardId: string;
  taskId?: string;
  columns: TaskBoardColumn[];
}) {
  const { rules, createRule, deleteRule, toggleRule } = useAutomationRules(boardId);
  const taskRules = taskId ? rules.filter(r => r.task_id === taskId) : rules.filter(r => !r.task_id);

  const [showCreate, setShowCreate] = useState(false);
  const [triggerType, setTriggerType] = useState('deadline_approaching');
  const [actionType, setActionType] = useState('notify');
  const [triggerValue, setTriggerValue] = useState('24');
  const [actionColumnId, setActionColumnId] = useState(columns[0]?.id || '');
  const [actionPriority, setActionPriority] = useState('high');

  const handleCreate = async () => {
    const triggerConfig: Record<string, any> = {};
    if (triggerType === 'deadline_approaching') triggerConfig.hours = parseInt(triggerValue) || 24;
    if (triggerType === 'stuck_days') triggerConfig.days = parseInt(triggerValue) || 3;

    const actionConfig: Record<string, any> = {};
    if (actionType === 'move_column') actionConfig.column_id = actionColumnId;
    if (actionType === 'set_priority') actionConfig.priority = actionPriority;

    const { error } = await createRule({
      task_id: taskId,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      action_type: actionType,
      action_config: actionConfig,
    });

    if (error) { toast.error('Erro ao criar regra'); return; }
    toast.success('Automação criada!');
    setShowCreate(false);
  };

  const getTriggerLabel = (rule: AutomationRule) => {
    const t = TRIGGER_TYPES.find(t => t.id === rule.trigger_type);
    if (rule.trigger_type === 'deadline_approaching') return `Prazo a ${rule.trigger_config.hours || 24}h`;
    if (rule.trigger_type === 'stuck_days') return `Parado por ${rule.trigger_config.days || 3} dias`;
    return t?.label || rule.trigger_type;
  };

  const getActionLabel = (rule: AutomationRule) => {
    const a = ACTION_TYPES.find(a => a.id === rule.action_type);
    if (rule.action_type === 'move_column') {
      const col = columns.find(c => c.id === rule.action_config.column_id);
      return `Mover para "${col?.title || '?'}"`;
    }
    if (rule.action_type === 'set_priority') {
      const p = rule.action_config.priority;
      return `Prioridade → ${p === 'urgent' ? 'Urgente' : p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'}`;
    }
    return a?.label || rule.action_type;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Automações
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-3">
          {!showCreate ? (
            <div className="space-y-3">
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Nova Regra SE → ENTÃO
              </Button>

              {taskRules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma automação configurada.
                  <br />Crie regras para automatizar ações.
                </p>
              ) : (
                taskRules.map(rule => {
                  const TIcon = TRIGGER_ICONS[rule.trigger_type] || Zap;
                  const AIcon = ACTION_ICONS[rule.action_type] || Zap;
                  return (
                    <div key={rule.id} className={cn(
                      'border border-border rounded-lg p-3 space-y-2',
                      !rule.is_active && 'opacity-50'
                    )}>
                      <div className="flex items-center justify-between">
                        <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {rule.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRule(rule.id, !rule.is_active)}>
                            <Zap className={cn('h-3 w-3', rule.is_active ? 'text-yellow-500' : 'text-muted-foreground')} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRule(rule.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded">
                          <TIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">SE</span>
                          <span>{getTriggerLabel(rule)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />
                        <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded">
                          <AIcon className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium">ENTÃO</span>
                          <span>{getActionLabel(rule)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> Nova Regra
              </h4>

              {/* SE (Trigger) */}
              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <Label className="text-xs font-bold text-primary">SE (Condição)</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(triggerType === 'deadline_approaching') && (
                  <div className="space-y-1">
                    <Label className="text-xs">Horas antes do prazo</Label>
                    <Input type="number" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} min="1" />
                  </div>
                )}
                {(triggerType === 'stuck_days') && (
                  <div className="space-y-1">
                    <Label className="text-xs">Dias parado</Label>
                    <Input type="number" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} min="1" />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {TRIGGER_TYPES.find(t => t.id === triggerType)?.description}
                </p>
              </div>

              {/* ENTÃO (Action) */}
              <div className="space-y-2 p-3 bg-primary/5 rounded-lg">
                <Label className="text-xs font-bold text-primary">ENTÃO (Ação)</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {actionType === 'move_column' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Coluna destino</Label>
                    <Select value={actionColumnId} onValueChange={setActionColumnId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {columns.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.title}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {actionType === 'set_priority' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={actionPriority} onValueChange={setActionPriority}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {ACTION_TYPES.find(a => a.id === actionType)?.description}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleCreate}>Criar Regra</Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
