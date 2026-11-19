import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveUsers } from '@/hooks/useDirectMessages';
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
  card_created: Plus,
  moved_to_column: MoveRight,
  card_completed: CheckCircle,
  card_assigned: Bell,
  deadline_approaching: Clock,
  stuck_days: Pause,
  checklist_complete: CheckCircle,
  label_urgent: Tag,
};

const ACTION_ICONS: Record<string, any> = {
  assign_to: Bell,
  add_label: Tag,
  set_due_days: Clock,
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
  const boardRules = rules.filter(r => !r.task_id);
  const cardRules = rules.filter(r => !!r.task_id);
  const displayRules = taskId ? rules.filter(r => r.task_id === taskId) : rules;

  const [showCreate, setShowCreate] = useState(false);
  const [triggerType, setTriggerType] = useState('deadline_approaching');
  const [actionType, setActionType] = useState('notify');
  const [triggerValue, setTriggerValue] = useState('24');
  const [actionColumnId, setActionColumnId] = useState(columns[0]?.id || '');
  const [actionPriority, setActionPriority] = useState('high');
  const [triggerColumnId, setTriggerColumnId] = useState(columns[0]?.id || '');
  const [actionProfileId, setActionProfileId] = useState('');
  const [actionLabelId, setActionLabelId] = useState('');
  const [actionDays, setActionDays] = useState('2');
  const [labels, setLabels] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const { users } = useActiveUsers();
  useEffect(() => { if (!triggerColumnId && columns[0]) setTriggerColumnId(columns[0].id); }, [columns, triggerColumnId]);
  useEffect(() => { if (!open) return; void (supabase as any).from('task_labels').select('id,name,color').eq('board_id', boardId).order('name').then(({ data }: any) => setLabels(data || [])); }, [open, boardId]);
  const instant = !!TRIGGER_TYPES.find((t: any) => t.id === triggerType)?.instant;
  const actionChoices = ACTION_TYPES.filter((a: any) => instant || !a.instantOnly);
  const personName = (id?: string) => { const u = users.find((x) => x.id === id); return u ? (u.display_name || u.name) : 'pessoa removida'; };

  const handleCreate = async () => {
    const triggerConfig: Record<string, any> = {};
    if (triggerType === 'deadline_approaching') triggerConfig.hours = parseInt(triggerValue) || 24;
    if (triggerType === 'stuck_days') triggerConfig.days = parseInt(triggerValue) || 3;
    if (triggerType === 'moved_to_column') { if (!triggerColumnId) { toast.error('Escolha a coluna'); return; } triggerConfig.column_id = triggerColumnId; }
    if (!actionChoices.some((a) => a.id === actionType)) { toast.error('Essa ação só funciona com gatilhos instantâneos'); return; }

    const actionConfig: Record<string, any> = {};
    if (actionType === 'move_column') actionConfig.column_id = actionColumnId;
    if (actionType === 'set_priority') actionConfig.priority = actionPriority;
    if (actionType === 'assign_to') { if (!actionProfileId) { toast.error('Escolha a pessoa'); return; } actionConfig.profile_id = actionProfileId; }
    if (actionType === 'notify' && actionProfileId && instant) actionConfig.profile_id = actionProfileId;
    if (actionType === 'add_label') { if (!actionLabelId) { toast.error('Escolha a etiqueta'); return; } actionConfig.label_id = actionLabelId; }
    if (actionType === 'set_due_days') actionConfig.days = Math.max(0, Math.min(365, parseInt(actionDays) || 0));

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
    if (rule.trigger_type === 'moved_to_column') return `Card entrou em "${columns.find(c => c.id === rule.trigger_config.column_id)?.title || '?'}"`;
    return t?.label || rule.trigger_type;
  };

  const getActionLabel = (rule: AutomationRule) => {
    const a = ACTION_TYPES.find(a => a.id === rule.action_type);
    if (rule.action_type === 'move_column') {
      const col = columns.find(c => c.id === rule.action_config.column_id);
      return `Mover para "${col?.title || '?'}"`;
    }
    if (rule.action_type === 'assign_to') return `Responsável → ${personName(rule.action_config.profile_id)}`;
    if (rule.action_type === 'notify' && rule.action_config.profile_id) return `Notificar ${personName(rule.action_config.profile_id)}`;
    if (rule.action_type === 'add_label') return `Etiqueta "${labels.find(l => l.id === rule.action_config.label_id)?.name || '?'}"`;
    if (rule.action_type === 'set_due_days') return `Prazo em ${rule.action_config.days ?? 0} dia(s)`;
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

              {displayRules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma automação configurada.
                  <br />Crie regras para automatizar ações.
                </p>
              ) : (
                displayRules.map(rule => {
                  const TIcon = TRIGGER_ICONS[rule.trigger_type] || Zap;
                  const AIcon = ACTION_ICONS[rule.action_type] || Zap;
                  const isCardRule = !!rule.task_id;
                  return (
                    <div key={rule.id} className={cn(
                      'border border-border rounded-lg p-3 space-y-2',
                      !rule.is_active && 'opacity-50'
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-[10px]">
                            {rule.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {isCardRule ? '📋 Card' : '📊 Mural'}
                          </Badge>
                        </div>
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
                <Select value={triggerType} onValueChange={(v) => { setTriggerType(v); const ins = !!TRIGGER_TYPES.find((t: any) => t.id === v)?.instant; if (!ins && ACTION_TYPES.find((a: any) => a.id === actionType)?.instantOnly) setActionType('notify'); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.instant ? '⚡ ' : '⏱ '}{t.label}</SelectItem>
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
                {triggerType === 'moved_to_column' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Coluna</Label>
                    <Select value={triggerColumnId} onValueChange={setTriggerColumnId}>
                      <SelectTrigger><SelectValue placeholder="Escolha a coluna" /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {instant ? '⚡ Instantâneo · ' : '⏱ Verificado periodicamente · '}{TRIGGER_TYPES.find(t => t.id === triggerType)?.description}
                </p>
              </div>

              {/* ENTÃO (Action) */}
              <div className="space-y-2 p-3 bg-primary/5 rounded-lg">
                <Label className="text-xs font-bold text-primary">ENTÃO (Ação)</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {actionChoices.map(a => (
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
                {(actionType === 'assign_to' || (actionType === 'notify' && instant)) && (
                  <div className="space-y-1">
                    <Label className="text-xs">{actionType === 'assign_to' ? 'Pessoa' : 'Quem recebe (vazio = responsável do card)'}</Label>
                    <Select value={actionProfileId || (actionType === 'notify' ? '__resp' : undefined)} onValueChange={(v) => setActionProfileId(v === '__resp' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Escolha a pessoa" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {actionType === 'notify' ? <SelectItem value="__resp">Responsável do card</SelectItem> : null}
                        {[...users].sort((a, b) => (a.display_name || a.name).localeCompare(b.display_name || b.name, 'pt-BR')).map(u => <SelectItem key={u.id} value={u.id}>{u.display_name || u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {actionType === 'add_label' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Etiqueta</Label>
                    {labels.length ? (
                      <Select value={actionLabelId} onValueChange={setActionLabelId}>
                        <SelectTrigger><SelectValue placeholder="Escolha a etiqueta" /></SelectTrigger>
                        <SelectContent>{labels.map(l => <SelectItem key={l.id} value={l.id}><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color || '#888' }} />{l.name}</SelectItem>)}</SelectContent>
                      </Select>) : <p className="text-xs text-muted-foreground">Este mural ainda não tem etiquetas. Crie uma no card (Etiquetas).</p>}
                  </div>
                )}
                {actionType === 'set_due_days' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Dias a partir de hoje</Label>
                    <Input type="number" value={actionDays} onChange={(e) => setActionDays(e.target.value)} min="0" max="365" />
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
